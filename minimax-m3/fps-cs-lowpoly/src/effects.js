import * as THREE from 'three';

// Effects manager: short-lived visual effects (tracers, impact decals, sparks).
// All objects are pooled / capped to keep allocations + scene-graph size bounded.

const TRACER_LIFE = 0.10;        // seconds
const DECAL_LIFE  = 6.0;         // seconds
const DECAL_FADE  = 1.2;         // last N seconds the decal fades out
const SPARK_LIFE  = 0.25;        // seconds
const MAX_DECALS  = 30;          // FIFO

// Shared geometries / materials so we don't allocate per shot.
let _tracerGeo = null;
let _decalGeo  = null;
let _sparkGeo  = null;
function _initShared() {
  if (_tracerGeo) return;
  // BufferGeometry with 2 vertices, updated per tracer
  _tracerGeo = new THREE.BufferGeometry();
  _tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  // Tiny cube for spark
  _sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  // Flat disc for decals
  _decalGeo = new THREE.CircleGeometry(0.07, 8);
}

const _upZ = new THREE.Vector3(0, 0, 1);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    _initShared();
    this.tracers = [];   // { line, mat, age, life }
    this.decals  = [];   // { mesh, mat, age, life }
    this.sparks  = [];   // { mesh, vel, age, life }
  }

  // -------- Tracers (line from muzzle to hit point) --------
  addTracer(from, to, color = 0xfff0a0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      from.x, from.y, from.z,
      to.x,   to.y,   to.z
    ]), 3));
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    this.tracers.push({ line, mat, age: 0, life: TRACER_LIFE });
  }

  // -------- Decals (impact marks on walls / blood) --------
  // `kind` = 'wall' | 'blood'
  addImpactDecal(point, normal, kind = 'wall') {
    // FIFO eviction
    while (this.decals.length >= MAX_DECALS) {
      const old = this.decals.shift();
      this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
    const mat = new THREE.MeshBasicMaterial({
      color: kind === 'blood' ? 0xaa0a0a : 0x0c0c0c,
      transparent: true,
      opacity: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(_decalGeo, mat);
    // Slight offset along normal to avoid z-fighting
    mesh.position.copy(point).addScaledVector(normal, 0.01);
    // Orient disc so its +Z faces along normal
    const q = new THREE.Quaternion().setFromUnitVectors(_upZ, normal);
    mesh.quaternion.copy(q);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.decals.push({ mesh, mat, age: 0, life: DECAL_LIFE });
  }

  // -------- Sparks (small cubes flying out of an impact) --------
  // `kind` = 'wall' | 'blood'
  addSparks(point, normal, kind = 'wall', count = 4) {
    const color = kind === 'blood' ? 0xcc1010 : 0xffd060;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(_sparkGeo, mat);
      mesh.position.copy(point);
      // Velocity: mostly along normal, with random spread
      const vel = new THREE.Vector3(normal.x, normal.y, normal.z)
        .multiplyScalar(2 + Math.random() * 2);
      // Add jitter
      vel.x += (Math.random() - 0.5) * 1.5;
      vel.y += Math.random() * 1.2;
      vel.z += (Math.random() - 0.5) * 1.5;
      const scale = 0.6 + Math.random() * 0.6;
      mesh.scale.setScalar(scale);
      this.scene.add(mesh);
      this.sparks.push({ mesh, mat, vel, age: 0, life: SPARK_LIFE });
    }
  }

  // -------- Update / cleanup --------
  update(dt) {
    // Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.age += dt;
      const k = Math.max(0, 1 - t.age / t.life);
      t.mat.opacity = 0.95 * k;
      if (t.age >= t.life) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.mat.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // Decals (fade in last DECAL_FADE seconds)
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.age += dt;
      const remaining = d.life - d.age;
      if (remaining <= DECAL_FADE) {
        d.mat.opacity = Math.max(0, remaining / DECAL_FADE) * 0.95;
      }
      if (d.age >= d.life) {
        this.scene.remove(d.mesh);
        d.mesh.material.dispose();
        this.decals.splice(i, 1);
      }
    }
    // Sparks: integrate + fade + remove
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      // gravity-ish
      s.vel.y -= 9 * dt;
      s.mesh.position.x += s.vel.x * dt;
      s.mesh.position.y += s.vel.y * dt;
      s.mesh.position.z += s.vel.z * dt;
      s.mat.opacity = Math.max(0, 1 - s.age / s.life);
      if (s.age >= s.life || s.mesh.position.y < 0) {
        this.scene.remove(s.mesh);
        s.mesh.material.dispose();
        this.sparks.splice(i, 1);
      }
    }
  }

  // Clear everything (used on restart)
  clear() {
    for (const t of this.tracers) { this.scene.remove(t.line); t.line.geometry.dispose(); t.mat.dispose(); }
    for (const d of this.decals)  { this.scene.remove(d.mesh); d.mesh.material.dispose(); }
    for (const s of this.sparks)  { this.scene.remove(s.mesh); s.mesh.material.dispose(); }
    this.tracers.length = 0;
    this.decals.length  = 0;
    this.sparks.length  = 0;
  }
}
