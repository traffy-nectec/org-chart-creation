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
- **Staging Database Workflow (Implemented & Tested):** 
  - Changed export logic to send data to a pending state (import_jobs).
  - Implemented Soft Identity check forcing users to input an Email for tracking `job_id`s.
  - Added a "My Submissions" tab to fetch status (`GET /api/import/jobs?email=xxx`).
  - Added an Admin Dashboard (protected by `X-Admin-Key`) to approve or reject batches with comments.
  - Updated `App.jsx` to load rejected payload for user editing.
- **Auditing & Requester Details (Jul 16):**
  - Swapped the simple EmailPromptModal with `RequesterDetailsModal` to collect email, name, phone, and remarks/note prior to submission.
  - Automatically persist and retrieve the user's details using `localStorage`.
- **Pre-check Validation Metrics (Jul 16):**
  - Updated client-side payload exporter to calculate node levels, build `level_distribution` map, and count pre-check validation warnings and errors, appending these to the metadata payload.
- **Table and Tree Visualization (Jul 16):**
  - Added a "ดูข้อมูล / ผังสายงาน" button on the Admin Dashboard that opens a modal containing:
    - Tab 1: **ตารางข้อมูลหน่วยงาน (Table View)**: An HTML table with search filters and pagination listing Name, Action, Level, Parent, and Coverage area.
    - Tab 2: **ผังโครงสร้างสายงาน (Tree View)**: An interactive recursive tree representing the hierarchical structure.
- **Silent Dashboard Auto-Refresh (Jul 16):**
  - Implemented background polling every 15 seconds on the Admin Dashboard to keep job statuses live without blocking spinners.
- **API-Driven Parallel QR Generation (Jul 16):**
  - Decoupled database connection pools from the worker, allowing sidecar-free scale-to-zero exits.
  - Created endpoints in the backend to partition jobs via modulo on `g.id` (`GET /api/import/qrs/pending` with `FOR UPDATE SKIP LOCKED`) and batch-commit completed IDs.
  - Parallelized the 3 image generation and upload pipelines inside the worker, reducing processing time from 210ms to 80ms per organization.
- **Withdraw & Edit & Explicit UUID Rule (Jul 22):**
  - Added withdraw capability for creators to recall pending import jobs and reload payload directly back into the chart editor.
  - Integrated `official_group` badges into the duplicate organization conflict warning modal.
  - Aligned backend QR API v2 with explicit UUID rules (omitting `uuid_qr` = Create Mode with retry collision check, passing `uuid_qr` = Update Mode) and 95% quality JPEG image outputs for seamless UI rendering.
- **Scope & Nationwide Floating Org Fixes (Aug 13):**
  - Passed `coverage_scope` to intermediate parent nodes during topological processing in `src/App.jsx`.
  - Suppressed missing area pre-export warnings for nodes with `NATIONWIDE` coverage.
- **Admin Dashboard API Performance & Memory Optimization (Aug 13):**
  - Updated `src/StagingViews.jsx` polling from 15s interval to 60s conditional check (polls only when pending/processing jobs exist).
  - Cleaned up heavy JSON payloads (`100MB+`) in-memory on frontend right after fetch.
  - Updated backend Go API `ListAllJobs`, `ListJobsByEmail`, `ListJobsByStatus` queries in `fondue-org-importer` to exclude the heavy `payload` column from list views (`NULL::jsonb`), reducing payload size from **100MB+ to 7.2KB** (<50ms response).
- **Go UTF-8 Rune Truncation Fix (Aug 13):**
  - Fixed a critical UTF-8 slicing bug in `importer/processor.go` where Go byte slicing (`string[:97]`) cut Thai characters in half (resulting in invalid `0xe0 0xb8 0x2e` byte sequence).
  - Replaced all byte slicing with rune-safe `truncateRune(string, 97)` function.
- **Build & Cloud Run Deployment (Aug 13):**
  - Optimized `.gcloudignore` to exclude local binaries (`/api`, `/api_bin`), reducing Cloud Build upload context from **128.8MB to 2.2MB**.
  - Built and deployed updated Go API service `fondue-org-importer-api` (`revision 00065-kzv`) on Google Cloud Run.
- **Coordinates, Radius & Org Type Pipeline (Aug 14):**
  - Updated CSV/Excel parser in `src/App.jsx` to parse `Latitude`, `Longitude`, `รัศมีรับผิดชอบ_เมตร`, and `ประเภท_type_fondue_group_id`.
  - Exported parsed spatial/type attributes inside `node.details` in `src/utils/exportUtils.js`.
  - Added Organization Type badge (`🏫 โรงเรียน (5)` / `🏢 หน่วยงานรัฐ (6)`) and coordinates/radius display in `src/StagingViews.jsx` Table View.

## Current State
- The frontend (`org-chart-creation`) is fully operational and pushed to `main`.
- The backend (`fondue-org-importer`) is updated, compiled, and deployed to Cloud Run (`fondue-org-importer-api`) serving 100% of traffic on `asia-southeast1.run.app`.
- All unit tests and compilation checks pass cleanly.
- React hook warnings regarding missing dependencies have been monitored and evaluated (e.g., `apiKey` in `useEffect`). They are acceptable for current functional behavior.

## Pending Tasks / Next Steps
- **Non-spatial Organizations:** Currently lacking a dedicated workflow for organizations that span nationwide (e.g., Ministries) rather than being tied to specific tambons/districts.
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
