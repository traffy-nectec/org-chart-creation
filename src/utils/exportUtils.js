/**
 * Calculates the full path of an organization from root to itself.
 * 
 * @param {string} orgId - The ID of the organization
 * @param {Array} organizations - Array of all organization objects
 * @returns {string} The path joined by dots (e.g. "Root.Child.SubChild")
 */
export const getOrgPath = (orgId, organizations) => {
  const path = [];
  let currentId = orgId;
  
  // Guard against circular references by keeping track of visited nodes
  const visited = new Set();

  while (currentId) {
    if (visited.has(currentId)) {
      console.warn(`Circular reference detected at orgId: ${currentId}`);
      break;
    }
    visited.add(currentId);

    const currentOrg = organizations.find(o => o.id === currentId);
    if (!currentOrg) break;

    // Unshift puts the current name at the beginning of the array
    path.unshift(currentOrg.name || '');
    
    currentId = currentOrg.parentId;
  }

  return path.join('.');
};

/**
 * Topologically sorts an array of organizations so that parents always appear before their children.
 * Uses Kahn's algorithm. Throws an error if a cycle is detected.
 * 
 * @param {Array} organizations 
 * @returns {Array} Sorted array of organizations
 */
export const topologicalSort = (organizations) => {
  const adjList = new Map();
  const inDegree = new Map();
  const orgMap = new Map();

  // Initialize data structures
  organizations.forEach(org => {
    adjList.set(org.id, []);
    inDegree.set(org.id, 0);
    orgMap.set(org.id, org);
  });

  // Build graph
  organizations.forEach(org => {
    if (org.parentId) {
      if (adjList.has(org.parentId)) {
        adjList.get(org.parentId).push(org.id);
        inDegree.set(org.id, inDegree.get(org.id) + 1);
      } else {
        // Parent doesn't exist in the list, treat this node as a root (inDegree 0)
        console.warn(`Parent ID ${org.parentId} not found for org ${org.id}. Treating as root.`);
      }
    }
  });

  const queue = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  const sortedIds = [];
  while (queue.length > 0) {
    const currentId = queue.shift();
    sortedIds.push(currentId);

    adjList.get(currentId).forEach(childId => {
      inDegree.set(childId, inDegree.get(childId) - 1);
      if (inDegree.get(childId) === 0) {
        queue.push(childId);
      }
    });
  }

  if (sortedIds.length !== organizations.length) {
    throw new Error('พบการโยงสายแบบวงกลม (Circular Reference) ในผังองค์กร กรุณาแก้ไขก่อนทำการ Export');
  }

  return sortedIds.map(id => orgMap.get(id));
};

import rawAddressDB from '../assets/raw_database.json';

// Build a fast lookup dictionary for Address -> DOPA Code (6-digit)
// raw_database.json format: { province: "...", amphoe: "...", district: "...", district_code: 100101 }
const addressCodeLookup = new Map();
rawAddressDB.forEach(item => {
  // Key format: "จังหวัด_อำเภอ_ตำบล"
  // Note: raw_database uses 'district' for tambon, and 'amphoe' for amphoe
  const key = `${item.province}_${item.amphoe}_${item.district}`;
  // Store as 6-digit string
  addressCodeLookup.set(key, String(item.district_code).padStart(6, '0'));
});

/**
 * Generates the standardized JSON payload for the Backend import pipeline.
 * 
 * @param {Array} organizations 
 * @returns {Object} JSON Payload
 */
export const generateBackendPayload = (organizations) => {
  const sortedOrgs = topologicalSort(organizations);
  
  const nodes = sortedOrgs.map(org => {
    // Determine action. Default is CREATE, but can be set to LINK if user resolved conflicts
    return {
      temp_id: org.id,
      action: org.action || "CREATE", 
      existing_db_id: org.existing_db_id || null,
      name: org.name,
      parent_temp_id: org.parentId || null,
      details: {
        address: org.attributes?.address || "",
        tel: org.attributes?.tel || "",
        province: org.attributes?.province || ""
        // Note: latitude, longitude, type_fondue_group are expected to be handled/defaulted by Backend
      },
      locations: org.areas?.locations?.map(loc => {
        const prov = loc.province || "";
        const dist = loc.amphoe || ""; // react-thailand-address uses amphoe for district
        const sub = loc.tambon || ""; // react-thailand-address uses tambon for subdistrict
        
        // Find 6-digit DOPA code
        const lookupKey = `${prov}_${dist}_${sub}`;
        const code = addressCodeLookup.get(lookupKey) || "";

        return {
          province: prov,
          district: dist,
          subdistrict: sub,
          zipcode: loc.zipcode || "",
          code: code // Extracted DOPA 6-digit code
        };
      }) || []
    };
  });

  return {
    metadata: {
      version: "1.0",
      exported_at: new Date().toISOString(),
      total_nodes: nodes.length
    },
    nodes
  };
};
