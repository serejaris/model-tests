import * as THREE from 'three';
import { clamp, beep } from './utils.js';

// A simple, low-poly weapon mesh attached to the camera. We build it procedurally
// so the look matches the rest of the arena (flat shading, boxy).
export class Weapon {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'weapon';

    const matBody = new THREE.MeshLambertMaterial({ color: 0x2a2a2c, flatShading: true });
    const matGrip = new THREE.MeshLambertMaterial({ color: 0x1a1a1c, flatShading: true });
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x6a6a6e, flatShading: true });
    const matAccent = new THREE.MeshLambertMaterial({ color: 0x884422, flatShading: true });

    // Receiver / main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), matBody);
    body.position.set(0, 0, -0.05);
    this.group.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.32), matMetal);
    barrel.position.set(0, 0.01, -0.32);
    this.group.add(barrel);
    this.barrel = barrel;

    // Muzzle light (point light at the muzzle for a muzzle flash)
    this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 4, 2);
    this.muzzleLight.position.set(0, 0.01, -0.5);
    this.group.add(this.muzzleLight);

    // Muzzle flash plane (additive billboard, hidden by default)
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd070,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
    this.muzzleFlash.position.set(0, 0.01, -0.5);
    this.muzzleFlash.visible = false;
    this.group.add(this.muzzleFlash);

    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), matBody);
    mag.position.set(0, -0.13, 0.05);
    mag.rotation.x = -0.15;
    this.group.add(mag);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.09), matGrip);
    grip.position.set(0, -0.16, 0.13);
    grip.rotation.x = 0.25;
    this.group.add(grip);

    // Stock (small visible piece behind grip)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.16), matGrip);
    stock.position.set(0, -0.04, 0.22);
    this.group.add(stock);

    // Sight accent
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.04), matAccent);
    sight.position.set(0, 0.085, -0.04);
    this.group.add(sight);

    // Initial position: lower right of the view
    this.basePos = new THREE.Vector3(0.22, -0.22, -0.45);
    this.group.position.copy(this.basePos);
    this.group.rotation.set(0, 0, 0);

    // State for viewmodel animation
    this.kickAmt = 0;
    this.flashTimer = 0;
    this.flashFullLife = 0.06;

    // Add as a child of the camera so it follows view
    this.camera.add(this.group);
  }

  kick(amount = 1) {
    this.kickAmt = clamp(this.kickAmt + amount, 0, 1.0);
    this.flashTimer = this.flashFullLife;
    this.muzzleLight.intensity = 4;
    this.muzzleFlash.visible = true;
    this.muzzleFlash.material.opacity = 0.9;
  }

  // World-space position of the muzzle tip (for tracers / sparks).
  // The barrel is at local (0, 0.01, -0.32) and is 0.32 long, so the tip is
  // at local (0, 0.01, -0.48). We compute from the camera's world matrix.
  muzzleWorldPos(out = new THREE.Vector3()) {
    out.set(0, 0.01, -0.48);
    this.group.updateWorldMatrix(true, false);
    out.applyMatrix4(this.group.matrixWorld);
    return out;
  }

  // Called every frame to apply viewmodel animation
  update(dt) {
    const t = performance.now() * 0.001;
    // Idle sway
    const swayX = Math.sin(t * 1.4) * 0.0035;
    const swayY = Math.cos(t * 1.1) * 0.0030;
    // Bob while moving
    const moving = (Math.abs(this.playerMove) > 0.01);
    const bob = moving ? Math.sin(t * 9) * 0.012 : 0;

    // Kick decays
    this.kickAmt = Math.max(0, this.kickAmt - dt * 6);
    // Flash decays
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(0, this.flashTimer / this.flashFullLife);
      this.muzzleLight.intensity = 4 * k;
      this.muzzleFlash.material.opacity = 0.9 * k;
      if (this.flashTimer <= 0) {
        this.muzzleFlash.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    const pos = this.basePos.clone();
    pos.x += swayX + (this.kickAmt * 0.04);
    pos.y += swayY + bob + (this.kickAmt * 0.06);
    pos.z += (this.kickAmt * 0.12);

    this.group.position.copy(pos);
    this.group.rotation.x = -this.kickAmt * 0.35;
    this.group.rotation.z =  this.kickAmt * 0.06;
  }

  setMoveInput(active) { this.playerMove = active ? 1 : 0; }
}

// Weapon fire logic. Returns:
//   {
//     kind: 'world' | 'bot' | 'miss',
//     point: Vector3,        // impact point (or far point for miss)
//     normal: Vector3 | null,
//     distance: number,
//     victim: Bot | null,
//     muzzlePos: Vector3
//   }
export function fireWeapon(camera, weapon, world, bots) {
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  dir.normalize();

  const ray = new THREE.Raycaster(origin, dir, 0.5, 200);

  // Test against world obstacles first
  const worldHit = ray.intersectObjects(world.obstacles, false)[0] || null;
  // Then bots (recursive: bot geometry lives in nested body group)
  const botMeshes = bots.filter(b => b.alive).map(b => b.root);
  const botHit = ray.intersectObjects(botMeshes, true)[0] || null;

  let result = null;
  if (worldHit && (!botHit || worldHit.distance < botHit.distance)) {
    result = {
      kind: 'world',
      point: worldHit.point.clone(),
      normal: worldHit.face?.normal?.clone().transformDirection(worldHit.object.matrixWorld) ?? null,
      distance: worldHit.distance,
      victim: null
    };
  } else if (botHit) {
    // find the bot whose root contains the hit
    let victim = null;
    for (const b of bots) {
      if (!b.alive) continue;
      let found = false;
      b.root.traverse(o => { if (o === botHit.object) found = true; });
      if (found) { victim = b; break; }
    }
    result = {
      kind: 'bot',
      point: botHit.point.clone(),
      normal: null,
      distance: botHit.distance,
      victim
    };
  } else {
    // Pure miss — put point at max ray distance
    result = {
      kind: 'miss',
      point: origin.clone().addScaledVector(dir, 80),
      normal: null,
      distance: 80,
      victim: null
    };
  }

  // Visual: muzzle flash + kick
  weapon.kick(1);
  beep({ freq: 720 + Math.random() * 80, dur: 0.05, type: 'square', vol: 0.18 });

  // Audio cues
  if (result.kind === 'bot') beep({ freq: 1320, dur: 0.04, type: 'sine', vol: 0.10 });
  if (result.kind === 'world') beep({ freq: 180, dur: 0.04, type: 'sawtooth', vol: 0.10 });

  // Attach muzzle position for tracer spawning
  result.muzzlePos = weapon.muzzleWorldPos();
  return result;
}
