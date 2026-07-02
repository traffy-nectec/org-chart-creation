---
type: architecture
title: "Two-Tier Validation Workflow & Architecture"
description: "System architecture and data validation workflow for the Org Chart Builder."
tags: ["Architecture", "Validation", "Workflow"]
timestamp: "2026-07-02"
---

# Two-Tier Validation Workflow

To handle data scale and quality efficiently, the system uses a **Two-Tier Validation Workflow**:

## Phase 1: Client & Staging
1. **Pre-processing (String Sanitization):** Automatically removes extra spaces, special characters, and repeated vowels (e.g., `เเ` -> `แ`) on the backend/client side.
2. **Dictionary Normalization:** Converts abbreviations to standard full names (e.g., "อบต." -> "องค์การบริหารส่วนตำบล").
3. **Location ID Mapping:** Maps sub-district/district/province names to 6-digit Ministry of Interior location codes to prevent garbage data.
4. **Similarity Check:** The backend compares the submitted names with the Production DB. If similarities are found, the user is warned and asked to confirm. Clean/confirmed data is saved to a **Staging Table**.

## Phase 2: Admin Review
- Admins review the pending data in the Staging Table.
- Once approved, data is migrated to the Production DB.

For flowcharts and sequence diagrams, refer to the original `README.md`.

[Return to Index](index.md)
