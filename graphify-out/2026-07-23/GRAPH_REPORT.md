# Graph Report - org-chart-creation  (2026-07-23)

## Corpus Check
- 41 files · ~302,033 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 269 nodes · 289 edges · 32 communities (29 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d411af17`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- devDependencies
- dependencies
- analyze_moe_typos.cjs
- scripts
- ReactFlowOrgChart.jsx
- format-mol.cjs
- StagingViews.jsx
- test_perf.cjs
- check_keys.cjs
- test-bkk.cjs
- check_headers.cjs
- patch-address-lib.js
- test-address2.cjs
- test-address3.cjs
- test-fallback.cjs
- analyze_moe.cjs
- find_suggestions.cjs
- test-address.cjs
- Organization Chart Creation Tool (Batch Org Create)
- Features & Capabilities
- คู่มือการทดสอบระบบแบบ End-to-End (E2E Testing Guide)
- Handoff: Organization Chart Builder & Importer
- CLAUDE.md
- CLAUDE.md
- Prompt สำหรับสร้าง Backend `fondue-org-importer` จากศูนย์

## God Nodes (most connected - your core abstractions)
1. `OrgManagerApp()` - 11 edges
2. `Organization Chart Creation Tool (Batch Org Create)` - 11 edges
3. `ImportModal()` - 9 edges
4. `scripts` - 8 edges
5. `คู่มือการทดสอบระบบแบบ End-to-End (E2E Testing Guide)` - 8 edges
6. `Handoff: Organization Chart Builder & Importer` - 7 edges
7. `react` - 6 edges
8. `ConfigPanel()` - 6 edges
9. `Features & Capabilities` - 6 edges
10. `getLocationCode()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `CustomAddressInput()` --references--> `react`  [EXTRACTED]
  src/App.jsx → package.json
- `FlowInner()` --references--> `react`  [EXTRACTED]
  src/ReactFlowOrgChart.jsx → package.json
- `ConfigPanel()` --references--> `react`  [EXTRACTED]
  src/App.jsx → package.json
- `ImportModal()` --references--> `react`  [EXTRACTED]
  src/App.jsx → package.json
- `ImportModal()` --calls--> `extractGoogleSheetIds()`  [EXTRACTED]
  src/App.jsx → src/utils/googleSheetUtils.js

## Import Cycles
- None detected.

## Communities (32 total, 3 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.12
Nodes (27): react, react, ABBREV_TO_FULL_DICT, BulkEditLocationModal(), cleanInput(), ConfigPanel(), CustomAddressInput(), detectCycle() (+19 more)

### Community 1 - "devDependencies"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, husky, devDependencies, eslint (+21 more)

### Community 2 - "dependencies"
Cohesion: 0.11
Nodes (19): dagre, html-to-image, idb-keyval, lucide-react, dependencies, dagre, html-to-image, idb-keyval (+11 more)

### Community 3 - "analyze_moe_typos.cjs"
Cohesion: 0.15
Nodes (11): data, dbPath, errors, fs, locationDb, locIndex, moePath, path (+3 more)

### Community 4 - "scripts"
Cohesion: 0.15
Nodes (12): name, private, scripts, build, dev, lint, postinstall, prepare (+4 more)

### Community 5 - "ReactFlowOrgChart.jsx"
Cohesion: 0.32
Nodes (6): FlowInner(), getAreaCount(), getGridLayoutedElements(), nodeTypes, OrgNodeFlow(), ReactFlowOrgChart()

### Community 6 - "format-mol.cjs"
Cohesion: 0.20
Nodes (9): finalRows, locationMap, normalized, outSheet, outWorkbook, rawRows, seen, workbook (+1 more)

### Community 7 - "StagingViews.jsx"
Cohesion: 0.33
Nodes (5): AdminView(), downloadResultsFile(), getStatusBadge(), RequesterDetailsModal(), SubmissionsView()

### Community 8 - "test_perf.cjs"
Cohesion: 0.29
Nodes (5): childrenMap, idMap, nodeMap, nodes, visited

### Community 9 - "check_keys.cjs"
Cohesion: 0.40
Nodes (4): data, maxKeysRow, wb, xlsx

### Community 10 - "test-bkk.cjs"
Cohesion: 0.40
Nodes (4): db, fs, m1, m2

### Community 11 - "check_headers.cjs"
Cohesion: 0.50
Nodes (3): data, wb, xlsx

### Community 12 - "patch-address-lib.js"
Cohesion: 0.50
Nodes (3): __dirname, __filename, targetFile

### Community 13 - "test-address2.cjs"
Cohesion: 0.50
Nodes (3): content, fs, match

### Community 14 - "test-address3.cjs"
Cohesion: 0.50
Nodes (3): content, fs, match

### Community 15 - "test-fallback.cjs"
Cohesion: 0.50
Nodes (3): db, fs, fuzzyMatch

### Community 25 - "Organization Chart Creation Tool (Batch Org Create)"
Cohesion: 0.07
Nodes (26): 1.1 การสร้างโครงสร้างข้อมูล (Export Utils) - 5 Cases, 1.2 การดึงข้อมูลข้ามระบบ (Google Sheet Utils) - 8 Cases, 1. Flow Chart (ภาพรวมการทำงานของระบบ), 1. Unit Tests (การทดสอบหน่วยย่อย), 1. การเพิ่มคำย่อหรือคำทดแทน (Aliases), 2. End-to-End (E2E) Tests (การทดสอบระบบจำลอง), 2. Master Sequence Diagram (E2E Workflow), 🎨 2. การปรับปรุง UX/UI (Frontend UX/UI Enhancements) (+18 more)

### Community 26 - "Features & Capabilities"
Cohesion: 0.09
Nodes (18): 1. Adding Aliases, 2. Custom Rules (Sanitization), Customizing Data Sanitization (App.jsx), Development & Customization, Setup Instructions, Tech Stack, 1. Interactive Node Editor, 2. Visual & Layout Modes (+10 more)

### Community 27 - "คู่มือการทดสอบระบบแบบ End-to-End (E2E Testing Guide)"
Cohesion: 0.22
Nodes (8): 🛠 0. สิ่งที่ต้องเตรียมก่อนเริ่มทดสอบ (Prerequisites), คู่มือการทดสอบระบบแบบ End-to-End (E2E Testing Guide), 🚀 เฟส 1: การนำเข้าข้อมูลเบื้องต้น (Data Ingestion), 🔍 เฟส 2: การตรวจสอบความซ้ำซ้อน (Similarity Check), 📤 เฟส 3: ส่งข้อมูลเข้าตระกร้าพัก (Submit to Staging), 🛡 เฟส 4: กระบวนการตรวจสอบโดยแอดมิน (Admin Approval), ✅ เฟส 5: ตรวจสอบสถานะการทำงาน (Execution Check), 📸 เฟส 6: (ส่วนเสริม) การตรวจสอบผลลัพธ์ QR Code (Backend)

### Community 28 - "Handoff: Organization Chart Builder & Importer"
Cohesion: 0.25
Nodes (7): Completed Tasks, Context/Background, Current State, Handoff: Organization Chart Builder & Importer, Important Commands, Known Issues / Open Questions, Pending Tasks / Next Steps

### Community 29 - "CLAUDE.md"
Cohesion: 0.33
Nodes (5): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, CLAUDE.md

### Community 30 - "CLAUDE.md"
Cohesion: 0.33
Nodes (4): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution

### Community 31 - "Prompt สำหรับสร้าง Backend `fondue-org-importer` จากศูนย์"
Cohesion: 0.50
Nodes (3): Prompt สำหรับสร้าง Backend `fondue-org-importer` จากศูนย์, 🚀 สิ่งที่คุณ (AI) ต้องทำ:, 📋 สเปคการทำงานของระบบ (Requirements):

## Knowledge Gaps
- **145 isolated node(s):** `xlsx`, `xlsx`, `fs`, `path`, `dbPath` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `App.jsx`, `scripts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `react` connect `App.jsx` to `dependencies`, `ReactFlowOrgChart.jsx`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `xlsx`, `xlsx`, `fs` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._