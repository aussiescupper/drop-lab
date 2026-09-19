/* Drop Lab — problem generator + tokeniser.
   Pure logic, no DOM: loaded by the app AND by `node selftest.js`.

   Every problem is built from a schema, never free text, so each CUBES step
   can be verified by set comparison:
     C  circled chips   == every number chip (or only the needed ones, tutor's call)
     U  underlined      == the one sentence whose role is "question"
     B  boxed           ⊇ one word of every must-phrase, and no numbers
     E  crumpled        == the distractor sentences (possibly none — say so)
        slots           == the two numbers the sum actually needs, in order
     S  typed answer    == q (and r), then HIS multiplication check hits N

   Schema (equal groups): every story has a TOTAL, a number of GROUPS and an
   amount in EACH. Two are given, one is the question:
     SHARE      total + groups   → each      (partitive)    N ÷ K
     GROUP      total + each     → groups    (quotitive)    N ÷ K
     TOTAL      groups + each    → total     (multiply)     K × G
     FRACTION   "a quarter of N" → share into 4             N ÷ K
     *_REM      leftovers version of share/group            N ÷ K = q r */
(function (root) {
  "use strict";

  // Wobblies (the ragdoll test-dummies) are the headline act, so they are drawn
  // most often; the rest keep the wording varied. weight = relative frequency.
  const OBJECTS = [
    { sing: "Wobbly",       plur: "Wobblies",      cls: "wobbly", weight: 6 },
    { sing: "rubber duck",  plur: "rubber ducks",  cls: "duck",   weight: 2 },
    { sing: "bouncy ball",  plur: "bouncy balls",  cls: "ball",   weight: 1 },
    { sing: "spring",       plur: "springs",       cls: "spring", weight: 1 },
    { sing: "glow stick",   plur: "glow sticks",   cls: "glow",   weight: 1 },
    { sing: "watermelon",   plur: "watermelons",   cls: "melon",  weight: 1 },
  ];
  function pickObject(rng, opts) {
    if (opts && opts.objCls) return OBJECTS.find((o) => o.cls === opts.objCls) || OBJECTS[0];
    const total = OBJECTS.reduce((a, o) => a + o.weight, 0);
    let x = rng() * total;
    for (const o of OBJECTS) { x -= o.weight; if (x < 0) return o; }
    return OBJECTS[0];
  }
  const OTHER = ["spare crash helmets", "safety cones", "empty crates", "clipboards", "lab coats", "wobbly ladders"];
  const FRACTIONS = [
    { word: "half",    k: 2  },
    { word: "third",   k: 3  },
    { word: "quarter", k: 4  },
    { word: "fifth",   k: 5  },
    { word: "tenth",   k: 10 },
  ];
  const DIVISORS = { 1: [2, 3, 4, 5, 10], 2: [2, 3, 4, 5, 6, 7, 8, 9, 10], 3: [3, 4, 5, 6, 7, 8, 9], 4: [2, 3, 4, 5, 10] };

  /* ---------- seeded rng ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  /* ---------- sentence templates ----------
     [square brackets] mark a must-phrase: boxing any word of it counts at B.
     {N} {K} {G} {q} {plur} {sing} {other} {d} {frac} are filled in. */
  // TOTAL problems get a setup with NO number in it, otherwise the setup states the answer
  const SETUP_TOTAL = [
    "Professor Bin is loading the crate for today's drop test.",
    "The Drop Lab is packing {plur} for the next drop.",
    "Henry is getting the {plur} ready on the loading dock.",
  ];
  const SETUP = [
    "The Drop Lab got {N} {plur} for today's drop test.",
    "Professor Bin tipped {N} {plur} into the big crate.",
    "There are {N} {plur} waiting on the loading dock.",
    "Henry counted {N} {plur} in the delivery.",
  ];
  const COND = {
    SHARE: [
      "Henry [shares them equally between] {K} bins.",
      "He [shares them equally between] {K} bins.",
      "They are [shared equally between] {K} bins.",
      "He [splits them evenly between] {K} bins.",
    ],
    GROUP: [
      "Henry packs {K} {plur} [into each bin].",
      "He puts {K} {plur} [into every bin].",
      "Each bin [holds exactly] {K} {plur}.",
    ],
    TOTAL: [
      "There are {G} bins, and Henry packs {K} {plur} [into each bin].",
      "Henry fills {G} bins with {K} {plur} [in each bin].",
    ],
    FRACTION: [
      "[{fracA} of] the {plur} are red.",
      "Professor Bin painted [{fracA} of] the {plur} red.",
    ],
  };
  const QUESTION = {
    SHARE:     ["[How many] {plur} land [in each] bin?", "[How many] {plur} go [in each] bin?", "Work out [how many] {plur} are [in each] bin."],
    GROUP:     ["[How many bins] does he fill?", "[How many bins] does he need?", "Work out [how many bins] get filled."],
    SHARE_REM: ["[How many] {plur} land [in each] bin, and how many are [left over]?"],
    GROUP_REM: ["[How many] full bins does he make, and how many {plur} are [left over]?"],
    TOTAL:     ["[How many] {plur} does he pack [altogether]?", "[How many] {plur} are there [in total]?"],
    FRACTION:  ["[How many] {plur} are red?", "Work out [how many] {plur} are red."],
  };
  const SELF_COND = "He [shares them equally between] himself and {K1} friends.";
  const SELF_Q    = "[How many] does [each] person get?";

  /* distractors: every one either carries a number that must NOT be usable, or
     no number at all (so 'the one with the odd number' is not a reliable rule) */
  const DISTRACTORS = [
    { id: "D1", minTier: 1, t: "The lab also has {d} {other} on the shelf.",  d: (r) => R(r, 2, 19) },
    { id: "D2", minTier: 1, t: "The test starts at {d} o'clock.",            d: (r) => R(r, 1, 11) },
    { id: "D3", minTier: 1, t: "The tallest Wobbly is {d} metres tall.",     d: (r) => R(r, 2, 9)  },
    { id: "D4", minTier: 2, t: "The experiment is in Bay {d}.",              d: (r) => R(r, 1, 9)  },
    { id: "D5", minTier: 3, t: "Each {sing} cost ${d}.",                     d: (r) => R(r, 2, 9)  },   // 'each' keyword trap
    { id: "D6", minTier: 3, t: "Yesterday the lab tested {d} {plur}.",       d: (r) => R(r, 11, 49) }, // same noun, wrong day
    { id: "D7", minTier: 4, t: "{d} of the {plur} are green.",               d: (r) => R(r, 2, 9), notFor: ["FRACTION"] },
    { id: "D0", minTier: 3, t: "Professor Bin wore his lucky socks today.",  d: null },                // no number at all
  ];

  /* ---------- number choice ---------- */
  function numbersFor(type, tier, rng, opts) {
    const divs = DIVISORS[tier] || DIVISORS[2];
    if (type === "FRACTION") {
      const fr = tier === 1 ? FRACTIONS[0] : pick(rng, FRACTIONS.filter((f) => f.k !== 2 || rng() < 0.3));
      const q = R(rng, 2, 9);
      return { K: fr.k, q, N: fr.k * q, r: 0, frac: fr };
    }
    if (type === "TOTAL") {
      const K = pick(rng, divs), G = R(rng, 2, 9);
      return { K, G, N: K * G, q: G, r: 0 };
    }
    const K = pick(rng, divs);
    const q = R(rng, 2, Math.min(tier === 1 ? 9 : 10, Math.floor((tier === 1 ? 50 : 60) / K)));
    let r = 0;
    if (type === "SHARE_REM" || type === "GROUP_REM") r = R(rng, 1, K - 1);
    return { K, q, r, N: K * q + r };
  }

  function typeFor(tier, rng, slot) {
    // slot: 0-4 current tier, 5 bonus from next tier
    if (tier === 1) return rng() < 0.2 ? "FRACTION" : "SHARE";           // 'half of' is the on-ramp fraction
    if (tier === 2) { const x = rng(); return x < 0.4 ? "SHARE" : x < 0.8 ? "GROUP" : "TOTAL"; }
    if (tier === 3) { const x = rng(); return x < 0.35 ? "SHARE_REM" : x < 0.7 ? "GROUP_REM" : x < 0.85 ? "GROUP" : "TOTAL"; }
    const x = rng(); return x < 0.5 ? "FRACTION" : x < 0.7 ? "SHARE" : x < 0.85 ? "GROUP_REM" : "TOTAL";
  }

  function fill(t, v) {
    const out = t.replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? String(v[k]) : `{${k}}`));
    return out.replace(/^(\[?)([a-z])/, (_, b, ch) => b + ch.toUpperCase());   // sentences start with a capital
  }

  /* ---------- the generator ---------- */
  function makeProblem(tier, rng, opts) {
    opts = opts || {};
    tier = Math.max(1, Math.min(4, tier | 0));
    const type = opts.type || typeFor(tier, rng);
    const nums = numbersFor(type, tier, rng, opts);
    const obj = pickObject(rng, opts);
    const v = { N: nums.N, K: nums.K, G: nums.G, q: nums.q, plur: obj.plur, sing: obj.sing,
                frac: nums.frac && nums.frac.word,
                fracA: nums.frac && (nums.frac.k === 2 ? "half" : "a " + nums.frac.word) };

    // the 'himself and 3 friends' trick — divisor is one more than the number printed
    const selfIncluded = type === "SHARE" && tier >= 3 && nums.K >= 3 && rng() < 0.18;
    if (selfIncluded) v.K1 = nums.K - 1;

    const baseType = type.replace("_REM", "");
    const setup = fill(pick(rng, type === "TOTAL" ? SETUP_TOTAL : SETUP), v);
    const cond = selfIncluded ? fill(SELF_COND, v) : fill(pick(rng, COND[baseType]), v);
    const question = selfIncluded ? fill(SELF_Q, v) : fill(pick(rng, QUESTION[type]), v);

    // distractors: tier 1 always one; from tier 2 about one problem in four is clean
    const forbidden = new Set([nums.N, nums.K, nums.q, nums.r, nums.G].filter((x) => x !== undefined));
    const distractors = [];
    const clean = tier >= 2 && rng() < 0.25 && !opts.forceDistractor;
    if (!clean) {
      const count = tier >= 3 && rng() < 0.3 ? 2 : 1;
      const pool = DISTRACTORS.filter((d) => d.minTier <= tier && !(d.notFor || []).includes(type));
      const used = new Set();
      const wc = (t) => t.replace(/[\[\]]/g, "").split(/\s+/).length;
      let budget = 46 - wc(setup) - wc(cond) - wc(question);
      for (let i = 0; i < count && pool.length; i++) {
        let dd, tries = 0;
        do { dd = pick(rng, pool); tries++; } while (used.has(dd.id) && tries < 20);
        used.add(dd.id);
        let d = null;
        if (dd.d) {
          for (let k = 0; k < 40; k++) {
            d = dd.d(rng);
            // never a number that could pass for the answer, and never one that divides N evenly
            if (!forbidden.has(d) && (d < 2 || nums.N % d !== 0) && !(dd.id === "D7" && d >= nums.N)) break;
            d = null;
          }
          if (d === null) continue;
        }
        const sentence = fill(dd.t, Object.assign({ d, other: pick(rng, OTHER) }, v));
        if (wc(sentence) > budget) continue;
        budget -= wc(sentence);
        distractors.push(sentence);
      }
    }

    // ordering: tier 1-2 question last; tier 3-4 the question may open the problem
    const statements = [setup, cond];
    const withD = statements.slice();
    for (const d of distractors) withD.splice(R(rng, 1, withD.length), 0, d);
    // from tier 2 the condition sometimes comes before the total, but only a
    // sentence that stands on its own may open a request ("He shares them..." may not)
    const standalone = !/^(He|They)\b/.test(cond) && !/\bthem\b/.test(cond) && !selfIncluded;
    if (tier >= 2 && standalone && rng() < 0.3) {
      const i = withD.indexOf(setup), j = withD.indexOf(cond);
      if (i < j) { withD[i] = cond; withD[j] = setup; }
    }
    const questionFirst = tier >= 3 && rng() < 0.3;
    const ordered = questionFirst ? [question, ...withD] : [...withD, question];

    const sentences = ordered.map((text) => ({
      text: text.replace(/[\[\]]/g, ""),
      raw: text,
      role: text === question ? "question" : distractors.includes(text) ? "distractor" : text === setup ? "setup" : "condition",
    }));

    const schema = type === "TOTAL" ? "TOTAL" : baseType === "GROUP" ? "GROUP" : "EACH";   // what is missing
    const slots = type === "TOTAL" ? [nums.K, nums.G] : [nums.N, nums.K];
    const answer = type === "TOTAL" ? nums.N : nums.q;

    const p = {
      tier, type, baseType, schema, obj, selfIncluded,
      N: nums.N, K: nums.K, G: nums.G, q: nums.q, r: nums.r, frac: nums.frac || null,
      answer, slots, clean, sentences,
    };
    p.chips = tokenise(p);
    p.text = sentences.map((s) => s.text).join(" ");
    p.words = p.text.split(/\s+/).length;
    return p;
  }

  /* ---------- tokeniser ----------
     Word-level chips. A must-phrase's words carry the same phrase id; boxing
     any one of them satisfies that phrase. Number chips: numerals, "$5",
     "Bay 3"'s 3, and the fraction word in a fraction problem. */
  function tokenise(p) {
    const chips = [];
    let phraseSeq = 0;
    p.sentences.forEach((s, si) => {
      let inPhrase = null;
      const parts = s.raw.split(/(\[|\]|\s+)/).filter((x) => x && !/^\s+$/.test(x));
      parts.forEach((part) => {
        if (part === "[") { inPhrase = ++phraseSeq; return; }
        if (part === "]") { inPhrase = null; return; }
        const word = part;
        const bare = word.replace(/[^\w$/]/g, "");
        const isNumeral = /^\$?\d+$/.test(bare);
        const isFracWord = p.frac && bare.toLowerCase() === p.frac.word;
        const isNumber = isNumeral || !!isFracWord;
        let value = null;
        if (isNumeral) value = parseInt(bare.replace("$", ""), 10);
        if (isFracWord) value = p.frac.k;
        const chip = {
          id: chips.length, text: word, sid: si, role: s.role,
          isNumber, value,
          numberRole: isNumber ? (s.role === "distractor" ? "distractor" : "needed") : null,
          phrase: inPhrase,                                  // must-phrase id or null
          key: inPhrase ? "must" : null,
        };
        chips.push(chip);
      });
    });
    return chips;
  }

  /* ---------- verifiers (return {ok, msg}) ---------- */
  const V = {
    circle(p, circled, circleAll) {
      const want = new Set(p.chips.filter((c) => c.isNumber && (circleAll || c.numberRole === "needed")).map((c) => c.id));
      const got = new Set(circled);
      const extra = [...got].filter((id) => !want.has(id));
      const missing = [...want].filter((id) => !got.has(id));
      if (!extra.length && !missing.length) return { ok: true };
      if (extra.length) {
        const c = p.chips[extra[0]];
        return { ok: false, msg: c.isNumber ? "That number is in a sentence you don't need. Leave it for now — but the tutor's way is to circle every number first." : `"${c.text}" is a word, not a number.` };
      }
      return { ok: false, msg: `There ${want.size === 1 ? "is 1 number" : "are " + want.size + " numbers"} hiding. You caught ${got.size}.`, missing };
    },
    underline(p, sid) {
      if (sid === null || sid === undefined) return { ok: false, msg: "Tap the sentence that ASKS something." };
      const s = p.sentences[sid];
      if (s.role === "question") return { ok: true };
      return { ok: false, msg: "That sentence TELLS you something. The question ASKS you something." };
    },
    box(p, boxed) {
      const got = new Set(boxed);
      const numBoxed = [...got].find((id) => p.chips[id].isNumber && !p.chips[id].phrase);   // 'quarter' is both
      if (numBoxed !== undefined) return { ok: false, msg: "Numbers get circles, not boxes." };
      const phrases = new Set(p.chips.filter((c) => c.phrase && c.role !== "distractor").map((c) => c.phrase));
      const hit = new Set([...got].map((id) => p.chips[id].phrase).filter(Boolean));
      const missingPhrase = [...phrases].find((ph) => !hit.has(ph));
      if (missingPhrase) {
        const words = p.chips.filter((c) => c.phrase === missingPhrase).map((c) => c.text).join(" ");
        return { ok: false, msg: "There's a key phrase you haven't boxed yet — the words that tell you what to DO.", hint: words };
      }
      const phraseWords = p.chips.filter((c) => c.phrase && c.role !== "distractor").length;
      if (got.size > phraseWords + 3) return { ok: false, msg: "Keep the boxes for the words that tell you what to DO." };
      return { ok: true };
    },
    eliminate(p, crumpled) {
      const want = new Set(p.sentences.map((s, i) => (s.role === "distractor" ? i : -1)).filter((i) => i >= 0));
      const got = new Set(crumpled);
      const wrong = [...got].find((i) => !want.has(i));
      if (wrong !== undefined) return { ok: false, msg: "The boss needs that one! It has something the question is about.", bounce: wrong };
      const missing = [...want].find((i) => !got.has(i));
      if (missing !== undefined) return { ok: false, msg: "There's still a sentence about something the question never asks for." };
      return { ok: true };
    },
    evaluate(p, schemaPick, slotVals) {
      if (schemaPick !== p.schema) {
        const name = { EACH: "how many in EACH bin", GROUP: "how many BINS", TOTAL: "the TOTAL" }[p.schema];
        return { ok: false, msg: `Read the question again — it's asking for ${name}.` };
      }
      const [a, b] = slotVals;
      if (a === null || b === null) return { ok: false, msg: "Put a number in both spaces." };
      if (p.type === "TOTAL") {
        if ((a === p.K && b === p.G) || (a === p.G && b === p.K)) return { ok: true };
        return { ok: false, msg: "For the total you multiply the bins by what's in each one." };
      }
      if (a === p.slots[0] && b === p.slots[1]) return { ok: true };
      if (a === p.slots[1] && b === p.slots[0]) return { ok: false, msg: `Can ${a} ${p.obj.plur} fill ${b} bins? The big number is what you're splitting — it goes first.` };
      return { ok: false, msg: "One of those numbers isn't part of this sum." };
    },
    solve(p, ans, rem) {
      if (ans === null || ans === undefined) return { ok: false, msg: "Type your answer first." };
      const hasRem = p.type.endsWith("_REM");
      if (ans === p.answer && (!hasRem || rem === p.r)) return { ok: true };
      return { ok: false };
    },
    // the CHECK is his: he types the product (or the product plus leftovers) and it must hit N
    check(p, product) {
      return { ok: product === p.N };
    },
  };

  /* ---------- match the number sentence ----------
     The worksheet style: don't work it out, just say which sum this story IS.
     That is the E of CUBES on its own — the translation, with the arithmetic
     taken out of the way, which is where the marks are actually lost.

     The wrong tiles are the three real mistakes, not padding:
       K / N   the numbers the wrong way round (the classic)
       N * K   "each" read as multiply
       N +- K  an operation grabbed from nowhere
     and, when the story carries a red herring, that number used as the divisor —
     which is the same skill as the E of eliminating it. */
  function matchOptions(p, rng) {
    const V2 = { "\u00f7": (a, b) => a / b, "\u00d7": (a, b) => a * b, "+": (a, b) => a + b, "-": (a, b) => a - b };
    const S = (a, op, b) => ({ t: `${a} ${op} ${b}`, v: V2[op](a, b) });
    const correct = p.type === "TOTAL" ? S(p.K, "\u00d7", p.G) : S(p.N, "\u00f7", p.K);

    const pool = [];
    if (p.type === "TOTAL") {
      // never offer G x K: that is the same sum commuted, so it would be right too
      pool.push(
        { s: S(p.N, "\u00f7", p.K), why: "That shares the total out. The total is what you're being asked for." },
        { s: S(p.G, "\u00f7", p.K), why: "Dividing here makes the answer smaller. Filling bins makes it bigger." },
        { s: S(p.K, "+", p.G),       why: "Adding gives one bin plus the number of bins, which isn't a thing." },
        { s: S(p.N, "\u00f7", p.G), why: "That shares the total out. The total is what you're being asked for." },
        { s: S(p.N, "-", p.K),       why: "Taking away doesn't fill bins." },
      );
    } else {
      pool.push(
        { s: S(p.K, "\u00f7", p.N), why: "Those are round the wrong way. The big number gets shared out, not the small one." },
        { s: S(p.N, "\u00d7", p.K), why: "Times makes it bigger. Sharing out makes it smaller." },
        { s: S(p.N, "-", p.K),       why: "Taking away isn't sharing. Every bin has to get the same." },
        { s: S(p.N, "+", p.K),       why: "Adding them together doesn't share anything out." },
      );
      // the red herring, used as a divisor: eliminating it is the whole point
      const red = p.chips.filter((c) => c.isNumber && c.numberRole === "distractor")
        .map((c) => parseInt(c.text, 10))
        .filter((d) => d > 1 && d !== p.K && d !== p.N);
      if (red.length) pool.unshift({ s: S(p.N, "\u00f7", red[0]), why: `The ${red[0]} is in a sentence the question never asks about.` });
    }

    // Three wrong tiles. A tile is rejected if it reads the same as another OR
    // if it arrives at the right answer by a wrong route — "4 - 2" when the
    // answer is 2 is unmarkable, and the pool is stocked deep enough to spare it.
    const truth = correct.v;
    const wrong = [];
    const seen = new Set([correct.t]);
    for (const c of pool) {
      if (wrong.length === 3) break;
      if (seen.has(c.s.t) || c.s.v === truth) continue;
      seen.add(c.s.t); wrong.push(c);
    }
    const options = [{ t: correct.t, ok: true, why: "" }, ...wrong.map((c) => ({ t: c.s.t, ok: false, why: c.why }))];
    // shuffle, so the answer isn't always first
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { options, correct: correct.t, answer: truth };
  }

  function makeRound(tier, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed | 0);
    const out = [];
    const keys = new Set();
    for (let i = 0; i < 6; i++) {
      const t = i === 5 ? Math.min(4, tier + 1) : tier;        // last one is a bonus from the next tier
      let p, tries = 0;
      do { p = makeProblem(t, rng, { forceDistractor: i === 0, objCls: opts.objCls }); tries++; }
      while (keys.has(p.N + "/" + p.K + "/" + p.type) && tries < 30);
      keys.add(p.N + "/" + p.K + "/" + p.type);
      p.bonus = i === 5;
      out.push(p);
    }
    return out;
  }

  root.DropLabProblems = { makeProblem, makeRound, matchOptions, tokenise, verify: V, OBJECTS, FRACTIONS, mulberry32 };
})(typeof self !== "undefined" ? self : globalThis);
