---
type: documentation
title: "Features & Capabilities"
description: "Key features of the Organization Chart Builder tool."
tags: ["Features", "UI", "React Flow"]
timestamp: "2026-07-02"
---

# Features & Capabilities

## 1. Interactive Node Editor
- Create, edit, delete, and move nodes (Drag-and-Drop, Move Node).
- Set names, levels, and assign responsibility areas via a typeahead system.

## 2. Visual & Layout Modes
- **Canvas View:** Tree structure visualization (horizontal/vertical) with pan & zoom capabilities (Mouse Drag & Scroll).
- **Table View:** Deep-dive tabular view supporting expand/collapse functionality.

## 3. Pre-processing & Validation (Client-Side)
- Alerts for conflicting data (e.g., node without a name, unassigned department).
- Broad actions like moving or deleting entire branches.
- **Status Highlight:** Displays yellow/red borders for nodes with warnings or errors.

## 4. Import/Export Pipeline
- Export and import data in `.json` and `.xlsx` formats for portability.

## Recent UI/UX Improvements
- **Undo System:** Revert accidental changes.
- **Parent Change Confirmation:** 3-step modal for safe reassignments.
- **Root Node Support:** Allow root nodes to be assigned a new parent.
- **Right Sidebar Re-design:** Redesigned configuration panel using Traffy Fondue colors.
- **Node Design Update:** Replaced icons with clear buttons (Settings, View Sub-orgs, Add Org).
- **Chart Layout Optimization:** Sub-organizations wrap at 5 per row for better symmetry.

[Return to Index](index.md)
