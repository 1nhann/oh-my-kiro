# Intermediate Patterns

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";
```

## Multi-Page Workflows

### Creating and Managing Pages

```typescript
const page1 = stagehand.context.pages()[0];
await page1.goto("https://site1.com");

const page2 = await stagehand.context.newPage();
await page2.goto("https://site2.com");

// Target specific pages
await stagehand.act("click login", { page: page1 });
const data = await stagehand.extract("get title", { page: page2 });

// Close pages when done
await page2.close();
```

### Tab Coordination

```typescript
const [mainPage] = stagehand.context.pages();

// Trigger action that opens new tab
await stagehand.act("click the 'Open in new tab' link");

// Wait for new page and get reference
const newPage = await stagehand.context.waitForEvent("page");
await newPage.waitForLoadState();

// Work with both pages
await stagehand.act("click download", { page: newPage });
```

### Popup Handling

```typescript
// Listen for popup
const [popup] = await Promise.all([
  stagehand.context.waitForEvent("page"),
  stagehand.act("click the link that opens a popup"),
]);

await popup.waitForLoadState();
await stagehand.act("accept the terms", { page: popup });
await popup.close();
```

## DeepLocator (Iframes & Shadow DOM)

### Targeting Inside Iframes

```typescript
// XPath-based targeting through iframes
const element = page.deepLocator("/html/body/div/iframe/html/body/button");

// Highlight to verify targeting
await element.highlight({ durationMs: 3000 });

// Interact with iframe content
await element.click();
```

### Shadow DOM Traversal

```typescript
// Shadow DOM elements require DeepLocator
const shadowElement = page.deepLocator("/html/body/custom-element//div/button");
await shadowElement.highlight();
```

### Complex Nested Structures

```typescript
// Iframe inside shadow DOM, etc.
const nested = page.deepLocator(
  "/html/body/app-root//div/iframe/html/body/widget//button",
);
```

## Form Filling Strategies

### Sequential Field Filling

```typescript
await stagehand.act("type 'John' into the first name field");
await stagehand.act("type 'Doe' into the last name field");
await stagehand.act("type 'john@example.com' into the email field");
await stagehand.act("select 'United States' from the country dropdown");
await stagehand.act("check the terms checkbox");
await stagehand.act("click the submit button");
```

### Form with Validation

```typescript
// Fill and check for errors
await stagehand.act("type 'invalid-email' into the email field");
await stagehand.act("click the submit button");

// Check for validation error
const error = await stagehand.extract(
  "extract any error message",
  z.string().optional(),
);

if (error) {
  // Fix the error
  await stagehand.act("clear the email field");
  await stagehand.act("type 'valid@email.com' into the email field");
}
```

### File Uploads

```typescript
// Traditional file input
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles("/path/to/file.pdf");

// Drag and drop (use act)
await stagehand.act("drop the file onto the upload area");
```

## Waiting and Synchronization

### Playwright Wait Methods

```typescript
// Wait for selector
await page.waitForSelector(".data-loaded");

// Wait for element to be hidden
await page.waitForSelector(".loading", { state: "hidden" });

// Wait for network idle
await page.waitForLoadState("networkidle");

// Wait for specific URL
await page.waitForURL("**/dashboard");

// Wait for function
await page.waitForFunction(
  () => document.querySelectorAll(".item").length > 10,
);

// Wait for timeout (avoid when possible)
await page.waitForTimeout(2000);
```

### Content-Based Waiting

```typescript
// Wait for specific content to appear
await page.waitForFunction(
  (text) => document.body.innerText.includes(text),
  "Welcome back",
);

// Wait for element count
await page.waitForFunction(
  () => document.querySelectorAll(".product").length >= 20,
);
```

### Retry Pattern

```typescript
async function waitForContent(
  stagehand: Stagehand,
  page: any,
  maxAttempts = 5,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const actions = await stagehand.observe("click the load more button");
    if (actions.length === 0) break;

    await stagehand.act(actions[0]);
    await page.waitForLoadState("networkidle");
  }
  return true;
}
```

## Error Handling

### Try-Catch Pattern

```typescript
try {
  await stagehand.act("click the non-existent button");
} catch (error) {
  console.log("Action failed, trying alternative");
  await stagehand.act("click the alternative button");
}
```

### Observe Before Act (Safer)

```typescript
const actions = await stagehand.observe("click the submit button");
if (actions.length === 0) {
  console.log("Button not found, checking page state");
  const state = await stagehand.extract("describe the current page state");
  throw new Error(`Cannot proceed: ${state}`);
}
await stagehand.act(actions[0]);
```

### Timeout Handling

```typescript
// Set timeout on act
await stagehand.act("click the slow-loading button", { timeout: 30000 });

// Page-level timeout
page.setDefaultTimeout(60000);
```

### Graceful Degradation

```typescript
async function safeAct(
  stagehand: Stagehand,
  instruction: string,
): Promise<boolean> {
  try {
    const actions = await stagehand.observe(instruction, { timeout: 5000 });
    if (actions.length > 0) {
      await stagehand.act(actions[0]);
      return true;
    }
  } catch {
    // Element doesn't exist or timed out
  }
  return false;
}

// Usage
await safeAct(stagehand, "close the cookie banner"); // Doesn't fail if banner doesn't exist
```

## Handling Dynamic Content

### Infinite Scroll

```typescript
async function loadAllItems(stagehand: Stagehand, page: any): Promise<void> {
  let previousCount = 0;

  while (true) {
    const currentCount = await page.evaluate(
      () => document.querySelectorAll(".item").length,
    );

    if (currentCount === previousCount) break;
    previousCount = currentCount;

    await stagehand.act("scroll to the bottom of the page");
    await page.waitForTimeout(1000); // Wait for content to load
  }
}
```

### Polling for Changes

```typescript
async function waitForValue(
  page: any,
  extractFn: () => Promise<string>,
  expected: string,
  maxAttempts = 10,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const value = await extractFn();
    if (value === expected) return true;
    await page.waitForTimeout(500);
  }
  return false;
}
```
