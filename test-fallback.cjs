const fs = require('fs');
const db = JSON.parse(fs.readFileSync('src/assets/raw_database.json', 'utf8'));

const locStr = "กรุงเทพมหานคร เขตบางกอกน้อย อรุณอมรินทร์";

const fuzzyMatch = db.find(r => 
  r.district && r.amphoe && r.province && 
  locStr.includes(r.district) && 
  locStr.includes(r.amphoe) && 
  locStr.includes(r.province)
);

console.log(fuzzyMatch);
