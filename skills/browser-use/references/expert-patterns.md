# Expert Patterns

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";
```

## Authentication Flows

### Login Flow Pattern

```typescript
async function login(
  stagehand: Stagehand,
  page: any,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("https://example.com/login");

  // Check if already logged in
  const actions = await stagehand.observe("click the logout button");
  if (actions.length === 0) {
    // Not logged in, proceed with login
    await stagehand.act(`type '${email}' into the email field`);
    await stagehand.act(`type '${password}' into the password field`);
    await stagehand.act("click the login button");

    // Wait for redirect
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  }
}
```

### OAuth Flows

```typescript
async function handleOAuth(stagehand: Stagehand): Promise<void> {
  // Trigger OAuth
  await stagehand.act("click the 'Sign in with Google' button");

  // Wait for popup/new page
  const oauthPage = await stagehand.context.waitForEvent("page");
  await oauthPage.waitForLoadState();

  // Handle OAuth on the new page
  await stagehand.act("click the account to use", { page: oauthPage });

  // Wait for redirect back
  await oauthPage.waitForURL("**/callback*");
  await oauthPage.close();
}
```

### Session Persistence

```typescript
// Save cookies for later
const cookies = await stagehand.context.cookies();
// Store cookies securely...

// Restore session
await stagehand.context.addCookies(savedCookies);
await page.goto("https://example.com/dashboard");
```

### 2FA Handling

```typescript
async function handle2FA(stagehand: Stagehand, code: string): Promise<void> {
  await stagehand.act("click the verify button");

  // Check if 2FA is required
  const prompt = await stagehand.extract(
    "what is asking for verification code input?",
    z.string().optional(),
  );

  if (prompt) {
    await stagehand.act(`type '${code}' into the verification code field`);
    await stagehand.act("click the verify button");
  }
}
```

### Sensitive Data Form Filling

Use observe to preview fields, fill sensitive data locally (not sent to LLM):

```typescript
// 1. Observe to get form fields
const observed = await stagehand.observe("fill all form fields with mock data");

// 2. Build field mapping
const mapping = (description: string): string | null => {
  const keywords: Record<string, string[]> = {
    age: ["old", "age"],
    email: ["email", "e-mail"],
    phone: ["phone", "tel"],
  };
  for (const [key, terms] of Object.entries(keywords)) {
    if (terms.some((term) => description.toLowerCase().includes(term))) {
      return key;
    }
  }
  return null;
};

// 3. Sensitive data (not sent to LLM)
const sensitiveData: Record<string, string> = {
  age: "25",
  email: "user@example.com",
  phone: "1234567890",
};

// 4. Replace parameters locally
const updated = observed.map((candidate) => {
  const key = mapping(candidate.description);
  if (key && sensitiveData[key]) {
    candidate.arguments = [sensitiveData[key]];
  }
  return candidate;
});

// 5. Execute filling
for (const candidate of updated) {
  await stagehand.act(candidate);
}
```

## Popups and Modals

### Cookie Banners

```typescript
async function dismissCookieBanner(stagehand: Stagehand): Promise<void> {
  const actions = await stagehand.observe("click the accept cookies button", {
    timeout: 3000,
  });
  if (actions.length > 0) {
    await stagehand.act(actions[0]);
  }
}
```

### Newsletter/Exit Intent Popups

```typescript
async function dismissPopup(stagehand: Stagehand): Promise<void> {
  // Common patterns
  const patterns = [
    "click the close button on the popup",
    "click the X button",
    "click outside the modal",
    "click 'No thanks'",
    "click 'Not now'",
  ];

  for (const pattern of patterns) {
    const actions = await stagehand.observe(pattern, { timeout: 2000 });
    if (actions.length > 0) {
      await stagehand.act(actions[0]);
      return;
    }
  }
}
```

### Alert/Confirm Dialogs

```typescript
// Handle native browser dialogs
page.on("dialog", async (dialog) => {
  console.log(`Dialog: ${dialog.message()}`);
  await dialog.accept(); // or dialog.dismiss()
});

// Trigger action that shows dialog
await stagehand.act("click the delete button");
```

## Multiple Windows/Tabs

### Coordinating Windows

```typescript
// Track all pages
const pages = stagehand.context.pages();

// Listen for new pages
stagehand.context.on("page", async (newPage) => {
  await newPage.waitForLoadState();
  console.log("New page opened:", newPage.url());
});

// Work across windows
const mainWindow = pages[0];
await stagehand.act("click 'open in new window'", { page: mainWindow });

const newWindow = stagehand.context.pages()[1];
await stagehand.extract("get the data", { page: newWindow });
```

### Window Focus

```typescript
// Bring page to front
await page.bringToFront();

// Check if page is active
const isActive = page === stagehand.context.pages()[0];
```

## Performance Optimization

### Caching DOM Observations

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  cacheDir: "./stagehand-cache",
});
```

### Batch Operations

```typescript
// Extract once, use multiple times
const pageData = await stagehand.extract(
  "extract all interactive elements and their states",
  z.object({
    buttons: z.array(
      z.object({
        text: z.string(),
        disabled: z.boolean(),
      }),
    ),
    links: z.array(
      z.object({
        text: z.string(),
        href: z.string().url(),
      }),
    ),
    forms: z.array(
      z.object({
        name: z.string(),
        fields: z.number(),
      }),
    ),
  }),
);
```

### Parallel Extraction

```typescript
const [products, reviews, ratings] = await Promise.all([
  stagehand.extract("extract all products", productSchema),
  stagehand.extract("extract all reviews", reviewSchema),
  stagehand.extract("extract ratings", ratingSchema),
]);
```

### Reduce Verbose Logging

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 0, // Silent mode for production
});
```

## Selector Strategies

### When Act Fails

```typescript
// Try alternative descriptions
const descriptions = [
  "click the blue submit button",
  "click the button that says 'Submit'",
  "click the form submit button",
  "click the button at the bottom right",
];

for (const desc of descriptions) {
  const actions = await stagehand.observe(desc);
  if (actions.length > 0) {
    await stagehand.act(actions[0]);
    break;
  }
}
```

### Fallback to Playwright Locators

```typescript
// When AI selection fails, use CSS/XPath
try {
  await stagehand.act("click the special button");
} catch {
  // Fallback to direct locator
  await page.locator("button[data-testid='special-btn']").click();
}
```

### Complex DOM Structures

```typescript
// Use DeepLocator for nested structures
const nestedButton = page.deepLocator(
  "//div[@class='container']//iframe//div[@class='modal']//button",
);

// Or extract the path first
const path = await stagehand.extract(
  "provide the XPath to the submit button",
  z.string(),
);
await page.deepLocator(path).click();
```

## Handling CAPTCHAs and Rate Limiting

### CAPTCHA Detection

```typescript
async function detectCaptcha(stagehand: Stagehand): Promise<boolean> {
  const result = await stagehand.extract(
    "is there a CAPTCHA or verification challenge visible?",
    z.boolean(),
  );
  return result;
}

if (await detectCaptcha(stagehand)) {
  throw new Error("CAPTCHA detected - manual intervention required");
}
```

### Rate Limiting Workarounds

```typescript
async function safeAct(
  stagehand: Stagehand,
  page: any,
  instruction: string,
  delay = 1000,
): Promise<void> {
  await stagehand.act(instruction);
  await page.waitForTimeout(delay); // Add delay between actions
}

// Random delays to appear more human-like
function randomDelay(min = 500, max = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

await safeAct(stagehand, page, "click next", randomDelay());
```

### Exponential Backoff for Retries

```typescript
async function retryWithBackoff<T>(
  page: any,
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      await page.waitForTimeout(delay);
    }
  }
  throw new Error("Max retries exceeded");
}
```

## Debugging and Troubleshooting

### Enable Debug Mode

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 2, // Full debug output
});
```

### Screenshot on Failure

```typescript
async function safeActWithScreenshot(
  stagehand: Stagehand,
  page: any,
  instruction: string,
): Promise<void> {
  try {
    await stagehand.act(instruction);
  } catch (error) {
    await page.screenshot({ path: `error-${Date.now()}.png` });
    throw error;
  }
}
```

### Dump Page State

```typescript
async function debugPageState(stagehand: Stagehand, page: any): Promise<void> {
  console.log("URL:", page.url());
  console.log("Title:", await page.title());

  const state = await stagehand.extract(
    "describe the current page state, visible elements, and any errors",
    z.string(),
  );
  console.log("Page state:", state);

  await page.screenshot({ path: "debug-screenshot.png" });
}
```

### Check Element Visibility

```typescript
const isVisible = await page.locator(".my-element").isVisible();
const isEnabled = await page.locator("button").isEnabled();
const count = await page.locator(".item").count();
```

## Error Handling

```typescript
import {
  StagehandError,
  ActTimeoutError,
  StagehandElementNotFoundError,
} from "@browserbasehq/stagehand";

try {
  await stagehand.act("click button");
} catch (e) {
  if (e instanceof ActTimeoutError) {
    console.log("Action timed out, can retry");
  } else if (e instanceof StagehandElementNotFoundError) {
    console.log("Element not found, page may have changed");
  } else if (e instanceof StagehandError) {
    console.log("Stagehand error:", e.message);
  }
}
```

**Common Error Types:**

- `StagehandNotInitializedError` - Not initialized
- `ActTimeoutError`, `ExtractTimeoutError`, `ObserveTimeoutError` - Timeout
- `StagehandElementNotFoundError` - Element not found
- `StagehandIframeError` - Iframe operation failed
- `MCPConnectionError` - MCP connection failed

## Common Pitfalls

| Pitfall                  | Solution                                               |
| ------------------------ | ------------------------------------------------------ |
| Act on wrong page        | Always use `{ page }` option when multiple pages exist |
| Timing issues            | Use `waitForSelector` or `waitForLoadState`            |
| Vague act instructions   | Be specific: "type 'X' into Y" not "fill form"         |
| Stale elements           | Use observe+act pattern, not cached selectors          |
| iframe content not found | Use `deepLocator()` for iframe/shadow DOM              |
| Modal blocking           | Check for and dismiss popups before main actions       |
| Session timeout          | Save/restore cookies, handle re-auth                   |
| Rate limiting            | Add delays, use exponential backoff                    |
