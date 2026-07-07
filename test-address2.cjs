const fs = require('fs');
const content = fs.readFileSync('node_modules/react-thailand-address-typeahead/dist/index.js', 'utf8');
const match = content.match(/อำเภอเมือง[^"]*/g);
if (match) {
  console.log(match.slice(0, 10));
} else {
  console.log("No match");
}
