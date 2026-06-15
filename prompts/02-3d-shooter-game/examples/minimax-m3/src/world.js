import * as THREE from 'three';

// World is a low-poly arena: floor, ceiling, walls, crates, pillars, ladders (visual only).
// All obstacles are simple Box meshes. AABB boxes are pre-computed for collisions.

export function buildWorld(scene) {
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);

  // Materials — low poly flat shading
  const matFloor   = new THREE.MeshLambertMaterial({ color: 0x6b6b58, flatShading: true });
  const matCeil    = new THREE.MeshLambertMaterial({ color: 0x3a3a36, flatShading: true });
  const matWall    = new THREE.MeshLambertMaterial({ color: 0x8a8474, flatShading: true });
  const matWallAlt = new THREE.MeshLambertMaterial({ color: 0x7a6f5a, flatShading: true });
  const matCrate   = new THREE.MeshLambertMaterial({ color: 0x8a5a2c, flatShading: true });
  const matCrateX  = new THREE.MeshLambertMaterial({ color: 0x6f4421, flatShading: true });
  const matPillar  = new THREE.MeshLambertMaterial({ color: 0x4a4a44, flatShading: true });
  const matBarrel  = new THREE.MeshLambertMaterial({ color: 0x4a3a2a, flatShading: true });

  const colliders = []; // { min, max } on XZ
  const obstacles = []; // meshes for raycasts

  function addBox(w, h, d, x, y, z, mat, rotY = 0, collidable = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = false;
    m.receiveShadow = false;
    group.add(m);
    if (collidable) {
      // Compute AABB after rotation (we keep walls axis-aligned, so this is fine for our map)
      const halfW = w * 0.5, halfD = d * 0.5;
      colliders.push({
        min: new THREE.Vector3(x - halfW, y - h * 0.5, z - halfD),
        max: new THREE.Vector3(x + halfW, y + h * 0.5, z + halfD)
      });
      obstacles.push(m);
    }
    return m;
  }

  // ---------- Arena size ----------
  const W = 60, H = 6, D = 60; // outer room

  // Floor + ceiling
  addBox(W, 0.4, D, 0, -0.2, 0, matFloor, 0, false);
  addBox(W, 0.4, D, 0, H + 0.2, 0, matCeil, 0, false);

  // Outer walls (4)
  addBox(W, H, 0.5,  0, H / 2,  D / 2 - 0.25, matWall);
  addBox(W, H, 0.5,  0, H / 2, -D / 2 + 0.25, matWall);
  addBox(0.5, H, D,  W / 2 - 0.25, H / 2, 0, matWall);
  addBox(0.5, H, D, -W / 2 + 0.25, H / 2, 0, matWall);

  // ---------- Inner layout ----------
  // Long central wall with gap
  addBox(20, H, 0.5, -8, H / 2, 0, matWallAlt);
  addBox(8, H, 0.5,  20, H / 2, 0, matWallAlt);

  // Perpendicular walls forming rooms
  addBox(0.5, H, 18,  4, H / 2,  -6, matWallAlt);
  addBox(0.5, H, 14, 14, H / 2,   9, matWallAlt);
  addBox(0.5, H, 10, -2, H / 2,  18, matWallAlt);
  addBox(0.5, H, 12, 18, H / 2, -12, matWallAlt);

  // Half-walls (cover) and low walls
  addBox(8, 1.2, 0.4, -20, 0.6,  14, matWall);
  addBox(0.4, 1.2, 6, -20, 0.6,  11, matWall);
  addBox(8, 1.2, 0.4,  22, 0.6, -8, matWall);
  addBox(0.4, 1.2, 6,  18, 0.6, -11, matWall);

  // Crates (cover clusters)
  function crateCluster(cx, cz, count, seed = 0) {
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < count; i++) {
      const w = 1 + Math.floor(rnd() * 2);
      const h = 1 + Math.floor(rnd() * 2);
      const d = 1 + Math.floor(rnd() * 2);
      const ox = (rnd() - 0.5) * 3;
      const oz = (rnd() - 0.5) * 3;
      const mat = rnd() > 0.5 ? matCrate : matCrateX;
      addBox(w, h, d, cx + ox, h * 0.5, cz + oz, mat);
    }
  }
  crateCluster(-18, -10, 5, 11);
  crateCluster( 12,  18, 6, 22);
  crateCluster( 22,  -2, 4, 33);
  crateCluster( -6,  16, 4, 44);
  crateCluster( 18, -18, 3, 55);

  // Pillars
  for (const [x, z] of [[-12, 6], [8, 6], [-12, -16], [10, -10], [-22, 4], [22, 14]]) {
    addBox(1.2, H, 1.2, x, H / 2, z, matPillar);
  }

  // Barrels
  function barrel(x, z) {
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 1.4, 8);
    const m = new THREE.Mesh(geo, matBarrel);
    m.position.set(x, 0.7, z);
    group.add(m);
    colliders.push({
      min: new THREE.Vector3(x - 0.6, 0, z - 0.6),
      max: new THREE.Vector3(x + 0.6, 1.4, z + 0.6)
    });
    obstacles.push(m);
  }
  barrel(-20, -20);
  barrel(  4,  -4);
  barrel(  0,   8);
  barrel( 14,  10);
  barrel(-10,   2);

  // ---------- Decor: simple point lights ----------
  const lights = [];
  for (const [x, z] of [[-15, -15], [15, 15], [-15, 15], [15, -15], [0, 0]]) {
    const L = new THREE.PointLight(0xfff0c0, 0.7, 24, 1.6);
    L.position.set(x, H - 0.6, z);
    group.add(L);
    lights.push(L);
    // small fixture
    const fix = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.2, 0.6),
      new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0x553300, flatShading: true })
    );
    fix.position.set(x, H - 0.1, z);
    group.add(fix);
  }

  // ---------- Spawn points ----------
  const playerSpawn = new THREE.Vector3(-26, 0, 26);
  const botSpawns = [
    new THREE.Vector3( 26, 0, -26),
    new THREE.Vector3( 20, 0,  20),
    new THREE.Vector3(-22, 0, -18),
    new THREE.Vector3( 10, 0,  22),
    new THREE.Vector3( 26, 0,  10)
  ];

  // ---------- Patrol waypoints (for bots) ----------
  const waypoints = [
    new THREE.Vector3(-20, 0,  20), new THREE.Vector3(-10, 0,  10),
    new THREE.Vector3(  0, 0,   0), new THREE.Vector3( 10, 0, -10),
    new THREE.Vector3( 20, 0, -20), new THREE.Vector3( 10, 0,  20),
    new THREE.Vector3(-10, 0, -20), new THREE.Vector3(-20, 0, -10),
    new THREE.Vector3( 20, 0,  10), new THREE.Vector3( -5, 0,  20),
    new THREE.Vector3( 25, 0,   0), new THREE.Vector3(-25, 0,   0)
  ];

  return { group, colliders, obstacles, waypoints, playerSpawn, botSpawns, arena: { W, H, D } };
}
