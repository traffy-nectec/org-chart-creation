# Handoff: Organization Chart Builder & Importer

## Context/Background
This project provides a comprehensive frontend (React/Vite) and backend (Go/Chi/PostgreSQL) stack to batch import, structure, and sanitize massive organization charts for Traffy Fondue.
The primary objective of the recent sessions was to optimize the backend API to handle similarity checks more efficiently, enhance the UI for conflict resolution, and implement robust API-level security.

## Completed Tasks
- **Alias Management Migration:** 
  - Moved the hardcoded alias dictionary (`ALIAS_DICTIONARY`) from the frontend into the database (`voice_fondue_org_aliases`).
  - Implemented `GET /api/aliases` in the backend to serve aliases efficiently from a read replica.
  - Updated the frontend to fetch aliases on mount and apply them dynamically during sanitization.
- **Similarity Check Optimization:**
  - Integrated `pg_trgm` via `similarity()` and `%` operators in the Go backend (`CheckSimilarity`).
  - Restored threshold to `0.4` to ensure optimal coverage while maintaining high performance.
- **Conflict Resolution UI Enhancement:**
  - Overhauled the Similarity Conflict modal. Removed the generic "All" tab.
  - Introduced a 4-Tier semantic grouping system (90-100%, 75-89%, 60-74%, and 40-59%) to make it easier for users to bulk-resolve specific tiers.
  - Widened the modal to `w-[1100px]` to comfortably fit all tabs without overflowing.
- **Security & Authentication:**
  - Implemented `authMiddleware` in the Go backend that checks for the `X-API-Key` header (defaulting to `traffy-batch-org-import`).
  - Added `X-API-Key` to the CORS `AllowedHeaders` in the backend to prevent preflight rejection.
  - Added a Login Screen in `App.jsx` that blocks access to the tool until the user enters the correct passcode.
  - Passed the passcode via the `X-API-Key` header in all backend API requests (`fetch`).
- **Dynamic Versioning:**
  - Added visible version numbers for both the UI and API in the main header of `App.jsx` (`UI: v1.2.0 | API: v1.1.2`).

## Current State
- The frontend is fully operational and has been committed and pushed to `main` (repository: `org-chart-creation`).
- The backend has been deployed to Cloud Run (`fondue-org-importer-api`) and is serving traffic on `asia-southeast1.run.app`.
- All automated unit tests are passing.
- React hook warnings regarding missing dependencies have been monitored and evaluated (e.g., `apiKey` in `useEffect`). They are acceptable for current functional behavior.

## Pending Tasks / Next Steps
- **Non-spatial Organizations:** Currently lacking a dedicated workflow for organizations that span nationwide (e.g., Ministries) rather than being tied to specific tambons/districts.
- **Staging Database Workflow:** Future phase involves dropping the direct insertion into production tables and instead using a staging table for Admin review.
- **Performance Profiling for Extreme Load:** Monitor backend RAM usage when `App.jsx` imports 35,000 nodes simultaneously to ensure the Cloud Run container doesn't OOM.
- **Mini-map Implementation:** Implementing the much-needed canvas mini-map for navigating massive trees.

## Known Issues / Open Questions
- **Duplicate Naming Conflicts:** The backend's `CheckExactDuplicate` only checks names on a global scope. If two children have the exact same generic name but different parents, they may trigger a false positive race-condition avoidance. Will need to eventually scope duplicate checks by `parent_id`.
- **CORS Configuration:** Explicitly allowed `localhost` and `github.io` in the Cloud Run environment. Ensure any new deployment domains are added to `CORS_ALLOWED_ORIGINS`.

## Important Commands
- **Frontend:**
  - Start local dev server: `npm run dev`
  - Run tests: `npm run test`
  - Lint: `npm run lint`
- **Backend:**
  - Start local API: `go run cmd/api/main.go`
  - Deploy to Cloud Run: `gcloud run deploy fondue-org-importer-api --source . --region asia-southeast1 --project traffy-cloud --update-env-vars="^@^CORS_ALLOWED_ORIGINS=https://traffy-nectec.github.io,http://localhost:5173" --quiet`
