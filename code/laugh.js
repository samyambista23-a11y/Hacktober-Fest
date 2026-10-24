// =====================================================
//  FIELD: Coding Skill (1–10) — Laugh It
//  Laugh continuously. Every second of laughing = 1 point.
//  Stop laughing and your score locks in. Max is 10.
//  Uses the browser's microphone (free, no Gemma needed).
// =====================================================
(function () {
  window.HackAugie = window.HackAugie || {};
  window.HackAugie.fields = window.HackAugie.fields || {};

  // ---- Tuning knobs ----
  const CALIBRATE_MS = 1000;  // listen to the room's background noise first
  const ABOVE_NOISE_DB = 12;  // sound must be this much louder than the room to count
  const MIN_THRESHOLD_DB = -52;
  const GAP_MS = 800;         // pauses shorter than this don't count as stopping ("ha... ha... ha")
  const MAX_SECONDS = 10;

  const FALLBACK = {
    low: ["That laugh was shorter than your attention span.", "One chuckle? Your code must be as dry as your humor.",
          "Humble score. Or you just ran out of breath. Probably both."],
    mid: ["Mid laugh, mid coder. Consistency, at least.", "You laughed like someone whose code compiles with warnings.",
          "Perfectly average. Like your GitHub."],
    high: ["You laughed that long and you still think you can code?", "Confidence of a 10, skills of a hello-world.",
           "That laugh was the most impressive thing you've built all year."]
  };

  const CSS = `
    .ha-laugh-hint { color: #555; margin: 0 0 12px; line-height: 1.5; }
    .ha-laugh-big { font-size: 64px; font-weight: 900; color: #1f3a93; text-align: center; line-height: 1; font-variant-numeric: tabular-nums; }
    .ha-laugh-sub { text-align: center; color: #777; font-size: 14px; margin: 6px 0 12px; font-weight: 600; min-height: 1.3em; }
    .ha-laugh-meter { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; margin-bottom: 8px; }
    .ha-laugh-bar { height: 34px; border-radius: 6px; background: #e5e7ef; display: flex; align-items: flex-end;
      justify-content: center; font-size: 12px; font-weight: 700; color: #888; padding-bottom: 2px; transition: background .1s; }
    .ha-laugh-bar.ha-laugh-on { background: #f2b705; color: #222; }
    .ha-laugh-bar.ha-laugh-hot { background: #d62828; color: #fff; }
    .ha-laugh-level { height: 8px; background: #e5e7ef; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
    .ha-laugh-level-fill { height: 100%; width: 0%; background: #2a9d8f; transition: width .05s; }
    .ha-laugh-btn { padding: 10px 16px; font-weight: 700; border: none; border-radius: 12px; font-family: inherit;
      background: #1f3a93; color: #fff; cursor: pointer; margin-right: 8px; }
    .ha-laugh-btn.ha-laugh-secondary { background: #e5e7ef; color: #222; }
    .ha-laugh-msg { margin-top: 10px; font-weight: 600; min-height: 1.3em; }
    .ha-laugh-msg.ha-laugh-ok { color: #2a9d8f; }
    .ha-laugh-msg.ha-laugh-bad { color: #d62828; }
  `;

  let root = null, els = {};
  let locked = false, lockedValue = null;
  let stream = null, ctx = null, analyser = null, buffer = null, rafId = null;
  let phase = "off";            // off | calibrating | waiting | laughing
  let phaseStart = 0, noiseSum = 0, noiseCount = 0, threshold = -45;
  let smoothDb = -100, laughStart = 0, lastLoud = 0;

  function injectStyle() {
    if (document.getElementById("ha-laugh-style")) return;
    const s = document.createElement("style");
    s.id = "ha-laugh-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    root.innerHTML = `
      <p class="ha-laugh-hint">No typing allowed. <b>Laugh out loud, without stopping,</b> for as many seconds as your
      coding skill. 8 seconds of laughing = 8/10. The moment you stop, your score locks in.</p>
      <div class="ha-laugh-big">0.0s</div>
      <div class="ha-laugh-sub">Microphone off</div>
      <div class="ha-laugh-meter"></div>
      <div class="ha-laugh-level"><div class="ha-laugh-level-fill"></div></div>
      <button class="ha-laugh-btn" data-act="start">🎤 I'm ready to laugh</button>
      <button class="ha-laugh-btn ha-laugh-secondary" data-act="redo" style="display:none">🔁 Laugh again</button>
      <div class="ha-laugh-msg"></div>
    `;
    els.big = root.querySelector(".ha-laugh-big");
    els.sub = root.querySelector(".ha-laugh-sub");
    els.meter = root.querySelector(".ha-laugh-meter");
    els.levelFill = root.querySelector(".ha-laugh-level-fill");
    els.start = root.querySelector('[data-act="start"]');
    els.redo = root.querySelector('[data-act="redo"]');
    els.msg = root.querySelector(".ha-laugh-msg");
    els.bars = [];
    for (let i = 1; i <= 10; i++) {
      const bar = document.createElement("div");
      bar.className = "ha-laugh-bar";
      bar.textContent = i;
      els.meter.appendChild(bar);
      els.bars.push(bar);
    }
    els.start.addEventListener("click", () => (stream ? stopMic() : startMic()));
    els.redo.addEventListener("click", () => {
      locked = false; lockedValue = null;
      els.redo.style.display = "none";
      setMsg("", "");
      if (window.HackAugie.onFieldComplete) window.HackAugie.onFieldComplete("coding", null);
      startMic();
    });
  }

  function setMsg(text, type) {
    els.msg.textContent = text;
    els.msg.className = "ha-laugh-msg" + (type ? " ha-laugh-" + type : "");
  }

  async function startMic() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }  // steadier levels
      });
    } catch (err) {
      console.error(err);
      stream = null;
      return setMsg("Couldn't use your microphone. Allow mic access in the browser and try again.", "bad");
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    buffer = new Float32Array(analyser.fftSize);
    source.connect(analyser);

    phase = "calibrating";
    phaseStart = performance.now();
    noiseSum = 0; noiseCount = 0; smoothDb = -100;
    els.start.textContent = "⏹️ Cancel";
    els.big.textContent = "0.0s";
    els.sub.textContent = "🤫 Stay quiet... measuring the room";
    setMsg("", "");
    showSeconds(0);
    loop();
  }

  function stopMic() {
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (ctx) ctx.close().catch(() => {});
    stream = null; ctx = null; analyser = null;
    phase = "off";
    if (!els.start) return;
    els.start.textContent = "🎤 I'm ready to laugh";
    els.start.style.display = locked ? "none" : "";
    if (!locked) { els.sub.textContent = "Microphone off"; els.levelFill.style.width = "0%"; }
  }

  function readDb() {
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    const db = 20 * Math.log10(Math.sqrt(sum / buffer.length) || 1e-8);
    // fast rise, slow fall = a steady reading that doesn't flicker between "ha"s
    smoothDb += (db > smoothDb ? 0.5 : 0.08) * (db - smoothDb);
    return smoothDb;
  }

  function loop() {
    const now = performance.now();
    const db = readDb();
    const loud = db > threshold;

    if (phase === "calibrating") {
      noiseSum += db; noiseCount++;
      if (now - phaseStart >= CALIBRATE_MS) {
        threshold = Math.max(MIN_THRESHOLD_DB, noiseSum / noiseCount + ABOVE_NOISE_DB);
        phase = "waiting";
        els.sub.textContent = "😂 GO! Start laughing!";
      }
    } else if (phase === "waiting") {
      if (loud) { phase = "laughing"; laughStart = now; lastLoud = now; els.sub.textContent = "Keep going... don't stop!"; }
    } else if (phase === "laughing") {
      if (loud) lastLoud = now;
      const seconds = (lastLoud - laughStart) / 1000;
      els.big.textContent = Math.min(seconds, MAX_SECONDS).toFixed(1) + "s";
      showSeconds(seconds);
      if (seconds >= MAX_SECONDS) return lockIn(MAX_SECONDS, true);
      if (now - lastLoud > GAP_MS) {
        if (seconds < 0.6) {           // a cough or a bump, ignore it
          phase = "waiting";
          els.big.textContent = "0.0s";
          showSeconds(0);
          els.sub.textContent = "That wasn't a laugh. Try again, LAUGH!";
        } else {
          return lockIn(Math.max(1, Math.round(seconds)), false);
        }
      }
    }
    // live volume bar so people can see the mic is working
    const pct = Math.max(0, Math.min(100, (db - threshold + 20) * 3));
    els.levelFill.style.width = (phase === "calibrating" ? 0 : pct) + "%";
    els.levelFill.style.background = loud ? "#2a9d8f" : "#b9bfd6";
    rafId = requestAnimationFrame(loop);
  }

  function showSeconds(seconds) {
    els.bars.forEach((bar, i) => {
      const n = i + 1;
      bar.classList.toggle("ha-laugh-on", seconds >= n && n < 8);
      bar.classList.toggle("ha-laugh-hot", seconds >= n && n >= 8);
    });
  }

  async function lockIn(score, maxedOut) {
    locked = true;
    lockedValue = score;
    stopMic();
    showSeconds(score);
    els.big.textContent = score + "/10";
    els.sub.textContent = maxedOut ? "Okay, OKAY. Calm down. It's a 10." : "You stopped laughing. Score locked.";
    els.redo.style.display = "";
    setMsg("🤖 Gemma is judging you...", "");
    if (window.HackAugie.onFieldComplete) window.HackAugie.onFieldComplete("coding", score);

    const pool = score <= 3 ? FALLBACK.low : score <= 7 ? FALLBACK.mid : FALLBACK.high;
    const comment = await window.HackAugie.quickRoast(
      `A hackathon applicant rated their own coding skills ${score}/10 by laughing nonstop for ${score} seconds. Roast that rating.`,
      pool
    );
    if (locked && lockedValue === score) setMsg("🤖 " + comment, "ok");
  }

  window.HackAugie.fields.coding = {
    mount(container) { injectStyle(); root = container; build(); },
    reset() { locked = false; lockedValue = null; stopMic(); build(); },
    isComplete() { return locked; },
    getValue() { return lockedValue; }
  };
})();
