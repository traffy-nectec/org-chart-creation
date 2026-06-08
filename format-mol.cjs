const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/plagad/work/nstda/mu/batch-org-create/MOL-single.xlsx');
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(firstSheet);

const normalized = [];
const locationMap = new Map();

rawRows.forEach(row => {
  const levels = [
    row['กระทรวง'],
    row['ชื่อหน่วยงานระดับกรม'],
    row['ชื่อหน่วยงานระดับกอง'],
    row['ชื่อหน่วยงานระดับกลุ่ม']
  ];
  
  const province = row['จังหวัด'] || '';
  const amphoe = row['อำเภอ'] || '';
  const tambon = row['ตำบล'] || '';
  const location = { province, amphoe, tambon };

  let parentName = null;
  let currentPath = [];
  let deepestNode = null;

  levels.forEach(node => {
    if (node) {
      const nodeStr = String(node).trim();
      currentPath.unshift(nodeStr); // Prepends to build "กลุ่ม กอง กรม กระทรวง"
      
      const nodeFullName = currentPath.join(' ');
      
      normalized.push({
        org_name: nodeFullName,
        parent_name: parentName
      });
      
      parentName = nodeFullName;
      deepestNode = nodeFullName;
    }
  });

  if (deepestNode && (province || amphoe || tambon)) {
    if (!locationMap.has(deepestNode)) {
      locationMap.set(deepestNode, []);
    }
    locationMap.get(deepestNode).push(location);
  }
});

// Re-flatten
const finalRows = [];
const seen = new Set();
normalized.forEach(entry => {
  const locs = locationMap.get(entry.org_name) || [];
  if (locs.length > 0) {
    locs.forEach(loc => {
      const key = `${entry.org_name}|${entry.parent_name}|${loc.province}|${loc.amphoe}|${loc.tambon}`;
      if (!seen.has(key)) {
        seen.add(key);
        finalRows.push({ ...entry, ...loc, postal_code: '' });
      }
    });
    locationMap.set(entry.org_name, []);
  } else {
    const key = `${entry.org_name}|${entry.parent_name}|||`;
    if (!seen.has(key)) {
      seen.add(key);
      finalRows.push({ ...entry, province: '', amphoe: '', tambon: '', postal_code: '' });
    }
  }
});

console.log('Unique generated orgs:', seen.size);

const outSheet = XLSX.utils.json_to_sheet(finalRows);
const outWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWorkbook, outSheet, 'Template');
XLSX.writeFile(outWorkbook, '/Users/plagad/work/nstda/mu/batch-org-create/MOL-template-formatted.xlsx');
console.log('Successfully created MOL-template-formatted.xlsx');
