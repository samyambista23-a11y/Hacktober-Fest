/* captcha.js - Augie CAPTCHA field ("Viking Verification")
   Registers itself as window.HackAugie.fields.captcha */
(function () {
  window.HackAugie = window.HackAugie || {};
  window.HackAugie.fields = window.HackAugie.fields || {};

  // ---------- Settings ----------
  const BLUE = "#1f3a93";
  const GOLD = "#f2b705";
  const DECOYS = ["#0a1a4a", "#7fa7e8", "#2e5bd8", "#c9a227", "#fff04d", "#f28c05", "#b8860b"];
  const DODGES_NEEDED = 3;      // checkbox runs away this many times
  const MAX_FAILS = 3;          // after this many failures, the next VERIFY passes
  const GEMMA_TIMEOUT_MS = 8000; // give up on askGemma after this long
  const BOX = 28;               // checkbox size in px
  const STAGE_H = 110;          // step 1 box height in px

  const GEMMA_PROMPT = "Write one short, funny, sarcastic sentence (under 20 words) telling a user they failed a CAPTCHA asking them to pick Augustana College's blue and gold colors. They picked a wrong shade.";
  const FALLBACKS = [
    "That's mustard. You selected mustard.",
    "Navy is not blue. Navy is blue's grumpy cousin.",
    "Lemon yellow? Bold. Also wrong.",
    "Vikings can spot a fake gold from across the fjord.",
    "Orange is not gold. Orange is just gold with ambition.",
    "Baby blue belongs on a onesie, not a Viking shield.",
    "Your color vision has been reported to Odin.",
    "Close, but 'close' doesn't raid villages.",
    "Royal blue is for royalty. We're Vikings. Try again."
  ];

  // ---------- State ----------
  let dodges = 0, failures = 0;
  let boxX = 14, boxY = (STAGE_H - BOX) / 2;   // checkbox position inside the stage
  let complete = false, busy = false;
  let squares = [];             // {color, correct, selected}
  let runId = 0;                // changes on reset so old async work stops itself
  let els = null;

  // ---------- Styles (injected once) ----------
  const CSS = `
  .ha-captcha-root{--augie-blue:#1f3a93;--augie-gold:#f2b705;font-family:system-ui,sans-serif;color:#222;
    background:#fff;border:2px solid #d3d3d3;border-radius:12px;max-width:340px;overflow:hidden;
    box-shadow:0 2px 6px rgba(0,0,0,.15);box-sizing:border-box}
  .ha-captcha-root *{box-sizing:border-box}
  .ha-captcha-head{background:var(--augie-blue);color:#fff;padding:8px 14px;font-weight:700;font-size:.95rem}
  .ha-captcha-body{padding:14px}
  .ha-captcha-hidden{display:none !important}
  .ha-captcha-stage{position:relative;height:${STAGE_H}px;background:#f9f9f9;border:1px solid #d3d3d3;border-radius:8px;overflow:hidden}
  .ha-captcha-text{position:absolute;left:56px;top:50%;transform:translateY(-50%);font-size:1.05rem;pointer-events:none}
  .ha-captcha-check{position:absolute;width:${BOX}px;height:${BOX}px;border:2px solid #888;border-radius:4px;background:#fff;
    cursor:pointer;padding:0;font:inherit;font-weight:900;font-size:1.1rem;line-height:1;color:#1b6e2d;
    transition:left .18s ease, top .18s ease}
  .ha-captcha-hint{min-height:1.3em;font-size:.85rem;color:#555;margin-top:8px}
  .ha-captcha-ask{font-weight:700;margin-bottom:8px}
  .ha-captcha-samples{display:flex;gap:14px;margin-bottom:10px;font-size:.8rem}
  .ha-captcha-sample{display:flex;align-items:center;gap:6px}
  .ha-captcha-chip{width:20px;height:20px;border-radius:4px;border:1px solid #0003}
  .ha-captcha-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .ha-captcha-sq{position:relative;aspect-ratio:1;border:3px solid transparent;border-radius:6px;cursor:pointer;padding:0}
  .ha-captcha-sq.ha-captcha-sel{border-color:#222;outline:3px solid #fff;outline-offset:-6px}
  .ha-captcha-sq.ha-captcha-sel::after{content:"✓";position:absolute;top:4px;right:4px;width:22px;height:22px;
    border-radius:50%;background:#fff;color:#222;font-weight:900;line-height:22px;font-size:.9rem}
  .ha-captcha-verify{font:inherit;font-weight:800;width:100%;margin-top:10px;padding:10px;border:0;border-radius:12px;
    cursor:pointer;background:var(--augie-gold);color:#222}
  .ha-captcha-verify:disabled{opacity:.5;cursor:not-allowed}
  .ha-captcha-msg{min-height:1.4em;margin-top:10px;font-weight:600}
  .ha-captcha-msg.ha-captcha-bad{color:#b3261e}
  .ha-captcha-msg.ha-captcha-good{color:#1b6e2d}
  .ha-captcha-mock{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(10,10,30,.75);cursor:pointer;animation:ha-captcha-fade 4.8s forwards}
  .ha-captcha-mock-emoji{font-size:180px;line-height:1.1}
  .ha-captcha-mock-img{max-width:75vw;max-height:60vh;border-radius:16px;border:8px solid #f2b705;
    box-shadow:0 0 60px #d62828;animation:ha-captcha-slam .7s cubic-bezier(.2,1.6,.4,1) both}
  .ha-captcha-mock-text{animation:ha-captcha-slam .7s .25s cubic-bezier(.2,1.6,.4,1) both}
  .ha-captcha-flash{position:fixed;inset:0;background:#fff;pointer-events:none;animation:ha-captcha-flashout .4s forwards}
  @keyframes ha-captcha-slam{0%{transform:scale(0) rotate(-540deg);opacity:0}70%{transform:scale(1.25) rotate(8deg);opacity:1}100%{transform:scale(1) rotate(0)}}
  @keyframes ha-captcha-flashout{from{opacity:.9}to{opacity:0}}
  @keyframes ha-captcha-quakebody{0%,100%{transform:translate(0,0)}20%{transform:translate(-14px,8px)}40%{transform:translate(12px,-10px)}60%{transform:translate(-10px,-6px)}80%{transform:translate(8px,10px)}}
  body.ha-captcha-quake main{animation:ha-captcha-quakebody .12s linear 5}
  .ha-captcha-mock-text{font-family:"Pirata One",Georgia,serif;font-size:64px;color:#fff;text-align:center;padding:0 16px;
    text-shadow:0 0 12px #000,4px 4px 0 #d62828}
  .ha-captcha-a-spin{animation:ha-captcha-spin .8s linear infinite}
  .ha-captcha-a-shake{animation:ha-captcha-shake .15s linear infinite}
  .ha-captcha-a-zoom{animation:ha-captcha-zoom .5s ease-in-out infinite alternate}
  .ha-captcha-a-bounce{animation:ha-captcha-bounce .4s ease-in-out infinite alternate}
  @keyframes ha-captcha-spin{to{transform:rotate(360deg)}}
  @keyframes ha-captcha-shake{0%{transform:translate(-12px,4px) rotate(-6deg)}50%{transform:translate(12px,-4px) rotate(6deg)}100%{transform:translate(-12px,4px) rotate(-6deg)}}
  @keyframes ha-captcha-zoom{from{transform:scale(.6)}to{transform:scale(1.3)}}
  @keyframes ha-captcha-bounce{from{transform:translateY(-30px)}to{transform:translateY(30px)}}
  @keyframes ha-captcha-fade{0%{opacity:1}88%{opacity:1}100%{opacity:0}}
  `;
  function injectStyles() {
    if (document.getElementById("ha-captcha-style")) return;
    const s = document.createElement("style");
    s.id = "ha-captcha-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- Helpers ----------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(text, kind) {
    els.msg.textContent = text;
    els.msg.className = "ha-captcha-msg" + (kind ? " ha-captcha-" + kind : "");
  }
  function placeBox(x, y) {
    boxX = x; boxY = y;
    els.check.style.left = x + "px";
    els.check.style.top = y + "px";
  }
  function shuffle(arr) {                       // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- Step 1: the dodging checkbox ----------
  // mx,my = mouse position inside the stage. Jump somewhere far from the mouse.
  function dodge(mx, my) {
    const rect = els.stage.getBoundingClientRect();
    const w = rect.width || 300;
    let x, y;
    for (let tries = 0; tries < 30; tries++) {
      x = Math.random() * (w - BOX);
      y = Math.random() * (STAGE_H - BOX);
      if (Math.hypot(x + BOX / 2 - mx, y + BOX / 2 - my) > 90) break;
    }
    placeBox(x, y);
    dodges++;
    els.hint.textContent = "";
  }

  function onStageMove(e) {
    if (dodges >= DODGES_NEEDED) return;
    const rect = els.stage.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    // close to the checkbox's center? run away!
    if (Math.hypot(boxX + BOX / 2 - mx, boxY + BOX / 2 - my) < 45) dodge(mx, my);
  }

  function onCheckClick() {
    if (dodges < DODGES_NEEDED) {               // sneaky click (or touch screen): still dodge
      dodge(boxX + BOX / 2, boxY + BOX / 2);
      return;
    }
    const myRun = runId;
    els.check.textContent = "✓";
    setTimeout(() => { if (myRun === runId) showStep2(); }, 500);
  }

  // ---------- Step 2: the color grid ----------
  function showStep2() {
    els.step1.classList.add("ha-captcha-hidden");
    els.step2.classList.remove("ha-captcha-hidden");
    newGrid();
  }

  function newGrid() {
    const nCorrect = 2 + Math.floor(Math.random() * 3);     // 2, 3 or 4 correct squares
    squares = [];
    for (let i = 0; i < nCorrect; i++) {
      squares.push({ color: Math.random() < 0.5 ? BLUE : GOLD, correct: true, selected: false });
    }
    for (let i = nCorrect; i < 9; i++) {
      squares.push({ color: DECOYS[Math.floor(Math.random() * DECOYS.length)], correct: false, selected: false });
    }
    shuffle(squares);
    els.grid.innerHTML = "";
    squares.forEach((sq, i) => {
      const b = el("button", "ha-captcha-sq");
      b.type = "button";
      b.style.background = sq.color;
      b.setAttribute("aria-label", "Color square " + (i + 1));
      b.addEventListener("click", () => {
        if (complete) return;
        sq.selected = !sq.selected;
        b.classList.toggle("ha-captcha-sel", sq.selected);
      });
      els.grid.appendChild(b);
    });
  }

  function pass(text) {
    complete = true;
    els.verify.disabled = true;
    say(text, "good");
    if (window.HackAugie.onFieldComplete) window.HackAugie.onFieldComplete("captcha", true);
  }

  // ---------- Mocking (sound + visual), different every time ----------
  // To add your own GIFs/sounds later, put the files in the assets folder and list them here, e.g.
  //   { img: "assets/laugh.gif", sound: "assets/boo.mp3" }
  const MOCK_MEDIA = [
    { img: "assets/mock1.gif" },
    { img: "assets/mock2.gif" },
    { img: "assets/mock3.gif" }
  ];
  let lastMedia = -1;

  const MOCK_VISUALS = [
    { e: "🤡", t: "CLOWN DETECTED", a: "spin" },
    { e: "🫵😂", t: "LOOK AT THIS GUY", a: "shake" },
    { e: "💀", t: "SKILL ISSUE", a: "zoom" },
    { e: "🤣🤣🤣", t: "HAHAHAHA NO", a: "bounce" },
    { e: "👎", t: "ODIN IS DISAPPOINTED", a: "shake" },
    { e: "🧌", t: "EVEN THE TROLL KNEW THAT", a: "bounce" },
    { e: "🙈", t: "COLORBLIND VIKING ALERT", a: "zoom" },
    { e: "🪦", t: "RIP YOUR DIGNITY", a: "spin" },
    { e: "🐑", t: "BAAAA. WRONG.", a: "bounce" },
    { e: "🛶💦", t: "YOUR LONGSHIP SANK", a: "shake" }
  ];
  const SPOKEN = [
    "Wrong. Absolutely wrong.", "Are you even trying?", "That is not Augie gold, my friend.",
    "Ha ha ha. No.", "Viking verification failed. Embarrassing.", "My grandma picks colors better than you.",
    "Wow. Just wow.", "Try again, rookie."
  ];
  let lastMock = -1;

  function mock() {
    let i;
    do { i = Math.floor(Math.random() * MOCK_VISUALS.length); } while (i === lastMock && MOCK_VISUALS.length > 1);
    lastMock = i;
    const v = MOCK_VISUALS[i];
    let m;
    do { m = Math.floor(Math.random() * MOCK_MEDIA.length); } while (m === lastMedia && MOCK_MEDIA.length > 1);
    lastMedia = m;
    const media = MOCK_MEDIA[m];

    // Dramatic entrance: white flash, GIF slams in spinning, page shakes
    const layer = el("div", "ha-captcha-mock");
    const art = media
      ? Object.assign(el("img", "ha-captcha-mock-img"), { src: media.img + "?t=" + Date.now() })  // restart GIF from frame 1
      : el("div", "ha-captcha-mock-emoji ha-captcha-a-" + v.a, v.e);
    layer.append(el("div", "ha-captcha-flash"), art, el("div", "ha-captcha-mock-text", v.t));
    layer.addEventListener("click", () => layer.remove());
    document.body.appendChild(layer);
    document.body.classList.add("ha-captcha-quake");
    setTimeout(() => document.body.classList.remove("ha-captcha-quake"), 600);
    setTimeout(() => layer.remove(), 4800);

    // Wrong-color sound effect (falls back to a synth sound if the file can't play)
    const music = window.HackAugie.music;
    if (music) music.play("wrongColor");
    else if (window.HackAugie.sfx) window.HackAugie.sfx.random();
  }

  async function verify() {
    if (busy || complete) return;
    if (failures >= MAX_FAILS) {                              // mercy rule
      pass("Fine. You're verified. I'm tired of watching this.");
      return;
    }
    if (squares.every(sq => sq.selected === sq.correct)) {
      pass("✅ Viking verified.");
      return;
    }
    failures++;
    busy = true;
    els.verify.disabled = true;
    const myRun = runId;
    mock();                                                   // instant mocking
    newGrid();
    say("", "");
    const msg = window.HackAugie.quickRoast
      ? await window.HackAugie.quickRoast("Roast someone who failed a CAPTCHA asking them to pick Augustana College's blue and gold. They picked a wrong shade.", FALLBACKS, 2500)
      : FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
    if (myRun !== runId) return;
    busy = false;
    els.verify.disabled = false;
    say("❌ " + msg, "bad");
  }

  // ---------- Public API ----------
  window.HackAugie.fields.captcha = {
    mount(container) {
      injectStyles();
      container.innerHTML = "";
      const root = el("div", "ha-captcha-root");
      root.appendChild(el("div", "ha-captcha-head", "⚔️ Viking Verification"));
      const body = el("div", "ha-captcha-body");
      els = { root };

      // Step 1
      els.step1 = el("div");
      els.stage = el("div", "ha-captcha-stage");
      els.check = el("button", "ha-captcha-check");
      els.check.type = "button";
      els.check.setAttribute("aria-label", "I'm not a robot");
      els.stage.append(els.check, el("div", "ha-captcha-text", "I'm not a robot"));
      els.hint = el("div", "ha-captcha-hint");
      els.step1.append(els.stage, els.hint);
      els.stage.addEventListener("pointermove", onStageMove);
      els.check.addEventListener("click", onCheckClick);

      // Step 2
      els.step2 = el("div", "ha-captcha-hidden");
      const samples = el("div", "ha-captcha-samples");
      [["Augie Blue", BLUE], ["Augie Gold", GOLD]].forEach(([name, color]) => {
        const s = el("div", "ha-captcha-sample");
        const chip = el("div", "ha-captcha-chip");
        chip.style.background = color;
        s.append(chip, el("span", "", name));
        samples.appendChild(s);
      });
      els.grid = el("div", "ha-captcha-grid");
      els.verify = el("button", "ha-captcha-verify", "VERIFY");
      els.verify.type = "button";
      els.verify.addEventListener("click", verify);
      els.step2.append(el("div", "ha-captcha-ask", "Select all squares in Augie Blue & Gold"),
        samples, els.grid, els.verify);

      els.msg = el("div", "ha-captcha-msg");
      body.append(els.step1, els.step2, els.msg);
      root.appendChild(body);
      container.appendChild(root);
      this.reset();
    },

    reset() {
      runId++;                      // cancels pending timers / Gemma calls
      dodges = 0; failures = 0; complete = false; busy = false; squares = [];
      if (!els) return;
      els.step1.classList.remove("ha-captcha-hidden");
      els.step2.classList.add("ha-captcha-hidden");
      els.check.textContent = "";
      els.hint.textContent = "";
      els.grid.innerHTML = "";
      els.verify.disabled = false;
      say("", "");
      placeBox(14, (STAGE_H - BOX) / 2);
    },

    isComplete() { return complete; },
    getValue() { return complete; }
  };
})();
