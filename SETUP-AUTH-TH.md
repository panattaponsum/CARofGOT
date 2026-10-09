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

## ตั้งค่าผู้ดูแลระบบ (Admin)

1. เพิ่มพนักงานในทะเบียนให้มีสถานะ `ใช้งาน` และให้พนักงานสมัครบัญชีตามขั้นตอนปกติให้สำเร็จก่อน สคริปต์จะกำหนดสิทธิ์ให้บัญชีที่สมัครแล้วเท่านั้น
2. บัญชี Google ที่ใช้รันสคริปต์ต้องมีสิทธิ์จัดการผู้ใช้ Firebase Authentication ในโปรเจกต์ `carforrent-d4b1e` โดยมอบหมายบทบาท **Firebase Authentication Admin** ที่หน้า **Google Cloud Console > IAM** ให้บัญชีนั้น สิทธิ์นี้เป็นของผู้รันสคริปต์ ไม่ใช่ role ของพนักงาน
3. ติดตั้ง **Google Cloud CLI** หากยังไม่มี โดยดาวน์โหลดและติดตั้งสำหรับ Windows จาก [คู่มือ Google Cloud CLI](https://cloud.google.com/sdk/docs/install) ระหว่างติดตั้งให้เลือกตัวเลือกเพิ่ม `gcloud` ลงใน `PATH` หากมีให้เลือก จากนั้นปิด PowerShell แล้วเปิดใหม่
4. ตรวจสอบว่า PowerShell เรียกใช้ CLI ได้:

```powershell
gcloud --version
```

หากยังขึ้นว่า `gcloud` ไม่รู้จัก ให้ตรวจว่าติดตั้ง Google Cloud CLI แล้ว และเปิด PowerShell ใหม่หลังติดตั้ง (ถ้ายังไม่พบ ให้เรียกตัวติดตั้งอีกครั้งและตรวจตัวเลือกเพิ่มลงใน `PATH`)

5. จากโฟลเดอร์รากของโปรเจกต์ เปิด PowerShell แล้วล็อกอิน Application Default Credentials ด้วยบัญชี Google ที่ได้รับสิทธิ์ จากนั้นกำหนด role ให้พนักงาน:

```powershell
gcloud auth application-default login
cd functions
node set-admin-role.js EMPLOYEE_ID
```

แทนที่ `EMPLOYEE_ID` ด้วยรหัสจริง เช่น `node set-admin-role.js 12345` โดยรหัสต้องประกอบด้วยตัวอักษร ตัวเลข จุด ขีดกลาง หรือขีดล่าง และยาวไม่เกิน 40 ตัว สคริปต์ทำงานกับโปรเจกต์ `carforrent-d4b1e` และจะแจ้งข้อผิดพลาดหากไม่พบบัญชีหรือกำหนดสิทธิ์ไม่สำเร็จ

6. ให้ผู้ดูแลออกจากระบบแล้วเข้าสู่ระบบใหม่ เพื่อรับ custom claim `role=admin` ใน ID token จากนั้นทดสอบการใช้งานหน้าแอดมินและสิทธิ์ Firestore

กำหนดสิทธิ์เฉพาะบัญชีที่เชื่อถือได้เท่านั้น การเพิ่มเอกสารใน Firestore หรือแก้ข้อมูลในชีตไม่สามารถใช้แทนการกำหนด admin claim ได้

## ข้อมูลที่ระบบใช้

- อ่านหัวตารางจากชีต `ชีต1`: `สังกัด`, `ตำแหน่ง`, `รหัสพนักงาน`, `ชื่อ-สกุล`, `เบอร์โทรศัพท์`, `สถานะบัญชี`
- ผู้สมัครยืนยัน OTP ด้วยเบอร์มือถือที่กรอก โดย Cloud Function ตรวจเทียบกับเบอร์ในทะเบียนก่อนสร้างบัญชี
- รหัสผ่านอยู่ใน Firebase Authentication เท่านั้น ไม่บันทึกลงชีตหรือ Firestore
- โปรไฟล์สร้างโดย Cloud Function; ผู้ใช้เปิดอ่านได้เฉพาะโปรไฟล์ตนเองและแก้ไขไม่ได้
- การสร้างรายการจองตรวจสอบจากโปรไฟล์พนักงานที่ Cloud Function สร้างและ UID เจ้าของบัญชี ไม่ขึ้นกับ role claim ใน ID token; ส่วนสิทธิ์ผู้ดูแลยังใช้ custom claim `role=admin`
- เบอร์โทรที่แนบกับการจองเก็บแยกใน `bookingContacts`; อ่านได้เฉพาะเจ้าของรายการและ admin

ก่อนเปิดให้พนักงานใช้จริง ให้ทดลองสมัคร/ล็อกอิน/ออกจากระบบและตรวจสิทธิ์ Firestore ด้วยบัญชีทดสอบก่อน