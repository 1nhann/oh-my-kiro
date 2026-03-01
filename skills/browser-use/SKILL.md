---
name: browser-use
description: "Advanced browser automation for extreme scenarios. Combines Stagehand (AI) + Playwright (precise) via CDP. For complex multi-step workflows, dynamic content, nested extraction, error recovery, and performance optimization. Reference: references/stagehand-playwright-guide.md"
---

# Extreme Browser Automation

Advanced patterns for pushing Stagehand+Playwright to its limits. Assumes CDP connection established. See `references/stagehand-playwright-guide.md` for complete examples.

---

## Initialization

### 1. Complete Initialization Code

```typescript
// Auto-install and import via kiro.require()
const { Stagehand, CustomOpenAIClient } = kiro.require("@browserbasehq/stagehand")
const OpenAI = kiro.require("openai").default // Note: .default required
const { chromium } = kiro.require("playwright")
const z = kiro.require("zod/v3").z

// Initialize Stagehand with custom LLM
const stagehand = new Stagehand({
  env: "LOCAL", // Use LOCAL for local browser, BROWSERBASE for cloud
  verbose: 0, // 0=silent, 1=normal, 2=debug
  llmClient: new CustomOpenAIClient({
    modelName: process.env.BROWSER_LLM_MODEL,
    client: new OpenAI({
      apiKey: process.env.BROWSER_LLM_API_KEY,
      baseURL: process.env.BROWSER_LLM_BASE_URL,
    }),
  }),
  // Optional: Proxy configuration
  localBrowserLaunchOptions: process.env.BROWSER_PROXY_SERVER
    ? {
        proxy: {
          server: process.env.BROWSER_PROXY_SERVER,
          username: process.env.BROWSER_PROXY_USERNAME,
          password: process.env.BROWSER_PROXY_PASSWORD,
        },
      }
    : undefined,
})
await stagehand.init()

// Connect Playwright via CDP for hybrid control
const pwBrowser = await chromium.connectOverCDP({ wsEndpoint: stagehand.connectURL() })
const pw = pwBrowser.contexts()[0].pages()[0]
const sh = stagehand.context.pages()[0]

// Store for session persistence
globalThis.stagehand = stagehand // ← Stagehand INSTANCE
globalThis.pw = pw // ← Playwright page
globalThis.sh = sh // ← Stagehand page (alias)
globalThis.shPage = sh // ← Stagehand page (same as sh)
globalThis.z = z
globalThis.pwBrowser = pwBrowser
```

### 2. API Reference (Critical)

| Variable        | Type               | Has Methods                       | Purpose                      |
| --------------- | ------------------ | --------------------------------- | ---------------------------- |
| `stagehand`     | Stagehand instance | `act()`, `extract()`, `observe()` | AI-powered browser control   |
| `sh` / `shPage` | Page object        | NO AI methods                     | Page reference for Stagehand |
| `pw`            | Playwright Page    | `goto()`, `click()`, `locator()`  | Precise programmatic control |

```typescript
// ✅ CORRECT: Call AI methods on stagehand INSTANCE
await stagehand.act("click the submit button", { page: shPage })
await stagehand.extract("get the title", schema, { page: sh })
await stagehand.observe("find the login button", { page: shPage })

// ❌ WRONG: Page objects don't have AI methods
await shPage.act("click button") // Error: shPage.act is not a function
await sh.extract("get data", schema) // Error: sh.extract is not a function

// ✅ Playwright methods work on pw page
await pw.goto("https://github.com")
await pw.locator("button").click()
await pw.waitForTimeout(1000)
```

### 3. Session Reuse Pattern

```typescript
// First call: Initialize (above code)

// Subsequent calls: Reuse existing session
const stagehand = globalThis.stagehand // ← Get the INSTANCE
const pw = globalThis.pw
const sh = globalThis.shPage
const z = globalThis.z

// Always validate session is alive
if (!stagehand?.context) {
  throw new Error("Session lost - reinitialize")
}
```

---

## Navigation Best Practices

### Prefer Direct URL Navigation

```typescript
// ✅ BEST: Direct URL with query params
await pw.goto("https://github.com/user?tab=repositories", { timeout: 60000 })

// ⚠️ LESS RELIABLE: Clicking tabs/links
await pw.locator('[data-tab="repositories"]').click() // May fail on dynamic content
await stagehand.act("click the repositories tab") // May miss target

// ✅ Pattern: Build URL instead of clicking
const username = "torvalds"
const tab = "repositories"
await pw.goto(`https://github.com/${username}?tab=${tab}`)
```

### Common URL Patterns

```typescript
// GitHub tabs
;`https://github.com/${user}?tab=repositories``https://github.com/${user}?tab=stars``https://github.com/${repo}/issues``https://github.com/${repo}/pulls``https://github.com/${repo}/commits/main`
// Search with filters
`https://github.com/search?q=${query}+language:TypeScript&type=repositories`
```

### Click Fallback Chain

```typescript
// Try clicking, fall back to URL if fails
try {
  await pw.locator('a[href*="issues"]').first().click({ timeout: 5000 })
} catch {
  // Fallback: construct URL directly
  const currentUrl = pw.url()
  const issuesUrl = currentUrl.replace(/\/?$/, "/issues")
  await pw.goto(issuesUrl)
}
```

---

## State Management for Long Sessions

### Session Recovery Pattern

```typescript
// Always check before use - use stagehand INSTANCE for context check
if (!globalThis.stagehand?.context) {
  console.log("[RECOVERY] Reinitializing...")
  // Full re-initialization here
}
const stagehand = globalThis.stagehand // ← Get INSTANCE
const pw = globalThis.pw
const shPage = globalThis.shPage
```

### Cross-Call State Persistence

```typescript
// Store complex state
globalThis.sessionState = {
  visited: new Set(),
  extractedData: [],
  lastUrl: null,
  retryCount: 0,
}

// Recovery with state preservation
if (!globalThis.sessionState) {
  globalThis.sessionState = { visited: new Set(), extractedData: [], lastUrl: null, retryCount: 0 }
}
```

### Cookie/Session Persistence

```typescript
// Save before close
const cookies = await stagehand.context.cookies()
globalThis.savedCookies = cookies

// Restore after re-init
await stagehand.context.addCookies(globalThis.savedCookies || [])
```

---

## Dynamic Content Handling

### Infinite Scroll with State Detection

```typescript
async function exhaustInfiniteScroll(pw, sh, maxIterations = 20) {
  let prevHeight = 0,
    stagnantCount = 0

  for (let i = 0; i < maxIterations; i++) {
    const currHeight = await pw.evaluate(() => document.body.scrollHeight)
    if (currHeight === prevHeight) {
      if (++stagnantCount >= 3) break // 3 consecutive no-growth = end
    } else {
      stagnantCount = 0
    }
    prevHeight = currHeight

    await stagehand.act("scroll to the bottom of the page", { page: shPage })
    await pw.waitForTimeout(1500) // Wait for lazy load

    // Optional: extract new items each iteration
    const newItems = await stagehand.extract("count items loaded", z.number(), { page: shPage })
    console.log(`[SCROLL] Iteration ${i}: ${newItems} items, height ${currHeight}`)
  }
}
```

### Lazy Loading Detection

```typescript
// Wait for specific loader to disappear
await pw.waitForSelector(".skeleton-loader", { state: "detached", timeout: 10000 })

// Or wait for content marker
await pw.waitForFunction(() => document.querySelectorAll('[data-loaded="true"]').length > 0, { timeout: 15000 })

// Staged loading with fallback
await Promise.race([
  pw.waitForSelector(".content-loaded", { timeout: 10000 }),
  pw.waitForTimeout(8000).then(() => {
    throw new Error("Content timeout")
  }),
])
```

### MutationObserver for Dynamic DOM

```typescript
// Inject observer for dynamic content
await pw.evaluate(() => {
  window.__lastMutation = Date.now()
  const observer = new MutationObserver(() => {
    window.__lastMutation = Date.now()
  })
  observer.observe(document.body, { childList: true, subtree: true })
})

// Wait for DOM stability
await pw.waitForFunction(() => Date.now() - window.__lastMutation > 1000, { timeout: 10000 })
```

---

## Complex DOM: Modals, Iframes, Shadow DOM

### Modal Stack Handling

```typescript
async function dismissAllModals(stagehand, shPage) {
  const modalPatterns = [
    "click the X button on any popup",
    "click 'Accept' on cookie banner",
    "click 'Close' on the modal",
    "click outside the dialog to close",
    "press Escape to dismiss popup",
  ]

  for (const pattern of modalPatterns) {
    const actions = await stagehand.observe(pattern, { page: shPage, timeout: 2000 })
    if (actions.length > 0) {
      await stagehand.act(actions[0], { page: shPage })
      await shPage.waitForTimeout(500)
    }
  }
}
```

### Nested Iframe Traversal

```typescript
// Playwright deep locator for iframes
const deepElement = pw.deepLocator("/html/body/div/iframe >> /html/body/button")
await deepElement.click()

// Or traverse manually
const frame = pw.frameLocator('iframe[name="embed"]').first()
await frame.locator("button.submit").click()

// Stagehand in iframe (limited - switch to Playwright)
const iframeContent = await pw.evaluate(() => {
  const iframe = document.querySelector("iframe")
  return iframe?.contentDocument?.body?.innerHTML
})
```

### Shadow DOM Penetration

```typescript
// Playwright deep locator with shadow piercing
const shadowElement = pw.deepLocator("/html/body/custom-element/>>/div/button")

// Or evaluate into shadow root
const shadowText = await pw.evaluate(() => {
  const shadow = document.querySelector("my-component")?.shadowRoot
  return shadow?.querySelector(".inner")?.textContent
})
```

---

## Advanced Extraction Patterns

### Vague Instruction Exploitation

```typescript
// Let AI decide what's interesting
const interesting = await stagehand.extract(
  "Find the most noteworthy thing on this page and explain your reasoning",
  z.object({ item: z.string(), reasoning: z.string(), confidence: z.number().optional() }),
  { page: shPage },
)
```

### Multi-Conditional Extraction

```typescript
const filtered = await stagehand.extract(
  `Find repositories that match ALL conditions:
   1. Has more than 1000 stars
   2. Primary language is TypeScript OR Rust
   3. Updated within the last month
   4. Has fewer than 50 open issues
   Return name, stars, and which conditions it matched.`,
  z.object({
    repos: z
      .array(
        z.object({
          name: z.string(),
          stars: z.string(),
          matchedConditions: z.array(z.string()),
        }),
      )
      .max(5),
  }),
  { page: shPage },
)
```

### Deep Nested Schema (3+ Levels)

```typescript
// ✅ WORKS: 3+ levels deep
const nested = await stagehand.extract(
  "Extract org structure",
  z.object({
    org: z.object({
      name: z.string(),
      teams: z
        .object({
          engineering: z
            .object({
              members: z
                .array(
                  z.object({
                    name: z.string(),
                    role: z.string().optional(),
                  }),
                )
                .optional(),
            })
            .optional(),
        })
        .optional(),
    }),
  }),
  { page: shPage },
)
```

### Large Schema Workaround

```typescript
// ❌ FAILS: Large schema with arrays
// z.object({ items: z.array(z.object({ ...20 fields... })) })

// ✅ WORKAROUND 1: Split into multiple extractions
const names = await stagehand.extract("get all repo names", z.array(z.string()).max(20), { page: shPage })
const stars = await stagehand.extract("get all star counts in same order", z.array(z.string()).max(20), {
  page: shPage,
})

// ✅ WORKAROUND 2: Use passthrough + post-process
const raw = await stagehand.extract(
  "extract all repo data",
  z.object({ repos: z.array(z.object({ name: z.string() }).passthrough()).max(10) }),
  { page: shPage },
)

// ✅ WORKAROUND 3: Flatten schema
const flat = await stagehand.extract(
  "extract repos",
  z.object({
    names: z.array(z.string()).max(10),
    stars: z.array(z.string()).max(10),
    langs: z.array(z.string()).max(10),
  }),
  { page: shPage },
)
```

### Streaming Extraction for Large Datasets

```typescript
// Extract in batches to avoid timeout/schema issues
async function extractBatched(stagehand, shPage, batchSize = 5, maxItems = 50) {
  const results = []

  for (let i = 0; i < Math.ceil(maxItems / batchSize); i++) {
    const offset = i * batchSize
    const batch = await stagehand.extract(
      `extract items ${offset + 1} through ${offset + batchSize}`,
      z.object({ items: z.array(z.any()).max(batchSize) }),
      { page: shPage, timeout: 45000 },
    )
    results.push(...(batch.items || []))

    if (batch.items?.length < batchSize) break // End of data
  }
  return results
}
```

---

## Error Recovery & Resilience

### Robust Action Pattern

```typescript
async function robustAct(stagehand, shPage, instructions, options = {}) {
  const { timeout = 30000, retries = 2 } = options

  for (const instruction of [instructions].flat()) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const actions = await stagehand.observe(instruction, { page: shPage, timeout: 5000 })
        if (actions.length > 0) {
          await stagehand.act(actions[0], { page: shPage, timeout })
          return true
        }
      } catch (e) {
        if (attempt === retries) console.log(`[ACT FAILED] ${instruction}: ${e.message}`)
        await shPage.waitForTimeout(1000 * (attempt + 1)) // Backoff
      }
    }
  }
  return false
}

// Usage with fallback chain
await robustAct(stagehand, shPage, [
  "click the submit button",
  "click the button that says 'Submit'",
  "click the blue button at the bottom",
])
```

### Extraction with Validation Retry

```typescript
async function extractWithRetry(stagehand, shPage, prompt, schema, options = {}) {
  const { retries = 2, validate = () => true } = options

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await stagehand.extract(prompt, schema, { page: shPage, timeout: 60000 })
      if (validate(result)) return { success: true, result }
      console.log(`[VALIDATION FAILED] Attempt ${attempt + 1}`)
    } catch (e) {
      console.log(`[EXTRACT ERROR] Attempt ${attempt + 1}: ${e.message.slice(0, 100)}`)
    }

    // Refine prompt on retry
    if (attempt < retries) {
      prompt = `${prompt} (be more precise, ensure all fields are populated)`
    }
  }
  return { success: false, result: null }
}
```

### CDP Connection Stability

```typescript
async function ensureConnection(globalThis) {
  // Check if browser is still alive
  try {
    await globalThis.pw.evaluate(() => 1 + 1)
  } catch {
    console.log("[CDP LOST] Reconnecting...")
    const newBrowser = await chromium.connectOverCDP({
      wsEndpoint: globalThis.sh.connectURL(),
    })
    globalThis.pw = newBrowser.contexts()[0].pages()[0]
    globalThis.pwBrowser = newBrowser
  }
  return globalThis
}
```

---

## Performance Optimization

### Parallel Operations

```typescript
// Parallel extraction (careful: shares LLM rate limit)
const [repos, issues, prs] = await Promise.all([
  stagehand.extract("repo names", z.array(z.string()).max(10), { page: shPage }),
  stagehand.extract("issue count", z.number(), { page: shPage }),
  pw.locator(".pr-count").textContent(),
])

// Parallel with timeout race
const result = await Promise.race([
  stagehand.extract("get data", schema, { page: shPage, timeout: 45000 }),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 40000)),
])
```

### Selective Verbosity

```typescript
// Silent mode for production
const stagehand = new Stagehand({ env: "LOCAL", verbose: 0, llmClient: ... })

// Debug mode only when needed
if (process.env.DEBUG_BROWSER) {
  stagehand = new Stagehand({ env: "LOCAL", verbose: 2, llmClient: ... })
}
```

### Memory Management for Long Sessions

```typescript
// Clear browser cache periodically
await pw.context().clearCookies()
await pw.evaluate(() => {
  if (window.gc) window.gc() // If --expose-gc flag enabled
})

// Close unused tabs
const pages = pw.context().pages()
for (const page of pages.slice(1)) {
  // Keep first page
  await page.close()
}

// Hard reset if memory is critical
await pwBrowser.close()
await stagehand.close()
// Then reinitialize
```

---

## Timeout Tuning Matrix

| Scenario                       | Nav Timeout | Wait After Nav | Extract Timeout | Act Timeout |
| ------------------------------ | ----------- | -------------- | --------------- | ----------- |
| Simple static page             | 30000       | 1000           | 30000           | 15000       |
| GitHub repo                    | 60000       | 2000           | 45000           | 30000       |
| SPA with lazy load             | 60000       | 5000           | 60000           | 30000       |
| Complex extraction (5+ fields) | 60000       | 3000           | 90000           | N/A         |
| Multi-step workflow            | 60000       | 2000           | 60000           | 45000       |
| Vague instruction              | N/A         | N/A            | 60000           | N/A         |

---

## Anti-Patterns & Edge Cases

### API Confusion: Page vs Instance

```typescript
// ❌ WRONG: Calling AI methods on page object
await shPage.act("click the button") // Error: shPage.act is not a function
await sh.extract("get data", schema) // Error: sh.extract is not a function
await shPage.observe("find element") // Error: shPage.observe is not a function

// ✅ CORRECT: Call AI methods on stagehand INSTANCE, pass page in options
await stagehand.act("click the button", { page: shPage })
await stagehand.extract("get data", schema, { page: sh })
await stagehand.observe("find element", { page: shPage })

// The pattern is ALWAYS: stagehand.METHOD(instruction, { page: shPage })
```

### Clicking Tabs Instead of Direct Navigation

```typescript
// ❌ UNRELIABLE: Clicking tabs
await pw.locator('[data-tab="repositories"]').first().click() // Often fails
await stagehand.act("click repositories tab") // May click wrong element

// ✅ RELIABLE: Direct URL navigation
await pw.goto("https://github.com/user?tab=repositories")

// ✅ Pattern: Build URL dynamically
const baseRepo = "facebook/react"
const tab = "issues"
await pw.goto(`https://github.com/${baseRepo}/${tab}`)
```

### When act() Fails Silently

```typescript
// act() sometimes returns without error but doesn't perform action
// Solution: Verify state change after act

const urlBefore = shPage.url()
await stagehand.act("click the link", { page: shPage })
await shPage.waitForTimeout(1000)

if (shPage.url() === urlBefore) {
  // act() silently failed, use Playwright fallback
  await pw.locator('a[href*="target"]').click()
}
```

### Schema Validation Edge Cases

```typescript
// ❌ NULL breaks validation even with optional
// LLM may return { stars: null } instead of omitting the field

// ✅ Use preprocess to handle null
const schema = z.object({
  stars: z.preprocess((val) => val ?? undefined, z.string().optional()),
})

// ✅ Or use passthrough + post-validation
const raw = await stagehand.extract("get data", z.object({}).passthrough(), { page: sh })
const validated = { stars: raw.stars ?? undefined }
```

### Array Length Mismatch

```typescript
// Parallel arrays may have different lengths
const { names, stars } = await stagehand.extract(
  "get names and stars",
  z.object({
    names: z.array(z.string()),
    stars: z.array(z.string()),
  }),
  { page: sh },
)

// Zip safely
const combined = (names || []).map((name, i) => ({
  name,
  stars: stars?.[i] ?? "unknown",
}))
```

### Stale Element After Observe

```typescript
// DOM may change between observe() and act()
const actions = await stagehand.observe("click the button", { page: shPage })
await shPage.waitForTimeout(100) // Small delay
// Re-observe if action fails
try {
  await stagehand.act(actions[0], { page: shPage })
} catch {
  const reObserved = await stagehand.observe("click the button", { page: shPage })
  if (reObserved.length > 0) await stagehand.act(reObserved[0], { page: shPage })
}
```

---

## Extreme Multi-Page Workflows

### State Machine Pattern

```typescript
const workflow = {
  states: ["landing", "search", "results", "detail", "extract"],
  currentState: "landing",
  transitions: {
    landing: {
      next: "search",
      action: async () => {
        await pw.goto("...")
      },
    },
    search: {
      next: "results",
      action: async () => {
        await stagehand.act("search", { page: shPage })
      },
    },
    // ...
  },

  async run() {
    while (this.currentState !== "extract") {
      const transition = this.transitions[this.currentState]
      try {
        await transition.action()
        this.currentState = transition.next
      } catch (e) {
        console.log(`[STATE ERROR] at ${this.currentState}: ${e.message}`)
        // Recovery logic
      }
    }
  },
}
```

### Cross-Page Data Accumulation

```typescript
globalThis.accumulatedData = []

async function scrapeWithPagination(stagehand, shPage, pw, maxPages = 10) {
  for (let page = 1; page <= maxPages; page++) {
    const data = await stagehand.extract(`extract items on page ${page}`, z.object({ items: z.array(z.any()) }), {
      page: shPage,
    })
    globalThis.accumulatedData.push(...(data.items || []))

    // Check for next page
    const hasNext = await stagehand.observe("click the next page button", { page: shPage, timeout: 3000 })
    if (hasNext.length === 0) break
    await stagehand.act(hasNext[0], { page: shPage })
    await shPage.waitForTimeout(2000)
  }
  return globalThis.accumulatedData
}
```

---

## Known Hard Limits

| Limit                      | Value        | Workaround          |
| -------------------------- | ------------ | ------------------- |
| Max schema fields          | ~15 reliably | Split extraction    |
| Max array items in schema  | ~10          | Batch extraction    |
| Extract timeout ceiling    | 90s          | Split prompt        |
| act() reliability          | ~85%         | observe+act pattern |
| CDP connection stability   | Minutes      | Heartbeat check     |
| LLM context for extraction | ~8K tokens   | Focused prompts     |

---

## Debug Mode Checklist

When things fail unexpectedly:

1. Enable verbose: `verbose: 2`
2. Screenshot before/after: `await pw.screenshot({ path: 'debug.png' })`
3. Print DOM state: `console.log(await pw.content().slice(0, 5000))`
4. Check connection: `await ensureConnection(globalThis)`
5. Validate schema with minimal data first
6. Try Playwright fallback for failed act()
7. Check for hidden overlays: `await pw.evaluate(() => document.querySelector('.overlay')?.style.display)`
