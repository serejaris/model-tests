import * as THREE from 'three';

// ---------- Math ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp  = (a, b, t) => a + (b - a) * t;
export const rand  = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const dist2 = (a, b) => {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

// ---------- Collision: AABB axis-aligned ----------
// Box: { min: Vector3, max: Vector3 }
export function aabbFromBox(box) {
  return {
    min: new THREE.Vector3(box.minX, box.minY, box.minZ),
    max: new THREE.Vector3(box.maxX, box.maxY, box.maxZ)
  };
}

export function aabbOverlap(a, b) {
  return (
    a.min.x <= b.max.x && a.max.x >= b.min.x &&
    a.min.z <= b.max.z && a.max.z >= b.min.z &&
    a.min.y <= b.max.y && a.max.y >= b.min.y
  );
}

// Move a circle (player radius) on the XZ plane resolving collisions vs an AABB.
// `pos` is a Vector3, `delta` is {x, z} movement this frame, `radius` is player half-width.
export function resolveMoveXZ(pos, delta, radius, boxes) {
  // X axis
  if (delta.x !== 0) {
    pos.x += delta.x;
    const r = radius;
    for (const b of boxes) {
      if (pos.x + r > b.min.x && pos.x - r < b.max.x &&
          pos.z + r > b.min.z && pos.z - r < b.max.z &&
          pos.y < b.max.y && pos.y + 1.7 > b.min.y) {
        if (delta.x > 0) pos.x = b.min.x - r - 1e-4;
        else             pos.x = b.max.x + r + 1e-4;
      }
    }
  }
  // Z axis
  if (delta.z !== 0) {
    pos.z += delta.z;
    for (const b of boxes) {
      if (pos.x + radius > b.min.x && pos.x - radius < b.max.x &&
          pos.z + radius > b.min.z && pos.z - radius < b.max.z &&
          pos.y < b.max.y && pos.y + 1.7 > b.min.y) {
        if (delta.z > 0) pos.z = b.min.z - radius - 1e-4;
        else             pos.z = b.max.z + radius + 1e-4;
      }
    }
  }
}

// Raycast a list of meshes, return closest hit (with distance) or null.
export function raycastMeshes(raycaster, meshes) {
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length ? hits[0] : null;
}

// Check line of sight between two points vs obstacles.
export function hasLineOfSight(from, to, obstacles) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  if (dist < 1e-4) return true;
  dir.normalize();
  const ray = new THREE.Raycaster(from, dir, 0, dist);
  const hits = ray.intersectObjects(obstacles, false);
  return hits.length === 0;
}

// ---------- Audio (lightweight synth, no assets) ----------
let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; }
  }
  return audioCtx;
}
export function beep({ freq = 440, dur = 0.08, type = 'square', vol = 0.15 } = {}) {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}
export function resumeAudio() { const c = ctx(); if (c && c.state === 'suspended') c.resume(); }
