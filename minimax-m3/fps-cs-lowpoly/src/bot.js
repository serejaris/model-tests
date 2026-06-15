import * as THREE from 'three';
import { clamp, rand, dist2, hasLineOfSight, resolveMoveXZ, beep } from './utils.js';

// Bot = simple humanoid with low-poly geometry and an FSM:
// PATROL → CHASE → ATTACK → DEAD
//
// root = world transform (position + yaw)
// body = inner group with all parts; rotated for pain/death/run tilt

const STATE = { PATROL: 'PATROL', CHASE: 'CHASE', ATTACK: 'ATTACK', DEAD: 'DEAD' };

export class Bot {
  constructor(scene, spawn, world) {
    this.scene = scene;
    this.world = world;
    this.position = spawn.clone();
    this.position.y = 0;
    this.velocityY = 0;
    this.onGround = true;
    this.radius = 0.5;
    this.height = 1.7;
    this.yaw = Math.random() * Math.PI * 2;
    this.alive = true;
    this.hp = 60;
    this.maxHp = 60;

    this.state = STATE.PATROL;
    this.target = null; // waypoint
    this.lastShotAt = 0;
    this.shootInterval = 0.35; // seconds between shots
    this.accuracy = 0.18; // radians of random inaccuracy
    this.viewRange = 32;
    this.shootRange = 22;
    this.detectionRange = 30;
    this.speed = 4.0;
    this.alertUntil = 0;
    this.lastSeenPlayerAt = 0;
    this.lostTimer = 0;
    this.hitFlash = 0;

    // Pain / death animation state
    this.painKick = 0;        // 0..1, decays to 0
    this.hitFromDir = new THREE.Vector3(1, 0, 0); // XZ dir FROM shooter TO bot
    this.deathProgress = 0;   // 0..1 during death
    this.deathSideAxis = (Math.random() - 0.5) * 2; // -1..1 for side tilt
    this.runTilt = 0;         // 0..1 lean-into-run amount

    this.root = new THREE.Group();
    this.root.name = 'bot';
    this.body = new THREE.Group();
    this.root.add(this.body);
    this._buildMesh();
    this.root.position.copy(this.position);
    scene.add(this.root);

    this._pickNewWaypoint();
  }

  _buildMesh() {
    const matBody = new THREE.MeshLambertMaterial({ color: 0x6b1212, flatShading: true });
    const matHead = new THREE.MeshLambertMaterial({ color: 0xc8a07a, flatShading: true });
    const matLegs = new THREE.MeshLambertMaterial({ color: 0x222033, flatShading: true });
    const matGun  = new THREE.MeshLambertMaterial({ color: 0x1a1a1c, flatShading: true });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), matBody);
    torso.position.y = 1.05;
    this.body.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), matHead);
    head.position.y = 1.6;
    this.body.add(head);
    this.headMesh = head;

    // Eyes
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), eyeMat);
    eyeL.position.set(-0.08, 1.62, 0.19);
    this.body.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.08; this.body.add(eyeR);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), matBody);
    armL.position.set(-0.36, 1.05, 0);
    this.body.add(armL);
    const armR = armL.clone(); armR.position.x = 0.36; this.body.add(armR);

    // Gun in right hand
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), matGun);
    gun.position.set(0.36, 1.0, 0.22);
    this.body.add(gun);
    this.gunMesh = gun;

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.2), matLegs);
    legL.position.set(-0.14, 0.42, 0);
    this.body.add(legL);
    const legR = legL.clone(); legR.position.x = 0.14; this.body.add(legR);

    // Tiny shadow blob (so they read better on the floor)
    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.01;
    this.body.add(sh);
  }

  _pickNewWaypoint() {
    const w = this.world.waypoints;
    this.target = w[Math.floor(Math.random() * w.length)].clone();
  }

  _facingToward(x, z) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    const desiredYaw = Math.atan2(dx, dz);
    // shortest angle
    let diff = desiredYaw - this.yaw;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    this.yaw += clamp(diff, -0.18, 0.18);
  }

  // Apply damage. `fromPos` (optional) = position of the shooter in world space.
  // When provided, sets hitFromDir for the pain-recoil direction.
  takeDamage(amount, fromPos = null) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.hitFlash = 0.18;

    if (fromPos) {
      const dx = this.position.x - fromPos.x;
      const dz = this.position.z - fromPos.z;
      const len = Math.hypot(dx, dz) || 1;
      this.hitFromDir.set(dx / len, 0, dz / len);
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.state = STATE.DEAD;
      this.deathProgress = 0;
      return true;
    }

    // Pain recoil — pop to 1, decays in update()
    this.painKick = 1.0;
    // Aggro
    this.alertUntil = performance.now() / 1000 + 4;
    return false;
  }

  // Eye position for line-of-sight and shots
  getEyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + 1.55, this.position.z);
  }

  // Aim muzzle at the player; returns true if a shot is fired and resolves hit vs player
  _tryShoot(player, now) {
    if (now - this.lastShotAt < this.shootInterval) return false;
    if (dist2(this.position, player.position) > this.shootRange) return false;
    // Check if can see player
    const eye = this.getEyePosition();
    const target = player.getEyePosition();
    if (!hasLineOfSight(eye, target, this.world.obstacles)) return false;

    this.lastShotAt = now;
    // Accuracy: randomize a bit
    const aimJitter = (Math.random() - 0.5) * this.accuracy;
    this.yaw += aimJitter;
    beep({ freq: 540 + Math.random() * 60, dur: 0.06, type: 'square', vol: 0.14 });

    // Hit resolution: raycast with the same inaccuracy and check player radius
    const dir = new THREE.Vector3().subVectors(target, eye).normalize();
    // Apply yaw jitter (rotate dir slightly in XZ plane)
    const cosA = Math.cos(aimJitter * 4), sinA = Math.sin(aimJitter * 4);
    const rx = dir.x * cosA - dir.z * sinA;
    const rz = dir.x * sinA + dir.z * cosA;
    const fireDir = new THREE.Vector3(rx, dir.y, rz).normalize();

    const ray = new THREE.Raycaster(eye, fireDir, 0.5, this.shootRange);
    // Check world obstacles first; if world blocks, miss
    const worldHit = ray.intersectObjects(this.world.obstacles, false)[0];
    const distToPlayer = eye.distanceTo(target);
    if (!worldHit || worldHit.distance > distToPlayer) {
      // Apply damage to player; small headshot bonus
      const isHeadshot = Math.random() < 0.15;
      const dmg = isHeadshot ? 18 : 8;
      this.lastShotHit = { damage: dmg, headshot: isHeadshot };
    } else {
      this.lastShotHit = null;
    }
    return true;
  }

  update(dt, player, now) {
    // ===== Death animation =====
    if (!this.alive) {
      // Advance death progress (0 → 1 over ~0.4s)
      if (this.deathProgress < 1) {
        this.deathProgress = Math.min(1, this.deathProgress + dt * 2.5);
      } else {
        // Fully laid out, slowly sink
        this.root.position.y = Math.max(-0.1, this.root.position.y - dt * 0.05);
      }
      // Apply tilt via body group
      // X axis: pitch face-down
      this.body.rotation.x = -this.deathProgress * (Math.PI / 2);
      // Z axis: side tilt for a more natural fall
      this.body.rotation.z = this.deathSideAxis * this.deathProgress * 0.3;
      // Yaw stays applied on root
      this.root.rotation.y = this.yaw;
      return;
    }

    // ===== Decay pain kick (0.18s) =====
    if (this.painKick > 0) {
      this.painKick = Math.max(0, this.painKick - dt * (1 / 0.18));
    }

    // ===== Detection =====
    const distToPlayer = dist2(this.position, player.position);
    const eye = this.getEyePosition();
    const playerEye = player.getEyePosition();
    const canSee = distToPlayer < this.detectionRange && hasLineOfSight(eye, playerEye, this.world.obstacles);
    if (canSee) {
      this.lastSeenPlayerAt = now;
      this.lostTimer = 0;
    } else if (this.lastSeenPlayerAt > 0) {
      this.lostTimer += dt;
    }
    const recentlySeen = (now - this.lastSeenPlayerAt) < 4.0;

    // ===== FSM =====
    if (this.hp <= 0) {
      this.state = STATE.DEAD;
    } else if (canSee && distToPlayer <= this.shootRange) {
      this.state = STATE.ATTACK;
    } else if (canSee || recentlySeen) {
      this.state = STATE.CHASE;
    } else {
      this.state = STATE.PATROL;
    }

    // ===== Behavior =====
    let moveX = 0, moveZ = 0;
    let speed = this.speed;

    if (this.state === STATE.PATROL) {
      if (!this.target || dist2(this.position, this.target) < 1.5) {
        this._pickNewWaypoint();
      }
      this._facingToward(this.target.x, this.target.z);
      const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      moveX = f.x; moveZ = f.z;
    } else if (this.state === STATE.CHASE) {
      this._facingToward(player.position.x, player.position.z);
      const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      moveX = f.x; moveZ = f.z;
      speed = this.speed * 1.1;
    } else if (this.state === STATE.ATTACK) {
      this._facingToward(player.position.x, player.position.z);
      const side = Math.sin(now * 1.5) * 0.6;
      const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      moveX = f.x * 0.1 + r.x * side;
      moveZ = f.z * 0.1 + r.z * side;
      this._tryShoot(player, now);
    }

    // ===== Gravity =====
    this.velocityY += -18 * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= 0) { this.position.y = 0; this.velocityY = 0; this.onGround = true; }

    // ===== Move (collisions) =====
    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.hypot(moveX, moveZ) || 1;
      const dx = (moveX / len) * speed * dt;
      const dz = (moveZ / len) * speed * dt;
      resolveMoveXZ(this.position, { x: dx, z: dz }, this.radius, this.world.colliders);
    }

    // ===== Apply transform =====
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;

    // ===== Body tilt: pain + run lean =====
    // Run lean (forward = -X in local). Approximate forward by -Z (since yaw=0 → facing +Z direction is
    // implemented as root.rotation.y = 0; we treat +Z as forward).
    const moveMag = Math.hypot(moveX, moveZ);
    const targetRunTilt = moveMag > 0.05 ? 1 : 0;
    this.runTilt += (targetRunTilt - this.runTilt) * Math.min(1, dt * 8);

    // Compute forward in world XZ from yaw
    const fwdX = Math.sin(this.yaw), fwdZ = Math.cos(this.yaw);

    // Pain tilt: rotate body so it leans in the direction the bullet came from.
    // We want to tilt the body around an axis perpendicular to hitFromDir (in XZ).
    // Simplification: apply pitch (X) and roll (Z) components proportional to
    // hitFromDir's forward / right dot products.
    // hitFromDir is normalized in XZ; we want body to "fall back" from impact.
    const pain = this.painKick;
    // forward component: bullet came from behind → push body forward (negative pitch)
    // signed against fwd so . means bullet from front
    const fromFront = -(hitFromDirX(fwdX, fwdZ, this.hitFromDir)); // +1 if from front
    // right component: bullet from left → tilt left (roll left = +Z)
    const fromLeft  = hitFromDirZ(fwdX, fwdZ, this.hitFromDir);     // +1 if from left

    // Apply: pitch 0.25 rad proportional to fromFront
    const painPitch = -fromFront * 0.25 * pain;
    const painRoll  = -fromLeft  * 0.25 * pain;
    // Run lean: small forward pitch
    const runPitch = -0.10 * this.runTilt;

    this.body.rotation.x = painPitch + runPitch;
    this.body.rotation.z = painRoll;
    this.body.rotation.y = 0;

    // ===== Head hit flash =====
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const k = clamp(this.hitFlash / 0.18, 0, 1);
      this.headMesh.material.emissive = new THREE.Color(0xff3322).multiplyScalar(k);
    } else {
      this.headMesh.material.emissive = new THREE.Color(0x000000);
    }

    // ===== Leg animation =====
    if (moveMag > 0.05) {
      const phase = now * 8;
      this.body.children.forEach(c => {
        if (c.geometry?.type === 'BoxGeometry' && Math.abs(c.position.y - 0.42) < 0.01) {
          c.rotation.x = Math.sin(phase) * 0.5 * (c.position.x < 0 ? 1 : -1);
        }
      });
    } else {
      this.body.children.forEach(c => {
        if (c.geometry?.type === 'BoxGeometry' && Math.abs(c.position.y - 0.42) < 0.01) {
          c.rotation.x *= 0.85;
        }
      });
    }
  }
}

// Helpers: dot products of (fwdX, fwdZ) with (dx, dz) for hitFromDir
function hitFromDirX(fwdX, fwdZ, d) { return fwdX * d.x + fwdZ * d.z; } // +1 if from front
function hitFromDirZ(fwdX, fwdZ, d) { return -fwdZ * d.x + fwdX * d.z; } // +1 if from left
