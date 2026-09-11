# บันทึกผลการทดสอบระบบ

เอกสารนี้บันทึกผลการทดสอบระบบ LA BALANCE Clinic ERP สำหรับการส่งงานและการตรวจสอบภายใน

## สภาพแวดล้อมที่ใช้ทดสอบ

- Branch: `dev3`
- Backend: Spring Boot 3.5.5, Java 21 target
- Database: PostgreSQL 16
- Frontend: Next.js 16.3.0
- เครื่องมือทดสอบ: JUnit 5 และ Spring Boot Test

## ผลการทดสอบล่าสุด — 11 กันยายน 2026

| ชุดทดสอบ | ขอบเขตการทดสอบ | ผ่าน | ไม่ผ่าน | Error | ข้าม | ผลลัพธ์ |
|---|---|---:|---:|---:|---:|---|
| `InputRulesTest` | กฎการตรวจสอบข้อมูลแบบ Unit Test | 19 | 0 | 0 | 0 | ผ่าน |
| `RequestValidationTest` | ตรวจ request ของ Auth, Patient, Service, Course, Appointment และ Checkout | 7 | 0 | 0 | 0 | ผ่าน |
| `CommissionFlowTest` | Flow คอมมิชชันกับ PostgreSQL ชั่วคราว | 21 | 0 | 0 | 0 | ผ่าน |
| **รวม Automated Test** |  | **47** | **0** | **0** | **0** | **ผ่าน** |

## บันทึก Test ที่ไม่ผ่าน

ผลการรันล่าสุด: **ไม่มี Test ที่ไม่ผ่าน**

- Failed: 0
- Error: 0
- Skipped: 0
- รายการที่ต้องแก้ไขจากผลการรันครั้งนี้: ไม่มี

หมายเหตุการรันซ้ำ: มีการลองรันซ้ำในเครื่องตรวจสอบ แต่ Maven เขียนไฟล์ลง
`backend/target/classes` ไม่ได้ (`Operation not permitted`) จึงเป็นปัญหา
สิทธิ์ของสภาพแวดล้อม ไม่ใช่ Test ที่ไม่ผ่าน และไม่ได้นับเป็น Failed Test

ถ้ารอบถัดไปมีปัญหา จะบันทึกชื่อชุดทดสอบ, ชื่อ Test, ช่องหรือเงื่อนไขที่มีปัญหา,
ค่าที่คาดหวัง, ผลที่ได้จริง และสถานะการแก้ไขไว้ในหัวข้อนี้

## รายการที่ตรวจด้วย Unit Test

`InputRulesTest` ตรวจสอบกฎเหล่านี้โดยไม่ใช้ฐานข้อมูล:

- ช่องที่จำเป็นต้องกรอก และค่าที่อนุญาตให้เลือก
- จำนวนเงิน: ห้ามติดลบ, จำนวนเงินสูงสุด และจำนวนทศนิยม
- ช่วงตัวเลข และระยะเวลา Service
- วันเกิด: ห้ามเป็นอนาคต และต้องไม่เก่าเกินสมเหตุสมผล
- เลขบัตรประชาชนไทยต้องมี 13 หลัก
- เลข Passport ต้องมีตัวอักษรหรือตัวเลข 5–20 ตัว
- เบอร์โทรศัพท์ต้องมีตัวเลข 10 หลัก
- รูปแบบ Email
- วันนัดหมาย: ห้ามย้อนหลัง และจองล่วงหน้าได้ไม่เกิน 2 ปี
- ชื่อผู้ป่วยภาษาไทย
- ความยาวข้อความสูงสุด

`RequestValidationTest` ตรวจสอบช่องที่จำเป็นและข้อจำกัดพื้นฐานของ:

- การสร้างผู้ใช้และกฎความปลอดภัยของรหัสผ่าน
- การลงทะเบียนผู้ป่วย
- การสร้าง Service และ Course
- การสร้างนัดหมาย
- Checkout และรายการส่วนลด/ค่าใช้จ่ายเพิ่มเติม

### ช่องที่ตรวจสอบครบใน RequestValidationTest

| ส่วนงาน | ช่องที่ตรวจสอบ | ผล |
|---|---|---|
| สร้างผู้ใช้ | email, password, firstName, lastName, role | ผ่าน |
| Patient | customerType, prefix, firstNameTh, lastNameTh, genderCode, phone, registeredBranchId | ผ่าน |
| Service | nameTh, serviceType, durationMinutes, basePrice | ผ่าน |
| Course | nameTh, totalSessions, bonusSessions, validityDays, price | ผ่าน |
| Appointment | patientId, branchId, providerStaffId, serviceId, startsAt, endsAt | ผ่าน |
| Checkout | patientId, branchId, paymentMethodId | ผ่าน |
| Adjustment | label, amount และกรณีค่าติดลบสำหรับส่วนลด | ผ่าน |

หมายเหตุ: ตารางนี้เป็นการตรวจ Validation ของ Request DTO ทุกช่องที่กำหนดเป็น
Required/มีข้อจำกัดพื้นฐาน ไม่ได้หมายความว่าครอบคลุมการทดสอบทุกเส้นทางของหน้าเว็บ
หรือทุกกรณีของฐานข้อมูล

### วิธีรันใน IntelliJ IDEA

เปิดไฟล์ `InputRulesTest.java` แล้วคลิกขวา เลือก **Run**

ผลที่ควรได้:

```text
19 tests passed
```

### วิธีรันใน Terminal

รันจากโฟลเดอร์ `backend`:

```bash
./mvnw -Dtest=InputRulesTest test -B
```

ถ้าต้องการรัน Unit Test ทั้งกฎกลางและ Request DTO:

```bash
./mvnw -Dtest=InputRulesTest,RequestValidationTest test -B
```

ผลล่าสุดที่รันสำเร็จ: `26 tests passed, 0 failed`

## รายการที่ตรวจด้วย Integration Test

`CommissionFlowTest` ทดสอบการทำงานร่วมกันของระบบ Service และ PostgreSQL จริง
โดยใช้ฐานข้อมูลชั่วคราวที่สร้างขึ้นสำหรับการทดสอบเท่านั้น:

- อัตราคอมมิชชันถูกบันทึกไว้ตามช่วงเวลาที่ซื้อคอร์ส
- คอร์สเก่ายังจ่ายคอมมิชชันได้แม้เดือนนั้นไม่มีการขายใหม่
- ไม่สามารถใช้คอร์สเกินจำนวนคงเหลือ
- การคำนวณค่าธรรมเนียมของนักกายภาพผู้รักษาแทน
- การคำนวณค่าธรรมเนียมแบบจำนวนเงินคงที่และแบบเปอร์เซ็นต์
- เจ้าของคอร์สได้รับคอมมิชชันเต็มเมื่อรักษาเอง
- นโยบายกรณีค่าคอมมิชชันเกินวงเงิน
- การใช้คอร์สร่วมกันหลายผู้ป่วย
- การปัดเศษและยอดรวมของกองคอมมิชชัน
- การยกเลิกหรือปรับปรุงรายการใช้งานคอร์ส

ฐานข้อมูลทดสอบจะถูกลบอัตโนมัติหลังทดสอบเสร็จ และไม่กระทบฐานข้อมูลหลักของระบบ

### วิธีรัน

รันจากโฟลเดอร์ `backend`:

```bash
bash run-commission-tests.sh
```

ผลที่ควรได้:

```text
Tests run: 21, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## การตรวจสอบหน้าเว็บแบบเบื้องต้น

ตรวจสอบ route หลักของระบบแล้ว ได้แก่:

- Services / Treatment และ Courses
- Dashboard
- Checkout
- Calendar
- Patients
- Appointments
- Reports

ผลตรวจ Docker:

- Frontend ทำงานที่ port 3000
- Backend health endpoint แสดงสถานะ `UP` ที่ port 8080
- PostgreSQL แสดงสถานะ `healthy` ที่ port 5432

## สรุปสำหรับนำเสนอ

ระบบมี Automated Test ทั้งหมด **47 รายการ ผ่าน 47 รายการ ไม่ผ่าน 0 รายการ**

โดย Unit Test ใช้ตรวจฟังก์ชัน validation แยกเป็นส่วน ๆ และ Integration Test
ใช้ตรวจการทำงานร่วมกันของระบบคอมมิชชันกับ PostgreSQL จริง
