# Request Mock Lite

[![Release](https://img.shields.io/github/v/release/eijil/request-mock-lite?style=flat-square)](https://github.com/eijil/request-mock-lite/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT111315?style=flat-square)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/chrome-extension-e85d40?style=flat-square)](https://github.com/eijil/request-mock-lite/releases)

**Request Mock Lite** is a lightweight Chrome DevTools extension for capturing
API requests and mocking `fetch` / `XMLHttpRequest` responses from the browser.

[中文文档](README.zh-CN.md) · [Download latest release](https://github.com/eijil/request-mock-lite/releases/latest)

![Request Mock Lite panel](store-assets/screenshots/01-panel.png)

## Why

Frontend work often depends on API states that are slow, unstable, unfinished,
or hard to reproduce. Request Mock Lite keeps that workflow local and fast:
capture a request, turn it into a rule, edit the response, and keep building.

## Highlights

- Capture HTTP(S) requests from the inspected tab.
- Open the rule manager from the toolbar side panel without opening DevTools.
- Create mock rules from captured requests.
- Mock response body, status code, and headers.
- Add per-rule response delay.
- Format and validate JSON response bodies.
- Match by origin + path, exact URL, substring, or regex.
- Organize rules into groups.
- Enable or disable groups and individual rules.
- Import and export rules as JSON.

## Screenshots

| Rule editor | In-page mock badge |
| --- | --- |
| ![Rule editor](store-assets/screenshots/02-rule-editor.png) | ![Mock badge](store-assets/screenshots/03-page-badge.png) |

## Installation

1. Download `request-mock-lite.zip` from the [latest release](https://github.com/eijil/request-mock-lite/releases/latest).
2. Unzip the package.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the `request-mock-lite` folder.
7. Click the Request Mock Lite toolbar icon to open the side-panel manager.
8. Open DevTools and select the **Mock Lite** panel only when you want to capture requests from the inspected tab.

## Usage

1. Click the Request Mock Lite toolbar icon to open the side-panel manager.
2. Add a rule manually, paste a cURL command in the **Add** flow, or import an existing JSON rules file.
3. Enable or disable groups and rules from the manager; changes are saved immediately to extension storage.
4. To create a rule from a live request, open the **Mock Lite** DevTools panel, refresh or use the page, then click **Mock this** on a captured request.
5. Edit the match rule, status, headers, delay, or response body.
6. Save the rule and trigger the request again.

## Local Development

Clone the repository, then load the project folder as an unpacked Chrome
extension.

```bash
git clone https://github.com/eijil/request-mock-lite.git
cd request-mock-lite
```

Package a release zip locally:

```bash
npm install
npm run package
```

## Releasing

Releases are automated. Bump the version and push the tag — GitHub Actions builds
the zip and publishes the GitHub Release:

```bash
npm version patch   # or: minor / major
```

`npm version` updates `package.json`, syncs `manifest.json` to the same version,
commits, creates a `vX.Y.Z` tag, and pushes the commit and tag. The `Release`
workflow (`.github/workflows/release.yml`) then packages the extension and
attaches `request-mock-lite.zip` to the GitHub Release with auto-generated notes.

## License

[MIT](LICENSE)
