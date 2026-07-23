---
type: module
title: "Frontend Organization Chart Builder (org-chart-creation)"
description: "โมดูลจัดเตรียม วาดผัง และตรวจสอบข้อมูลผังองค์กรฝั่งหน้าบ้าน พัฒนาด้วย React, ReactFlow และ IndexedDB"
resource: "/home/plagad/active/org-chart-creation/src/App.jsx"
tags: ["frontend", "react", "react-flow", "topological-sort", "indexeddb"]
timestamp: "2026-07-23"
---

# Frontend Module: Organization Chart Creation Tool

## 1. Context & Purpose
โมดูลนี้ทำหน้าที่เป็นอินเทอร์เฟซให้ผู้ใช้งาน (หรือแอดมิน) สามารถนำเข้าไฟล์ Excel/Google Sheets ขนาดใหญ่ (เช่น `MOE.xlsx` 35,000+ รายการ) เพื่อสร้าง วาด ปรับแต่งลำดับชั้น และตรวจสอบความสะอาดของข้อมูลก่อนส่งเข้าฐานข้อมูลหลัก

## 2. Core Technical Concepts

### 2.1 Kahn's Algorithm (Topological Sort)
* รันบน Client-side ก่อนส่งออกข้อมูล เพื่อการันตีว่า **หน่วยงานต้นสังกัดจะเรียงอยู่ก่อนหน้าหน่วยงานลูก** และป้องกันปัญหาผังวงกลม (Circular Dependencies)

### 2.2 Performance Optimizations
* **O(N) Map Lookups:** ปรับอัลกอริทึมสร้าง Tree จาก O(N²) เป็น O(N) ด้วย Map Data Structures
* **IndexedDB Auto-save:** บันทึกแบบร่าง (Draft) ลง IndexedDB เพื่อรองรับข้อมูลนับหมื่นรายการโดยไม่เกิดปัญหา Quota Exceeded ของ LocalStorage
* **Chunked API Processing:** ส่งข้อมูลตรวจสอบชื่อซ้ำ (Similarity Check) ทีละ 200 รายการ เพื่อแสดง Progress Bar และป้องกันเบราว์เซอร์ค้าง

### 2.3 Embedded Integration & Root-Only Policy
* รองรับการนำไปฝัง (Embed) ในเว็บหลัก Traffy Fondue โดยรับ `user_id`, `member_id`, และ `currentOrgId` จากระบบ Login เดิม
* บังคับใช้ **Root-Only Policy**: หาก `currentOrgId` ของผู้ใช้ไม่ใช่โหนด Root ของผัง ปุ่ม Export และ Approve จะถูกล็อกโดยอัตโนมัติ

## 3. Usage Guidelines
* **Dev Server:** `npm run dev` ภายในโฟลเดอร์ `org-chart-creation`
* **Test Suites:** `npm run test` (Vitest) และ `npm run lint` (ESLint)
