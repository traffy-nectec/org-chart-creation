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
