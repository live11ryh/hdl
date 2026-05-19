(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
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
      sky.addColorStop(0, "#8fc8e8");
      sky.addColorStop(0.5, "#d6e9c8");
      sky.addColorStop(1, "#6f8f5c");
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
        ctx.fillStyle = "rgba(255, 246, 198, 0.85)";
        ctx.beginPath();
        ctx.arc(790 - this.cameraX * 0.05, 78, 42, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 7; i += 1) {
          const x = i * 210 - (this.cameraX * 0.12) % 210 - 90;
          ctx.fillStyle = i % 2 ? "#6f8d83" : "#78978a";
          ctx.beginPath();
          ctx.moveTo(x - 180, 330);
          ctx.bezierCurveTo(x - 90, 150, x + 80, 125, x + 210, 330);
          ctx.closePath();
          ctx.fill();
        }

        for (let i = 0; i < 16; i += 1) {
          const x = (i * 180 - this.cameraX * 0.3) % (W + 220) - 110;
          const trunk = "#5b432d";
          strokeLine(
            [
              [x, 480],
              [x + 8 * Math.sin(i), 374],
              [x + 18 * Math.cos(i), 270],
            ],
            trunk,
            13 + (i % 3) * 2,
          );
          for (let j = 0; j < 5; j += 1) {
            drawEllipse(x + Math.cos(j * 1.4 + i) * 42, 250 + Math.sin(j * 1.8) * 24, 58, 38, j % 2 ? "#2f6c42" : "#3f8250");
          }
        }

        for (let i = 0; i < 24; i += 1) {
          const x = (i * 106 - this.cameraX * 0.62) % (W + 140) - 70;
          drawEllipse(x, 423 + (i % 3) * 9, 70, 34, i % 2 ? "#285d38" : "#367344");
        }
      }

      ctx.fillStyle = "rgba(24, 55, 32, 0.48)";
      ctx.fillRect(0, 474, W, 66);
    }

    drawPlatforms() {
      for (const p of platforms) {
        const soil = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
        soil.addColorStop(0, "#836c45");
        soil.addColorStop(0.34, "#5b412d");
        soil.addColorStop(1, "#2d241b");
        ctx.fillStyle = soil;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y + 7, p.w, p.h, 12);
        ctx.fill();
        ctx.fillStyle = "#4f8b43";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + 10);
        for (let x = p.x; x <= p.x + p.w; x += 34) {
          ctx.quadraticCurveTo(x + 15, p.y - 4 - ((x / 34) % 3) * 2, x + 34, p.y + 8);
        }
        ctx.lineTo(p.x + p.w, p.y + 22);
        ctx.lineTo(p.x, p.y + 22);
        ctx.closePath();
        ctx.fill();
        for (let x = p.x + 20; x < p.x + p.w; x += 58) {
          drawEllipse(x, p.y + 35 + ((x / 58) % 3) * 8, 15, 6, "#3b2f23");
          strokeLine(
            [
              [x + 12, p.y + 12],
              [x + 18, p.y + 25],
              [x + 15, p.y + 42],
            ],
            "rgba(38, 28, 19, 0.38)",
            2,
          );
        }
      }

      for (let x = 0; x < worldWidth; x += 420) {
        drawEllipse(x + 120, 464, 25, 13, "#5d654f");
        drawEllipse(x + 138, 458, 16, 10, "#788061");
        strokeLine(
          [
            [x + 160, 478],
            [x + 166, 442],
            [x + 156, 410],
          ],
          "#4d3a24",
          5,
        );
        drawEllipse(x + 150, 414, 24, 16, "#477c44");
        drawEllipse(x + 172, 422, 28, 18, "#3f7140");
      }
    }

    drawPlayer() {
      const p = this.player;
      const flash = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
      if (flash) return;
      const x = p.x;
      const y = p.y;
      const facing = p.dir;
      const crouch = p.h < 40;
      const bodyY = crouch ? 10 : 14;
      ctx.save();
      ctx.translate(x + 16, y);
      ctx.scale(facing, 1);
      drawEllipse(0, 8, 9, 10, "#cfa47a");
      drawEllipse(3, 6, 4, 3, "#1d1712");
      strokeLine(
        [
          [-10, 2],
          [-2, -2],
          [8, 2],
        ],
        "#263625",
        5,
      );
      drawRoundRect(-10, bodyY, 21, crouch ? 17 : 24, 9, "#3f6d45");
      drawRoundRect(-7, bodyY + 4, 15, 8, 5, "#7f9a5d");
      strokeLine(
        [
          [8, bodyY + 7],
          [23, bodyY + 9],
          [33, bodyY + 8],
        ],
        "#2c2620",
        6,
      );
      strokeLine(
        [
          [28, bodyY + 7],
          [42, bodyY + 7],
        ],
        "#5b6060",
        4,
      );
      strokeLine(
        [
          [-6, bodyY + (crouch ? 17 : 23)],
          [-12, p.h - 3],
        ],
        "#263a2e",
        7,
      );
      strokeLine(
        [
          [7, bodyY + (crouch ? 17 : 23)],
          [14, p.h - 3],
        ],
        "#263a2e",
        7,
      );
      strokeLine(
        [
          [-16, p.h - 2],
          [-4, p.h - 2],
        ],
        "#151719",
        5,
      );
      strokeLine(
        [
          [10, p.h - 2],
          [23, p.h - 2],
        ],
        "#151719",
        5,
      );
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
      const x = e.x + 17;
      const y = e.y;
      drawEllipse(x, y + 8, 9, 10, hurt ? "#fff0df" : "#d6ad83");
      strokeLine(
        [
          [x - 10, y + 2],
          [x + 2, y - 2],
          [x + 12, y + 3],
        ],
        "#4d3925",
        5,
      );
      drawRoundRect(x - 11, y + 15, 22, 22, 10, hurt ? "#f08c72" : "#8a5d36");
      strokeLine(
        [
          [x + 8, y + 22],
          [x + 24, y + 24],
        ],
        "#35291e",
        5,
      );
      strokeLine(
        [
          [x - 6, y + 35],
          [x - 13, y + 48],
        ],
        "#433523",
        6,
      );
      strokeLine(
        [
          [x + 7, y + 35],
          [x + 14, y + 48],
        ],
        "#433523",
        6,
      );
      this.drawHealthPips(e);
    }

    drawTurret(e) {
      const hurt = e.hurt > 0;
      drawEllipse(e.x + 20, e.y + 30, 20, 15, hurt ? "#f4efe1" : "#626b62");
      drawEllipse(e.x + 20, e.y + 17, 14, 11, "#8b907a");
      const dir = this.player.x < e.x ? -1 : 1;
      strokeLine(
        [
          [e.x + 20 + dir * 9, e.y + 17],
          [e.x + 20 + dir * 36, e.y + 14],
        ],
        "#2f3634",
        8,
      );
      strokeLine(
        [
          [e.x + 8, e.y + 44],
          [e.x + 32, e.y + 44],
        ],
        "#2d312c",
        8,
      );
      this.drawHealthPips(e);
    }

    drawRocket(e) {
      const hurt = e.hurt > 0;
      const x = e.x + 18;
      const y = e.y;
      drawEllipse(x, y + 9, 9, 10, "#d9b58e");
      drawRoundRect(x - 13, y + 16, 26, 22, 10, hurt ? "#fff2bd" : "#536b35");
      drawRoundRect(x + 9, y + 6, 12, 28, 7, "#697065");
      strokeLine(
        [
          [x + 15, y + 10],
          [x + 31, y + 6],
        ],
        "#33372f",
        5,
      );
      strokeLine(
        [
          [x - 6, y + 36],
          [x - 11, y + 48],
        ],
        "#2f3b29",
        6,
      );
      strokeLine(
        [
          [x + 7, y + 36],
          [x + 14, y + 48],
        ],
        "#2f3b29",
        6,
      );
      this.drawHealthPips(e);
    }

    drawBoss() {
      const b = this.boss;
      const hurt = b.hurt > 0;
      ctx.save();
      const body = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      body.addColorStop(0, hurt ? "#f6ead8" : "#4e5c48");
      body.addColorStop(0.55, hurt ? "#fff7e5" : "#71815e");
      body.addColorStop(1, hurt ? "#d8c0a6" : "#2f3d32");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(b.x + 65, b.y + 58, 58, 42, -0.08, 0, Math.PI * 2);
      ctx.fill();
      drawEllipse(b.x + 42, b.y + 25, 25, 21, "#3a4438");
      drawEllipse(b.x + 74, b.y + 25, 25, 21, "#3a4438");
      drawEllipse(b.x + 43, b.y + 25, 7, 6, "#ff5b61");
      drawEllipse(b.x + 75, b.y + 25, 7, 6, "#ff5b61");
      strokeLine(
        [
          [b.x + 26, b.y + 53],
          [b.x - 10, b.y + 72],
          [b.x + 18, b.y + 93],
        ],
        "#2b3328",
        12,
      );
      strokeLine(
        [
          [b.x + 95, b.y + 54],
          [b.x + 142, b.y + 54],
        ],
        "#30372f",
        15,
      );
      drawEllipse(b.x + 148, b.y + 54, 11, 8, b.phase === 3 ? "#ffcc4d" : "#4ee0ff");
      for (let i = 0; i < 4; i += 1) {
        const lx = b.x + 26 + i * 24;
        strokeLine(
          [
            [lx, b.y + 88],
            [lx - 8, b.y + 111],
            [lx + 8, b.y + 111],
          ],
          "#242b25",
          9,
        );
      }
      ctx.restore();
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
