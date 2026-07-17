export interface ModelDef {
  id: string;
  name: string;
  provider: string;
  costPerM: number; // USD per 1M tokens
  avgLatency: number; // milliseconds
  reliability: number; // percent
}

export interface TestCase {
  id: string;
  input: string;
  expected?: string;
  keywords?: string[];
  requiredKeys?: string[];
  criteria?: string; // for LLM as a judge
}

export interface EvalSuite {
  id: string;
  name: string;
  description: string;
  evaluatorType: 'exact' | 'keyword' | 'similarity' | 'json' | 'llm-judge';
  promptTemplate: string;
  testCases: TestCase[];
  mockOutputs: Record<string, Record<string, string>>; // modelId -> testCaseId -> response string
}

export const MODELS: ModelDef[] = [
  {
    id: "fast-llm-v1",
    name: "Fast-LLM v1",
    provider: "OpenAI-Mock",
    costPerM: 0.50,
    avgLatency: 120,
    reliability: 95
  },
  {
    id: "reasoning-llm-v2",
    name: "Reasoning-LLM v2",
    provider: "Anthropic-Mock",
    costPerM: 15.00,
    avgLatency: 850,
    reliability: 99
  },
  {
    id: "weak-llm-v0",
    name: "Legacy-LLM v0",
    provider: "Meta-Mock",
    costPerM: 0.15,
    avgLatency: 60,
    reliability: 82
  }
];

export const PRESETS: EvalSuite[] = [
  {
    id: "customer-support",
    name: "Customer Support Polite Tone & Contact Info Check",
    description: "Evaluates support answers for tone, safety, politeness, and inclusion of the specific customer support hotline.",
    evaluatorType: "llm-judge",
    promptTemplate: "You are a customer support agent. Answer the following user complaint: {{input}}\nRemember to remain extremely polite, offer apologies, and provide our help hotline (1-800-555-0100).",
    testCases: [
      {
        id: "cs-1",
        input: "My order is delayed for two weeks and I missed my anniversary gift!",
        criteria: "Apologizes sincerely, maintains polite tone, and includes contact hotline (1-800-555-0100)."
      },
      {
        id: "cs-2",
        input: "The product arrived broken! I want a full refund immediately!",
        criteria: "Polite response offering refund instructions, apologizes for damages, and provides help hotline (1-800-555-0100)."
      }
    ],
    mockOutputs: {
      "fast-llm-v1": {
        "cs-1": "Dear Customer, I am very sorry to hear that your order has been delayed. This is definitely not the experience we want you to have. For further help, please contact our support hotline at 1-800-555-0100. Best regards.",
        "cs-2": "We apologize that your item arrived broken. We can process a refund for you. Please call our help line at 1-800-555-0100 to initiate the return process immediately. Thank you."
      },
      "reasoning-llm-v2": {
        "cs-1": "Hello, I am incredibly sorry to hear that your package did not arrive in time for your anniversary. I understand how disappointing this must be. I have checked your tracking details, and we are working to expedite it. If you'd like us to issue a credit or need urgent help, please reach out to our team at 1-800-555-0100. Sincerely, Customer Care.",
        "cs-2": "Oh no, I am so sorry to hear the product arrived broken! We want to fix this right away. You are absolutely entitled to a full refund or replacement. Please contact our support team at 1-800-555-0100, and we will issue your refund immediately without any hassle. Have a wonderful day!"
      },
      "weak-llm-v0": {
        "cs-1": "Your package is delayed. If you want support, email us at help@acmecorp.com. Sorry for the delay.",
        "cs-2": "Refunds are processed in 5-7 days. Call 1-800-555-0100 if you have issues."
      }
    }
  },
  {
    id: "json-extractor",
    name: "Structured User Profile Extractor",
    description: "Evaluates if a model can reliably extract customer attributes from raw text and format them into valid JSON with specific keys.",
    evaluatorType: "json",
    promptTemplate: "Extract customer details from the raw text. Return ONLY a valid JSON object. Do not include markdown code block syntax. Required keys: name, age, role, city.\nRaw Text: {{input}}",
    testCases: [
      {
        id: "json-1",
        input: "Alice Johnson is a 28 year old UX Designer currently residing in Chicago.",
        requiredKeys: ["name", "age", "role", "city"]
      },
      {
        id: "json-2",
        input: "Robert Chen (31) works as a Financial Analyst in San Francisco.",
        requiredKeys: ["name", "age", "role", "city"]
      }
    ],
    mockOutputs: {
      "fast-llm-v1": {
        "json-1": '{"name": "Alice Johnson", "age": 28, "role": "UX Designer", "city": "Chicago"}',
        "json-2": '{"name": "Robert Chen", "age": 31, "role": "Financial Analyst", "city": "San Francisco"}'
      },
      "reasoning-llm-v2": {
        "json-1": '{\n  "name": "Alice Johnson",\n  "age": 28,\n  "role": "UX Designer",\n  "city": "Chicago"\n}',
        "json-2": '{\n  "name": "Robert Chen",\n  "age": 31,\n  "role": "Financial Analyst",\n  "city": "San Francisco"\n}'
      },
      "weak-llm-v0": {
        "json-1": 'Name: Alice Johnson\nAge: 28\nRole: UX Designer\nCity: Chicago', // Invalid JSON format
        "json-2": '{"name": "Robert Chen", "occupation": "Financial Analyst", "location": "San Francisco"}' // Missing required keys 'role' and 'city' (uses occupation and location instead)
      }
    }
  },
  {
    id: "sql-gen",
    name: "Natural Language to SQL Generator",
    description: "Evaluates the accuracy of generated SQL queries by matching required SQL clauses and target schema parameters.",
    evaluatorType: "keyword",
    promptTemplate: "Generate a Postgres SQL query to accomplish this request. Output only the SQL query, nothing else.\nRequest: {{input}}",
    testCases: [
      {
        id: "sql-1",
        input: "Get the count of users who registered in the year 2024.",
        keywords: ["SELECT", "COUNT", "users", "WHERE", "2024"]
      },
      {
        id: "sql-2",
        input: "Find all projects and their corresponding owner's email from projects and users tables.",
        keywords: ["SELECT", "JOIN", "ON", "projects", "users"]
      }
    ],
    mockOutputs: {
      "fast-llm-v1": {
        "sql-1": "SELECT COUNT(*) FROM users WHERE registration_date >= '2024-01-01' AND registration_date <= '2024-12-31';",
        "sql-2": "SELECT projects.*, users.email FROM projects JOIN users ON projects.user_id = users.id;"
      },
      "reasoning-llm-v2": {
        "sql-1": "SELECT COUNT(id) FROM users WHERE EXTRACT(YEAR FROM registered_at) = 2024;",
        "sql-2": "SELECT p.name, u.email FROM projects p INNER JOIN users u ON p.owner_id = u.id;"
      },
      "weak-llm-v0": {
        "sql-1": "SELECT users WHERE registration = 2024",
        "sql-2": "SELECT name, email FROM projects, users WHERE projects.owner_id = users.id" // Missing explicit JOIN keyword
      }
    }
  }
];

// Helper to generate simulated LLM outputs dynamically for custom test inputs
export function generateMockLLMResponse(modelId: string, _template: string, input: string, evaluatorType: string, expected?: string, keywords?: string[]): { text: string; latency: number } {
  const baseLatency = MODELS.find(m => m.id === modelId)?.avgLatency || 150;
  // Add some latency variance (-15% to +25%)
  const latency = Math.round(baseLatency * (0.85 + Math.random() * 0.4));
  
  const textClean = input.trim();
  
  if (modelId === "reasoning-llm-v2") {
    // Top-tier model: tries to fulfill everything perfectly
    if (evaluatorType === "json") {
      return {
        text: JSON.stringify({
          name: textClean.split(" ")[0] || "Unknown",
          age: parseInt(textClean.match(/\b\d{2}\b/)?.[0] || "30"),
          role: textClean.match(/as a ([\w\s]+) in|a (\d{2}) year old ([\w\s]+) currently/)?.[1] || "Professional",
          city: textClean.match(/living in ([\w\s]+)|residing in ([\w\s]+)|in ([\w\s\.]+)/)?.[1] || "New York"
        }, null, 2),
        latency
      };
    } else if (evaluatorType === "exact" || evaluatorType === "similarity") {
      return { text: expected || textClean, latency };
    } else if (evaluatorType === "keyword") {
      // Create a logical phrase containing keywords
      const words = keywords || [];
      return { text: `SELECT ${words.includes("COUNT") ? "COUNT(*)" : "*"} FROM table WHERE condition = 'valid' AND data_value LIKE '%${words[words.length-1] || ""}%';`, latency };
    } else {
      // Support / Judge
      return {
        text: `Hello, thank you for reaching out. We apologize for the issues you are facing. Please be assured we are investigating this. Contact us at 1-800-555-0100 for rapid priority assistance. We appreciate your patience.`,
        latency
      };
    }
  } else if (modelId === "fast-llm-v1") {
    // Mid-tier model: generally correct but less polished
    if (evaluatorType === "json") {
      return {
        text: JSON.stringify({
          name: textClean.split(" ")[0] || "Unknown",
          age: parseInt(textClean.match(/\b\d{2}\b/)?.[0] || "30"),
          role: "Developer",
          city: "San Francisco"
        }),
        latency
      };
    } else if (evaluatorType === "exact" || evaluatorType === "similarity") {
      return { text: (expected || textClean) + ".", latency }; // small mismatch (added period)
    } else if (evaluatorType === "keyword") {
      return { text: `SELECT * FROM data_table WHERE registered_year = 2024;`, latency };
    } else {
      return {
        text: `Sorry for the trouble. You can get support by calling our team helpline 1-800-555-0100. Let us know.`,
        latency
      };
    }
  } else {
    // Poor legacy model: makes syntax errors or fails constraints
    if (evaluatorType === "json") {
      return {
        text: `Name: ${textClean.split(" ")[0]}, Age: 30 (Sorry, I'm a simple text bot and cannot write JSON)`,
        latency
      };
    } else if (evaluatorType === "exact" || evaluatorType === "similarity") {
      return { text: "Here is what you wanted: " + (expected || textClean), latency };
    } else if (evaluatorType === "keyword") {
      return { text: "SELECT info from users;", latency }; // misses criteria
    } else {
      return {
        text: `Your ticket has been logged. Email support@company.com if you want.`, // missing phone number entirely
        latency
      };
    }
  }
}
