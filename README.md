# Drop Lab 🧪

CUBES word problems for Year 3 division, with bins that show the answer.

Every Experiment Request is a worded division problem with (usually) a sentence
of extra information. Professor Bin won't run the drop until it has been checked
with the tutor's CUBES card, letter for letter:

- **C** — Circle the numbers (tap them)
- **U** — Underline the question (tap the sentence)
- **B** — Box the key words (tap them; a Key Word Card then says what the phrase *means*)
- **E** — Eliminate extra information (tap a sentence to crumple it — or say "Nothing to cross out"),
  then Evaluate: is the question asking for how many in EACH, how many BINS, or the TOTAL? Build the sum.
- **S** — Solve, then CHECK by multiplying back — typed by him, never computed for him.
  Only then do the objects drop: sharing deals round-robin into fixed bins, grouping fills
  a bin then slides in the next, leftovers land on the bench, a fraction lights one bin.

Five stars per request, one per letter, only for first-try steps. The round summary
shows which letter is leaking. Rounds of six, no timer.

## Levels
1. Sharing — divisors 2, 3, 4, 5, 10, plus "half of"
2. Sharing & Grouping — divisors to 9, with some "how many altogether" so the operation is a real choice
3. Leftovers — remainders, sneakier distractors (the "each" price trap, yesterday's count, no-number sentences)
4. Fractions of a collection — a quarter of 12 is 12 shared into 4

About one request in four from Level 2 up has **nothing** to eliminate — real tests do that.

## Developing
- `node selftest.js` — generates 14,400 problems and asserts every invariant the verifiers rely on. Run before every deploy.
- `../bump.sh drop-lab` — bumps `version.js`, which the footer and the service-worker cache name both read.
- `record.html` — Safari booth for Dad's seven lesson lines (`audio/lesson-N.m4a`). Add them to `sw.js` ASSETS only once they exist.
- `print.html?tier=N` — six requests as a pencil worksheet. The test is on paper; do two after each session.
- Same-origin Trawley Coin bridge as the other ScupperLab apps.
