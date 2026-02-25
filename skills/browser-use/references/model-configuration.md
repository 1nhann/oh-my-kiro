# Model Configuration

## For Kiro execute_code

### Use kiro.require()

In Kiro's `execute_code`, use `kiro.require()` instead of ES imports:

```typescript
// ✅ Correct
const { Stagehand, CustomOpenAIClient } = kiro.require("@browserbasehq/stagehand");
const OpenAI = kiro.require("openai").default;
const z = kiro.require("zod/v3").z;

// ❌ Will NOT work
import { Stagehand } from "@browserbasehq/stagehand";
```

### Configure via kiro.json

Add environment variables in `kiro.json`:

```json
{
  "codeExecution": {
    "script_dir": ".kiro/scripts",
    "env": {
      "BROWSER_LLM_API_KEY": "your-api-key",
      "BROWSER_LLM_BASE_URL": "https://api.openai.com/v1",
      "BROWSER_LLM_MODEL": "gpt-4o"
    }
  }
}
```

Then read from `process.env`:

```typescript
const apiKey = process.env.BROWSER_LLM_API_KEY;
const baseURL = process.env.BROWSER_LLM_BASE_URL || "https://api.openai.com/v1";
const modelName = process.env.BROWSER_LLM_MODEL || "gpt-4o";
```

## OpenAI-Compatible APIs (Recommended)

Use `CustomOpenAIClient` for any OpenAI-compatible provider:

```typescript
const { Stagehand, CustomOpenAIClient } = kiro.require("@browserbasehq/stagehand");
const OpenAI = kiro.require("openai").default;
const z = kiro.require("zod/v3").z;

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
});

await stagehand.init();
const page = stagehand.context.pages()[0];
await page.goto("https://example.com");

const title = await stagehand.extract("get the page title", z.string());
console.log("Title:", title);

await stagehand.close();
```

## Supported Providers

| Provider | kiro.json env |
|----------|---------------|
| **OpenAI** | `BROWSER_LLM_BASE_URL: "https://api.openai.com/v1"`, `BROWSER_LLM_MODEL: "gpt-4o"` |
| **Zhipu AI (智谱)** | `BROWSER_LLM_BASE_URL: "https://open.bigmodel.cn/api/coding/paas/v4"`, `BROWSER_LLM_MODEL: "glm-5"` |
| **DeepSeek** | `BROWSER_LLM_BASE_URL: "https://api.deepseek.com/v1"`, `BROWSER_LLM_MODEL: "deepseek-chat"` |
| **Moonshot** | `BROWSER_LLM_BASE_URL: "https://api.moonshot.cn/v1"`, `BROWSER_LLM_MODEL: "moonshot-v1-8k"` |
| **Ollama** | `BROWSER_LLM_BASE_URL: "http://localhost:11434/v1"`, `BROWSER_LLM_MODEL: "llama3"` |

### kiro.json Examples

**OpenAI:**
```json
{
  "codeExecution": {
    "env": {
      "BROWSER_LLM_API_KEY": "sk-...",
      "BROWSER_LLM_BASE_URL": "https://api.openai.com/v1",
      "BROWSER_LLM_MODEL": "gpt-4o"
    }
  }
}
```

**Zhipu AI (智谱):**
```json
{
  "codeExecution": {
    "env": {
      "BROWSER_LLM_API_KEY": "your-zhipu-api-key",
      "BROWSER_LLM_BASE_URL": "https://open.bigmodel.cn/api/coding/paas/v4",
      "BROWSER_LLM_MODEL": "glm-5"
    }
  }
}
```

**DeepSeek:**
```json
{
  "codeExecution": {
    "env": {
      "BROWSER_LLM_API_KEY": "your-deepseek-api-key",
      "BROWSER_LLM_BASE_URL": "https://api.deepseek.com/v1",
      "BROWSER_LLM_MODEL": "deepseek-chat"
    }
  }
}
```

**Ollama (local):**
```json
{
  "codeExecution": {
    "env": {
      "BROWSER_LLM_API_KEY": "ollama",
      "BROWSER_LLM_BASE_URL": "http://localhost:11434/v1",
      "BROWSER_LLM_MODEL": "llama3"
    }
  }
}
```

## Built-in Providers (Simple String Format)

For built-in providers only, you can use the simple string format:

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  model: "openai/gpt-4.1-mini",
});
```

Supported: `openai/*`, `anthropic/*`, `google/*`, `groq/*`, `cerebras/*`

## Browser Configuration

### LOCAL Mode (Default)

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
  llmClient: new CustomOpenAIClient({...}),
});
```

### Headless Mode

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
  llmClient: new CustomOpenAIClient({...}),
  localBrowserLaunchOptions: {
    headless: true,
  },
});
```

### BROWSERBASE Mode (Cloud)

```typescript
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  model: "openai/gpt-4.1-mini",
});
```

## Agent Configuration

Agents can use separate models for planning and execution:

```typescript
const agent = stagehand.agent({
  model: "anthropic/claude-sonnet-4-20250514", // Planning
  executionModel: "openai/gpt-4.1-mini", // Execution
});
```
