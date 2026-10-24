// =====================================================
//  FIELD: Password — Draw Your Face, then Redraw It
//  Step 1: draw your face (accepted right away).
//  Step 2: redraw it from memory. It must be a 90% match.
//  The match score is calculated in the browser (instant).
//  Mercy rule: after 3 failed confirmations, it lets you through.
// =====================================================
(function () {
  window.HackAugie = window.HackAugie || {};
  window.HackAugie.fields = window.HackAugie.fields || {};

  const MAX_FAILS = 3;
  const REQUIRED = 90;       // the % shown as required
  const GRID = 48;           // drawings are compared on a 48x48 grid
  const TOLERANCE = 1;       // how many grid cells a line can be "off" and still count
  const LENIENCY = 1.3;      // boosts the raw score so a careful redraw can reach 90%

  const FAIL_LINES = [
    "That's not your face. That's a crime scene.",
    "Did you forget what you look like in 30 seconds?",
    "Your password just failed to recognize you. Relatable.",
    "Picasso called. Even he can't match that.",
    "Your face changed more in one minute than your code all semester.",
    "Hackers can't crack this password. Neither can you, apparently."
  ];

  const CSS = `
    .ha-pass-hint { color: #555; margin: 0 0 12px; line-height: 1.5; }
    .ha-pass-step { font-weight: 800; color: #1f3a93; margin-bottom: 6px; }
    .ha-pass-canvas { display: block; width: 100%; max-width: 340px; aspect-ratio: 1 / 1; border: 3px solid #1f3a93;
      border-radius: 12px; background: #fff; cursor: crosshair; touch-action: none; margin-bottom: 12px; }
    .ha-pass-canvas.ha-pass-locked { cursor: not-allowed; border-color: #2a9d8f; }
    .ha-pass-btn { padding: 10px 16px; font-weight: 700; border: none; border-radius: 12px; font-family: inherit;
      background: #1f3a93; color: #fff; cursor: pointer; margin-right: 8px; }
    .ha-pass-btn.ha-pass-secondary { background: #e5e7ef; color: #222; }
    .ha-pass-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ha-pass-score { font-size: 22px; font-weight: 900; margin-top: 10px; min-height: 1.2em; }
    .ha-pass-msg { margin-top: 6px; font-weight: 600; min-height: 1.3em; }
    .ha-pass-msg.ha-pass-ok { color: #2a9d8f; }
    .ha-pass-msg.ha-pass-bad { color: #d62828; }
    .ha-pass-tries { font-size: 13px; color: #777; margin-top: 4px; }
  `;

  let root = null, canvas = null, ctx = null, els = {};
  let drawing = false, hasInk = false, busy = false;
  let step = 1;              // 1 = set password, 2 = confirm password, 3 = done
  let original = null;       // ink grid of the first drawing
  let fails = 0;

  function injectStyle() {
    if (document.getElementById("ha-pass-style")) return;
    const s = document.createElement("style");
    s.id = "ha-pass-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    root.innerHTML = `
      <div class="ha-pass-step"></div>
      <p class="ha-pass-hint"></p>
      <canvas class="ha-pass-canvas" width="400" height="400"></canvas>
      <button class="ha-pass-btn" data-act="submit"></button>
      <button class="ha-pass-btn ha-pass-secondary" data-act="clear">🧽 Clear</button>
      <div class="ha-pass-score"></div>
      <div class="ha-pass-msg"></div>
      <div class="ha-pass-tries"></div>
    `;
    canvas = root.querySelector("canvas");
    ctx = canvas.getContext("2d");
    els.step = root.querySelector(".ha-pass-step");
    els.hint = root.querySelector(".ha-pass-hint");
    els.submit = root.querySelector('[data-act="submit"]');
    els.clear = root.querySelector('[data-act="clear"]');
    els.score = root.querySelector(".ha-pass-score");
    els.msg = root.querySelector(".ha-pass-msg");
    els.tries = root.querySelector(".ha-pass-tries");
    clearCanvas();

    canvas.addEventListener("pointerdown", e => {
      if (step === 3 || busy) return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const p = point(e);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
      hasInk = true;
    });
    canvas.addEventListener("pointermove", e => {
      if (!drawing) return;
      const p = point(e);
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    const stop = () => { drawing = false; };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("pointerleave", stop);

    els.clear.addEventListener("click", () => { if (step !== 3 && !busy) clearCanvas(); });
    els.submit.addEventListener("click", submit);
    updateUI();
  }

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  function clearCanvas() {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    hasInk = false;
  }

  function setMsg(text, type) {
    els.msg.textContent = text;
    els.msg.className = "ha-pass-msg" + (type ? " ha-pass-" + type : "");
  }

  function updateUI() {
    if (step === 1) {
      els.step.textContent = "Step 1 of 2: Set password";
      els.hint.innerHTML = "For maximum security, your password is a drawing of <b>your face</b>. Remember it well.";
      els.submit.textContent = "🔐 Set password";
    } else if (step === 2) {
      els.step.textContent = "Step 2 of 2: Confirm password";
      els.hint.innerHTML = `Now redraw your face from memory. It must be at least a <b>${REQUIRED}% match</b>.`;
      els.submit.textContent = "✅ Confirm password";
    } else {
      els.step.textContent = "Password set";
      els.hint.textContent = "";
    }
    els.submit.style.display = step === 3 ? "none" : "";
    els.clear.style.display = step === 3 ? "none" : "";
    els.submit.disabled = busy;
    canvas.classList.toggle("ha-pass-locked", step === 3);
    els.tries.textContent = step === 2 && fails ? `Failed attempts: ${fails}/${MAX_FAILS}` : "";
  }

  // Turn the drawing into a small grid of "ink / no ink", cropped to the drawing
  // so it doesn't matter exactly where on the canvas the face was drawn.
  function inkGrid() {
    const { width: w, height: h } = canvas;
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4] < 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    const size = Math.max(maxX - minX, maxY - minY, 1);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const grid = new Uint8Array(GRID * GRID);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4] >= 128) continue;
      const gx = Math.floor(((x - cx) / size + 0.5) * (GRID - 1));
      const gy = Math.floor(((y - cy) / size + 0.5) * (GRID - 1));
      if (gx >= 0 && gy >= 0 && gx < GRID && gy < GRID) grid[gy * GRID + gx] = 1;
    }
    return grid;
  }

  function dilate(grid) {
    const out = new Uint8Array(GRID * GRID);
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      if (!grid[y * GRID + x]) continue;
      for (let dy = -TOLERANCE; dy <= TOLERANCE; dy++) for (let dx = -TOLERANCE; dx <= TOLERANCE; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GRID && ny < GRID) out[ny * GRID + nx] = 1;
      }
    }
    return out;
  }

  // How much of each drawing lands near the lines of the other one
  function similarity(a, b) {
    const da = dilate(a), db = dilate(b);
    let aHit = 0, aTotal = 0, bHit = 0, bTotal = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i]) { aTotal++; if (db[i]) aHit++; }
      if (b[i]) { bTotal++; if (da[i]) bHit++; }
    }
    if (!aTotal || !bTotal) return 0;
    const raw = (aHit / aTotal + bHit / bTotal) / 2;
    return Math.min(100, Math.round(raw * 100 * LENIENCY));
  }

  async function submit() {
    if (busy || step === 3) return;
    if (!hasInk) return setMsg("The canvas is empty. Is your face... invisible?", "bad");

    if (step === 1) {
      original = inkGrid();
      step = 2;
      clearCanvas();
      els.score.textContent = "";
      setMsg("Password saved. Now prove you remember your own face.", "ok");
      return updateUI();
    }

    const score = similarity(original, inkGrid());
    els.score.textContent = `Match: ${score}%`;
    els.score.style.color = score >= REQUIRED ? "#2a9d8f" : "#d62828";

    if (score >= REQUIRED) return accept("✅ Password confirmed. Somehow.");

    fails++;
    if (fails >= MAX_FAILS) return accept("✅ Fine. Password accepted. I'm tired of watching this.");

    busy = true;
    updateUI();
    setMsg("❌ Incorrect. Try again.", "bad");
    if (window.HackAugie.sfx) window.HackAugie.sfx.play("buzzer");
    const roast = window.HackAugie.quickRoast
      ? await window.HackAugie.quickRoast(`Someone tried to redraw their own face as a password and only got a ${score}% match. Roast them.`, FAIL_LINES, 2500)
      : FAIL_LINES[Math.floor(Math.random() * FAIL_LINES.length)];
    if (step !== 2) return;
    busy = false;
    clearCanvas();
    setMsg("❌ Incorrect. Try again. 🤖 " + roast, "bad");
    updateUI();
  }

  function accept(message) {
    step = 3;
    busy = false;
    setMsg(message, "ok");
    updateUI();
    if (window.HackAugie.onFieldComplete) window.HackAugie.onFieldComplete("password", "face-drawing");
  }

  window.HackAugie.fields.password = {
    mount(container) { injectStyle(); root = container; build(); },
    reset() { step = 1; original = null; fails = 0; busy = false; drawing = false; build(); },
    isComplete() { return step === 3; },
    getValue() { return step === 3 ? "face-drawing" : null; }
  };
})();
