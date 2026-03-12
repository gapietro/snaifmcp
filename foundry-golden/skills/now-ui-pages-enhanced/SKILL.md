---
name: now-ui-pages-enhanced
description: Build ServiceNow UI Pages using React and Fluent DSL with correct authentication, popup prevention, and build system patterns. Use when creating UI Pages for ServiceNow scoped applications.
scope: global
recommended: false
version: 2025.01.1601
triggers:
  - ui page
  - servicenow ui
  - react servicenow
  - uipage
  - fluent ui
  - authentication popup
tags:
  - servicenow
  - ui-pages
  - react
  - fluent
---

# ServiceNow UI Pages - Coding Agent Reference Guide

## Purpose

Complete specification for AI coding agents to generate ServiceNow UI Pages. Follow these instructions to create working, maintainable code that prevents authentication popups and other common issues.

## Authentication Popup Prevention (CRITICAL)

### Required patterns:

**1. Cache-busting parameter (prevents stale content popups)**
```html
<!-- CORRECT -->
<script src="main.jsx?uxpcb=$[UxFrameworkScriptables.getFlushTimestamp()]" type="module"></script>
```

**2. Scoped session token (works in scoped applications)**
```html
<!-- CORRECT - Works in scoped applications -->
<script>window.g_ck = '$[gs.getSession().getSessionToken()]';</script>

<!-- WRONG - Fails in scoped applications -->
<script>window.g_ck = '$[gs.getSessionToken()]';</script>
```

**3. UI Page access level (must match API auth)**
```typescript
// CORRECT - For authenticated APIs
UiPage({ accessible_from: 'logged_in' });
```

**4. Consistent credential handling**
```javascript
// CORRECT - Use in ALL fetch calls
fetch(url, {
  credentials: 'include',
  headers: { 'X-UserToken': window.g_ck }
});
```

## Essential Guidelines

1. **UiPage API**: Use `UiPage` from `@servicenow/sdk/core`
2. **HTML Reference**: Use imports for HTML files: `import myPage from '../../client/index.html'`
3. **Script Management**: Load JS via `<script type="module">`, no inline JS in HTML
4. **Use XHTML**: Self-closing tags for void elements (`<img />`, `<br />`)
5. **No DOCTYPE** in HTML files
6. **No Jelly** in HTML files
7. **Use React**: Always use React, never vanilla JS or jQuery
8. **Modularize**: Keep components under 100 lines, separate files
9. **CSS**: Import CSS in JS/JSX (`import './app.css'`), no CSS Modules, no @import in CSS

## Minimal Starter Template

### File Structure
```
src/
  client/
    index.html
    main.jsx
    app.jsx
    utils/fields.js
  fluent/ui-pages/page.now.ts
```

### Fields Utility (ALWAYS CREATE FIRST)
```javascript
// src/client/utils/fields.js
export const display = (field) => field?.display_value || '';
export const value = (field) => field?.value || '';
```

### UI Page Definition
```typescript
import '@servicenow/sdk/global';
import { UiPage } from '@servicenow/sdk/core';
import page from '../../client/index.html';

export const my_page = UiPage({
  $id: Now.ID['my-page'],
  endpoint: 'x_app_page.do',
  html: page,
  direct: true,
  accessible_from: 'logged_in'
});
```

### HTML Entry
```html
<html>
<head>
  <sdk:now-ux-globals></sdk:now-ux-globals>
  <script>window.g_ck = '$[gs.getSession().getSessionToken()]';</script>
  <script src="main.jsx?uxpcb=$[UxFrameworkScriptables.getFlushTimestamp()]" type="module"></script>
</head>
<body><div id="root"></div></body>
</html>
```

### React Bootstrap
```jsx
// src/client/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
```

## Authentication Pattern for API Calls

```javascript
// ALWAYS use this
fetch('/api/now/table/incident?sysparm_display_value=all', {
  credentials: 'include',
  headers: {
    "Accept": "application/json",
    "X-UserToken": window.g_ck
  }
})
```

## Build System Rules

The ServiceNow IDE handles ALL build processes automatically.

**NEVER:**
- Create webpack.config.js or any build configs
- Add build scripts to package.json
- Configure babel/typescript compiler
- Add build tools as dependencies

## Limitations

- No CSS Modules (`.module.css`)
- No @import in CSS files
- Hash routing only (`#/route`)
- No server-side rendering
- No media files (audio, video, WASM)

## Authentication Troubleshooting Checklist

1. Cache-busting parameter: `?uxpcb=$[UxFrameworkScriptables.getFlushTimestamp()]`
2. Scoped session token: `gs.getSession().getSessionToken()`
3. UI Page access level: `accessible_from: 'logged_in'`
4. Consistent credentials: `credentials: 'include'` in ALL fetch calls
5. Session token validation before API calls

## Installation

```bash
foundry_add type="skill" name="now-ui-pages-enhanced" global=true
```
