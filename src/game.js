(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (!ctx.roundRect) {
    ctx.roundRect = function (x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
    };
  }
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlayText");
  const startButton = document.getElementById("startButton");
  const statusText = document.getElementById("statusText");
  const audio = new window.HDLAudio.GameAudio();

  const W = canvas.width;
  const H = canvas.height;
  const worldWidth = 4300;
  const gravity = 1900;
  const keys = new Set();
  const pressed = new Set();

  const platforms = [
    { x: 0, y: 480, w: 760, h: 70 },
    { x: 900, y: 480, w: 680, h: 70 },
    { x: 1720, y: 480, w: 690, h: 70 },
    { x: 2550, y: 480, w: 1780, h: 70 },
    { x: 260, y: 372, w: 190, h: 26 },
    { x: 710, y: 310, w: 150, h: 24 },
    { x: 1180, y: 390, w: 230, h: 24 },
    { x: 1560, y: 325, w: 190, h: 24 },
    { x: 2040, y: 382, w: 230, h: 24 },
    { x: 2470, y: 330, w: 180, h: 24 },
    { x: 2960, y: 386, w: 240, h: 24 },
    { x: 3380, y: 335, w: 250, h: 24 },
  ];

  const itemPlan = [
    { type: "medkit", x: 725, y: 260 },
    { type: "rapid", x: 1595, y: 275 },
    { type: "spread", x: 2500, y: 285 },
    { type: "medkit", x: 3100, y: 336 },
  ];

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawRoundRect(x, y, w, h, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  }

  function drawEllipse(x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function strokeLine(points, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }

  function drawSprite(image, sx, sy, sw, sh, dx, dy, dw, dh, flip) {
    if (!image) return false;
    ctx.save();
    if (flip) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    } else {
      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.restore();
    return true;
  }

  function center(entity) {
    return { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
  }

  function makePlayer() {
    return {
      x: 72,
      y: 120,
      w: 32,
      h: 48,
      vx: 0,
      vy: 0,
      dir: 1,
      hp: 5,
      maxHp: 5,
      grounded: false,
      invuln: 0,
      fireCd: 0,
      power: "normal",
      powerTime: 0,
      score: 0,
      checkpoint: 70,
    };
  }

  function makeEnemies() {
    return [
      soldier(505, 432, 410, 700),
      turret(1045, 432),
      soldier(1330, 432, 1120, 1510),
      rocket(1880, 432, 1760, 2250),
      soldier(2210, 432, 1780, 2300),
      turret(2570, 284),
      rocket(3045, 432, 2820, 3260),
      soldier(3290, 432, 3060, 3520),
    ];
  }

  function soldier(x, y, left, right) {
    return {
      kind: "soldier",
      x,
      y,
      w: 34,
      h: 48,
      vx: 72,
      vy: 0,
      hp: 3,
      maxHp: 3,
      left,
      right,
      shootCd: 1.2,
      hurt: 0,
      grounded: false,
    };
  }

  function turret(x, y) {
    return {
      kind: "turret",
      x,
      y,
      w: 40,
      h: 48,
      vx: 0,
      vy: 0,
      hp: 5,
      maxHp: 5,
      shootCd: 0.55,
      hurt: 0,
      grounded: true,
    };
  }

  function rocket(x, y, left, right) {
    return {
      kind: "rocket",
      x,
      y,
      w: 38,
      h: 48,
      vx: -48,
      vy: 0,
      hp: 4,
      maxHp: 4,
      left,
      right,
      shootCd: 1.8,
      hurt: 0,
      grounded: false,
    };
  }

  function makeBoss() {
    return {
      kind: "boss",
      x: 3810,
      y: 368,
      w: 126,
      h: 112,
      hp: 170,
      maxHp: 170,
      active: false,
      phase: 1,
      shootCd: 0.8,
      rocketCd: 2.2,
      summonCd: 5.5,
      hurt: 0,
      bob: 0,
    };
  }

  class Game {
    constructor() {
      this.assets = null;
      this.state = "menu";
      this.player = makePlayer();
      this.enemies = makeEnemies();
      this.boss = makeBoss();
      this.bullets = [];
      this.enemyBullets = [];
      this.items = itemPlan.map((item) => ({ ...item, w: 26, h: 26, vy: 0, taken: false }));
      this.particles = [];
      this.cameraX = 0;
      this.last = 0;
      this.time = 0;
      this.shake = 0;
      this.bossMusicPlayed = false;
      this.messageTimer = 0;
      window.HDLAssets.loadAssets().then((assets) => {
        this.assets = assets;
        const usingFallback = Object.values(assets.images).some((entry) => entry.fallback);
        statusText.textContent = usingFallback ? "Fallback art" : "External art loaded";
      });
      requestAnimationFrame((time) => this.loop(time));
    }

    reset() {
      this.player = makePlayer();
      this.enemies = makeEnemies();
      this.boss = makeBoss();
      this.bullets = [];
      this.enemyBullets = [];
      this.items = itemPlan.map((item) => ({ ...item, w: 26, h: 26, vy: 0, taken: false }));
      this.particles = [];
      this.cameraX = 0;
      this.time = 0;
      this.shake = 0;
      this.state = "playing";
      this.bossMusicPlayed = false;
      this.messageTimer = 2.2;
      overlay.classList.remove("is-visible");
      statusText.textContent = "Playing";
    }

    loop(time) {
      const dt = Math.min(0.033, (time - this.last) / 1000 || 0);
      this.last = time;
      this.update(dt);
      this.draw();
      pressed.clear();
      requestAnimationFrame((next) => this.loop(next));
    }

    update(dt) {
      if (pressed.has("KeyM")) {
        const muted = audio.toggleMute();
        statusText.textContent = muted ? "Muted" : "Sound on";
      }
      if (pressed.has("KeyP") && (this.state === "playing" || this.state === "paused")) {
        this.state = this.state === "playing" ? "paused" : "playing";
        statusText.textContent = this.state === "paused" ? "Paused" : "Playing";
      }
      if (this.state !== "playing") return;

      this.messageTimer = Math.max(0, this.messageTimer - dt);
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt);
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateBoss(dt);
      this.updateBullets(dt);
      this.updateItems(dt);
      this.updateParticles(dt);
      this.cameraX = clamp(this.player.x - 310, 0, worldWidth - W);
    }

    updatePlayer(dt) {
      const p = this.player;
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const down = keys.has("ArrowDown") || keys.has("KeyS");
      const jump = pressed.has("Space") || pressed.has("ArrowUp") || pressed.has("KeyW");
      const shoot = keys.has("KeyJ") || keys.has("KeyK");

      if (left && !right) {
        p.vx = -245;
        p.dir = -1;
      } else if (right && !left) {
        p.vx = 245;
        p.dir = 1;
      } else {
        p.vx *= Math.pow(0.0008, dt);
        if (Math.abs(p.vx) < 4) p.vx = 0;
      }

      const previousBottom = p.y + p.h;
      p.h = down && p.grounded ? 34 : 48;
      p.y = previousBottom - p.h;

      if (jump && p.grounded) {
        p.vy = -680;
        p.grounded = false;
        audio.play("jump");
      }

      p.vy += gravity * dt;
      this.moveWithPlatforms(p, p.vx * dt, p.vy * dt);
      p.x = clamp(p.x, 0, worldWidth - p.w);
      p.invuln = Math.max(0, p.invuln - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.powerTime = Math.max(0, p.powerTime - dt);
      if (p.powerTime <= 0) p.power = "normal";

      if (shoot && p.fireCd <= 0) {
        this.firePlayerBullet();
        p.fireCd = p.power === "rapid" ? 0.11 : 0.18;
      }

      if (p.y > H + 120) {
        this.damagePlayer(2);
        p.x = Math.max(60, p.checkpoint);
        p.y = 80;
        p.vx = 0;
        p.vy = 0;
      }
      if (p.x > p.checkpoint + 580) p.checkpoint = p.x - 180;
    }

    moveWithPlatforms(entity, dx, dy) {
      entity.grounded = false;
      entity.x += dx;
      for (const platform of platforms) {
        if (rectsOverlap(entity, platform)) {
          if (dx > 0) entity.x = platform.x - entity.w;
          if (dx < 0) entity.x = platform.x + platform.w;
          entity.vx *= -0.2;
        }
      }

      entity.y += dy;
      for (const platform of platforms) {
        if (rectsOverlap(entity, platform)) {
          if (dy > 0) {
            entity.y = platform.y - entity.h;
            entity.vy = 0;
            entity.grounded = true;
          } else if (dy < 0) {
            entity.y = platform.y + platform.h;
            entity.vy = 0;
          }
        }
      }
    }

    firePlayerBullet() {
      const p = this.player;
      const muzzleX = p.dir > 0 ? p.x + p.w + 2 : p.x - 12;
      const muzzleY = p.y + (p.h < 40 ? 18 : 22);
      const base = {
        owner: "player",
        x: muzzleX,
        y: muzzleY,
        w: 15,
        h: 6,
        vx: 740 * p.dir,
        vy: 0,
        damage: 1,
        life: 1.2,
        kind: "slug",
      };
      if (p.power === "spread") {
        this.bullets.push({ ...base, vy: -160, life: 0.9 });
        this.bullets.push({ ...base, vy: 0 });
        this.bullets.push({ ...base, vy: 160, life: 0.9 });
      } else {
        this.bullets.push(base);
      }
      this.spawnSpark(muzzleX, muzzleY, "#ffe084", 3);
      audio.play("shoot");
    }

    fireEnemyBullet(source, speed, kind) {
      const from = center(source);
      const to = center(this.player);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      this.enemyBullets.push({
        x: from.x,
        y: from.y,
        w: kind === "rocket" ? 18 : 12,
        h: kind === "rocket" ? 10 : 7,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed + (kind === "rocket" ? -35 : 0),
        damage: kind === "rocket" ? 2 : 1,
        life: kind === "rocket" ? 2.3 : 1.7,
        kind,
      });
      audio.play(kind === "rocket" ? "boss" : "shoot");
    }

    updateEnemies(dt) {
      const p = this.player;
      for (const enemy of this.enemies) {
        enemy.hurt = Math.max(0, enemy.hurt - dt);
        if (enemy.kind !== "turret") {
          enemy.vy += gravity * dt;
          this.moveWithPlatforms(enemy, enemy.vx * dt, enemy.vy * dt);
          if (enemy.x < enemy.left || enemy.x + enemy.w > enemy.right) {
            enemy.vx *= -1;
            enemy.x = clamp(enemy.x, enemy.left, enemy.right - enemy.w);
          }
        }

        const dist = Math.abs(p.x - enemy.x);
        enemy.shootCd -= dt;
        if (dist < 580 && enemy.shootCd <= 0) {
          this.fireEnemyBullet(enemy, enemy.kind === "rocket" ? 260 : 360, enemy.kind === "rocket" ? "rocket" : "round");
          enemy.shootCd = enemy.kind === "turret" ? 1.25 : enemy.kind === "rocket" ? 2.1 : 1.55;
        }

        if (rectsOverlap(enemy, p)) this.damagePlayer(1);
      }
      this.enemies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.y < H + 180);
    }

    updateBoss(dt) {
      const boss = this.boss;
      if (boss.hp <= 0) return;
      if (!boss.active && this.player.x > 3360) {
        boss.active = true;
        this.messageTimer = 2.5;
        this.shake = 0.18;
        if (!this.bossMusicPlayed) {
          this.bossMusicPlayed = true;
          audio.play("boss");
        }
      }
      if (!boss.active) return;

      boss.phase = boss.hp < boss.maxHp * 0.45 ? 3 : boss.hp < boss.maxHp * 0.72 ? 2 : 1;
      boss.hurt = Math.max(0, boss.hurt - dt);
      boss.bob += dt * (boss.phase + 1);
      boss.y = 368 + Math.sin(boss.bob) * 8;
      boss.x += Math.sin(boss.bob * 0.7) * dt * 26;

      boss.shootCd -= dt;
      boss.rocketCd -= dt;
      boss.summonCd -= dt;
      if (boss.shootCd <= 0) {
        const shots = boss.phase === 1 ? 1 : boss.phase === 2 ? 3 : 5;
        for (let i = 0; i < shots; i += 1) {
          const spread = (i - (shots - 1) / 2) * 85;
          this.enemyBullets.push({
            x: boss.x + 18,
            y: boss.y + 48,
            w: 14,
            h: 8,
            vx: -380,
            vy: spread,
            damage: 1,
            life: 2.2,
            kind: "round",
          });
        }
        audio.play("shoot");
        boss.shootCd = boss.phase === 3 ? 0.62 : 0.88;
      }
      if (boss.rocketCd <= 0) {
        this.fireEnemyBullet({ ...boss, x: boss.x + 30, y: boss.y + 50, w: 20, h: 20 }, 310, "rocket");
        boss.rocketCd = boss.phase === 3 ? 1.4 : 2.2;
      }
      if (boss.summonCd <= 0) {
        this.enemies.push(soldier(boss.x - 160, 432, boss.x - 320, boss.x - 40));
        boss.summonCd = boss.phase === 3 ? 4.2 : 6.0;
      }
      if (rectsOverlap(boss, this.player)) this.damagePlayer(2);
    }

    updateBullets(dt) {
      for (const bullet of this.bullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        for (const enemy of this.enemies) {
          if (enemy.hp > 0 && rectsOverlap(bullet, enemy)) {
            enemy.hp -= bullet.damage;
            enemy.hurt = 0.08;
            bullet.life = 0;
            this.player.score += 25;
            this.spawnSpark(bullet.x, bullet.y, "#ffef9a", 7);
            audio.play("hit");
            if (enemy.hp <= 0) this.killEnemy(enemy);
            break;
          }
        }
        if (this.boss.active && this.boss.hp > 0 && rectsOverlap(bullet, this.boss)) {
          this.boss.hp -= bullet.damage;
          this.boss.hurt = 0.06;
          bullet.life = 0;
          this.player.score += 10;
          this.spawnSpark(bullet.x, bullet.y, "#fff2a3", 8);
          audio.play("hit");
          if (this.boss.hp <= 0) this.win();
        }
      }

      for (const bullet of this.enemyBullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        if (bullet.kind === "rocket") bullet.vy += 260 * dt;
        bullet.life -= dt;
        if (rectsOverlap(bullet, this.player)) {
          this.damagePlayer(bullet.damage);
          bullet.life = 0;
          this.spawnSpark(bullet.x, bullet.y, "#ff7667", 10);
        }
        for (const platform of platforms) {
          if (rectsOverlap(bullet, platform)) {
            bullet.life = 0;
            if (bullet.kind === "rocket") {
              this.shake = 0.12;
              this.spawnSpark(bullet.x, bullet.y, "#ffb347", 18);
              audio.play("explosion");
            }
            break;
          }
        }
      }
      this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -100 && b.x < worldWidth + 100);
      this.enemyBullets = this.enemyBullets.filter((b) => b.life > 0 && b.x > -120 && b.x < worldWidth + 120 && b.y < H + 140);
    }

    updateItems(dt) {
      for (const item of this.items) {
        if (item.taken) continue;
        item.vy += gravity * dt;
        this.moveWithPlatforms(item, 0, item.vy * dt);
        if (rectsOverlap(item, this.player)) {
          item.taken = true;
          this.applyItem(item.type);
          this.spawnSpark(item.x, item.y, "#77ffb0", 12);
          audio.play("pickup");
        }
      }
    }

    applyItem(type) {
      const p = this.player;
      if (type === "medkit") p.hp = Math.min(p.maxHp, p.hp + 2);
      if (type === "rapid") {
        p.power = "rapid";
        p.powerTime = 12;
      }
      if (type === "spread") {
        p.power = "spread";
        p.powerTime = 14;
      }
      p.score += 100;
    }

    killEnemy(enemy) {
      this.player.score += 125;
      this.spawnSpark(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffbd58", 18);
      audio.play("explosion");
      if (Math.random() < 0.36) {
        const types = ["medkit", "rapid", "spread"];
        this.items.push({
          type: types[Math.floor(Math.random() * types.length)],
          x: enemy.x,
          y: enemy.y,
          w: 26,
          h: 26,
          vy: -260,
          taken: false,
        });
      }
    }

    damagePlayer(amount) {
      const p = this.player;
      if (p.invuln > 0 || this.state !== "playing") return;
      p.hp -= amount;
      p.invuln = 1.1;
      this.shake = 0.15;
      audio.play("hurt");
      if (p.hp <= 0) this.lose();
    }

    win() {
      this.state = "win";
      this.player.score += 2000;
      this.shake = 0.55;
      this.spawnSpark(this.boss.x + 60, this.boss.y + 48, "#ffe36e", 50);
      audio.play("victory");
      overlayText.textContent = `任务完成，得分 ${this.player.score}`;
      startButton.textContent = "再来一局";
      overlay.classList.add("is-visible");
      statusText.textContent = "Victory";
    }

    lose() {
      this.state = "lost";
      audio.play("defeat");
      overlayText.textContent = `前线失守，得分 ${this.player.score}`;
      startButton.textContent = "重新开始";
      overlay.classList.add("is-visible");
      statusText.textContent = "Defeat";
    }

    spawnSpark(x, y, color, count) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 240;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.25 + Math.random() * 0.35,
          color,
          size: 2 + Math.random() * 4,
        });
      }
    }

    updateParticles(dt) {
      for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 520 * dt;
        p.life -= dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
    }

    draw() {
      ctx.save();
      const sx = this.shake ? (Math.random() - 0.5) * this.shake * 28 : 0;
      const sy = this.shake ? (Math.random() - 0.5) * this.shake * 18 : 0;
      ctx.translate(sx, sy);
      this.drawBackground();
      ctx.translate(-Math.round(this.cameraX), 0);
      this.drawPlatforms();
      this.drawItems();
      this.drawBullets();
      this.drawEnemies();
      if (this.boss.hp > 0) this.drawBoss();
      this.drawPlayer();
      this.drawParticles();
      ctx.restore();
      this.drawHud();
      if (this.state === "paused") this.drawPause();
    }

    drawBackground() {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#222a54");
      sky.addColorStop(0.55, "#314061");
      sky.addColorStop(1, "#17231f");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const drawLayer = (image, speed, y, alpha) => {
        if (!image) return false;
        const scale = H / image.height;
        const iw = image.width * scale;
        const ih = image.height * scale;
        let x = -(this.cameraX * speed) % iw;
        if (x > 0) x -= iw;
        ctx.save();
        ctx.globalAlpha = alpha;
        for (; x < W + iw; x += iw) ctx.drawImage(image, x, y, iw, ih);
        ctx.restore();
        return true;
      };

      const forest = this.assets?.images || {};
      const drewRemoteForest =
        drawLayer(forest.forestBack?.image, 0.12, 42, 0.55) |
        drawLayer(forest.forestMiddle?.image, 0.28, 58, 0.65) |
        drawLayer(forest.forestFront?.image, 0.52, 68, 0.75);

      if (!drewRemoteForest) {
        this.drawRetroJungle();
      }

      ctx.fillStyle = "rgba(9, 23, 19, 0.55)";
      ctx.fillRect(0, 474, W, 66);
    }

    drawRetroJungle() {
      drawPixelRect(0, 0, W, 5, "#111632");
      for (let i = 0; i < 9; i += 1) {
        const x = (i * 150 - this.cameraX * 0.08) % (W + 180) - 90;
        drawPixelRect(x, 76 + (i % 3) * 16, 64, 8, "#62718c");
        drawPixelRect(x + 22, 64 + (i % 2) * 13, 110, 8, "#53657f");
      }

      for (let i = 0; i < 8; i += 1) {
        const x = i * 180 - (this.cameraX * 0.16) % 180 - 100;
        ctx.fillStyle = i % 2 ? "#2e4d55" : "#28484e";
        ctx.beginPath();
        ctx.moveTo(x - 130, 356);
        ctx.lineTo(x + 30, 142 + (i % 3) * 23);
        ctx.lineTo(x + 210, 356);
        ctx.closePath();
        ctx.fill();
        drawPixelRect(x - 30, 295, 92, 8, "rgba(18, 32, 38, 0.45)");
      }

      for (let i = 0; i < 15; i += 1) {
        const x = (i * 168 - this.cameraX * 0.34) % (W + 220) - 100;
        const y = 318 + (i % 4) * 15;
        drawPixelRect(x + 11, y + 26, 18, 150, "#3f2a1b");
        drawPixelRect(x + 16, y + 30, 5, 145, "#6a472c");
        for (let j = 0; j < 5; j += 1) {
          const ly = y - j * 28;
          drawPixelRect(x - 55 + j * 8, ly + 22, 118 - j * 10, 15, "#1f5d38");
          drawPixelRect(x - 38 + j * 7, ly + 8, 88 - j * 9, 17, "#2f7b43");
          drawPixelRect(x - 20 + j * 5, ly, 56 - j * 5, 14, "#4c9b53");
        }
      }

      for (let i = 0; i < 12; i += 1) {
        const x = (i * 224 - this.cameraX * 0.48) % (W + 230) - 120;
        drawPixelRect(x, 356, 78, 42, "#1a2b2e");
        drawPixelRect(x + 9, 344, 60, 12, "#687276");
        drawPixelRect(x + 16, 369, 11, 20, "#0e1719");
        drawPixelRect(x + 43, 368, 16, 7, "#d8c77d");
      }

      for (let i = 0; i < 28; i += 1) {
        const x = (i * 70 - this.cameraX * 0.64) % (W + 100) - 50;
        drawPixelRect(x, 438 + (i % 3) * 5, 46, 9, "#1d6332");
        drawPixelRect(x + 10, 426 + (i % 2) * 8, 28, 12, "#348343");
        drawPixelRect(x + 18, 416 + (i % 4) * 3, 13, 17, "#57a24e");
      }
    }

    drawPlatforms() {
      for (const p of platforms) {
        drawPixelRect(p.x, p.y, p.w, 10, "#68a94d");
        drawPixelRect(p.x, p.y + 10, p.w, 8, "#2f7d3d");
        drawPixelRect(p.x, p.y + 18, p.w, p.h - 18, "#6b4a2d");
        drawPixelRect(p.x, p.y + 30, p.w, p.h - 30, "#3a2b1c");
        for (let x = p.x; x < p.x + p.w; x += 32) {
          const n = Math.floor(x / 32) % 4;
          drawPixelRect(x + 2, p.y + 4 + n, 17, 6, "#9bd15d");
          drawPixelRect(x + 6, p.y + 22, 18, 8, "#8c6a40");
          drawPixelRect(x + 20, p.y + 42, 9, 5, "#211a13");
          if (n === 0) drawPixelRect(x + 12, p.y + 13, 5, 13, "#23582d");
        }
      }

      for (let x = 0; x < worldWidth; x += 420) {
        drawPixelRect(x + 105, 456, 58, 16, "#5a6051");
        drawPixelRect(x + 116, 444, 38, 12, "#889078");
        drawPixelRect(x + 176, 426, 11, 54, "#4c321f");
        drawPixelRect(x + 147, 416, 68, 16, "#2d783a");
        drawPixelRect(x + 157, 401, 49, 17, "#49a34d");
      }
    }

    drawPlayer() {
      const p = this.player;
      const flash = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
      if (flash) return;
      const x = p.x;
      const y = p.y;
      const facing = p.dir;
      const sheet = this.assets?.images?.spaceSoldier?.image;
      if (sheet) {
        const moving = Math.abs(p.vx) > 28 && p.grounded;
        const jump = !p.grounded;
        let frame = moving ? Math.floor(this.time * 12) % 4 : 0;
        let row = 0;
        if (jump) {
          frame = 1;
          row = 2;
        }
        if (p.h < 40) {
          frame = 3;
          row = 3;
        }
        if (drawSprite(sheet, frame * 32, row * 32, 32, 32, x - 16, y - 13, 64, 64, facing < 0)) {
          if (p.power !== "normal") drawPixelRect(x + 4, y - 8, 24, 5, p.power === "rapid" ? "#4ee0ff" : "#ffcc4d");
          return;
        }
      }
      const crouch = p.h < 40;
      ctx.save();
      ctx.translate(x + 16, y);
      ctx.scale(facing, 1);
      const bob = p.grounded ? Math.floor(this.time * 12) % 2 : 1;
      drawPixelRect(-10, 0, 20, 6, "#2f6b3b");
      drawPixelRect(-7, 4, 18, 11, "#d89a62");
      drawPixelRect(4, 8, 4, 4, "#101010");
      drawPixelRect(-12, 15, 24, crouch ? 14 : 22, "#2c72b8");
      drawPixelRect(-7, 18, 14, 7, "#96d6ff");
      drawPixelRect(-12, 27, 24, 5, "#1b3057");
      drawPixelRect(8, 19, 24, 6, "#252a32");
      drawPixelRect(29, 17, 16, 4, "#d8dee4");
      drawPixelRect(41, 19, 8, 3, "#ffcc4d");
      if (crouch) {
        drawPixelRect(-16, 31, 17, 6, "#24344a");
        drawPixelRect(1, 31, 18, 6, "#24344a");
      } else {
        drawPixelRect(-10, 32, 8, 14 + bob, "#24344a");
        drawPixelRect(4, 32, 8, 14 - bob, "#24344a");
        drawPixelRect(-15, 44 + bob, 15, 5, "#111820");
        drawPixelRect(2, 44 - bob, 16, 5, "#111820");
      }
      ctx.restore();
      if (p.power !== "normal") {
        drawRoundRect(x + 4, y - 8, 24, 5, 4, p.power === "rapid" ? "#4ee0ff" : "#ffcc4d");
      }
    }

    drawEnemies() {
      for (const e of this.enemies) {
        if (e.kind === "soldier") this.drawSoldier(e);
        if (e.kind === "turret") this.drawTurret(e);
        if (e.kind === "rocket") this.drawRocket(e);
      }
    }

    drawSoldier(e) {
      const hurt = e.hurt > 0;
      const x = e.x;
      const y = e.y;
      const dir = e.vx < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(x + 17, y);
      ctx.scale(dir, 1);
      drawPixelRect(-9, 0, 18, 6, "#46542f");
      drawPixelRect(-8, 5, 17, 10, hurt ? "#ffe4d2" : "#cc8e5c");
      drawPixelRect(3, 8, 4, 3, "#101010");
      drawPixelRect(-13, 15, 26, 20, hurt ? "#ff5b61" : "#7b4a28");
      drawPixelRect(-9, 20, 17, 6, "#c99045");
      drawPixelRect(9, 21, 24, 5, "#29251f");
      drawPixelRect(29, 19, 9, 3, "#b7b2a1");
      drawPixelRect(-10, 35, 8, 13, "#33271d");
      drawPixelRect(4, 35, 8, 13, "#33271d");
      drawPixelRect(-14, 45, 13, 4, "#111111");
      drawPixelRect(2, 45, 14, 4, "#111111");
      ctx.restore();
      this.drawHealthPips(e);
    }

    drawTurret(e) {
      const hurt = e.hurt > 0;
      drawPixelRect(e.x + 2, e.y + 28, 36, 17, hurt ? "#f2eee2" : "#6d775b");
      drawPixelRect(e.x + 8, e.y + 16, 24, 14, "#99a06f");
      drawPixelRect(e.x + 12, e.y + 10, 16, 7, "#404b38");
      const dir = this.player.x < e.x ? -1 : 1;
      drawPixelRect(e.x + (dir > 0 ? 28 : -16), e.y + 17, 29, 7, "#2f3634");
      drawPixelRect(e.x + (dir > 0 ? 51 : -22), e.y + 19, 7, 3, "#e4d77d");
      drawPixelRect(e.x, e.y + 43, 40, 5, "#20251f");
      this.drawHealthPips(e);
    }

    drawRocket(e) {
      const hurt = e.hurt > 0;
      const x = e.x;
      const y = e.y;
      const dir = e.vx < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(x + 19, y);
      ctx.scale(dir, 1);
      drawPixelRect(-8, 1, 17, 13, "#d7a069");
      drawPixelRect(-11, 14, 25, 24, hurt ? "#ffe47a" : "#3f7d43");
      drawPixelRect(8, 5, 13, 29, "#697065");
      drawPixelRect(15, 2, 8, 7, "#c7c9b8");
      drawPixelRect(15, 10, 19, 5, "#343a35");
      drawPixelRect(-8, 37, 7, 12, "#243226");
      drawPixelRect(5, 37, 8, 12, "#243226");
      ctx.restore();
      this.drawHealthPips(e);
    }

    drawBoss() {
      const b = this.boss;
      const hurt = b.hurt > 0;
      const base = hurt ? "#ddd7c7" : "#3f4b40";
      drawPixelRect(b.x + 6, b.y + 34, 112, 52, base);
      drawPixelRect(b.x + 18, b.y + 20, 82, 24, "#26382f");
      drawPixelRect(b.x + 27, b.y + 12, 58, 13, "#71815e");
      drawPixelRect(b.x + 36, b.y + 24, 12, 10, "#ff2f3f");
      drawPixelRect(b.x + 68, b.y + 24, 12, 10, "#ff2f3f");
      drawPixelRect(b.x + 16, b.y + 48, 34, 17, "#75856b");
      drawPixelRect(b.x + 58, b.y + 48, 24, 17, "#1e2b29");
      drawPixelRect(b.x + 93, b.y + 44, 56, 16, "#202829");
      drawPixelRect(b.x + 144, b.y + 48, 16, 8, b.phase === 3 ? "#ffcc4d" : "#4ee0ff");
      drawPixelRect(b.x - 8, b.y + 58, 26, 12, "#26382f");
      drawPixelRect(b.x - 15, b.y + 68, 18, 29, "#1d2824");
      for (let i = 0; i < 4; i += 1) {
        drawPixelRect(b.x + 16 + i * 26, b.y + 82, 16, 18, "#1c2622");
        drawPixelRect(b.x + 11 + i * 26, b.y + 100, 26, 9, "#111817");
      }
      for (let i = 0; i < 6; i += 1) {
        drawPixelRect(b.x + 12 + i * 17, b.y + 38, 8, 5, "#a2b079");
      }
    }

    drawHealthPips(e) {
      const width = e.w;
      drawPixelRect(e.x, e.y - 8, width, 4, "#241919");
      drawPixelRect(e.x, e.y - 8, width * (e.hp / e.maxHp), 4, "#ff5b61");
    }

    drawBullets() {
      for (const b of this.bullets) {
        drawEllipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, "#fff2a3");
        ctx.save();
        ctx.globalAlpha = 0.65;
        drawEllipse(b.x - Math.sign(b.vx) * 6, b.y + b.h / 2, 8, 3, "#ff9f3a");
        ctx.restore();
      }
      for (const b of this.enemyBullets) {
        const color = b.kind === "rocket" ? "#ff7b3d" : "#ff5b61";
        drawEllipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, color);
        if (b.kind === "rocket") drawEllipse(b.x - Math.sign(b.vx || 1) * 8, b.y + b.h / 2, 9, 4, "#ffe16a");
      }
    }

    drawItems() {
      for (const item of this.items) {
        if (item.taken) continue;
        const x = item.x;
        const y = item.y;
        drawEllipse(x + 13, y + 13, 14, 14, "#162018");
        drawEllipse(x + 13, y + 13, 10, 10, item.type === "medkit" ? "#e8f5f2" : item.type === "rapid" ? "#0e90bf" : "#8a5fd1");
        if (item.type === "medkit") {
          drawPixelRect(x + 11, y + 6, 5, 14, "#ff5b61");
          drawPixelRect(x + 6, y + 11, 14, 5, "#ff5b61");
        } else if (item.type === "rapid") {
          strokeLine(
            [
              [x + 7, y + 10],
              [x + 19, y + 10],
            ],
            "#e9fbff",
            3,
          );
          strokeLine(
            [
              [x + 7, y + 16],
              [x + 19, y + 16],
            ],
            "#e9fbff",
            3,
          );
        } else {
          strokeLine(
            [
              [x + 7, y + 9],
              [x + 19, y + 13],
              [x + 8, y + 18],
            ],
            "#ffe36e",
            3,
          );
        }
      }
    }

    drawParticles() {
      for (const p of this.particles) {
        drawPixelRect(p.x, p.y, p.size, p.size, p.color);
      }
    }

    drawHud() {
      ctx.save();
      drawPixelRect(16, 16, 246, 46, "rgba(8, 12, 18, 0.72)");
      for (let i = 0; i < this.player.maxHp; i += 1) {
        drawPixelRect(30 + i * 30, 29, 22, 17, i < this.player.hp ? "#ff5b61" : "#45333a");
        drawPixelRect(37 + i * 30, 24, 8, 27, i < this.player.hp ? "#ff5b61" : "#45333a");
      }
      ctx.fillStyle = "#f7fbff";
      ctx.font = "700 16px Segoe UI, Microsoft YaHei, sans-serif";
      ctx.fillText(`SCORE ${this.player.score}`, 286, 45);
      if (this.player.power !== "normal") {
        drawPixelRect(456, 18, 146, 24, "rgba(8, 12, 18, 0.72)");
        drawPixelRect(460, 22, 138 * (this.player.powerTime / (this.player.power === "rapid" ? 12 : 14)), 16, this.player.power === "rapid" ? "#4ee0ff" : "#ffcc4d");
      }
      if (this.boss.active && this.boss.hp > 0) {
        drawPixelRect(602, 18, 330, 26, "rgba(8, 12, 18, 0.78)");
        drawPixelRect(610, 26, 314, 10, "#2a171b");
        drawPixelRect(610, 26, 314 * (this.boss.hp / this.boss.maxHp), 10, "#ff5b61");
        ctx.fillStyle = "#f7fbff";
        ctx.font = "800 12px Segoe UI, Microsoft YaHei, sans-serif";
        ctx.fillText(`BOSS PHASE ${this.boss.phase}`, 616, 57);
      }
      if (this.messageTimer > 0 && this.state === "playing") {
        ctx.fillStyle = "#ffcc4d";
        ctx.font = "800 24px Segoe UI, Microsoft YaHei, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(this.boss.active ? "BOSS APPROACHING" : "GO", W / 2, 96);
        ctx.textAlign = "left";
      }
      ctx.restore();
    }

    drawPause() {
      ctx.save();
      ctx.fillStyle = "rgba(6, 10, 14, 0.62)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffcc4d";
      ctx.font = "900 56px Segoe UI, Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", W / 2, H / 2);
      ctx.restore();
    }
  }

  const game = new Game();

  function startGame() {
    audio.unlock();
    game.reset();
  }

  startButton.addEventListener("click", startGame);
  window.addEventListener("keydown", (event) => {
    const codes = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS", "KeyJ", "KeyK", "KeyP", "KeyM"];
    if (codes.includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
    if ((game.state === "menu" || game.state === "lost" || game.state === "win") && (event.code === "Enter" || event.code === "Space")) {
      startGame();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });
})();
