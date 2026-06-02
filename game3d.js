// game3d.js - initial Three.js prototype for third-person shooter
// This is a compact, readable prototype. I'll expand/optimize after committing.

(() => {
  const container = document.getElementById('gameContainer');

  // Renderer and scene
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.0007);

  // Camera - third person
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
  camera.position.set(0, 6, -10);

  // Lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemi.position.set(0, 50, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(-20, 40, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.left = -50;
  dir.shadow.camera.right = 50;
  dir.shadow.camera.top = 50;
  dir.shadow.camera.bottom = -50;
  scene.add(dir);

  // Ground
  const groundGeo = new THREE.PlaneBufferGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a8a3a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Player
  const player = {
    mesh: null,
    speed: 6,
    jumpPower: 10,
    velocityY: 0,
    onGround: true,
    health: 100,
    maxHealth: 100,
    ammo: 30,
    maxAmmo: 30,
    angle: 0
  };

  const playerGeo = new THREE.CapsuleGeometry(0.6, 1.2, 4, 8);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });
  player.mesh = new THREE.Mesh(playerGeo, playerMat);
  player.mesh.castShadow = true;
  player.mesh.position.set(0, 2, 0);
  scene.add(player.mesh);

  // Enemies, bullets, loot
  const enemies = [];
  const bullets = [];
  const loot = [];

  // Utility: create enemy
  function spawnEnemy(x = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 200) {
    const geo = new THREE.BoxBufferGeometry(1.2, 1.8, 1.0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xFF6B6B });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.position.set(x, 1, z);
    scene.add(m);
    enemies.push({ mesh: m, speed: 2 + Math.random() * 1.2, health: 50, shootCooldown: 0 });
  }

  for (let i = 0; i < 10; i++) spawnEnemy();

  // Input
  const keys = {};
  let mouse = { x: 0, y: 0, down: false };
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') togglePause();
    if (e.key === 'e') player.ammo = player.maxAmmo;
  });
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  renderer.domElement.addEventListener('mousemove', (ev) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  });
  renderer.domElement.addEventListener('mousedown', () => mouse.down = true);
  renderer.domElement.addEventListener('mouseup', () => mouse.down = false);

  // Raycaster for aiming
  const ray = new THREE.Raycaster();

  // HUD
  const ui = {
    health: document.getElementById('health'),
    ammo: document.getElementById('ammo'),
    players: document.getElementById('players'),
    timer: document.getElementById('timer'),
    gameOver: document.getElementById('gameOver'),
    result: document.getElementById('result'),
    stats: document.getElementById('stats'),
    restartBtn: document.getElementById('restartBtn')
  };
  ui.restartBtn.addEventListener('click', () => window.location.reload());

  let paused = false;
  let startTime = Date.now();
  let kills = 0;
  const MATCH_TIME = 300;

  function togglePause() { paused = !paused; }

  // Shooting (spawn small sphere moving forward from player)
  function shoot() {
    if (player.ammo <= 0) return;
    const bgeo = new THREE.SphereBufferGeometry(0.12, 8, 8);
    const bmat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff66 });
    const bm = new THREE.Mesh(bgeo, bmat);
    bm.castShadow = true;
    // direction from player toward mouse hit on ground
    ray.setFromCamera(mouse, camera);
    const target = ray.ray.at(50, new THREE.Vector3());
    const dir = new THREE.Vector3().subVectors(target, player.mesh.position).normalize();
    bm.position.copy(player.mesh.position).add(new THREE.Vector3(0, 0.8, 0)).add(dir.clone().multiplyScalar(1.2));
    scene.add(bm);
    bullets.push({ mesh: bm, dir: dir.clone(), speed: 30, owner: 'player', life: 3, damage: 25 });
    player.ammo--;
  }

  // Simple enemy AI: chase player and occasionally shoot
  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const toPlayer = new THREE.Vector3().subVectors(player.mesh.position, e.mesh.position);
      const dist = toPlayer.length();
      toPlayer.normalize();
      if (dist > 2.0) {
        e.mesh.position.add(toPlayer.clone().multiplyScalar(e.speed * dt));
      }
      e.mesh.lookAt(player.mesh.position.x, e.mesh.position.y, player.mesh.position.z);

      // shoot at player occasionally (spawn enemy bullets)
      e.shootCooldown -= dt;
      if (dist < 40 && e.shootCooldown <= 0) {
        e.shootCooldown = 1.5 + Math.random() * 2.0;
        const bgeo = new THREE.SphereBufferGeometry(0.12, 8, 8);
        const bmat = new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0xffaa66 });
        const bm = new THREE.Mesh(bgeo, bmat);
        bm.position.copy(e.mesh.position).add(new THREE.Vector3(0, 0.8, 0));
        scene.add(bm);
        const dir = new THREE.Vector3().subVectors(player.mesh.position, e.mesh.position).normalize();
        bullets.push({ mesh: bm, dir, speed: 18, owner: 'enemy', life: 4, damage: 10 });
      }

      // enemy death
      if (e.health <= 0) {
        // spawn loot
        const pick = { mesh: null, type: Math.random() > 0.5 ? 'ammo' : 'health', pos: e.mesh.position.clone() };
        const geo = new THREE.BoxBufferGeometry(0.6, 0.6, 0.6);
        const mat = new THREE.MeshStandardMaterial({ color: pick.type === 'ammo' ? 0xFFD700 : 0xFF69B4 });
        pick.mesh = new THREE.Mesh(geo, mat);
        pick.mesh.position.copy(e.mesh.position).add(new THREE.Vector3(0, 0.5, 0));
        scene.add(pick.mesh);
        loot.push(pick);

        scene.remove(e.mesh);
        enemies.splice(i, 1);
        kills++;
      }
    }
  }

  // Update bullets and collisions
  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.mesh.position.add(b.dir.clone().multiplyScalar(b.speed * dt));
      b.life -= dt;
      if (b.life <= 0) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }

      // player hit by enemy bullet
      if (b.owner === 'enemy') {
        if (b.mesh.position.distanceTo(player.mesh.position) < 0.9) {
          player.health -= b.damage;
          scene.remove(b.mesh);
          bullets.splice(i, 1);
          continue;
        }
      } else {
        // player bullet hits enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
          if (b.mesh.position.distanceTo(enemies[j].mesh.position) < 1.2) {
            enemies[j].health -= b.damage;
            scene.remove(b.mesh);
            bullets.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  // Player movement and physics
  function updatePlayer(dt) {
    // movement vector in local space
    const forward = new THREE.Vector3(0, 0, 1);
    const right = new THREE.Vector3(1, 0, 0);
    let move = new THREE.Vector3();

    if (keys['w']) move.add(forward);
    if (keys['s']) move.add(forward.clone().negate());
    if (keys['a']) move.add(right.clone().negate());
    if (keys['d']) move.add(right);

    if (move.length() > 0) {
      move.normalize();
      // rotate movement by camera yaw so movement is camera-relative
      const yaw = Math.atan2(camera.position.x - player.mesh.position.x, camera.position.z - player.mesh.position.z);
      move.applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
      player.mesh.position.add(move.multiplyScalar(player.speed * dt));
    }

    // simple gravity/jump
    player.velocityY -= 28 * dt; // gravity
    player.mesh.position.y += player.velocityY * dt;
    if (player.mesh.position.y <= 1.0) {
      player.mesh.position.y = 1.0;
      player.velocityY = 0;
      player.onGround = true;
    } else player.onGround = false;

    if (keys[' '] && player.onGround) {
      player.velocityY = player.jumpPower;
      player.onGround = false;
    }

    // aim player toward mouse (project mouse ray onto ground)
    ray.setFromCamera(mouse, camera);
    const groundIntersect = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), 0), new THREE.Vector3());
    if (groundIntersect) {
      const look = new THREE.Vector3().subVectors(groundIntersect, player.mesh.position);
      player.mesh.lookAt(player.mesh.position.x + look.x, player.mesh.position.y, player.mesh.position.z + look.z);
    }

    // shooting (simple rate limit)
    if (mouse.down && player.ammo > 0) {
      // basic fire rate using timestamp stored on player
      if (!player._lastShot || Date.now() - player._lastShot > 140) {
        shoot();
        player._lastShot = Date.now();
      }
    }
  }

  // Loot collection
  function updateLoot() {
    for (let i = loot.length - 1; i >= 0; i--) {
      if (loot[i].mesh.position.distanceTo(player.mesh.position) < 1.2) {
        if (loot[i].type === 'ammo') player.ammo = Math.min(player.maxAmmo, player.ammo + 15);
        else player.health = Math.min(player.maxHealth, player.health + 25);
        scene.remove(loot[i].mesh);
        loot.splice(i, 1);
      }
    }
  }

  // Camera follow
  function updateCamera(dt) {
    // desired camera position behind player
    const desired = player.mesh.position.clone().add(new THREE.Vector3(0, 4.0, -10));
    // smooth lerp
    camera.position.lerp(desired, 0.06);
    camera.lookAt(player.mesh.position.x, player.mesh.position.y + 1.5, player.mesh.position.z);
  }

  // Update UI and check win/lose
  function updateUIAndGameState() {
    ui.health.textContent = `❤️ Health: ${Math.max(0, Math.floor(player.health))}`;
    ui.ammo.textContent = `🔫 Ammo: ${player.ammo}`;
    ui.players.textContent = `👥 Players: ${enemies.length + 1}`;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const timeLeft = Math.max(0, MATCH_TIME - elapsed);
    ui.timer.textContent = `⏱️ Time: ${timeLeft}s`;

    if (player.health <= 0 || timeLeft <= 0) {
      // end condition
      showGameOver(player.health > 0 && enemies.length === 0);
    }
  }

  function showGameOver(won) {
    paused = true;
    ui.gameOver.style.display = 'block';
    ui.result.textContent = won ? '🎉 VICTORY ROYALE!' : '💀 ELIMINATED!';
    ui.stats.textContent = `Kills: ${kills} | Time Survived: ${Math.floor((Date.now() - startTime) / 1000)}s`;
  }

  // Resize handling
  function onResize() {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // Main loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      updatePlayer(dt);
      updateEnemies(dt);
      updateBullets(dt);
      updateLoot();
      updateCamera(dt);
      updateUIAndGameState();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
