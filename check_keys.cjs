const xlsx = require('xlsx');
const wb = xlsx.readFile('examples/MOE.xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const maxKeysRow = data.reduce((max, row) => Object.keys(row).length > Object.keys(max).length ? row : max, data[0]);
console.log(Object.keys(maxKeysRow));
