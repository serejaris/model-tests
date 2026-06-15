import * as THREE from 'three';
import { clamp, resolveMoveXZ } from './utils.js';

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.position = world.playerSpawn.clone();
    this.position.y = 0; // feet on floor
    this.velocityY = 0;
    this.onGround = true;
    this.radius = 0.45;
    this.height = 1.7;

    // Look (yaw/pitch)
    this.yaw = 0;
    this.pitch = 0;
    this.lookSensitivity = 0.0022;

    // Movement
    this.walkSpeed = 5.5;
    this.runSpeed  = 9.0;
    this.jumpV     = 6.0;
    this.gravity   = -18;

    // Input
    this.input = { forward:0, right:0, jump:false, run:false };

    // HP
    this.maxHp = 100;
    this.hp = 100;
    this.dead = false;
    this.alive = true;

    // Weapon state
    this.weaponKick = 0;     // 0..1 visual recoil
    this.weaponSway = 0;

    // Apply initial transform
    this._applyCamera();
  }

  _applyCamera() {
    this.camera.position.set(this.position.x, this.position.y + this.height - 0.15, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  onMouseMove(dx, dy) {
    this.yaw   -= dx * this.lookSensitivity;
    this.pitch -= dy * this.lookSensitivity;
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  }

  setKey(code, down) {
    switch (code) {
      case 'KeyW': case 'ArrowUp':    this.input.forward = down ? 1 : 0; break;
      case 'KeyS': case 'ArrowDown':  this.input.forward = down ? -1 : 0; break;
      case 'KeyA': case 'ArrowLeft':  this.input.right   = down ? -1 : 0; break;
      case 'KeyD': case 'ArrowRight': this.input.right   = down ?  1 : 0; break;
      case 'Space':  this.input.jump  = down; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.run = down; break;
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.alive = false;
      this.dead = true;
    }
  }

  update(dt) {
    if (!this.alive) {
      this._applyCamera();
      return;
    }

    // Movement direction in world space
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    wish.addScaledVector(fwd, this.input.forward);
    wish.addScaledVector(right, this.input.right);
    if (wish.lengthSq() > 0) wish.normalize();

    const speed = this.input.run ? this.runSpeed : this.walkSpeed;
    const dx = wish.x * speed * dt;
    const dz = wish.z * speed * dt;

    // Jump + gravity
    if (this.input.jump && this.onGround) {
      this.velocityY = this.jumpV;
      this.onGround = false;
    }
    this.velocityY += this.gravity * dt;
    let dy = this.velocityY * dt;
    this.position.y += dy;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocityY = 0;
      this.onGround = true;
    }

    resolveMoveXZ(this.position, { x: dx, z: dz }, this.radius, this.world.colliders);

    // Decay weapon kick
    this.weaponKick = Math.max(0, this.weaponKick - dt * 6);
    this.weaponSway = clamp(this.weaponSway + (this.input.run ? 0.6 : 0.3) * dt, 0, 1);

    this._applyCamera();
  }

  getEyePosition() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + this.height - 0.15,
      this.position.z
    );
  }
}
