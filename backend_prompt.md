# Prompt สำหรับสร้าง Backend `fondue-org-importer` จากศูนย์

**คำแนะนำ:** คุณสามารถคัดลอกข้อความด้านล่างนี้ไปใช้เป็นสารตั้งต้นในการขึ้นโปรเจกต์ Backend ตัวใหม่ได้เลย

-------------------------------------------------------------------------

**Context (บริบท):**
เรากำลังพัฒนาระบบนำเข้าผังองค์กรระดับประเทศ (50,000+ รายการ) ชื่อโปรเจกต์คือ `fondue-org-importer` โดยรับช่วงต่อจากระบบ Frontend ที่พัฒนาเสร็จแล้ว หน้าที่ของ Backend คือรับไฟล์/Payload JSON ที่ผ่านการล้างข้อมูลและเรียงลำดับต้นสังกัด-ลูกน้องแบบ Topological Sort มาแล้ว หน้าที่หลักคือการนำข้อมูลเหล่านี้ บันทึกลงฐานข้อมูล PostgreSQL อย่างถูกต้อง รวดเร็ว และเชื่อมโยงสายบังคับบัญชา (Hierarchy / Materialized Path) ให้สมบูรณ์

**Tech Stack ที่ต้องการ:**
- ขอให้เขียนด้วย **Golang** 
- ใช้ Framework และ Library ให้น้อยที่สุดเท่าที่จำเป็น (Minimalist) 
- แนะนำให้ใช้ `net/http` มาตรฐาน หรือ Router น้ำหนักเบา (เช่น `chi` หรือ `gorilla/mux` ถ้าจำเป็นจริงๆ)
- การต่อ Database ให้ใช้ `pgx` หรือ `database/sql` ธรรมดา (หลีกเลี่ยง ORM หนักๆ เช่น GORM เพื่อประสิทธิภาพในการทำ Bulk Insert)
- **Database:** PostgreSQL

### 📋 สเปคการทำงานของระบบ (Requirements):

**1. รับ JSON Payload ขาเข้า (Endpoint: `POST /api/import`)**
โครงสร้างของ JSON ที่จะได้รับมีหน้าตาแบบนี้ (รับประกันว่าข้อมูลเรียงลำดับ พ่อ-ก่อน-ลูก เสมอ):
```json
{
  "metadata": { "version": "1.0", "total_nodes": 100 },
  "nodes": [
    {
      "temp_id": "uuid-1",
      "action": "CREATE",
      "existing_db_id": null,
      "name": "โรงพยาบาล ก.",
      "parent_temp_id": "uuid-0",
      "details": { "address": "", "tel": "" },
      "locations": [ { "code": "110102", "province": "นนทบุรี", "district": "เมือง", "subdistrict": "ตลาดขวัญ" } ]
    }
  ]
}
```

**2. กระบวนการประมวลผล (Processing Logic):**
เมื่อวนลูปอ่าน `nodes` แต่ละตัว:
- **กรณี `action == "CREATE"`:**
  - สร้างหน่วยงานใหม่ลงตาราง `voice_organization`
  - **สำคัญมาก (Lat/Lon Fallback):** ระบบ Frontend ไม่ได้ส่งพิกัดมาให้ ดังนั้นให้เอาค่า `locations[0].code` (รหัส DOPA 6 หลัก) ไป Query หาพิกัดละติจูดและลองจิจูดจากตาราง `voice_subdistrictlist` มาเติมให้ก่อน Insert ลงตารางหน่วยงาน
  - กำหนดค่า Default ที่บังคับ: `isClaim = true`, `isGenQR = true`, `official_group = true`
- **กรณี `action == "LINK"`:**
  - ไม่ต้องสร้างหน่วยงานใหม่ ให้ใช้ค่าจาก `existing_db_id` เป็น ID ของหน่วยงานนั้นได้เลย
- **การจัดการต้นสังกัด (Hierarchy):**
  - นำ ID ของตัวเอง (ไม่ว่าจะเป็น ID ใหม่ที่เพิ่ง Insert หรือ `existing_db_id`) ไปผูกกับ ID ของพ่อ (เทียบจาก `parent_temp_id`)
  - อัปเดตตารางสายบังคับบัญชา (เช่น `voice_hierarchy_org`) และสร้าง Materialized Path (เช่น `พ่อ.ลูก` -> `111.222`)

**3. API ค้นหาชื่อซ้ำ (Endpoint: `POST /api/similarity-check`)**
- ทำหน้าที่รับก้อน Array รายชื่อ (เช่น ก้อนละ 1,000 ชื่อ) และค้นหาว่าในตาราง `voice_organization` มีชื่อที่คล้ายกันเกิน 70% หรือไม่
- **เงื่อนไข:** ให้ใช้ Extension `pg_trgm` และฟังก์ชัน `similarity(a,b)` ของ PostgreSQL ในการค้นหา เพื่อประสิทธิภาพสูงสุด แทนการใช้ LIKE ธรรมดา

### 🚀 สิ่งที่คุณ (AI) ต้องทำ:
1. ออกแบบและเขียนโค้ด Endpoint สำหรับรับ JSON ขาเข้า (`POST /api/import`) 
2. เขียนสคริปต์วนลูปจัดการเงื่อนไข CREATE/LINK โดยใช้ Transaction ของ `pgx` เพื่อป้องกันข้อมูลพังครึ่งทาง (Rollback หากพัง)
3. เนื่องจากมีข้อมูล 50,000+ แถว ช่วยเขียนโค้ดรองรับการทำ Chunking / Bulk Insert หรือ Worker Pool ใน Golang เพื่อให้ทำงานเร็วและไม่กินแรมมากเกินไป
4. ช่วยเขียนโค้ดตัวอย่าง SQL Query สำหรับ `pg_trgm` ในการเช็คชื่อซ้ำแบบ Batch
5. เขียนให้คลีน มีการจัดการ Error Handling (เช่น โหนดพ่อยังไม่ถูกสร้างแต่ลูกมาถึงก่อน ซึ่งไม่ควรเกิดเพราะ Sort มาแล้ว)
