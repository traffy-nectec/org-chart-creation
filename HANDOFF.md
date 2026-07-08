# Handoff: Frontend Database-driven Aliases 

## Context/Background
This repository handles the React frontend for creating and importing organization charts. Previously, the alias mappings (e.g. `องค์การบริหารส่วนตำบล` -> `อบต.`) and typo corrections were hardcoded into `App.jsx` (`FULL_TO_ABBREV_DICT`). This made it hard to add new typos without touching the codebase.

## Completed Tasks
- **Alias Refactoring**: Refactored `App.jsx` to fetch alias rules from the backend API (`GET /api/aliases`) upon component mount.
- **Dynamic Normalization**: The `sanitizeString` function now iterates over the dynamically loaded `orgNameAliases` map and handles typo corrections like `เเ` -> `แ` and `ํา` -> `ำ` transparently.
- **Cleanup**: Removed hardcoded dictionary maps and obsolete files (e.g., deleted test scripts causing lint errors).

## Current State
- Code is pushed to `main`.
- Frontend is running seamlessly, making an API call to the backend on load.

## Pending Tasks / Next Steps
- Verify edge cases for string normalization (e.g., excessive spaces in parentheses) against the latest dataset from users.
- Support App Links / Universal Links replacing Firebase Dynamic Links as requested by the Product team.

## Known Issues / Open Questions
- None blocking at this moment.

## Important Commands
- **Start Dev Server**: `npm run dev`
- **Lint Code**: `npm run lint`
