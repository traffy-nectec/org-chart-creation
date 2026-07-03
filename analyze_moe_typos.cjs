const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 1. Load Location DB
const dbPath = path.join(__dirname, 'public', 'raw_database.json');
const locationDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const locIndex = {
  province: new Set(),
  amphoe: new Set(),
  tambon: new Set()
};

locationDb.forEach(r => {
  if (r.province) locIndex.province.add(r.province.trim());
  if (r.province && r.amphoe) locIndex.amphoe.add(`${r.province.trim()}|${r.amphoe.trim()}`);
  if (r.province && r.amphoe && r.district) locIndex.tambon.add(`${r.province.trim()}|${r.amphoe.trim()}|${r.district.trim()}`);
});

// 2. Load MOE.xlsx
const moePath = path.join(__dirname, 'examples', 'MOE.xlsx');
const workbook = xlsx.readFile(moePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

const cleanInput = (val, type) => {
  if (val === undefined || val === null || val === 'undefined' || val === 'null') return '';
  let cleaned = String(val).trim();
  if (type === 'province') {
    if (cleaned.startsWith('จ.')) cleaned = cleaned.substring(2).trim();
    if (cleaned.startsWith('จังหวัด')) cleaned = cleaned.substring(7).trim();
    if (cleaned === 'กทม' || cleaned === 'กทม.') cleaned = 'กรุงเทพมหานคร';
    if (cleaned === 'กรุงเทพ') cleaned = 'กรุงเทพมหานคร';
  } else if (type === 'amphoe') {
    if (cleaned.startsWith('อ.')) cleaned = cleaned.substring(2).trim();
    if (cleaned.startsWith('อำเภอ')) cleaned = cleaned.substring(5).trim();
    if (cleaned.startsWith('เขต')) cleaned = cleaned.substring(3).trim();
  } else if (type === 'tambon') {
    if (cleaned.startsWith('ต.')) cleaned = cleaned.substring(2).trim();
    if (cleaned.startsWith('ตำบล')) cleaned = cleaned.substring(4).trim();
    if (cleaned.startsWith('แขวง')) cleaned = cleaned.substring(4).trim();
  }
  return cleaned;
};

const errors = new Map();

data.forEach((row, i) => {
  const p = cleanInput(row['จังหวัดที่รับผิดชอบ'] || row['จังหวัด'] || row.province, 'province');
  const a = cleanInput(row['อำเภอที่รับผิดชอบ'] || row['อำเภอ'] || row.amphoe || row['เขต'], 'amphoe');
  const t = cleanInput(row['ตำบลที่รับผิดชอบ'] || row['ตำบล'] || row.tambon || row['แขวง'], 'tambon');

  if (p && a && t) {
    const key = `${p}|${a}|${t}`;
    if (!locIndex.tambon.has(key)) {
      const display = `ต.${t} อ.${a} จ.${p}`;
      errors.set(display, (errors.get(display) || 0) + 1);
    }
  }
});

console.log("Unmatched Locations found in MOE.xlsx:");
const sortedErrors = [...errors.entries()].sort((a, b) => b[1] - a[1]);
sortedErrors.forEach(([loc, count]) => {
  console.log(`- ${loc} (พบ ${count} รายการ)`);
});
