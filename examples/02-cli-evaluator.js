/**
 * CLI Evaluator Demo
 * 
 * Demonstrates how LLM evaluations ("evals") are written and run programmatically
 * in standard CI/CD pipelines or engineering workflows.
 */

// ANSI Color Helpers
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const BG_DARK = "\x1b[48;5;234m";

// 1. Evaluator Implementations
function evalExactMatch(actual, expected) {
  const cleanActual = actual.trim();
  const cleanExpected = expected.trim();
  return {
    passed: cleanActual === cleanExpected,
    score: cleanActual === cleanExpected ? 1.0 : 0.0,
    details: `Actual: "${cleanActual}" | Expected: "${cleanExpected}"`
  };
}

function evalKeywordMatch(actual, keywords) {
  const missing = keywords.filter(kw => !actual.toLowerCase().includes(kw.toLowerCase()));
  const passed = missing.length === 0;
  const score = (keywords.length - missing.length) / keywords.length;
  return {
    passed,
    score,
    details: passed 
      ? `All keywords found: [${keywords.join(', ')}]` 
      : `Missing keywords: [${missing.join(', ')}] (Found: ${keywords.length - missing.length}/${keywords.length})`
  };
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // Deletion
          dp[i][j - 1] + 1,    // Insertion
          dp[i - 1][j - 1] + 1 // Substitution
        );
      }
    }
  }
  return dp[m][n];
}

function evalSimilarity(actual, expected, threshold = 0.7) {
  const s1 = actual.toLowerCase().trim();
  const s2 = expected.toLowerCase().trim();
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const score = maxLength === 0 ? 1.0 : 1.0 - (distance / maxLength);
  const passed = score >= threshold;
  
  return {
    passed,
    score,
    details: `Similarity: ${(score * 100).toFixed(1)}% (Threshold: ${(threshold * 100).toFixed(0)}%, Edit Distance: ${distance})`
  };
}

function evalJsonValidity(actual, requiredKeys = []) {
  try {
    const data = JSON.parse(actual.trim());
    const missing = requiredKeys.filter(key => !(key in data));
    const passed = missing.length === 0;
    const score = passed ? 1.0 : 0.5; // penalty if keys are missing
    return {
      passed,
      score,
      details: passed 
        ? `Valid JSON. All required keys [${requiredKeys.join(', ')}] are present.` 
        : `Valid JSON, but missing required keys: [${missing.join(', ')}]`
    };
  } catch (e) {
    return {
      passed: false,
      score: 0.0,
      details: `Failed to parse JSON: ${e.message}`
    };
  }
}

// 2. Mock Prompt Executions for different Models
// Evals compare how prompt outputs perform against expectations.
const TEST_SUITE = [
  {
    id: 1,
    task: "Customer Service Address Retrieval",
    prompt: "What is the support email and phone number for ACME Corp?",
    evaluator: "keyword",
    params: ["support@acmecorp.com", "1-800-555-0199"],
    models: {
      "Model_A_Fast": "You can reach ACME Corp support via email at support@acmecorp.com or call our hotline at 1-800-555-0199. We are open 24/7.",
      "Model_B_Reasoning": "ACME Corp's customer assistance team is available at support@acmecorp.com. If you require voice support, please call 1-800-555-0199 during standard working hours.",
      "Model_C_Weak": "Support for ACME Corp can be reached by emailing help@acmecorp.com. Let me know if you need anything else."
    }
  },
  {
    id: 2,
    task: "Structured JSON Profile Extraction",
    prompt: "Extract: John Doe is a 29 year old Software Engineer living in New York.",
    evaluator: "json",
    params: ["name", "age", "role", "city"],
    models: {
      "Model_A_Fast": '{"name": "John Doe", "age": 29, "role": "Software Engineer", "city": "New York"}',
      "Model_B_Reasoning": '{\n  "name": "John Doe",\n  "age": 29,\n  "role": "Software Engineer",\n  "city": "New York"\n}',
      "Model_C_Weak": 'Name: John Doe, Age: 29, Occupation: Software Engineer, Location: New York. (Sorry, I cannot output JSON)'
    }
  },
  {
    id: 3,
    task: "Creative Translation (Exact Style)",
    prompt: "Translate 'Hello my friend' into French (just the direct informal translation, nothing else)",
    evaluator: "similarity",
    params: "Salut mon ami", // expected response
    models: {
      "Model_A_Fast": "Salut mon ami.", // Has punctuation
      "Model_B_Reasoning": "Salut mon ami", // Exact
      "Model_C_Weak": "In French, you would say 'Salut mon ami' or 'Bonjour mon ami' depending on the level of formality."
    }
  }
];

// 3. Running the Evals
console.clear();
console.log(`${BG_DARK}${CYAN}${BOLD}=====================================================${RESET}`);
console.log(`${BG_DARK}${CYAN}${BOLD}         LLM EVALUATIONS SUITE - RUNNING CLI         ${RESET}`);
console.log(`${BG_DARK}${CYAN}${BOLD}=====================================================${RESET}\n`);

const modelNames = ["Model_A_Fast", "Model_B_Reasoning", "Model_C_Weak"];
const results = {};

modelNames.forEach(m => {
  results[m] = { passed: 0, total: 0, totalScore: 0 };
});

TEST_SUITE.forEach((test, idx) => {
  console.log(`${BOLD}Test #${test.id}: ${test.task}${RESET}`);
  console.log(`Prompt: "${BLUE}${test.prompt}${RESET}"`);
  console.log(`Evaluator: ${YELLOW}${test.evaluator.toUpperCase()}${RESET}`);
  console.log(`-`.repeat(50));

  modelNames.forEach(model => {
    const output = test.models[model];
    let evalResult;

    if (test.evaluator === "exact") {
      evalResult = evalExactMatch(output, test.params);
    } else if (test.evaluator === "keyword") {
      evalResult = evalKeywordMatch(output, test.params);
    } else if (test.evaluator === "similarity") {
      evalResult = evalSimilarity(output, test.params);
    } else if (test.evaluator === "json") {
      evalResult = evalJsonValidity(output, test.params);
    }

    results[model].total++;
    results[model].totalScore += evalResult.score;
    if (evalResult.passed) {
      results[model].passed++;
    }

    const statusSymbol = evalResult.passed ? `${GREEN}✔ PASS${RESET}` : `${RED}✘ FAIL${RESET}`;
    const scoreVal = (evalResult.score * 100).toFixed(0);
    console.log(`  [${model}] -> ${statusSymbol} (Score: ${scoreVal}%)`);
    console.log(`    Output:  "${output.replace(/\n/g, ' ')}"`);
    console.log(`    Details: ${evalResult.details}`);
  });
  console.log(`\n`);
});

console.log(`${BG_DARK}${CYAN}${BOLD}=====================================================${RESET}`);
console.log(`${BG_DARK}${CYAN}${BOLD}                 LEADERBOARD SUMMARY                 ${RESET}`);
console.log(`${BG_DARK}${CYAN}${BOLD}=====================================================${RESET}`);

modelNames.forEach(model => {
  const stats = results[model];
  const passRate = ((stats.passed / stats.total) * 100).toFixed(0);
  const avgScore = ((stats.totalScore / stats.total) * 100).toFixed(0);
  
  let ratingColor = RED;
  if (stats.passed === stats.total) ratingColor = GREEN;
  else if (stats.passed > 0) ratingColor = YELLOW;

  console.log(`\n${BOLD}${model}${RESET}:`);
  console.log(`  Pass Rate: ${ratingColor}${passRate}%${RESET} (${stats.passed}/${stats.total} tests passed)`);
  console.log(`  Avg Score: ${CYAN}${avgScore}%${RESET}`);
});
console.log(`\n`);
