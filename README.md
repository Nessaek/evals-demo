# Evals Demo

Project to demo how evals work

## Running the examples

```bash
npm install

# 1. The minimal loop
npm run eval:minimal

# 2. The CLI tool with multiple evaluators + leaderboard
npm run eval:cli

# 3. The full web app
npm run dev
```

## Core concepts

- **Evaluator** — a function `(actualOutput, expectation) -> { passed, score, details }`. This repo implements four common kinds:
  - **Exact match** — strict string equality. Good for short, deterministic answers.
  - **Keyword match** — asserts required terms are present. Good for checking that key facts (a phone number, a required field) made it into free-form text.
  - **Similarity** — edit-distance based, for outputs that should be *close to* a target without matching character-for-character.
  - **JSON schema** — parses the output and checks required keys exist. Good for structured/tool-call outputs.
  - (The web app also simulates an **LLM-as-a-judge** evaluator, for qualitative criteria like tone or helpfulness that rigid string checks can't capture.)
- **Test case** — an input plus whatever the evaluator needs to grade the response (an expected string, required keywords, required JSON keys, judge criteria).
- **Model outputs** — in all three examples these are hardcoded/mocked rather than live API calls, so the examples run instantly and deterministically. Swapping the mock in for a real API call is the only change needed to make this a real eval suite.
- **Aggregation** — pass rate and average score per model, optionally alongside latency/cost, so you can compare models on more than just "did it pass."

## Why this matters

LLM outputs are non-deterministic, so you can't rely on manual spot-checks the way you might with traditional code. Evals give you a repeatable, automatable way to answer questions like "did this prompt change break anything?" or "is the cheaper model good enough for this task?" — the same way a test suite does for regular code.

## License

MIT — see [LICENSE](LICENSE).
