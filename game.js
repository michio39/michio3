(() => {
  const canvas = document.getElementById("service-game");
  const scoreEl = document.getElementById("game-score");
  const timeEl = document.getElementById("game-time");
  const bestEl = document.getElementById("game-best");
  const messageEl = document.getElementById("game-message");
  const startButton = document.getElementById("game-start");
  const restartButton = document.getElementById("game-restart");
  const padButtons = [...document.querySelectorAll("[data-game-dir]")];

  if (!canvas || !scoreEl || !timeEl || !bestEl || !messageEl || !startButton || !restartButton) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const field = { width: canvas.width, height: canvas.height };
  const maxTime = 60;
  const bestKey = "heart-center-mini-game-best";

  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    boost: false,
  };

  const state = {
    running: false,
    score: 0,
    timeLeft: maxTime,
    lastTick: performance.now(),
    spawnClock: 0,
    patternTick: 0,
    player: null,
    requestItem: null,
    troubles: [],
    particles: [],
  };

  const requestLabels = ["草刈り", "家具移動", "片付け", "清掃", "回収"];

  function setMessage(text) {
    messageEl.textContent = text;
  }

  function updateHud() {
    scoreEl.textContent = String(state.score);
    timeEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    bestEl.textContent = String(Number(localStorage.getItem(bestKey) || 0));
  }

  function createPlayer() {
    return {
      x: field.width / 2,
      y: field.height / 2,
      radius: 16,
      speed: 235,
      boost: 100,
      glow: 0,
    };
  }

  function randomRequest() {
    return {
      x: 44 + Math.random() * (field.width - 88),
      y: 44 + Math.random() * (field.height - 88),
      radius: 16,
      label: requestLabels[Math.floor(Math.random() * requestLabels.length)],
      hue: Math.random() * 40,
    };
  }

  function spawnTrouble(score) {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = Math.random() * field.width;
      y = -30;
    } else if (edge === 1) {
      x = field.width + 30;
      y = Math.random() * field.height;
    } else if (edge === 2) {
      x = Math.random() * field.width;
      y = field.height + 30;
    } else {
      x = -30;
      y = Math.random() * field.height;
    }

    return {
      x,
      y,
      radius: 16 + Math.random() * 10,
      speed: 92 + score * 3 + Math.random() * 24,
      wobble: Math.random() * Math.PI * 2,
    };
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const ttl = 0.6 + Math.random() * 0.5;
      state.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 250,
        vy: (Math.random() - 0.5) * 250,
        life: ttl,
        ttl,
        color,
      });
    }
  }

  function resetGame() {
    state.running = true;
    state.score = 0;
    state.timeLeft = maxTime;
    state.lastTick = performance.now();
    state.spawnClock = 0;
    state.patternTick = 0;
    state.player = createPlayer();
    state.requestItem = randomRequest();
    state.troubles = [spawnTrouble(0)];
    state.particles = [];
    startButton.hidden = true;
    restartButton.hidden = true;
    setMessage("依頼カードを回収して、黒いトラブルを避けてください。");
    updateHud();
  }

  function endGame(reason) {
    state.running = false;
    startButton.hidden = false;
    restartButton.hidden = false;
    startButton.textContent = "もう一度遊ぶ";

    const best = Number(localStorage.getItem(bestKey) || 0);
    if (state.score > best) {
      localStorage.setItem(bestKey, String(state.score));
    }

    if (reason === "time") {
      setMessage(`60秒クリア。対応件数は ${state.score} 件です。`);
    } else {
      setMessage(`トラブル発生。対応件数は ${state.score} 件で終了しました。`);
    }
    updateHud();
  }

  function movePlayer(dt) {
    const player = state.player;
    const xAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const yAxis = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moving = xAxis !== 0 || yAxis !== 0;

    let speed = player.speed;
    if (input.boost && moving && player.boost > 0) {
      speed *= 1.7;
      player.boost = Math.max(0, player.boost - dt * 42);
      player.glow = 1;
    } else {
      player.boost = Math.min(100, player.boost + dt * 18);
    }

    if (moving) {
      const length = Math.hypot(xAxis, yAxis);
      player.x += (xAxis / length) * speed * dt;
      player.y += (yAxis / length) * speed * dt;
    }

    player.x = Math.max(player.radius, Math.min(field.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(field.height - player.radius, player.y));
    player.glow = Math.max(0, player.glow - dt * 1.8);
  }

  function updateRequestCollision() {
    const player = state.player;
    const requestItem = state.requestItem;
    const distance = Math.hypot(player.x - requestItem.x, player.y - requestItem.y);
    if (distance < player.radius + requestItem.radius + 2) {
      state.score += 1;
      state.timeLeft = Math.min(maxTime, state.timeLeft + 2.4);
      state.player.boost = Math.min(100, state.player.boost + 24);
      addParticles(requestItem.x, requestItem.y, "#ffd666", 18);
      state.requestItem = randomRequest();
      setMessage("依頼回収。時間とブーストを少し回復。");
      updateHud();
    }
  }

  function updateTroubles(dt) {
    const player = state.player;
    state.spawnClock += dt;
    const desiredCount = Math.min(8, 1 + Math.floor(state.score / 3));
    if (state.spawnClock >= 2.5 && state.troubles.length < desiredCount) {
      state.troubles.push(spawnTrouble(state.score));
      state.spawnClock = 0;
    }

    for (const trouble of state.troubles) {
      const dx = player.x - trouble.x;
      const dy = player.y - trouble.y;
      const distance = Math.hypot(dx, dy) || 1;
      trouble.wobble += dt * 3;
      trouble.x += (dx / distance) * trouble.speed * dt + Math.cos(trouble.wobble) * 18 * dt;
      trouble.y += (dy / distance) * trouble.speed * dt + Math.sin(trouble.wobble) * 18 * dt;

      if (distance < player.radius + trouble.radius) {
        addParticles(player.x, player.y, "#1b1b1b", 24);
        endGame("hit");
        return;
      }
    }
  }

  function updateParticles(dt) {
    state.particles = state.particles.filter((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      return particle.life > 0;
    });
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, field.height);
    gradient.addColorStop(0, "#2d2840");
    gradient.addColorStop(1, "#1a1c28");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, field.width, field.height);

    state.patternTick += 0.015;
    for (let i = 0; i < 28; i += 1) {
      const x = (i * 83) % field.width;
      const y = (i * 47 + state.patternTick * 40) % field.height;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawRequest() {
    const item = state.requestItem;
    const glow = 22 + Math.sin(state.patternTick * 6) * 4;
    const gradient = ctx.createRadialGradient(item.x, item.y, 2, item.x, item.y, glow);
    gradient.addColorStop(0, "rgba(255, 214, 102, 0.95)");
    gradient.addColorStop(1, "rgba(255, 214, 102, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(item.x, item.y, glow, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff7d5";
    ctx.fillRect(item.x - 18, item.y - 14, 36, 28);
    ctx.strokeStyle = "#ffb35f";
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x - 18, item.y - 14, 36, 28);
    ctx.fillStyle = "#5f4b2e";
    ctx.font = '700 10px "Yu Gothic"';
    ctx.textAlign = "center";
    ctx.fillText(item.label, item.x, item.y + 3);
  }

  function drawPlayer() {
    const player = state.player;
    const ring = 24 + player.glow * 18;
    const glow = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, ring);
    glow.addColorStop(0, "rgba(255, 92, 168, 0.7)");
    glow.addColorStop(1, "rgba(255, 92, 168, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, ring, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff5ca8";
    ctx.beginPath();
    ctx.arc(player.x - 8, player.y, 10, 0, Math.PI * 2);
    ctx.arc(player.x + 8, player.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(player.x - 18, player.y + 4);
    ctx.lineTo(player.x + 18, player.y + 4);
    ctx.lineTo(player.x, player.y + 24);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * player.boost) / 100);
    ctx.stroke();
  }

  function drawTroubles() {
    for (const trouble of state.troubles) {
      const glow = ctx.createRadialGradient(trouble.x, trouble.y, 4, trouble.x, trouble.y, trouble.radius * 2.2);
      glow.addColorStop(0, "rgba(20, 20, 28, 0.9)");
      glow.addColorStop(1, "rgba(20, 20, 28, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(trouble.x, trouble.y, trouble.radius * 2.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1f212d";
      ctx.beginPath();
      ctx.arc(trouble.x, trouble.y, trouble.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trouble.x - trouble.radius * 0.45, trouble.y - trouble.radius * 0.45);
      ctx.lineTo(trouble.x + trouble.radius * 0.45, trouble.y + trouble.radius * 0.45);
      ctx.moveTo(trouble.x + trouble.radius * 0.45, trouble.y - trouble.radius * 0.45);
      ctx.lineTo(trouble.x - trouble.radius * 0.45, trouble.y + trouble.radius * 0.45);
      ctx.stroke();
    }
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const alpha = Math.max(0, Math.min(1, particle.life / particle.ttl));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawOverlay() {
    if (state.running) {
      return;
    }
    ctx.fillStyle = "rgba(10, 10, 16, 0.35)";
    ctx.fillRect(0, 0, field.width, field.height);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.textAlign = "center";
    ctx.font = '700 38px "Yu Gothic"';
    ctx.fillText("HEART CENTER GAME", field.width / 2, field.height / 2 - 10);
    ctx.font = '700 18px "Yu Gothic"';
    ctx.fillText("ゲーム開始でスタート", field.width / 2, field.height / 2 + 24);
  }

  function render() {
    drawBackground();
    if (state.requestItem) {
      drawRequest();
    }
    if (state.player) {
      drawPlayer();
    }
    drawTroubles();
    drawParticles();
    drawOverlay();
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - state.lastTick) / 1000 || 0);
    state.lastTick = now;

    if (state.running) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        endGame("time");
      } else {
        movePlayer(dt);
        updateRequestCollision();
        updateTroubles(dt);
        updateParticles(dt);
        updateHud();
      }
    } else {
      updateParticles(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  function setInput(direction, active) {
    input[direction] = active;
    const pad = document.querySelector(`[data-game-dir="${direction}"]`);
    if (pad) {
      pad.classList.toggle("is-active", active);
    }
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
    }
    if (key === "arrowup" || key === "w") setInput("up", true);
    if (key === "arrowdown" || key === "s") setInput("down", true);
    if (key === "arrowleft" || key === "a") setInput("left", true);
    if (key === "arrowright" || key === "d") setInput("right", true);
    if (key === " ") setInput("boost", true);
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowup" || key === "w") setInput("up", false);
    if (key === "arrowdown" || key === "s") setInput("down", false);
    if (key === "arrowleft" || key === "a") setInput("left", false);
    if (key === "arrowright" || key === "d") setInput("right", false);
    if (key === " ") setInput("boost", false);
  });

  for (const button of padButtons) {
    const direction = button.dataset.gameDir;
    const activate = (event) => {
      event.preventDefault();
      setInput(direction, true);
    };
    const deactivate = (event) => {
      event.preventDefault();
      setInput(direction, false);
    };

    button.addEventListener("pointerdown", activate);
    button.addEventListener("pointerup", deactivate);
    button.addEventListener("pointerleave", deactivate);
    button.addEventListener("pointercancel", deactivate);
  }

  startButton.addEventListener("click", resetGame);
  restartButton.addEventListener("click", resetGame);

  bestEl.textContent = String(Number(localStorage.getItem(bestKey) || 0));
  state.player = createPlayer();
  state.requestItem = randomRequest();
  render();
  requestAnimationFrame(frame);
})();
