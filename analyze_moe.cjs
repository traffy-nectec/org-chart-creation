const xlsx = require('xlsx');

function analyze(file) {
  console.log('--- Analyzing ' + file + ' ---');
  const wb = xlsx.readFile(file);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const headers = json[0];
  const rawRows = xlsx.utils.sheet_to_json(sheet);
  
  let normalized = [];
  
  rawRows.forEach(row => {
    const levels = [
      row['กระทรวง'],
      row['ชื่อหน่วยงานระดับกรม'],
      row['ชื่อหน่วยงานระดับกอง'] || row['ชื่อหน่วยงานภายใต้กระทรวง'],
      row['ชื่อหน่วยงานระดับกลุ่ม'] || row['ชื่อหน่วยงานย่อย'],
      row['ชื่อหน่วยงานย่อย_1'],
      row['ชื่อหน่วยงานย่อย_2']
    ];
    
    let parent = null;
    let currentPath = [];
    
    levels.forEach(node => {
      if (node) {
        const nodeStr = String(node).trim();
        currentPath.unshift(nodeStr);
        const nodeFullName = currentPath.join(' ');
        
        normalized.push({
          org_name: nodeFullName,
          parent_name: parent
        });
        parent = nodeFullName;
      }
    });
  });

  // Deduplicate
  const orgMap = new Map();
  normalized.forEach(entry => {
    if (!orgMap.has(entry.org_name)) {
        orgMap.set(entry.org_name, entry.parent_name);
    }
  });

  const parentMap = new Map();
  const allParentNames = new Set();
  
  orgMap.forEach((parentName, name) => {
    parentMap.set(name, parentName || null);
    if (parentName) allParentNames.add(parentName);
  });
  
  allParentNames.forEach(p => {
    if (!orgMap.has(p)) {
      parentMap.set(p, null); // Orphan created
      orgMap.set(p, null);
    }
  });

  let roots = [];
  let childrenMap = new Map();
  
  parentMap.forEach((parentName, name) => {
    // Basic single root constraint fallback logic check
    if (!parentName) {
      roots.push(name);
    } else {
      if (!childrenMap.has(parentName)) childrenMap.set(parentName, []);
      childrenMap.get(parentName).push(name);
    }
  });

  console.log("Total unique nodes:", parentMap.size);
  console.log("Number of initial roots (without parent):", roots.length);
  
  if (roots.length > 1) {
     console.log("Applying single root constraint to first root:", roots[0]);
     const mainRoot = roots[0];
     for (let i = 1; i < roots.length; i++) {
        const extraRoot = roots[i];
        parentMap.set(extraRoot, mainRoot);
        if (!childrenMap.has(mainRoot)) childrenMap.set(mainRoot, []);
        childrenMap.get(mainRoot).push(extraRoot);
     }
     roots = [roots[0]];
  }
  
  console.log("Final root:", roots[0]);
  console.log("Root direct children (Level 2 nodes):", childrenMap.get(roots[0])?.length || 0);
  
  // Calculate Levels
  const levelCounts = {};
  const getLevel = (nodeName) => {
    let depth = 1;
    let current = parentMap.get(nodeName);
    const visited = new Set();
    while (current && !visited.has(current)) {
      visited.add(current);
      depth++;
      current = parentMap.get(current);
    }
    return depth;
  };
  
  parentMap.forEach((parent, node) => {
    const lvl = getLevel(node);
    levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
  });
  
  console.log("Nodes per level:");
  Object.keys(levelCounts).sort().forEach(k => {
     console.log(`Level ${k}: ${levelCounts[k]}`);
  });
}

analyze('examples/MOE.xlsx');
