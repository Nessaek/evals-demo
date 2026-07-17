export interface EvalResult {
  passed: boolean;
  score: number; // 0.0 to 1.0
  details: string;
  reasoning?: string; // Optional step-by-step logic, useful for LLM-as-a-judge
}

// Helper to compute Levenshtein Distance
export function calculateLevenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

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

// 1. Exact Match Evaluator
export function evalExactMatch(actual: string, expected: string): EvalResult {
  const a = actual.trim();
  const e = expected.trim();
  const passed = a === e;
  return {
    passed,
    score: passed ? 1.0 : 0.0,
    details: passed 
      ? "Direct exact match match succeeded." 
      : `Mismatch. Expected exact string "${e}", got "${a}".`
  };
}

// 2. Keyword Match Evaluator
export function evalKeywordMatch(actual: string, keywords: string[]): EvalResult {
  if (keywords.length === 0) {
    return { passed: true, score: 1.0, details: "No target keywords provided for matching." };
  }
  const cleanActual = actual.toLowerCase();
  const missing = keywords.filter(kw => !cleanActual.includes(kw.toLowerCase()));
  const passed = missing.length === 0;
  const score = (keywords.length - missing.length) / keywords.length;

  return {
    passed,
    score,
    details: passed
      ? `All ${keywords.length} required keywords found: [${keywords.join(', ')}]`
      : `Missing keywords: [${missing.join(', ')}]. Found: ${keywords.length - missing.length}/${keywords.length}`
  };
}

// 3. Distance Similarity Evaluator
export function evalSimilarity(actual: string, expected: string, threshold = 0.75): EvalResult {
  const s1 = actual.toLowerCase().trim();
  const s2 = expected.toLowerCase().trim();
  
  if (!s1 && !s2) return { passed: true, score: 1.0, details: "Both strings are empty." };
  
  const distance = calculateLevenshtein(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const score = maxLength === 0 ? 1.0 : 1.0 - (distance / maxLength);
  const passed = score >= threshold;

  return {
    passed,
    score,
    details: `Levenshtein Similarity: ${(score * 100).toFixed(1)}% | Target Threshold: ${(threshold * 100).toFixed(0)}% (Edit distance: ${distance} chars)`
  };
}

// 4. JSON Schema Validator
export function evalJsonSchema(actual: string, requiredKeys: string[]): EvalResult {
  try {
    const data = JSON.parse(actual.trim());
    if (typeof data !== 'object' || data === null) {
      return { passed: false, score: 0.0, details: "Parsed output is not a JSON object." };
    }

    const missing = requiredKeys.filter(key => !(key in data));
    const passed = missing.length === 0;
    
    // Partially pass: 0.5 score if JSON is valid but missing keys
    const score = passed ? 1.0 : 0.4;
    return {
      passed,
      score,
      details: passed
        ? `Valid JSON parsed successfully. Verified keys: [${requiredKeys.join(', ')}]`
        : `JSON parsed successfully, but missing keys: [${missing.join(', ')}].`
    };
  } catch (err: any) {
    return {
      passed: false,
      score: 0.0,
      details: `Failed JSON compilation/parsing: ${err.message}`
    };
  }
}

// 5. Simulated LLM-as-a-Judge Evaluator
export function evalLlmAsJudge(actual: string, criteria: string, testName: string): EvalResult {
  // We simulate a smart evaluator checking criteria.
  const lowerActual = actual.toLowerCase();
  
  let score = 1.0;
  let reasoning = "";
  
  if (testName.includes("Support") || criteria.includes("polite") || criteria.includes("helpful")) {
    const isPolite = lowerActual.includes("please") || lowerActual.includes("thank you") || lowerActual.includes("sincerely") || lowerActual.includes("hello") || lowerActual.includes("hi");
    const containsNumber = /\b\d{4,}\b|1-800/.test(lowerActual);
    
    if (isPolite && containsNumber) {
      score = 1.0;
      reasoning = `[JUDGE BOT REASONING]:
1. Criteria Check: Polite, respectful, and helpful. (Passed - greeting/politeness markers found)
2. Content Check: Presence of support numbers or details. (Passed - phone details parsed)
3. Output matches all constraints. Perfect helper response.`;
    } else if (isPolite) {
      score = 0.6;
      reasoning = `[JUDGE BOT REASONING]:
1. Criteria Check: Tone is polite and friendly. (Passed)
2. Content Check: Missing critical callback contact numbers. (Failed)
3. Verdict: Partially helpful. Score reduced to 3/5.`;
    } else if (containsNumber) {
      score = 0.4;
      reasoning = `[JUDGE BOT REASONING]:
1. Criteria Check: Tone is blunt or lacks standard supportive greeting. (Failed)
2. Content Check: Contains the support numbers. (Passed)
3. Verdict: Rude/unprofessional formatting. Score reduced to 2/5.`;
    } else {
      score = 0.2;
      reasoning = `[JUDGE BOT REASONING]:
1. Criteria Check: Tone is neutral to robotic. (Failed)
2. Content Check: Missing contact info. (Failed)
3. Verdict: Does not fulfill requirements. Score 1/5.`;
    }
  } else if (criteria.includes("sql") || criteria.includes("valid syntax")) {
    const hasSelect = lowerActual.includes("select");
    const hasWhere = lowerActual.includes("where");
    const hasJoin = lowerActual.includes("join") || lowerActual.includes("inner join");
    
    if (hasSelect && hasWhere && hasJoin) {
      score = 1.0;
      reasoning = `[JUDGE BOT REASONING]:
1. Syntax Validation: Query contains SELECT, JOIN and WHERE keywords.
2. Structure Check: Correct columns are isolated and condition is correctly applied.
3. Execution Simulation: Success. Fulfills request fully.`;
    } else if (hasSelect && hasWhere) {
      score = 0.7;
      reasoning = `[JUDGE BOT REASONING]:
1. Syntax Validation: SELECT and WHERE keywords located.
2. Structure Check: Missing table JOIN. The requested cross-reference is missing.
3. Execution Simulation: Would query only a single table, resulting in incomplete dataset. Fails core requirements.`;
    } else {
      score = 0.2;
      reasoning = `[JUDGE BOT REASONING]:
1. Syntax Validation: Lacks standard SELECT structures or conditions.
2. Execution Simulation: Invalid SQL statement. Fails grammar check.`;
    }
  } else {
    // Default fallback evaluations
    const length = actual.length;
    if (length > 250) {
      score = 0.9;
      reasoning = `[JUDGE BOT REASONING]:
1. Prompt Relevance: Good detailed response.
2. Structure Check: Output exceeds length constraints slightly.
3. Verdict: Grade 4.5/5.`;
    } else if (length > 50) {
      score = 1.0;
      reasoning = `[JUDGE BOT REASONING]:
1. Prompt Relevance: Concise and directly answers.
2. Format: Matches constraints.
3. Verdict: Grade 5/5.`;
    } else {
      score = 0.5;
      reasoning = `[JUDGE BOT REASONING]:
1. Prompt Relevance: Output is overly brief or terse.
2. Verdict: Grade 2.5/5. Needs additional detail.`;
    }
  }

  const passed = score >= 0.7;
  return {
    passed,
    score,
    details: `LLM-as-a-Judge score: ${(score * 5).toFixed(1)}/5.0 (${passed ? 'PASS' : 'FAIL'})`,
    reasoning
  };
}
