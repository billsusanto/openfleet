import { readFileSync } from "fs";
import { join } from "path";

const UI_DIR = import.meta.dir;

export function renderReviewPage(reviewId: string): string {
  const html = readFileSync(join(UI_DIR, "index.html"), "utf-8");
  const css = readFileSync(join(UI_DIR, "styles.css"), "utf-8");
  const js = readFileSync(join(UI_DIR, "scripts.js"), "utf-8");

  return html
    .replace("/* __STYLES__ */", css)
    .replace("/* __SCRIPTS__ */", js)
    .replace("__REVIEW_ID__", reviewId);
}

export function render404Page(reviewId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Review Not Found</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d1117; 
      color: #e6edf3;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .error { text-align: center; }
    h1 { color: #f85149; }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Review Not Found</h1>
    <p>The review with ID "${reviewId}" does not exist.</p>
  </div>
</body>
</html>`;
}
