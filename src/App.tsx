import { useState, useEffect } from 'react';
import { 
  Play, 
  Award, 
  Terminal, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Cpu, 
  Clock, 
  Coins, 
  Sparkles, 
  HelpCircle,
  AlertCircle,
  Code
} from 'lucide-react';
import { PRESETS, MODELS, EvalSuite, TestCase, generateMockLLMResponse } from './data/presets';
import { evalExactMatch, evalKeywordMatch, evalSimilarity, evalJsonSchema, evalLlmAsJudge, EvalResult } from './utils/evaluators';


export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'playground' | 'integration'>('dashboard');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>(PRESETS[0].id);
  const [suites, setSuites] = useState<EvalSuite[]>(PRESETS);
  
  // Playground state
  const [activeSuite, setActiveSuite] = useState<EvalSuite>(PRESETS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'warning' | 'error' | 'model'; text: string }[]>([]);
  const [activeRunResults, setActiveRunResults] = useState<Record<string, Record<string, EvalResult & { text: string; latency: number; cost: number }>>>({});
  const [hasRun, setHasRun] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Leaderboard statistics state (aggregator)
  const [leaderboard, setLeaderboard] = useState<Record<string, { passRate: number; avgLatency: number; totalCost: number; score: number }>>({});

  useEffect(() => {
    // Locate the current active suite from state
    const suite = suites.find(s => s.id === selectedSuiteId);
    if (suite) {
      setActiveSuite(suite);
      setHasRun(false);
      setActiveRunResults({});
      setLogs([]);
    }
  }, [selectedSuiteId, suites]);

  // Generate leaderboard data on load and when runs finish
  useEffect(() => {
    // Generate default/starting leaderboard metrics based on preset outputs
    const stats: Record<string, { passRate: number; avgLatency: number; totalCost: number; score: number }> = {};
    
    MODELS.forEach(model => {
      let totalTests = 0;
      let passedTests = 0;
      let accumulatedScore = 0;
      let totalLatency = 0;
      let totalCost = 0;

      suites.forEach(suite => {
        suite.testCases.forEach(tc => {
          totalTests++;
          const output = suite.mockOutputs[model.id]?.[tc.id] || "";
          
          // Evaluate
          let res: EvalResult = { passed: false, score: 0, details: "" };
          if (suite.evaluatorType === 'exact') res = evalExactMatch(output, tc.expected || "");
          else if (suite.evaluatorType === 'keyword') res = evalKeywordMatch(output, tc.keywords || []);
          else if (suite.evaluatorType === 'similarity') res = evalSimilarity(output, tc.expected || "");
          else if (suite.evaluatorType === 'json') res = evalJsonSchema(output, tc.requiredKeys || []);
          else if (suite.evaluatorType === 'llm-judge') res = evalLlmAsJudge(output, tc.criteria || "", suite.name);

          if (res.passed) passedTests++;
          accumulatedScore += res.score;
          
          // Latency & cost mock estimation
          const textLength = output.length;
          const tokens = Math.max(10, Math.ceil(textLength / 4));
          const promptTokens = Math.max(20, Math.ceil((suite.promptTemplate.length + tc.input.length) / 4));
          totalCost += ((promptTokens + tokens) * model.costPerM) / 1000000;
          totalLatency += model.avgLatency;
        });
      });

      stats[model.id] = {
        passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        score: totalTests > 0 ? (accumulatedScore / totalTests) * 100 : 0,
        avgLatency: totalTests > 0 ? Math.round(totalLatency / totalTests) : 0,
        totalCost: parseFloat(totalCost.toFixed(5))
      };
    });

    setLeaderboard(stats);
  }, [suites]);

  // Add Log Helper
  const addLog = (type: 'info' | 'success' | 'warning' | 'error' | 'model', text: string) => {
    setLogs(prev => [...prev, { type, text }]);
  };

  // Run Evals Process Simulator
  const handleRunEvals = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setHasRun(false);
    setProgress(5);
    setLogs([]);
    setActiveRunResults({});

    addLog('info', `🚀 Initializing Eval Run for Suite: "${activeSuite.name}"`);
    addLog('info', `📋 Found ${activeSuite.testCases.length} Test Cases. Running across ${MODELS.length} Models.`);
    await new Promise(r => setTimeout(r, 600));

    const newResults: typeof activeRunResults = {};
    const totalSteps = activeSuite.testCases.length * MODELS.length;
    let stepCount = 0;

    for (const testCase of activeSuite.testCases) {
      newResults[testCase.id] = {};
      addLog('info', `👉 Running Test Case: "${testCase.input.substring(0, 45)}..."`);
      await new Promise(r => setTimeout(r, 400));

      for (const model of MODELS) {
        addLog('model', `   🤖 Invoking model: ${model.name}...`);
        
        // Simulating network wait
        await new Promise(r => setTimeout(r, Math.min(model.avgLatency, 400)));

        // Retrieve pre-saved response OR generate a simulated response on the fly (for custom suites)
        let responseText = activeSuite.mockOutputs[model.id]?.[testCase.id];
        let lat = model.avgLatency;

        if (responseText === undefined) {
          const gen = generateMockLLMResponse(
            model.id, 
            activeSuite.promptTemplate, 
            testCase.input, 
            activeSuite.evaluatorType, 
            testCase.expected, 
            testCase.keywords
          );
          responseText = gen.text;
          lat = gen.latency;
        }

        // Calculate Cost
        const textLength = responseText.length;
        const tokens = Math.max(10, Math.ceil(textLength / 4));
        const promptTokens = Math.max(20, Math.ceil((activeSuite.promptTemplate.length + testCase.input.length) / 4));
        const cost = ((promptTokens + tokens) * model.costPerM) / 1000000;

        // Perform evaluation assertion
        let evalRes: EvalResult;
        if (activeSuite.evaluatorType === 'exact') {
          evalRes = evalExactMatch(responseText, testCase.expected || "");
        } else if (activeSuite.evaluatorType === 'keyword') {
          evalRes = evalKeywordMatch(responseText, testCase.keywords || []);
        } else if (activeSuite.evaluatorType === 'similarity') {
          evalRes = evalSimilarity(responseText, testCase.expected || "");
        } else if (activeSuite.evaluatorType === 'json') {
          evalRes = evalJsonSchema(responseText, testCase.requiredKeys || []);
        } else {
          evalRes = evalLlmAsJudge(responseText, testCase.criteria || "", activeSuite.name);
        }

        newResults[testCase.id][model.id] = {
          ...evalRes,
          text: responseText,
          latency: lat,
          cost: cost
        };

        if (evalRes.passed) {
          addLog('success', `      ✔ ${model.name} passed! Score: ${(evalRes.score * 100).toFixed(0)}%`);
        } else {
          addLog('error', `      ✘ ${model.name} failed! Score: ${(evalRes.score * 100).toFixed(0)}% | Info: ${evalRes.details}`);
        }

        stepCount++;
        setProgress(Math.round((stepCount / totalSteps) * 100));
        await new Promise(r => setTimeout(r, 250));
      }
    }

    setProgress(100);
    addLog('success', `🎉 Evaluation completed. Visual diagnostics ready below.`);
    setActiveRunResults(newResults);
    setHasRun(true);
    setIsRunning(false);

    // Update local leaderboard metrics for this specific suite run
    setLeaderboard(prev => {
      const updated = { ...prev };
      MODELS.forEach(m => {
        let passed = 0;
        let total = activeSuite.testCases.length;
        let scoreSum = 0;
        let latencySum = 0;
        let costSum = 0;

        activeSuite.testCases.forEach(tc => {
          const res = newResults[tc.id][m.id];
          if (res.passed) passed++;
          scoreSum += res.score;
          latencySum += res.latency;
          costSum += res.cost;
        });

        updated[m.id] = {
          passRate: total > 0 ? (passed / total) * 100 : 0,
          score: total > 0 ? (scoreSum / total) * 100 : 0,
          avgLatency: total > 0 ? Math.round(latencySum / total) : 0,
          totalCost: parseFloat(costSum.toFixed(5))
        };
      });
      return updated;
    });
  };

  // State modifiers for customizing suites
  const handleUpdateTemplate = (text: string) => {
    setSuites(prev => prev.map(s => s.id === selectedSuiteId ? { ...s, promptTemplate: text } : s));
  };

  const handleUpdateTestCase = (tcId: string, field: keyof TestCase, val: any) => {
    setSuites(prev => prev.map(s => {
      if (s.id !== selectedSuiteId) return s;
      return {
        ...s,
        testCases: s.testCases.map(tc => tc.id === tcId ? { ...tc, [field]: val } : tc)
      };
    }));
  };

  const handleAddTestCase = () => {
    const newId = `custom-tc-${Date.now()}`;
    const newCase: TestCase = {
      id: newId,
      input: "New prompt input context...",
      expected: activeSuite.evaluatorType === 'exact' || activeSuite.evaluatorType === 'similarity' ? "Expected output" : undefined,
      keywords: activeSuite.evaluatorType === 'keyword' ? ["keyword1"] : undefined,
      requiredKeys: activeSuite.evaluatorType === 'json' ? ["key1"] : undefined,
      criteria: activeSuite.evaluatorType === 'llm-judge' ? "Polite and accurate response" : undefined
    };

    setSuites(prev => prev.map(s => {
      if (s.id !== selectedSuiteId) return s;
      return {
        ...s,
        testCases: [...s.testCases, newCase]
      };
    }));
  };

  const handleDeleteTestCase = (tcId: string) => {
    setSuites(prev => prev.map(s => {
      if (s.id !== selectedSuiteId) return s;
      return {
        ...s,
        testCases: s.testCases.filter(tc => tc.id !== tcId)
      };
    }));
  };

  const handleCreateCustomSuite = () => {
    const newId = `custom-suite-${Date.now()}`;
    const newSuite: EvalSuite = {
      id: newId,
      name: "🚀 Custom Eval Suite",
      description: "A sandbox environment to configure your own LLM prompts and grading thresholds.",
      evaluatorType: 'keyword',
      promptTemplate: "Review: {{input}}",
      testCases: [
        {
          id: `tc-${Date.now()}-1`,
          input: "Great service, loved the product!",
          keywords: ["service", "product"]
        }
      ],
      mockOutputs: {}
    };

    setSuites(prev => [...prev, newSuite]);
    setSelectedSuiteId(newId);
  };

  const handleUpdateEvaluatorType = (type: EvalSuite['evaluatorType']) => {
    setSuites(prev => prev.map(s => {
      if (s.id !== selectedSuiteId) return s;
      
      // Map existing test cases to clean formats fitting the new evaluator
      const updatedTestCases = s.testCases.map(tc => {
        const base = { id: tc.id, input: tc.input };
        if (type === 'exact' || type === 'similarity') {
          return { ...base, expected: "Expected text matching result" };
        } else if (type === 'keyword') {
          return { ...base, keywords: ["keyphrase"] };
        } else if (type === 'json') {
          return { ...base, requiredKeys: ["status", "data"] };
        } else {
          return { ...base, criteria: "Must answer correctly and professionally" };
        }
      });

      return {
        ...s,
        evaluatorType: type,
        testCases: updatedTestCases
      };
    }));
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Code Snippets for SDK view
  const pythonCode = `import json
import time
import difflib

# 1. Mock Prompt Calling
def call_llm(model: str, prompt: str) -> str:
    # Simulate LLM Response
    time.sleep(0.1)
    if model == "fast-llm":
        return "Hello my friend."
    return "Salut mon ami"

# 2. Evaluation Assertions
def eval_exact(actual: str, expected: str) -> float:
    return 1.0 if actual.strip() == expected.strip() else 0.0

def eval_similarity(actual: str, expected: str) -> float:
    # Compute Gestalt pattern matching ratio
    return difflib.SequenceMatcher(None, actual.lower(), expected.lower()).ratio()

def eval_keywords(actual: str, keywords: list) -> float:
    found = [kw in actual.lower() for kw in keywords]
    return sum(found) / len(keywords)

# 3. Running evaluation run loop
test_suite = [
    {
        "input": "Translate 'Hello my friend' to French (informal)",
        "evaluator": "similarity",
        "params": "Salut mon ami"
    }
]

models = ["fast-llm", "reasoning-llm"]
results = {m: {"total": 0, "passed": 0} for m in models}

for tc in test_suite:
    for model in models:
        output = call_llm(model, tc["input"])
        score = eval_similarity(output, tc["params"])
        passed = score >= 0.8
        
        results[model]["total"] += 1
        if passed:
            results[model]["passed"] += 1
            
        print(f"[{model}] Output: '{output}' -> Score: {score:.2f} | {'PASS' if passed else 'FAIL'}")

# Output Leaderboard summary
print("\\nLeaderboard Stats:")
for model, stats in results.items():
    rate = (stats["passed"] / stats["total"]) * 100
    print(f"  {model}: Pass Rate {rate:.0f}%")
`;

  const nodeCode = `// Runnable JS/Node test asserting output validity
const assert = require('assert');

function evalKeywords(actual, keywords) {
  const missing = keywords.filter(kw => !actual.toLowerCase().includes(kw.toLowerCase()));
  return {
    passed: missing.length === 0,
    score: (keywords.length - missing.length) / keywords.length,
    missing
  };
}

const testCases = [
  {
    prompt: "Generate a SELECT query for users table",
    keywords: ["SELECT", "FROM", "users"],
    actualOutput: "SELECT * FROM users WHERE status = 'active';"
  }
];

testCases.forEach((tc, idx) => {
  const evalResult = evalKeywords(tc.actualOutput, tc.keywords);
  console.log(\`Test case \${idx + 1}:\`);
  console.log(\`  Score: \${evalResult.score * 100}%\`);
  console.log(\`  Status: \${evalResult.passed ? '✔ PASS' : '✘ FAIL'}\`);
  if (!evalResult.passed) {
    console.log(\`  Missing keywords: \${evalResult.missing.join(', ')}\`);
  }
});
`;

  return (
    <div className="app-container">
      {/* Header bar */}
      <header className="header">
        <div className="logo">
          <Sparkles size={24} color="#818cf8" />
          <span>EvalCraft</span>
          <span className="badge badge-similarity" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', marginLeft: '0.5rem' }}>Core Demo</span>
        </div>
        <nav className="nav-links">
          <button 
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Award size={16} />
            Dashboard
          </button>
          <button 
            className={`nav-btn ${activeTab === 'playground' ? 'active' : ''}`}
            onClick={() => setActiveTab('playground')}
          >
            <Play size={16} />
            Playground & Runner
          </button>
          <button 
            className={`nav-btn ${activeTab === 'integration' ? 'active' : ''}`}
            onClick={() => setActiveTab('integration')}
          >
            <Terminal size={16} />
            CLI & SDK Code
          </button>
        </nav>
      </header>

      {/* Main Workspace Layout */}
      <main className="main-content">
        
        {/* Sidebar displaying active prompt suites */}
        <aside className="sidebar">
          <div className="suite-list-header">Prompt Test Suites</div>
          <div className="suite-list">
            {suites.map((suite) => (
              <button
                key={suite.id}
                className={`suite-item ${selectedSuiteId === suite.id ? 'active' : ''}`}
                onClick={() => setSelectedSuiteId(suite.id)}
              >
                <div className="suite-item-title">
                  <span>{suite.name}</span>
                  <span className={`badge badge-${suite.evaluatorType}`}>
                    {suite.evaluatorType}
                  </span>
                </div>
                <div className="suite-item-desc">{suite.description}</div>
              </button>
            ))}
          </div>

          <button 
            className="btn btn-secondary btn-small" 
            style={{ width: '100%', marginTop: '0.5rem', borderStyle: 'dashed' }}
            onClick={handleCreateCustomSuite}
          >
            <Plus size={14} /> Add Custom Suite
          </button>

          {/* Quick learning card */}
          <div className="glass-panel" style={{ padding: '1rem', marginTop: '1rem', fontSize: '0.8rem' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
              <HelpCircle size={14} /> Quick Guide
            </h4>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
              <strong>What is an Eval?</strong> It is an automated test that feeds prompts to your LLM, grades the results with specific rules (Evaluators), and computes aggregate metrics like pass rates, latency, and tokens cost.
            </p>
          </div>
        </aside>

        {/* Dynamic content rendering tabs */}
        <section className="content-area">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="glass-panel view-card">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '0.5rem' }}>Evals Leadership & Summary</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Compare model capabilities across your entire suite of evaluations. Real-time statistics are aggregate results of all runs.
              </p>

              {/* Statistics Counters */}
              <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="glass-card stat-card">
                  <div className="stat-icon primary"><Cpu size={22} /></div>
                  <div className="stat-details">
                    <span className="stat-val">{suites.length}</span>
                    <span className="stat-label">Active Test Suites</span>
                  </div>
                </div>

                <div className="glass-card stat-card">
                  <div className="stat-icon success"><CheckCircle2 size={22} /></div>
                  <div className="stat-details">
                    <span className="stat-val">
                      {Math.round(Object.values(leaderboard).reduce((acc, m) => acc + m.passRate, 0) / MODELS.length)}%
                    </span>
                    <span className="stat-label">Average Pass Rate</span>
                  </div>
                </div>

                <div className="glass-card stat-card">
                  <div className="stat-icon warning"><Clock size={22} /></div>
                  <div className="stat-details">
                    <span className="stat-val">
                      {Math.round(Object.values(leaderboard).reduce((acc, m) => acc + m.avgLatency, 0) / MODELS.length)} ms
                    </span>
                    <span className="stat-label">Average Latency</span>
                  </div>
                </div>

                <div className="glass-card stat-card">
                  <div className="stat-icon info"><Coins size={22} /></div>
                  <div className="stat-details">
                    <span className="stat-val">
                      ${(Object.values(leaderboard).reduce((acc, m) => acc + m.totalCost, 0) / MODELS.length).toFixed(4)}
                    </span>
                    <span className="stat-label">Average Run Cost</span>
                  </div>
                </div>
              </div>

              {/* Grid with leaderboards and visual metrics */}
              <div className="dashboard-grid">
                
                {/* Comparison table */}
                <div className="glass-card custom-chart-container" style={{ padding: '1rem 0' }}>
                  <div className="chart-header" style={{ padding: '0 1.25rem 0.5rem 1.25rem' }}>
                    <span>Model Comparison Leaderboard</span>
                    <span className="badge badge-llm-judge">Active</span>
                  </div>

                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Model Name</th>
                        <th>Pass Rate</th>
                        <th>Avg Latency</th>
                        <th>Est. Cost / 1k Runs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODELS.map(model => {
                        const stats = leaderboard[model.id] || { passRate: 0, avgLatency: 0, totalCost: 0, score: 0 };
                        return (
                          <tr key={model.id}>
                            <td>
                              <div className="model-badge">{model.name}</div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{model.provider}</span>
                            </td>
                            <td>
                              <div className="percentage-bar-outer">
                                <div 
                                  className={`percentage-bar-inner ${stats.passRate > 85 ? 'success' : stats.passRate > 50 ? 'warning' : 'error'}`} 
                                  style={{ width: `${stats.passRate}%` }}
                                ></div>
                              </div>
                              <span style={{ fontWeight: 600 }}>{Math.round(stats.passRate)}%</span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--text-muted)' }}>{stats.avgLatency}ms</span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                                ${(stats.totalCost * 1000).toFixed(3)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Score card bar graphics */}
                <div className="glass-card custom-chart-container">
                  <div className="chart-header">
                    <span>Composite Accuracy Score</span>
                  </div>
                  <div className="model-perf-list">
                    {MODELS.map(model => {
                      const stats = leaderboard[model.id] || { passRate: 0, avgLatency: 0, totalCost: 0, score: 0 };
                      return (
                        <div key={model.id} className="model-perf-item">
                          <div className="model-perf-info">
                            <span style={{ fontWeight: 500 }}>{model.name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{Math.round(stats.score)} / 100</span>
                          </div>
                          <div className="model-perf-bar-outer">
                            <div 
                              className="model-perf-bar-inner" 
                              style={{ 
                                width: `${stats.score}%`, 
                                background: model.id === 'reasoning-llm-v2' 
                                  ? 'linear-gradient(to right, #10b981, #34d399)' 
                                  : model.id === 'fast-llm-v1' 
                                  ? 'linear-gradient(to right, #6366f1, #818cf8)' 
                                  : 'linear-gradient(to right, #ef4444, #f87171)'
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '0.5rem', lineHeight: '1.3' }}>
                    * Composite score weights prompt instruction adherence, output syntax, and criteria validations calculated dynamically.
                  </p>
                </div>

              </div>

              {/* Learning cards */}
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Core Evaluation Concepts</h3>
                <div className="editor-grid">
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                      <AlertCircle size={16} /> Continuous Integration Evals
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Evals are crucial when deploying LLMs because LLM outputs are non-deterministic. A small prompt change might fix customer support replies but break JSON parsing. Running regression test suites on every code change prevents production failures.
                    </p>
                  </div>
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-secondary)' }}>
                      <Sparkles size={16} /> Choosing the Right Evaluator
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      <strong>Exact/Similarity Match</strong> is good for short answers and formatting. <strong>JSON Validator</strong> fits APIs. <strong>LLM-as-a-Judge</strong> is best for qualitative metrics like helpfulness, safety, or tone, where rigid code assertions cannot capture nuance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLAYGROUND AND RUNNER */}
          {activeTab === 'playground' && (
            <div className="glass-panel view-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '0.25rem' }}>Interactive Evaluation Playground</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Customize prompt templates, test parameters, and evaluate multiple models in real time.</p>
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={handleRunEvals}
                  disabled={isRunning || activeSuite.testCases.length === 0}
                >
                  <Play size={16} />
                  {isRunning ? 'Running Evals...' : 'Run Eval Suite'}
                </button>
              </div>

              {/* Template Editor Grid */}
              <div className="editor-grid" style={{ marginBottom: '1.5rem' }}>
                
                {/* Left: Template & Evaluator Config */}
                <div>
                  <div className="field-group">
                    <label className="field-label">System Prompt Template</label>
                    <span className="field-desc">Must include <code>{`{{input}}`}</code>. This formats the query sent to models.</span>
                    <textarea 
                      className="text-area code-editor"
                      value={activeSuite.promptTemplate}
                      onChange={(e) => handleUpdateTemplate(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>

                  <div className="field-group" style={{ marginTop: '1rem' }}>
                    <label className="field-label">Evaluator Strategy</label>
                    <span className="field-desc">Choose how model responses are evaluated and graded.</span>
                    <select
                      className="select-input"
                      value={activeSuite.evaluatorType}
                      onChange={(e) => handleUpdateEvaluatorType(e.target.value as EvalSuite['evaluatorType'])}
                      disabled={isRunning}
                    >
                      <option value="exact">Exact Match (Strict matching)</option>
                      <option value="keyword">Keyword Check (Assert terms are present)</option>
                      <option value="similarity">Levenshtein Similarity (Distance percentage)</option>
                      <option value="json">JSON Validator (Syntactic & keys checks)</option>
                      <option value="llm-judge">LLM-as-a-Judge (Simulated qualitative criteria)</option>
                    </select>
                  </div>
                </div>

                {/* Right: Live execution logging */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Terminal size={14} /> Execution Console Logs
                  </label>
                  <div className="execution-logs">
                    {logs.length === 0 ? (
                      <div style={{ color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', marginTop: '4rem' }}>
                        Console idle. Click "Run Eval Suite" to execute.
                      </div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className={`log-line ${log.type}`}>
                          <span>&gt;</span>
                          <span>{log.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {isRunning && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Running simulation...</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Test Cases Editor */}
              <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)' }}>Test Cases Customization ({activeSuite.testCases.length})</h3>
                  <button 
                    className="btn btn-secondary btn-small"
                    onClick={handleAddTestCase}
                    disabled={isRunning}
                  >
                    <Plus size={14} /> Add Test Case
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activeSuite.testCases.map((tc, idx) => (
                    <div key={tc.id} className="test-case-item">
                      <button 
                        className="test-case-delete"
                        onClick={() => handleDeleteTestCase(tc.id)}
                        disabled={isRunning || activeSuite.testCases.length <= 1}
                      >
                        <Trash2 size={16} />
                      </button>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                        <div className="field-group">
                          <label className="field-label" style={{ fontSize: '0.8rem' }}>Test Input #{idx + 1}</label>
                          <input 
                            type="text" 
                            className="text-input" 
                            value={tc.input} 
                            onChange={(e) => handleUpdateTestCase(tc.id, 'input', e.target.value)}
                            disabled={isRunning}
                          />
                        </div>

                        {/* Conditional evaluator fields */}
                        {activeSuite.evaluatorType === 'exact' && (
                          <div className="field-group">
                            <label className="field-label" style={{ fontSize: '0.8rem' }}>Expected Exact Output</label>
                            <input 
                              type="text" 
                              className="text-input" 
                              value={tc.expected || ''} 
                              onChange={(e) => handleUpdateTestCase(tc.id, 'expected', e.target.value)}
                              disabled={isRunning}
                            />
                          </div>
                        )}

                        {activeSuite.evaluatorType === 'similarity' && (
                          <div className="field-group">
                            <label className="field-label" style={{ fontSize: '0.8rem' }}>Target Match Output</label>
                            <input 
                              type="text" 
                              className="text-input" 
                              value={tc.expected || ''} 
                              onChange={(e) => handleUpdateTestCase(tc.id, 'expected', e.target.value)}
                              disabled={isRunning}
                            />
                          </div>
                        )}

                        {activeSuite.evaluatorType === 'keyword' && (
                          <div className="field-group">
                            <label className="field-label" style={{ fontSize: '0.8rem' }}>Required Keywords (comma separated)</label>
                            <input 
                              type="text" 
                              className="text-input" 
                              value={(tc.keywords || []).join(', ')} 
                              onChange={(e) => handleUpdateTestCase(tc.id, 'keywords', e.target.value.split(',').map(s => s.trim()))}
                              disabled={isRunning}
                            />
                          </div>
                        )}

                        {activeSuite.evaluatorType === 'json' && (
                          <div className="field-group">
                            <label className="field-label" style={{ fontSize: '0.8rem' }}>Required Schema Keys (comma separated)</label>
                            <input 
                              type="text" 
                              className="text-input" 
                              value={(tc.requiredKeys || []).join(', ')} 
                              onChange={(e) => handleUpdateTestCase(tc.id, 'requiredKeys', e.target.value.split(',').map(s => s.trim()))}
                              disabled={isRunning}
                            />
                          </div>
                        )}

                        {activeSuite.evaluatorType === 'llm-judge' && (
                          <div className="field-group">
                            <label className="field-label" style={{ fontSize: '0.8rem' }}>Judge Criteria & Guidelines</label>
                            <input 
                              type="text" 
                              className="text-input" 
                              value={tc.criteria || ''} 
                              onChange={(e) => handleUpdateTestCase(tc.id, 'criteria', e.target.value)}
                              disabled={isRunning}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Run Diagnostics Report */}
              {hasRun && (
                <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Award size={20} color="var(--color-success)" /> Run Diagnostics Breakdown
                  </h3>
                  
                  <div className="reports-layout">
                    {activeSuite.testCases.map((tc, idx) => (
                      <div key={tc.id} className="eval-run-item">
                        <div className="eval-run-header">
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>Test Case #{idx + 1} Input</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              "{tc.input}"
                            </span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>Compare details below</span>
                        </div>

                        <div className="eval-run-content">
                          {MODELS.map(model => {
                            const res = activeRunResults[tc.id]?.[model.id];
                            if (!res) return null;

                            return (
                              <div key={model.id} className="model-run-box">
                                <div className="model-run-header">
                                  <span>{model.name}</span>
                                  <span className={`result-badge ${res.passed ? 'pass' : 'fail'}`}>
                                    {res.passed ? '✔ Pass' : '✘ Fail'}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  <span>Latency: {res.latency}ms</span>
                                  <span>Cost: ${res.cost.toFixed(6)}</span>
                                </div>

                                <div className="field-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dark)', fontWeight: 700 }}>LLM Output Text</label>
                                  <div className="output-bubble">{res.text}</div>
                                </div>

                                <div className="field-group" style={{ margin: 0 }}>
                                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dark)', fontWeight: 700 }}>Evaluator Log Details</label>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '0.25rem' }}>{res.details}</div>
                                </div>

                                {res.reasoning && (
                                  <div className="field-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 700 }}>Judge Reasoning</label>
                                    <div className="reasoning-bubble">{res.reasoning}</div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INTEGRATION */}
          {activeTab === 'integration' && (
            <div className="glass-panel view-card">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '0.5rem' }}>How to Write Evals in Code</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Evaluations are typically automated in code and integrated into continuous deployment checks. Below are clean implementations showing how you can do this in Python and Node.js.
              </p>

              <div className="tabs-container">
                <button className={`tab active`}>Integration SDKs</button>
              </div>

              {/* Code blocks with copy actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Python block */}
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#60a5fa' }}>
                    <Code size={18} /> Python Implementation (`pytest` / direct runner)
                  </h3>
                  <div className="code-block-container">
                    <button className="copy-btn" onClick={() => copyToClipboard(pythonCode, 0)}>
                      {copiedIndex === 0 ? 'Copied!' : 'Copy Code'}
                    </button>
                    <pre className="pre-code">{pythonCode}</pre>
                  </div>
                </div>

                {/* JavaScript block */}
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#a855f7' }}>
                    <Code size={18} /> Node.js Implementation (CLI tool)
                  </h3>
                  <div className="code-block-container">
                    <button className="copy-btn" onClick={() => copyToClipboard(nodeCode, 1)}>
                      {copiedIndex === 1 ? 'Copied!' : 'Copy Code'}
                    </button>
                    <pre className="pre-code">{nodeCode}</pre>
                  </div>
                </div>

              </div>
            </div>
          )}

        </section>
      </main>
    </div>
  );
}
