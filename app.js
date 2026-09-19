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

/* ---------- store ---------- */
const STORE_KEY = "droplab.v1";
function loadStore() {
  const base = {
    muted: false,
    tier: 1,
    circleAll: true,               // the hint circles every number (the tutor's way), or only the needed ones
    wobbliesOnly: false,           // every request about Wobblies (the ragdolls), if he'd rather
    career: { stars: 0, rounds: 0, clean: 0 },
    best: { 1: 0, 2: 0, 3: 0, 4: 0 },
    introSeen: false,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return Object.assign(base, raw, {
      career: Object.assign(base.career, raw.career || {}),
      best: Object.assign(base.best, raw.best || {}),
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
    { raw: "The Drop Lab got 24 Wobblies for today's test.", role: "setup" },
    { raw: "The lab also has 7 spare crash helmets on the shelf.", role: "distractor" },
    { raw: "Henry packs 4 Wobblies [into each bin].", role: "condition" },
    { raw: "[How many bins] does he fill?", role: "question" },
  ].map((s) => Object.assign({ text: s.raw.replace(/[\[\]]/g, "") }, s));
  const p = { tier: 2, type: "GROUP", baseType: "GROUP", schema: "GROUP", obj: P.OBJECTS.find((o) => o.cls === "wobbly"), selfIncluded: false,
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
    { cap: "This is an Experiment Request. Professor Bin will NOT drop a single Wobbly until it has been CUBES-checked — last time someone skipped the check, the Wobblies bounced all over the lab. Five steps, one letter each. Same card as your tutor's.",
      mark: () => {} },
    { cap: "C — CIRCLE THE NUMBERS. All of them, even the ones you might not need. Deciding what matters comes later — for now, just catch every number.",
      mark: (D) => { D.circled = new Set(D.p.chips.filter((c) => c.isNumber).map((c) => c.id)); D.lit = "C"; } },
    { cap: "U — UNDERLINE THE QUESTION. It's the sentence that ASKS something. Usually it has a question mark, but not always — sometimes it says 'Work out…'",
      mark: (D) => { D.underlined = D.p.sentences.findIndex((s) => s.role === "question"); D.lit = "U"; } },
    { cap: "B — BOX THE KEY WORDS: the words that tell you what to DO. 'Into each bin' and 'How many bins' — that means GROUPING: fill one bin to 4, then start the next, and count the bins.",
      mark: (D) => { D.boxed = new Set(D.p.chips.filter((c) => c.phrase).map((c) => c.id)); D.lit = "B"; } },
    { cap: "E — ELIMINATE anything the question never asks about. 7 crash helmets? The question is about bins of Wobblies. Crumple it. Then EVALUATE: what's missing — how many in EACH, how many BINS, or the TOTAL? Bins. So the sum is 24 ÷ 4.",
      mark: (D) => { D.crumpled = new Set([1]); D.plan = "24 ÷ 4 = ?"; D.lit = "E"; } },
    { cap: "S — SOLVE: 24 ÷ 4 = 6. Then CHECK by going backwards: 6 bins × 4 Wobblies = 24. That's the number we started with, so it's right. Only NOW do the Wobblies drop — watch.",
      mark: (D) => { D.plan = "24 ÷ 4 = 6   check: 6 × 4 = 24 ✓"; D.lit = "S"; D.runDrop = true; } },
    { cap: "Your turn, Lab Chief. Read each request, work it out, and CHECK it. Stuck? Tap the CUBES hint and Professor Bin marks the request up for you, one pair of letters at a time — but every hint costs a star. Five stars means you did the whole thing yourself. Ready?",
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
  const circle = el("button", "pill", store.circleAll ? "⚙️ Hints circle EVERY number (tutor's way)" : "⚙️ Hints circle only the numbers you need");
  circle.addEventListener("click", () => { store.circleAll = !store.circleAll; saveStore(); sfx.tap(); renderHome(); });
  const wob = el("button", "pill", store.wobbliesOnly ? "🤸 Wobblies only — ON" : "🤸 Wobblies only — off (mixed objects)");
  wob.addEventListener("click", () => { store.wobbliesOnly = !store.wobbliesOnly; saveStore(); sfx.tap(); renderHome(); });
  pills.append(lesson, print, circle, wob);
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

/* ---------- the round ----------
   He reads the request, works it out, types the answer and CHECKS it, and only
   then do the Wobblies drop. CUBES is not a gate he taps through: it is a hint
   he can ask for when he is stuck, and each one costs a star. */
function startRound(tier) {
  if (!store.introSeen) { renderLesson(true); return; }
  const seed = (Date.now() ^ (Math.random() * 1e9)) | 0;
  G = { tier, seed, problems: P.makeRound(tier, seed, { objCls: store.wobbliesOnly ? "wobbly" : null }),
        idx: 0, stars: 0, noHint: 0, hintsUsed: 0, clean: 0 };
  newProblemState();
  renderProblem();
}
let PS = null;   // per-request state
function curP() { return G.problems[G.idx]; }
function newProblemState() {
  PS = { step: "SOLVE", hint: 0, fields: {}, active: null, wrongRun: false, selfCaught: false,
         msg: "", msgKind: "", stars: 0 };
}

/* Each tap of the hint has Professor Bin mark the request up the way the tutor's
   card says — the same marks he would make with a pencil. */
const HINTS = [
  { letters: ["C", "U"], label: "C — circle the numbers · U — underline the question" },
  { letters: ["B", "E"], label: "B — box the key words · E — eliminate extra information" },
  { letters: ["E"],      label: "E — evaluate: what steps do I take?" },
];
function hintMarks(p) {
  const M = { circled: new Set(), underlined: null, boxed: new Set(), crumpled: new Set(), pulse: new Set(), pulseSent: null };
  if (PS.hint >= 1) {
    p.chips.filter((c) => c.isNumber && (store.circleAll || c.numberRole === "needed")).forEach((c) => M.circled.add(c.id));
    M.underlined = p.sentences.findIndex((s) => s.role === "question");
  }
  if (PS.hint >= 2) {
    p.chips.filter((c) => c.phrase && c.role !== "distractor").forEach((c) => M.boxed.add(c.id));
    p.sentences.forEach((s, i) => { if (s.role === "distractor") M.crumpled.add(i); });
  }
  return M;
}
function planText(p) {
  const what = { EACH: "how many in EACH bin", GROUP: "how many BINS", TOTAL: "the TOTAL" }[p.schema];
  const sum = p.type === "TOTAL" ? `${p.G} × ${p.K}` : p.selfIncluded ? `${p.N} ÷ (${p.K - 1} + 1)` : `${p.N} ÷ ${p.K}`;
  let tail = "";
  if (p.type.endsWith("_REM")) tail = ", and whatever won't share out fairly is left over";
  if (p.type === "FRACTION") tail = `. A ${p.frac.word} of ${p.N} means share it into ${p.K} bins and take one`;
  if (p.selfIncluded) tail = ". He counts himself too";
  return `Missing: ${what}. So the sum is ${sum} = ?${tail}`;
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
    // a boxed key phrase gets ONE box around the whole phrase, the way it is
    // drawn on the tutor's card — not a box around each separate word
    const chips = p.chips.filter((c) => c.sid === si);
    const word = (c) => {
      const w = el("span", "chip"
        + (M.circled.has(c.id) ? " circled" : "")
        + (M.pulse && M.pulse.has(c.id) ? " pulse" : ""), c.text);
      w.dataset.id = c.id;
      if (handlers) w.addEventListener("click", (e) => { e.stopPropagation(); handlers.chip(c); });
      return w;
    };
    for (let i = 0; i < chips.length; ) {
      const c = chips[i];
      if (c.phrase && M.boxed.has(c.id)) {
        const box = el("span", "phrase-box");
        while (i < chips.length && chips[i].phrase === c.phrase && M.boxed.has(chips[i].id)) {
          box.appendChild(word(chips[i]));
          i += 1;
          if (i < chips.length && chips[i].phrase === c.phrase) box.appendChild(document.createTextNode(" "));
        }
        inner.appendChild(box);
      } else {
        inner.appendChild(word(c));
        i += 1;
      }
      inner.appendChild(document.createTextNode(" "));
    }
    sent.appendChild(inner);
    const ball = el("span", "paper-ball", "🗑️ crossed out");
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

  // the card: letters light up as the hint reveals them, S when it is verified
  const lit = new Set();
  for (let i = 0; i < PS.hint; i++) HINTS[i].letters.forEach((L) => lit.add(L));
  if (PS.step === "DONE") lit.add("S");
  const strip = el("div", "cubes-strip");
  LETTERS.forEach((L) => strip.appendChild(el("div", "cube " + L + (lit.has(L) ? " now" : ""), L)));
  game.appendChild(strip);

  const instr = el("div", "card instr-card");
  if (PS.step === "DONE") {
    instr.innerHTML = `<div class="kicker">✓ Verified</div><div class="instr">Professor Bin approves — <b>${PS.stars} star${PS.stars === 1 ? "" : "s"}</b>${PS.hint ? ` (${PS.hint} hint${PS.hint === 1 ? "" : "s"})` : PS.wrongRun ? "" : " — no hints, first go!"}</div>`;
  } else {
    instr.innerHTML = `<div class="kicker">Experiment request</div><div class="instr">Work it out, type the answer, then CHECK it by ${p.type === "TOTAL" ? "dividing" : "multiplying"} back. Stuck? Tap the CUBES hint — each one costs a star.</div>`;
  }
  game.appendChild(instr);

  const boardWrap = el("div", "board-wrap");
  boardWrap.appendChild(buildBoard(p, hintMarks(p), null));
  if (PS.hint >= 2 && p.clean) boardWrap.appendChild(el("div", "clean-note", "✔ Nothing to cross out this time — every sentence matters."));
  const tools = el("div", "tool-row");
  const readBtn = el("button", "read-btn", "🔈 Read to me");
  readBtn.addEventListener("click", () => { sfx.tap(); speak(p.text); });
  const hintBtn = el("button", "hint-btn", PS.hint >= HINTS.length ? "💡 All hints shown" : `💡 CUBES hint ${PS.hint + 1} of ${HINTS.length}`);
  hintBtn.disabled = PS.hint >= HINTS.length || PS.step === "DONE";
  hintBtn.addEventListener("click", () => { PS.hint += 1; PS.msg = ""; sfx.whistle(); renderProblem(); });
  tools.append(readBtn, hintBtn);
  boardWrap.appendChild(tools);
  if (PS.hint > 0) boardWrap.appendChild(el("div", "hint-label", `Hint ${PS.hint}: ${HINTS[PS.hint - 1].label}`));
  game.appendChild(boardWrap);

  if (PS.hint >= 2) {
    const kc = el("div", "card key-card");
    kc.appendChild(el("div", "kicker", "Key word card"));
    for (const [phrase, meaning] of keyCard(p)) {
      const line = el("div", "kc-line"); line.innerHTML = `<b>${phrase}</b> → ${meaning}`; kc.appendChild(line);
    }
    game.appendChild(kc);
  }
  if (PS.hint >= 3) game.appendChild(el("div", "plan-line", planText(p)));

  const fb = el("div", "feedback-line" + (PS.msgKind ? " " + PS.msgKind : ""), PS.msg);
  fb.id = "feedback";
  game.appendChild(fb);

  // the lab itself, waiting, so the Wobblies are there from the first moment
  if (PS.step === "SOLVE") {
    const waitWrap = el("div", "stage-wrap");
    waitWrap.appendChild(buildStage(p, true));
    waitWrap.appendChild(el("div", "stage-caption", "The Wobblies are waiting. Answer it and they drop."));
    game.appendChild(waitWrap);
  }

  const deck = el("div", "deck");
  if (PS.step === "SOLVE") deck.appendChild(buildSolve(p));
  if (PS.step === "DONE") deck.appendChild(buildDone(p));
  game.appendChild(deck);
  app.appendChild(game);
}

/* ---------- Solve, then CHECK by multiplying back, then the drop ---------- */
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
    const box = el("button", "field" + (PS.active === f.k ? " active" : "")
      + (PS.active === f.k && PS.fields[f.k] === undefined ? " waiting" : ""));
    box.appendChild(el("span", "field-val", PS.fields[f.k] === undefined ? "" : String(PS.fields[f.k])));
    box.appendChild(el("span", "field-label", f.label));
    box.addEventListener("click", () => { PS.active = f.k; sfx.tap(); renderProblem(); });
    frow.appendChild(box);
  });
  wrap.appendChild(frow);
  const answered = fields.every((f) => PS.fields[f.k] !== undefined);
  if (!answered) wrap.appendChild(el("div", "pad-cue", "Tap the numbers below to fill in the answer"));
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
  }

  wrap.appendChild(buildPad());

  const row = el("div", "btn-row");
  const run = el("button", "btn primary", "Run the experiment 🧪");
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
        const i = order.indexOf(PS.active); PS.active = order[(i + 1) % order.length];
      } else {
        const s = (cur === undefined ? "" : String(cur)) + k;
        if (s.length <= 3) PS.fields[PS.active] = +s;
      }
      if (PS.active !== "prod" && k !== "next") delete PS.fields.prod;   // the check follows the answer: a stale product must not survive an edit
      sfx.tap(); PS.msg = ""; renderProblem();
    });
    pad.appendChild(b);
  });
  return pad;
}
function onRun(p) {
  const ans = PS.fields.ans, rem = PS.fields.rem, prod = PS.fields.prod;
  const hasRem = p.type.endsWith("_REM");
  const truth = p.type === "TOTAL" ? p.G : p.N;
  // 0. a TOTAL answer that will not split into K equal bins: there is no product to type, his check has already caught it
  if (p.type === "TOTAL" && ans % p.K !== 0) {
    PS.selfCaught = true;
    PS.msg = `Your check caught it! ${ans} doesn't split into ${p.K} equal bins, so ${ans} can't be the total. Fix the answer.`;
    PS.msgKind = "bad"; PS.fields = {}; PS.active = "ans"; sfx.miss(); renderProblem(); return;
  }
  // 1. his arithmetic in the check must be right — that slip is the skill the test marks
  const hisCheck = p.type === "TOTAL" ? ans / p.K : ans * p.K + (hasRem ? (rem || 0) : 0);
  if (prod !== hisCheck) {
    PS.wrongRun = true;
    PS.msg = p.type === "TOTAL"
      ? `Check your working: ${ans} ÷ ${p.K} isn't ${prod}.`
      : `Check your times: ${ans} × ${p.K}${hasRem ? " + " + rem : ""} isn't ${prod}. Try that bit again.`;
    PS.msgKind = "bad"; delete PS.fields.prod; PS.active = "prod"; sfx.miss(); renderProblem(); return;
  }
  // 2. HIS check disagreeing with the lab is him catching himself: no penalty
  const solved = P.verify.solve(p, ans, rem).ok;
  if (prod !== truth) {
    PS.selfCaught = true;
    PS.msg = p.type === "TOTAL"
      ? `Your check caught it! ${ans} ÷ ${p.K} = ${prod}, but there are ${p.G} bins. Fix the answer.`
      : `Your check caught it! ${ans} × ${p.K}${hasRem ? " + " + rem : ""} = ${prod}, but the lab has ${p.N}. Fix the answer.`;
    PS.msgKind = "bad"; PS.fields = {}; PS.active = "ans"; sfx.miss(); renderProblem(); return;
  }
  if (!solved) {
    // the check added up but the answer is still wrong (leftovers that would fill another bin): the app caught it, not him
    PS.wrongRun = true;
    PS.msg = `${rem} left over is enough to fill another bin. Share those out too.`;
    PS.msgKind = "bad"; PS.fields = {}; PS.active = "ans"; sfx.miss(); renderProblem(); return;
  }
  // 3. right, and verified by him: five stars less a star per hint, less one for a slip
  PS.stars = Math.max(1, 5 - PS.hint - (PS.wrongRun ? 1 : 0));
  G.stars += PS.stars; G.hintsUsed += PS.hint;
  if (PS.hint === 0) G.noHint += 1;
  if (PS.stars === 5) G.clean += 1;
  PS.msg = ""; PS.msgKind = "";
  PS.step = "DONE";
  renderProblem();
  const stageWrap = document.getElementById("stage-wrap");
  const myG = G;
  setTimeout(() => runDrop(p, stageWrap, () => {
    if (G !== myG || !stageWrap.isConnected) return;   // he tapped End mid-drop
    stageWrap.appendChild(el("div", "stamp", "VERIFIED"));
    const fact = document.getElementById("fact");
    if (fact) fact.textContent = p.type === "TOTAL" ? `${p.K} × ${p.G} = ${p.N} ✓` : `${p.q} × ${p.K}${p.r ? " + " + p.r : ""} = ${p.N} ✓`;
    sfx.verified();
    if (PS.stars === 5) setTimeout(() => popText(innerWidth / 2 - 90, 90, "⭐ CLEAN EXPERIMENT", true), 300);
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
function buildStage(p, waiting) {
  const stage = el("div", "stage" + (waiting ? " waiting" : ""));
  stage.appendChild(el("div", "chute"));
  if (waiting) {
    // a crate of Wobblies queued at the chute: enough to show what drops, never
    // enough to count instead of reading the request
    const crate = el("div", "crate");
    for (let i = 0; i < 7; i++) {
      const o = makeObj(p.obj.cls, "queued");
      o.style.setProperty("--tilt", (Math.round(Math.random() * 40) - 20) + "deg");
      crate.appendChild(o);
    }
    stage.appendChild(crate);
  }
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
/* an object for the stage. A Wobbly is a real figure — head, body, two arms,
   two legs — so its limbs can flail on the way down and settle where they land. */
function makeObj(cls, extra) {
  const o = el("div", "obj " + cls + (extra ? " " + extra : ""));
  if (cls === "wobbly") {
    for (const part of ["w-head", "w-body", "w-arm l", "w-arm r", "w-leg l", "w-leg r"]) o.appendChild(el("span", part));
    const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
    o.style.setProperty("--al", rnd(-95, -15) + "deg"); o.style.setProperty("--ar", rnd(15, 95) + "deg");
    o.style.setProperty("--ll", rnd(-55, -5) + "deg");  o.style.setProperty("--lr", rnd(5, 55) + "deg");
  }
  return o;
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
  // few per bin = big floppy Wobblies you can see; ten per bin = a heap that still fits
  const perBin = (p.type === "SHARE" || p.type === "SHARE_REM" || p.type === "FRACTION") ? p.q : p.K;
  const totalBins = grow ? p.q : binCount(p);
  const many = totalBins >= 8;                     // narrow bins so 8-10 fit on one row
  bins.classList.toggle("many", many);
  stage.style.setProperty("--s", many ? 0.8 : perBin <= 3 ? 1.6 : perBin <= 5 ? 1.35 : perBin <= 8 ? 1.1 : 1);
  const stagger = plan.length > 30 ? 55 : plan.length > 16 ? 80 : 110;
  let i = 0;
  const step = () => {
    if (!stage.isConnected) return;                  // the round ended under us
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
    const o = makeObj(p.obj.cls, "land");
    o.style.setProperty("--tilt", (Math.round(Math.random() * 120) - 60) + "deg");
    if (binEl === bench) o.style.setProperty("--tilt", (Math.random() < 0.5 ? 82 : -82) + "deg");   // flat out on the bench
    pile.appendChild(o);
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
  const o = makeObj(cls, "flyer");
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
  ], { duration: cls === "wobbly" ? 540 : 380, easing: "cubic-bezier(0.3, 0, 0.7, 1)" });   // a ragdoll gets time to flail
  anim.onfinish = land;
  setTimeout(land, 900);
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
  wrap.appendChild(el("div", "sub", `Level ${tier} · ${TIERS[tier].name}`));
  if (isBest && G.stars > 0) wrap.appendChild(el("div", "newbest", `⭐ New Level ${tier} record!`));

  // the line for Dad and the tutor: how much of it he did unaided
  const stats = el("div", "sum-stats");
  [[`${G.noHint}/${ROUND_LEN}`, "no hint needed"], [`${G.hintsUsed}`, "CUBES hints used"], [`${G.clean}`, "clean experiments"]]
    .forEach(([v, l]) => { const d = el("div", "stat"); d.innerHTML = `<b>${v}</b><br>${l}`; stats.appendChild(d); });
  wrap.appendChild(stats);

  const gate = G.stars / 30;
  if (gate >= 0.75) {
    const suggested = gate >= 0.97 ? 3 : 2;
    const entry = { choreName: `🧪 Drop Lab: ${G.stars}/30 (Level ${tier})`, coins: suggested,
      note: `${G.noHint} of ${ROUND_LEN} with no hint` + (G.stars >= 30 ? " — SPOTLESS!" : "") };
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
