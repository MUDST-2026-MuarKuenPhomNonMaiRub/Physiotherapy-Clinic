# บันทึกผลการทดสอบระบบ

เอกสารนี้บันทึกผลการทดสอบระบบ LA BALANCE Clinic ERP สำหรับการส่งงานและการตรวจสอบภายใน

## สภาพแวดล้อมที่ใช้ทดสอบ

- Branch: `dev3`
- Backend: Spring Boot 3.5.5, Java 21 target
- Database: PostgreSQL 16
- Frontend: Next.js 16.3.0
- เครื่องมือทดสอบ: JUnit 5 และ Spring Boot Test

## ผลการทดสอบล่าสุด — 12 กันยายน 2026

| ชุดทดสอบ | ขอบเขตการทดสอบ | ผ่าน | ไม่ผ่าน | Error | ข้าม | ผลลัพธ์ |
|---|---|---:|---:|---:|---:|---|
| `InputRulesTest` | กฎการตรวจสอบข้อมูลแบบ Unit Test | 23 | 0 | 0 | 0 | ผ่าน |
| `RequestValidationTest` | ตรวจ request ของ Auth, Patient, Service, Course, Appointment และ Checkout | 7 | 0 | 0 | 0 | ผ่าน |
| `CommissionFlowTest` | Flow คอมมิชชันกับ PostgreSQL จริงแบบชั่วคราว | 26 | 0 | 0 | 0 | ผ่าน |
| **รวม Automated Test** |  | **56** | **0** | **0** | **0** | **ผ่าน** |

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
- รหัสสาขาและเบอร์โทรศัพท์สาขา

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
23 tests passed
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

ผลล่าสุดที่รันสำเร็จ: `30 tests passed, 0 failed`

## รายการที่ตรวจด้วย Integration Test

`CommissionFlowTest` เป็น Integration Test เพราะทดสอบการทำงานร่วมกันของหลายส่วน
และใช้ PostgreSQL จริงผ่านฐานข้อมูลชั่วคราว
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
- การใช้คอร์สราคา 0 บาทโดยไม่สร้าง Payment
- การซื้อคอร์สและการล็อก Rate หลังปิดเดือน
- การโอนคอร์สให้ผู้รับใช้ต่อโดยไม่สร้าง Sale/Commission Pool ใหม่
- การแสดง Course Commission ที่ปล่อยแล้วในรายงาน Commission
- การเลือก Treatment Fee Rule ที่เจาะจงที่สุด

ฐานข้อมูลทดสอบจะถูกลบอัตโนมัติหลังทดสอบเสร็จ และไม่กระทบฐานข้อมูลหลักของระบบ

### วิธีรัน

รันจากโฟลเดอร์ `backend`:

```bash
bash run-commission-tests.sh
```

ผลที่ควรได้:

```text
Tests run: 26, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### รายการ Integration Test ทั้ง 26 กรณี

1. รักษา Tier เดิมไว้เมื่อเดือนถัดไปมียอดขายเพิ่ม
2. ปล่อยคอมมิชชันของคอร์สเก่าที่ไม่มีการขายใหม่
3. ใช้คอร์สผ่าน Appointment ที่เสร็จสมบูรณ์
4. ป้องกันการใช้คอร์สเกินยอดคงเหลือ
5. แบ่งค่าคอมแบบ Treatment Fee จำนวนเงินคงที่
6. เจ้าของคอร์สรักษาเองและได้รับ Gross เต็มจำนวน
7. แบ่งค่าคอมแบบ Treatment Fee เปอร์เซ็นต์
8. จำกัดยอด Allocation ไม่ให้เกิน Commission Pool
9. คำนวณเงินส่วนต่างแบบ Company Top-up
10. ป้องกันกรณีเงินไม่พอที่ต้องขออนุมัติ
11. Shared Course ใช้ Balance และ Pool เดิม
12. ยืนยันยอด Allocation รวมไม่เกิน Pool
13. ยกเลิกการใช้คอร์สก่อนจัดสรรคอมมิชชัน
14. ยกเลิกการใช้คอร์สหลังจัดสรรคอมมิชชันและสร้าง Reversal
15. Refund ครั้งที่เหลือโดยไม่กระทบคอมมิชชันที่ปล่อยแล้ว
16. Termination แบบ Forfeit
17. Termination แบบ Continue
18. ไม่จัดสรรคอมมิชชันให้คอร์ส Legacy ที่ไม่เข้าเงื่อนไข
19. ปิดเดือนเดิมซ้ำได้โดยไม่สร้างข้อมูลซ้ำ
20. ป้องกันการ Checkout ใช้คอร์สซ้ำ
21. ใช้คอร์สราคา 0 บาทได้โดยไม่สร้าง Payment
22. ซื้อคอร์สแล้วสร้าง Provisional Pool
23. ปิดเดือนแล้วล็อก Rate ของคอร์ส
24. โอนคอร์สให้ผู้รับใช้ต่อโดยไม่สร้าง Sale ใหม่
25. แสดงคอมมิชชันคอร์สที่ปล่อยแล้วในรายงาน Commission
26. เลือก Treatment Fee Rule ที่ตรงที่สุด และไม่หัก Fee เมื่อเจ้าของรักษาเอง

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

ระบบมี Automated Test ทั้งหมด **56 รายการ ผ่าน 56 รายการ ไม่ผ่าน 0 รายการ**

โดย Unit Test (`InputRulesTest`) ใช้ตรวจฟังก์ชัน validation แยกเป็นส่วน ๆ,
Request Validation Test ตรวจ DTO ก่อนเข้า API และ Integration Test
(`CommissionFlowTest`) ตรวจการทำงานร่วมกันของระบบคอมมิชชันกับ PostgreSQL จริง

## สิ่งที่ใช้ส่งอาจารย์

- ไฟล์ Test: `InputRulesTest`, `RequestValidationTest`, `CommissionFlowTest`
- ภาพผล IntelliJ หรือ Terminal ที่แสดงผลผ่านทั้งหมด
- ภาพ GitHub Actions ของ workflow `Clinic CI` เป็นสีเขียว
- ตารางผลการทดสอบด้านบน
- คำอธิบายความแตกต่างระหว่าง Unit Test และ Integration Test

## สิ่งที่ยังไม่ใช่ Automated Test

- การทดสอบหน้าเว็บแบบ End-to-End ยังต้องตรวจด้วยการเล่นจริง เช่น สร้างคนไข้,
  นัดหมาย, Checkout, ใช้คอร์ส, โอนคอร์ส และตรวจรายงาน
- Frontend ใน Pipeline ตรวจ `lint` และ `build` แต่ยังไม่มีชุด UI test อัตโนมัติ
