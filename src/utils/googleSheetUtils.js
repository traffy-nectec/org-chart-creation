/**
 * Extracts Spreadsheet ID and GID from a Google Sheets URL.
 * @param {string} url - The Google Sheets URL
 * @returns {{ spreadsheetId: string, gid: string } | null} Returns an object with IDs or null if invalid
 */
export const extractGoogleSheetIds = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/');
    
    const dIndex = pathParts.indexOf('d');
    if (dIndex === -1 || dIndex + 1 >= pathParts.length) {
      return null;
    }
    
    const spreadsheetId = pathParts[dIndex + 1];
    
    // GID can be in hash (#gid=...) or search params (?gid=...)
    let gid = '0'; // Default GID is 0 for the first sheet
    
    if (parsedUrl.hash.includes('gid=')) {
      const hashParams = new URLSearchParams(parsedUrl.hash.replace('#', '?'));
      if (hashParams.has('gid')) {
        gid = hashParams.get('gid');
      }
    } else if (parsedUrl.searchParams.has('gid')) {
      gid = parsedUrl.searchParams.get('gid');
    }

    return { spreadsheetId, gid };
  } catch {
    // Invalid URL format
    return null;
  }
};

/**
 * Fetches Google Sheet data as CSV using the Visualization API endpoint.
 * @param {string} spreadsheetId 
 * @param {string} gid 
 * @returns {Promise<string>} The CSV text content
 */
export const fetchGoogleSheetAsCSV = async (spreadsheetId, gid = '0') => {
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is required');
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}`);
  }
  
  const text = await response.text();
  
  // The gviz API might return HTML if the sheet is not public. Let's do a basic check.
  // A typical Google login/error page contains <!DOCTYPE html>
  if (text.trim().toLowerCase().startsWith('<!doctype html>')) {
    throw new Error('Sheet is not public. Please set sharing to "Anyone with the link can view".');
  }
  
  return text;
};
