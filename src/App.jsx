import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Trash2, MapPin, CheckCircle,
  Layers, Network, ChevronDown, ChevronRight, ChevronUp, ChevronLeft,
  ChevronsDown, Upload, FileSpreadsheet, X, Download, Table,
  AlertTriangle, Check, Database, Search, HelpCircle
} from 'lucide-react';
import { ThailandAddressTypeahead, useAddressTypeaheadContext } from "react-thailand-address-typeahead";
import * as XLSX from 'xlsx';
import { getOrgPath, generateBackendPayload, topologicalSort } from './utils/exportUtils';
import { extractGoogleSheetIds, fetchGoogleSheetAsCSV } from './utils/googleSheetUtils';
import toast, { Toaster } from 'react-hot-toast';
import ReactFlowOrgChart from './ReactFlowOrgChart';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

// ==========================================
// CONFIGURATION: Data Cleansing & Alias Dictionary
// ==========================================
// Dictionary for converting abbreviations to official terms.
// Easily extendable - just add key-value pairs here.
const FULL_TO_ABBREV_DICT = {
  'องค์การบริหารส่วนตำบล': 'อบต.',
  'องค์การบริหารส่วนจังหวัด': 'อบจ.',
  'สถานีตำรวจภูธร': 'สภ.',
  'สถานีตำรวจนครบาล': 'สน.',
};

// Dictionary for suggesting correct locations when users make common spelling mistakes in Excel
const LOCATION_TYPO_DICT = {
  // Existing
  'อรุณอัมรินทร์': { province: 'กรุงเทพมหานคร', district: 'บางกอกน้อย', subdistrict: 'อรุณอมรินทร์', postalCode: '10700' },
  'อรุณอมรินทร์': { province: 'กรุงเทพมหานคร', district: 'บางกอกน้อย', subdistrict: 'อรุณอมรินทร์', postalCode: '10700' },
  'ไผ่จำศิล': { province: 'อ่างทอง', district: 'วิเศษชัยชาญ', subdistrict: 'ไผ่จำศีล', postalCode: '14110' },
  'ห้วยขะยุง': { province: 'อุบลราชธานี', district: 'วารินชำราบ', subdistrict: 'ห้วยขะยูง', postalCode: '34310' },
  'ห้วยยะยูง': { province: 'อุบลราชธานี', district: 'วารินชำราบ', subdistrict: 'ห้วยขะยูง', postalCode: '34310' },
  'บ้านจันทร์': { province: 'อุดรธานี', district: 'บ้านดุง', subdistrict: 'บ้านจันทน์', postalCode: '41190' },
  // New from MOE.xlsx analysis
  'โพธิไพศาล': { province: 'สกลนคร', district: 'กุสุมาลย์', subdistrict: 'โพธิ์ไพศาล', postalCode: '47210' },
  'อุใดเจริญ': { province: 'สตูล', district: 'ควนกาหลง', subdistrict: 'อุไดเจริญ', postalCode: '91130' },
  'บ่อสวก': { province: 'น่าน', district: 'เมืองน่าน', subdistrict: 'สวก', postalCode: '55000' },
  'ปอพาน': { province: 'ร้อยเอ็ด', district: 'เมืองร้อยเอ็ด', subdistrict: 'ปอภาร', postalCode: '45000' },
  'ปอภาร (ปอพาน)': { province: 'ร้อยเอ็ด', district: 'เมืองร้อยเอ็ด', subdistrict: 'ปอภาร', postalCode: '45000' },
  'ทุ่งปี๊': { province: 'เชียงใหม่', district: 'แม่วาง', subdistrict: 'ทุ่งปี้', postalCode: '50360' },
  'วังหงส์': { province: 'แพร่', district: 'เมืองแพร่', subdistrict: 'วังหงษ์', postalCode: '54000' },
  'บางบอนใต้': { province: 'กรุงเทพมหานคร', district: 'บางบอน', subdistrict: 'บางบอน', postalCode: '10150' },
  'บางบอนเหนือ': { province: 'กรุงเทพมหานคร', district: 'บางบอน', subdistrict: 'บางบอน', postalCode: '10150' },
};

const ABBREV_TO_FULL_DICT = {
  'อ.': 'อำเภอ',
  'ทน.': 'เทศบาลนคร',
  'ทม.': 'เทศบาลเมือง',
  'ทต.': 'เทศบาลตำบล',
  'รพ.สต.': 'โรงพยาบาลส่งเสริมสุขภาพตำบล',
  'รร.': 'โรงเรียน',
  'สนง.': 'สำนักงาน',
  'กทม.': 'กรุงเทพมหานคร',
  'ผอ.': 'ผู้อำนวยการ',
  'บก.': 'กองบังคับการ',
  'จว.': 'จังหวัด',
  'ตม.': 'ตรวจคนเข้าเมือง',
};

/**
 * Sanitizes and normalizes a string.
 * - Removes extra spaces
 * - Resolves double vowels (เเ -> แ) and duplicate tone marks
 * - Strips unwanted special characters
 * - Converts specific full names to abbreviations (FULL_TO_ABBREV_DICT)
 * - Expands specific abbreviations to full names (ABBREV_TO_FULL_DICT)
 */
const sanitizeString = (str, options = { showToast: false }) => {
  if (!str) return '';
  let cleaned = String(str);

  // 1. Fix double 'เ' -> 'แ'
  cleaned = cleaned.replace(/เเ/g, 'แ');

  // Fix 'ํา' (Nikhahit + Sara Aa) -> 'ำ' (Sara Am)
  cleaned = cleaned.replace(/\u0E4D\u0E32/g, '\u0E33');

  // Remove 'บัญชีทางการ'
  cleaned = cleaned.replace(/บัญชีทางการ/g, '');

  // 2. Remove consecutive repeated Thai vowels / tone marks (typos)
  cleaned = cleaned.replace(/่+/g, '่');
  cleaned = cleaned.replace(/้+/g, '้');
  cleaned = cleaned.replace(/๊+/g, '๊');
  cleaned = cleaned.replace(/๋+/g, '๋');
  cleaned = cleaned.replace(/ิ+/g, 'ิ');
  cleaned = cleaned.replace(/ี+/g, 'ี');
  cleaned = cleaned.replace(/ึ+/g, 'ึ');
  cleaned = cleaned.replace(/ื+/g, 'ื');
  cleaned = cleaned.replace(/ุ+/g, 'ุ');
  cleaned = cleaned.replace(/ู+/g, 'ู');
  cleaned = cleaned.replace(/ั+/g, 'ั');
  cleaned = cleaned.replace(/์+/g, '์');

  // 3. Remove unwanted special characters, keep safe punctuation (- _ / \ ( ) [ ] . ,)
  cleaned = cleaned.replace(/[^\u0E00-\u0E7FA-Za-z0-9\s\-_/\\()[\].,]/g, '');

  // 4. Normalize spacing
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 5. Abbreviate full names
  const fullToAbbrevEntries = Object.entries(FULL_TO_ABBREV_DICT).sort((a, b) => b[0].length - a[0].length);
  for (const [fullWord, abbrev] of fullToAbbrevEntries) {
    if (cleaned.includes(fullWord)) {
      cleaned = cleaned.replaceAll(fullWord, abbrev);
      if (options.showToast) {
        toast.success(`เปลี่ยนคำว่า "${fullWord}" เป็น "${abbrev}"`, {
          duration: 3000,
        });
      }
    }
  }

  // 6. Expand abbreviations
  const abbrevToFullEntries = Object.entries(ABBREV_TO_FULL_DICT).sort((a, b) => b[0].length - a[0].length);
  for (const [abbrev, fullWord] of abbrevToFullEntries) {
    if (abbrev.endsWith('.')) {
      const escaped = abbrev.replace(/\./g, '\\.');
      const regex = new RegExp(escaped, 'g');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, fullWord);
        if (options.showToast) {
          toast.success(`เปลี่ยนคำย่อ "${abbrev}" เป็น "${fullWord}"`, {
            duration: 3000,
          });
        }
      }
    } else {
      const regex = new RegExp(abbrev, 'g');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, fullWord);
        if (options.showToast) {
          toast.success(`เปลี่ยนคำย่อ "${abbrev}" เป็น "${fullWord}"`, {
            duration: 3000,
          });
        }
      }
    }
  }

  // Final spaces normalization
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Handle common null-like strings from Excel
  const upperCleaned = cleaned.toUpperCase();
  if (upperCleaned === 'NULL' || upperCleaned === 'N/A' || upperCleaned === '-' || upperCleaned === 'ไม่มี' || upperCleaned === 'NONE') {
    return '';
  }

  return cleaned;
};

const cleanInput = (val, type) => {
  if (val === undefined || val === null || val === 'undefined' || val === 'null') return '';
  let cleaned = String(val).trim();
  if (cleaned.toLowerCase() === 'undefined' || cleaned.toLowerCase() === 'null') return '';
  if (type === 'province') {
    if (cleaned.startsWith('จ.')) cleaned = cleaned.substring(2).trim();
    if (cleaned.startsWith('จังหวัด')) cleaned = cleaned.substring(7).trim();
    if (cleaned === 'กทม' || cleaned === 'กทม.') cleaned = 'กรุงเทพมหานคร';
    if (cleaned === 'กรุงเทพ') cleaned = 'กรุงเทพมหานคร';
    if (cleaned === 'อยุธยา') cleaned = 'พระนครศรีอยุธยา';
    if (cleaned === 'โคราช') cleaned = 'นครราชสีมา';
  } else if (type === 'amphoe') {
    if (cleaned.startsWith('อ.')) cleaned = cleaned.substring(2).trim();
    if (cleaned.startsWith('อำเภอ')) cleaned = cleaned.substring(5).trim();
    if (cleaned.startsWith('เขต')) cleaned = cleaned.substring(3).trim();
    if (cleaned === 'สุไหงโกลก') cleaned = 'สุไหงโก-ลก';
  } else if (type === 'tambon') {
    if (cleaned.startsWith('ต.')) cleaned = cleaned.substring(2).trim();
    if (cleaned.startsWith('ตำบล')) cleaned = cleaned.substring(4).trim();
    if (cleaned.startsWith('แขวง')) cleaned = cleaned.substring(4).trim();
    if (cleaned === 'สุไหงโกลก') cleaned = 'สุไหงโก-ลก';
  }
  return cleaned;
};

const getLocationCode = (loc, db) => {
  if (!db || db.length === 0 || !loc || !loc.province) return '';
  const cleanProv = cleanInput(loc.province, 'province');
  const cleanAmp = cleanInput(loc.amphoe, 'amphoe');
  const cleanTam = cleanInput(loc.tambon, 'tambon');

  if (cleanTam) {
    const rec = db.find(r =>
      cleanInput(r.province, 'province') === cleanProv &&
      cleanInput(r.amphoe, 'amphoe') === cleanAmp &&
      cleanInput(r.district, 'tambon') === cleanTam
    );
    if (rec) {
      if (rec.district_code) return String(rec.district_code);
      if (rec.amphoe_code) return String(rec.amphoe_code);
      if (rec.province_code) return String(rec.province_code);
    }
  }
  if (cleanAmp) {
    const rec = db.find(r =>
      cleanInput(r.province, 'province') === cleanProv &&
      cleanInput(r.amphoe, 'amphoe') === cleanAmp
    );
    if (rec) {
      if (rec.amphoe_code) return String(rec.amphoe_code);
      if (rec.province_code) return String(rec.province_code);
    }
  }
  const rec = db.find(r => cleanInput(r.province, 'province') === cleanProv);
  if (rec && rec.province_code) return String(rec.province_code);
  return '';
};

const getVal = (row, keys) => {
  for (const k of keys) {
    const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const valStr = String(row[foundKey]).trim();
      if (valStr.toLowerCase() !== 'undefined' && valStr.toLowerCase() !== 'null') {
        return valStr;
      }
    }
  }
  return '';
};

const detectCycle = (startName, parentMap) => {
  const visited = new Set();
  let current = startName;
  const path = [];
  while (current) {
    if (visited.has(current)) {
      path.push(current);
      return { hasCycle: true, cyclePath: path };
    }
    visited.add(current);
    path.push(current);
    current = parentMap.get(current);
  }
  return { hasCycle: false };
};

const getLevel = (nodeName, parentMap) => {
  let depth = 1;
  let current = parentMap.get(nodeName);
  const visited = new Set([nodeName]);
  while (current && !visited.has(current)) {
    visited.add(current);
    current = parentMap.get(current);
    depth++;
  }
  return depth;
};

const DraftRestoreModal = ({ isOpen, draftCount, onResume, onStartFresh }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 text-center animate-in zoom-in-95">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Database size={32} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">พบข้อมูลฉบับร่าง (Draft)</h2>
        <p className="text-slate-600 mb-6">
          ระบบพบข้อมูลโครงสร้างองค์กรที่คุณทำค้างไว้ จำนวน <span className="font-bold text-blue-600">{draftCount}</span> หน่วยงาน
          <br />คุณต้องการทำต่อจากที่ค้างไว้ หรือลบข้อมูลทิ้งเพื่อเริ่มต้นใหม่ทั้งหมด?
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onStartFresh}
            className="px-6 py-2.5 rounded-xl text-red-600 font-bold border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
          >
            ลบทิ้ง เริ่มใหม่ทั้งหมด
          </button>
          <button
            onClick={onResume}
            className="px-6 py-2.5 rounded-xl text-white font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
          >
            ทำต่อจากข้อมูลเดิม
          </button>
        </div>
      </div>
    </div>
  );
};

const ImportModal = ({ isOpen, onClose, onImportData, onCancelImport, onDownloadTemplate, locationDb }) => {
  const fileInputRef = useRef(null);
  const [parsedFile, setParsedFile] = useState(null);
  const [validatedNodes, setValidatedNodes] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [sheetLink, setSheetLink] = useState('');

  const issueGroups = React.useMemo(() => {
    const groups = {
      circle: { id: 'circle', label: 'ความสัมพันธ์เป็นวงกลม', items: [], color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
      missingParent: { id: 'missingParent', label: 'ไม่พบต้นสังกัด', items: [], color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
      multipleRoots: { id: 'multipleRoots', label: 'ถูกปรับยอด (มีหัวหน้าสูงสุดได้ 1 แห่ง)', items: [], color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
      noArea: { id: 'noArea', label: 'ไม่มีพื้นที่รับผิดชอบ (หน่วยงานลอย)', items: [], color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
      invalidArea: { id: 'invalidArea', label: 'พื้นที่ไม่พบในระบบ', items: [], color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
      duplicate: { id: 'duplicate', label: 'ชื่อหน่วยงานซ้ำกัน', items: [], color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
      others: { id: 'others', label: 'แจ้งเตือนอื่นๆ', items: [], color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    };

    validatedNodes.forEach(node => {
      node.errors.forEach(err => {
        if (err.includes('วงกลม')) groups.circle.items.push({ name: node.name, msg: err });
        else groups.others.items.push({ name: node.name, msg: err });
      });
      node.warnings.forEach(warn => {
        if (warn.includes('ไม่พบต้นสังกัด')) groups.missingParent.items.push({ name: node.name, msg: warn });
        else if (warn.includes('ถูกปรับให้อยู่ภายใต้')) groups.multipleRoots.items.push({ name: node.name, msg: warn });
        else if (warn.includes('ชื่อหน่วยงานซ้ำกัน')) groups.duplicate.items.push({ name: node.name, msg: warn });
        else if (warn.includes('ไม่พบข้อมูลพื้นที่รับผิดชอบ')) groups.invalidArea.items.push({ name: node.name, msg: warn });
        else if (warn.includes('ไม่มีพื้นที่รับผิดชอบ')) groups.noArea.items.push({ name: node.name, msg: warn });
        else groups.others.items.push({ name: node.name, msg: warn });
      });
    });

    return Object.values(groups).filter(g => g.items.length > 0);
  }, [validatedNodes]);

  const [expandedGroupId, setExpandedGroupId] = useState(null);

  if (!isOpen) return null;

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleLinkImport = async () => {
    const ids = extractGoogleSheetIds(sheetLink);
    if (!ids) {
      alert("รูปแบบลิงก์ Google Sheets ไม่ถูกต้อง");
      return;
    }

    setIsProcessing(true);
    setProgressStep('กำลังเชื่อมต่อ Google Sheets...');

    try {
      const csvText = await fetchGoogleSheetAsCSV(ids.spreadsheetId, ids.gid);
      setProgressStep('กำลังแปลงโครงสร้างข้อมูล (Parsing)...');
      await delay(50);
      const workbook = XLSX.read(csvText, { type: 'string' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet);

      const sizeBytes = new Blob([csvText]).size;
      await processRawRows(rawRows, 'Google Sheets Link', sizeBytes);
    } catch (err) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheets: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const processFile = async (file) => {
    setIsProcessing(true);
    setProgressStep('กำลังอ่านไฟล์...');
    await delay(50);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setProgressStep('กำลังแปลงโครงสร้างข้อมูล (Parsing)...');
        await delay(50);
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        let rawRows = XLSX.utils.sheet_to_json(firstSheet);

        await processRawRows(rawRows, file.name, file.size);
      } catch (err) {
        console.error(err);
        alert(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`);
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processRawRows = async (rawRows, sourceName, sourceSize) => {
    try {
      if (rawRows.length > 0 && ('กระทรวง' in rawRows[0] || 'ชื่อหน่วยงานระดับกรม' in rawRows[0])) {
        const normalized = [];
        const locationMap = new Map();

        rawRows.forEach(row => {
          const levels = [
            row['กระทรวง'],
            row['ชื่อหน่วยงานระดับกรม'],
            row['ชื่อหน่วยงานระดับกอง'] || row['ชื่อหน่วยงานภายใต้กระทรวง'],
            row['ชื่อหน่วยงานระดับกลุ่ม'] || row['ชื่อหน่วยงานย่อย'],
            row['ชื่อหน่วยงานย่อย_1'],
            row['ชื่อหน่วยงานย่อย_2']
          ];

          const province = row['จังหวัด'] || row['จังหวัดที่รับผิดชอบ'];
          const amphoe = row['อำเภอ'] || row['อำเภอที่รับผิดชอบ'];
          const tambon = row['ตำบล'] || row['ตำบลที่รับผิดชอบ'];
          const location = { province, amphoe, tambon };

          let parent = null;
          let currentPath = [];
          let deepestNode = null;

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

        // Re-flatten normalized with locations
        const finalRows = [];
        normalized.forEach(entry => {
          const locs = locationMap.get(entry.org_name) || [];
          if (locs.length > 0) {
            locs.forEach(loc => {
              finalRows.push({ ...entry, ...loc });
            });
            // Clear to avoid duplicate locations
            locationMap.set(entry.org_name, []);
          } else {
            finalRows.push(entry);
          }
        });
        rawRows = finalRows;
      }

      if (rawRows.length === 0) {
        alert("ไม่พบข้อมูลในไฟล์");
        setIsProcessing(false);
        return;
      }

      setProgressStep('กำลังทำความสะอาดและตรวจสอบข้อมูล (Cleansing & Validating)...');
      await delay(50);

      const orgMap = new Map();

      // O(1) Lookup Indices for Locations
      const locIndex = { province: new Map(), amphoe: new Map(), tambon: new Map() };
      if (locationDb && locationDb.length > 0) {
        locationDb.forEach(r => {
          const p = cleanInput(r.province, 'province');
          const a = cleanInput(r.amphoe, 'amphoe');
          const t = cleanInput(r.district, 'tambon');
          if (p) {
            if (!locIndex.province.has(p)) locIndex.province.set(p, r.province_code ? String(r.province_code) : '');
          }
          if (p && a) {
            const keyAmp = `${p}|${a}`;
            if (!locIndex.amphoe.has(keyAmp)) locIndex.amphoe.set(keyAmp, r.amphoe_code ? String(r.amphoe_code) : (r.province_code ? String(r.province_code) : ''));
          }
          if (p && a && t) {
            const keyTam = `${p}|${a}|${t}`;
            if (!locIndex.tambon.has(keyTam)) locIndex.tambon.set(keyTam, r.district_code ? String(r.district_code) : (r.amphoe_code ? String(r.amphoe_code) : (r.province_code ? String(r.province_code) : '')));
          }
        });
      }

      rawRows.forEach((row, index) => {
        const rawOrgName = getVal(row, ['org_name', 'orgName', 'หน่วยงาน']);
        const orgName = sanitizeString(rawOrgName);
        if (!orgName) return;

        const rawParentName = getVal(row, ['parent_name', 'parentName', 'หน่วยงานต้นสังกัด', 'parent']);
        const parentName = sanitizeString(rawParentName) || null;
        const rawProvince = getVal(row, ['province', 'จังหวัด', 'changwat']);
        const rawAmphoe = getVal(row, ['amphoe', 'อำเภอ', 'เขต']);
        const rawTambon = getVal(row, ['tambon', 'ตำบล', 'แขวง']);
        const rawPostalCode = getVal(row, ['postal_code', 'postalcode', 'รหัสไปรษณีย์', 'postalCode']);
        const rawCoverageScope = getVal(row, ['coverage_scope', 'ขอบเขตพื้นที่', 'scope', 'ขอบเขตอำนาจ', 'ขอบเขตการรับผิดชอบ']);

        if (!orgMap.has(orgName)) {
          orgMap.set(orgName, {
            name: orgName,
            parentName: parentName || null,
            locations: [],
            scope: 'LOCAL',
            errors: [],
            warnings: [],
            rawRows: []
          });
        }

        const orgInfo = orgMap.get(orgName);

        // บันทึกข้อมูลแถวต้นฉบับจากไฟล์
        orgInfo.rawRows.push({
          rowNumber: index + 2,
          orgName,
          parentName: parentName || null
        });

        if (parentName && orgInfo.parentName && orgInfo.parentName !== parentName) {
          const conflictMsg = `⚠️ มีต้นสังกัดขัดแย้งกันในไฟล์ ("${orgInfo.parentName}" vs "${parentName}") จะใช้ต้นสังกัดแรกที่พบ`;
          if (!orgInfo.warnings.includes(conflictMsg)) {
            orgInfo.warnings.push(conflictMsg);
          }
        }

        const rawProvinceString = typeof rawProvince === 'string' ? rawProvince : String(rawProvince || '');
        const rawProvinceList = rawProvinceString.split(/[\s,]+/).filter(Boolean);
        if (rawProvinceList.length === 0) rawProvinceList.push('');

        rawProvinceList.forEach(rawProvItem => {
          let province = cleanInput(rawProvItem, 'province');
          let amphoe = cleanInput(rawAmphoe, 'amphoe');
          let tambon = cleanInput(rawTambon, 'tambon');
          const postalCode = rawPostalCode;

          // Handle "อ.เมือง" by appending the province name
          if (amphoe === 'เมือง' && province) {
            amphoe = `เมือง${province}`;
          }

          // If the area is nationwide or all, clear the location data so it becomes unassigned
          const isNationwide = [province, amphoe, tambon, rawProvItem, rawAmphoe, rawTambon, String(rawCoverageScope || '')].some(val =>
            val && (val.includes('ทั่วประเทศ') || val.includes('ส่วนกลาง') || val.includes('ระดับชาติ') || val.includes('ทั้งหมด'))
          );

          if (isNationwide) {
            orgInfo.scope = 'NATIONWIDE';
            province = '';
            amphoe = '';
            tambon = '';
          }

          if (province) {
            const exists = orgInfo.locations.some(loc =>
              loc.province === province &&
              loc.amphoe === amphoe &&
              loc.tambon === tambon
            );
            if (!exists) {
              let isValidLoc = false;
              let locCode = '';

              const cleanProv = cleanInput(province, 'province');
              const cleanAmp = cleanInput(amphoe, 'amphoe');
              const cleanTam = cleanInput(tambon, 'tambon');

              if (cleanTam) {
                const key = `${cleanProv}|${cleanAmp}|${cleanTam}`;
                if (locIndex.tambon.has(key)) {
                  isValidLoc = true;
                  locCode = locIndex.tambon.get(key);
                }
              } else if (cleanAmp) {
                const key = `${cleanProv}|${cleanAmp}`;
                if (locIndex.amphoe.has(key)) {
                  isValidLoc = true;
                  locCode = locIndex.amphoe.get(key);
                }
              } else if (cleanProv) {
                if (locIndex.province.has(cleanProv)) {
                  isValidLoc = true;
                  locCode = locIndex.province.get(cleanProv);
                }
              }

              const locObj = {
                province,
                amphoe,
                tambon,
                postalCode,
                code: locCode
              };

              if (!isValidLoc) {
                const locStr = [rawProvItem, rawAmphoe, rawTambon].filter(Boolean).join(' ');
                const warningMsg = `⚠️ ไม่พบข้อมูลพื้นที่รับผิดชอบในระบบ จะถูกข้ามไป ("${locStr}")`;
                if (!orgInfo.warnings.includes(warningMsg)) {
                  orgInfo.warnings.push(warningMsg);
                }
              } else {
                orgInfo.locations.push(locObj);
              }
            }
          }
        });
      });

      // 1. ค้นหา parentName ที่ถูกอ้างอิงแต่ไม่มีข้อมูลในไฟล์ เพื่อสร้างหน่วยงานใหม่ขึ้นมาให้เลือกใหม่ตามต้องการ
      const allParentNames = new Set();
      orgMap.forEach(org => {
        if (org.parentName) allParentNames.add(org.parentName);
      });

      allParentNames.forEach(p => {
        if (!orgMap.has(p)) {
          orgMap.set(p, {
            name: p,
            parentName: null,
            locations: [],
            errors: [],
            warnings: [`⚠️ หน่วยงานสร้างขึ้นใหม่เนื่องจากเป็นต้นสังกัดที่ไม่มีข้อมูลในไฟล์ (กรุณากำหนดสังกัดจริง)`]
          });
        }
      });

      const orgList = Array.from(orgMap.values());
      const parentMap = new Map();
      orgList.forEach(org => {
        parentMap.set(org.name, org.parentName);
      });

      // Validation Checks
      orgList.forEach(org => {
        // Orphan Check fallback
        if (org.parentName && !parentMap.has(org.parentName)) {
          org.warnings.push(`⚠️ ไม่พบต้นสังกัด "${org.parentName}" ในไฟล์ (ระบบจะตั้งเป็นหน่วยงานสูงสุด)`);
          parentMap.set(org.name, null);
        }

        // Cycle Check
        const cycleRes = detectCycle(org.name, parentMap);
        if (cycleRes.hasCycle) {
          org.errors.push(`❌ ตรวจพบความสัมพันธ์เป็นวงกลม: ${cycleRes.cyclePath.join(' -> ')} (ระบบจะตัดให้เป็นหน่วยงานสูงสุด)`);
          parentMap.set(org.name, null); // break cycle
        }

        // Missing Area Check
        if (org.scope !== 'NATIONWIDE' && (!org.locations || org.locations.length === 0)) {
          org.warnings.push(`⚠️ ไม่มีพื้นที่รับผิดชอบ (เป็นหน่วยงานลอย)`);
        }
      });

      // Enforce Single Root Constraint in preview
      const rootsInPreview = [];
      orgList.forEach(org => {
        if (!parentMap.get(org.name)) {
          rootsInPreview.push(org.name);
        }
      });

      if (rootsInPreview.length > 1) {
        const mainRoot = rootsInPreview[0];
        for (let i = 1; i < rootsInPreview.length; i++) {
          const extraRoot = rootsInPreview[i];
          parentMap.set(extraRoot, mainRoot);
          const extraOrg = orgList.find(o => o.name === extraRoot);
          if (extraOrg) {
            extraOrg.warnings.push(`⚠️ ถูกปรับให้อยู่ภายใต้ ${mainRoot} เนื่องจากระบบกำหนดให้มีหน่วยงานสูงสุดได้เพียง 1 แห่ง`);
          }
        }
      }

      setProgressStep('เตรียมพร้อมโครงสร้าง (Background Processing)...');
      await delay(50);

      const idMap = new Map();
      orgList.forEach(org => {
        idMap.set(org.name, `org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      });

      const rootsInPreview2 = orgList.filter(node => !parentMap.get(node.name) || !idMap.has(parentMap.get(node.name)));

      const finalOrgs = [];
      const chunkSize = 5000;

      for (let i = 0; i < orgList.length; i += chunkSize) {
        const chunk = orgList.slice(i, i + chunkSize);

        const chunkOrgs = chunk.map(org => {
          let parentId = parentMap.get(org.name) && idMap.has(parentMap.get(org.name)) ? idMap.get(parentMap.get(org.name)) : null;
          let warnings = [...(org.warnings || [])];
          let errors = [...(org.errors || [])];
          const calculatedLevel = getLevel(org.name, parentMap);

          // Enforce single root constraint
          if (rootsInPreview2.length > 1 && !parentMap.get(org.name) && org.name !== rootsInPreview2[0].name) {
            parentId = idMap.get(rootsInPreview2[0].name);
            const warningMsg = `⚠️ ถูกปรับให้อยู่ภายใต้ ${rootsInPreview2[0].name} เนื่องจากระบบกำหนดให้มีหน่วยงานสูงสุดได้เพียง 1 แห่ง`;
            if (!warnings.includes(warningMsg)) {
              warnings.push(warningMsg);
            }
          }

          return {
            id: idMap.get(org.name),
            name: org.name,
            level: calculatedLevel,
            parentId,
            logo: null,
            areas: {
              scope: org.scope || 'LOCAL',
              locations: org.locations || []
            },
            errors,
            warnings,
            rawRows: org.rawRows
          };
        });

        finalOrgs.push(...chunkOrgs);
        setProgressStep(`ประกอบโครงสร้าง... (${Math.min(i + chunkSize, orgList.length).toLocaleString()} จาก ${orgList.length.toLocaleString()})`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      setProgressStep('เตรียมการแสดงผล (Rendering)...');
      await delay(50);

      setValidatedNodes(finalOrgs);
      setParsedFile({ name: sourceName, size: sourceSize });
      setIsProcessing(false);

      // **Pre-render:** Send data to Canvas immediately so it renders in background!
      onImportData(finalOrgs);

    } catch (err) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการประมวลผลข้อมูล: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    // Canvas is already pre-rendered in background!
    // Just close the modal seamlessly.
    onClose();
    resetState();
  };

  const resetState = () => {
    setParsedFile(null);
    setValidatedNodes([]);
    setSheetLink('');
  };

  const handleCloseModal = () => {
    if (parsedFile) {
      onCancelImport();
    }
    resetState();
    onClose();
  };

  const issueCount = validatedNodes.filter(n => n.errors.length > 0 || n.warnings.length > 0).length;
  const validCount = validatedNodes.length - issueCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh] relative">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600 rounded-xl text-white shadow-sm">
              <FileSpreadsheet size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">นำเข้าไฟล์องค์กร (XLSX / CSV)</h2>
              <p className="text-sm text-slate-600">💡 ระบบจะคำนวณระดับ (Level) ให้โดยอัตโนมัติจากโครงสร้างต้นสังกัด คุณไม่จำเป็นต้องระบุ Level ในไฟล์นำเข้า</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
            aria-label="ปิดหน้าต่างนำเข้า"
            title="ปิดหน้าต่างนำเข้า"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col bg-white flex-1 overflow-hidden p-6 gap-6">
          {!parsedFile ? (
            isProcessing ? (
              <div className="flex-1 flex flex-col justify-center items-center bg-slate-50/50 rounded-2xl border border-slate-100 p-8 text-center animate-in fade-in duration-300 overflow-y-auto">
                <div className="relative w-16 h-16 mb-6 shrink-0 mt-4">
                  <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Layers className="text-blue-600 animate-pulse w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-6 shrink-0">ระบบกำลังประมวลผลข้อมูล...</h3>
                
                <div className="w-full max-w-sm space-y-3 pb-4">
                  {[
                    { id: 'read', label: 'กำลังอ่านและดึงข้อมูล', match: ['เชื่อมต่อ', 'อ่านไฟล์'] },
                    { id: 'parse', label: 'กำลังแปลงโครงสร้างข้อมูล', match: ['แปลงโครงสร้าง'] },
                    { id: 'clean', label: 'ตรวจสอบความถูกต้องของข้อมูล', match: ['ทำความสะอาด'] },
                    { id: 'build', label: 'ประกอบโครงสร้างความสัมพันธ์', match: ['เตรียมพร้อมโครงสร้าง', 'ประกอบโครงสร้าง'] },
                    { id: 'render', label: 'เตรียมการแสดงผล', match: ['เตรียมการแสดงผล'] }
                  ].map((step, idx, arr) => {
                    const currentStepIndex = arr.findIndex(s => s.match.some(m => progressStep.includes(m)));
                    const activeIdx = currentStepIndex === -1 ? 0 : currentStepIndex; // fallback to 0
                    const isCompleted = activeIdx > idx;
                    const isCurrent = activeIdx === idx;

                    return (
                      <div key={step.id} className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ${isCurrent ? 'bg-blue-50 border border-blue-100 shadow-sm scale-[1.02]' : isCompleted ? 'bg-white border border-slate-100' : 'opacity-50 grayscale bg-transparent'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isCompleted ? 'bg-green-100 text-green-600' : isCurrent ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                          {isCompleted ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className={`text-sm font-bold transition-colors truncate ${isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-slate-500'}`}>
                            {step.label}
                          </p>
                          {isCurrent && progressStep && !progressStep.includes(step.label) && (
                            <p className="text-[11px] text-blue-600/80 font-medium mt-0.5 animate-in slide-in-from-top-1 truncate" title={progressStep}>{progressStep}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Database size={16} className="text-blue-600" /> Data Dictionary (โครงสร้างไฟล์ที่รองรับ)
                  </h3>
                  <button
                    onClick={onDownloadTemplate}
                    className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Download size={14} /> โหลด Template
                  </button>
                </div>

                {/* Data Dictionary Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white mb-6 shrink-0">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 w-1/4">Column Name</th>
                        <th className="px-3 py-2 w-1/5">Requirement</th>
                        <th className="px-3 py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-slate-800">org_name</td>
                        <td className="px-3 py-2 text-red-600 font-bold">Required</td>
                        <td className="px-3 py-2 font-medium">ชื่อหน่วยงาน (หากรับผิดชอบหลายพื้นที่ <b>ให้เพิ่มแถวใหม่และใช้ชื่อหน่วยงานเดิม</b>)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700">parent_name</td>
                        <td className="px-3 py-2 text-slate-600">Optional</td>
                        <td className="px-3 py-2 font-medium">ชื่อหน่วยงานต้นสังกัด (ปล่อยว่างถ้าเป็นหน่วยงานระดับบนสุด)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700">province</td>
                        <td className="px-3 py-2 text-slate-600">Optional</td>
                        <td className="px-3 py-2 font-medium">ชื่อจังหวัด (หากปล่อยว่างจะถือว่าไม่มีพื้นที่รับผิดชอบ)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700">amphoe</td>
                        <td className="px-3 py-2 text-slate-600">Optional</td>
                        <td className="px-3 py-2 font-medium">ชื่ออำเภอ หรือ เขต</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700">tambon</td>
                        <td className="px-3 py-2 text-slate-600">Optional</td>
                        <td className="px-3 py-2 font-medium">ชื่อตำบล หรือ แขวง</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col md:flex-row gap-4 mt-2">
                  <div className="flex-1 flex flex-col justify-center items-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                    />
                    <div
                      onClick={triggerFileInput}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className="w-full flex-1 border-2 border-dashed border-green-300 bg-green-50/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-green-50/60 transition-all cursor-pointer group"
                    >
                      <Upload size={40} className="text-green-700 mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300" strokeWidth={1.5} />
                      <h3 className="text-md font-bold text-slate-800 mb-2">ลากไฟล์มาวางที่นี่</h3>
                      <p className="text-xs text-slate-700 font-semibold mb-1">หรือคลิกเพื่อเลือกไฟล์จากคอมพิวเตอร์</p>
                    </div>
                  </div>

                  <div className="md:w-1/3 w-full flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-800 text-left mt-2">หรือ นำเข้าจาก Google Sheets Link</p>
                    <p className="text-[10px] text-slate-600 font-bold text-left mb-1">
                      (ต้องตั้งค่าเป็น <span className="text-blue-600">Anyone with the link</span>)
                    </p>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="วางลิงก์ Google Sheets..."
                        value={sheetLink}
                        onChange={(e) => setSheetLink(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 bg-white"
                      />
                      <button
                        onClick={handleLinkImport}
                        disabled={!sheetLink.trim()}
                        className={`px-6 py-3 w-full rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${sheetLink.trim() ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                      >
                        <Download size={16} /> ดึงข้อมูลจากลิงก์
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Summary Info */}
              <div className="flex items-center gap-4 mb-6 shrink-0">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-4 items-center">
                  <CheckCircle className="text-green-700 shrink-0 w-8 h-8" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">อ่านไฟล์เรียบร้อย</h4>
                    <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[300px]">{parsedFile.name} (ขนาด: {Math.round(parsedFile.size / 1024)} KB)</p>
                  </div>
                </div>

                <div className="flex-1 border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 font-bold">หน่วยงานทั้งหมด</p>
                    <p className="text-lg font-bold text-slate-900">{validatedNodes.length.toLocaleString()}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-200"></div>
                  <div className="text-center">
                    <p className="text-xs text-green-700 font-bold">สมบูรณ์ (ไม่มีปัญหา)</p>
                    <p className="text-lg font-bold text-green-755">{validCount.toLocaleString()}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-200"></div>
                  <div className="text-center">
                    <p className="text-xs text-amber-600 font-bold">มีข้อขัดแย้ง/แจ้งเตือน</p>
                    <p className="text-lg font-bold text-amber-650">{issueCount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {issueGroups.length > 0 ? (
                <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden flex flex-col flex-1 min-h-0">
                  <div className="bg-amber-50 p-4 border-b border-amber-200 flex items-center gap-2 shrink-0">
                    <AlertTriangle className="text-amber-600 w-5 h-5 shrink-0" />
                    <div>
                      <h5 className="font-bold text-amber-800 text-sm">พบข้อมูลขัดแย้ง (ระบบได้ทำการปรับโครงสร้างให้อัตโนมัติแล้วบางส่วน)</h5>
                      <p className="text-[11px] text-amber-700/80 font-semibold mt-0.5">คุณสามารถกดนำเข้าได้ทันที และไปแก้ไขความสัมพันธ์ที่ขัดแย้งในแถบตั้งค่าภายหลัง</p>
                    </div>
                  </div>
                  <div className="overflow-y-auto p-4 space-y-3 bg-slate-50 flex-1">
                    {issueGroups.map(group => (
                      <div key={group.id} className={`border ${group.border} ${group.bg} rounded-xl overflow-hidden shadow-sm`}>
                        <button
                          onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                          className="w-full p-3.5 flex justify-between items-center hover:bg-black/5 transition-colors text-left"
                        >
                          <span className={`text-sm font-bold ${group.color}`}>
                            {group.label} ({group.items.length.toLocaleString()} แห่ง)
                          </span>
                          {expandedGroupId === group.id ? <ChevronUp size={16} className={group.color} /> : <ChevronDown size={16} className={group.color} />}
                        </button>
                        {expandedGroupId === group.id && (
                          <div className="p-4 bg-white/50 border-t border-black/5 space-y-2">
                            {group.items.slice(0, 50).map((item, idx) => (
                              <div key={idx} className="text-[11px] text-slate-700 font-semibold flex flex-col bg-white p-2 rounded border border-slate-100">
                                <span className="font-bold text-slate-800">{item.name}</span>
                                <span className="text-slate-500 mt-0.5">{item.msg}</span>
                              </div>
                            ))}
                            {group.items.length > 50 && (
                              <div className="text-xs text-center font-bold text-slate-500 pt-2 pb-1">
                                ...และมีหน่วยงานที่ติดปัญหานี้อีก {(group.items.length - 50).toLocaleString()} แห่ง
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 border border-slate-200 rounded-2xl">
                  <CheckCircle size={48} className="text-green-500 mb-4" />
                  <h3 className="text-lg font-bold text-slate-800">ข้อมูลสมบูรณ์ 100%</h3>
                  <p className="text-slate-500 font-medium">พร้อมสำหรับนำเข้าสู่ระบบ</p>
                </div>
              )}

              {/* Import Confirm Button */}
              <div className="flex gap-4 mt-6 shrink-0">
                <button
                  onClick={handleCloseModal}
                  className="w-48 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-red-600 rounded-xl text-sm font-bold transition-colors cursor-pointer text-center"
                >
                  ยกเลิกการนำเข้า
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-100/50 flex justify-center items-center gap-2 transition-all cursor-pointer"
                >
                  <Check size={18} strokeWidth={2.5} /> นำเข้าและแก้ไขด้วยตนเอง
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

const getAreaCount = (areas) => {
  if (!areas) return 0;
  if (areas.locations) return areas.locations.length;
  let count = 0;
  if (areas.tambons && areas.tambons.length > 0) {
    count += areas.tambons.length;
  } else if (areas.tambon) {
    count += 1;
  } else if (areas.amphoe) {
    count += 1;
  } else if (areas.province) {
    count += 1;
  }
  return count;
};

const getSelectedLocations = (areas) => {
  if (!areas) return [];
  if (areas.locations) return areas.locations;

  const locs = [];
  if (areas.tambons && areas.tambons.length > 0) {
    areas.tambons.forEach(tambon => {
      locs.push({
        province: areas.province || '',
        amphoe: areas.amphoe || '',
        tambon: tambon,
        postalCode: areas.postalCode || ''
      });
    });
  } else if (areas.tambon || areas.amphoe || areas.province) {
    locs.push({
      province: areas.province || '',
      amphoe: areas.amphoe || '',
      tambon: areas.tambon || '',
      postalCode: areas.postalCode || ''
    });
  }
  return locs;
};

const formatAreaLabel = (areas) => {
  if (!areas) return "ไม่ระบุพื้นที่";

  if (areas.locations && areas.locations.length > 0) {
    return areas.locations.map(loc => {
      if (loc.province && !loc.amphoe && !loc.tambon) {
        return `ทั้งจังหวัด ${loc.province}`;
      }
      if (loc.province && loc.amphoe && !loc.tambon) {
        const prefix = loc.province === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ";
        return `ทั้ง${prefix}${loc.amphoe} (จ. ${loc.province})`;
      }
      const parts = [];
      if (loc.tambon) {
        const prefix = loc.province === "กรุงเทพมหานคร" ? "แขวง" : "ต.";
        parts.push(`${prefix}${loc.tambon}`);
      }
      if (loc.amphoe) {
        const prefix = loc.province === "กรุงเทพมหานคร" ? "เขต" : "อ.";
        parts.push(`${prefix}${loc.amphoe}`);
      }
      if (loc.province) {
        const prefix2 = loc.province === "กรุงเทพมหานคร" ? "" : "จ.";
        parts.push(`${prefix2}${loc.province}`);
      }
      if (loc.postalCode) {
        parts.push(loc.postalCode);
      }
      return parts.join(' ');
    }).join(' | ');
  }

  if (areas.province && !areas.amphoe && !areas.tambon) {
    return `ทั้งจังหวัด ${areas.province}`;
  }
  if (areas.province && areas.amphoe && !areas.tambon) {
    const prefix = areas.province === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ";
    return `ทั้ง${prefix}${areas.amphoe} (จ. ${areas.province})`;
  }

  if (areas.tambon || areas.amphoe) {
    const parts = [];
    if (areas.tambon) {
      const prefix = areas.province === "กรุงเทพมหานคร" ? "แขวง" : "ต.";
      parts.push(`${prefix}${areas.tambon}`);
    }
    if (areas.amphoe) {
      const prefix = areas.province === "กรุงเทพมหานคร" ? "เขต" : "อ.";
      parts.push(`${prefix}${areas.amphoe}`);
    }
    if (areas.province) {
      const prefix = areas.province === "กรุงเทพมหานคร" ? "" : "จ.";
      parts.push(`${prefix}${areas.province}`);
    }
    return parts.join(' ');
  }

  if (areas.tambons && areas.tambons.length > 0) {
    return `${areas.tambons.length} ตำบล (${areas.province})`;
  }

  if (areas.province) {
    return `ทั้งจังหวัด ${areas.province}`;
  }

  return "ไม่ระบุพื้นที่";
};



// Custom address search input component searching all fields: tambon (s), amphoe (d), province (p), and postalCode (po)
const CustomAddressInput = ({ placeholder, className }) => {
  const {
    value,
    searchByField,
    setSuggestions,
    suggestions,
    setShouldDisplaySuggestion,
    shouldDisplaySuggestion,
    setHighlightedItemIndex,
    highlightedItemIndex,
    onValueChange
  } = useAddressTypeaheadContext();

  const [query, setQuery] = React.useState('');

  // Clear query text when addressInput values are reset
  React.useEffect(() => {
    if (!value.subdistrict && !value.district && !value.province && !value.postalCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
    }
  }, [value]);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setQuery(text);

    if (!text.trim()) {
      setSuggestions([]);
      setShouldDisplaySuggestion(false);
      return;
    }

    // Search by Subdistrict (s), District (d), Province (p), and Postal Code (po)
    const sRes = searchByField('s', text) || [];
    const dRes = searchByField('d', text) || [];
    const pRes = searchByField('p', text) || [];
    const poRes = searchByField('po', text) || [];

    // 1. Extract matched provinces for "Whole Province" options
    const matchedProvinces = Array.from(new Set([
      ...pRes.map(item => item.p),
      ...sRes.map(item => item.p).filter(p => p.includes(text)),
      ...dRes.map(item => item.p).filter(p => p.includes(text))
    ]));
    const provinceSuggestions = matchedProvinces.map(prov => ({
      s: '',
      d: '',
      p: prov,
      po: '',
      isWholeProvince: true
    }));

    // 2. Extract matched districts for "Whole District" options
    const matchedDistrictsMap = new Map();
    dRes.forEach(item => {
      const key = `${item.p}-${item.d}`;
      if (!matchedDistrictsMap.has(key)) {
        matchedDistrictsMap.set(key, { p: item.p, d: item.d });
      }
    });
    sRes.forEach(item => {
      if (item.d.includes(text)) {
        const key = `${item.p}-${item.d}`;
        if (!matchedDistrictsMap.has(key)) {
          matchedDistrictsMap.set(key, { p: item.p, d: item.d });
        }
      }
    });
    const districtSuggestions = Array.from(matchedDistrictsMap.values()).map(dist => ({
      s: '',
      d: dist.d,
      p: dist.p,
      po: '',
      isWholeDistrict: true
    }));

    // 3. De-duplicate specific subdistrict matches
    const combined = [...sRes, ...dRes, ...pRes, ...poRes];
    const uniqueSubdistricts = [];
    const seen = new Set();

    for (const item of combined) {
      const key = `${item.s}-${item.d}-${item.p}-${item.po}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSubdistricts.push(item);
      }
    }

    // 4. Combine all suggestions (province options first, then districts, then subdistricts)
    const allSuggestions = [];

    // Inject "Nationwide" if search text matches
    const searchLower = text.trim().toLowerCase();
    if ('ส่วนกลาง'.includes(searchLower) || 'ทั่วประเทศ'.includes(searchLower) || 'ไม่มีพื้นที่ดูแลเฉพาะ'.includes(searchLower) || 'nationwide'.includes(searchLower)) {
      allSuggestions.push({
        s: '',
        d: '',
        p: 'NATIONWIDE_SCOPE',
        po: '',
        isNationwide: true
      });
    }

    allSuggestions.push(
      ...provinceSuggestions,
      ...districtSuggestions,
      ...uniqueSubdistricts
    );

    setSuggestions(allSuggestions.slice(0, 30));
    setHighlightedItemIndex(-1);
    setShouldDisplaySuggestion(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShouldDisplaySuggestion(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedItemIndex(highlightedItemIndex > 0 ? highlightedItemIndex - 1 : 0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedItemIndex(highlightedItemIndex < suggestions.length - 1 ? highlightedItemIndex + 1 : suggestions.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedItemIndex >= 0 && highlightedItemIndex < suggestions.length) {
        const item = suggestions[highlightedItemIndex];
        handleSelectSuggestion(item);
      }
    }
  };

  const handleSelectSuggestion = (item) => {
    onValueChange?.({
      subdistrict: item.s || '',
      district: item.d || '',
      province: item.p || '',
      postalCode: item.po || ''
    });
    setShouldDisplaySuggestion(false);
  };

  const handleFocus = () => {
    setShouldDisplaySuggestion(true);
  };

  const handleBlur = () => {
    setShouldDisplaySuggestion(false);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
      />
      {shouldDisplaySuggestion && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 z-[120] mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 text-xs font-semibold text-slate-700">
          {suggestions.map((item, idx) => {
            const isHighlighted = highlightedItemIndex === idx;
            let label;
            let badge = null;

            if (item.isNationwide) {
              label = `🌍 ส่วนกลาง / ไม่มีพื้นที่ดูแลเฉพาะ (Non-spatial)`;
              badge = <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">ส่วนกลาง</span>;
            } else if (item.isWholeProvince) {
              label = `ทั้งจังหวัด ${item.p}`;
              badge = <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">ทั้งจังหวัด</span>;
            } else if (item.isWholeDistrict) {
              const prefix = item.p === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ";
              label = `ทั้ง${prefix}${item.d} (จ. ${item.p})`;
              badge = <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded font-bold">ทั้งอำเภอ/เขต</span>;
            } else {
              const sPrefix = item.p === "กรุงเทพมหานคร" ? "แขวง" : "ต.";
              const dPrefix = item.p === "กรุงเทพมหานคร" ? "เขต" : "อ.";
              const pPrefix = item.p === "กรุงเทพมหานคร" ? "" : "จ.";
              label = `${sPrefix}${item.s} ${dPrefix}${item.d} ${pPrefix}${item.p} ${item.po}`;
            }

            return (
              <li
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(item);
                }}
                onMouseEnter={() => setHighlightedItemIndex(idx)}
                className={`px-3 py-2.5 flex justify-between items-center cursor-pointer transition-colors ${isHighlighted ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                  }`}
              >
                <span>{label}</span>
                {badge}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const ConfigPanel = ({ selectedNode, handleUpdateNode, handleDeleteNode, onClose, organizations, nodeIssues, setMoveMode, locationDb, setFocusNodeId, setSearchedNodeId, setSelectedNodeId }) => {
  const [addressInput, setAddressInput] = React.useState({
    subdistrict: '',
    district: '',
    province: '',
    postalCode: '',
  });

  const [isParentModalOpen, setIsParentModalOpen] = React.useState(false);
  const [parentSearchQuery, setParentSearchQuery] = React.useState('');
  const [pendingParentId, setPendingParentId] = React.useState(null);
  const [selectedMoveMode, setSelectedMoveMode] = React.useState(null);
  const [confirmingParentData, setConfirmingParentData] = React.useState(null);

  const allAncestors = React.useMemo(() => {
    if (!organizations || !selectedNode) return [];
    const ancestors = [];
    let currId = selectedNode.parentId;
    while (currId) {
      const parent = organizations.find(o => o.id === currId);
      if (parent) {
        ancestors.unshift(parent);
        currId = parent.parentId;
      } else {
        break;
      }
    }
    return ancestors;
  }, [organizations, selectedNode]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddressInput({
      subdistrict: '',
      district: '',
      province: '',
      postalCode: '',
    });
  }, [selectedNode?.id]);

  const selectedLocations = getSelectedLocations(selectedNode.areas);

  const childCountForSetting = React.useMemo(() => {
    if (!organizations || !selectedNode) return 0;
    return organizations.filter(org => org.parentId === selectedNode.id).length;
  }, [organizations, selectedNode]);

  const hasChildren = childCountForSetting > 0;

  const potentialRoots = React.useMemo(() => {
    if (!organizations) return [];
    return organizations.filter(org => !org.parentId || !organizations.some(n => n.id === org.parentId));
  }, [organizations]);

  const primaryRootId = potentialRoots.length > 0 ? potentialRoots[0].id : null;
  const isPrimaryRoot = selectedNode.id === primaryRootId;

  const descendantIds = React.useMemo(() => {
    if (!organizations || !selectedNode) return new Set();

    // O(N) children map generation to prevent O(N^2) traversal
    const childrenMap = new Map();
    organizations.forEach(o => {
      if (o.parentId) {
        if (!childrenMap.has(o.parentId)) childrenMap.set(o.parentId, []);
        childrenMap.get(o.parentId).push(o.id);
      }
    });

    const descendants = new Set();
    const queue = [selectedNode.id];
    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = childrenMap.get(currentId) || [];
      children.forEach(childId => {
        if (!descendants.has(childId)) {
          descendants.add(childId);
          queue.push(childId);
        }
      });
    }
    return descendants;
  }, [organizations, selectedNode]);

  const parentOptions = React.useMemo(() => {
    if (!organizations || !selectedNode) return [];
    let options = organizations.filter(org => org.id !== selectedNode.id && !descendantIds.has(org.id));
    if (parentSearchQuery.trim()) {
      const q = parentSearchQuery.toLowerCase();
      options = options.filter(org => org.name && org.name.toLowerCase().includes(q));
    }
    return options.slice(0, 50); // Limit to 50 items to prevent DOM freezing on massive datasets
  }, [organizations, selectedNode, descendantIds, parentSearchQuery]);

  const nodeIssue = nodeIssues?.get(selectedNode.id);

  const handleAddressSelect = (nextVal) => {
    if (nextVal.province === 'NATIONWIDE_SCOPE') {
      handleUpdateNode(selectedNode.id, 'areas', { ...(selectedNode.areas || {}), scope: 'NATIONWIDE', locations: [] });
      setAddressInput({ subdistrict: '', district: '', province: '', postalCode: '' });
      return;
    }

    if (nextVal.province) {
      const newLoc = {
        province: nextVal.province || '',
        amphoe: nextVal.district || '',
        tambon: nextVal.subdistrict || '',
        postalCode: nextVal.postalCode || ''
      };

      const exists = selectedLocations.some(loc =>
        loc.province === newLoc.province &&
        loc.amphoe === newLoc.amphoe &&
        loc.tambon === newLoc.tambon
      );

      if (!exists) {
        newLoc.code = getLocationCode(newLoc, locationDb);
        const updated = [...selectedLocations, newLoc];
        handleUpdateNode(selectedNode.id, 'areas', {
          ...selectedNode.areas,
          locations: updated
        });
      }

      setAddressInput({
        subdistrict: '',
        district: '',
        province: '',
        postalCode: '',
      });
    } else {
      setAddressInput(nextVal);
    }
  };

  const handleRemoveLocation = (indexToRemove) => {
    const updated = selectedLocations.filter((_, idx) => idx !== indexToRemove);
    handleUpdateNode(selectedNode.id, 'areas', {
      ...selectedNode.areas,
      locations: updated
    });
  };

  const formatSingleLocation = (loc) => {
    if (loc.province && !loc.amphoe && !loc.tambon) {
      return `ทั้งจังหวัด ${loc.province}`;
    }
    if (loc.province && loc.amphoe && !loc.tambon) {
      const prefix = loc.province === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ";
      return `ทั้ง${prefix}${loc.amphoe} (จ. ${loc.province})`;
    }

    const parts = [];
    if (loc.tambon) {
      const prefix = loc.province === "กรุงเทพมหานคร" ? "แขวง" : "ต.";
      parts.push(`${prefix}${loc.tambon}`);
    }
    if (loc.amphoe) {
      const prefix = loc.province === "กรุงเทพมหานคร" ? "เขต" : "อ.";
      parts.push(`${prefix}${loc.amphoe}`);
    }
    if (loc.province) {
      const prefix = loc.province === "กรุงเทพมหานคร" ? "" : "จ.";
      parts.push(`${prefix}${loc.province}`);
    }
    return parts.join(' ');
  };

  const handleConfirmParentChange = () => {
    if (pendingParentId === undefined) return;
    setMoveMode(selectedMoveMode || 'branch');
    handleUpdateNode(selectedNode.id, 'parentId', pendingParentId);
    setPendingParentId(null);
    setSelectedMoveMode(null);
    setConfirmingParentData(null);
    setIsParentModalOpen(false);
  };

  return (
    <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-2xl h-full flex flex-col animate-in fade-in slide-in-from-right-4 pointer-events-auto">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">L{selectedNode.level}</div>
          <div><h3 className="font-bold text-slate-800">ตั้งค่าหน่วยงาน</h3></div>
        </div>
        <button
          onClick={onClose}
          aria-label="ปิดกล่องตั้งค่า"
          title="ปิดกล่องตั้งค่า"
          className="text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide relative">
        {nodeIssue && (
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-semibold leading-normal animate-in fade-in slide-in-from-top-2 relative ${nodeIssue.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
            <AlertTriangle className={`w-4 h-4 shrink-0 ${nodeIssue.type === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <div className="font-bold mb-0.5">{nodeIssue.type === 'error' ? 'ข้อผิดพลาด (Error)' : 'ข้อควรระวัง (Warning)'}</div>
              <div className="font-medium text-slate-700 pr-6">{nodeIssue.message}</div>
            </div>
            <button
              onClick={() => {
                if (nodeIssue.type === 'error') {
                  const newErrors = (selectedNode.errors || []).filter(e => e !== nodeIssue.message);
                  handleUpdateNode(selectedNode.id, 'errors', newErrors);
                } else {
                  const newWarnings = (selectedNode.warnings || []).filter(w => w !== nodeIssue.message);
                  handleUpdateNode(selectedNode.id, 'warnings', newWarnings);
                }
              }}
              className={`absolute top-2 right-2 p-1 rounded-lg transition-colors ${nodeIssue.type === 'error'
                  ? 'text-red-400 hover:text-red-600 hover:bg-red-100/50'
                  : 'text-amber-400 hover:text-amber-600 hover:bg-amber-100/50'
                }`}
              title="รับทราบและลบแจ้งเตือนนี้"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ชื่อหน่วยงาน (ย้ายขึ้นบนสุด) */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-2">ชื่อหน่วยงาน</label>
          <textarea
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-bold text-slate-800 shadow-sm resize-none"
            rows="3"
            value={selectedNode.name || ''}
            onChange={(e) => handleUpdateNode(selectedNode.id, 'name', e.target.value)}
            onBlur={(e) => {
              const cleaned = sanitizeString(e.target.value, { showToast: true });
              if (cleaned !== e.target.value) {
                handleUpdateNode(selectedNode.id, 'name', cleaned);
              }
            }}
            placeholder="ระบุชื่อหน่วยงาน..."
          />
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            💡 ระบบจะคลีนสระพิมพ์ซ้ำ ลบอักขระพิเศษ และแปลงคำย่ออัตโนมัติเมื่อละจากช่องป้อน
          </p>
        </div>

        {/* สายการบังคับบัญชา (ทุกระดับ) */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-bold text-slate-650 uppercase">สายการบังคับบัญชา (ทุกระดับ)</label>
          </div>

          <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
            {isPrimaryRoot && allAncestors.length === 0 ? (
              <div className="flex justify-between items-center group">
                <span className="text-sm font-bold text-amber-700 flex items-center gap-1.5">
                  <span>👑</span> หน่วยงานสูงสุดของระบบ
                </span>
                <button
                  onClick={() => {
                    setParentSearchQuery('');
                    setPendingParentId(null);
                    setSelectedMoveMode(hasChildren ? null : 'branch');
                    setIsParentModalOpen(true);
                  }}
                  className="shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                  title="กำหนดต้นสังกัด"
                >
                  ตั้งต้นสังกัด
                </button>
              </div>
            ) : allAncestors.length > 0 ? (
              <div className="space-y-1.5">
                {allAncestors.map((anc, idx) => {
                  const isImmediateParent = idx === allAncestors.length - 1;
                  return (
                    <div key={anc.id} className="flex items-start gap-2 text-xs group">
                      <div className="flex flex-col items-center mt-0.5 min-w-[16px]">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-500" title={`ระดับ ${anc.level}`}>
                          {anc.level || '-'}
                        </div>
                        <div className="w-px bg-slate-200 h-3 my-0.5"></div>
                      </div>
                      <div className="flex-1 flex justify-between items-start gap-2">
                        <button
                          onClick={() => {
                            setFocusNodeId(anc.parentId || null);
                            setSelectedNodeId(anc.id);
                            // Need to pass setSearchedNodeId to focus correctly
                            if (setSearchedNodeId) setSearchedNodeId(anc.id);
                          }}
                          className={`${isImmediateParent ? 'font-bold text-slate-900' : 'font-medium text-slate-700'} hover:text-blue-600 cursor-pointer break-words whitespace-normal leading-tight pt-0.5 text-left underline decoration-slate-200 hover:decoration-blue-500 underline-offset-2 transition-colors`}
                        >
                          {anc.name}
                        </button>
                        {isImmediateParent && (
                          <button
                            onClick={() => {
                              setParentSearchQuery('');
                              setPendingParentId(null);
                              setSelectedMoveMode(hasChildren ? null : 'branch');
                              setIsParentModalOpen(true);
                            }}
                            className="shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                            title="เปลี่ยนต้นสังกัด"
                          >
                            เปลี่ยน
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Current Node */}
                <div className="flex items-start gap-2 text-xs group">
                  <div className="flex flex-col items-center mt-0.5 min-w-[16px]">
                    <div className="w-4 h-4 shrink-0 rounded-full bg-blue-100 border border-blue-400 flex items-center justify-center text-[8px] font-bold text-blue-700" title={`ระดับ ${selectedNode.level}`}>
                      {selectedNode.level || '-'}
                    </div>
                  </div>
                  <div className="flex-1 flex justify-between items-start gap-2">
                    <div className="font-bold text-blue-700 break-words whitespace-normal leading-tight pt-0.5">
                      {selectedNode.name || '(ไม่มีชื่อ)'} <span className="text-[10px] font-normal text-blue-500 ml-1">(หน่วยงานนี้)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center group">
                <span className="text-sm font-bold text-slate-800">(ไม่มีต้นสังกัด)</span>
                <button
                  onClick={() => {
                    setParentSearchQuery('');
                    setPendingParentId(null);
                    setSelectedMoveMode(hasChildren ? null : 'branch');
                    setIsParentModalOpen(true);
                  }}
                  className="shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                  title="ตั้งต้นสังกัด"
                >
                  ตั้งต้นสังกัด
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ขอบเขตพื้นที่รับผิดชอบ */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><MapPin size={16} className="text-blue-700" /> ขอบเขตพื้นที่รับผิดชอบ</h4>
            {selectedNode.areas?.scope === 'NATIONWIDE' && (
              <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">ส่วนกลาง / ทั่วประเทศ</span>
            )}
          </div>

          {(() => {
            if (selectedNode.areas?.scope === 'NATIONWIDE' || selectedLocations.length > 0) return null;
            let matchKey = null;
            if (selectedNode.rawRows && selectedNode.rawRows.length > 0) {
              const raw = selectedNode.rawRows[0];
              matchKey = Object.keys(LOCATION_TYPO_DICT).find(k => 
                (raw.tambon && String(raw.tambon).includes(k)) || 
                (raw.amphoe && String(raw.amphoe).includes(k)) || 
                (raw.province && String(raw.province).includes(k))
              );
            }
            if (!matchKey) return null;
            const suggestion = LOCATION_TYPO_DICT[matchKey];
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                    <AlertTriangle size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-800">💡 แนะนำคำที่ถูกต้อง</h4>
                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                      คุณหมายถึง <span className="font-bold text-amber-900">ต.{suggestion.subdistrict} อ.{suggestion.district} จ.{suggestion.province}</span> ใช่หรือไม่?
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => handleAddressSelect(suggestion)}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm"
                >
                  ใช่, เลือกพื้นที่นี้
                </button>
              </div>
            );
          })()}

          <div className="space-y-3 animate-in fade-in">
            <ThailandAddressTypeahead
                value={addressInput}
                onValueChange={handleAddressSelect}
              >
                <div className="space-y-2 relative">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">ค้นหาพื้นที่ (ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์)</label>
                    <CustomAddressInput
                      placeholder="พิมพ์เพื่อค้นหาตำบล, อำเภอ, จังหวัด หรือรหัสไปรษณีย์..."
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all font-medium"
                    />
                  </div>
                </div>
              </ThailandAddressTypeahead>
            </div>

          {selectedNode.areas?.scope !== 'NATIONWIDE' && selectedLocations.length > 0 && (
            <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 pt-3 border-t border-slate-200/60">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">พื้นที่ที่รับผิดชอบ ({selectedLocations.length})</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-hide">
                {selectedLocations.map((loc, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 text-[11px] font-semibold text-blue-700 animate-in zoom-in-95 gap-2">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate pr-2">{formatSingleLocation(loc)}</span>
                      {loc.code && (
                        <span className="text-[9px] text-blue-600/70 font-mono font-bold mt-0.5">รหัสพื้นที่: {loc.code}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveLocation(idx)}
                      className="p-1 hover:bg-blue-100 hover:text-red-700 rounded-lg transition-all cursor-pointer shrink-0"
                      title="ลบพื้นที่รับผิดชอบนี้"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* จำนวนลูกน้อง */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">หน่วยงานย่อย</label>
            <div className="text-sm font-bold text-slate-800">{childCountForSetting} หน่วยงาน</div>
          </div>
          {childCountForSetting > 0 && (
            <button
              onClick={() => {
                setFocusNodeId(selectedNode.id);
                onClose();
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm flex items-center gap-1 transition-colors"
            >
              ดูหน่วยงานย่อย <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Modal เลือกต้นสังกัด */}
        {isParentModalOpen && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md rounded-xl p-4 flex flex-col border border-slate-200 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-slate-800">เลือกต้นสังกัดใหม่</h4>
              <button
                onClick={() => {
                  setIsParentModalOpen(false);
                  setPendingParentId(null);
                  setSelectedMoveMode(null);
                  setConfirmingParentData(null);
                }}
                className="text-slate-500 hover:bg-slate-100 p-1 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {hasChildren && selectedMoveMode === null ? (
              <div className="flex flex-col gap-3 h-full justify-center pb-8 animate-in slide-in-from-bottom-2">
                <p className="text-sm font-bold text-slate-700 text-center mb-2">เลือกรูปแบบการย้ายหน่วยงาน</p>
                <button
                  onClick={() => setSelectedMoveMode('branch')}
                  className="w-full p-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl text-left hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="font-bold text-sm text-slate-900 group-hover:text-blue-700 mb-1">📦 ย้ายทั้งสาย</div>
                  <div className="text-xs text-slate-500 font-medium">นำหน่วยงานย่อยทั้งหมดติดไปด้วย</div>
                </button>
                <button
                  onClick={() => setSelectedMoveMode('single')}
                  className="w-full p-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl text-left hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="font-bold text-sm text-slate-900 group-hover:text-blue-700 mb-1">📄 ย้ายเฉพาะหน่วยงานนี้</div>
                  <div className="text-xs text-slate-500 font-medium">ฝากหน่วยงานย่อยไว้ที่ต้นสังกัดเดิม</div>
                </button>
              </div>
            ) : confirmingParentData ? (
              <div className="flex flex-col h-full animate-in slide-in-from-right-4">
                <div className="flex-1 space-y-4 pt-2">
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs font-bold text-amber-800 mb-3 text-center">ยืนยันการย้ายต้นสังกัด?</p>

                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg border border-amber-100">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">หน่วยงานปัจจุบัน</div>
                        <div className="text-sm font-bold text-slate-800">{selectedNode.name}</div>
                      </div>

                      <div className="flex justify-center text-amber-500">
                        <ChevronsDown size={16} />
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-amber-100">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">ย้ายไปอยู่ภายใต้</div>
                        <div className="text-sm font-bold text-blue-700">{confirmingParentData.name}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t border-slate-100 shrink-0">
                  <button
                    onClick={() => {
                      setConfirmingParentData(null);
                      setPendingParentId(null);
                    }}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    onClick={handleConfirmParentChange}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-colors"
                  >
                    ยืนยันการย้าย
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full animate-in slide-in-from-right-4">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหน่วยงานต้นสังกัดใหม่..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 mb-3 shrink-0"
                  value={parentSearchQuery}
                  onChange={e => setParentSearchQuery(e.target.value)}
                  autoFocus
                />

                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide pb-2">
                  <button
                    onClick={() => {
                      setPendingParentId(null);
                      setConfirmingParentData({ name: '-- เป็นหน่วยงานสูงสุด (ไม่มีต้นสังกัด) --' });
                    }}
                    className="w-full text-left p-2.5 rounded-lg border text-sm font-bold transition-colors bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    -- เป็นหน่วยงานสูงสุด (ไม่มีต้นสังกัด) --
                  </button>
                  {parentOptions.map(org => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setPendingParentId(org.id);
                        setConfirmingParentData(org);
                      }}
                      className="w-full text-left p-2.5 rounded-lg border text-sm font-bold transition-colors bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    >
                      {org.name || '(ไม่มีชื่อ)'}
                    </button>
                  ))}
                  {parentOptions.length === 0 && (
                    <div className="text-center py-4 text-xs font-medium text-slate-500">
                      ไม่พบหน่วยงานอื่นที่สามารถเป็นต้นสังกัดได้
                    </div>
                  )}
                </div>

                {hasChildren && (
                  <div className="pt-3 border-t border-slate-100 shrink-0">
                    <button
                      onClick={() => setSelectedMoveMode(null)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center justify-center w-full gap-1 p-2"
                    >
                      <ChevronLeft size={14} /> กลับไปเลือกรูปแบบการย้าย
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-red-100 mt-6 shrink-0">
          <button
            onClick={() => handleDeleteNode(selectedNode.id)}
            className="w-full py-2.5 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-red-100 hover:border-red-500 shadow-sm"
          >
            <Trash2 size={16} /> ลบหน่วยงานนี้
          </button>
        </div>

      </div>
    </div>
  );
};

const recalculateAllLevels = (orgs) => {
  const orgMap = new Map();
  orgs.forEach(org => orgMap.set(org.id, org));

  const levelCache = new Map();

  const getLevel = (orgId) => {
    if (!orgId) return 0;
    if (levelCache.has(orgId)) return levelCache.get(orgId);

    const org = orgMap.get(orgId);
    if (!org || !org.parentId) {
      levelCache.set(orgId, 1);
      return 1;
    }

    // Temporary set to 1 to break recursion if circular dependency exists
    levelCache.set(orgId, 1);
    const parentLevel = getLevel(org.parentId);
    const lvl = parentLevel + 1;
    levelCache.set(orgId, lvl);
    return lvl;
  };

  return orgs.map(org => ({
    ...org,
    level: getLevel(org.id)
  }));
};

const WelcomeModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' or 'checklist'

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[85vh] border border-slate-200">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md">
              <Network size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">ยินดีต้อนรับสู่ Visual Org Builder 🚀</h2>
              <p className="text-xs text-slate-650 mt-0.5 font-medium">เครื่องมือจัดทำและตรวจสอบโครงสร้างแผนผังหน่วยงานแบบครบวงจร</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            aria-label="ปิดคำแนะนำ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 px-6">
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'guide'
                ? 'border-blue-650 text-blue-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            📖 คู่มือการใช้งานและขั้นตอน
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'checklist'
                ? 'border-blue-650 text-blue-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            ⚙️ สถานะฟีเจอร์และแผนงาน
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'guide' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Left Column: Workflow */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                  📌 ขั้นตอนการทำงานหลัก & การย้ายต้นสังกัด
                </h3>
                <div className="relative border-l-2 border-blue-100 ml-3 pl-5 space-y-5">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      1
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">1. นำเข้าข้อมูล (Import)</h4>
                    <p className="text-[11px] text-slate-650 font-semibold mt-0.5 leading-relaxed font-semibold">
                      เริ่มต้นโดยดาวน์โหลดเทมเพลต Excel แล้วกรอกข้อมูล หรืออัปโหลดไฟล์ Excel/JSON เดิมเข้าระบบผ่านปุ่ม <b>"นำเข้าข้อมูล"</b> ด้านบน
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      2
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">2. ปรับแต่งและย้ายต้นสังกัด</h4>
                    <div className="text-[11px] text-slate-650 mt-0.5 leading-relaxed font-semibold space-y-1.5">
                      <p>คุณสามารถย้ายต้นสังกัดของหน่วยงานได้ 2 วิธี:</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        <li><b>วิธีที่ 1 (ลากวาง)</b>: ลากการ์ดหน่วยงานไปวางซ้อนทับการ์ดหน่วยงานอื่นเพื่อย้ายต้นสังกัดทันที</li>
                        <li><b>วิธีที่ 2 (แก้ไขในฟอร์ม)</b>: คลิกที่การ์ดหน่วยงาน แล้วเปลี่ยนต้นสังกัดในพาเนลแก้ไขข้อมูลฝั่งซ้ายมือ</li>
                      </ul>
                      <p className="text-blue-600 font-bold">💡 ระบบจะคอยตรวจสอบความสัมพันธ์ที่เป็นวงกลม (Cycle) และแจ้งเตือนข้อขัดแย้งให้อัตโนมัติแบบเรียลไทม์</p>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      3
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">3. ส่งออกข้อมูล (Export)</h4>
                    <p className="text-[11px] text-slate-650 font-semibold mt-0.5 leading-relaxed font-semibold">
                      เมื่อได้โครงสร้างที่สมบูรณ์และไม่มีข้อผิดพลาด ให้กดปุ่ม <b>"ส่งออกข้อมูล"</b> เพื่อดาวน์โหลดไฟล์ Excel หรือ JSON ไปใช้งานจริง
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Views & Tools */}
              <div className="space-y-4 md:border-l md:border-slate-100 md:pl-6">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                  🛠️ การควบคุมบอร์ดและมุมมอง (Board & Views)
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">🖱️</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">การเลื่อนและซูม (Pan & Zoom)</h4>
                      <p className="text-[11px] text-slate-650 font-semibold mt-0.5 leading-relaxed font-semibold">
                        กดเมาส์ลากบนพื้นที่ว่างเพื่อเลื่อนผัง และใช้การหมุนลูกกลิ้งเมาส์ (Scroll Wheel) หรือปุ่มควบคุมขวาบนเพื่อซูมเข้า/ออก
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">📐</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">การสลับผัง แนวนอน/แนวตั้ง</h4>
                      <p className="text-[11px] text-slate-650 font-semibold mt-0.5 leading-relaxed font-semibold">
                        ระบบตั้งค่า <b>เริ่มต้นเป็นผังแนวนอน (Horizontal)</b> คุณสามารถสลับรูปแบบแผนผังเป็น <b>ผังแนวตั้ง (Vertical)</b> ได้ตามต้องการผ่านปุ่มสลับผังที่มุมขวาบน
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">📊</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Table View (ตารางสรุปข้อมูล)</h4>
                      <p className="text-[11px] text-slate-650 font-semibold mt-0.5 leading-relaxed font-semibold">
                        คลิกปุ่ม <b>"ตารางข้อมูล"</b> ด้านบนเพื่อดูสรุปรายการในมุมมองแบบตาราง สามารถยุบ/ขยายลำดับชั้นเพื่อตรวจภาพรวมพื้นที่รับผิดชอบได้สะดวกขึ้น
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Width Bottom: Data Cleansing Rules */}
              <div className="md:col-span-2 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  🧼 กฎการทำความสะอาดข้อมูลอัตโนมัติ (Data Cleansing Rules)
                </h3>
                <p className="text-[11px] text-slate-650 font-semibold leading-relaxed">
                  ระบบจะทำการคลีนและปรับมาตรฐานข้อความ (ชื่อหน่วยงานและขอบเขตพื้นที่) อัตโนมัติเมื่อนำเข้าไฟล์ หรือเมื่อป้อนข้อมูลเสร็จ (Event Blur) เพื่อล้างข้อมูลที่ไม่เป็นระเบียบ ดังนี้:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-700 font-semibold">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-blue-700 font-bold block mb-1">1. ล้างสระซ้ำและพิมพ์ผิด (Spell Alignment)</span>
                    ยุบสระคู่ผิดพลาด <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">เเ</code> เป็นสระ <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">แ</code> และลดสระหรือวรรณยุกต์ซ้อน (เช่น <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-750 font-mono text-[10px]">่่</code> &rarr; <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-750 font-mono text-[10px]">่</code>) อัตโนมัติ
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-blue-700 font-bold block mb-1">2. แปลงคำย่อทางการ (Alias Dictionary Normalization)</span>
                    ตรวจสอบและขยายคำย่อ เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">อบต.</code> เป็น <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">องค์การบริหารส่วนตำบล</code> และ <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">รพ.สต.</code> เป็น <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">โรงพยาบาลส่งเสริมสุขภาพตำบล</code>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-blue-700 font-bold block mb-1">3. ลบช่องว่างส่วนเกินและอักขระพิเศษ</span>
                    ลบช่องว่างส่วนเกินหัวท้าย ยุบช่องว่างติดกันเหลือ 1 เคาะ และกรองตัวอักษรพิเศษที่ไม่ปลอดภัยออกเพื่อป้องกันความผิดพลาดของระบบฐานข้อมูล
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-blue-700 font-bold block mb-1">4. ปรับมาตรฐานคำระบุพื้นที่รับผิดชอบ (Location Code Linkage)</span>
                    ตัดคำระบุระดับพื้นที่ (จังหวัด, จ., อำเภอ, อ., เขต, ตำบล, ต., แขวง) ออกชั่วคราวเพื่อทำความสะอาดและ <b>เชื่อมต่อกับรหัสพื้นที่ของกระทรวงมหาดไทย (MoI Code 6 หลัก)</b> อย่างแม่นยำ
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm sm:col-span-2">
                    <span className="text-blue-700 font-bold block mb-1">5. ตรวจสอบความซ้ำซ้อนของชื่อหน่วยงาน (Duplicate Name Detection)</span>
                    ตรวจสอบชื่อหน่วยงานซ้ำกันในระบบแบบเรียลไทม์ โดยเทียบหลังจากทำความสะอาดข้อความแล้ว หากพบหน่วยงานที่มีชื่อซ้ำกัน ระบบจะแจ้งเตือนเป็นข้อควรระวัง (Warning) บนแผนผังและตารางทันที
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Completed */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-855 flex items-center gap-2 border-b border-slate-100 pb-2">
                  ✅ ฟีเจอร์ที่พร้อมใช้งานแล้ว (Completed)
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Interactive Node Editor:</b> เพิ่ม แก้ไข ย้าย (Drag & Drop) และลบโหนด</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Dual View Layout:</b> มุมมอง Canvas (เลื่อน/ซูม) และมุมมองตารางสรุป (Table)</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Automated Import Audit:</b> ตรวจจับการเชื่อมโยงเป็นวงกลม (Cycle) และความขัดแย้งข้อมูล</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Import/Export Pipeline:</b> การโหลด/บันทึกไฟล์นามสกุล JSON และ Excel (.xlsx)</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>String Clean & Align:</b> ระบบลบช่องว่างส่วนเกิน ลบอักขระพิเศษ และแก้สระพิมพ์ซ้ำอัตโนมัติ</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Alias Dictionary Normalization:</b> ปรับเปลี่ยนคำย่อเป็นคำมาตรฐานทางการ (เช่น อบต. / อบจ. / รพ.สต.)</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Area Code 6-Digit Mapping:</b> เชื่อมต่อพิกัดกับรหัสพื้นที่ของกระทรวงมหาดไทย (MoI Code) อัตโนมัติ</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Duplicate Org Name Check:</b> ตรวจจับชื่อหน่วยงานซ้ำกันในแผนผังแบบเรียลไทม์</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Persistent Draft (localStorage):</b> บันทึกและกู้คืนร่างแบบเรียลไทม์ ป้องกันข้อมูลสูญหายเมื่อ Refresh</span>
                  </li>
                </ul>
              </div>

              {/* In Progress */}
              <div className="space-y-3 md:border-l md:border-slate-100 md:pl-6">
                <h3 className="text-sm font-bold text-slate-855 flex items-center gap-2 border-b border-slate-100 pb-2">
                  🚧 ฟีเจอร์ที่อยู่ระหว่างพัฒนา (In Progress)
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-[11px] text-slate-650 font-semibold">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span><b>Admin Staging & Fuzzy Match:</b> ระบบรีวิวและอนุมัติความซ้ำซ้อนสำหรับผู้ควบคุมระบบ</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              onChange={(e) => {
                if (e.target.checked) {
                  localStorage.setItem('hideWelcomeModal', 'true');
                } else {
                  localStorage.removeItem('hideWelcomeModal');
                }
              }}
            />
            <span>ไม่ต้องแสดงกล่องแนะนำนี้อีกในการเปิดครั้งถัดไป</span>
          </label>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100 hover:shadow-lg active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            เริ่มต้นใช้งานระบบ
          </button>
        </div>

      </div>
    </div>
  );
};
const BulkEditLocationModal = ({ isOpen, onClose, locationName, orgs, locationDb, handleUpdateBulkLocations }) => {
  const [addressInput, setAddressInput] = useState({ subdistrict: '', district: '', province: '', postalCode: '' });
  const [selectedLocations, setSelectedLocations] = useState([]);



  const handleAddressSelect = (nextVal) => {
    if (nextVal.province === 'NATIONWIDE_SCOPE') {
      // For bulk edit, setting nationwide means clearing locations and setting a special flag?
      // Actually, we don't have a scope field directly in BulkEditLocationModal yet, but we can set a pseudo-location to handle it later.
      const newLoc = { province: 'NATIONWIDE_SCOPE' };
      setSelectedLocations([...selectedLocations.filter(l => l.province !== 'NATIONWIDE_SCOPE'), newLoc]);
      setAddressInput({ subdistrict: '', district: '', province: '', postalCode: '' });
      return;
    }

    if (nextVal.province) {
      const newLoc = {
        province: nextVal.province || '',
        amphoe: nextVal.district || '',
        tambon: nextVal.subdistrict || '',
        postalCode: nextVal.postalCode || ''
      };

      const exists = selectedLocations.some(loc =>
        loc.province === newLoc.province &&
        loc.amphoe === newLoc.amphoe &&
        loc.tambon === newLoc.tambon
      );

      if (!exists) {
        newLoc.code = getLocationCode(newLoc, locationDb);
        setSelectedLocations([...selectedLocations, newLoc]);
      }
      setAddressInput({ subdistrict: '', district: '', province: '', postalCode: '' });
    }
  };

  const handleRemoveLocation = (index) => {
    setSelectedLocations(selectedLocations.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const orgIds = orgs.map(o => o.id);
    handleUpdateBulkLocations(orgIds, selectedLocations);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden relative border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">แก้ไขพื้นที่รับผิดชอบทั้งหมด</h2>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">กลุ่ม: {locationName} ({orgs.length} หน่วยงาน)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4 bg-white">
          
          {(() => {
            const matchKey = Object.keys(LOCATION_TYPO_DICT).find(k => locationName && locationName.includes(k));
            if (!matchKey) return null;
            const suggestion = LOCATION_TYPO_DICT[matchKey];
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-full shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">💡 แนะนำคำที่ถูกต้อง</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      คุณหมายถึง <span className="font-bold text-amber-900">ต.{suggestion.subdistrict} อ.{suggestion.district} จ.{suggestion.province}</span> ใช่หรือไม่?
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => handleAddressSelect(suggestion)}
                  className="w-full sm:w-auto shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  ใช่, เลือกพื้นที่นี้
                </button>
              </div>
            );
          })()}

          <div className="space-y-3">
            <ThailandAddressTypeahead value={addressInput} onValueChange={handleAddressSelect}>
              <div className="space-y-2 relative">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">ค้นหาพื้นที่ที่ถูกต้อง (ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์)</label>
                  <CustomAddressInput
                    placeholder="พิมพ์เพื่อค้นหาตำบล, อำเภอ, จังหวัด หรือรหัสไปรษณีย์..."
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all font-medium"
                  />
                </div>
              </div>
            </ThailandAddressTypeahead>
          </div>
          {selectedLocations.length > 0 && (
            <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">พื้นที่ที่รับผิดชอบ ({selectedLocations.length})</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedLocations.map((loc, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl p-2.5 text-xs font-semibold text-blue-700">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate">{loc.tambon ? `ต.${loc.tambon} ` : ''}{loc.amphoe ? `อ.${loc.amphoe} ` : ''}จ.${loc.province} {loc.postalCode}</span>
                      {loc.code && <span className="text-[10px] text-blue-600/70 font-mono mt-0.5">รหัส: {loc.code}</span>}
                    </div>
                    <button onClick={() => handleRemoveLocation(idx)} className="p-1.5 hover:bg-blue-100 hover:text-red-700 rounded-lg cursor-pointer"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer">ยกเลิก</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer transition-colors">บันทึก ({orgs.length} หน่วยงาน)</button>
        </div>
      </div>
    </div>
  );
};

export default function OrgManagerApp() {
  const DEFAULT_ORGS = [
    {
      id: 'root-1', name: 'กรุงเทพมหานคร', level: 1, parentId: null, logo: null,
      areas: { province: 'กรุงเทพมหานคร', amphoes: {}, tambons: ['ลาดยาว', 'จอมพล'] }
    },
    { id: 'node-2', name: 'สำนักการโยธา', level: 2, parentId: 'root-1', logo: null, areas: { province: 'กรุงเทพมหานคร' } },
    { id: 'node-3', name: 'สำนักการระบายน้ำ', level: 2, parentId: 'root-1', logo: null, areas: { province: 'กรุงเทพมหานคร' } },
    { id: 'node-4', name: 'สำนักการจราจรและขนส่ง', level: 2, parentId: 'root-1', logo: null, areas: { province: 'กรุงเทพมหานคร' } }
  ];

  const [organizations, setOrganizations] = useState(DEFAULT_ORGS);


  const [draftData, setDraftData] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await idbGet('org_builder_draft');
        if (saved) {
          const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (Array.isArray(parsed) && parsed.length > 4) {
            setDraftData(parsed);
            setShowDraftModal(true);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load saved draft from IndexedDB:", err);
      }
      // No large draft found, just start normally
      setIsDraftRestored(true);
    };
    loadDraft();
  }, []);

  const [locationDb, setLocationDb] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}raw_database.json`)
      .then(res => res.json())
      .then(data => {
        setLocationDb(data);
      })
      .catch(err => console.error("Failed to load raw_database.json:", err));
  }, []);

  // Resolve location codes once the DB is loaded
  useEffect(() => {
    if (locationDb.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrganizations(orgs => orgs.map(org => {
        const locations = getSelectedLocations(org.areas);
        if (locations.length > 0) {
          const updatedLocations = locations.map(loc => {
            if (loc.code) return loc;
            return {
              ...loc,
              code: getLocationCode(loc, locationDb)
            };
          });
          return {
            ...org,
            areas: {
              ...org.areas,
              locations: updatedLocations
            }
          };
        }
        return org;
      }));
    }
  }, [locationDb]);

  const [selectedNodeId, setSelectedNodeId] = useState('root-1');
  const [searchedNodeId, setSearchedNodeId] = useState(null);
  const [focusNodeId, setFocusNodeId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => !localStorage.getItem('hideWelcomeModal'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isIssueSidebarOpen, setIsIssueSidebarOpen] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [expandedEmptyCategories, setExpandedEmptyCategories] = useState(new Set());
  const [collapsedSubGroups, setCollapsedSubGroups] = useState(new Set());
  const [bulkEditGroup, setBulkEditGroup] = useState(null);
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' or 'table'
  const [deleteConfirmNode, setDeleteConfirmNode] = useState(null);
  const [moveMode, setMoveMode] = useState('branch'); // 'branch' or 'single'
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const [collapsedTableNodes, setCollapsedTableNodes] = useState(new Set());

  // States for Bulk Similarity Check UI
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 });
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [userResolutions, setUserResolutions] = useState({});

  const handleSaveDraft = async () => {
    try {
      await idbSet('org_builder_draft', organizations);
      toast.success('บันทึกแบบร่างสำเร็จ');
    } catch (e) {
      console.warn("Could not save draft to IndexedDB:", e);
      toast.error('ไม่สามารถบันทึกแบบร่างได้');
    }
  };

  // Auto-save draft on organization changes
  useEffect(() => {
    if (isDraftRestored) {
      idbSet('org_builder_draft', organizations).catch(e => {
        console.warn("Could not auto-save draft to IndexedDB:", e);
      });
    }
  }, [organizations, isDraftRestored]);

  const breadcrumbPath = useMemo(() => {
    if (!focusNodeId) return [];
    const path = [];
    let currentId = focusNodeId;
    while (currentId) {
      const node = organizations.find(n => n.id === currentId);
      if (node) {
        path.unshift(node);
        currentId = node.parentId;
      } else {
        break;
      }
    }
    return path;
  }, [focusNodeId, organizations]);
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const orgTree = useMemo(() => {
    const nodeMap = {};
    organizations.forEach(org => { nodeMap[org.id] = { ...org, children: [] }; });

    const roots = [];
    const visited = new Set();

    // Find potential roots: parentId is null or invalid
    const orgIdSet = new Set(organizations.map(org => org.id));
    const potentialRoots = organizations.filter(org => !org.parentId || !orgIdSet.has(org.parentId));

    const childrenMap = new Map();
    organizations.forEach(org => {
      if (org.parentId) {
        if (!childrenMap.has(org.parentId)) {
          childrenMap.set(org.parentId, []);
        }
        childrenMap.get(org.parentId).push(org);
      }
    });

    if (potentialRoots.length > 0) {
      const primaryRoot = potentialRoots[0];
      roots.push(nodeMap[primaryRoot.id]);
      visited.add(primaryRoot.id);

      const traverse = (node) => {
        if (!node) return;
        const children = childrenMap.get(node.id) || [];
        children.forEach(child => {
          const childNode = nodeMap[child.id];
          if (childNode && !visited.has(childNode.id)) {
            visited.add(childNode.id);
            node.children.push(childNode);
            traverse(childNode);
          }
        });
      };

      traverse(nodeMap[primaryRoot.id]);

      // For any potential root other than primary root, attach to primary root
      potentialRoots.slice(1).forEach(root => {
        const rootNode = nodeMap[root.id];
        if (rootNode && !visited.has(rootNode.id)) {
          nodeMap[primaryRoot.id].children.push(rootNode);
          traverse(rootNode);
        }
      });

      // For any remaining unvisited nodes (e.g. cycles), attach them to primary root as well so they render in red/amber
      organizations.forEach(org => {
        const node = nodeMap[org.id];
        if (node && !visited.has(node.id)) {
          nodeMap[primaryRoot.id].children.push(node);
          traverse(node);
        }
      });
    } else if (organizations.length > 0) {
      // If there are nodes but no roots (meaning all nodes are in a giant cycle), designate the first node as virtual root
      const virtualRoot = organizations[0];
      roots.push(nodeMap[virtualRoot.id]);
      visited.add(virtualRoot.id);

      const traverse = (node) => {
        if (!node) return;
        const children = childrenMap.get(node.id) || [];
        children.forEach(child => {
          const childNode = nodeMap[child.id];
          if (childNode && !visited.has(childNode.id)) {
            visited.add(childNode.id);
            node.children.push(childNode);
            traverse(childNode);
          }
        });
      };
      traverse(nodeMap[virtualRoot.id]);

      organizations.forEach(org => {
        const node = nodeMap[org.id];
        if (node && !visited.has(node.id)) {
          nodeMap[virtualRoot.id].children.push(node);
          traverse(node);
        }
      });
    }

    return roots;
  }, [organizations]);

  // Auto-focus on root if there is only one root
  useEffect(() => {
    if (orgTree.length === 1 && focusNodeId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusNodeId(orgTree[0].id);
    }
  }, [orgTree, focusNodeId]);

  // Verify focusNodeId still exists (handles draft load/bulk deletes)
  useEffect(() => {
    if (focusNodeId) {
      const exists = organizations.some(o => o.id === focusNodeId);
      if (!exists) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFocusNodeId(null);
      }
    }
  }, [organizations, focusNodeId]);

  // Verify selectedNodeId still exists
  useEffect(() => {
    if (selectedNodeId) {
      const exists = organizations.some(o => o.id === selectedNodeId);
      if (!exists) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedNodeId(null);
      }
    }
  }, [organizations, selectedNodeId]);

  const selectedNode = useMemo(() => organizations.find(o => o.id === selectedNodeId) || null, [organizations, selectedNodeId]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return organizations.filter(org => org.name && org.name.toLowerCase().includes(q));
  }, [searchQuery, organizations]);

  const conflictingNodes = useMemo(() => {
    const unreachable = [];

    // O(1) Lookups
    const idMap = new Map();
    const nameCounts = new Map();

    organizations.forEach(org => {
      idMap.set(org.id, org);
      if (org.name) {
        const cleanedName = sanitizeString(org.name).toLowerCase();
        nameCounts.set(cleanedName, (nameCounts.get(cleanedName) || 0) + 1);
      }
    });

    const potentialRoots = organizations.filter(org => !org.parentId || !idMap.has(org.parentId));
    const primaryRootId = potentialRoots.length > 0 ? potentialRoots[0].id : null;

    organizations.forEach(node => {
      // 1. Root constraint conflict: multiple roots
      if (!node.parentId && primaryRootId && node.id !== primaryRootId) {
        unreachable.push({
          ...node,
          causeType: 'warning',
          causeMessage: `ระบบต้องการหน่วยงานสูงสุดเพียงแห่งเดียว (โหนดนี้จะถูกย้ายเป็นลูกของ ${potentialRoots[0].name || ''} ชั่วคราว)`
        });
        return;
      }

      // 2. Parent missing conflict
      if (node.parentId) {
        if (!idMap.has(node.parentId)) {
          unreachable.push({
            ...node,
            causeType: 'warning',
            causeMessage: `ไม่พบต้นสังกัด (ID: ${node.parentId} ไม่มีในระบบ)`
          });
          return;
        }
      }

      // 3. Circular dependency conflict
      const visited = new Set();
      let current = node;
      const path = [];
      let hasCycle = false;

      while (current) {
        if (visited.has(current.id)) {
          path.push(current.name || 'ไม่ระบุชื่อ');
          hasCycle = true;
          break;
        }
        visited.add(current.id);
        path.push(current.name || 'ไม่ระบุชื่อ');
        current = idMap.get(current.parentId);
      }

      if (hasCycle) {
        unreachable.push({
          ...node,
          causeType: 'error',
          causeMessage: `ความสัมพันธ์เป็นวงกลม: ${path.join(' -> ')}`
        });
        return;
      }

      // 4. Duplicate name check
      if (node.name) {
        const cleanedName = sanitizeString(node.name).toLowerCase();
        if ((nameCounts.get(cleanedName) || 0) > 1) {
          unreachable.push({
            ...node,
            causeType: 'warning',
            causeMessage: `ชื่อหน่วยงานซ้ำกันในระบบ: "${node.name}"`
          });
        }
      }

      // 5. Missing Area check
      const locations = getSelectedLocations(node.areas);
      if (locations.length === 0) {
        unreachable.push({
          ...node,
          causeType: 'warning',
          causeMessage: `ไม่มีพื้นที่รับผิดชอบ (เป็นหน่วยงานลอย)`
        });
      }
    });

    return unreachable;
  }, [organizations]);

  // Unified node issues memo for canvas styling and tooltips
  const nodeIssues = useMemo(() => {
    const issues = new Map();

    conflictingNodes.forEach(c => {
      issues.set(c.id, {
        type: c.causeType,
        message: c.causeMessage
      });
    });

    // Merge static warning messages (from XLSX import etc.)
    organizations.forEach(node => {
      if (node.warnings && node.warnings.length > 0) {
        const existing = issues.get(node.id);
        if (!existing) {
          issues.set(node.id, {
            type: 'warning',
            message: node.warnings.join(' | ')
          });
        } else {
          let combinedMsg = existing.message;
          node.warnings.forEach(w => {
            if (!combinedMsg.includes(w)) {
              combinedMsg += ' | ' + w;
            }
          });
          issues.set(node.id, {
            type: existing.type,
            message: combinedMsg
          });
        }
      }
      if (node.errors && node.errors.length > 0) {
        const existing = issues.get(node.id);
        if (!existing) {
          issues.set(node.id, {
            type: 'error',
            message: node.errors.join(' | ')
          });
        } else {
          let combinedMsg = existing.message;
          node.errors.forEach(e => {
            if (!combinedMsg.includes(e)) {
              combinedMsg += ' | ' + e;
            }
          });
          issues.set(node.id, {
            type: 'error',
            message: combinedMsg
          });
        }
      }
    });

    return issues;
  }, [conflictingNodes, organizations]);

  const unifiedIssueGroups = useMemo(() => {
    const groups = {
      circle: { id: 'circle', label: 'ความสัมพันธ์เป็นวงกลม', items: [], color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
      missingParent: { id: 'missingParent', label: 'ไม่พบต้นสังกัด', items: [], color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
      multipleRoots: { id: 'multipleRoots', label: 'ถูกปรับยอด (มีหัวหน้าสูงสุดได้ 1 แห่ง)', items: [], color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
      noArea: { id: 'noArea', label: 'ไม่มีพื้นที่รับผิดชอบ (เป็นหน่วยงานลอย)', items: [], subGroups: {}, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
      invalidArea: { id: 'invalidArea', label: 'พื้นที่ไม่พบในระบบ', items: [], subGroups: {}, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
      duplicate: { id: 'duplicate', label: 'ชื่อหน่วยงานซ้ำกัน', items: [], color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
      others: { id: 'others', label: 'ขัดแย้งอื่นๆ', items: [], color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    };

    organizations.forEach(org => {
      const issue = nodeIssues.get(org.id);
      if (!issue) return;
      const msg = issue.message || '';

      if (msg.includes('วงกลม')) groups.circle.items.push(org);
      else if (msg.includes('ไม่พบต้นสังกัด')) groups.missingParent.items.push(org);
      else if (msg.includes('ถูกปรับให้อยู่ภายใต้') || msg.includes('ต้องการหน่วยงานสูงสุดเพียงแห่งเดียว')) groups.multipleRoots.items.push(org);
      else if (msg.includes('ชื่อหน่วยงานซ้ำกัน')) groups.duplicate.items.push(org);
      else if (msg.includes('ไม่พบข้อมูลพื้นที่รับผิดชอบ')) {
        groups.invalidArea.items.push(org);

        let locName = 'ไม่ระบุพื้นที่';
        const match = msg.match(/จะถูกข้ามไป(?: \("([^"]+)"\)|:\s*(.+))/);
        if (match) {
          locName = (match[1] || match[2] || '').trim();
        }

        if (!groups.invalidArea.subGroups[locName]) {
          groups.invalidArea.subGroups[locName] = [];
        }
        groups.invalidArea.subGroups[locName].push(org);
      }
      else if (msg.includes('ไม่มีพื้นที่รับผิดชอบ')) {
        groups.noArea.items.push(org);
        if (!groups.noArea.subGroups['ไม่มีพื้นที่รับผิดชอบ (ทั้งหมด)']) {
          groups.noArea.subGroups['ไม่มีพื้นที่รับผิดชอบ (ทั้งหมด)'] = [];
        }
        groups.noArea.subGroups['ไม่มีพื้นที่รับผิดชอบ (ทั้งหมด)'].push(org);
      }
      else groups.others.items.push(org);
    });

    return Object.values(groups);
  }, [organizations, nodeIssues]);

  const toggleIssueCategory = (categoryId, isEmpty) => {
    if (isEmpty) {
      setExpandedEmptyCategories(prev => {
        const next = new Set(prev);
        if (next.has(categoryId)) next.delete(categoryId);
        else next.add(categoryId);
        return next;
      });
    } else {
      setCollapsedCategories(prev => {
        const next = new Set(prev);
        if (next.has(categoryId)) next.delete(categoryId);
        else next.add(categoryId);
        return next;
      });
    }
  };

  const toggleSubGroup = (locName) => {
    setCollapsedSubGroups(prev => {
      const next = new Set(prev);
      if (next.has(locName)) next.delete(locName);
      else next.add(locName);
      return next;
    });
  };



  const handleAddNode = (parentId, currentLevel) => {
    const newNode = {
      id: `node-${Date.now()}`, name: '', level: currentLevel + 1, parentId: parentId, logo: null,
      areas: { locations: [] }
    };
    setOrganizations(orgs => recalculateAllLevels([...orgs, newNode]));
    setSelectedNodeId(newNode.id);
  };
  const handleUpdateBulkLocations = (nodeIds, locations) => {
    const isNationwide = locations.some(loc => loc.province === 'NATIONWIDE_SCOPE');
    const finalLocations = isNationwide ? [] : locations;
    const finalScope = isNationwide ? 'NATIONWIDE' : 'LOCAL';

    setOrganizations(orgs => {
      const updated = orgs.map(org => {
        if (nodeIds.includes(org.id)) {
          return {
            ...org,
            areas: {
              ...org.areas,
              scope: finalScope,
              locations: finalLocations
            }
          };
        }
        return org;
      });
      return recalculateAllLevels(updated);
    });
  };


  const handleUpdateNode = (id, field, value) => {
    setOrganizations(orgs => {
      let nextOrgs = [...orgs];
      if (field === 'parentId') {
        const targetNode = orgs.find(org => org.id === id);
        if (targetNode && moveMode === 'single') {
          const oldParentId = targetNode.parentId;
          nextOrgs = nextOrgs.map(org => {
            if (org.parentId === id) {
              return { ...org, parentId: oldParentId };
            }
            return org;
          });
        }
      }
      const updated = nextOrgs.map(org => org.id === id ? { ...org, [field]: value } : org);
      return recalculateAllLevels(updated);
    });
  };

  const handleDeleteNodeBranch = (id) => {
    const idsToDelete = new Set([id]);
    let currentSize = 0;
    while (idsToDelete.size > currentSize) {
      currentSize = idsToDelete.size;
      organizations.forEach(org => { if (idsToDelete.has(org.parentId)) idsToDelete.add(org.id); });
    }
    setOrganizations(orgs => recalculateAllLevels(orgs.filter(org => !idsToDelete.has(org.id))));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleDeleteNodeOnly = (id) => {
    const targetNode = organizations.find(org => org.id === id);
    if (!targetNode) return;
    const parentIdOfDeleted = targetNode.parentId;
    const directChildren = organizations.filter(org => org.parentId === id);

    setOrganizations(orgs => {
      let nextOrgs = orgs.filter(org => org.id !== id);

      if (!parentIdOfDeleted) {
        // Root deletion with promote: designate first child as new primary root
        if (directChildren.length > 0) {
          const newRootId = directChildren[0].id;
          nextOrgs = nextOrgs.map(org => {
            if (org.id === newRootId) {
              return { ...org, parentId: null };
            }
            if (org.parentId === id) {
              return { ...org, parentId: newRootId };
            }
            return org;
          });
        }
      } else {
        // Promote children to parent
        nextOrgs = nextOrgs.map(org => {
          if (org.parentId === id) {
            return { ...org, parentId: parentIdOfDeleted };
          }
          return org;
        });
      }

      return recalculateAllLevels(nextOrgs);
    });

    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleDeleteNode = (id) => {
    const targetNode = organizations.find(org => org.id === id);
    if (!targetNode) return;

    const childrenCount = organizations.filter(org => org.parentId === id).length;
    if (childrenCount > 0) {
      setDeleteConfirmNode(targetNode);
    } else {
      handleDeleteNodeBranch(id);
    }
  };

  const mockBulkSimilaritySearch = async (orgs) => {
    setIsCheckingDuplicates(true);
    setCheckProgress({ current: 0, total: orgs.length });
    
    const mockConflicts = [];
    const chunkSize = 1000;
    
    // Simulate chunk processing
    for (let i = 0; i < orgs.length; i += chunkSize) {
      const chunk = orgs.slice(i, i + chunkSize);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Randomly inject some mock conflicts for demonstration
      chunk.forEach((org, idx) => {
        // Just inject a few to demonstrate UI
        if (Math.random() > 0.95 && mockConflicts.length < 3) {
          mockConflicts.push({
            temp_id: org.id,
            org_name: org.name,
            matches: [
              { db_id: 1000 + idx, db_name: `${org.name} (ในระบบ)`, score: 0.85 },
              { db_id: 2000 + idx, db_name: `${org.name}เก่า`, score: 0.72 }
            ]
          });
        }
      });
      
      setCheckProgress({ current: Math.min(i + chunkSize, orgs.length), total: orgs.length });
    }
    
    setIsCheckingDuplicates(false);
    
    if (mockConflicts.length > 0) {
      setConflicts(mockConflicts);
      setUserResolutions({});
      setIsConflictModalOpen(true);
    } else {
      executeFinalExport(orgs);
    }
  };

  const executeFinalExport = (currentOrgs = organizations) => {
    try {
      const payload = generateBackendPayload(currentOrgs);
      
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backend_payload_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePrepareExport = () => {
    try {
      // Validate for circular references before calling API
      topologicalSort(organizations); 
      mockBulkSimilaritySearch(organizations);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResolveConflict = (temp_id, resolution) => {
    setUserResolutions(prev => ({
      ...prev,
      [temp_id]: resolution
    }));
  };

  const handleConfirmResolutions = () => {
    const updatedOrgs = organizations.map(org => {
      const res = userResolutions[org.id];
      if (res) {
        return {
          ...org,
          action: res.action,
          existing_db_id: res.existing_db_id || null
        };
      }
      return org;
    });

    setIsConflictModalOpen(false);
    executeFinalExport(updatedOrgs);
  };

  const handleExportCSV = () => {
    const headers = ['org_name', 'parent_name', 'level', 'coverage_scope', 'province', 'amphoe', 'tambon', 'postal_code', 'area_code', 'path'];
    const rows = [];

    organizations.forEach(org => {
      const parentOrg = organizations.find(o => o.id === org.parentId);
      const parentName = parentOrg ? parentOrg.name : '';
      const locations = getSelectedLocations(org.areas);
      const pathValue = getOrgPath(org.id, organizations);
      const scopeValue = org.areas?.scope === 'NATIONWIDE' ? 'ทั่วประเทศ' : 'เฉพาะพื้นที่';

      if (locations.length === 0) {
        rows.push([
          org.name || '',
          parentName,
          org.level,
          scopeValue,
          '',
          '',
          '',
          '',
          '',
          pathValue
        ]);
      } else {
        locations.forEach(loc => {
          rows.push([
            org.name || '',
            parentName,
            org.level,
            scopeValue,
            loc.province || '',
            loc.amphoe || '',
            loc.tambon || '',
            loc.postalCode || '',
            loc.code || '',
            pathValue
          ]);
        });
      }
    });

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `organizations_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const data = [];
    organizations.forEach(org => {
      const parentOrg = organizations.find(o => o.id === org.parentId);
      const parentName = parentOrg ? parentOrg.name : '';
      const locations = getSelectedLocations(org.areas);
      const pathValue = getOrgPath(org.id, organizations);
      const scopeValue = org.areas?.scope === 'NATIONWIDE' ? 'ทั่วประเทศ' : 'เฉพาะพื้นที่';

      if (locations.length === 0) {
        data.push({
          'org_name': org.name || '',
          'parent_name': parentName,
          'level': org.level,
          'coverage_scope': scopeValue,
          'province': '',
          'amphoe': '',
          'tambon': '',
          'postal_code': '',
          'area_code': '',
          'path': pathValue
        });
      } else {
        locations.forEach(loc => {
          data.push({
            'org_name': org.name || '',
            'parent_name': parentName,
            'level': org.level,
            'coverage_scope': scopeValue,
            'province': loc.province || '',
            'amphoe': loc.amphoe || '',
            'tambon': loc.tambon || '',
            'postal_code': loc.postalCode || '',
            'area_code': loc.code || '',
            'path': pathValue
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Organizations');
    XLSX.writeFile(workbook, `organizations_${Date.now()}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const headers = [['org_name', 'parent_name', 'province', 'amphoe', 'tambon', 'postal_code']];
    const sampleRows = [
      ['กรุงเทพมหานคร', '', 'กรุงเทพมหานคร', '', '', ''],
      ['เขตปทุมวัน', 'กรุงเทพมหานคร', 'กรุงเทพมหานคร', 'เขตปทุมวัน', '', ''],
      ['แขวงปทุมวัน', 'เขตปทุมวัน', 'กรุงเทพมหานคร', 'เขตปทุมวัน', 'แขวงปทุมวัน', '10330'],
      ['กรมชลประทาน', '', '', '', '', ''],
      ['ศูนย์ปฏิบัติการน้ำ', 'กรมชลประทาน', 'ชลบุรี', '', '', ''],
      ['ศูนย์ปฏิบัติการน้ำ', 'กรมชลประทาน', 'ระยอง', '', '', '']
    ];
    const data = [...headers, ...sampleRows];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, `org_template.xlsx`);
  };

  const handleFileImport = (newOrgs) => {
    if (newOrgs && newOrgs.length > 0) {
      setOrganizations(recalculateAllLevels(newOrgs));
      setSelectedNodeId(newOrgs[0].id);
      // setIsImportModalOpen(false); -> removed so user can see the confirm button
    } else {
      alert("ไม่พบข้อมูลหน่วยงานที่ถูกต้องในไฟล์");
    }
  };

  const renderTableView = () => {
    const toggleTableCollapse = (id, e) => {
      e.stopPropagation();
      setCollapsedTableNodes(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    // Flatten orgTree to preserve hierarchical order
    const flattenTree = (nodes) => {
      let result = [];
      nodes.forEach(node => {
        result.push(node);
        if (node.children && node.children.length > 0) {
          result = result.concat(flattenTree(node.children));
        }
      });
      return result;
    };

    const sortedOrgs = flattenTree(orgTree);

    // Add any remaining nodes (if any)
    const sortedIds = new Set(sortedOrgs.map(o => o.id));
    const missingOrgs = organizations.filter(o => !sortedIds.has(o.id));
    const finalOrgs = [...sortedOrgs, ...missingOrgs];

    const isNodeVisible = (org) => {
      let curr = org.parentId;
      while (curr) {
        if (collapsedTableNodes.has(curr)) return false;
        const p = organizations.find(o => o.id === curr);
        curr = p ? p.parentId : null;
      }
      return true;
    };

    const isSearching = !!searchQuery.trim();

    const filteredOrgs = finalOrgs.filter(org => {
      if (isSearching) {
        return org.name && org.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return isNodeVisible(org);
    });

    return (
      <div className={`flex-1 flex flex-col h-full overflow-hidden p-6 ${selectedNode && !isFullscreen ? 'pr-[390px]' : ''} transition-all duration-300`}>
        {/* Table Title and Stats */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Table className="text-blue-600" size={20} />
              รายการหน่วยงานทั้งหมด ({filteredOrgs.length} รายการ)
            </h2>
            <p className="text-xs text-slate-500 mt-1">คลิกเลือกแถวเพื่อตั้งค่าข้อมูลพื้นที่ สังกัด และโลโก้ในแผงตั้งค่าด้านขวา</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setCollapsedTableNodes(new Set())}
                className="px-3 py-1.5 hover:bg-white hover:shadow-sm text-slate-700 rounded-lg text-xs font-bold transition-all"
                title="แสดงทุกหน่วยงาน"
              >
                ขยายทั้งหมด
              </button>
              <button
                onClick={() => {
                  const parentIds = new Set(organizations.map(o => o.parentId).filter(Boolean));
                  setCollapsedTableNodes(parentIds);
                }}
                className="px-3 py-1.5 hover:bg-white hover:shadow-sm text-slate-700 rounded-lg text-xs font-bold transition-all"
                title="ซ่อนหน่วยงานย่อยทั้งหมด"
              >
                ย่อทั้งหมด
              </button>
            </div>

            {/* Quick Table Search */}
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาหน่วยงานในตาราง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-blue-500 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5 w-24 text-center">ระดับ</th>
                <th className="px-6 py-3.5">ชื่อหน่วยงาน</th>
                <th className="px-6 py-3.5 w-32 text-center">หน่วยงานย่อย</th>
                <th className="px-6 py-3.5 w-32 text-center">พื้นที่รับผิดชอบ</th>
                <th className="px-4 py-3.5 min-w-[180px] text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-550 font-medium">
                    ไม่พบข้อมูลหน่วยงานในตาราง
                  </td>
                </tr>
              ) : (
                filteredOrgs.map(org => {
                  const isSelected = selectedNodeId === org.id;
                  const areaCount = getAreaCount(org.areas);
                  const issue = nodeIssues?.get(org.id);
                  const hasError = issue?.type === 'error';
                  const hasWarning = issue?.type === 'warning';

                  // Row style
                  let rowStyle = "hover:bg-slate-50 transition-colors cursor-pointer";
                  if (isSelected) {
                    rowStyle = "bg-blue-50/70 hover:bg-blue-50/90 transition-colors cursor-pointer ring-2 ring-blue-500/10";
                  } else if (hasError) {
                    rowStyle = "bg-red-50/40 hover:bg-red-50/60 transition-colors cursor-pointer";
                  } else if (hasWarning) {
                    rowStyle = "bg-amber-50/40 hover:bg-amber-50/60 transition-colors cursor-pointer";
                  }

                  const childCount = org.children ? org.children.length : 0;

                  let levelColorClass = "bg-slate-100 text-slate-700 border-slate-200";
                  if (org.level === 1) levelColorClass = "bg-purple-100 text-purple-800 border-purple-200";
                  else if (org.level === 2) levelColorClass = "bg-blue-100 text-blue-800 border-blue-200";
                  else if (org.level === 3) levelColorClass = "bg-teal-100 text-teal-800 border-teal-200";
                  else if (org.level === 4) levelColorClass = "bg-amber-100 text-amber-800 border-amber-200";
                  else if (org.level >= 5) levelColorClass = "bg-rose-100 text-rose-800 border-rose-200";

                  return (
                    <tr
                      key={org.id}
                      className={rowStyle}
                      onClick={() => setSelectedNodeId(org.id)}
                    >
                      {/* Level */}
                      <td className="px-4 py-3 text-center">
                        <span className={`${levelColorClass} px-2 py-0.5 rounded font-mono text-[11px] font-bold border`}>
                          ระดับ {org.level}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3 font-bold text-slate-800" style={{ paddingLeft: `${Math.max(24, 24 + (org.level - 1) * 20)}px`, paddingRight: '24px' }}>
                        <div className="flex items-center gap-2">
                          {org.level > 1 && (
                            <div className="w-3 h-3 border-b-2 border-l-2 border-slate-300 rounded-bl-sm opacity-60 shrink-0 relative -top-1" />
                          )}
                          {org.children && org.children.length > 0 && (
                            <button
                              onClick={(e) => toggleTableCollapse(org.id, e)}
                              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded focus:ring-2 focus:ring-blue-500/20"
                              aria-label={collapsedTableNodes.has(org.id) ? "ขยายหน่วยงานย่อย" : "พับหน่วยงานย่อย"}
                            >
                              {collapsedTableNodes.has(org.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                          <span className="whitespace-normal break-words max-w-[500px]" title={org.name}>
                            {org.name || <span className="text-slate-500 italic font-normal">ไม่ได้ระบุชื่อ</span>}
                          </span>
                          {issue && (
                            <div
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${hasError
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              title={issue.message}
                            >
                              <AlertTriangle size={10} className="animate-pulse" />
                              <span className="truncate max-w-[150px]">{issue.message}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Children Count */}
                      <td className="px-6 py-3 text-center">
                        {childCount > 0 ? (
                          <span className="text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[11px] font-bold">
                            {childCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Areas */}
                      <td className="px-6 py-3 text-center">
                        {areaCount > 0 ? (
                          <span className="text-blue-700 bg-blue-50/70 border border-blue-100 px-2 py-1 rounded text-[11px] font-bold" title={formatAreaLabel(org.areas)}>
                            {areaCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedNodeId(org.id);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                            title="ตั้งค่าและแก้ไขขอบเขตพื้นที่"
                            aria-label={`แก้ไข ${org.name}`}
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={() => handleAddNode(org.id, org.level)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-700 hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                            title="เพิ่มหน่วยงานลูก"
                            aria-label={`เพิ่มลูกให้ ${org.name}`}
                          >
                            เพิ่มลูก
                          </button>
                          <button
                            onClick={() => handleDeleteNode(org.id)}
                            className="px-2 py-1 bg-red-50 hover:bg-red-600 border border-red-200 text-red-700 hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                            title="ลบหน่วยงานนี้"
                            aria-label={`ลบ ${org.name}`}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleCleanAllData = () => {
    setOrganizations(prevOrgs => {
      const cleaned = prevOrgs.map(org => ({
        ...org,
        name: sanitizeString(org.name)
      }));
      return recalculateAllLevels(cleaned);
    });
    alert('ล้างชื่อหน่วยงาน ปรับการสะกดคำ และแปลงคำย่อทั้งหมดเรียบร้อยแล้ว!');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 flex flex-col h-screen overflow-hidden">
      <Toaster position="bottom-right" />

      {/* Header */}
      <header className="flex items-center justify-between shrink-0 mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Network className="text-blue-600" />
            Visual Org Builder
            <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Enterprise + JSON</span>
          </h1>
        </div>
        <div className="flex gap-3 relative">
          {/* View Mode Toggle Group */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner mr-1">
            <button
              onClick={() => setViewMode('canvas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'canvas'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              aria-label="เปลี่ยนเป็นมุมมองผังโครงสร้าง"
              aria-pressed={viewMode === 'canvas'}
            >
              <Network size={14} />
              ผังโครงสร้าง
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              aria-label="เปลี่ยนเป็นมุมมองตาราง"
              aria-pressed={viewMode === 'table'}
            >
              <Table size={14} />
              ตารางข้อมูล
            </button>
          </div>

          <div className="w-px h-8 bg-slate-200 mx-1 self-center"></div>

          {/* Data Management Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDataMenuOpen(!isDataMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-100 text-slate-700 transition-all shadow-sm cursor-pointer"
              aria-haspopup="true"
              aria-expanded={isDataMenuOpen}
              aria-label="เมนูจัดการข้อมูล"
            >
              <Database size={16} /> จัดการข้อมูล <ChevronDown size={14} />
            </button>

            {/* Backdrop to close dropdown */}
            {isDataMenuOpen && (
              <div
                className="fixed inset-0 z-[90]"
                onClick={() => setIsDataMenuOpen(false)}
                aria-hidden="true"
              />
            )}

            {isDataMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => { setIsImportModalOpen(true); setIsDataMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors border-b border-slate-100 text-left"
                >
                  <FileSpreadsheet size={14} className="text-green-600" /> นำเข้าข้อมูล (Import)
                </button>
                <button
                  onClick={() => { handleExportExcel(); setIsDataMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors text-left"
                >
                  <Download size={14} className="text-emerald-600" /> ส่งออกเป็น Excel
                </button>
                <button
                  onClick={() => { handleExportCSV(); setIsDataMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors border-b border-slate-100 text-left"
                >
                  <Download size={14} className="text-amber-600" /> ส่งออกเป็น CSV
                </button>
                <button
                  onClick={() => { handleSaveDraft(); setIsDataMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors border-b border-slate-100 text-left"
                >
                  <CheckCircle size={14} className="text-blue-600" /> บันทึกแบบร่าง (Save Draft)
                </button>
                <button
                  onClick={() => { handleCleanAllData(); setIsDataMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-bold transition-colors text-left"
                >
                  <AlertTriangle size={14} className="text-red-500" /> คลีนข้อมูลทั้งหมด
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowWelcomeModal(true)}
            className="flex items-center justify-center w-9 h-9 bg-slate-50 border border-slate-200 rounded-full hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-slate-500 transition-all shadow-sm cursor-pointer ml-1"
            title="คู่มือใช้งาน"
            aria-label="คู่มือใช้งาน"
          >
            <HelpCircle size={18} />
          </button>

          <div className="w-px h-8 bg-slate-200 mx-1 self-center"></div>

          <button
            onClick={handlePrepareExport}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold shadow-lg transition-all duration-300 cursor-pointer ${isCheckingDuplicates
                ? 'bg-indigo-400 text-white cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
              }`}
            aria-label="ส่งออกข้อมูลให้ Backend"
            disabled={isCheckingDuplicates}
          >
            {isCheckingDuplicates ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Checking...</>
            ) : (
              <><Download size={16} /> ส่งออกให้ Backend (JSON)</>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace (Horizontal Split) */}
      <div className="flex-1 flex gap-4 overflow-hidden relative">

        {/* Left Issue Sidebar */}
        {viewMode === 'canvas' && (
          <div className={`transition-all duration-300 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden shrink-0 ${isIssueSidebarOpen ? 'w-[340px] opacity-100' : 'w-0 opacity-0 border-none'}`}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50 cursor-pointer select-none shrink-0" onClick={() => setIsIssueSidebarOpen(false)}>
              <div className={`flex items-center gap-2 font-bold text-sm uppercase tracking-wider ${unifiedIssueGroups.reduce((acc, g) => acc + g.items.length, 0) === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {unifiedIssueGroups.reduce((acc, g) => acc + g.items.length, 0) === 0 ? (
                  <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 animate-pulse" />
                )}
                <span>การแจ้งเตือน ({unifiedIssueGroups.reduce((acc, g) => acc + g.items.length, 0).toLocaleString()} แห่ง)</span>
              </div>
              <button className="text-slate-400 hover:text-slate-650 transition-colors p-1 bg-white rounded-md border border-slate-200 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              <div className="text-xs text-slate-600 font-semibold leading-relaxed p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                ⚠️ รายชื่อหน่วยงานด้านล่างเกิดความสัมพันธ์ขัดแย้งหรือมีข้อสังเกตที่ควรตรวจสอบ คุณสามารถกด "แก้ไข" เพื่อไปจัดการได้ทันที
              </div>
              {unifiedIssueGroups.map(group => {
                const isEmpty = group.items.length === 0;
                const isExpanded = isEmpty ? expandedEmptyCategories.has(group.id) : !collapsedCategories.has(group.id);
                const groupBorder = isEmpty ? 'border-emerald-200' : group.border;
                const groupBg = isEmpty ? 'bg-emerald-50' : group.bg;
                const groupColor = isEmpty ? 'text-emerald-700' : group.color;

                return (
                  <div key={group.id} className={`border ${groupBorder} ${groupBg} rounded-xl overflow-hidden shadow-sm`}>
                    <div
                      className="w-full p-3 flex justify-between items-center text-left bg-white/60 border-b border-black/5 cursor-pointer hover:bg-black/5 transition-colors"
                      onClick={() => toggleIssueCategory(group.id, isEmpty)}
                    >
                      <span className={`text-sm font-bold ${groupColor}`}>
                        {group.label} ({group.items.length.toLocaleString()})
                      </span>
                      {isExpanded ? <ChevronUp size={16} className={groupColor} /> : <ChevronDown size={16} className={groupColor} />}
                    </div>

                    {isExpanded && (
                      <div className="p-3 space-y-3 bg-white">
                        {isEmpty ? (
                          <div className="text-center p-4 text-xs font-bold text-emerald-600 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col items-center gap-2">
                            <CheckCircle size={24} className="text-emerald-500" />
                            ยอดเยี่ยม! ไม่พบปัญหาในหมวดหมู่นี้
                          </div>
                        ) : group.subGroups && Object.keys(group.subGroups).length > 0 ? (
                          Object.entries(group.subGroups).map(([locName, nodes]) => {
                            const isSubCollapsed = collapsedSubGroups.has(locName);
                            return (
                              <div key={locName} className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
                                <div
                                  className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-200 transition-colors"
                                  onClick={() => toggleSubGroup(locName)}
                                >
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                                    {isSubCollapsed ? <ChevronRight size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
                                    <MapPin size={14} className="text-red-500 shrink-0" />
                                    <span className="truncate">พื้นที่: {locName} ({nodes.length})</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBulkEditGroup({ locName, nodes });
                                    }}
                                    className="shrink-0 px-2.5 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
                                  >
                                    แก้ไขทั้งหมด
                                  </button>
                                </div>
                                {!isSubCollapsed && (
                                  <div className="p-2 space-y-2 bg-slate-50/50">
                                    {nodes.map(node => (
                                      <div key={node.id} className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 flex flex-col gap-1.5 transition-all shadow-sm">
                                        <div className="flex justify-between items-start gap-2">
                                          <span className="font-bold text-xs text-slate-800 break-words">{node.name || <span className="italic text-slate-500">ไม่ระบุชื่อ</span>}</span>
                                          <button
                                            onClick={() => {
                                              setSelectedNodeId(node.id);
                                              setFocusNodeId(node.parentId || node.id);
                                              setSearchedNodeId(node.id);
                                            }}
                                            className="px-2 py-1 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-md text-[10px] font-bold shadow-sm cursor-pointer shrink-0"
                                          >
                                            แก้ไข
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="space-y-2">
                            {group.items.map(node => (
                              <div
                                key={node.id}
                                className={`p-3 rounded-lg border ${group.id === 'circle' || group.id === 'missingParent' ? 'border-red-200 bg-red-50 hover:bg-red-100' : 'border-amber-200 bg-amber-50 hover:bg-amber-100'} transition-all flex flex-col gap-2 shadow-sm`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <span className="font-bold text-xs text-slate-800 break-words">{node.name || <span className="italic text-slate-500">ไม่ระบุชื่อ</span>}</span>
                                  <div className="flex gap-1.5 shrink-0">
                                    <button
                                      onClick={() => {
                                        setSelectedNodeId(node.id);
                                        setFocusNodeId(node.parentId || node.id);
                                        setSearchedNodeId(node.id);
                                      }}
                                      className={`px-2 py-1 bg-white border ${group.id === 'circle' || group.id === 'missingParent' ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-amber-300 text-amber-700 hover:bg-amber-50'} rounded-md text-[10px] font-bold shadow-sm cursor-pointer`}
                                    >
                                      แก้ไข
                                    </button>
                                    {(group.id === 'circle' || group.id === 'missingParent') && (
                                      <button
                                        onClick={() => handleUpdateNode(node.id, 'parentId', null)}
                                        className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 rounded-md text-[10px] font-bold shadow-sm transition-colors cursor-pointer"
                                        title="ตั้งเป็นหน่วยงานสูงสุดทันทีเพื่อดึงกลับเข้าผังหลัก"
                                      >
                                        ตั้งสูงสุด
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className={`text-[10px] font-bold ${group.id === 'circle' || group.id === 'missingParent' ? 'text-red-700 bg-red-100/60' : 'text-amber-700 bg-amber-100/60'} p-2 rounded-md flex items-center gap-1.5 leading-normal`}>
                                  <AlertTriangle size={12} className="shrink-0" />
                                  <span>{nodeIssues.get(node.id)?.message || ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TOP: Visual Mind Map Canvas (Combined with Floating Config Panel) */}
        <div className={`flex-1 bg-[#f8fafc] border border-slate-200 shadow-inner overflow-hidden flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none w-full h-full' : 'relative rounded-2xl'}`} style={viewMode === 'canvas' ? { backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' } : {}}>

          {/* Toggle Sidebar Button (Floating on Canvas) */}
          {viewMode === 'canvas' && !isIssueSidebarOpen && (
            <button
              onClick={() => setIsIssueSidebarOpen(true)}
              className={`absolute left-6 bottom-6 z-40 p-3.5 bg-white border rounded-full shadow-xl hover:scale-105 transition-all group pointer-events-auto ${unifiedIssueGroups.reduce((acc, g) => acc + g.items.length, 0) === 0 ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}
              title="เปิดแถบแจ้งเตือน"
            >
              {unifiedIssueGroups.reduce((acc, g) => acc + g.items.length, 0) === 0 ? (
                <CheckCircle size={24} className="text-emerald-500" />
              ) : (
                <AlertTriangle size={24} className="animate-pulse" />
              )}
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity shadow-lg">
                เปิดแถบแจ้งเตือน ({unifiedIssueGroups.reduce((acc, g) => acc + g.items.length, 0).toLocaleString()} แห่ง)
                <div className="absolute top-1/2 -left-1 -mt-1 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>
            </button>
          )}

          {/* Floating Config Panel */}
          {!isFullscreen && selectedNode && (
            <div className="absolute top-4 right-4 bottom-4 w-[360px] z-40">
              <ConfigPanel
                selectedNode={selectedNode}
                handleUpdateNode={handleUpdateNode}
                onClose={() => setSelectedNodeId(null)}
                organizations={organizations}
                nodeIssues={nodeIssues}
                moveMode={moveMode}
                setMoveMode={setMoveMode}
                locationDb={locationDb}
                setFocusNodeId={setFocusNodeId}
                setSearchedNodeId={setSearchedNodeId}
                handleDeleteNode={handleDeleteNode}
              />
            </div>
          )}

          {viewMode === 'canvas' ? (
            <div className={`flex-1 overflow-hidden relative`} >
              {orgTree.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                  <button onClick={(e) => { e.stopPropagation(); handleAddNode(null, 0); }} className="px-6 py-3 bg-white border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 flex items-center gap-2 font-medium transition-colors shadow-sm">
                    <Plus size={18} /> เริ่มสร้างหน่วยงานสูงสุด
                  </button>
                </div>
              ) : (
                <>
                  {/* Top Left Navigation & Search Group */}
                  <div className="absolute top-4 left-4 z-40 flex flex-col gap-3 max-w-[calc(100vw-450px)]">

                    {/* Breadcrumb Navigation */}
                    <div className="bg-white/90 backdrop-blur border border-slate-200 shadow-sm rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 text-sm font-medium">
                      {orgTree.length > 1 && (
                        <button
                          onClick={() => { setFocusNodeId(null); setSelectedNodeId(null); }}
                          className={`hover:text-blue-600 transition-colors ${!focusNodeId ? 'text-blue-700 font-bold' : 'text-slate-500'}`}
                        >
                          หน้าหลัก
                        </button>
                      )}
                      {breadcrumbPath.map((node, index) => (
                        <React.Fragment key={node.id}>
                          {(orgTree.length > 1 || index > 0) && (
                            <ChevronRight size={14} className="text-slate-400" />
                          )}
                          <button
                            onClick={() => { setFocusNodeId(node.id); setSelectedNodeId(null); }}
                            className={`hover:text-blue-600 transition-colors truncate max-w-[150px] ${index === breadcrumbPath.length - 1 ? 'text-blue-700 font-bold' : 'text-slate-500'}`}
                            title={node.name}
                          >
                            {node.name || 'ไม่ได้ระบุชื่อ'}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Search Bar */}
                    <div className="flex gap-2 items-center">
                      <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl flex items-center px-3 py-1.5 gap-2 w-64 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm">
                        <Search size={14} className="text-slate-500 shrink-0" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSearchSuggestions(true);
                          }}
                          onFocus={() => setShowSearchSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                          placeholder="ค้นหาชื่อหน่วยงาน..."
                          className="w-full text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 bg-transparent"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            aria-label="ล้างข้อความค้นหา"
                            title="ล้างข้อความค้นหา"
                            className="text-slate-400 hover:text-slate-600 shrink-0"
                          >
                            <X size={14} />
                          </button>
                        )}
                        {showSearchSuggestions && searchResults.length > 0 && (
                          <ul className="absolute left-0 top-[110%] right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {searchResults.map(node => (
                              <li
                                key={node.id}
                                onMouseDown={() => {
                                  setSelectedNodeId(node.id);
                                  setSearchQuery('');
                                  setShowSearchSuggestions(false);
                                  // Update focus node to the parent so it appears in the tree context
                                  setFocusNodeId(node.parentId || node.id);
                                  setSearchedNodeId(node.id);
                                  setTimeout(() => {
                                    const el = document.getElementById(node.id);
                                    if (el) {
                                      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                      el.classList.add('animate-pulse-highlight');
                                      setTimeout(() => el.classList.remove('animate-pulse-highlight'), 1500);
                                    }
                                  }, 100);
                                }}
                                className="px-3 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors flex justify-between items-center"
                              >
                                <span className="whitespace-normal break-words pr-2">{node.name}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">Level {node.level}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-xs font-bold text-slate-700 flex items-center gap-2">
                        <Layers size={14} className="text-blue-600" /> รวม: {organizations.length} โหนด
                      </div>
                    </div>

                  </div>

                  <ReactFlowOrgChart
                    orgTree={orgTree}
                    organizations={organizations}
                    focusNodeId={focusNodeId}
                    setFocusNodeId={setFocusNodeId}
                    selectedNodeId={selectedNodeId}
                    setSelectedNodeId={setSelectedNodeId}
                    searchedNodeId={searchedNodeId}
                    setSearchedNodeId={setSearchedNodeId}
                    handleAddNode={handleAddNode}
                    handleDeleteNode={handleDeleteNode}
                    nodeIssues={nodeIssues}
                  />
                </>
              )}
            </div>
          ) : (
            renderTableView()
          )}
        </div>


      </div>

      {/* Import Modal for Excel/CSV */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportData={handleFileImport}
        onCancelImport={() => {
          setOrganizations([]);
        }}
        onDownloadTemplate={handleDownloadTemplate}
        locationDb={locationDb}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmNode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 rounded-xl text-red-750">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-md font-bold text-slate-800">ยืนยันการลบหน่วยงาน</h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{deleteConfirmNode.name || 'ไม่ระบุชื่อ'}</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteConfirmNode(null)}
                className="text-slate-500 hover:text-slate-700"
                aria-label="ปิดกล่องลบหน่วยงาน"
                title="ปิดกล่องลบหน่วยงาน"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {(() => {
                const directChildren = organizations.filter(org => org.parentId === deleteConfirmNode.id);
                const childrenCount = directChildren.length;

                const getDescendantCount = (id) => {
                  let count = 0;
                  const queue = [id];
                  const visited = new Set();

                  // O(N) pre-compute to avoid O(N^2) traversal
                  const childrenMap = new Map();
                  organizations.forEach(org => {
                    if (org.parentId) {
                      if (!childrenMap.has(org.parentId)) childrenMap.set(org.parentId, []);
                      childrenMap.get(org.parentId).push(org.id);
                    }
                  });

                  while (queue.length > 0) {
                    const curr = queue.shift();
                    const children = childrenMap.get(curr) || [];
                    children.forEach(childId => {
                      if (!visited.has(childId)) {
                        visited.add(childId);
                        queue.push(childId);
                        count++;
                      }
                    });
                  }
                  return count;
                };
                const totalDescendants = getDescendantCount(deleteConfirmNode.id);

                const parentNode = organizations.find(org => org.id === deleteConfirmNode.parentId);
                const parentName = parentNode ? parentNode.name : 'หน่วยงานสูงสุด';

                return (
                  <>
                    <p className="text-xs text-slate-650 leading-relaxed font-semibold">
                      หน่วยงานนี้มีหน่วยงานย่อยภายใต้สังกัด
                      <span className="text-red-700 font-bold"> {childrenCount} แห่ง</span>
                      (รวมลูกหลานทั้งหมด <span className="text-red-700 font-bold">{totalDescendants} แห่ง</span>)
                      โปรดเลือกรูปแบบการลบ:
                    </p>

                    <div className="space-y-3 pt-2">
                      <button
                        onClick={() => {
                          handleDeleteNodeOnly(deleteConfirmNode.id);
                          setDeleteConfirmNode(null);
                        }}
                        className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/20 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-700">ลบเฉพาะหน่วยงานนี้</h4>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold group-hover:bg-blue-100 group-hover:text-blue-700">ฝากลูกน้องไว้</span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-semibold mt-1.5 leading-relaxed">
                          ลบเฉพาะหน่วยงานนี้ และย้ายหน่วยงานย่อยทั้งหมดไปขึ้นตรงกับ <span className="font-bold text-slate-800">"{parentName}"</span> แทน
                        </p>
                      </button>

                      <button
                        onClick={() => {
                          handleDeleteNodeBranch(deleteConfirmNode.id);
                          setDeleteConfirmNode(null);
                        }}
                        className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-red-500 bg-white hover:bg-red-50/20 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-red-700">ลบหน่วยงานทั้งเส้น</h4>
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">ลบทั้งหมด</span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-semibold mt-1.5 leading-relaxed">
                          ลบหน่วยงานนี้และหน่วยงานย่อยทั้งหมดภายใต้สังกัด ({totalDescendants} หน่วยงาน) ออกจากระบบถาวร
                        </p>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmNode(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkEditGroup && (
        <BulkEditLocationModal
          isOpen={true}
          onClose={() => setBulkEditGroup(null)}
          locationName={bulkEditGroup.locName}
          orgs={bulkEditGroup.nodes}
          locationDb={locationDb}
          handleUpdateBulkLocations={handleUpdateBulkLocations}
        />
      )}

      {/* Progress Modal */}
      {isCheckingDuplicates && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] p-6 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">กำลังตรวจสอบรายชื่อซ้ำซ้อน</h3>
            <p className="text-sm text-slate-500 mb-6">ระบบกำลังตรวจสอบความถูกต้องกับฐานข้อมูลหลัก...</p>
            
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-300" 
                style={{ width: `${checkProgress.total ? (checkProgress.current / checkProgress.total) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {checkProgress.current} / {checkProgress.total} หน่วยงาน
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {isConflictModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[800px] max-w-full max-h-[90vh] flex flex-col animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-800">พบชื่อหน่วยงานคล้ายคลึงกับในระบบ</h3>
                  <p className="text-sm text-amber-600">กรุณาเลือกว่าจะผูกกับของเดิม (LINK) หรือสร้างใหม่ (CREATE)</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="flex flex-col gap-4">
                {conflicts.map((conflict) => (
                  <div key={conflict.temp_id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-400 mb-1">หน่วยงานที่กำลังสร้าง (ใหม่)</div>
                        <div className="font-bold text-slate-800 text-base">{conflict.org_name}</div>
                      </div>
                      
                      <div className="flex-1 w-full bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="text-xs font-semibold text-slate-400 mb-2">หน่วยงานที่คล้ายกันในระบบ (พบ {conflict.matches.length} รายการ)</div>
                        <div className="flex flex-col gap-2">
                          {conflict.matches.map(match => (
                            <label key={match.db_id} className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${userResolutions[conflict.temp_id]?.existing_db_id === match.db_id ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                              <input 
                                type="radio" 
                                name={`conflict_${conflict.temp_id}`} 
                                checked={userResolutions[conflict.temp_id]?.existing_db_id === match.db_id}
                                onChange={() => handleResolveConflict(conflict.temp_id, { action: "LINK", existing_db_id: match.db_id })}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-bold text-slate-700">{match.db_name}</div>
                                <div className="text-xs text-slate-500">ความเหมือน: {Math.round(match.score * 100)}% | ID: {match.db_id}</div>
                              </div>
                            </label>
                          ))}
                          <label className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${userResolutions[conflict.temp_id]?.action === "CREATE" ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 hover:border-amber-300'}`}>
                            <input 
                              type="radio" 
                              name={`conflict_${conflict.temp_id}`} 
                              checked={userResolutions[conflict.temp_id]?.action === "CREATE"}
                              onChange={() => handleResolveConflict(conflict.temp_id, { action: "CREATE", existing_db_id: null })}
                              className="text-amber-600 focus:ring-amber-500"
                            />
                            <div className="text-sm font-bold text-amber-700">ยืนยันสร้างใหม่ (มองข้ามรายการข้างต้น)</div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-2xl">
              <div className="text-sm text-slate-500">
                ประมวลผลแล้ว {Object.keys(userResolutions).length} / {conflicts.length} รายการ
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsConflictModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleConfirmResolutions}
                  disabled={Object.keys(userResolutions).length !== conflicts.length}
                  className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Check size={16} />
                  ยืนยันและส่งออกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWelcomeModal && (
        <WelcomeModal
          isOpen={showWelcomeModal}
          onClose={() => setShowWelcomeModal(false)}
        />
      )}

      {showDraftModal && (
        <DraftRestoreModal
          isOpen={showDraftModal}
          draftCount={draftData ? draftData.length : 0}
          onResume={() => {
            setOrganizations(draftData);
            setShowDraftModal(false);
            setIsDraftRestored(true);
          }}
          onStartFresh={() => {
            idbDel('org_builder_draft').catch(console.error);
            setShowDraftModal(false);
            setIsDraftRestored(true);
          }}
        />
      )}

    </div>
  );
}