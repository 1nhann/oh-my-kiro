# Advanced Techniques

```typescript
import { z } from "zod/v3";
```

## Agent Modes

### DOM Mode (Default)

Uses DOM-based tools (act, fillForm). Works with any model:

```typescript
const agent = stagehand.agent({
  model: "openai/gpt-4.1-mini",
  systemPrompt: "You are a helpful web automation assistant.",
});

const result = await agent.execute({
  instruction:
    "Search for the latest news about AI and summarize the top 3 results",
  maxSteps: 20,
});
```

### Hybrid Mode

Uses both DOM-based and coordinate-based tools. Requires `experimental: true` and grounding-capable models:

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  experimental: true, // Required for hybrid mode
});
await stagehand.init();

const agent = stagehand.agent({
  mode: "hybrid",
  model: "google/gemini-3-flash-preview",
});

await agent.execute({
  instruction: "Drag the slider to 50% and click submit",
  maxSteps: 15,
  highlightCursor: true, // Shows cursor movement (default: true)
});
```

**Recommended models for hybrid mode:**

- `google/gemini-3-flash-preview`
- `anthropic/claude-sonnet-4-20250514`
- `anthropic/claude-sonnet-4-5-20250929`
- `anthropic/claude-haiku-4-5-20251001`

### CUA Mode (Computer Use Agent)

For advanced scenarios with computer-use models:

```typescript
const agent = stagehand.agent({
  mode: "cua",
  model: "anthropic/claude-sonnet-4-20250514",
  // Alternative: "google/gemini-2.5-computer-use-preview-10-2025"
  systemPrompt: `You are a helpful assistant. Do not ask follow-up questions.`,
});

await agent.execute({
  instruction: "Apply for a library card at the San Francisco Public Library",
  maxSteps: 30,
});
```

**CUA Supported Models:**

- `anthropic/claude-sonnet-4-20250514`
- `google/gemini-2.5-computer-use-preview-10-2025`
- `openai/computer-use-preview`

### Streaming Agent

```typescript
const agent = stagehand.agent({
  model: "anthropic/claude-sonnet-4-5-20250929",
  stream: true,
});

const agentRun = await agent.execute({
  instruction: "Search for shampoo on Amazon",
  maxSteps: 20,
});

// Stream text output
for await (const delta of agentRun.textStream) {
  process.stdout.write(delta);
}

const finalResult = await agentRun.result;
```

## Custom Model Configuration

### API Key Configuration

```typescript
// Environment variable (recommended)
const stagehand = new Stagehand({
  env: "LOCAL",
  model: "openai/gpt-4.1-mini",
});

// Inline configuration (quick scripts)
const stagehand = new Stagehand({
  env: "LOCAL",
  model: {
    modelName: "anthropic/claude-sonnet-4-20250514",
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

### Agent with Custom Model Object

```typescript
const agent = stagehand.agent({
  model: {
    modelName: "google/gemini-2.5-computer-use-preview-10-2025",
    apiKey: process.env.GEMINI_API_KEY,
  },
  systemPrompt: `You are specialized in e-commerce automation.`,
});
```

### Vertex AI Configuration

```typescript
model: {
  modelName: "google/gemini-2.0-flash",
  project: "my-project",
  location: "us-central1",
  googleAuthOptions: {
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS!),
  },
}
```

## MCP Integrations (External Tools)

### Basic Integration

```typescript
const agent = stagehand.agent({
  integrations: [`https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}`],
  systemPrompt: `You have access to the Exa search tool for web searches.`,
});

await agent.execute({
  instruction:
    "Research competitor pricing for similar products and create a comparison",
  maxSteps: 25,
});
```

### Multiple Integrations

```typescript
const agent = stagehand.agent({
  integrations: [
    `https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}`,
    `https://mcp.example.com/mcp?apiKey=${process.env.OTHER_API_KEY}`,
  ],
  systemPrompt: `You have access to search and data tools.`,
});
```

## Complex Extraction Schemas

### Nested Objects

```typescript
const { products } = await stagehand.extract(
  "extract all products with their details",
  z.object({
    products: z.array(
      z.object({
        name: z.string(),
        price: z.object({
          amount: z.number(),
          currency: z.string(),
        }),
        specifications: z.object({
          color: z.string(),
          size: z.string(),
          weight: z.string(),
        }),
      }),
    ),
  }),
);
```

### Optional Fields

```typescript
const user = await stagehand.extract(
  "extract user profile information",
  z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    bio: z.string().optional(),
    avatar: z.string().url().optional(),
  }),
);
```

### Union Types

```typescript
const result = await stagehand.extract(
  "extract the search result which could be a product or a category",
  z.object({
    type: z.enum(["product", "category"]),
    data: z.union([
      z.object({
        type: z.literal("product"),
        name: z.string(),
        price: z.number(),
      }),
      z.object({
        type: z.literal("category"),
        name: z.string(),
        itemCount: z.number(),
      }),
    ]),
  }),
);
```

## Handling Dynamic Content

### SPA Handling

```typescript
// Wait for client-side navigation
await page.waitForLoadState("domcontentloaded");
await page.waitForFunction(() => window.location.pathname === "/dashboard");

// Wait for specific API response
const response = page.waitForResponse("**/api/data");
await stagehand.act("click the refresh button");
const data = await (await response).json();
```

### WebSocket/Polling Content

```typescript
// Wait for specific content via polling
await page.waitForFunction(
  () => {
    const el = document.querySelector(".status");
    return el?.textContent?.includes("Complete");
  },
  { timeout: 30000 },
);
```

### Lazy-Loaded Images

```typescript
// Scroll to trigger lazy loading
await stagehand.act("scroll to the image gallery");
await page.waitForSelector("img[src]", { state: "visible" });

// Or wait for all images
await page.waitForFunction(() =>
  Array.from(document.images).every((img) => img.complete),
);
```

## Browserbase Integration

### Cloud Execution

```typescript
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});
await stagehand.init();
```

### Resume Session

```typescript
// Save session ID for later
const sessionId = stagehand.browserbaseSessionId;

// Resume later
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  browserbaseSessionID: sessionId,
});
```

### Connect to Running Browser

```typescript
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  browserbaseSessionCreateParams: {
    region: "us-west-2",
    browserSettings: {
      fingerprint: {
        browsers: ["chrome"],
        devices: ["desktop"],
      },
    },
  },
});
```
