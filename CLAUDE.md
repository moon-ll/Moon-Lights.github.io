# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MOONLIGHT is a personal static website with four pages: Home (index.html), Tools (tools.html), Diary (diary.html), and Projects (projects.html). It uses vanilla HTML/CSS/JS with no build system or framework.

## Architecture

- **Single JS file**: All application logic is in `app.js` — no module system, no bundling
- **Single CSS file**: All styles in `styles.css` using CSS custom properties for theming
- **localStorage persistence**: Data stored as JSON in browser localStorage (keys: `todos`, `diaries`, `projects`, `comments`)
- **No backend**: Everything runs client-side in the browser

## Data Structures

All stored as JSON arrays in localStorage:
- `todos`: `{ text, completed, createdAt }`
- `diaries`: `{ id, date, title, content, tags }`
- `projects`: `{ id, title, link, desc, tags, createdAt }`
- `comments`: `{ id, projectId, author, content, createdAt }`

## Development

No build commands needed — open `index.html` directly in a browser. There are no tests, linters, or pre-commit hooks configured.

## Important Implementation Notes

- The global search (`performGlobalSearch()` in app.js) only searches static `searchData.tools` entries and localStorage — it does not search the projects list dynamically in the dropdown
- Diary and project entries are sorted by date/createdAt in descending order (newest first)
- The Pomodoro timer uses `crypto.getRandomValues()` for random seed but this is not cryptographically necessary
- All user input is escaped via `escapeHtml()` before rendering to prevent XSS
