# 💅 Nail Kloset Staff PWA

แอปบันทึกงานพนักงาน — รองรับ Add to Home Screen (PWA)

---

## 📁 โครงสร้างไฟล์

```
nail-kloset-staff/
├── index.html          ← หน้าหลัก PWA
├── manifest.json       ← PWA manifest (ชื่อ, icon, theme)
├── sw.js               ← Service Worker (cache + offline)
├── css/
│   └── app.css         ← Stylesheet ทั้งหมด
├── js/
│   ├── app.js          ← Logic หลัก (UI, navigation, state)
│   └── api.js          ← GAS bridge (fetch wrapper ทุก call)
├── icons/
│   ├── icon-192.png    ← ต้องสร้างเอง (ดูข้อ 3)
│   └── icon-512.png    ← ต้องสร้างเอง
└── StaffAPI.gs         ← วางใน Google Apps Script Project
```

---

## 🚀 วิธี Deploy บน GitHub Pages

### ขั้นตอนที่ 1 — สร้าง GitHub Repo

```bash
git init
git add .
git commit -m "init: Nail Kloset Staff PWA"
git remote add origin https://github.com/YOUR_USERNAME/nail-kloset-staff.git
git push -u origin main
```

### ขั้นตอนที่ 2 — เปิด GitHub Pages

1. ไปที่ **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / folder: **/ (root)**
4. กด Save → รอประมาณ 2 นาที
5. URL จะเป็น: `https://YOUR_USERNAME.github.io/nail-kloset-staff/`

### ขั้นตอนที่ 3 — สร้าง Icons

สร้างไฟล์ icon 2 ขนาดวางใน `/icons/`:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

**วิธีเร็วสุด** — ใช้ Canva หรือ [favicon.io](https://favicon.io) แล้ว export เป็น PNG

### ขั้นตอนที่ 4 — ใส่ GAS Script ID

เปิด `js/api.js` แก้บรรทัด:
```js
const GAS_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```
เปลี่ยน `YOUR_SCRIPT_ID` เป็น Script ID จาก Google Apps Script

### ขั้นตอนที่ 5 — เพิ่ม StaffAPI.gs ใน Apps Script

1. เปิด Google Apps Script Project (ที่มี Code.gs อยู่แล้ว)
2. กด **+** เพิ่มไฟล์ใหม่ ตั้งชื่อ `StaffAPI`
3. วาง code จากไฟล์ `StaffAPI.gs` ทั้งหมด
4. เปิด `api.gs` เดิม ใน `_handleWebAPI()` เพิ่ม case ใหม่:

```javascript
case 'getStaffComm':         result = _getStaffComm(p);         break;
case 'getStaffTodayRecords': result = _getStaffTodayRecords(p); break;
case 'getStaffSummary':      result = _getStaffSummary(p);      break;
```

5. **Deploy → Manage Deployments → สร้าง Deployment ใหม่**
   - Execute as: **Me**
   - Who has access: **Anyone**

---

## 🔐 วิธีเข้าสู่ระบบ (พนักงาน)

หน้า login จะถามสองอย่าง:
1. **ชื่อพนักงาน** — ชื่อที่ลงทะเบียนใน LINE Bot แล้ว (เช่น `Alex`)
2. **LINE UserID** — ขึ้นต้นด้วย `U` ตามด้วยตัวเลข/ตัวอักษร

**วิธีดู LINE UserID ของพนักงาน:**
- ให้พนักงานส่งข้อความอะไรก็ได้ใน LINE Bot
- Admin ดูได้จาก Sheet `พนักงาน` คอลัมน์ A

---

## 📲 วิธี Add to Home Screen

### iOS (Safari)
1. เปิด URL ด้วย Safari
2. กดปุ่ม Share (กลาง toolbar)
3. เลือก **"Add to Home Screen"**
4. กด Add

### Android (Chrome)
1. เปิด URL ด้วย Chrome
2. จะมี banner ปรากฏ "Add to Home Screen"
3. หรือกดเมนู (⋮) → "Install app"

---

## 🛠 CORS — ทำไม GAS ถึงทำงานได้

GAS ไม่รองรับ `Access-Control-Allow-Origin` header โดยตรง แต่ทำงานได้เพราะ:

- **GET requests**: GAS ตอบกลับ JSON ปกติ, browser รับได้เพราะ GAS redirect ผ่าน `https://script.google.com`
- **POST requests**: `api.js` ส่ง `Content-Type: text/plain` → ไม่มี preflight OPTIONS → ผ่าน CORS

ถ้าเจอ CORS error ให้ตรวจสอบ:
1. GAS Deployment ตั้ง "Who has access: **Anyone**"
2. URL ใน `api.js` ถูกต้อง (ไม่มี `/dev` ท้าย)
3. Script ถูก Deploy ใหม่หลังแก้ไข

---

## 🔄 อัปเดตแอป

เมื่อแก้ไขไฟล์ใดๆ:
```bash
git add .
git commit -m "update: [รายละเอียด]"
git push
```
GitHub Pages อัปเดตอัตโนมัติภายใน 1-2 นาที

Service Worker (`sw.js`) จะ cache เวอร์ชันเก่าไว้  
แก้ `CACHE_NAME = 'nail-staff-v2'` (เพิ่มเลข) ทุกครั้งที่ deploy ใหม่

---

## 📋 Features

| Feature | สถานะ |
|---------|--------|
| บันทึกงาน | ✅ |
| ค่าคอมอัตโนมัติ | ✅ |
| ค้นหาสมาชิก | ✅ |
| เติมเงินสมาชิก | ✅ |
| สมัครสมาชิกใหม่ | ✅ |
| สรุปยอดรายวัน/อาทิตย์/เดือน | ✅ |
| Add to Home Screen (PWA) | ✅ |
| Offline mode (อ่าน cache) | ✅ |
| Push notification | 🔜 |
| Dark mode | 🔜 |
"# nail-staff" 
