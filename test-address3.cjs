const fs = require('fs');
const content = fs.readFileSync('node_modules/react-thailand-address-typeahead/dist/index.js', 'utf8');
const match = content.match(/เมือง[^"]*/g);
if (match) {
  console.log(match.slice(0, 5));
} else {
  console.log("No match");
}
