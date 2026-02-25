---
name: browser-use
description: "Browser automation using Stagehand through Kiro's execute_code. Supports: clicking, typing, scrolling, navigation, data extraction, forms, multi-page workflows, iframes, auth flows, proxy, and agent-based autonomous browsing."
---

# Browser Use for Kiro

Browser automation using Stagehand library through Kiro's `execute_code` tool.

## Key Feature: State Persistence

**Variables persist across calls** when using the same `path`:
- Initialize Stagehand once, reuse in all later calls
- No need to re-import or re-initialize
- Perfect for multi-step workflows

```
Call 1 (path: browser.ipynb): const stagehand = new Stagehand(...); await stagehand.init();
Call 2 (path: browser.ipynb): await stagehand.act("click login");  // stagehand exists!
Call 3 (path: browser.ipynb): await stagehand.extract(...);        // still exists!
```

## Quick Start

### 1. Make sure package is installed


### 2. Initialize Stagehand (Run Once)

```typescript
// execute_code with path: /workspace/.kiro/scripts/browser.ipynb
const { Stagehand, CustomOpenAIClient } = kiro.require("@browserbasehq/stagehand");
const OpenAI = kiro.require("openai").default;
const z = kiro.require("zod/v3").z;

const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
  llmClient: new CustomOpenAIClient({
    modelName: process.env.BROWSER_LLM_MODEL,
    client: new OpenAI({
      apiKey: process.env.BROWSER_LLM_API_KEY,
      baseURL: process.env.BROWSER_LLM_BASE_URL,
    }),
  }),
});

await stagehand.init();
const page = stagehand.context.pages()[0];
await page.goto("https://example.com");
```

### 3. Reuse in Later Calls (Same path)

```typescript
// execute_code with SAME path: /workspace/.kiro/scripts/browser.ipynb
// stagehand, page, z already exist from Step 2!

const title = await stagehand.extract("get the page title", z.string());
console.log("Title:", title);
```

## Proxy Configuration (重要)

Use proxy to capture and analyze network traffic. Configure via `localBrowserLaunchOptions.proxy`:

### Basic Proxy

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
  llmClient: new CustomOpenAIClient({...}),
  localBrowserLaunchOptions: {
    proxy: {
      server: "http://127.0.0.1:8080",
    },
  },
});
```

### Proxy with Authentication

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
  llmClient: new CustomOpenAIClient({...}),
  localBrowserLaunchOptions: {
    proxy: {
      server: "http://proxy.example.com:8080",
      username: "user",
      password: "pass",
      bypass: "localhost,127.0.0.1",  // Optional: bypass list
    },
  },
});
```

### Common Proxy Tools

| Tool | Default Address | Use Case |
|------|-----------------|----------|
| Burp Suite | `http://127.0.0.1:8080` | Security testing, traffic analysis |
| Charles | `http://127.0.0.1:8888` | HTTP debugging |
| mitmproxy | `http://127.0.0.1:8080` | Traffic interception, API analysis |
| Fiddler | `http://127.0.0.1:8866` | Windows HTTP debugging |
| SOCKS5 | `socks5://127.0.0.1:1080` | Tunnel all traffic |

### Use Proxy for browser

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
  llmClient: new CustomOpenAIClient({...}),
  localBrowserLaunchOptions: {
    proxy: process.env.BROWSER_PROXY_SERVER ? {
      server: process.env.BROWSER_PROXY_SERVER,
      username: process.env.BROWSER_PROXY_USERNAME || undefined,
      password: process.env.BROWSER_PROXY_PASSWORD || undefined,
    } : undefined,
  },
});
```

## Kiro-Specific Notes

### Use kiro.require()

```typescript
// ✅ Correct
const { Stagehand } = kiro.require("@browserbasehq/stagehand");
const z = kiro.require("zod/v3").z;

// ❌ Will NOT work
import { Stagehand } from "@browserbasehq/stagehand";
```

### Use process.env for Config

```typescript
const apiKey = process.env.BROWSER_LLM_API_KEY;
const baseURL = process.env.BROWSER_LLM_BASE_URL;
const modelName = process.env.BROWSER_LLM_MODEL;
```

### Same path = Same Session

```
path: browser.ipynb → session A (has stagehand)
path: other.ipynb  → session B (fresh, no stagehand)
```

## LLM Providers

Configure in `~/.config/opencode/kiro/kiro.json`:

| Provider | BROWSER_LLM_BASE_URL | BROWSER_LLM_MODEL |
|----------|---------------------|-------------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| Zhipu AI (智谱) | `https://open.bigmodel.cn/api/coding/paas/v4` | `glm-5` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| Ollama | `http://localhost:11434/v1` | `llama3` |

## Core Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `act` | Click, type, scroll | `stagehand.act("click submit")` |
| `extract` | Get structured data | `stagehand.extract("get prices", schema)` |
| `observe` | Preview actions | `stagehand.observe("click login")` |
| `agent` | Autonomous tasks | `stagehand.agent().execute({ instruction })` |

**Key rule:** Call methods on `stagehand`, not `page`.

## Common Patterns

### Form Filling

```typescript
await stagehand.act("type 'john@example.com' into email");
await stagehand.act("select 'US' from country dropdown");
await stagehand.act("click submit");
```

### Data Extraction

```typescript
const { items } = await stagehand.extract(
  "extract product names and prices",
  z.object({
    items: z.array(z.object({ name: z.string(), price: z.string() })),
  }),
);
```

### Complex Tasks

```typescript
const agent = stagehand.agent();
await agent.execute({
  instruction: "Search for products and add to cart",
  maxSteps: 20,
});
```

## Reference Files

- **[Model Configuration](references/model-configuration.md)**: All LLM providers
- **[Basic Operations](references/basic-operations.md)**: Navigation, clicking, typing
- **[Intermediate Patterns](references/intermediate-patterns.md)**: Multi-page, iframes, forms
- **[Advanced Techniques](references/advanced-techniques.md)**: Agent modes, MCP
- **[Expert Patterns](references/expert-patterns.md)**: Auth flows, debugging

## Template

See [assets/stagehand-template.ts](assets/stagehand-template.ts) for a complete starter script.
