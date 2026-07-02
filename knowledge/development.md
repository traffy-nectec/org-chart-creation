---
type: documentation
title: "Development & Customization"
description: "Instructions for running the project and customizing data sanitization."
tags: ["Development", "Setup", "Customization"]
timestamp: "2026-07-02"
---

# Development & Customization

## Tech Stack
- **Framework:** React 19 with Vite
- **Graph/Chart Visualization:** `@xyflow/react` (React Flow), `dagre`
- **Styling:** Tailwind CSS, `lucide-react` for icons
- **Data Handling:** `xlsx` for Excel import/export
- **Forms/Inputs:** `react-thailand-address-typeahead`

## Setup Instructions
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
*(Note: A `postinstall` script runs `patch-address-lib.js` automatically).*

## Customizing Data Sanitization (App.jsx)

### 1. Adding Aliases
To add new abbreviations, modify the `ALIAS_DICTIONARY` in `App.jsx`:
```javascript
const ALIAS_DICTIONARY = {
  'อบต.': 'องค์การบริหารส่วนตำบล',
  // Add new aliases here
};
```

### 2. Custom Rules (Sanitization)
To remove words or fix characters, modify the `sanitizeString` function in `App.jsx`:
```javascript
// Remove specific word
cleaned = cleaned.replace(/คำที่ต้องการลบ/g, '');

// Fix specific characters
cleaned = cleaned.replace(/เเ/g, 'แ');
```

[Return to Index](index.md)
