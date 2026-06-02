const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// Game States
const gameState = {
    running: true,
    paused: false,
    gameOver: false,
    won: false,
    kills: 0,
    startTime: Date.now(),
};

// Player Object
const player = {
    x: 100,
    y: 300,
    width: 20,
    height: 30,
    velocityY: 0,
    velocityX: 0,
    speed: 4,
    jumpPower: 12,
    isJumping: false,
    health: 100,
    maxHealth: 100,
    ammo: 30,
    maxAmmo: 30,
    angle: 0,
};

// Input handling
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2, isDown: false };

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') {
        gameState.paused = !gameState.paused;
    }
    if (e.key === 'e' || e.key === 'E') {
        player.ammo = player.maxAmmo;
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    player.angle = Math.atan2(mouse.y - (player.y + player.height / 2), mouse.x - (player.x + player.width / 2));
});

canvas.addEventListener('mousedown', () => {
    mouse.isDown = true;
});

canvas.addEventListener('mouseup', () => {
    mouse.isDown = false;
});

// Enemy class
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 30;
        this.velocityY = 0;
        this.health = 50;
        this.maxHealth = 50;
        this.speed = 2;
        this.ammo = 20;
        this.shootTimer = 0;
        this.angle = 0;
    }

    update() {
        // Simple gravity
        this.velocityY += 0.5;
        if (this.velocityY > 15) this.velocityY = 15;
        this.y += this.velocityY;

        // Ground collision
        if (this.y + this.height > canvas.height - 40) {
            this.y = canvas.height - 40 - this.height;
            this.velocityY = 0;
        }

        // AI behavior - chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 300) {
            // Move towards player
            if (dx > 0) this.x += this.speed;
            else this.x -= this.speed;

            // Try to jump over obstacles
            if (Math.random() < 0.02 && this.y + this.height >= canvas.height - 40) {
                this.velocityY = -10;
            }

            // Shoot at player
            this.shootTimer++;
            if (this.shootTimer > 30 && this.ammo > 0) {
                this.shoot();
                this.shootTimer = 0;
            }
        }

        // Update angle towards player
        this.angle = Math.atan2(player.y - (this.y + this.height / 2), player.x - (this.x + this.width / 2));
    }

    shoot() {
        if (this.ammo > 0) {
            const bulletSpeed = 5;
            bullets.push({
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                velocityX: Math.cos(this.angle) * bulletSpeed,
                velocityY: Math.sin(this.angle) * bulletSpeed,
                owner: 'enemy',
                damage: 10,
            });
            this.ammo--;
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw gun
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.lineTo(
            this.x + this.width / 2 + Math.cos(this.angle) * 15,
            this.y + this.height / 2 + Math.sin(this.angle) * 15
        );
        ctx.stroke();

        // Health bar
        const barWidth = this.width;
        const barHeight = 3;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y - 10, barWidth, barHeight);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(this.x, this.y - 10, (this.health / this.maxHealth) * barWidth, barHeight);

        ctx.restore();
    }
}

// Bullet class
class Bullet {
    constructor(x, y, vx, vy, owner, damage) {
        this.x = x;
        this.y = y;
        this.velocityX = vx;
        this.velocityY = vy;
        this.owner = owner;
        this.damage = damage;
        this.radius = 3;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
    }

    draw() {
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Loot class
class Loot {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'ammo' or 'health'
        this.size = 15;
        this.collected = false;
    }

    draw() {
        ctx.fillStyle = this.type === 'ammo' ? '#FFD700' : '#FF69B4';
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }
}

const enemies = [];
const bullets = [];
const loot = [];
const particles = [];

// Spawn initial enemies
for (let i = 0; i < 10; i++) {
    enemies.push(new Enemy(Math.random() * (canvas.width - 40) + 20, 100));
}

// Spawn some loot
for (let i = 0; i < 5; i++) {
    loot.push(new Loot(Math.random() * (canvas.width - 60) + 30, Math.random() * 200 + 50, Math.random() > 0.5 ? 'ammo' : 'health'));
}

function updatePlayer() {
    // Movement
    if (keys['w'] || keys['arrowup']) player.velocityX = 0;
    if (keys['d'] || keys['arrowright']) player.x += player.speed;
    if (keys['a'] || keys['arrowleft']) player.x -= player.speed;
    if (keys[' ']) {
        if (player.y + player.height >= canvas.height - 40) {
            player.velocityY = -player.jumpPower;
            player.isJumping = true;
        }
    }

    // Gravity
    player.velocityY += 0.5;
    if (player.velocityY > 15) player.velocityY = 15;
    player.y += player.velocityY;

    // Ground collision
    if (player.y + player.height > canvas.height - 40) {
        player.y = canvas.height - 40 - player.height;
        player.velocityY = 0;
        player.isJumping = false;
    }

    // Boundary collision
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Shooting
    if (mouse.isDown && player.ammo > 0) {
        const bulletSpeed = 6;
        bullets.push(new Bullet(
            player.x + player.width / 2,
            player.y + player.height / 2,
            Math.cos(player.angle) * bulletSpeed,
            Math.sin(player.angle) * bulletSpeed,
            'player',
            15
        ));
        player.ammo--;
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update();

        // Boundary collision
        if (enemies[i].x < 0) enemies[i].x = 0;
        if (enemies[i].x + enemies[i].width > canvas.width) enemies[i].x = canvas.width - enemies[i].width;
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();

        // Remove bullets out of bounds
        if (bullets[i].x < 0 || bullets[i].x > canvas.width || bullets[i].y < 0 || bullets[i].y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }

        // Check collision with player
        if (bullets[i].owner === 'enemy' && isColliding(bullets[i], player)) {
            player.health -= bullets[i].damage;
            bullets.splice(i, 1);
            createParticles(player.x, player.y, '#FF0000');
            continue;
        }

        // Check collision with enemies
        if (bullets[i].owner === 'player') {
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (isColliding(bullets[i], enemies[j])) {
                    enemies[j].health -= bullets[i].damage;
                    bullets.splice(i, 1);
                    createParticles(enemies[j].x, enemies[j].y, '#FF6B6B');

                    if (enemies[j].health <= 0) {
                        loot.push(new Loot(enemies[j].x, enemies[j].y, Math.random() > 0.5 ? 'ammo' : 'health'));
                        enemies.splice(j, 1);
                        gameState.kills++;
                    }
                    break;
                }
            }
        }
    }
}

function updateLoot() {
    for (let i = loot.length - 1; i >= 0; i--) {
        if (isColliding(loot[i], player)) {
            if (loot[i].type === 'ammo') {
                player.ammo = Math.min(player.ammo + 15, player.maxAmmo);
            } else {
                player.health = Math.min(player.health + 25, player.maxHealth);
            }
            loot.splice(i, 1);
        }
    }
}

function isColliding(obj1, obj2) {
    const r1 = obj1.radius || obj1.width / 2;
    const r2 = obj2.width / 2;
    const dx = (obj1.x || obj1.x) - obj2.x;
    const dy = (obj1.y || obj1.y) - obj2.y;
    return Math.sqrt(dx * dx + dy * dy) < r1 + r2;
}

function createParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            life: 30,
            color: color,
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].vy += 0.2;
        particles[i].life--;

        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawPlayer() {
    ctx.save();
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw gun
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
    ctx.lineTo(
        player.x + player.width / 2 + Math.cos(player.angle) * 15,
        player.y + player.height / 2 + Math.sin(player.angle) * 15
    );
    ctx.stroke();

    // Health bar
    const barWidth = player.width * 2;
    const barHeight = 5;
    ctx.fillStyle = '#333';
    ctx.fillRect(player.x - barWidth / 4, player.y - 15, barWidth, barHeight);
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(player.x - barWidth / 4, player.y - 15, (player.health / player.maxHealth) * barWidth, barHeight);

    ctx.restore();
}

function drawEnemies() {
    for (let enemy of enemies) {
        enemy.draw();
    }
}

function drawBullets() {
    for (let bullet of bullets) {
        bullet.draw();
    }
}

function drawLoot() {
    for (let item of loot) {
        item.draw();
    }
}

function drawParticles() {
    for (let particle of particles) {
        ctx.save();
        ctx.globalAlpha = particle.life / 30;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, 3, 3);
        ctx.restore();
    }
}

function drawGround() {
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.strokeRect(i, canvas.height - 40, 40, 40);
    }
}

function updateUI() {
    document.getElementById('health').textContent = `❤️ Health: ${Math.max(0, Math.floor(player.health))}`;
    document.getElementById('ammo').textContent = `🔫 Ammo: ${player.ammo}`;
    document.getElementById('players').textContent = `👥 Players: ${enemies.length + 1}`;

    const elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    const stormTime = Math.max(0, 300 - elapsedTime);
    document.getElementById('stormTime').textContent = `⏱️ Time: ${stormTime}s`;

    if (stormTime <= 0) {
        if (enemies.length === 0) {
            gameState.won = true;
            gameState.gameOver = true;
        } else {
            gameState.gameOver = true;
        }
    }
}

function drawGameOver() {
    const gameOverDiv = document.getElementById('gameOver');
    const resultDiv = document.getElementById('result');
    const statsDiv = document.getElementById('stats');

    if (gameState.won) {
        resultDiv.textContent = '🎉 VICTORY ROYALE!';
        resultDiv.style.color = '#FFD700';
    } else {
        resultDiv.textContent = '💀 ELIMINATED!';
        resultDiv.style.color = '#FF6B6B';
    }

    statsDiv.textContent = `Kills: ${gameState.kills} | Survived: ${Math.floor((Date.now() - gameState.startTime) / 1000)}s`;
    gameOverDiv.style.display = 'block';
}

function gameLoop() {
    // Clear canvas
    ctx.fillStyle = 'rgba(135, 206, 235, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background
    drawGround();

    if (!gameState.paused && !gameState.gameOver) {
        updatePlayer();
        updateEnemies();
        updateBullets();
        updateLoot();
        updateParticles();
        updateUI();

        if (player.health <= 0) {
            gameState.gameOver = true;
        }
    }

    // Draw everything
    drawLoot();
    drawEnemies();
    drawBullets();
    drawParticles();
    drawPlayer();

    if (gameState.gameOver) {
        drawGameOver();
    }

    if (gameState.paused && !gameState.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();