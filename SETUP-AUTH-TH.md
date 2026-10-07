# ตั้งค่าระบบบัญชีพนักงาน

## เตรียมทะเบียนพนักงาน

1. เปลี่ยนการแชร์ Google Sheet เป็น **Restricted** และแชร์แบบ Viewer ให้ service account ของ Firebase Functions เท่านั้น
2. ตรวจให้รหัสพนักงานไม่ซ้ำ และข้อมูลเบอร์มือถือคอลัมน์ G ถูกต้องในรูปแบบหมายเลขโทรศัพท์ไทย
3. เพิ่มคอลัมน์ H ชื่อ `สถานะบัญชี` และใส่ `ใช้งาน` เฉพาะพนักงานที่อนุญาตให้สมัคร ระบบจะปฏิเสธแถวที่สถานะอื่นหรือว่าง
4. เปิด Google Sheets API ใน Google Cloud project `carforrent-d4b1e`

## ตั้งค่า Firebase

1. เปิด Authentication providers: **Phone** และ **Email/Password** (Email/Password ใช้เป็นกลไกภายในสำหรับบัญชีที่กรอก employee ID)
2. เพิ่ม domain ที่ใช้เปิดเว็บใน Authentication > Settings > Authorized domains การทดสอบ SMS ต้องเปิดผ่าน `localhost` หรือโดเมนที่อนุญาต ไม่ใช่ `file://`
3. Cloud Functions และการส่ง SMS ต้องใช้แผน Firebase ที่รองรับ billing; ตั้ง billing budget/alerts ก่อนเปิดใช้จริง
4. ติดตั้ง Firebase CLI และ Node.js 20 แล้วรัน `npm install` ในโฟลเดอร์ `functions`
5. Deploy ด้วย `firebase deploy --only functions,firestore:rules,hosting`
6. สมัครบัญชี employee ID ของผู้ดูแลก่อน จากนั้นตั้ง role แอดมินจากเครื่องที่มี Google Application Default Credentials และสิทธิ์ Firebase Admin:

```powershell
gcloud auth application-default login
cd functions
node set-admin-role.js EMPLOYEE_ID
```

ผู้ดูแลต้องออกจากระบบและเข้าสู่ระบบใหม่เพื่อรับ admin claim

## ข้อมูลที่ระบบใช้

- อ่านหัวตารางจากชีต `ชีต1`: `สังกัด`, `ตำแหน่ง`, `รหัสพนักงาน`, `ชื่อ-สกุล`, `เบอร์โทรศัพท์`, `สถานะบัญชี`
- ผู้สมัครยืนยัน OTP ด้วยเบอร์มือถือที่กรอก โดย Cloud Function ตรวจเทียบกับเบอร์ในทะเบียนก่อนสร้างบัญชี
- รหัสผ่านอยู่ใน Firebase Authentication เท่านั้น ไม่บันทึกลงชีตหรือ Firestore
- โปรไฟล์สร้างโดย Cloud Function; ผู้ใช้เปิดอ่านได้เฉพาะโปรไฟล์ตนเองและแก้ไขไม่ได้
- เบอร์โทรที่แนบกับการจองเก็บแยกใน `bookingContacts`; อ่านได้เฉพาะเจ้าของรายการและ admin

ก่อนเปิดให้พนักงานใช้จริง ให้ทดลองสมัคร/ล็อกอิน/ออกจากระบบและตรวจสิทธิ์ Firestore ด้วยบัญชีทดสอบก่อน