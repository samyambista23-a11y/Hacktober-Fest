/* phone.js - Phone Number field ("Slider")
   Registers itself as window.HackAugie.fields.phone */
(function () {
  window.HackAugie = window.HackAugie || {};
  window.HackAugie.fields = window.HackAugie.fields || {};

  const MAX = 9999999999;   // biggest 10-digit number
  const MAX_ZOOM = 9;       // after 9 zooms the slider moves by 1

  // ---------- State ----------
  let value = 0;            // the number the slider is on
  let zoom = 0;             // 0 = full range, 9 = most zoomed in
  let confirmed = false;
  let els = null;
  let outsideHandler = null;   // document listener for the "click outside" twist

  // ---------- Styles (injected once) ----------
  const CSS = `
  .ha-phone-root{--augie-blue:#1f3a93;--augie-gold:#f2b705;font-family:system-ui,sans-serif;color:#222;
    background:#fff;border:2px solid #e2e6f3;border-radius:12px;padding:16px;max-width:420px;box-sizing:border-box}
  .ha-phone-root *{box-sizing:border-box}
  .ha-phone-label{font-weight:700;font-size:1.1rem;color:var(--augie-blue);margin-bottom:10px}
  .ha-phone-display{font-size:1.8rem;font-weight:800;text-align:center;color:var(--augie-blue);
    background:#f4f6fc;border-radius:12px;padding:10px;margin-bottom:12px;font-variant-numeric:tabular-nums}
  .ha-phone-slider{width:100%;accent-color:var(--augie-gold);margin:6px 0}
  .ha-phone-info{font-size:.85rem;color:#555;text-align:center;margin-bottom:10px}
  .ha-phone-precision{font-weight:700;color:#222}
  .ha-phone-row{display:flex;gap:8px;flex-wrap:wrap}
  .ha-phone-btn{font:inherit;font-weight:700;padding:9px 14px;border-radius:12px;cursor:pointer;
    border:2px solid var(--augie-blue);background:#fff;color:var(--augie-blue)}
  .ha-phone-btn:disabled{opacity:.4;cursor:not-allowed}
  .ha-phone-confirm{border-color:var(--augie-gold);background:var(--augie-gold);color:#222;margin-left:auto}
  .ha-phone-msg{min-height:1.4em;margin-top:10px;font-weight:600}
  .ha-phone-msg.ha-phone-bad{color:#b3261e}
  .ha-phone-msg.ha-phone-good{color:#1b6e2d}
  `;
  function injectStyles() {
    if (document.getElementById("ha-phone-style")) return;
    const s = document.createElement("style");
    s.id = "ha-phone-style";
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
  const fmtNum = n => n.toLocaleString("en-US");
  const digits = n => String(n).padStart(10, "0");         // 10 digits, leading zeros
  function fmtPhone(n) {
    const s = digits(n);
    return "(" + s.slice(0, 3) + ") " + s.slice(3, 6) + "-" + s.slice(6);
  }
  function say(text, kind) {
    els.msg.textContent = text;
    els.msg.className = "ha-phone-msg" + (kind ? " ha-phone-" + kind : "");
  }

  // How many numbers the slider covers at a zoom level: 10 billion, 1 billion, 100 million...
  function spanFor(z) { return Math.pow(10, 10 - z); }

  // Re-aim the slider: centered on the current value, but never outside 0..MAX
  function applyRange() {
    const span = spanFor(zoom);
    let min = Math.max(0, value - Math.floor(span / 2));
    let max = min + span - 1;
    if (max > MAX) { max = MAX; min = MAX - span + 1; }
    els.slider.min = String(min);       // set min/max BEFORE value
    els.slider.max = String(max);
    els.slider.step = "1";
    els.slider.value = String(value);
    els.display.textContent = fmtPhone(value);
    els.precision.textContent = "Precision: ±" + fmtNum(Math.pow(10, 9 - zoom));
    els.range.textContent = "Slider covers " + fmtNum(min) + " to " + fmtNum(max);
    els.zoomIn.disabled = zoom >= MAX_ZOOM;
    els.zoomOut.disabled = zoom <= 0;
  }

  // ---------- Public API ----------
  window.HackAugie.fields.phone = {
    mount(container) {
      injectStyles();
      container.innerHTML = "";
      const root = el("div", "ha-phone-root");
      root.appendChild(el("div", "ha-phone-label", "Phone Number"));

      els = { root };
      els.display = el("div", "ha-phone-display");
      els.slider = el("input", "ha-phone-slider");
      els.slider.type = "range";
      els.slider.setAttribute("aria-label", "Phone number slider");
      els.precision = el("div", "ha-phone-info ha-phone-precision");
      els.range = el("div", "ha-phone-info");

      const row = el("div", "ha-phone-row");
      els.zoomIn = el("button", "ha-phone-btn", "🔍 Zoom In");
      els.zoomOut = el("button", "ha-phone-btn", "Zoom Out");
      els.confirm = el("button", "ha-phone-btn ha-phone-confirm", "Confirm number");
      [els.zoomIn, els.zoomOut, els.confirm].forEach(b => (b.type = "button"));
      row.append(els.zoomIn, els.zoomOut, els.confirm);
      els.msg = el("div", "ha-phone-msg");

      root.append(els.display, els.slider, els.precision, els.range, row, els.msg);
      container.appendChild(root);

      // Dragging the slider changes the number (and un-confirms it)
      els.slider.addEventListener("input", () => {
        value = Number(els.slider.value);
        confirmed = false;
        els.display.textContent = fmtPhone(value);
        say("", "");
      });
      els.zoomIn.addEventListener("click", () => { if (zoom < MAX_ZOOM) { zoom++; applyRange(); } });
      els.zoomOut.addEventListener("click", () => { if (zoom > 0) { zoom--; applyRange(); } });
      els.confirm.addEventListener("click", () => {
        confirmed = true;
        say("✅ Number confirmed: " + fmtPhone(value), "good");
        if (window.HackAugie.onFieldComplete) window.HackAugie.onFieldComplete("phone", digits(value));
      });

      // The twist: pressing anywhere OUTSIDE this field zooms all the way out (value stays)
      if (outsideHandler) document.removeEventListener("pointerdown", outsideHandler);
      outsideHandler = function (e) {
        if (!els || !document.body.contains(els.root)) return;
        if (els.root.contains(e.target) || zoom === 0) return;
        zoom = 0;
        applyRange();
        say("Oops. Zoom reset. Should've stayed inside the box.", "bad");
      };
      document.addEventListener("pointerdown", outsideHandler);

      this.reset();
    },

    reset() {
      value = 0;
      zoom = 0;
      confirmed = false;
      if (!els) return;
      say("", "");
      applyRange();
    },

    isComplete() { return confirmed; },
    getValue() { return digits(value); }
  };
})();
