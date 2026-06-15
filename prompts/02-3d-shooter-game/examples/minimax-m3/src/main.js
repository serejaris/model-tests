import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Weapon, fireWeapon } from './weapon.js';
import { Bot } from './bot.js';
import { UI } from './ui.js';
import { Effects } from './effects.js';
import { clamp, resumeAudio, beep, hasLineOfSight } from './utils.js';

class Game {
  constructor() {
    this.container = document.getElementById('app');
    this.ui = new UI();

    // ---- Renderer ----
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x0e0e10, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // ---- Scene & Camera ----
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121214);
    this.scene.fog = new THREE.Fog(0x121214, 8, 70);

    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 200);

    // Ambient + key light
    this.scene.add(new THREE.AmbientLight(0x707078, 0.6));
    const sun = new THREE.DirectionalLight(0xfff2c8, 0.35);
    sun.position.set(20, 40, 10);
    this.scene.add(sun);

    // ---- World ----
    this.world = buildWorld(this.scene);

    // ---- Player & weapon ----
    this.player = new Player(this.camera, this.world);
    this.weapon = new Weapon(this.camera);
    this.scene.add(this.camera);

    // ---- Effects ----
    this.effects = new Effects(this.scene);

    // ---- Ammo ----
    this.magSize = 30;
    this.ammo = this.magSize;
    this.reserveAmmo = 120;
    this.reloadTime = 1.6;
    this.reloadTimer = 0;
    this.fireCooldown = 0.10;
    this.fireTimer = 0;
    this.fireHeld = false; // LMB held → auto-fire

    // ---- Bots ----
    this.bots = this.world.botSpawns.map(sp => new Bot(this.scene, sp, this.world));
    this.botsKilled = 0;
    this.totalBots = this.bots.length;

    // ---- State ----
    this.running = false;
    this.locked = false;
    this.ended = null; // 'win' | 'lose' | null

    // ---- UI initial state ----
    this.ui.setHP(this.player.hp, this.player.maxHp);
    this.ui.setAmmo(this.ammo, this.magSize);
    this.ui.setEnemies(this.bots.filter(b => b.alive).length);

    // ---- Input ----
    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('blur', () => { this.fireHeld = false; });

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.player.setKey(e.code, true);
      if (e.code === 'KeyR') this._startReload();
    });
    document.addEventListener('keyup', (e) => this.player.setKey(e.code, false));

    document.addEventListener('pointerlockchange', () => {
      this.locked = (document.pointerLockElement === this.renderer.domElement);
      if (!this.locked && this.running && !this.ended) {
        // Paused — show overlay so player can resume
        this.running = false;
        this.fireHeld = false;
        this.ui.showOverlay(null, 'PAUSED');
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.player.onMouseMove(e.movementX, e.movementY);
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.fireHeld = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
    });
    // Right-click menu would break the game flow
    document.addEventListener('contextmenu', (e) => { e.preventDefault(); this.fireHeld = false; });

    this.ui.onStart(() => this._startOrResume());
  }

  _onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  _startOrResume() {
    if (this.ended) this._restart();
    resumeAudio();
    this.renderer.domElement.requestPointerLock();
    this.running = true;
    this.ui.hideOverlay();
  }

  _restart() {
    // Remove old bots
    for (const b of this.bots) this.scene.remove(b.root);
    this.bots = this.world.botSpawns.map(sp => new Bot(this.scene, sp, this.world));
    this.botsKilled = 0;
    this.totalBots = this.bots.length;
    this.ended = null;
    this.fireHeld = false;

    // Reset player
    this.player.position.copy(this.world.playerSpawn);
    this.player.position.y = 0;
    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.dead = false;
    this.player.yaw = 0;
    this.player.pitch = 0;

    // Reset ammo
    this.ammo = this.magSize;
    this.reserveAmmo = 120;
    this.reloadTimer = 0;
    this.fireTimer = 0;

    // Clear effects
    this.effects.clear();

    this.ui.setHP(this.player.hp, this.player.maxHp);
    this.ui.setAmmo(this.ammo, this.magSize);
    this.ui.setEnemies(this.bots.filter(b => b.alive).length);
  }

  _startReload() {
    if (this.reloadTimer > 0) return;
    if (this.ammo >= this.magSize) return;
    if (this.reserveAmmo <= 0) {
      this.ui.flashMessage('NO AMMO');
      beep({ freq: 220, dur: 0.12, type: 'square', vol: 0.15 });
      return;
    }
    this.reloadTimer = this.reloadTime;
    this.ui.flashMessage('RELOADING…');
  }

  _finishReload() {
    const need = this.magSize - this.ammo;
    const take = Math.min(need, this.reserveAmmo);
    this.ammo += take;
    this.reserveAmmo -= take;
    this.ui.setAmmo(this.ammo, this.magSize);
    beep({ freq: 320, dur: 0.08, type: 'square', vol: 0.15 });
  }

  _shoot() {
    if (this.fireTimer > 0) return;
    if (this.reloadTimer > 0) return;
    if (this.ammo <= 0) {
      beep({ freq: 200, dur: 0.06, type: 'square', vol: 0.13 });
      this._startReload();
      return;
    }
    this.ammo--;
    this.ui.setAmmo(this.ammo, this.magSize);
    this.fireTimer = this.fireCooldown;

    const result = fireWeapon(this.camera, this.weapon, this.world, this.bots);

    // Tracer (always — even misses, gives satisfying feedback)
    this.effects.addTracer(result.muzzlePos, result.point);

    if (result.kind === 'world' && result.normal) {
      this.effects.addImpactDecal(result.point, result.normal, 'wall');
      this.effects.addSparks(result.point, result.normal, 'wall', 4);
    } else if (result.kind === 'bot' && result.victim) {
      // Sparks fly from impact in the direction the bullet was traveling (away from player)
      const dir = result.point.clone().sub(this.player.position);
      dir.y = 0;
      if (dir.lengthSq() > 1e-4) dir.normalize();
      this.effects.addSparks(result.point, dir, 'blood', 5);
      // Also drop a small blood decal on the bot at the hit point
      this.effects.addImpactDecal(result.point, dir, 'blood');

      const killed = result.victim.takeDamage(28, this.player.position);
      this.ui.flashHit();
      if (killed) {
        this.botsKilled++;
        this.ui.flashMessage(`+1 KILL  (${this.botsKilled}/${this.totalBots})`, 1.6);
        beep({ freq: 880, dur: 0.18, type: 'triangle', vol: 0.18 });
      }
    }

    if (this.ammo === 0 && this.reserveAmmo > 0) this._startReload();
  }

  _checkEndConditions() {
    if (this.ended) return;
    if (!this.player.alive) {
      this.ended = 'lose';
      this.running = false;
      this.fireHeld = false;
      document.exitPointerLock?.();
      this.ui.showOverlay('lose', 'YOU DIED');
      return;
    }
    if (this.bots.every(b => !b.alive)) {
      this.ended = 'win';
      this.running = false;
      this.fireHeld = false;
      document.exitPointerLock?.();
      this.ui.showOverlay('win', 'VICTORY');
    }
  }

  _updateUI(dt) {
    this.ui.update(dt);
    this.ui.setHP(this.player.hp, this.player.maxHp);
    this.ui.setEnemies(this.bots.filter(b => b.alive).length);
  }

  start() {
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      dt = clamp(dt, 0, 0.05);

      if (this.running) {
        // Player
        this.player.update(dt);
        this.weapon.setMoveInput(this.player.input.forward !== 0 || this.player.input.right !== 0);
        this.weapon.update(dt);

        // Reload timer
        if (this.reloadTimer > 0) {
          this.reloadTimer -= dt;
          if (this.reloadTimer <= 0) { this.reloadTimer = 0; this._finishReload(); }
        }
        if (this.fireTimer > 0) this.fireTimer -= dt;

        // Auto-fire (full-auto while LMB is held)
        if (this.fireHeld && this.fireTimer <= 0 && this.ammo > 0 && this.reloadTimer === 0) {
          this._shoot();
        }

        // Bots
        for (const b of this.bots) {
          b.lastShotHit = null;
          b.update(dt, this.player, now / 1000);
        }

        // Apply bot damage to player
        for (const b of this.bots) {
          if (!b.alive) continue;
          if (b.lastShotHit) {
            this.player.takeDamage(b.lastShotHit.damage);
            this.ui.flashHit();
            if (b.lastShotHit.headshot) this.ui.flashMessage('HEADSHOT', 0.6);
          }
        }

        // Effects update
        this.effects.update(dt);

        this._checkEndConditions();
        this._updateUI(dt);
      }

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
}

// Bootstrap
const game = new Game();
game.start();

// Expose for headless tests / debugging
if (typeof window !== 'undefined') window.__game = game;
