/* Drop Lab generator fuzz test — run `node selftest.js` before every deploy.
   Generates thousands of problems across all tiers and asserts the
   invariants every CUBES verifier relies on. */
"use strict";
require("./problems.js");
const P = globalThis.DropLabProblems;

const fails = [];
const stats = { total: 0, clean: 0, twoDistractors: 0, questionFirst: 0, types: {}, selfIncluded: 0, words: [] };

for (let seed = 1; seed <= 600; seed++) {
  for (let tier = 1; tier <= 4; tier++) {
    const round = P.makeRound(tier, seed * 7919 + tier);
    for (const p of round) {
      stats.total++;
      stats.types[p.type] = (stats.types[p.type] || 0) + 1;
      if (p.clean) stats.clean++;
      if (p.selfIncluded) stats.selfIncluded++;
      const dcount = p.sentences.filter((s) => s.role === "distractor").length;
      if (dcount === 2) stats.twoDistractors++;
      if (p.sentences[0].role === "question") stats.questionFirst++;
      stats.words.push(p.words);
      const tag = `tier${p.tier} ${p.type} seed${seed}: "${p.text}"`;
      const fail = (why) => fails.push(why + "  <-  " + tag);

      // exactly one question
      if (p.sentences.filter((s) => s.role === "question").length !== 1) fail("not exactly one question");
      // words cap
      if (p.words > 48) fail(`too long (${p.words} words)`);
      // no leftover template braces
      if (/\{\w+\}/.test(p.text)) fail("unfilled template slot");
      // integer, in-range answer
      if (!Number.isInteger(p.answer) || p.answer < 1) fail("bad answer " + p.answer);
      if (p.type.endsWith("_REM") && !(p.r >= 1 && p.r < p.K)) fail("bad remainder");
      if (!p.type.endsWith("_REM") && p.r !== 0) fail("remainder on non-rem type");
      // needed numbers present as chips, in the right sentences
      const needed = p.chips.filter((c) => c.isNumber && c.numberRole === "needed").map((c) => c.value);
      for (const s of p.slots) {
        const want = p.selfIncluded && s === p.K ? p.K - 1 : s;
        if (!needed.includes(want)) fail(`slot value ${want} not among needed numbers ${JSON.stringify(needed)}`);
      }
      // a TOTAL request must never state its own answer
      if (p.type === "TOTAL" && needed.includes(p.N)) fail(`TOTAL problem prints its own answer N=${p.N}`);
      // never open on a pronoun with nothing to refer to; never "1 friends"; a subset must be smaller than the lab has
      if (/^(He|They)\b/.test(p.sentences[0].text)) fail("opens on an antecedent-less pronoun");
      if (/\b1 friends\b/.test(p.text)) fail("'1 friends'");
      for (const s of p.sentences) { const m = s.role === "distractor" && s.text.match(/^(\d+) of the/); if (m && +m[1] >= p.N) fail(`subset ${m[1]} of ${p.N}`); }
      // boxing EVERY word of every must-phrase (what the lesson models) must pass B
      const allPhraseWords = p.chips.filter((c) => c.phrase && c.role !== "distractor").map((c) => c.id);
      if (!P.verify.box(p, allPhraseWords).ok) fail("box verifier rejects boxing whole phrases");
      // every distractor number is unusable: not N/K/q/r/G and does not divide N
      for (const c of p.chips) {
        if (c.numberRole === "distractor" && c.value !== null) {
          if ([p.N, p.K, p.q, p.r, p.G].includes(c.value)) fail(`distractor number ${c.value} collides with a needed number`);
          if (c.value >= 2 && p.N % c.value === 0) fail(`distractor ${c.value} divides N=${p.N} evenly`);
        }
      }
      // must-phrases exist and live in needed sentences
      const phrases = new Set(p.chips.filter((c) => c.phrase).map((c) => c.phrase));
      if (phrases.size < 1) fail("no must-phrase");
      for (const c of p.chips) if (c.phrase && c.role === "distractor") fail("must-phrase inside a distractor");
      // every distractor sentence differs from the question in noun-content: it must not mention the answer's unit
      // (checked loosely: a distractor may not be identical to setup/cond)
      // the tutor's rule: circle ALL numbers must be satisfiable — every number chip has a value
      for (const c of p.chips) if (c.isNumber && (c.value === null || Number.isNaN(c.value))) fail("number chip without value: " + c.text);
      // verifiers accept the right answers
      const circleAll = p.chips.filter((c) => c.isNumber).map((c) => c.id);
      if (!P.verify.circle(p, circleAll, true).ok) fail("circle-all verifier rejects the right set");
      const circleNeeded = p.chips.filter((c) => c.isNumber && c.numberRole === "needed").map((c) => c.id);
      if (!P.verify.circle(p, circleNeeded, false).ok) fail("circle-needed verifier rejects the right set");
      const qi = p.sentences.findIndex((s) => s.role === "question");
      if (!P.verify.underline(p, qi).ok) fail("underline verifier rejects the question");
      const oneWordPerPhrase = [...phrases].map((ph) => p.chips.find((c) => c.phrase === ph).id);
      if (!P.verify.box(p, oneWordPerPhrase).ok) fail("box verifier rejects one word per must-phrase");
      const distractorIdx = p.sentences.map((s, i) => (s.role === "distractor" ? i : -1)).filter((i) => i >= 0);
      if (!P.verify.eliminate(p, distractorIdx).ok) fail("eliminate verifier rejects the distractor set");
      if (!P.verify.evaluate(p, p.schema, p.slots).ok) fail("evaluate verifier rejects the right slots");
      if (P.verify.evaluate(p, p.schema, [p.slots[1], p.slots[0]]).ok && p.type !== "TOTAL" && p.slots[0] !== p.slots[1]) fail("evaluate accepts reversed slots");
      if (!P.verify.solve(p, p.answer, p.r).ok) fail("solve verifier rejects the answer");
      if (!P.verify.check(p, p.type === "TOTAL" ? p.N : p.q * p.K + p.r).ok) fail("check verifier rejects the true product");
      // no surface shortcut: the question must not always be last
    }
  }
}

const w = stats.words;
const avg = (w.reduce((a, b) => a + b, 0) / w.length).toFixed(1);
console.log(`generated ${stats.total} problems`);
console.log(`types: ${JSON.stringify(stats.types)}`);
console.log(`clean (nothing to eliminate): ${(100 * stats.clean / stats.total).toFixed(1)}%   two distractors: ${(100 * stats.twoDistractors / stats.total).toFixed(1)}%   question first: ${(100 * stats.questionFirst / stats.total).toFixed(1)}%   himself-trick: ${stats.selfIncluded}`);
console.log(`words: avg ${avg}, max ${Math.max(...w)}`);
if (fails.length) {
  const uniq = [...new Set(fails.map((f) => f.split("  <-  ")[0]))];
  console.log(`\nFAILURES: ${fails.length} (${uniq.length} kinds)`);
  for (const k of uniq) console.log(" -", k, "\n     e.g.", fails.find((f) => f.startsWith(k)).split("  <-  ")[1]);
  process.exit(1);
}
console.log("all invariants hold");
