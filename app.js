/* ============ Drop Lab ============
   CUBES word problems for Year 3 division, with bins that show the answer.
   The routine is the tutor's card, letter for letter: Circle the numbers,
   Underline the question, Box the key words, Eliminate extra information and
   Evaluate what steps to take, Solve and check. Underneath sits the equal-groups
   schema (TOTAL / GROUPS / EACH — which one is missing?), which is what actually
   decides the sum. The check is HIS multiplication, typed, never computed for him.
   Physics-free on purpose: the dealing animation is CSS, so the count is always right.
   A ScupperLab production — vanilla JS, no dependencies, offline-first. */
"use strict";

const P = self.DropLabProblems;
const ROUND_LEN = 6;
const LETTERS = ["C", "U", "B", "E", "S"];
const STEP_INFO = {
  C:  { letter: "C", title: "Circle the numbers",   instr: "Tap every number in the request.",                         done: "Done circling" },
  U:  { letter: "U", title: "Underline the question", instr: "Tap the sentence that ASKS something.",                  done: "Done underlining" },
  B:  { letter: "B", title: "Box the key words",     instr: "Tap the words that tell you what to DO with the numbers.", done: "Done boxing" },
  E:  { letter: "E", title: "Eliminate extra info",  instr: "Tap any sentence the question doesn't need. It gets crumpled.", done: "Done crossing out" },
  E2: { letter: "E", title: "Evaluate: what steps?", instr: "What is the question asking for? Then build the sum.",   done: "That's my plan" },
  S:  { letter: "S", title: "Solve and check",       instr: "Type the answer, then CHECK it by multiplying back. Only then do we drop.", done: "Run the experiment" },
};

/* ---------- store ---------- */
const STORE_KEY = "droplab.v1";
function loadStore() {
  const base = {
    muted: false,
    tier: 1,
    circleAll: true,               // the tutor's way: circle every number, decide later at E
    career: { stars: 0, rounds: 0, clean: 0 },
    best: { 1: 0, 2: 0, 3: 0, 4: 0 },
    letters: { C: [0, 0], U: [0, 0], B: [0, 0], E: [0, 0], S: [0, 0] },   // [stars, attempts] all-time
    introSeen: false,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return Object.assign(base, raw, {
      career: Object.assign(base.career, raw.career || {}),
      best: Object.assign(base.best, raw.best || {}),
      letters: Object.assign(base.letters, raw.letters || {}),
    });
  } catch (e) { return base; }
}
let store = loadStore();
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } }

/* ---------- sound (tiny synth, same pattern as the other apps) ---------- */
let actx = null;
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx && actx.state !== "running") actx.resume().catch(() => {});
  return actx;
}
function tone(freq, dur, type, gain, delay, slideTo) {
  if (store.muted) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseBurst(dur, gain, delay, hp, lp) {
  if (store.muted) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + (delay || 0);
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const f1 = c.createBiquadFilter(); f1.type = "highpass"; f1.frequency.value = hp || 300;
  const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = lp || 4000;
  const g = c.createGain(); g.gain.setValueAtTime(gain || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f1).connect(f2).connect(g).connect(c.destination); src.start(t0);
}
const sfx = {
  tap()      { tone(360, 0.05, "square", 0.05); },
  circle()   { tone(520, 0.08, "sine", 0.07, 0, 780); },
  underline(){ tone(440, 0.12, "sine", 0.06, 0, 660); },
  box()      { tone(300, 0.06, "square", 0.06); tone(300, 0.06, "square", 0.06, 0.08); },
  crumple()  { noiseBurst(0.22, 0.12, 0, 900, 5000); },
  thunk()    { tone(140, 0.16, "triangle", 0.18, 0, 90); noiseBurst(0.06, 0.06, 0, 200, 900); },
  drop()     { tone(700, 0.05, "sine", 0.04, 0, 400); },
  land()     { noiseBurst(0.04, 0.05, 0, 500, 3000); },
  good()     { tone(620, 0.14, "triangle", 0.1); tone(830, 0.16, "triangle", 0.09, 0.09); },
  verified() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.1, i * 0.09)); },
  miss()     { tone(220, 0.24, "sawtooth", 0.08, 0, 120); },
  cheer()    { noiseBurst(0.8, 0.08, 0, 2500, 1200); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "triangle", 0.1, 0.1 + i * 0.11)); },
  whistle()  { tone(880, 0.25, "sine", 0.08, 0, 1180); },
};

/* ---------- helpers ---------- */
const app = document.getElementById("app");
const fxLayer = document.getElementById("fx-layer");
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function popText(x, y, text, gold) {
  const p = el("div", "pop-text" + (gold ? " gold" : ""), text);
  p.style.left = x + "px"; p.style.top = y + "px";
  fxLayer.appendChild(p);
  setTimeout(() => p.remove(), 1150);
}
function stopSpeech() { try { speechSynthesis.cancel(); } catch (e) { /* no tts */ } }
function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find((x) => /en[-_]AU/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.rate = 0.92;
    speechSynthesis.speak(u);
  } catch (e) { /* no tts */ }
}

/* ---------- Trawley Coin bridge (same-origin, same pattern as the other apps) ---------- */
const TRAWLEY_BASE = new URL("../trawley-coin/", location.href).href;
const TRAWLEY_QUEUE_KEY = "droplab.trawley.pending";
let trawleyPromise = null;
function trawley() {
  if (!trawleyPromise) {
    trawleyPromise = (async () => {
      if (window.TRAWLEY_FIREBASE_CONFIG === undefined) {
        await new Promise((res, rej) => {
          const sc = document.createElement("script");
          sc.src = TRAWLEY_BASE + "shared/config.js";
          sc.onload = res;
          sc.onerror = () => rej(new Error("Trawley Coin isn't reachable"));
          document.head.appendChild(sc);
        });
      }
      const mod = await import(TRAWLEY_BASE + "shared/store.js");
      const st = await mod.createStore();
      return { mod, st };
    })().catch((e) => { trawleyPromise = null; throw e; });
  }
  return trawleyPromise;
}
async function trawleySend(entry) {
  const { mod, st } = await trawley();
  if (st.mode !== "demo" && st.needsSetup()) throw new Error("needs-code");
  await mod.submitRequest(st, entry);
}
function trawleyQueue(entry) {
  try {
    const q = JSON.parse(localStorage.getItem(TRAWLEY_QUEUE_KEY) || "[]");
    q.push(entry);
    localStorage.setItem(TRAWLEY_QUEUE_KEY, JSON.stringify(q));
  } catch (e) { /* ignore */ }
}
async function trawleyFlush() {
  let q = [];
  try { q = JSON.parse(localStorage.getItem(TRAWLEY_QUEUE_KEY) || "[]"); } catch (e) { return; }
  if (!q.length) return;
  const left = [];
  for (const entry of q) {
    try { await trawleySend(entry); } catch (e) { left.push(entry); }
  }
  try { localStorage.setItem(TRAWLEY_QUEUE_KEY, JSON.stringify(left)); } catch (e) { /* ignore */ }
}
window.addEventListener("online", () => trawleyFlush());

/* ---------- key word card: what the boxed phrase MEANS (schema, not keyword→operation) ---------- */
function keyCard(p) {
  const lines = [];
  if (p.selfIncluded) lines.push(["himself and friends", "He counts too — add him to the number of people."]);
  if (p.baseType === "SHARE" && !p.selfIncluded) lines.push(["shared equally between", "SHARING — deal them out one at a time, round and round, so every bin gets the same."]);
  if (p.baseType === "GROUP") lines.push(["into each bin", "GROUPING — fill one bin to that many, then start the next bin."]);
  if (p.type === "TOTAL") lines.push(["in each bin + altogether", "You're told the bins AND what's in each — so the question wants the TOTAL."]);
  if (p.type === "FRACTION") lines.push([`${p.frac.word} of`, `A ${p.frac.word} of something means share it into ${p.K} equal bins and take ONE bin.`]);
  if (p.type.endsWith("_REM")) lines.push(["left over", "LEFTOVERS — whatever can't be shared out fairly sits on the bench."]);
  return lines;
}

/* ---------- lessons (same engine as Rail Runner: captioned steps + optional Dad voice) ---------- */
function demoProblem() {
  const sentences = [
    { raw: "The Drop Lab got 24 rubber ducks for today's test.", role: "setup" },
    { raw: "The lab also has 7 spare crash helmets on the shelf.", role: "distractor" },
    { raw: "Henry packs 4 rubber ducks [into each bin].", role: "condition" },
    { raw: "[How many bins] does he fill?", role: "question" },
  ].map((s) => Object.assign({ text: s.raw.replace(/[\[\]]/g, "") }, s));
  const p = { tier: 2, type: "GROUP", baseType: "GROUP", schema: "GROUP", obj: P.OBJECTS[0], selfIncluded: false,
    N: 24, K: 4, G: undefined, q: 6, r: 0, frac: null, answer: 6, slots: [24, 4], clean: false, sentences };
  p.chips = P.tokenise(p);
  p.text = sentences.map((s) => s.text).join(" ");
  return p;
}
const LESSON = {
  kicker: "The CUBES card",
  title: "How Professor Bin checks a request 🧪",
  audio: "lesson",
  steps: [
    { cap: "This is an Experiment Request. Professor Bin will NOT drop a single duck until it has been CUBES-checked — last time someone skipped the check, the lab filled with foam. Five steps, one letter each. Same card as your tutor's.",
      mark: () => {} },
    { cap: "C — CIRCLE THE NUMBERS. All of them, even the ones you might not need. Deciding what matters comes later — for now, just catch every number.",
      mark: (D) => { D.circled = new Set(D.p.chips.filter((c) => c.isNumber).map((c) => c.id)); D.lit = "C"; } },
    { cap: "U — UNDERLINE THE QUESTION. It's the sentence that ASKS something. Usually it has a question mark, but not always — sometimes it says 'Work out…'",
      mark: (D) => { D.underlined = D.p.sentences.findIndex((s) => s.role === "question"); D.lit = "U"; } },
    { cap: "B — BOX THE KEY WORDS: the words that tell you what to DO. 'Into each bin' and 'How many bins' — that means GROUPING: fill one bin to 4, then start the next, and count the bins.",
      mark: (D) => { D.boxed = new Set(D.p.chips.filter((c) => c.phrase).map((c) => c.id)); D.lit = "B"; } },
    { cap: "E — ELIMINATE anything the question never asks about. 7 crash helmets? The question is about bins of ducks. Crumple it. Then EVALUATE: what's missing — how many in EACH, how many BINS, or the TOTAL? Bins. So the sum is 24 ÷ 4.",
      mark: (D) => { D.crumpled = new Set([1]); D.plan = "24 ÷ 4 = ?"; D.lit = "E"; } },
    { cap: "S — SOLVE: 24 ÷ 4 = 6. Then CHECK by going backwards: 6 bins × 4 ducks = 24. That's the number we started with, so it's right. Only NOW do the ducks drop — watch.",
      mark: (D) => { D.plan = "24 ÷ 4 = 6   check: 6 × 4 = 24 ✓"; D.lit = "S"; D.runDrop = true; } },
    { cap: "Your turn, Lab Chief. The card lights up each letter as you go, and a star for every step you get right first time. Sometimes there is NOTHING to cross out — say so. Ready?",
      mark: (D) => { D.lit = null; } },
  ],
};

function renderLesson(thenPlay) {
  G = null;
  stopSpeech();
  app.innerHTML = "";
  let voice = null;
  function playVoice(i) {
    if (voice) { voice.pause(); voice = null; }
    if (store.muted) { setReplay(false); return; }
    const a = new Audio(`audio/${LESSON.audio}-${i}.m4a`);
    voice = a;
    a.addEventListener("ended", () => setReplay(false));
    a.addEventListener("error", () => setReplay(false));
    setReplay(true);
    a.play().catch(() => setReplay(false));
  }
  function setReplay(playing) {
    const b = document.getElementById("replay-btn");
    if (b) b.textContent = playing ? "🔊 Playing…" : "🔊 Say it again";
  }

  const back = el("button", "coach-back", "✕");
  back.addEventListener("click", () => { if (voice) voice.pause(); sfx.tap(); renderHome(); });
  app.appendChild(back);

  const game = el("div", "game");
  const title = el("div", "card title-card");
  title.innerHTML = `<div class="kicker">${LESSON.kicker}</div><div class="h">${LESSON.title}</div>`;
  game.appendChild(title);
  const cap = el("div", "card cap-card"); cap.id = "lesson-cap"; game.appendChild(cap);

  const D = { p: demoProblem(), circled: new Set(), underlined: null, boxed: new Set(), crumpled: new Set(), lit: null, plan: "", runDrop: false };
  const strip = el("div", "cubes-strip"); game.appendChild(strip);
  const board = el("div", "board-wrap"); game.appendChild(board);
  const plan = el("div", "plan-line"); game.appendChild(plan);
  const stageWrap = el("div", "stage-wrap"); game.appendChild(stageWrap);

  const deck = el("div", "deck");
  const row = el("div", "btn-row");
  const replayBtn = el("button", "btn secondary", "🔊 Say it again"); replayBtn.id = "replay-btn";
  replayBtn.addEventListener("click", () => playVoice(step));
  const nextBtn = el("button", "btn primary", "Next ▶");
  row.append(replayBtn, nextBtn);
  deck.appendChild(row); game.appendChild(deck);
  app.appendChild(game);

  let step = -1;
  function draw() {
    strip.innerHTML = ""; LETTERS.forEach((L) => {
      const idx = LETTERS.indexOf(L), litIdx = D.lit ? LETTERS.indexOf(D.lit) : -1;
      strip.appendChild(el("div", "cube " + L + (idx < litIdx ? " done" : idx === litIdx ? " now" : ""), L));
    });
    board.innerHTML = ""; board.appendChild(buildBoard(D.p, D, null));
    plan.textContent = D.plan;
  }
  function next() {
    step += 1;
    if (step >= LESSON.steps.length) {
      if (voice) voice.pause();
      store.introSeen = true; saveStore();
      if (thenPlay) startRound(store.tier); else renderHome();
      return;
    }
    cap.innerHTML = `<div class="cap-text">${LESSON.steps[step].cap}</div>`;
    LESSON.steps[step].mark(D);
    draw();
    if (D.runDrop) { D.runDrop = false; stageWrap.innerHTML = ""; stageWrap.appendChild(buildStage(D.p)); setTimeout(() => runDrop(D.p, stageWrap, () => {}), 300); }
    playVoice(step);
    if (step === LESSON.steps.length - 1) nextBtn.textContent = thenPlay ? "Let's drop ▶" : "Done ✔";
    sfx.tap();
  }
  nextBtn.addEventListener("click", next);
  next();
}

/* ---------- home ---------- */
const TIERS = {
  1: { name: "Sharing",            sub: "share between 2, 3, 4, 5 or 10 bins" },
  2: { name: "Sharing & Grouping", sub: "…or fill bins of 6, 7, 8, 9 — and spot the totals" },
  3: { name: "Leftovers",          sub: "remainders on the bench, sneakier extra info" },
  4: { name: "Fractions",          sub: "a quarter of 12 is 12 shared into 4" },
};
let G = null;   // current round

function renderHome() {
  G = null;
  stopSpeech();
  app.innerHTML = "";
  const home = el("div", "home");
  home.appendChild(el("h1", null, "🧪 Drop Lab"));
  home.appendChild(el("div", "tagline", "Professor Bin won't drop a thing until it's been CUBES-checked."));

  const career = el("div", "career");
  [["Stars", store.career.stars], ["Rounds", store.career.rounds], ["Clean experiments", store.career.clean]]
    .forEach(([label, val]) => { const s = el("div", "stat"); s.innerHTML = `<b>${val}</b><br>${label}`; career.appendChild(s); });
  home.appendChild(career);

  const tiers = el("div", "tier-row");
  for (const t of [1, 2, 3, 4]) {
    const b = el("button", "tier-btn" + (store.tier === t ? " picked" : ""));
    b.appendChild(el("span", "tier-num", `Level ${t}`));
    b.appendChild(el("span", "tier-name", TIERS[t].name));
    b.appendChild(el("span", "tier-sub", TIERS[t].sub));
    b.appendChild(el("span", "tier-best", store.best[t] ? `Best ${store.best[t]}/30` : "Not played yet"));
    b.addEventListener("click", () => { store.tier = t; saveStore(); sfx.tap(); renderHome(); });
    tiers.appendChild(b);
  }
  home.appendChild(tiers);

  const start = el("button", "btn primary start-btn", "🧪 New experiment round");
  start.addEventListener("click", () => { sfx.whistle(); startRound(store.tier); });
  home.appendChild(start);

  const pills = el("div", "pill-row");
  const lesson = el("button", "pill", "🎓 Lesson — the CUBES card");
  lesson.addEventListener("click", () => { sfx.whistle(); renderLesson(false); });
  const print = el("a", "pill", "🖨️ Print 6 for pencil practice");
  print.href = `print.html?tier=${store.tier}`;
  const circle = el("button", "pill", store.circleAll ? "⚙️ Circling EVERY number (tutor's way)" : "⚙️ Circling only the numbers you need");
  circle.addEventListener("click", () => { store.circleAll = !store.circleAll; saveStore(); sfx.tap(); renderHome(); });
  pills.append(lesson, print, circle);
  home.appendChild(pills);

  const twRow = el("div", "pill-row");
  const twBtn = el("button", "pill faint", "🪙 Trawley Coin link");
  twBtn.addEventListener("click", async () => {
    twBtn.textContent = "🪙 Checking…";
    try {
      const { st } = await trawley();
      if (st.mode === "demo") twBtn.textContent = "🪙 Linked (this device)";
      else if (!st.needsSetup()) twBtn.textContent = `🪙 Linked to family ${st.familyCode()}`;
      else {
        const code = (window.prompt("Enter your Trawley Coin family code (6 letters):") || "").trim();
        if (!code) { twBtn.textContent = "🪙 Trawley Coin link"; return; }
        await st.joinFamily(code);
        twBtn.textContent = `🪙 Linked to family ${st.familyCode()}`;
        trawleyFlush();
      }
      sfx.tap();
    } catch (e) { twBtn.textContent = "🪙 " + (e && e.message ? e.message : "Couldn't reach Trawley Coin"); }
  });
  twRow.appendChild(twBtn);
  home.appendChild(twRow);

  home.appendChild(el("div", "scupperlab",
    `A ScupperLab production  ·  v${self.APP_VERSION || "?"}${self.APP_DATE ? " · " + self.APP_DATE : ""}`));
  app.appendChild(home);
}

/* ---------- the round ---------- */
function startRound(tier) {
  if (!store.introSeen) { renderLesson(true); return; }
  const seed = (Date.now() ^ (Math.random() * 1e9)) | 0;
  G = { tier, seed, problems: P.makeRound(tier, seed), idx: 0, stars: 0, letters: { C: 0, U: 0, B: 0, E: 0, S: 0 }, clean: 0 };
  newProblemState();
  renderProblem();
}
let PS = null;   // per-problem state
function curP() { return G.problems[G.idx]; }
function newProblemState() {
  PS = {
    step: "C", circled: new Set(), underlined: null, boxed: new Set(), crumpled: new Set(),
    schemaPick: null, slots: [{ chip: null, plus: false }, { chip: null, plus: false }], pickChip: null,
    fields: {}, active: null, misses: { C: 0, U: 0, B: 0, E: 0, E2: 0, S: 0 },
    first: { C: true, U: true, B: true, E: true, E2: true, S: true }, selfCaught: false,
    stars: { C: false, U: false, B: false, E: false, S: false },
    msg: "", msgKind: "", pulse: new Set(), pulseSent: null, keyCard: false, dropped: false,
  };
}
function slotVal(i) {
  const s = PS.slots[i];
  if (s.chip === null) return null;
  return curP().chips[s.chip].value + (s.plus ? 1 : 0);
}

/* the clipboard: sentences of word chips carrying the marks. Used by the round AND the lesson. */
function buildBoard(p, M, handlers) {
  const board = el("div", "clipboard");
  p.sentences.forEach((s, si) => {
    const sent = el("div", "sent"
      + (M.underlined === si ? " underlined" : "")
      + (M.crumpled.has(si) ? " crumpled" : "")
      + (M.pulseSent === si ? " pulse-sent" : ""));
    sent.dataset.sid = si;
    const inner = el("span", "sent-inner");
    p.chips.filter((c) => c.sid === si).forEach((c) => {
      const chip = el("span", "chip"
        + (M.circled.has(c.id) ? " circled" : "")
        + (M.boxed.has(c.id) ? " boxed" : "")
        + (M.pulse && M.pulse.has(c.id) ? " pulse" : ""), c.text);
      chip.dataset.id = c.id;
      if (handlers) chip.addEventListener("click", (e) => { e.stopPropagation(); handlers.chip(c); });
      inner.appendChild(chip);
      inner.appendChild(document.createTextNode(" "));
    });
    sent.appendChild(inner);
    const ball = el("span", "paper-ball", "🗑️ crossed out — tap to undo");
    sent.appendChild(ball);
    if (handlers) sent.addEventListener("click", () => handlers.sentence(si));
    board.appendChild(sent);
  });
  return board;
}

function renderProblem() {
  stopSpeech();
  app.innerHTML = "";
  const p = curP();
  const game = el("div", "game");

  // top bar
  const bar = el("div", "topbar");
  const req = el("div", "tb-item"); req.innerHTML = `Request <b>${G.idx + 1}</b>/${ROUND_LEN}${p.bonus ? " <span class='bonus'>bonus</span>" : ""}`;
  const st = el("div", "tb-item"); st.innerHTML = `⭐ <b id="tb-stars">${G.stars}</b>`;
  const quit = el("button", "quit-btn", "⏹ End");
  quit.addEventListener("click", () => {
    if (!quit.dataset.arm) {
      quit.dataset.arm = "1"; quit.textContent = "End round?";
      setTimeout(() => { if (quit.isConnected) { delete quit.dataset.arm; quit.textContent = "⏹ End"; } }, 2000);
      sfx.tap(); return;
    }
    if (G && G.stars > 0) { store.career.stars += G.stars; saveStore(); }
    sfx.tap(); renderHome();
  });
  bar.append(req, st, quit);
  game.appendChild(bar);

  // CUBES strip
  const strip = el("div", "cubes-strip");
  const stepLetter = STEP_INFO[PS.step] ? STEP_INFO[PS.step].letter : null;
  const nowIdx = stepLetter ? LETTERS.indexOf(stepLetter) : LETTERS.length;
  LETTERS.forEach((L, i) => {
    const c = el("div", "cube " + L + (i < nowIdx ? " done" : i === nowIdx ? " now" : ""), L);
    if (i < nowIdx) c.appendChild(el("span", "cube-star", PS.stars[L] ? "★" : "✓"));
    strip.appendChild(c);
  });
  game.appendChild(strip);

  // instruction
  const info = STEP_INFO[PS.step];
  const instr = el("div", "card instr-card");
  if (info) instr.innerHTML = `<div class="kicker">${info.letter} · ${info.title}</div><div class="instr">${info.instr}</div>`;
  else instr.innerHTML = `<div class="kicker">✓ Verified</div><div class="instr">Professor Bin approves. On to the next request.</div>`;
  game.appendChild(instr);

  // the request
  const boardWrap = el("div", "board-wrap");
  boardWrap.appendChild(buildBoard(p, PS, { chip: onChipTap, sentence: onSentenceTap }));
  const readBtn = el("button", "read-btn", "🔈 Read to me");
  readBtn.addEventListener("click", () => { sfx.tap(); speak(p.text); });
  boardWrap.appendChild(readBtn);
  game.appendChild(boardWrap);

  // feedback
  const fb = el("div", "feedback-line" + (PS.msgKind ? " " + PS.msgKind : ""), PS.msg);
  fb.id = "feedback";
  game.appendChild(fb);
  if (PS.keyCard) {
    const kc = el("div", "card key-card");
    kc.appendChild(el("div", "kicker", "Key word card"));
    for (const [phrase, meaning] of keyCard(p)) {
      const line = el("div", "kc-line"); line.innerHTML = `<b>${phrase}</b> → ${meaning}`; kc.appendChild(line);
    }
    game.appendChild(kc);
  }

  // step-specific deck
  const deck = el("div", "deck");
  if (PS.step === "E2") deck.appendChild(buildEvaluate(p));
  if (PS.step === "S") deck.appendChild(buildSolve(p));
  if (PS.step === "DONE") deck.appendChild(buildDone(p));
  if (["C", "U", "B", "E"].includes(PS.step)) {
    const row = el("btn-row" ? "div" : "div", "btn-row");
    if (PS.step === "E") {
      const none = el("button", "btn secondary", "Nothing to cross out");
      none.addEventListener("click", () => { PS.crumpled.clear(); sfx.tap(); doneStep(); });
      row.appendChild(none);
    }
    const done = el("button", "btn primary", info.done + " ✔");
    done.addEventListener("click", doneStep);
    row.appendChild(done);
    deck.appendChild(row);
  }
  game.appendChild(deck);
  app.appendChild(game);
}

function onChipTap(c) {
  const p = curP();
  if (PS.crumpled.has(c.sid) && PS.step !== "E") return;
  if (PS.step === "C") { PS.circled.has(c.id) ? PS.circled.delete(c.id) : PS.circled.add(c.id); sfx.circle(); PS.msg = ""; PS.pulse.clear(); renderProblem(); return; }
  if (PS.step === "B") { PS.boxed.has(c.id) ? PS.boxed.delete(c.id) : PS.boxed.add(c.id); sfx.box(); PS.msg = ""; PS.pulse.clear(); renderProblem(); return; }
  onSentenceTap(c.sid);
}
function onSentenceTap(si) {
  if (PS.step === "U") { PS.underlined = si; sfx.underline(); PS.msg = ""; PS.pulseSent = null; renderProblem(); return; }
  if (PS.step === "E") {
    if (PS.crumpled.has(si)) { PS.crumpled.delete(si); sfx.tap(); }
    else { PS.crumpled.add(si); sfx.crumple(); setTimeout(() => sfx.thunk(), 260); }
    PS.msg = ""; PS.pulseSent = null; renderProblem();
  }
}

function award(letter) {
  PS.stars[letter] = true;
  G.stars += 1; G.letters[letter] += 1;
  store.letters[letter][0] += 1;
}
function attempt(letter) { store.letters[letter][1] += 1; }

function doneStep() {
  const p = curP();
  const step = PS.step;
  let res;
  if (step === "C") res = P.verify.circle(p, [...PS.circled], store.circleAll);
  if (step === "U") res = P.verify.underline(p, PS.underlined);
  if (step === "B") res = P.verify.box(p, [...PS.boxed]);
  if (step === "E") res = P.verify.eliminate(p, [...PS.crumpled]);
  if (!res) return;

  if (res.ok) {
    const letter = STEP_INFO[step].letter;
    if (step !== "E") { attempt(letter); if (PS.first[step]) award(letter); }
    PS.msg = ""; PS.msgKind = ""; PS.pulse.clear(); PS.pulseSent = null;
    if (step === "C") { PS.step = "U"; sfx.good(); }
    else if (step === "U") { PS.step = "B"; sfx.good(); }
    else if (step === "B") { PS.step = "E"; PS.keyCard = true; sfx.good(); }
    else if (step === "E") { PS.step = "E2"; PS.keyCard = false; sfx.good(); }
    renderProblem();
    return;
  }
  // wrong: message, no advance; second miss gets a nudge on the right target
  PS.first[step] = false;
  PS.misses[step] += 1;
  PS.msg = res.msg; PS.msgKind = "bad";
  sfx.miss();
  if (PS.misses[step] >= 2) {
    if (step === "C" && res.missing) res.missing.forEach((id) => PS.pulse.add(id));
    if (step === "U") PS.pulseSent = p.sentences.findIndex((s) => s.role === "question");
    if (step === "B" && res.hint) p.chips.filter((c) => c.phrase && res.hint.split(" ").includes(c.text)).forEach((c) => PS.pulse.add(c.id));
    if (step === "E") {
      if (res.bounce !== undefined) PS.crumpled.delete(res.bounce);
      const d = p.sentences.findIndex((s, i) => s.role === "distractor" && !PS.crumpled.has(i));
      if (d >= 0) PS.pulseSent = d;
    }
  } else if (step === "E" && res.bounce !== undefined) {
    PS.crumpled.delete(res.bounce);   // the boss needed that one — it bounces back out of the bin
  }
  renderProblem();
}

/* ---------- E2: Evaluate — what's missing, then build the sum ---------- */
function buildEvaluate(p) {
  const wrap = el("div", "eval");
  const q = el("div", "eval-q", "What is the question asking for?");
  wrap.appendChild(q);
  const picks = el("div", "schema-row");
  [["EACH", "how many in EACH bin"], ["GROUP", "how many BINS"], ["TOTAL", "how many ALTOGETHER"]].forEach(([k, label]) => {
    const b = el("button", "schema-btn" + (PS.schemaPick === k ? " picked" : ""), label);
    b.addEventListener("click", () => { PS.schemaPick = k; PS.msg = ""; sfx.tap(); renderProblem(); });
    picks.appendChild(b);
  });
  wrap.appendChild(picks);

  if (PS.schemaPick) {
    const op = PS.schemaPick === "TOTAL" ? "×" : "÷";
    const frame = el("div", "frame");
    [0, 1].forEach((i) => {
      const v = slotVal(i);
      const s = PS.slots[i];
      const slot = el("button", "slot" + (v !== null ? " filled" : "") + (PS.pickChip === null && v === null ? " wait" : ""),
        v === null ? "" : (s.plus ? `${p.chips[s.chip].value}+1` : String(v)));
      slot.addEventListener("click", () => {
        if (PS.pickChip !== null) {
          // a chip can live in one slot only
          PS.slots.forEach((o) => { if (o.chip === PS.pickChip) { o.chip = null; o.plus = false; } });
          PS.slots[i] = { chip: PS.pickChip, plus: false }; PS.pickChip = null; sfx.box();
        } else if (s.chip !== null) { PS.slots[i] = { chip: null, plus: false }; sfx.tap(); }
        PS.msg = ""; renderProblem();
      });
      frame.appendChild(slot);
      if (i === 0) frame.appendChild(el("span", "op", op));
    });
    frame.appendChild(el("span", "op", "= ?"));
    wrap.appendChild(frame);

    const chips = el("div", "num-chips");
    const survivors = p.chips.filter((c) => c.isNumber && PS.circled.has(c.id) && !PS.crumpled.has(c.sid));
    survivors.forEach((c) => {
      const used = PS.slots.some((o) => o.chip === c.id);
      const b = el("button", "num-chip" + (PS.pickChip === c.id ? " picked" : "") + (used ? " used" : ""),
        c.text.replace(/[^\w$]/g, "") + (c.value !== null && !/^\$?\d+$/.test(c.text.replace(/[^\w$]/g, "")) ? ` (${c.value})` : ""));
      b.addEventListener("click", () => { if (used) return; PS.pickChip = PS.pickChip === c.id ? null : c.id; sfx.tap(); renderProblem(); });
      chips.appendChild(b);
    });
    if (p.selfIncluded) {
      const me = el("button", "num-chip me" + (PS.slots[1].plus ? " picked" : ""), "+ himself");
      me.addEventListener("click", () => {
        if (PS.slots[1].chip === null) { PS.msg = "Put the friends number in first, then add him."; PS.msgKind = "bad"; renderProblem(); return; }
        PS.slots[1].plus = !PS.slots[1].plus; sfx.tap(); PS.msg = ""; renderProblem();
      });
      chips.appendChild(me);
    }
    wrap.appendChild(chips);

    const row = el("div", "btn-row");
    const done = el("button", "btn primary", STEP_INFO.E2.done + " ✔");
    done.addEventListener("click", () => {
      const res = P.verify.evaluate(p, PS.schemaPick, [slotVal(0), slotVal(1)]);
      attempt("E");
      if (res.ok) {
        if (PS.first.E && PS.first.E2) award("E");
        PS.step = "S"; PS.msg = ""; PS.msgKind = ""; sfx.good(); renderProblem();
      } else {
        PS.first.E2 = false; PS.misses.E2 += 1; PS.msg = res.msg; PS.msgKind = "bad"; sfx.miss(); renderProblem();
      }
    });
    row.appendChild(done);
    wrap.appendChild(row);
  }
  return wrap;
}

/* ---------- S: Solve, then CHECK by multiplying back, then the drop ---------- */
function fieldsFor(p) {
  const f = [];
  if (p.type === "SHARE") f.push({ k: "ans", label: "in each bin" });
  if (p.type === "FRACTION") f.push({ k: "ans", label: "are red" });
  if (p.type === "GROUP") f.push({ k: "ans", label: "bins" });
  if (p.type === "TOTAL") f.push({ k: "ans", label: "altogether" });
  if (p.type === "SHARE_REM") { f.push({ k: "ans", label: "in each bin" }); f.push({ k: "rem", label: "left over" }); }
  if (p.type === "GROUP_REM") { f.push({ k: "ans", label: "full bins" }); f.push({ k: "rem", label: "left over" }); }
  return f;
}
function buildSolve(p) {
  const wrap = el("div", "solve");
  const fields = fieldsFor(p);
  if (!PS.active) PS.active = fields[0].k;

  const frow = el("div", "field-row");
  fields.forEach((f) => {
    const box = el("button", "field" + (PS.active === f.k ? " active" : ""));
    box.appendChild(el("span", "field-val", PS.fields[f.k] === undefined ? "" : String(PS.fields[f.k])));
    box.appendChild(el("span", "field-label", f.label));
    box.addEventListener("click", () => { PS.active = f.k; sfx.tap(); renderProblem(); });
    frow.appendChild(box);
  });
  wrap.appendChild(frow);

  const answered = fields.every((f) => PS.fields[f.k] !== undefined);
  if (answered) {
    const ans = PS.fields.ans, rem = PS.fields.rem;
    const check = el("div", "check-line");
    const label = p.type === "TOTAL" ? `Check: ${ans} ÷ ${p.K} =` : `Check: ${ans} × ${p.K}${rem ? " + " + rem : ""} =`;
    check.appendChild(el("span", "check-label", label));
    const cbox = el("button", "field small" + (PS.active === "prod" ? " active" : ""));
    cbox.appendChild(el("span", "field-val", PS.fields.prod === undefined ? "" : String(PS.fields.prod)));
    cbox.addEventListener("click", () => { PS.active = "prod"; sfx.tap(); renderProblem(); });
    check.appendChild(cbox);
    wrap.appendChild(check);
    if (PS.active === "ans" || PS.active === "rem") { /* leave the pad on the answer until he moves */ }
  }

  wrap.appendChild(buildPad());

  const row = el("div", "btn-row");
  const run = el("button", "btn primary", STEP_INFO.S.done + " 🧪");
  run.disabled = !(answered && PS.fields.prod !== undefined);
  run.addEventListener("click", () => onRun(p));
  row.appendChild(run);
  wrap.appendChild(row);
  return wrap;
}
function buildPad() {
  const pad = el("div", "pad");
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "next"].forEach((k) => {
    const b = el("button", "key" + (k === "⌫" ? " del" : k === "next" ? " nxt" : ""), k === "next" ? "→" : k);
    b.addEventListener("click", () => {
      const cur = PS.fields[PS.active];
      if (k === "⌫") { if (cur !== undefined) { const s = String(cur).slice(0, -1); if (s) PS.fields[PS.active] = +s; else delete PS.fields[PS.active]; } }
      else if (k === "next") {
        const order = fieldsFor(curP()).map((f) => f.k).concat(["prod"]);
        const i = order.indexOf(PS.active); PS.active = order[Math.min(order.length - 1, i + 1)];
      } else {
        const s = (cur === undefined ? "" : String(cur)) + k;
        if (s.length <= 3) PS.fields[PS.active] = +s;
        // auto-advance to the next empty field after a first digit on a one-digit-typical field
      }
      sfx.tap(); PS.msg = ""; renderProblem();
    });
    pad.appendChild(b);
  });
  return pad;
}
function onRun(p) {
  const ans = PS.fields.ans, rem = PS.fields.rem, prod = PS.fields.prod;
  const hasRem = p.type.endsWith("_REM");
  attempt("S");
  // 1. his arithmetic in the check must be right
  const hisCheck = p.type === "TOTAL" ? (ans % p.K === 0 ? ans / p.K : NaN) : ans * p.K + (hasRem ? (rem || 0) : 0);
  if (prod !== hisCheck) {
    PS.first.S = false; PS.misses.S += 1;
    PS.msg = p.type === "TOTAL"
      ? `Check your working: ${ans} ÷ ${p.K} isn't ${prod}.`
      : `Check your times: ${ans} × ${p.K}${hasRem ? " + " + rem : ""} isn't ${prod}. Try that bit again.`;
    PS.msgKind = "bad"; delete PS.fields.prod; PS.active = "prod"; sfx.miss(); renderProblem(); return;
  }
  // 2. the check must land on the number the lab started with
  const truth = p.type === "TOTAL" ? p.G : p.N;
  const solved = P.verify.solve(p, ans, rem).ok;
  if (prod !== truth || !solved) {
    const why = hasRem && rem >= p.K ? `${rem} left over is enough to fill another bin — share them out.` :
      p.type === "TOTAL" ? `Your check caught it! ${ans} ÷ ${p.K} = ${prod}, but there are ${p.G} bins.` :
      `Your check caught it! ${ans} × ${p.K}${hasRem ? " + " + rem : ""} = ${prod}, but the lab has ${p.N}. Fix the answer.`;
    PS.selfCaught = true;                 // his own check found the slip: the star survives if he fixes it
    PS.msg = why; PS.msgKind = "bad";
    PS.fields = {}; PS.active = "ans"; sfx.miss(); renderProblem(); return;
  }
  // 3. correct, and verified by him — now, and only now, the drop
  if (PS.first.S || PS.selfCaught) award("S");
  PS.msg = ""; PS.msgKind = "";
  PS.step = "DONE";
  renderProblem();
  const stageWrap = document.getElementById("stage-wrap");
  setTimeout(() => runDrop(p, stageWrap, () => {
    const stamp = el("div", "stamp", "VERIFIED");
    stageWrap.appendChild(stamp);
    const fact = document.getElementById("fact");
    if (fact) fact.textContent = p.type === "TOTAL" ? `${p.K} × ${p.G} = ${p.N} ✓` : `${p.q} × ${p.K}${p.r ? " + " + p.r : ""} = ${p.N} ✓`;
    sfx.verified();
    const allFive = LETTERS.every((L) => PS.stars[L]);
    if (allFive) { G.clean += 1; setTimeout(() => popText(innerWidth / 2 - 90, 90, "⭐ CLEAN EXPERIMENT", true), 300); }
    const nb = document.getElementById("next-btn"); if (nb) nb.disabled = false;
  }), 250);
}
function buildDone(p) {
  const wrap = el("div", "done");
  const stageWrap = el("div", "stage-wrap"); stageWrap.id = "stage-wrap";
  stageWrap.appendChild(buildStage(p));
  wrap.appendChild(stageWrap);
  const fact = el("div", "fact"); fact.id = "fact"; wrap.appendChild(fact);
  const row = el("div", "btn-row");
  const next = el("button", "btn primary", G.idx + 1 >= ROUND_LEN ? "See my stars ▶" : "Next request ▶");
  next.id = "next-btn"; next.disabled = true;
  next.addEventListener("click", () => {
    G.idx += 1; sfx.tap();
    if (G.idx >= ROUND_LEN) endRound(); else { newProblemState(); renderProblem(); }
  });
  row.appendChild(next); wrap.appendChild(row);
  return wrap;
}

/* ---------- the stage: chute, bins, bench — and the drop (CSS, count decided by the algorithm) ---------- */
function binCount(p) {
  if (p.type === "SHARE" || p.type === "SHARE_REM" || p.type === "FRACTION") return p.K;
  if (p.type === "TOTAL") return p.G;
  return 1;   // grouping: bins slide in as they fill
}
function buildStage(p) {
  const stage = el("div", "stage");
  stage.appendChild(el("div", "chute"));
  const bins = el("div", "bins"); bins.id = "bins";
  for (let i = 0; i < binCount(p); i++) bins.appendChild(makeBin(i));
  stage.appendChild(bins);
  const bench = el("div", "bench"); bench.id = "bench";
  bench.appendChild(el("div", "bench-label", "leftovers"));
  bench.appendChild(el("div", "pile"));
  bench.appendChild(el("div", "count", "0"));
  stage.appendChild(bench);
  return stage;
}
function makeBin(i) {
  const b = el("div", "bin"); b.dataset.i = i;
  b.appendChild(el("div", "pile"));
  b.appendChild(el("div", "count", "0"));
  return b;
}
function dropPlan(p) {
  const plan = [];
  const full = p.q * p.K;                         // objects that fit fairly
  if (p.type === "SHARE" || p.type === "SHARE_REM" || p.type === "FRACTION") {
    for (let i = 0; i < full; i++) plan.push(i % p.K);
  } else if (p.type === "TOTAL") {
    for (let i = 0; i < p.N; i++) plan.push(Math.floor(i / p.K));
  } else {                                        // GROUP / GROUP_REM: K per bin, bins grow
    for (let i = 0; i < full; i++) plan.push(Math.floor(i / p.K));
  }
  for (let i = 0; i < p.r; i++) plan.push("bench");
  return plan;
}
function runDrop(p, stageWrap, done) {
  const stage = stageWrap.querySelector(".stage");
  const bins = stage.querySelector("#bins") || stage.querySelector(".bins");
  const bench = stage.querySelector(".bench");
  const chute = stage.querySelector(".chute");
  const plan = dropPlan(p);
  const grow = p.type === "GROUP" || p.type === "GROUP_REM";
  const stagger = plan.length > 30 ? 55 : plan.length > 16 ? 80 : 110;
  let i = 0;
  const step = () => {
    // backgrounded mid-drop (timers clamp to a second each): finish the count now
    if (document.hidden) { while (i < plan.length) { placeOne(plan[i]); i += 1; } finish(); return; }
    if (i >= plan.length) { finish(); return; }
    const binEl = binFor(plan[i]);
    flyObject(stage, chute, binEl, p.obj.cls, () => settle(binEl));
    if (i % 2 === 0) sfx.drop();
    i += 1;
    setTimeout(step, stagger);
  };
  const binFor = (target) => {
    if (target === "bench") return bench;
    let binEl = bins.children[target];
    if (!binEl && grow) { binEl = makeBin(target); binEl.classList.add("slide-in"); bins.appendChild(binEl); }
    return binEl;
  };
  const settle = (binEl) => {
    const pile = binEl.querySelector(".pile");
    pile.appendChild(el("div", "obj " + p.obj.cls + " land"));
    binEl.querySelector(".count").textContent = String(pile.children.length);
    if (pile.children.length % 3 === 0) sfx.land();
  };
  const placeOne = (target) => settle(binFor(target));
  const finish = () => {
    if (p.type === "FRACTION") { const b0 = bins.querySelector(".bin"); if (b0) { b0.classList.add("lit"); b0.appendChild(el("div", "lit-label", `1 ${p.frac.word}`)); } }
    setTimeout(done, document.hidden ? 0 : 300);
  };
  step();
}
function flyObject(stage, from, to, cls, onLand) {
  const sr = stage.getBoundingClientRect(), fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect();
  const o = el("div", "obj " + cls + " flyer");
  const x0 = fr.left - sr.left + fr.width / 2 - 8, y0 = fr.top - sr.top + fr.height - 6;
  const x1 = tr.left - sr.left + tr.width / 2 - 8 + (Math.random() * 16 - 8), y1 = tr.top - sr.top + tr.height * 0.55;
  o.style.left = x0 + "px"; o.style.top = y0 + "px";
  stage.appendChild(o);
  const dx = x1 - x0, dy = y1 - y0;
  // the count is decided by the plan, never by the flight: land exactly once no
  // matter what — including when the app is backgrounded mid-drop and the
  // animation timeline freezes (onfinish would never fire)
  let landed = false;
  const land = () => { if (landed) return; landed = true; o.remove(); onLand(); };
  if (document.hidden || !o.animate) { land(); return; }
  const anim = o.animate([
    { transform: "translate(0,0) rotate(0deg)" },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.35}px) rotate(${dx > 0 ? 90 : -90}deg)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${dx > 0 ? 180 : -180}deg)` },
  ], { duration: 380, easing: "cubic-bezier(0.3, 0, 0.7, 1)" });
  anim.onfinish = land;
  setTimeout(land, 700);
}

/* ---------- round summary ---------- */
function endRound() {
  sfx.cheer();
  stopSpeech();
  const tier = G.tier;
  const isBest = G.stars > (store.best[tier] || 0);
  if (isBest) store.best[tier] = G.stars;
  store.career.stars += G.stars;
  store.career.rounds += 1;
  store.career.clean += G.clean;
  saveStore();

  app.innerHTML = "";
  const wrap = el("div", "summary");
  wrap.appendChild(el("h2", null, G.stars >= 30 ? "SPOTLESS LAB! 🏆" : G.stars >= 24 ? "Professor Bin is impressed 🧪" : "Experiments complete 🧪"));
  wrap.appendChild(el("div", "final-score", `${G.stars} / 30`));
  wrap.appendChild(el("div", "sub", `Level ${tier} · ${TIERS[tier].name} · ${G.clean} clean experiment${G.clean === 1 ? "" : "s"}`));
  if (isBest && G.stars > 0) wrap.appendChild(el("div", "newbest", `⭐ New Level ${tier} record!`));

  // which letter leaks: this is the line for Dad and the tutor
  const bars = el("div", "letter-bars");
  LETTERS.forEach((L) => {
    const row = el("div", "lb-row");
    row.appendChild(el("span", "lb-letter cube " + L, L));
    const track = el("div", "lb-track");
    const fill = el("div", "lb-fill"); fill.style.width = (100 * G.letters[L] / ROUND_LEN) + "%";
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el("span", "lb-num", `${G.letters[L]}/${ROUND_LEN}`));
    bars.appendChild(row);
  });
  wrap.appendChild(bars);
  const weakest = LETTERS.reduce((a, b) => (G.letters[b] < G.letters[a] ? b : a), "C");
  if (G.letters[weakest] < ROUND_LEN) wrap.appendChild(el("div", "lb-note", `Most stars lost on ${weakest} — ${STEP_INFO[weakest].title.toLowerCase()}.`));

  const gate = G.stars / 30;
  if (gate >= 0.75) {
    const suggested = gate >= 0.97 ? 3 : 2;
    const entry = { choreName: `🧪 Drop Lab: ${G.stars}/30 (Level ${tier})`, coins: suggested,
      note: `${G.clean} clean experiments` + (G.stars >= 30 ? " — SPOTLESS!" : "") };
    const coinBtn = el("button", "btn coin", `🪙 Ask for ${suggested} Trawley Coins`);
    coinBtn.addEventListener("click", async () => {
      coinBtn.disabled = true; coinBtn.textContent = "Sending…";
      try { await trawleySend(entry); coinBtn.textContent = "Sent to Mum & Dad ✓"; sfx.cheer(); }
      catch (e) {
        if (e && e.message === "needs-code") { coinBtn.textContent = "Link Trawley Coin first (home screen 🪙)"; coinBtn.disabled = false; }
        else { trawleyQueue(entry); coinBtn.textContent = "Queued — sends when online ✓"; }
      }
    });
    wrap.appendChild(coinBtn);
  }

  const row = el("div", "btn-row");
  const again = el("button", "btn primary", "Another round");
  again.addEventListener("click", () => { sfx.whistle(); startRound(tier); });
  const home = el("button", "btn secondary", "Home");
  home.addEventListener("click", () => { sfx.tap(); renderHome(); });
  row.append(again, home);
  wrap.appendChild(row);
  const pr = el("a", "pill", "🖨️ Print 6 for pencil practice"); pr.href = `print.html?tier=${tier}`;
  wrap.appendChild(pr);
  app.appendChild(wrap);
}

/* ---------- boot ---------- */
const muteBtn = document.getElementById("mute-btn");
function syncMute() { muteBtn.textContent = store.muted ? "🔇" : "🔊"; }
muteBtn.addEventListener("click", () => { store.muted = !store.muted; saveStore(); syncMute(); if (!store.muted) sfx.tap(); if (store.muted) stopSpeech(); });
syncMute();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
trawleyFlush();
renderHome();
