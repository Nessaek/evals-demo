// The entire idea of an "eval," stripped to its essence.

// 1. An evaluator: a function that scores an output against some expectation.
function evalKeywordMatch(output, keywords) {
  const missing = keywords.filter(kw => !output.toLowerCase().includes(kw.toLowerCase()));
  return { passed: missing.length === 0, missing };
}

// 2. A test case: a prompt, what we expect back, and each model's canned response.
const prompt = "What is the capital of France?";
const keywords = ["Paris"];
const modelOutputs = {
  good_model: "The capital of France is Paris.",
  bad_model: "France is a country in Europe with a rich history."
};

// 3. Run each model's output through the evaluator and report the result.
for (const [model, output] of Object.entries(modelOutputs)) {
  const result = evalKeywordMatch(output, keywords);
  console.log(`[${model}] ${result.passed ? "PASS" : "FAIL"}`);
  console.log(`  prompt:   "${prompt}"`);
  console.log(`  output:   "${output}"`);
  if (!result.passed) console.log(`  missing:  ${result.missing.join(", ")}`);
}
