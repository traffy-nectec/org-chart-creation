import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.join(__dirname, 'node_modules', 'react-thailand-address-typeahead', 'dist', 'index.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  
  const targetStr = '"ThailandAddressValue": () => (/* reexport safe */ _context__WEBPACK_IMPORTED_MODULE_2__.ThailandAddressValue)';
  const replacementStr = '"ThailandAddressValue": () => (/* reexport safe */ _context__WEBPACK_IMPORTED_MODULE_2__.ThailandAddressValue),\n/* harmony export */   "useAddressTypeaheadContext": () => (/* reexport safe */ _context__WEBPACK_IMPORTED_MODULE_2__.useAddressTypeaheadContext)';

  const checkStr = '"useAddressTypeaheadContext": () => (/* reexport safe */ _context__WEBPACK_IMPORTED_MODULE_2__.useAddressTypeaheadContext)';

  if (content.includes(targetStr) && !content.includes(checkStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched react-thailand-address-typeahead to export useAddressTypeaheadContext!');
  } else if (content.includes(checkStr)) {
    console.log('react-thailand-address-typeahead is already patched.');
  } else {
    console.warn('Could not find the target string in index.js to patch.');
  }
} else {
  console.warn('react-thailand-address-typeahead dist/index.js not found.');
}
