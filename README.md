# 💸 บัญชีส่วนตัว — Personal Finance Tracker

## วิธี Deploy ขึ้น Vercel

### 1. อัปโหลดขึ้น GitHub
1. ไปที่ github.com → สร้าง Repository ใหม่ ชื่อ `finance-tracker`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไป

### 2. Deploy ด้วย Vercel
1. ไปที่ vercel.com → กด "Add New Project"
2. เลือก Repository ที่เพิ่งสร้าง
3. เพิ่ม Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = https://msfstbwktqbwyiatutcd.supabase.co
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (ใส่ anon key ของคุณ)
4. กด Deploy!

## โครงสร้างไฟล์
```
finance-app/
├── src/
│   ├── app/
│   │   ├── layout.js
│   │   ├── page.js
│   │   └── FinanceApp.js   ← หลัก
│   └── lib/
│       └── supabase.js
├── package.json
├── next.config.js
└── .env.local              ← อย่าอัปโหลดไฟล์นี้ขึ้น GitHub!
```
