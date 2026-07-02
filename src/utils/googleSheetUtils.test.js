/* eslint-disable no-undef */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractGoogleSheetIds, fetchGoogleSheetAsCSV } from './googleSheetUtils';

describe('googleSheetUtils', () => {
  describe('extractGoogleSheetIds', () => {
    it('should extract spreadsheetId and gid from a full URL', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1L3SWCPymDdvauBq0UQ5K1qmD88ZMrSfDZGJXv8XWUJk/edit?gid=1886707079#gid=1886707079';
      const result = extractGoogleSheetIds(url);
      
      expect(result).not.toBeNull();
      expect(result.spreadsheetId).toBe('1L3SWCPymDdvauBq0UQ5K1qmD88ZMrSfDZGJXv8XWUJk');
      expect(result.gid).toBe('1886707079');
    });

    it('should extract spreadsheetId and default gid if gid is missing', () => {
      const url = 'https://docs.google.com/spreadsheets/d/abc123XYZ/edit';
      const result = extractGoogleSheetIds(url);
      
      expect(result).not.toBeNull();
      expect(result.spreadsheetId).toBe('abc123XYZ');
      expect(result.gid).toBe('0');
    });

    it('should handle URL with gid in search params', () => {
      const url = 'https://docs.google.com/spreadsheets/d/testId/edit?gid=999';
      const result = extractGoogleSheetIds(url);
      
      expect(result).not.toBeNull();
      expect(result.spreadsheetId).toBe('testId');
      expect(result.gid).toBe('999');
    });

    it('should return null for invalid URL', () => {
      expect(extractGoogleSheetIds('not-a-url')).toBeNull();
      expect(extractGoogleSheetIds(null)).toBeNull();
      expect(extractGoogleSheetIds(undefined)).toBeNull();
      expect(extractGoogleSheetIds('https://google.com')).toBeNull();
    });
  });

  describe('fetchGoogleSheetAsCSV', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should fetch CSV data successfully', async () => {
      const mockCsv = 'col1,col2\nval1,val2';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockCsv),
      });

      const result = await fetchGoogleSheetAsCSV('testId', '123');
      
      expect(global.fetch).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/testId/gviz/tq?tqx=out:csv&gid=123');
      expect(result).toBe(mockCsv);
    });

    it('should throw error if fetch fails (not ok)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fetchGoogleSheetAsCSV('testId')).rejects.toThrow('Failed to fetch Google Sheet: 404 Not Found');
    });

    it('should throw error if response is HTML (not public)', async () => {
      const htmlResponse = '<!DOCTYPE html><html><body>Login</body></html>';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlResponse),
      });

      await expect(fetchGoogleSheetAsCSV('testId')).rejects.toThrow('Sheet is not public. Please set sharing to "Anyone with the link can view".');
    });

    it('should throw error if spreadsheetId is missing', async () => {
      await expect(fetchGoogleSheetAsCSV('')).rejects.toThrow('Spreadsheet ID is required');
    });
  });
});
