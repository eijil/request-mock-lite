# Request Mock Lite

[中文文档](README.zh-CN.md)

A lightweight Chrome DevTools extension for capturing API requests and mocking
`fetch` / `XMLHttpRequest` responses.

## Features

- Capture HTTP(S) requests from the inspected tab.
- Create mock rules from captured requests.
- Mock response body, status code, and headers.
- Match by origin + path, exact URL, substring, or regex.
- Organize rules into groups.
- Enable or disable groups and individual rules.
- Import and export rules as JSON.

## Installation

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `request-mock-lite` folder.
5. Open DevTools and select the **Mock Lite** panel.

## Usage

1. Open the **Mock Lite** DevTools panel.
2. Refresh or use the page to collect requests.
3. Click **Mock this** on a captured request.
4. Edit the match rule, status, headers, or response body.
5. Save the rule and trigger the request again.
