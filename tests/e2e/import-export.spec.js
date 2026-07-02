import { test, expect } from '@playwright/test';

test.describe('Import and Export Functionality', () => {
  
  test('should export organizations to CSV', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app to load
    await expect(page.locator('h1')).toBeVisible();

    // Close welcome modal
    await page.click('button:has-text("เริ่มต้นใช้งานระบบ")');

    // Open Data Management Menu
    await page.click('button:has-text("จัดการข้อมูล")');
    
    // Setup download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click Export as CSV
    await page.click('button:has-text("ส่งออกเป็น CSV")');
    
    // Wait for the download to start
    const download = await downloadPromise;
    
    // Verify download filename starts with "organizations_" and ends with ".csv"
    expect(download.suggestedFilename()).toMatch(/^organizations_.*\.csv$/);
  });

  test('should import organizations from CSV', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Close welcome modal
    await page.click('button:has-text("เริ่มต้นใช้งานระบบ")');

    // Open Data Management Menu
    await page.click('button:has-text("จัดการข้อมูล")');
    
    // Click Import
    await page.click('button:has-text("นำเข้าข้อมูล (Import)")');

    // Prepare mock CSV data
    // Need BOM \uFEFF for proper UTF-8 parsing if it's treated as Excel/CSV
    const csvContent = "\uFEFFกระทรวง,ชื่อหน่วยงานระดับกรม,ชื่อหน่วยงานระดับกอง,ชื่อหน่วยงานระดับกลุ่ม,จังหวัด,อำเภอ,ตำบล\nกระทรวงการทดสอบ,กรมจำลอง,กองทดสอบ,กลุ่มงานทดสอบ,กรุงเทพมหานคร,เขตปทุมวัน,แขวงปทุมวัน\n";
    
    // Upload file
    await page.setInputFiles('input[type="file"]', {
      name: 'test_import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
    });

    // Wait for file parsing to complete and the confirm button to appear
    const confirmButton = page.locator('button:has-text("ยืนยันการนำเข้าข้อมูล")');
    await expect(confirmButton).toBeVisible({ timeout: 10000 });

    // Click confirm
    await confirmButton.click();

    // Verify that the new node appears on the screen
    // The imported data should render in the Org Chart
    await expect(page.locator('text=กระทรวงการทดสอบ').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=กรมจำลอง').first()).toBeVisible();
  });
});
