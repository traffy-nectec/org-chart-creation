import { describe, it, expect } from 'vitest';
import { getOrgPath } from './exportUtils';

describe('getOrgPath', () => {
  const mockOrganizations = [
    { id: '1', name: 'กระทรวงมหาดไทย', parentId: null },
    { id: '2', name: 'กรมการปกครอง', parentId: '1' },
    { id: '3', name: 'ที่ว่าการอำเภอ', parentId: '2' },
    { id: '4', name: 'เทศบาลตำบล', parentId: '3' },
    { id: '5', name: 'ไม่ระบุต้นสังกัด', parentId: '99' }, // invalid parent
  ];

  it('should return the name of the root organization', () => {
    expect(getOrgPath('1', mockOrganizations)).toBe('กระทรวงมหาดไทย');
  });

  it('should return correct path for a child organization', () => {
    expect(getOrgPath('2', mockOrganizations)).toBe('กระทรวงมหาดไทย.กรมการปกครอง');
  });

  it('should return correct path for a deeply nested organization', () => {
    expect(getOrgPath('4', mockOrganizations)).toBe('กระทรวงมหาดไทย.กรมการปกครอง.ที่ว่าการอำเภอ.เทศบาลตำบล');
  });

  it('should return empty string for unknown organization id', () => {
    expect(getOrgPath('unknown', mockOrganizations)).toBe('');
  });

  it('should handle broken parent links gracefully', () => {
    // Expected: just returns itself because parent '99' is not found
    expect(getOrgPath('5', mockOrganizations)).toBe('ไม่ระบุต้นสังกัด');
  });
});
