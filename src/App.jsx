import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Trash2, MapPin, CheckCircle, 
  Layers, Network, ChevronDown, ChevronRight, ChevronUp, ChevronLeft,
  Image as ImageIcon, Upload, ZoomIn, ZoomOut, Maximize, Minimize,
  FileSpreadsheet, X, Download, Table, LayoutTemplate, LayoutList,
  AlertTriangle, Code, Copy, Check, Braces, Database, AlignLeft, Search, ExternalLink
} from 'lucide-react';
import { ThailandAddressTypeahead, ThailandAddressValue, useAddressTypeaheadContext } from "react-thailand-address-typeahead";
import * as XLSX from 'xlsx';

// สร้างข้อมูลจำลองพื้นที่ 77 จังหวัด และพื้นที่ย่อยสำหรับตัวอย่าง

const MOCK_LOCATION_DATA = {
  "กรุงเทพมหานคร": {
    "เขตจตุจักร": ["ลาดยาว", "เสนานิคม", "จันทรเกษม", "จอมพล", "พหลโยธิน"],
    "เขตพญาไท": ["สามเสนใน", "พญาไท"],
    "เขตดินแดง": ["ดินแดง", "รัชดาภิเษก"]
  },
  "ชลบุรี": {
    "อำเภอเมืองชลบุรี": ["บางปลาสร้อย", "มะขามหย่ง", "บ้านโขด", "แสนสุข"],
    "อำเภอบางละมุง": ["หนองปรือ", "นาเกลือ", "หนองปลาไหล"]
  }
};

// --- Component สำหรับเรนเดอร์ JSON แบบย่อ/ขยายได้ (Tree View) ---
const JsonTreeViewer = ({ data, level = 0, isLast = true }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isArray = Array.isArray(data);
  const isObject = data !== null && typeof data === 'object';

  if (!isObject) {
    // ประเภทข้อมูลพื้นฐาน (String, Number, Boolean, Null)
    const renderValue = () => {
      if (typeof data === 'string') return <span className="text-green-400">"{data}"</span>;
      if (typeof data === 'number') return <span className="text-orange-400">{data}</span>;
      if (typeof data === 'boolean') return <span className="text-blue-400">{data ? 'true' : 'false'}</span>;
      if (data === null) return <span className="text-slate-500">null</span>;
      return <span>{String(data)}</span>;
    };
    return <span>{renderValue()}{!isLast && <span className="text-slate-400">,</span>}</span>;
  }

  const keys = Object.keys(data);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  if (keys.length === 0) {
    return <span className="text-slate-300">{openBracket}{closeBracket}{!isLast && <span className="text-slate-400">,</span>}</span>;
  }

  return (
    <div className="font-mono text-[12px] leading-5 text-slate-300">
      <div className="flex items-start group">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-4 h-4 flex items-center justify-center shrink-0 text-slate-500 hover:text-white transition-colors relative -left-1"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <div>
          <span className="text-slate-300">{openBracket}</span>
          {isCollapsed && (
            <span className="text-slate-500 italic ml-1 cursor-pointer hover:text-slate-400" onClick={() => setIsCollapsed(false)}>
              {isArray ? `... ${keys.length} items ...` : '...'}
            </span>
          )}
          {isCollapsed && <span>{closeBracket}{!isLast && <span className="text-slate-400">,</span>}</span>}
        </div>
      </div>

      {!isCollapsed && (
        <div className="pl-6 border-l border-slate-700/50 ml-1.5">
          {keys.map((key, index) => {
            const childIsLast = index === keys.length - 1;
            return (
              <div key={key} className="flex">
                {!isArray && (
                  <span className="text-blue-300 mr-1 shrink-0">
                    "{key}":
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <JsonTreeViewer 
                    data={data[key]} 
                    level={level + 1} 
                    isLast={childIsLast} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!isCollapsed && (
        <div className="pl-1 text-slate-300">
          {closeBracket}{!isLast && <span className="text-slate-400">,</span>}
        </div>
      )}
      <div className="pl-1 text-slate-300">{Array.isArray(data) ? ']' : '}'}{!isLast && <span className="text-slate-500">,</span>}</div>
    </div>
  );
};



// ==========================================
// CONFIGURATION: Data Cleansing & Alias Dictionary
// ==========================================
// Dictionary for converting abbreviations to official terms.
// Easily extendable - just add key-value pairs here.
export const ALIAS_DICTIONARY = {
  'อบต.': 'องค์การบริหารส่วนตำบล',
  'อบต': 'องค์การบริหารส่วนตำบล',
  'อบจ.': 'องค์การบริหารส่วนจังหวัด',
  'อบจ': 'องค์การบริหารส่วนจังหวัด',
  'ทน.': 'เทศบาลนคร',
  'ทน': 'เทศบาลนคร',
  'ทม.': 'เทศบาลเมือง',
  'ทม': 'เทศบาลเมือง',
  'ทต.': 'เทศบาลตำบล',
  'ทต': 'เทศบาลตำบล',
  'รพ.สต.': 'โรงพยาบาลส่งเสริมสุขภาพตำบล',
  'รพ.สต': 'โรงพยาบาลส่งเสริมสุขภาพตำบล',
  'รพสต': 'โรงพยาบาลส่งเสริมสุขภาพตำบล',
  'รร.': 'โรงเรียน',
  'รร': 'โรงเรียน',
  'สนง.': 'สำนักงาน',
  'สนง': 'สำนักงาน',
  'กทม.': 'กรุงเทพมหานคร',
  'กทม': 'กรุงเทพมหานคร',
  'ผอ.': 'ผู้อำนวยการ',
  'ผอ': 'ผู้อำนวยการ',
  'บก.': 'กองบังคับการ',
  'บก': 'กองบังคับการ',
  'ภ.': 'ตำรวจภูธร',
  'ภ': 'ตำรวจภูธร',
  'จว.': 'จังหวัด',
  'จว': 'จังหวัด',
  'ตม.': 'ตรวจคนเข้าเมือง',
  'ตม': 'ตรวจคนเข้าเมือง',
};

/**
 * Sanitizes and normalizes a string.
 * - Removes extra spaces
 * - Resolves double vowels (เเ -> แ) and duplicate tone marks
 * - Strips unwanted special characters
 * - Normalizes abbreviations using ALIAS_DICTIONARY
 */
export const sanitizeString = (str, dictionary = ALIAS_DICTIONARY) => {
  if (!str) return '';
  let cleaned = String(str);

  // 1. Fix double 'เ' -> 'แ'
  cleaned = cleaned.replace(/เเ/g, 'แ');

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
  cleaned = cleaned.replace(/[^\u0E00-\u0E7FA-Za-z0-9\s\-_/\\\(\)\[\]\.,]/g, '');

  // 4. Normalize spacing
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 5. Expand abbreviations from dictionary
  // Sort keys by length descending to match longer abbreviations first (e.g., 'รพ.สต.' before 'รพ.')
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  for (const abbrev of sortedKeys) {
    const fullWord = dictionary[abbrev];
    if (abbrev.endsWith('.')) {
      const escaped = abbrev.replace(/\./g, '\\.');
      const regex = new RegExp(escaped, 'g');
      cleaned = cleaned.replace(regex, fullWord);
    } else {
      // Direct replacement for sub-string abbreviations
      const regex = new RegExp(abbrev, 'g');
      cleaned = cleaned.replace(regex, fullWord);
    }
  }

  // Final spaces normalization
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
};

const cleanInput = (val, type) => {
  if (!val) return '';
  let cleaned = String(val).trim();
  if (type === 'province') {
    if (cleaned.startsWith('จ.')) cleaned = cleaned.substring(2).trim();
    if (cleaned.startsWith('จังหวัด')) cleaned = cleaned.substring(7).trim();
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

export const getLocationCode = (loc, db) => {
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
    if (foundKey) return String(row[foundKey]).trim();
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

const ImportModal = ({ isOpen, onClose, onImportData, onDownloadTemplate, locationDb }) => {
  const fileInputRef = useRef(null);
  const [parsedFile, setParsedFile] = useState(null);
  const [validatedNodes, setValidatedNodes] = useState([]);
  const [showDocumentation, setShowDocumentation] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'issues' | 'valid'
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');

  if (!isOpen) return null;

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

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet);

        if (rawRows.length === 0) {
          alert("ไม่พบข้อมูลในไฟล์");
          return;
        }

        const orgMap = new Map();

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

          let province = cleanInput(rawProvince, 'province');
          let amphoe = cleanInput(rawAmphoe, 'amphoe');
          let tambon = cleanInput(rawTambon, 'tambon');
          const postalCode = rawPostalCode;

          if (!orgMap.has(orgName)) {
            orgMap.set(orgName, {
              name: orgName,
              parentName: parentName || null,
              locations: [],
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

          if (province) {
            const exists = orgInfo.locations.some(loc => 
              loc.province === province &&
              loc.amphoe === amphoe &&
              loc.tambon === tambon
            );
            if (!exists) {
              const locObj = {
                province,
                amphoe,
                tambon,
                postalCode
              };
              locObj.code = getLocationCode(locObj, locationDb);
              orgInfo.locations.push(locObj);
            }
          }
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
        });

        // Level calculation
        const validated = orgList.map(org => {
          const calculatedLevel = getLevel(org.name, parentMap);
          return {
            name: org.name,
            parentName: parentMap.get(org.name) || null,
            originalParentName: org.parentName,
            level: calculatedLevel,
            locations: org.locations,
            errors: org.errors,
            warnings: org.warnings,
            rawRows: org.rawRows
          };
        });

        setValidatedNodes(validated);
        setParsedFile({ name: file.name, size: file.size });
        setShowDocumentation(false);
      } catch (err) {
        console.error(err);
        alert(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    const idMap = new Map();
    validatedNodes.forEach(node => {
      idMap.set(node.name, `org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    });

    const roots = validatedNodes.filter(node => !node.parentName);

    const finalOrgs = validatedNodes.map(node => {
      let parentId = node.parentName && idMap.has(node.parentName) ? idMap.get(node.parentName) : null;
      let warnings = [...(node.warnings || [])];
      let errors = [...(node.errors || [])];

      // Enforce single root constraint
      if (roots.length > 1 && !node.parentName && node.name !== roots[0].name) {
        parentId = idMap.get(roots[0].name);
        warnings.push(`⚠️ ถูกปรับให้อยู่ภายใต้ ${roots[0].name} เนื่องจากระบบกำหนดให้มีหน่วยงานสูงสุดได้เพียง 1 แห่ง`);
      }

      return {
        id: idMap.get(node.name),
        name: node.name,
        level: node.level,
        parentId,
        logo: null,
        areas: {
          locations: node.locations
        },
        errors,
        warnings
      };
    });

    onImportData(finalOrgs);
    resetState();
  };

  const resetState = () => {
    setParsedFile(null);
    setValidatedNodes([]);
    setShowDocumentation(true);
    setFilterType('all');
    setPreviewSearchQuery('');
  };

  const handleCloseModal = () => {
    resetState();
    onClose();
  };

  // Filter logic for preview list
  const filteredNodes = validatedNodes.filter(node => {
    // Search filter
    if (previewSearchQuery.trim() && !node.name.toLowerCase().includes(previewSearchQuery.toLowerCase())) {
      return false;
    }
    // Tab filter
    if (filterType === 'issues') {
      return node.errors.length > 0 || node.warnings.length > 0;
    }
    if (filterType === 'valid') {
      return node.errors.length === 0 && node.warnings.length === 0;
    }
    return true;
  });

  const issueCount = validatedNodes.filter(n => n.errors.length > 0 || n.warnings.length > 0).length;
  const validCount = validatedNodes.length - issueCount;
  const cycleCount = validatedNodes.filter(n => n.errors.length > 0).length;
  const warningCount = validatedNodes.filter(n => n.warnings.length > 0 && n.errors.length === 0).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh]">
        
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
        <div className="flex flex-col md:flex-row bg-white flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="md:w-[65%] p-6 border-r border-slate-200 bg-slate-50/50 overflow-y-auto flex flex-col min-h-0">
            {showDocumentation ? (
              <div>
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
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white mb-6">
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
                        <td className="px-3 py-2 font-medium">ชื่อจังหวัด (เช่น กรุงเทพมหานคร, ชลบุรี) (หากปล่อยว่างจะสร้างหน่วยงานโดยไม่มีพื้นที่รับผิดชอบ)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700">amphoe</td>
                        <td className="px-3 py-2 text-slate-600">Optional</td>
                        <td className="px-3 py-2 font-medium">ชื่ออำเภอ หรือ เขต (เช่น อำเภอเมืองชลบุรี, เขตจตุจักร)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700">tambon</td>
                        <td className="px-3 py-2 text-slate-600">Optional</td>
                        <td className="px-3 py-2 font-medium">ชื่อตำบล หรือ แขวง (เช่น ตำบลบางปลาสร้อย, แขวงลาดยาว)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Data Examples */}
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                   <Table size={16} className="text-green-700" /> ตัวอย่างข้อมูล (1 แถว = 1 พื้นที่รับผิดชอบ)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left text-[10px] whitespace-nowrap">
                    <thead className="bg-green-50 text-green-800 uppercase font-bold border-b border-green-100">
                      <tr>
                        <th className="px-3 py-2">org_name</th>
                        <th className="px-3 py-2">parent_name</th>
                        <th className="px-3 py-2">province</th>
                        <th className="px-3 py-2">amphoe</th>
                        <th className="px-3 py-2">tambon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      <tr className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-blue-800 font-bold">กรุงเทพมหานคร</td>
                        <td className="px-3 py-2 text-slate-500 italic">null</td>
                        <td className="px-3 py-2">กรุงเทพมหานคร</td>
                        <td className="px-3 py-2 text-slate-400">-</td>
                        <td className="px-3 py-2 text-slate-400">-</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-3 py-2">เขตจตุจักร</td>
                        <td className="px-3 py-2 text-blue-800 font-bold">กรุงเทพมหานคร</td>
                        <td className="px-3 py-2">กรุงเทพมหานคร</td>
                        <td className="px-3 py-2">เขตจตุจักร</td>
                        <td className="px-3 py-2 text-slate-400">-</td>
                      </tr>
                      <tr className="bg-blue-50/50 hover:bg-blue-50">
                        <td className="px-3 py-2 font-bold text-blue-800">ศูนย์ปฏิบัติการน้ำ</td>
                        <td className="px-3 py-2">กรมชลประทาน</td>
                        <td className="px-3 py-2">ชลบุรี</td>
                        <td className="px-3 py-2 text-slate-400">-</td>
                        <td className="px-3 py-2 text-slate-400">-</td>
                      </tr>
                      <tr className="bg-blue-50/50 hover:bg-blue-50">
                        <td className="px-3 py-2 font-bold text-blue-800">ศูนย์ปฏิบัติการน้ำ</td>
                        <td className="px-3 py-2 text-slate-500">กรมชลประทาน</td>
                        <td className="px-3 py-2">ระยอง</td>
                        <td className="px-3 py-2 text-slate-400">-</td>
                        <td className="px-3 py-2 text-slate-400">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                     <Layers size={16} className="text-blue-600" /> โครงสร้างพรีวิว ({filteredNodes.length} หน่วยงาน)
                  </h3>
                  <button 
                    onClick={() => setShowDocumentation(true)}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                  >
                    ดูคำอธิบายคอลัมน์/ตัวอย่างไฟล์
                  </button>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="ค้นหารายชื่อหน่วยงานพรีวิว..."
                      value={previewSearchQuery}
                      onChange={(e) => setPreviewSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex bg-slate-200 p-0.5 rounded-xl border border-slate-300 self-start text-xs font-bold">
                    <button 
                      onClick={() => setFilterType('all')} 
                      className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      ทั้งหมด ({validatedNodes.length})
                    </button>
                    <button 
                      onClick={() => setFilterType('issues')} 
                      className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'issues' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'} flex items-center gap-1`}
                    >
                      พบปัญหา ({issueCount})
                    </button>
                    <button 
                      onClick={() => setFilterType('valid')} 
                      className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'valid' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      ผ่านการตรวจ ({validCount})
                    </button>
                  </div>
                </div>

                {/* Node List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                  {filteredNodes.length === 0 ? (
                    <div className="text-center py-12 text-slate-600 font-medium text-xs">
                      ไม่พบหน่วยงานตามตัวกรองที่เลือก
                    </div>
                  ) : (
                    filteredNodes.map((node, index) => {
                      const hasErrors = node.errors.length > 0;
                      const hasWarnings = node.warnings.length > 0;
                      let cardStyle = "border-slate-200 bg-white hover:border-blue-300";
                      if (hasErrors) cardStyle = "border-red-500 bg-red-50/70";
                      else if (hasWarnings) cardStyle = "border-amber-500 bg-amber-50/70";

                      return (
                        <div key={index} className={`p-4 rounded-xl border-2 transition-all shadow-sm ${cardStyle}`}>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">{node.name}</h4>
                              <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                                ระดับ: <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Level {node.level}</span>
                                {node.parentName ? (
                                  <> • ต้นสังกัด: <span className="text-blue-800">{node.parentName}</span></>
                                ) : (
                                  <> • <span className="text-slate-500 italic">หน่วยงานสูงสุด</span></>
                                )}
                              </div>
                              {node.originalParentName !== node.parentName && node.originalParentName && (
                                <p className="text-[10px] text-red-600 font-bold mt-1">
                                  ⚠️ สังกัดเดิมในไฟล์: "{node.originalParentName}" (ถูกปรับปรุงอัตโนมัติ)
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-lg shrink-0">
                              รับผิดชอบ {node.locations.length} พื้นที่
                            </span>
                          </div>

                          {/* Error/Warning Messages */}
                          {(hasErrors || hasWarnings) && (
                            <div className="mt-3 space-y-1.5 border-t border-slate-200/55 pt-2.5">
                              {node.errors.map((err, i) => (
                                <div key={i} className="text-[10px] font-bold text-red-700 bg-red-100/50 p-2 rounded-lg flex items-center gap-1.5">
                                  <AlertTriangle size={12} className="shrink-0 text-red-700" />
                                  <span>{err}</span>
                                </div>
                              ))}
                              {node.warnings.map((warn, i) => (
                                <div key={i} className="text-[10px] font-bold text-amber-900 bg-amber-100/50 p-2.5 rounded-lg flex flex-col gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <AlertTriangle size={12} className="shrink-0 text-amber-700" />
                                    <span>{warn}</span>
                                  </div>
                                  
                                  {/* แสดงตารางแถวขัดแย้งหากคำเตือนเกี่ยวข้องกับความขัดแย้งต้นสังกัด */}
                                  {warn.includes("ขัดแย้งกัน") && node.rawRows && node.rawRows.length > 0 && (
                                    <div className="overflow-x-auto rounded border border-amber-200 bg-white mt-1">
                                      <table className="w-full text-left text-[9px] font-semibold text-slate-700 whitespace-nowrap">
                                        <thead className="bg-amber-50 text-amber-955 uppercase font-bold border-b border-amber-100">
                                          <tr>
                                            <th className="px-2 py-1 border-r border-slate-100 text-center">บรรทัดที่ (Row)</th>
                                            <th className="px-2 py-1 border-r border-slate-100">ชื่อหน่วยงาน (org_name)</th>
                                            <th className="px-2 py-1">ต้นสังกัด (parent_name)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {node.rawRows.map((r, idx) => (
                                            <tr key={idx} className="hover:bg-amber-50/20">
                                              <td className="px-2 py-1 border-r border-slate-100 font-mono text-center">{r.rowNumber}</td>
                                              <td className="px-2 py-1 border-r border-slate-100">{r.orgName}</td>
                                              <td className="px-2 py-1 font-bold text-red-650">{r.parentName || <span className="italic text-slate-400 font-normal">null (ว่าง)</span>}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="md:w-[35%] p-6 flex flex-col justify-between bg-white shrink-0">
            {!parsedFile ? (
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
                  <p className="text-[10px] text-slate-600 font-bold">รองรับไฟล์ Excel (.xlsx, .xls) และ CSV</p>
                </div>
                <button 
                  onClick={triggerFileInput} 
                  className="mt-4 px-6 py-3 w-full bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md hover:bg-slate-900 hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  เลือกไฟล์สำหรับอัปโหลด
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                {/* Summary Info */}
                <div className="space-y-5">
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-3 items-center">
                    <CheckCircle className="text-green-700 shrink-0 w-8 h-8" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">อ่านไฟล์เรียบร้อย</h4>
                      <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[200px]">{parsedFile.name}</p>
                      <p className="text-[10px] text-slate-600 font-bold">ขนาด: {Math.round(parsedFile.size / 1024)} KB</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                    <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">ผลสรุปโครงสร้าง</h5>
                    <div className="divide-y divide-slate-200/60 text-xs font-semibold text-slate-700">
                      <div className="flex justify-between py-2">
                        <span>หน่วยงานนำเข้าทั้งหมด</span>
                        <span className="font-bold text-slate-900">{validatedNodes.length} โหนด</span>
                      </div>
                      <div className="flex justify-between py-2 text-red-600">
                        <span>พบสังกัดเป็นวงกลม</span>
                        <span className="font-bold">{cycleCount} โหนด</span>
                      </div>
                      <div className="flex justify-between py-2 text-amber-700">
                        <span>ไม่พบต้นสังกัด/ขัดแย้ง</span>
                        <span className="font-bold">{warningCount} โหนด</span>
                      </div>
                      <div className="flex justify-between py-2 text-green-755 font-bold">
                        <span>ผ่านการตรวจสอบทันที</span>
                        <span className="font-bold">{validCount} โหนด</span>
                      </div>
                    </div>
                  </div>

                  {(cycleCount > 0 || warningCount > 0) && (
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-[10px] font-semibold text-blue-900 leading-relaxed">
                      💡 <b>ข้อมูลเพิ่มเติม:</b> มีหน่วยงานที่มีโครงสร้างขัดแย้ง ระบบจะช่วยปรับโครงสร้างความสัมพันธ์ให้อัตโนมัติ (เช่น ตัดสังกัดที่เป็นวงกลม และตั้งเป็นหน่วยงานสูงสุด Level 1) เพื่อให้สร้างโครงสร้างแผนผังที่ถูกต้องได้สำเร็จ
                    </div>
                  )}
                </div>

                {/* Import Confirm Button */}
                <div className="space-y-3 mt-6">
                  <button 
                    onClick={handleConfirm}
                    className="w-full py-3.5 bg-green-700 hover:bg-green-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-100 flex justify-center items-center gap-2 hover:shadow-xl transition-all cursor-pointer"
                  >
                    <Check size={16} strokeWidth={3} /> ยืนยันการนำเข้าข้อมูล
                  </button>
                  <button 
                    onClick={resetState}
                    className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-950 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                  >
                    เลือกไฟล์ใหม่
                  </button>
                </div>
              </div>
            )}
          </div>
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
        const prefix = loc.province === "กรุงเทพมหานcor" ? "" : "จ.";
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

const OrgNode = ({ node, selectedNodeId, setSelectedNodeId, handleAddNode, handleDeleteNode, treeLayout, parentName, nodeIssues }) => {
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(true);
  const isVert = treeLayout === 'vertical';

  const issue = nodeIssues?.get(node.id);
  const hasError = issue?.type === 'error';
  const hasWarning = issue?.type === 'warning';

  return (
    <div className={`flex ${isVert ? 'flex-col' : 'flex-row'} items-center`}>
      {/* กล่องหน่วยงาน */}
      <div 
        onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
        onMouseDown={(e) => e.stopPropagation()}
        id={node.id}
        className={`relative group min-w-[200px] max-w-[240px] p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
          isSelected 
            ? 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-100 z-10 ring-4 ring-blue-500/20 scale-105' 
            : hasError
              ? 'bg-red-50 border-red-500 shadow-sm hover:border-red-600 hover:shadow-md'
              : hasWarning
                ? 'bg-amber-50 border-amber-500 shadow-sm hover:border-amber-600 hover:shadow-md'
                : 'bg-white border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md'
        }`}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
          <span className={`px-1.5 py-0.5 rounded font-bold ${
            hasError 
              ? 'bg-red-100 text-red-700' 
              : hasWarning 
                ? 'bg-amber-100 text-amber-700' 
                : 'text-slate-650 bg-slate-100'
          }`}>Level {node.level}</span>
          <div className={`flex gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button 
              onClick={(e) => { e.stopPropagation(); handleAddNode(node.id, node.level); setIsExpanded(true); }}
              className="w-6 h-6 bg-blue-50 text-blue-700 rounded flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
              title="เพิ่มหน่วยงานย่อย"
              aria-label="เพิ่มหน่วยงานย่อย"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
              className="w-6 h-6 bg-red-50 text-red-700 rounded flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
              title="ลบหน่วยงานนี้"
              aria-label="ลบหน่วยงานนี้"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mb-1 min-w-0">
          {node.logo ? (
            <img src={node.logo} alt={`โลโก้ของ ${node.name || 'หน่วยงาน'}`} className="w-10 h-10 rounded-md object-cover border border-slate-200 shadow-sm shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
              <Network size={18} />
            </div>
          )}
          <div className="font-bold text-sm text-slate-800 break-words leading-tight flex-1 flex items-center gap-1.5 min-w-0">
            <span className="truncate">{node.name || <span className="text-slate-500 italic">ไม่ได้ระบุชื่อ</span>}</span>
            {issue && (
              <span 
                className={`${hasError ? 'text-red-700' : 'text-amber-700'} shrink-0`} 
                title={issue.message}
              >
                <AlertTriangle size={14} className="animate-pulse" />
              </span>
            )}
          </div>
        </div>
        
        {(() => {
          const count = getAreaCount(node.areas);
          if (count === 0) {
            return (
              <div className="mt-2 text-[10px] flex items-center gap-1.5 text-slate-600 bg-slate-50 border border-slate-100 p-1.5 rounded-lg w-full font-medium">
                <MapPin size={12} className="shrink-0 text-slate-500" />
                <span className="truncate">ไม่มีพื้นที่รับผิดชอบ</span>
              </div>
            );
          } else {
            return (
              <div className="mt-2 text-[10px] flex items-center gap-1.5 text-blue-700 bg-blue-50/70 border border-blue-100/50 p-1.5 rounded-lg w-full font-semibold" title={formatAreaLabel(node.areas)}>
                <MapPin size={12} className="shrink-0 text-blue-700" />
                <span className="truncate">รับผิดชอบ {count} พื้นที่</span>
              </div>
            );
          }
        })()}

        {/* Expand/Collapse Button */}
        {hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className={`absolute ${
              isVert 
                ? '-bottom-3 left-1/2 -translate-x-1/2' 
                : '-right-3 top-1/2 -translate-y-1/2'
            } px-2 py-0.5 bg-white border border-slate-300 text-slate-700 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 z-20 transition-all`}
            title={isExpanded ? "ย่อส่วน" : "ขยายส่วน"}
            aria-label={isExpanded ? "ย่อส่วน" : "ขยายส่วน"}
          >
            {node.children.length} 
            {isExpanded 
              ? (isVert ? <ChevronUp size={12} /> : <ChevronLeft size={12} />) 
              : (isVert ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            }
          </button>
        )}
      </div>

      {/* เส้นเชื่อมกิ่งลูก (Lines and Children) */}
      {hasChildren && isExpanded && (
        <div className={`flex ${isVert ? 'flex-col items-center mt-3' : 'flex-row items-center ml-3'}`}>
          <div className={`${isVert ? 'w-[2px] h-6' : 'h-[2px] w-6'} bg-slate-300`}></div>
          <div className={`flex ${isVert ? 'flex-row gap-4 relative' : 'flex-col gap-4 relative'}`}>
            {node.children.map((child, index) => (
              <div key={child.id} className={`relative flex ${isVert ? 'flex-col items-center pt-4' : 'flex-row items-center pl-4'}`}>
                {/* Connection lines logic */}
                {node.children.length > 1 && (
                  <>
                     {isVert ? (
                      <>
                        <div className={`absolute top-0 left-0 w-1/2 h-[2px] bg-slate-300 ${index === 0 ? 'hidden' : ''}`}></div>
                        <div className={`absolute top-0 right-0 w-1/2 h-[2px] bg-slate-300 ${index === node.children.length - 1 ? 'hidden' : ''}`}></div>
                      </>
                    ) : (
                      <>
                        <div className={`absolute top-0 left-0 w-[2px] h-1/2 bg-slate-300 ${index === 0 ? 'hidden' : ''}`}></div>
                        <div className={`absolute bottom-0 left-0 w-[2px] h-1/2 bg-slate-300 ${index === node.children.length - 1 ? 'hidden' : ''}`}></div>
                      </>
                    )}
                  </>
                )}
                {/* Line to child */}
                <div className={`absolute ${isVert ? 'top-0 w-[2px] h-4' : 'left-0 h-[2px] w-4'} bg-slate-300`}></div>

                {/* Recursive Node */}
                <OrgNode 
                  node={child} 
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                  handleAddNode={handleAddNode}
                  handleDeleteNode={handleDeleteNode}
                  treeLayout={treeLayout}
                  parentName={node.name}
                  nodeIssues={nodeIssues}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

  const [query, setQuery] = useState('');

  // Clear query text when addressInput values are reset
  useEffect(() => {
    if (!value.subdistrict && !value.district && !value.province && !value.postalCode) {
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
    const allSuggestions = [
      ...provinceSuggestions,
      ...districtSuggestions,
      ...uniqueSubdistricts
    ];

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
            let label = "";
            let badge = null;

            if (item.isWholeProvince) {
              label = `ทั้งจังหวัด ${item.p}`;
              badge = <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded font-bold">ทั้งจังหวัด</span>;
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
                className={`px-3 py-2.5 flex justify-between items-center cursor-pointer transition-colors ${
                  isHighlighted ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
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

const ConfigPanel = ({ selectedNode, handleUpdateNode, onClose, organizations, nodeIssues, moveMode, setMoveMode, locationDb }) => {
  const fileInputRef = useRef(null);
  const [addressInput, setAddressInput] = useState({
    subdistrict: '',
    district: '',
    province: '',
    postalCode: '',
  });

  useEffect(() => {
    setAddressInput({
      subdistrict: '',
      district: '',
      province: '',
      postalCode: '',
    });
  }, [selectedNode?.id]);

  if (!selectedNode) return null;

  const selectedLocations = getSelectedLocations(selectedNode.areas);

  const parentOrg = useMemo(() => {
    if (!organizations || !selectedNode) return null;
    return organizations.find(o => o.id === selectedNode.parentId);
  }, [organizations, selectedNode?.parentId]);
  
  const parentName = parentOrg ? parentOrg.name : '';

  const hasChildren = useMemo(() => {
    if (!organizations || !selectedNode) return false;
    return organizations.some(org => org.parentId === selectedNode.id);
  }, [organizations, selectedNode?.id]);




  // คำนวณหาหน่วยงานสูงสุดเพื่อปิดไม่ให้เลือกสังกัด
  const potentialRoots = useMemo(() => {
    if (!organizations) return [];
    return organizations.filter(org => !org.parentId || !organizations.some(n => n.id === org.parentId));
  }, [organizations]);
  
  const primaryRootId = potentialRoots.length > 0 ? potentialRoots[0].id : null;
  const isPrimaryRoot = selectedNode.id === primaryRootId;

  // ค้นหาโหนดลูกหลานทั้งหมดเพื่อป้องกันการเลือกสังกัดแบบวงกลม (Cyclic Reference)
  const descendantIds = useMemo(() => {
    if (!organizations || !selectedNode) return new Set();
    const descendants = new Set();
    const queue = [selectedNode.id];
    while (queue.length > 0) {
      const currentId = queue.shift();
      organizations.forEach(o => {
        if (o.parentId === currentId && !descendants.has(o.id)) {
          descendants.add(o.id);
          queue.push(o.id);
        }
      });
    }
    return descendants;
  }, [selectedNode?.id, organizations]);

  const parentOptions = useMemo(() => {
    if (!organizations || !selectedNode) return [];
    return organizations.filter(org => org.id !== selectedNode.id && !descendantIds.has(org.id));
  }, [organizations, selectedNode?.id, descendantIds]);

  // ดึงข้อขัดแย้ง/ข้อควรระวังสำหรับโหนดที่เลือก
  const nodeIssue = nodeIssues?.get(selectedNode.id);

  const handleAddressSelect = (nextVal) => {
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      handleUpdateNode(selectedNode.id, 'logo', imageUrl);
    }
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

  return (
    <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-2xl h-full flex flex-col animate-in fade-in slide-in-from-right-4 pointer-events-auto">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
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

      <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
        {/* แสดงข้อความ Warning/Error ใน Side Panel */}
        {nodeIssue && (
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-semibold leading-normal animate-in fade-in slide-in-from-top-2 ${
            nodeIssue.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <AlertTriangle className={`w-4 h-4 shrink-0 ${nodeIssue.type === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
            <div>
              <div className="font-bold mb-0.5">{nodeIssue.type === 'error' ? 'ข้อผิดพลาด (Error)' : 'ข้อควรระวัง (Warning)'}</div>
              <div className="font-medium text-slate-700">{nodeIssue.message}</div>
            </div>
          </div>
        )}

        {/* หน่วยงานต้นสังกัด (ย้ายขึ้นมาไว้ด้านบนสุดเพื่อให้เห็นและตั้งค่าได้ง่าย) */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
          <label className="block text-[10px] font-bold text-slate-650 uppercase">หน่วยงานต้นสังกัด</label>
          {isPrimaryRoot ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm bg-white">
              <span>👑</span> หน่วยงานสูงสุดของระบบ (ไม่สามารถเลือกต้นสังกัดได้)
            </div>
          ) : (
            <>
              <select
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-medium shadow-sm"
                value={selectedNode.parentId || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  handleUpdateNode(selectedNode.id, 'parentId', val);
                }}
              >
                <option value="">-- เป็นหน่วยงานสูงสุด (ไม่มีต้นสังกัด) --</option>
                {parentOptions.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name || '(ไม่มีชื่อ)'}
                  </option>
                ))}
              </select>

              {hasChildren && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/50">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">รูปแบบการย้ายหน่วยงาน</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMoveMode('branch')}
                      className={`px-2 py-1.5 rounded-lg border text-left text-[11px] font-bold transition-all cursor-pointer ${
                        moveMode === 'branch'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${moveMode === 'branch' ? 'bg-blue-600' : 'bg-slate-300'}`} />
                        <span>ย้ายทั้งเส้น</span>
                      </div>
                      <div className="text-[9px] font-semibold text-slate-500 pl-3.5 mt-0.5">หน่วยงานย่อยจะย้ายตามไปด้วย</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoveMode('single')}
                      className={`px-2 py-1.5 rounded-lg border text-left text-[11px] font-bold transition-all cursor-pointer ${
                        moveMode === 'single'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${moveMode === 'single' ? 'bg-blue-600' : 'bg-slate-300'}`} />
                        <span>ย้ายเฉพาะหน่วยงาน</span>
                      </div>
                      <div className="text-[9px] font-semibold text-slate-500 pl-3.5 mt-0.5">ฝากลูกน้องไว้ที่สังกัดเดิมก่อนย้าย</div>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center gap-2 shrink-0">
             <label className="block text-[10px] font-bold text-slate-600 uppercase">โลโก้ (1:1)</label>
             <div 
               onClick={() => fileInputRef.current?.click()} 
               className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors relative overflow-hidden group"
               title="คลิกเพื่ออัปโหลดโลโก้"
               aria-label="คลิกเพื่ออัปโหลดโลโก้"
             >
                {selectedNode.logo ? (
                  <><img src={selectedNode.logo} alt={`โลโก้ของ ${selectedNode.name || 'หน่วยงาน'}`} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload className="text-white w-6 h-6" /></div></>
                ) : (
                  <><ImageIcon className="text-slate-500 mb-1 w-6 h-6" /><span className="text-[10px] text-slate-600 font-medium">อัปโหลด</span></>
                )}
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} />
             {selectedNode.logo && (
                <button 
                  onClick={() => handleUpdateNode(selectedNode.id, 'logo', null)} 
                  className="text-[10px] text-red-700 hover:text-red-900 font-bold"
                  aria-label="ลบรูปภาพโลโก้"
                  title="ลบรูปภาพโลโก้"
                >
                  ลบรูปภาพ
                </button>
             )}
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-2">ชื่อหน่วยงาน</label>
            <input 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all text-sm font-medium shadow-sm"
              value={selectedNode.name || ''}
              onChange={(e) => handleUpdateNode(selectedNode.id, 'name', e.target.value)}
              onBlur={(e) => {
                const cleaned = sanitizeString(e.target.value);
                if (cleaned !== e.target.value) {
                  handleUpdateNode(selectedNode.id, 'name', cleaned);
                }
              }}
              placeholder="ระบุชื่อหน่วยงาน..."
            />
            <p className="text-[10px] text-slate-505 font-semibold mt-1">
              💡 ระบบจะคลีนสระพิมพ์ซ้ำ ลบอักขระพิเศษ และแปลงคำย่ออัตโนมัติเมื่อละจากช่องป้อน (Blur)
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><MapPin size={16} className="text-blue-700"/> ขอบเขตพื้นที่รับผิดชอบ</h4>
          
          <div className="space-y-3">
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

          {/* List of Selected Areas */}
          {selectedLocations.length > 0 && (
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
                      aria-label="ลบพื้นที่รับผิดชอบนี้"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

const recalculateAllLevels = (orgs) => {
  return orgs.map(org => {
    let level = 1;
    let curr = org;
    const visited = new Set();
    while (curr && curr.parentId && !visited.has(curr.id)) {
      visited.add(curr.id);
      const parent = orgs.find(o => o.id === curr.parentId);
      if (!parent) break;
      curr = parent;
      level++;
    }
    return { ...org, level };
  });
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
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'guide' 
                ? 'border-blue-650 text-blue-700 font-extrabold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📖 คู่มือการใช้งานและขั้นตอน
          </button>
          <button 
            onClick={() => setActiveTab('checklist')}
            className={`px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'checklist' 
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

export default function OrgManagerApp() {
  const [organizations, setOrganizations] = useState([
    { 
      id: 'root-1', name: 'กรุงเทพมหานคร', level: 1, parentId: null, logo: null,
      areas: { province: 'กรุงเทพมหานคร', amphoes: {}, tambons: ['ลาดยาว', 'จอมพล'] } 
    },
    { id: 'node-2', name: 'สำนักการโยธา', level: 2, parentId: 'root-1', logo: null, areas: { province: 'กรุงเทพมหานคร' } },
    { id: 'node-3', name: 'สำนักการระบายน้ำ', level: 2, parentId: 'root-1', logo: null, areas: { province: 'กรุงเทพมหานคร' } },
    { id: 'node-4', name: 'สำนักการจราจรและขนส่ง', level: 2, parentId: 'root-1', logo: null, areas: { province: 'กรุงเทพมหานคร' } }
  ]);
  
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
  const [zoomScale, setZoomScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => !localStorage.getItem('hideWelcomeModal'));
  const [treeLayout, setTreeLayout] = useState('horizontal'); // 'vertical' or 'horizontal'
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isConflictPanelExpanded, setIsConflictPanelExpanded] = useState(true);
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' or 'table'
  const [deleteConfirmNode, setDeleteConfirmNode] = useState(null);
  const [moveMode, setMoveMode] = useState('branch'); // 'branch' or 'single'
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [collapsedTableNodes, setCollapsedTableNodes] = useState(new Set());
  
  // Pan and Drag State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    // If user is zooming, ignore (e.g., pinch-to-zoom on trackpad sets ctrlKey)
    if (e.ctrlKey || e.metaKey) return;
    
    setPan(prev => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY
    }));
  };

  // ให้ JSON Editor ซ่อนเป็นค่าเริ่มต้น (false) ตามคำขอ
  const [isJsonExpanded, setIsJsonExpanded] = useState(false); 
  const [jsonViewMode, setJsonViewMode] = useState('tree'); // 'tree' หรือ 'raw'

  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [copied, setCopied] = useState(false);
  const jsonTextAreaRef = useRef(null);

  useEffect(() => {
    if (document.activeElement !== jsonTextAreaRef.current) {
      setJsonText(JSON.stringify(organizations, null, 2));
      setJsonError(null);
    }
  }, [organizations]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleJsonChange = (e) => {
    const val = e.target.value;
    setJsonText(val);
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        setOrganizations(recalculateAllLevels(parsed));
        setJsonError(null);
      } else {
        setJsonError("ต้องเป็นรูปแบบ JSON Array [...]");
      }
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleBeautifyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch(err) {}
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.1, 0.4));
  const handleZoomReset = () => setZoomScale(1);

  const orgTree = useMemo(() => {
    const nodeMap = {};
    organizations.forEach(org => { nodeMap[org.id] = { ...org, children: [] }; });
    
    const roots = [];
    const visited = new Set();
    
    // Find potential roots: parentId is null or invalid
    const potentialRoots = organizations.filter(org => !org.parentId || !organizations.some(n => n.id === org.parentId));
    
    if (potentialRoots.length > 0) {
      const primaryRoot = potentialRoots[0];
      roots.push(nodeMap[primaryRoot.id]);
      visited.add(primaryRoot.id);
      
      const traverse = (node) => {
        if (!node) return;
        const children = organizations.filter(org => org.parentId === node.id);
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
        const children = organizations.filter(org => org.parentId === node.id);
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

  const selectedNode = useMemo(() => organizations.find(o => o.id === selectedNodeId) || null, [organizations, selectedNodeId]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return organizations.filter(org => org.name && org.name.toLowerCase().includes(q));
  }, [searchQuery, organizations]);

  const conflictingNodes = useMemo(() => {
    // A node is conflicting if it has multiple roots or orphan/cycle issues at runtime
    // Let's identify the primary root first
    const potentialRoots = organizations.filter(org => !org.parentId || !organizations.some(n => n.id === org.parentId));
    const primaryRootId = potentialRoots.length > 0 ? potentialRoots[0].id : null;

    const unreachable = [];
    
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
        const parentExists = organizations.some(n => n.id === node.parentId);
        if (!parentExists) {
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
        const parent = organizations.find(n => n.id === current.parentId);
        if (!parent) break;
        current = parent;
      }
      
      if (hasCycle) {
        unreachable.push({
          ...node,
          causeType: 'error',
          causeMessage: `ความสัมพันธ์เป็นวงกลม: ${path.join(' -> ')}`
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
            message: node.warnings[0]
          });
        }
      }
      if (node.errors && node.errors.length > 0) {
        const existing = issues.get(node.id);
        if (!existing || existing.type !== 'error') {
          issues.set(node.id, {
            type: 'error',
            message: node.errors[0]
          });
        }
      }
    });

    return issues;
  }, [conflictingNodes, organizations]);

  const handleAddNode = (parentId, currentLevel) => {
    const newNode = {
      id: `node-${Date.now()}`, name: '', level: currentLevel + 1, parentId: parentId, logo: null,
      areas: { locations: [] }
    };
    setOrganizations(orgs => recalculateAllLevels([...orgs, newNode]));
    setSelectedNodeId(newNode.id);
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

  const handleExportCSV = () => {
    const headers = ['org_name', 'parent_name', 'level', 'province', 'amphoe', 'tambon', 'postal_code', 'area_code'];
    const rows = [];

    organizations.forEach(org => {
      const parentOrg = organizations.find(o => o.id === org.parentId);
      const parentName = parentOrg ? parentOrg.name : '';
      const locations = getSelectedLocations(org.areas);

      if (locations.length === 0) {
        rows.push([
          org.name || '',
          parentName,
          org.level,
          '',
          '',
          '',
          '',
          ''
        ]);
      } else {
        locations.forEach(loc => {
          rows.push([
            org.name || '',
            parentName,
            org.level,
            loc.province || '',
            loc.amphoe || '',
            loc.tambon || '',
            loc.postalCode || '',
            loc.code || ''
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

      if (locations.length === 0) {
        data.push({
          'org_name': org.name || '',
          'parent_name': parentName,
          'level': org.level,
          'province': '',
          'amphoe': '',
          'tambon': '',
          'postal_code': '',
          'area_code': ''
        });
      } else {
        locations.forEach(loc => {
          data.push({
            'org_name': org.name || '',
            'parent_name': parentName,
            'level': org.level,
            'province': loc.province || '',
            'amphoe': loc.amphoe || '',
            'tambon': loc.tambon || '',
            'postal_code': loc.postalCode || '',
            'area_code': loc.code || ''
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
      setIsImportModalOpen(false);
      alert(`นำเข้าข้อมูลหน่วยงานสำเร็จ: ${newOrgs.length} หน่วยงาน`);
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

        {/* Table Container */}
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5 w-16 text-center">โลโก้</th>
                <th className="px-6 py-3.5">ชื่อหน่วยงาน</th>
                <th className="px-6 py-3.5">หน่วยงานต้นสังกัด</th>
                <th className="px-4 py-3.5 w-24 text-center">ระดับ</th>
                <th className="px-6 py-3.5">พื้นที่รับผิดชอบ</th>
                <th className="px-6 py-3.5 w-64">สถานะ / ข้อขัดแย้ง</th>
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
                  const parentOrg = organizations.find(o => o.id === org.parentId);
                  const hasParent = Boolean(org.parentId && parentOrg);
                  const parentName = parentOrg ? (parentOrg.name || 'ไม่ได้ระบุชื่อ') : '';
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

                  return (
                    <tr 
                      key={org.id} 
                      className={rowStyle}
                      onClick={() => setSelectedNodeId(org.id)}
                    >
                      {/* Logo */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          {org.logo ? (
                            <img src={org.logo} alt="Logo" className="w-8 h-8 rounded object-cover border border-slate-200 shadow-sm" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                              <Network size={14} />
                            </div>
                          )}
                        </div>
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
                          <span className="truncate max-w-[200px]" title={org.name}>
                            {org.name || <span className="text-slate-500 italic font-normal">ไม่ได้ระบุชื่อ</span>}
                          </span>
                          {issue && (
                            <span className={`${hasError ? 'text-red-700' : 'text-amber-700'} shrink-0`} title={issue.message}>
                              <AlertTriangle size={14} className="animate-pulse" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Parent */}
                      <td className="px-6 py-3">
                        {hasParent ? (
                          <span className={`bg-blue-50 px-2 py-1 rounded text-[11px] font-bold border border-blue-100 ${parentOrg?.name ? 'text-blue-800' : 'text-slate-500 italic font-normal'}`}>
                            {parentName}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic font-normal">หน่วยงานสูงสุด</span>
                        )}
                      </td>

                      {/* Level */}
                      <td className="px-4 py-3 text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px] font-bold border border-slate-200">
                          L{org.level}
                        </span>
                      </td>

                      {/* Areas */}
                      <td className="px-6 py-3">
                        {areaCount > 0 ? (
                          <span className="text-blue-700 bg-blue-50/70 border border-blue-100 px-2 py-1 rounded text-[11px] font-bold" title={formatAreaLabel(org.areas)}>
                            รับผิดชอบ {areaCount} พื้นที่
                          </span>
                        ) : (
                          <span className="text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded text-[11px] font-medium">
                            ไม่มีพื้นที่รับผิดชอบ
                          </span>
                        )}
                      </td>

                      {/* Status / Conflict */}
                      <td className="px-6 py-3">
                        {issue ? (
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            hasError 
                              ? 'bg-red-100 text-red-700 border-red-200' 
                              : 'bg-amber-100 text-amber-900 border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${hasError ? 'bg-red-600' : 'bg-amber-600'} animate-ping shrink-0`} />
                            <span className="truncate max-w-[220px]" title={issue.message}>{issue.message}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700 border border-green-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                            <span>ปกติ</span>
                          </div>
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'canvas'
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
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

          <button 
            onClick={() => setIsImportModalOpen(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm font-bold hover:bg-green-100 text-green-700 transition-all shadow-sm cursor-pointer"
            aria-label="นำเข้าไฟล์ Excel หรือ CSV"
          >
            <FileSpreadsheet size={16} /> นำเข้าข้อมูล
          </button>

          <button 
            onClick={() => setShowWelcomeModal(true)} 
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold hover:bg-blue-100 text-blue-700 transition-all shadow-sm cursor-pointer"
            aria-label="เปิดคู่มือการใช้งานและสถานะระบบ"
          >
            💡 คู่มือใช้งาน
          </button>

          <button 
            onClick={handleCleanAllData} 
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-bold hover:bg-amber-100 text-amber-700 transition-all shadow-sm cursor-pointer"
            aria-label="ล้างชื่อหน่วยงานและสระซ้ำทั้งหมดในผัง"
          >
            🧹 คลีนข้อมูลทั้งหมด
          </button>
          
          <div className="w-px h-8 bg-slate-200 mx-1 self-center"></div>
          
          {/* Export Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-bold hover:bg-emerald-100 text-emerald-700 transition-all shadow-sm"
              aria-haspopup="true"
              aria-expanded={isExportMenuOpen}
              aria-label="เมนูส่งออกข้อมูล"
            >
              <Download size={16} /> ส่งออกข้อมูล <ChevronDown size={14} />
            </button>
            
            {/* Backdrop to close dropdown */}
            {isExportMenuOpen && (
              <div 
                className="fixed inset-0 z-[90]" 
                onClick={() => setIsExportMenuOpen(false)} 
                aria-hidden="true"
              />
            )}

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                <button 
                  onClick={() => { handleExportExcel(); setIsExportMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors border-b border-slate-100 text-left"
                >
                  <FileSpreadsheet size={14} className="text-emerald-600" /> ส่งออกเป็น Excel
                </button>
                <button 
                  onClick={() => { handleExportCSV(); setIsExportMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors text-left"
                >
                  <FileSpreadsheet size={14} className="text-amber-600" /> ส่งออกเป็น CSV
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-slate-200 mx-1 self-center"></div>
          
          <button 
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
            aria-label="บันทึกแบบร่าง"
          >
            <CheckCircle size={16} /> Save Draft
          </button>
        </div>
      </header>

      {/* Main Workspace (Vertical Split) */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden relative">
        
        {/* TOP: Visual Mind Map Canvas (Combined with Floating Config Panel) */}
        <div className={`flex-1 bg-[#f8fafc] border border-slate-200 shadow-inner overflow-hidden flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none w-full h-full' : 'relative rounded-2xl'}`} style={viewMode === 'canvas' ? { backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' } : {}}>
          
          {viewMode === 'canvas' && (
            <div className="absolute top-4 left-4 z-30 flex gap-2 items-center">
             <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-xs font-bold text-slate-700 flex items-center gap-2">
                <Layers size={14} className="text-blue-600" /> รวม: {organizations.length} โหนด
             </div>

             {/* Search Bar */}
             <div className="relative">
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
               </div>

               {showSearchSuggestions && searchResults.length > 0 && (
                 <ul className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                   {searchResults.map(node => (
                     <li 
                       key={node.id}
                       onMouseDown={() => {
                         setSelectedNodeId(node.id);
                         setSearchQuery('');
                         setShowSearchSuggestions(false);
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
                       <span className="truncate pr-2">{node.name}</span>
                       <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">Level {node.level}</span>
                     </li>
                   ))}
                 </ul>
               )}
             </div>
          </div>
          )}

          {/* แผงแสดงหน่วยงานที่ขัดแย้ง (แยกโครงสร้างและเน้นให้เด่น) */}
          {viewMode === 'canvas' && conflictingNodes.length > 0 && (
            <div className={`absolute bottom-6 left-6 z-30 w-80 bg-white/95 backdrop-blur border border-red-200 rounded-2xl shadow-2xl flex flex-col p-4 transition-all duration-300 pointer-events-auto`}>
              <div 
                className="flex items-center justify-between border-b border-slate-100 pb-2 cursor-pointer select-none"
                onClick={() => setIsConflictPanelExpanded(!isConflictPanelExpanded)}
              >
                <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle size={16} className="text-red-650 shrink-0 animate-pulse" />
                  <span>พบข้อขัดแย้ง ({conflictingNodes.length})</span>
                </div>
                <div className="text-slate-400 hover:text-slate-650 transition-colors">
                  {isConflictPanelExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </div>

              {isConflictPanelExpanded && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  <div className="text-[10px] text-slate-600 font-semibold mb-1 leading-normal">
                    ⚠️ หน่วยงานด้านล่างเกิดความสัมพันธ์ขัดแย้ง (เช่น สังกัดเป็นวงกลม หรือไม่มีต้นสังกัด) ทำให้ไม่สามารถนำมาแสดงในผังหลักได้
                  </div>
                  {conflictingNodes.map(node => (
                    <div 
                      key={node.id} 
                      className={`p-2.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 hover:border-red-300 transition-all flex flex-col gap-1.5`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-bold text-[11px] text-slate-800 break-all">{node.name || <span className="italic text-slate-500">ไม่ระบุชื่อ</span>}</span>
                        <div className="flex gap-1 shrink-0">
                          <button 
                            onClick={() => setSelectedNodeId(node.id)}
                            className="px-1.5 py-0.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded text-[9px] font-bold shadow-xs transition-colors cursor-pointer"
                            title="เลือกเพื่อแก้ไขความสัมพันธ์ในแผงตั้งค่า"
                            aria-label="เลือกโหนดเพื่อแก้ไขความสัมพันธ์"
                          >
                            แก้ไข
                          </button>
                          <button 
                            onClick={() => handleUpdateNode(node.id, 'parentId', null)}
                            className="px-1.5 py-0.5 bg-red-700 text-white hover:bg-red-800 rounded text-[9px] font-bold shadow-xs transition-colors cursor-pointer"
                            title="ตั้งเป็นหน่วยงานสูงสุดทันทีเพื่อดึงกลับเข้าผังหลัก"
                            aria-label="ตั้งเป็นหน่วยงานสูงสุด"
                          >
                            ตั้งสูงสุด
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-[9px] font-bold text-red-700 bg-red-100/50 p-1.5 rounded flex items-center gap-1 leading-normal">
                        <AlertTriangle size={10} className="shrink-0 text-red-700" />
                        <span>{node.causeMessage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'canvas' && (
            <div className={`absolute bottom-6 z-30 flex flex-col gap-2 transition-all duration-300 ${selectedNode && !isFullscreen ? 'right-[390px]' : 'right-6'}`}>
               <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-lg flex flex-col overflow-hidden">
                  <button
                    onClick={() => setTreeLayout(l => l === 'vertical' ? 'horizontal' : 'vertical')}
                    className="p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border-b border-slate-100"
                    title={treeLayout === 'vertical' ? 'เปลี่ยนเป็นแนวนอน' : 'เปลี่ยนเป็นแนวตั้ง'}
                    aria-label={treeLayout === 'vertical' ? 'เปลี่ยนเป็นแนวนอน' : 'เปลี่ยนเป็นแนวตั้ง'}
                  >
                    {treeLayout === 'vertical' ? <LayoutList size={18}/> : <LayoutTemplate size={18}/>}
                  </button>
                  <button onClick={handleZoomIn} className="p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border-b border-slate-100"><ZoomIn size={18} /></button>
                  <button onClick={handleZoomReset} className="p-2 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border-b border-slate-100">{Math.round(zoomScale * 100)}%</button>
                  <button onClick={handleZoomOut} className="p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"><ZoomOut size={18} /></button>
               </div>
               <button onClick={toggleFullscreen} className={`bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors ${isFullscreen ? 'text-blue-600 bg-blue-50' : ''}`}>
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
               </button>
            </div>
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
                />
             </div>
          )}

          {viewMode === 'canvas' ? (
            <div 
              className={`flex-1 overflow-hidden relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} 
              onClick={() => setSelectedNodeId(null)}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <div 
                className={`min-w-max min-h-max flex ${treeLayout === 'vertical' ? 'justify-center' : 'items-center'} py-20 px-[20vw] ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`} 
                style={{ 
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`, 
                  transformOrigin: treeLayout === 'vertical' ? 'top center' : 'center left' 
                }}
              >
                {orgTree.length === 0 ? (
                  <button onClick={(e) => { e.stopPropagation(); handleAddNode(null, 0); }} className="px-6 py-3 bg-white border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 flex items-center gap-2 font-medium transition-colors shadow-sm">
                    <Plus size={18} /> เริ่มสร้างหน่วยงานสูงสุด
                  </button>
                ) : (
                  orgTree.map(root => (
                    <OrgNode key={root.id} node={root} selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId} handleAddNode={handleAddNode} handleDeleteNode={handleDeleteNode} treeLayout={treeLayout} parentName={null} nodeIssues={nodeIssues} />
                  ))
                )}
              </div>
            </div>
          ) : (
            renderTableView()
          )}
        </div>

        {/* BOTTOM: JSON Editor with Foldable View */}
        {!isFullscreen && (
          <div className={`flex flex-col bg-[#1e1e1e] rounded-2xl shadow-lg border border-slate-800 transition-all duration-300 overflow-hidden relative z-10 ${isJsonExpanded ? 'h-80 shrink-0' : 'h-[52px] shrink-0'}`}>
            
            {/* Toggle Header Bar */}
            <div className="bg-[#2d2d2d] px-4 py-3 flex justify-between items-center border-b border-black/40 select-none">
              <div 
                className="flex items-center gap-3 text-white text-sm font-bold cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => setIsJsonExpanded(!isJsonExpanded)}
              >
                <div className="p-1.5 bg-blue-500/20 rounded-md text-blue-400"><Code size={16}/></div>
                JSON Data Editor
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3">
                {isJsonExpanded && (
                  <div className="flex bg-[#1e1e1e] p-1 rounded-lg mr-2 border border-slate-700">
                    <button 
                      onClick={() => setJsonViewMode('tree')} 
                      className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-colors ${jsonViewMode === 'tree' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      <AlignLeft size={14} /> Tree (Foldable)
                    </button>
                    <button 
                      onClick={() => setJsonViewMode('raw')} 
                      className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-colors ${jsonViewMode === 'raw' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Braces size={14} /> Raw (Edit)
                    </button>
                  </div>
                )}
                
                {isJsonExpanded && (
                  <>
                    {jsonError ? (
                      <span className="flex items-center gap-1 text-xs text-red-400 font-bold bg-red-400/10 px-2 py-1 rounded"><AlertTriangle size={14}/> Invalid</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded"><Check size={14}/> Valid</span>
                    )}
                  </>
                )}
                <div className="text-slate-400 p-1 hover:text-white transition-colors cursor-pointer" onClick={() => setIsJsonExpanded(!isJsonExpanded)}>
                  {isJsonExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </div>
              </div>
            </div>
            
            {/* Editor Area */}
            {isJsonExpanded && (
              <div className="flex-1 relative flex flex-col group overflow-hidden">
                {jsonViewMode === 'raw' ? (
                  <textarea 
                    ref={jsonTextAreaRef}
                    className={`flex-1 w-full bg-[#1e1e1e] p-4 text-[13px] font-mono leading-relaxed outline-none resize-none scrollbar-hide ${jsonError ? 'text-red-300' : 'text-green-300'}`}
                    value={jsonText}
                    onChange={handleJsonChange}
                    onBlur={handleBeautifyJson}
                    spellCheck="false"
                    placeholder="Paste JSON array of organizations here..."
                  ></textarea>
                ) : (
                  <div className="flex-1 w-full bg-[#1e1e1e] p-4 overflow-auto scrollbar-hide">
                    {jsonError ? (
                      <div className="text-red-400 font-mono text-sm p-4 border border-red-500/30 rounded bg-red-500/10">
                        {jsonError}
                        <br/><span className="text-slate-400 mt-2 block">กรุณาสลับเป็น Raw (Edit) เพื่อแก้ไข Syntax</span>
                      </div>
                    ) : (
                      <JsonTreeViewer data={organizations} />
                    )}
                  </div>
                )}

                {/* Quick Actions overlay */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   {jsonViewMode === 'raw' && (
                     <button onClick={handleBeautifyJson} className="p-2.5 bg-slate-700/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg backdrop-blur shadow transition-colors" title="Format JSON">
                       <AlignLeft size={16}/>
                     </button>
                   )}
                   <button onClick={handleCopyJson} className="p-2.5 bg-slate-700/80 hover:bg-green-600 text-slate-300 hover:text-white rounded-lg backdrop-blur shadow transition-colors" title="Copy">
                     {copied ? <Check size={16} /> : <Copy size={16}/>}
                   </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Import Modal for Excel/CSV */}
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImportData={handleFileImport}
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
                  while (queue.length > 0) {
                    const curr = queue.shift();
                    organizations.forEach(org => {
                      if (org.parentId === curr && !visited.has(org.id)) {
                        visited.add(org.id);
                        queue.push(org.id);
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

      {showWelcomeModal && (
        <WelcomeModal 
          isOpen={showWelcomeModal} 
          onClose={() => setShowWelcomeModal(false)} 
        />
      )}

    </div>
  );
}