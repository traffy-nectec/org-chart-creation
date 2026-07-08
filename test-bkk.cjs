const fs = require('fs');
const db = JSON.parse(fs.readFileSync('src/assets/raw_database.json', 'utf8'));

const testStr1 = "กรุงเทพมหานคร เขตบึงกุ่ม นวลจันทร์";
const testStr2 = "กรุงเทพมหานคร เขตดอนเมือง ดอนเมือง";

const m1 = db.find(r => r.district && r.amphoe && r.province && testStr1.includes(r.district) && testStr1.includes(r.amphoe) && testStr1.includes(r.province));
console.log("Match 1:", m1);

const m2 = db.find(r => r.district && r.amphoe && r.province && testStr2.includes(r.district) && testStr2.includes(r.amphoe) && testStr2.includes(r.province));
console.log("Match 2:", m2);

