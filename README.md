# ⚔️ HackAugie 2027: The Registration Form From Hell

> **Wanna be a hacker? Register for HackAugie 2027 Now!!!**
> *(You have 5 minutes. Good luck. You'll need it.)*

A deliberately rage-inducing registration form for **HackAugie 2027**, Augustana College's Viking-themed hackathon. Every field is annoying in its own special way, a 5-minute timer is always ticking, and if it hits zero, **everything resets**. It's frustrating, it's unfair, and it's completely possible to finish... if you keep your cool.

Built in 90 minutes for the **"Unhinged"** theme at **Hacktoberfest Hack Day Rock Island x Google Developers Group @ Augustana College**, competing for **Best Use of Gemma 4**.

---

## 🎯 The Idea

Everyone has suffered through a terrible online form. We asked: *what if one was terrible on purpose?*

The rule we built around: **annoying, but always beatable.** Every field has one infuriating twist and one escape hatch. The joke only works if people can actually finish, so they keep trying, keep failing, and keep getting roasted along the way.

---

## 🪓 The Gauntlet

| # | Field | The Torture | The Escape Hatch |
|---|---|---|---|
| I | **Full Name** | Every key is an emoji. Type the *first letter* of what the picture shows. 🍎 = A, 🔪 = K, 👑 = Q. Space is 🚀. Delete is a 🗑️ hidden somewhere. | Each picture always means the same letter. |
| II | **Date of Birth** | A three-reel slot machine for month, day, and year. Impossible dates like February 31 get rejected. | **HOLD** any reel that lands right, then keep pulling. |
| III | **Phone Number** | One slider from 0 to 9,999,999,999. Every pixel jumps by millions. Click outside the box and the zoom resets. | A 🔍 **Zoom In** button narrows the slider until it moves by 1. |
| IV | **Coding Skills (1–10)** | No typing. You **laugh out loud, nonstop**. Every second of laughing = 1 point. Stop laughing and your score locks. | Short pauses between "ha"s don't count as stopping. |
| V | **Viking Verification** | A CAPTCHA whose "I'm not a robot" checkbox runs from your mouse, then a grid asking you to pick the exact **Augie Blue & Gold** among sneaky decoy shades. | Sample swatches to compare, and a mercy pass after 3 fails. |
| VI | **Password** | Your password is a **drawing of your face**. Then redraw it from memory. It must be a **90% match**. | Lets you through after 3 failed attempts. |

### 😈 Bonus Suffering

- **⏳ 5-minute timer** that wipes the entire form when it runs out
- **🚨 Last-minute panic mode:** the screen glows red and alarm music kicks in
- **⭐ "Rate your experience" pop-up** at 2:30 left. Give it 1–3 stars? *"Wrong Answer, Try Again."* Give it 4–5? *"Good Boy... Are you lying?"* Say yes and you start over.
- **🤡 Wrong color = public humiliation:** a white flash, the page shakes, and a meme GIF slams onto the screen with a mocking sound effect
- **💀 Time's-up roasts**, like *"Aww. It's okay. Not everyone has what it takes to become a hacker."*
- **🎵 Background music** for the entire ordeal

---

## 🤖 How We Use Gemma 4

Gemma is the voice of the form: a sarcastic Viking gatekeeper that roasts you based on what you actually did.

- **Name roast:** comments on your name and how long it took you to type it
- **Coding skill roast:** reacts to the score you laughed your way to
- **CAPTCHA roast:** mocks you every time you pick the wrong shade of blue or gold
- **Password roast:** insults your failed face redraw, using your actual match percentage

Every roast is generated live with **`gemma-4-26b-a4b-it`** through the **Gemini API**. Speed matters in a 5-minute form, so each request gets a short time limit. If Gemma takes too long, a hand-written backup roast appears instantly, so the user is never left waiting. Gemma's internal "thinking" is filtered out so only the final one-liner is shown.

---

## 🛠️ Tech Stack

- **Plain HTML, CSS, and JavaScript.** No frameworks, no build tools, no `npm install`.
- **Gemma 4** via the **Gemini API** (free tier through Google AI Studio)
- **Web Audio API** for the laugh meter, using live microphone volume with background-noise calibration
- **HTML Canvas** for face drawing and the drawing-comparison algorithm
- **Google Fonts:** Pirata One (Norse-style headings) and Montserrat

The whole thing is free to run.

---

## 🚀 Run It Yourself

1. **Get a free Gemini API key** at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. **Download or clone** this repo.
3. Open `index.html` in a code editor and find this line:
   ```js
   const GEMINI_API_KEY = "PASTE_YOUR_KEY_HERE";
   ```
   Replace `PASTE_YOUR_KEY_HERE` with your key, keeping the quotes.
4. **Double-click `index.html`** to open it in Google Chrome.
5. Click **Begin Registration**, allow microphone access when asked, and suffer.

> ⚠️ **Never commit your real API key to GitHub.** Anyone who views the page source can copy it. Keep the placeholder in the repo and only paste your key locally.

**No API key?** The form still works. Every roast falls back to the built-in backup lines.

---

## 📁 Project Structure

```
hackaugie/
├── index.html      # Main page: layout, timer, music, rating pop-up, Gemma connection
├── name.js         # I.   Emoji picture keyboard
├── dob.js          # II.  Slot machine date of birth
├── phone.js        # III. Zoomable phone number slider
├── laugh.js        # IV.  Laugh-to-rate coding skill meter
├── captcha.js      # V.   Viking Verification CAPTCHA + meme punishments
├── password.js     # VI.  Draw-your-face password + redraw match check
└── assets/         # Logo, background art, music, and GIFs
```

### 🧩 Plug-In Architecture

We built this as a team of two in 90 minutes, so we split the work without stepping on each other. Every field lives in its own file and plugs into the page the same way:

```js
window.HackAugie.fields.dob = {
  mount(container) { /* build the field inside this div */ },
  reset()          { /* return to the starting state */ },
  isComplete()     { /* true when the field is done */ },
  getValue()       { /* the field's value */ }
};
```

The main page loads each file, mounts it into its own section, tracks completion, and calls `reset()` on every field when time runs out. Each field injects its own CSS with a unique prefix (`ha-name-`, `ha-dob-`, and so on), so styles never clash. Merging our two halves was literally dropping files into one folder.

---

## 🎛️ Tuning the Difficulty

Every knob is a constant at the top of its file:

| What | Where | Setting |
|---|---|---|
| Timer length | `index.html` | `TIMER_MINUTES` |
| When the rating pop-up appears | `index.html` | `RATE_POPUP_AT` (seconds left) |
| Gemma model | `index.html` | `GEMMA_MODEL` |
| Password strictness | `password.js` | `LENIENCY` (higher = easier) |
| Laugh sensitivity | `laugh.js` | `ABOVE_NOISE_DB`, `GAP_MS` |
| CAPTCHA mercy rule | `captcha.js` | `MAX_FAILS` |

---

## 🔒 Privacy

- **Microphone audio never leaves your browser.** The laugh meter only measures volume locally.
- **Face drawings never leave your browser.** The 90% match check runs entirely on your device.
- **Gemma only receives short text prompts**, like your typed name or your score. No audio, no images.
- **Nothing is saved.** There is no database. Refresh the page and it's all gone. (Kind of like when the timer runs out.)

---

## 🎨 Credits

- Built by **Samyam Bista** and teammate at Hacktoberfest Hack Day Rock Island x GDG @ Augustana College
- HackAugie logo and background artwork from **HackAugie 2026**
- Meme GIFs and audio clips belong to their original creators and are used here for parody
- Roasts powered by **Gemma 4** from Google

---

<p align="center"><b>Only true Vikings make it through.</b> ⚔️</p>
