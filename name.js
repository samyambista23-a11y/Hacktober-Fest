// =====================================================
//  FIELD: Name — Picture Keyboard
//  Every key is an emoji. You type the FIRST LETTER of
//  what the picture shows. The keyboard is shuffled
//  once, at the start. Backspace is a 🗑️ hidden somewhere.
// =====================================================
(function () {
  window.HackAugie = window.HackAugie || {};
  window.HackAugie.fields = window.HackAugie.fields || {};

  const LETTER_KEYS = [
    { l: "A", e: "🍎" }, { l: "B", e: "🐝" }, { l: "C", e: "🐱" }, { l: "D", e: "🐶" },
    { l: "E", e: "🥚" }, { l: "F", e: "🐸" }, { l: "G", e: "🍇" }, { l: "H", e: "🏠" },
    { l: "I", e: "🍦" }, { l: "J", e: "🧃" }, { l: "K", e: "🔪" }, { l: "L", e: "🍋" },
    { l: "M", e: "🌙" }, { l: "N", e: "👃" }, { l: "O", e: "🐙" }, { l: "P", e: "🍕" },
    { l: "Q", e: "👑" }, { l: "R", e: "🌈" }, { l: "S", e: "🐍" }, { l: "T", e: "🌮" },
    { l: "U", e: "☂️" }, { l: "V", e: "🎻" }, { l: "W", e: "🍉" }, { l: "X", e: "🩻" },
    { l: "Y", e: "🪀" }, { l: "Z", e: "🦓" },
    { l: " ", e: "🚀" }  // "Space" 🚀
  ];
  const BACKSPACE = { l: "BACK", e: "🗑️" };

  const FALLBACK_COMMENTS = [
    "Took you that long to spell your own name? Bold of you to sign up for a hackathon.",
    "Your typing speed just set computer science back 30 years.",
    "Congrats on spelling your name. Only five more fields of humiliation.",
    "A toddler with a crayon would've finished by now.",
    "Your parents gave you that name and you STILL couldn't find the letters?",
    "Even the trash can key was judging you."
  ];

  const CSS = `
    .ha-name-display { font-size: 26px; font-weight: 800; min-height: 48px; padding: 8px 12px;
      border: 2px dashed #bbb; border-radius: 12px; margin-bottom: 8px; letter-spacing: 1px; color: #1f3a93; }
    .ha-name-display.ha-name-empty { color: #aaa; font-weight: 500; font-size: 18px; }
    .ha-name-hint { font-size: 13px; color: #777; margin: 0 0 10px; }
    .ha-name-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 12px; }
    .ha-name-key { font-size: 26px; padding: 8px 0; border: 1px solid #ddd; border-radius: 10px;
      background: #fafafa; cursor: pointer; transition: transform .08s; }
    .ha-name-key:hover { background: #fff6d6; transform: scale(1.08); }
    .ha-name-key:disabled { opacity: .4; cursor: not-allowed; transform: none; }
    .ha-name-btn { padding: 10px 16px; font-weight: 700; border: none; border-radius: 12px;
      background: #1f3a93; color: #fff; cursor: pointer; margin-right: 8px; }
    .ha-name-btn.ha-name-secondary { background: #e5e7ef; color: #222; }
    .ha-name-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ha-name-msg { margin-top: 10px; font-weight: 600; min-height: 1.3em; }
    .ha-name-msg.ha-name-ok { color: #2a9d8f; }
    .ha-name-msg.ha-name-bad { color: #d62828; }
  `;

  let root = null;
  let state = freshState();

  function freshState() {
    return { typed: "", done: false, busy: false, msg: "", msgType: "", order: shuffledKeys() };
  }

  function shuffledKeys() {
    const keys = [...LETTER_KEYS, BACKSPACE];
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys;
  }

  function prettyName(raw) {
    return raw.toLowerCase().replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  function injectStyle() {
    if (document.getElementById("ha-name-style")) return;
    const s = document.createElement("style");
    s.id = "ha-name-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function pressKey(key) {
    if (state.done || state.busy) return;
    if (key.l === "BACK") state.typed = state.typed.slice(0, -1);
    else if (state.typed.length < 40) state.typed += key.l;
    state.msg = "";
    render();
  }

  async function submitName() {
    const name = prettyName(state.typed);
    if (name.replace(/\s/g, "").length < 2) {
      state.msg = "That's not a name. That's a cry for help.";
      state.msgType = "bad";
      return render();
    }
    state.busy = true;
    state.msg = "Gemma is reading your name...";
    state.msgType = "";
    render();

    const comment = await window.HackAugie.quickRoast(
      `Roast a hackathon applicant named "${name}" for how painfully long it took them to type their own name on an emoji keyboard.`,
      FALLBACK_COMMENTS
    );

    state.busy = false;
    state.done = true;
    state.msg = "🤖 " + comment;
    state.msgType = "ok";
    render();
    if (window.HackAugie.onFieldComplete) window.HackAugie.onFieldComplete("name", name);
  }

  function render() {
    if (!root) return;
    const shown = prettyName(state.typed);
    root.innerHTML = `
      <div class="ha-name-display ${shown ? "" : "ha-name-empty"}">${shown ? escapeHtml(shown) : "Your name will appear here"}</div>
      <p class="ha-name-hint">Each picture types the first letter of what it shows. 🚀 = space. 🗑️ = delete.</p>
      <div class="ha-name-grid"></div>
      <button class="ha-name-btn" data-act="submit" ${state.done || state.busy ? "disabled" : ""}>✅ That's my name</button>
      ${state.done ? `<button class="ha-name-btn ha-name-secondary" data-act="edit">✏️ Change it</button>` : ""}
      <div class="ha-name-msg ${state.msgType ? "ha-name-" + state.msgType : ""}">${escapeHtml(state.msg)}</div>
    `;

    const grid = root.querySelector(".ha-name-grid");
    state.order.forEach(key => {
      const b = document.createElement("button");
      b.className = "ha-name-key";
      b.textContent = key.e;
      b.disabled = state.done || state.busy;
      b.addEventListener("click", () => pressKey(key));
      grid.appendChild(b);
    });

    root.querySelector('[data-act="submit"]').addEventListener("click", submitName);
    const edit = root.querySelector('[data-act="edit"]');
    if (edit) edit.addEventListener("click", () => {
      state.done = false;
      state.msg = "Fine. Try again.";
      state.msgType = "";
      render();
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.HackAugie.fields.name = {
    mount(container) { injectStyle(); root = container; render(); },
    reset() { state = freshState(); render(); },
    isComplete() { return state.done; },
    getValue() { return prettyName(state.typed); }
  };
})();
