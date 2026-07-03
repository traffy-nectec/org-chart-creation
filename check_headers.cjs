const xlsx = require('xlsx');
const wb = xlsx.readFile('examples/MOE.xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
console.log(data.slice(0, 3));
