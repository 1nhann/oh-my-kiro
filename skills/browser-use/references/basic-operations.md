# Basic Operations

## Page Navigation

```typescript
const page = stagehand.context.pages()[0];

// Navigate to URL
await page.goto("https://example.com");

// Navigation history
await page.goBack();
await page.goForward();

// Reload
await page.reload();

// Wait for navigation to complete
await page.waitForLoadState("networkidle");
await page.waitForURL("**/dashboard");
```

## Basic Act Operations

### Clicking

```typescript
await stagehand.act("click the submit button");
await stagehand.act("click the 'Accept Cookies' banner");
await stagehand.act("click the hamburger menu icon");
```

### Typing

```typescript
await stagehand.act("type 'john@example.com' into the email field");
await stagehand.act("type 'search query' into the search box");
await stagehand.act("type '12345' into the zip code input");
```

### Scrolling

```typescript
await stagehand.act("scroll down");
await stagehand.act("scroll up");
await stagehand.act("scroll down 500 pixels");
await stagehand.act("scroll to the bottom of the page");
```

### Selecting Dropdowns

```typescript
await stagehand.act("select 'United States' from the country dropdown");
await stagehand.act("select '2024' from the year selector");
```

### Checkboxes and Radio Buttons

```typescript
await stagehand.act("check the terms and conditions checkbox");
await stagehand.act("select the 'Premium' radio button");
await stagehand.act("uncheck the newsletter subscription");
```

### Hovering

```typescript
await stagehand.act("hover over the 'Products' menu item");
await stagehand.act("hover over the user profile icon");
```

## Simple Extraction

### Without Schema (Returns `{ extraction: string }`)

```typescript
const { extraction } = await stagehand.extract("extract the page title");
const result = await stagehand.extract("what is the main heading text?");
```

### With Schema

```typescript
import { z } from "zod/v3";

// Single value
const price = await stagehand.extract("extract the price", z.string());

// Object
const product = await stagehand.extract(
  "extract product details",
  z.object({
    name: z.string(),
    price: z.string(),
    inStock: z.boolean(),
  }),
);

// Array
const { items } = await stagehand.extract(
  "extract all list items",
  z.object({
    items: z.array(z.string()),
  }),
);
```

### URL Extraction

```typescript
const { links } = await stagehand.extract(
  "extract all navigation links",
  z.object({
    links: z.array(z.string().url()),
  }),
);
```

## Observe + Act Patterns

### Basic Pattern

```typescript
// Observe first, then act - prevents DOM changes between detection and execution
const actions = await stagehand.observe("click the login button");
await stagehand.act(actions[0]);
```

### Multiple Candidates

```typescript
const actions = await stagehand.observe("click a product card");
if (actions.length > 0) {
  // Choose first or iterate through options
  await stagehand.act(actions[0]);
}
```

### Conditional Execution

```typescript
const actions = await stagehand.observe("click the close button on the popup");
if (actions.length > 0) {
  await stagehand.act(actions[0]);
}
// Continue if no popup exists
```

### Target Specific Page

```typescript
const page2 = await stagehand.context.newPage();
const actions = await stagehand.observe("click submit", { page: page2 });
await stagehand.act(actions[0], { page: page2 });
```

## Targeted Extraction

Use a selector to extract from a specific element:

```typescript
const text = await stagehand.extract("extract the error message", z.string(), {
  selector: "/html/body/div[@class='error']/p",
});

const iframeContent = await stagehand.extract(
  "extract the button text",
  z.string(),
  { selector: "/html/body/iframe/html/body/button" },
);
```

## Page Content Access

```typescript
// Raw HTML
const html = await page.content();

// Page title
const title = await page.title();

// Current URL
const url = page.url();

// Screenshot
await page.screenshot({ path: "screenshot.png" });

// Wait for specific content
await page.waitForSelector(".loaded");
await page.waitForFunction(() => document.readyState === "complete");
```
