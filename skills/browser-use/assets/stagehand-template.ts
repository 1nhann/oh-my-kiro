/**
 * Stagehand Browser Automation Template for Kiro
 *
 * NOTE: This template runs inside Kiro's execute_code environment.
 * - `kiro` and `process` globals are available at runtime
 * - LSP errors about missing 'kiro'/'process' are expected
 *
 * PREREQUISITE: Configure kiro.json:
 *
 * {
 *   "codeExecution": {
 *     "env": {
 *       "BROWSER_LLM_API_KEY": "your-api-key",
 *       "BROWSER_LLM_BASE_URL": "https://api.openai.com/v1",
 *       "BROWSER_LLM_MODEL": "gpt-4o",
 *       "BROWSER_PROXY_SERVER": "http://127.0.0.1:8080"
 *     }
 *   }
 * }
 *
 * USAGE: Copy into execute_code with path: .kiro/scripts/browser.ipynb
 */

// ============================================================
// Module Loading
// ============================================================

const { Stagehand, CustomOpenAIClient } = kiro.require("@browserbasehq/stagehand");
const OpenAI = kiro.require("openai").default;
const z = kiro.require("zod/v3").z;

// ============================================================
// Stagehand Configuration
// ============================================================

const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
  llmClient: new CustomOpenAIClient({
    modelName: process.env.BROWSER_LLM_MODEL || "gpt-4o",
    client: new OpenAI({
      apiKey: process.env.BROWSER_LLM_API_KEY,
      baseURL: process.env.BROWSER_LLM_BASE_URL || "https://api.openai.com/v1",
    }),
  }),
  // Proxy configuration (optional - for traffic capture/analysis)
  localBrowserLaunchOptions: process.env.BROWSER_PROXY_SERVER ? {
    proxy: {
      server: process.env.BROWSER_PROXY_SERVER,
      username: process.env.BROWSER_PROXY_USERNAME || undefined,
      password: process.env.BROWSER_PROXY_PASSWORD || undefined,
    },
  } : undefined,
});

// ============================================================
// Main Script
// ============================================================

try {
  await stagehand.init();
  const page = stagehand.context.pages()[0];

  // --------------------------------------------------------
  // YOUR AUTOMATION CODE HERE
  // --------------------------------------------------------

  await page.goto("https://example.com");
  await page.waitForLoadState("networkidle");

  const title = await stagehand.extract("get the page title", z.string());
  console.log("Page title:", title);

  // More examples:
  // await stagehand.act("click the login button");
  // await stagehand.act("type 'email@example.com' into the email field");
  // const data = await stagehand.extract("extract product names", z.array(z.string()));

  // --------------------------------------------------------
  // END OF AUTOMATION CODE
  // --------------------------------------------------------

  console.log("Done!");
} catch (error) {
  console.error("Error:", error);
} finally {
  await stagehand.close();
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Safely dismiss popups that may or may not exist
 */
async function safeDismiss(stagehand, instruction) {
  try {
    const actions = await stagehand.observe(instruction, { timeout: 3000 });
    if (actions.length > 0) {
      await stagehand.act(actions[0]);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Retry an action with exponential backoff
 */
async function retryAction(stagehand, instruction, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const actions = await stagehand.observe(instruction);
      if (actions.length > 0) {
        await stagehand.act(actions[0]);
        return;
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error(`Action not found: ${instruction}`);
}

/**
 * Handle infinite scroll
 */
async function loadAllItems(stagehand, page, selector = ".item") {
  let previousCount = 0;
  while (true) {
    const currentCount = await page.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      selector
    );
    if (currentCount === previousCount) break;
    previousCount = currentCount;
    await stagehand.act("scroll to the bottom of the page");
    await page.waitForTimeout(1000);
  }
}

// Make this a module to allow top-level await
export {};
