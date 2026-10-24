/* dob.js - Date of Birth field ("Slot Machine")
   Registers itself as window.HackAugie.fields.dob */
(function () {
  window.HackAugie = window.HackAugie || {};
  window.HackAugie.fields = window.HackAugie.fields || {};

  // ---------- Data for the three reels ----------
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);        // 1..31
  const YEARS = Array.from({ length: 10 }, (_, i) => 2000 + i);    // 2000..2009
  const REELS = [
    { name: "Month", values: MONTHS },
    { name: "Day", values: DAYS },
    { name: "Year", values: YEARS }
  ];

  // ---------- State ----------
  let held = [false, false, false];   // which reels are held
  let index = [null, null, null];     // current position of each reel (null = never spun)
  let locked = "";                    // "YYYY-MM-DD" once a valid date is locked in
  let spinning = false;
  let spinId = 0;                     // changes on reset so old spin timers stop themselves
  let els = null;                     // references to our DOM elements

  // ---------- Styles (injected once) ----------
  const CSS = `
  .ha-dob-root{--augie-blue:#1f3a93;--augie-gold:#f2b705;font-family:system-ui,sans-serif;color:#222;
    background:#fff;border:2px solid #e2e6f3;border-radius:12px;padding:16px;max-width:420px;box-sizing:border-box}
  .ha-dob-root *{box-sizing:border-box}
  .ha-dob-label{font-weight:700;font-size:1.1rem;color:var(--augie-blue);margin-bottom:10px}
  .ha-dob-howto{font-size:.88rem;color:#555;margin:-4px 0 12px;line-height:1.45}
  .ha-dob-machine{background:var(--augie-blue);border-radius:12px;padding:12px}
  .ha-dob-reels{display:flex;gap:8px}
  .ha-dob-reel{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
  .ha-dob-window{height:60px;background:#fff;border:3px solid var(--augie-gold);border-radius:8px;
    display:flex;align-items:center;justify-content:center;text-align:center;font-weight:800;overflow:hidden}
  .ha-dob-window.ha-dob-held{background:#fff3c4}
  .ha-dob-spinning .ha-dob-value{animation:ha-dob-jitter .1s linear infinite;filter:blur(1px)}
  @keyframes ha-dob-jitter{0%{transform:translateY(-8px)}50%{transform:translateY(8px)}100%{transform:translateY(-8px)}}
  .ha-dob-hold{font:inherit;font-weight:700;padding:6px 2px;border-radius:8px;cursor:pointer;
    border:2px solid var(--augie-gold);background:transparent;color:#fff}
  .ha-dob-hold.ha-dob-on{background:var(--augie-gold);color:#222}
  .ha-dob-pull{font:inherit;font-weight:900;font-size:1.5rem;letter-spacing:2px;width:100%;margin-top:12px;
    padding:12px;border:0;border-radius:12px;cursor:pointer;background:var(--augie-gold);color:#222;
    box-shadow:0 5px 0 #b88a00}
  .ha-dob-pull:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #b88a00}
  .ha-dob-pull:disabled{opacity:.6;cursor:not-allowed}
  .ha-dob-lock{font:inherit;font-weight:700;margin-top:12px;padding:10px 16px;border:0;border-radius:12px;
    cursor:pointer;background:var(--augie-blue);color:#fff}
  .ha-dob-msg{min-height:1.4em;margin-top:10px;font-weight:600}
  .ha-dob-msg.ha-dob-bad{color:#b3261e}
  .ha-dob-msg.ha-dob-good{color:#1b6e2d}
  `;
  function injectStyles() {
    if (document.getElementById("ha-dob-style")) return;
    const s = document.createElement("style");
    s.id = "ha-dob-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- Small helpers ----------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const rand = n => Math.floor(Math.random() * n);
  const pad = n => String(n).padStart(2, "0");

  function say(text, kind) {
    els.msg.textContent = text;
    els.msg.className = "ha-dob-msg" + (kind ? " ha-dob-" + kind : "");
  }

  // Redraw one reel (its value and its HOLD button)
  function show(i) {
    els.values[i].textContent = index[i] === null ? "?" : REELS[i].values[index[i]];
    els.windows[i].classList.toggle("ha-dob-held", held[i]);
    els.holds[i].classList.toggle("ha-dob-on", held[i]);
    els.holds[i].textContent = held[i] ? "🔒 HELD" : "HOLD";
    els.holds[i].setAttribute("aria-pressed", held[i]);
  }

  // ---------- Actions ----------
  function pull() {
    if (spinning) return;
    if (held.every(Boolean)) {
      say("Every reel is held. The lever does nothing. Release one!", "bad");
      return;
    }
    locked = "";                       // pulling again un-locks any locked date
    say("", "");
    spinning = true;
    els.pull.disabled = true;
    const token = ++spinId;
    let remaining = held.filter(h => !h).length;

    REELS.forEach((reel, i) => {
      if (held[i]) return;             // held reels do not spin
      els.windows[i].classList.add("ha-dob-spinning");
      // flicker through random values...
      const flicker = setInterval(() => {
        if (token !== spinId) return clearInterval(flicker);
        index[i] = rand(reel.values.length);
        show(i);
      }, 70);
      // ...then land on a final random value (each reel stops a little later)
      setTimeout(() => {
        clearInterval(flicker);
        if (token !== spinId) return;
        index[i] = rand(reel.values.length);
        els.windows[i].classList.remove("ha-dob-spinning");
        show(i);
        if (--remaining === 0) {
          spinning = false;
          els.pull.disabled = false;
        }
      }, 1000 + i * 250);
    });
  }

  function toggleHold(i) {
    if (spinning) return;
    held[i] = !held[i];
    show(i);
  }

  function lockIn() {
    if (spinning) return;
    if (index.includes(null)) {
      say("Pull the lever first. The reels are blank.", "bad");
      return;
    }
    const m = index[0], d = DAYS[index[1]], y = YEARS[index[2]];
    // JavaScript rolls impossible dates over (Feb 31 -> Mar 3), so compare to catch them
    const test = new Date(y, m, d);
    if (test.getFullYear() !== y || test.getMonth() !== m || test.getDate() !== d) {
      locked = "";
      say("Invalid date. Were you even born?", "bad");
      return;
    }
    locked = y + "-" + pad(m + 1) + "-" + pad(d);
    say("🎰 JACKPOT! Locked in: " + locked, "good");
    if (window.HackAugie.onFieldComplete) window.HackAugie.onFieldComplete("dob", locked);
  }

  // ---------- Public API ----------
  window.HackAugie.fields.dob = {
    mount(container) {
      injectStyles();
      container.innerHTML = "";
      const root = el("div", "ha-dob-root");
      root.appendChild(el("div", "ha-dob-label", "Date of Birth"));
      root.appendChild(el("div", "ha-dob-howto", "🎰 Pull the lever. Hit HOLD on any reel that lands on the right value, then keep pulling for the rest. When all three are right, lock it in."));

      const machine = el("div", "ha-dob-machine");
      const reelsRow = el("div", "ha-dob-reels");
      els = { root, values: [], windows: [], holds: [] };

      REELS.forEach((reel, i) => {
        const col = el("div", "ha-dob-reel");
        const win = el("div", "ha-dob-window");
        const val = el("span", "ha-dob-value", "?");
        win.appendChild(val);
        const hold = el("button", "ha-dob-hold", "HOLD");
        hold.type = "button";
        hold.setAttribute("aria-label", "Hold " + reel.name);
        hold.addEventListener("click", () => toggleHold(i));
        col.append(win, hold);
        reelsRow.appendChild(col);
        els.values.push(val);
        els.windows.push(win);
        els.holds.push(hold);
      });

      els.pull = el("button", "ha-dob-pull", "PULL");
      els.pull.type = "button";
      els.pull.addEventListener("click", pull);
      machine.append(reelsRow, els.pull);

      els.lock = el("button", "ha-dob-lock", "Lock in date");
      els.lock.type = "button";
      els.lock.addEventListener("click", lockIn);
      els.msg = el("div", "ha-dob-msg");

      root.append(machine, els.lock, els.msg);
      container.appendChild(root);
      this.reset();
    },

    reset() {
      spinId++;                         // cancels any spin in progress
      spinning = false;
      held = [false, false, false];
      index = [null, null, null];
      locked = "";
      if (!els) return;
      els.pull.disabled = false;
      REELS.forEach((_, i) => { els.windows[i].classList.remove("ha-dob-spinning"); show(i); });
      say("", "");
    },

    isComplete() { return locked !== ""; },
    getValue() { return locked; }
  };
})();
