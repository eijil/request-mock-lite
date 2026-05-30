# Chrome Web Store Listing

## Name

Request Mock Lite

## Short Description

Capture API requests and mock fetch/XHR responses from a lightweight DevTools panel.

## Detailed Description

Request Mock Lite is a small Chrome DevTools extension for frontend developers
who need to mock API responses while building and debugging web applications.

Open the Mock Lite panel, capture requests from the current tab, create a mock
rule from any captured request, and edit the response body, status code, headers,
method, and URL matching strategy. Rules can be organized into groups and toggled
on or off individually.

## Category

Developer Tools

## Single Purpose

Request Mock Lite captures API requests from the inspected tab and lets
developers mock page-level fetch/XHR responses for local debugging.

## Permissions Justification

- `storage`: saves mock groups, rules, and panel settings locally.
- `scripting`: supports extension script execution in inspected pages.
- `<all_urls>`: allows the extension to run on developer-selected pages and mock
  API requests across local, staging, and production-like environments.

## Data Usage

Request Mock Lite stores rules and captured request data locally in Chrome
extension storage. It does not send data to external servers.

## Suggested Screenshots

- `screenshots/01-panel.png`
- `screenshots/02-rule-editor.png`
- `screenshots/03-page-badge.png`
