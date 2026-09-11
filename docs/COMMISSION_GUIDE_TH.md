# คู่มือตรวจสอบ Commission แบบครบ Flow

## ความหมายของคำสำคัญ

| คำ | ความหมาย |
|---|---|
| Seller / Case Owner | คนขายคอร์สและเจ้าของ Commission Pool ของคอร์สนั้น |
| Treating PT | นักกายภาพที่รักษาคนไข้จริงใน Visit นั้น |
| Commission Tier | เปอร์เซ็นต์ที่ได้จากยอดขาย Course รวมของพนักงานในเดือนนั้น |
| Locked Commission Rate | Rate ที่ถูก Freeze หลังปิดเดือนและติดอยู่กับ Course เดิม |
| Course Commission Pool | เงิน Commission รวมของ Course ทั้งคอร์ส |
| Commission Allocation / Visit | Commission ที่แบ่งไว้ต่อการใช้บริการ 1 ครั้ง |
| Gross Commission Allocated | เงินที่ถูกตัดจาก Pool ตาม Visit ก่อนหักค่ารักษาแทน |
| Treatment Fee | ค่ามือของ Treating PT เมื่อรักษาแทน Case Owner |
| Treatment Fee Transfer | เงินที่โอนจาก Gross Commission ไปให้ Treating PT |
| Owner Net Commission | เงินที่ Case Owner ได้จริงหลังหัก Treatment Fee |
| Commission Outstanding | Commission ที่ยังเหลือ เพราะคนไข้ยังใช้คอร์สไม่ครบ |
| Commission Generated | Pool ที่เกิดจาก Course ที่ขายใหม่ในช่วงเวลานั้น |
| Allocation Ledger | ประวัติการแบ่งเงินของแต่ละ Visit เพื่อใช้ตรวจสอบย้อนหลัง |
| Monthly Closing | ขั้นตอนปิดยอดขายรายเดือนและ Freeze Rate |

## สูตรหลัก

```text
Course Commission Pool = Net Course Sale Amount × Locked Commission Rate
Commission / Visit = Course Commission Pool ÷ จำนวน Visit ที่คิด Commission
Gross Commission = Commission / Visit × จำนวน Visit ที่ใช้
Owner Net Commission = Gross Commission - Treatment Fee
Commission Outstanding = Course Pool - Gross Commission ที่จัดสรรไปแล้ว
```

## Flow ที่ต้องเช็คจริง

### 1. ตั้งค่า Commission Tier

ไปที่:

```text
Administration > Commission Tiers
```

ตรวจว่า:

- มีช่วงยอดขายครบ
- ช่วงไม่ซ้อนกัน
- ไม่มี Gap ที่ไม่ตั้งใจ
- Rate ไม่ติดลบและไม่เกิน 100%
- มี Tier สูงสุดแบบไม่กำหนด Maximum ได้

### 2. ตั้งค่า Treatment Fee

ไปที่:

```text
Administration > Treatment Fee Rules
```

สร้าง Rule ทดสอบ เช่น:

```text
Employee: ผู้รักษาแทน
Type: Fixed
Amount: 45 บาท / Visit
Effective From: วันนี้
```

ตรวจว่า Rule แสดงเป็น Active และสามารถแก้ไขหรือปิดใช้งานได้

### 3. สร้าง Course ให้ผู้ป่วย

ไปที่:

```text
Finance > Checkout
เลือกผู้ป่วย
เลือกแท็บ Course / Package
เลือก Course
เลือก Seller / Salesperson
เลือก Case Owner ถ้ามีช่องแยก
ชำระเงิน
```

ตรวจว่า:

- มี Course ID ใหม่
- มี Receipt No.
- มี Seller / Case Owner
- ราคาคอร์สถูกต้อง
- จำนวน Visit ถูกต้อง
- Course อยู่สถานะ Provisional ก่อนปิดเดือน

### 4. ตรวจ Monthly Closing

ไปที่:

```text
Administration > Monthly Closing
```

เลือกเดือนที่ขาย Course แล้วตรวจ:

- ยอดขายรวมของ Seller
- Suggested Rate
- Suggested Pool
- กด Close Month
- สถานะเปลี่ยนเป็น Closed
- Locked Rate ถูกบันทึก

### 5. คำนวณตัวอย่างด้วยมือ

ตัวอย่าง:

```text
ราคาคอร์สสุทธิ = 10,000 บาท
ยอดขายรายเดือนของ Seller = 75,000 บาท
Tier = 7%
จำนวน Visit = 10 ครั้ง
```

ผลที่ควรได้:

```text
Course Pool = 10,000 × 7% = 700 บาท
Commission / Visit = 700 ÷ 10 = 70 บาท
```

### 6. เช็คกรณีรักษาเอง

ให้ Case Owner เป็นผู้รักษา แล้ว Complete Appointment หรือใช้ Course 1 Visit

ผลที่ควรได้:

```text
Gross Commission = 70 บาท
Treatment Fee = 0 บาท
Owner Net Commission = 70 บาท
```

### 7. เช็คกรณีรักษาแทน

ให้ Treating PT เป็นคนอื่น แล้ว Complete Appointment หรือใช้ Course 1 Visit

ถ้า Treatment Fee = 45 บาท:

```text
Gross Commission = 70 บาท
Treatment Fee Transfer = 45 บาท
Owner Net Commission = 25 บาท
```

ต้องตรวจว่าไม่เกิด Commission Tier ใหม่ให้ Treating PT และไม่มียอด 45 บาทถูกบวกซ้ำเป็นค่าใช้จ่ายอีกก้อน

### 8. เช็ค Appointment และ Calendar

ไปที่:

```text
Overview > Calendar
Patient > Appointment & Visits
```

สร้างนัดหมายโดยเลือก:

- Patient
- วันที่และเวลา
- Service
- Physiotherapist
- Room

จากนั้นเปลี่ยนสถานะ:

```text
Confirmed > Arrived > In Service > Completed
```

เมื่อ Complete และผู้ป่วยมี Course ที่ Active ระบบจะเลือก Course ที่ยังมี Balance และตัด 1 Visit จาก Course นั้น จากนั้นสร้าง Commission Allocation ตาม Rate ที่ Freeze ไว้

### 9. เช็ค Report

ไปที่:

```text
Report > Course Commission
```

ตรวจตัวเลข:

- Monthly Course Sales
- Commission Generated
- Gross Allocated
- Owner Net
- Treatment Fee
- Adjustment
- Outstanding
- Total Variable Pay

ไปที่:

```text
Report > Commission Audit
```

ตรวจประวัติการเปลี่ยนแปลงและเหตุผลของ Admin/Finance

### 10. เช็ค Shared Course

ไปที่:

```text
Patient > Patient Courses
เลือก Course > Transfer / Shared Course
```

ให้ผู้ป่วยอีกคนใช้ Course เดิม แล้วตรวจว่า:

- ใช้ Course ID เดิม
- Balance รวมลดลงจากกองเดียวกัน
- ไม่มียอดขายใหม่
- ไม่เกิด Commission Pool ใหม่

## จุดที่ต้องระวังตอนทดสอบ

- Single Visit หรือ Assessment ไม่ควรต้องเลือก Salesperson
- Course Purchase ต้องมี Seller / Case Owner
- Visit เดือนถัดไปต้องใช้ Locked Rate ของเดือนที่ขาย Course
- เปลี่ยน Tier ภายหลังต้องไม่เปลี่ยน Course ที่ปิดเดือนไปแล้ว
- Treatment Fee ต้องหักจาก Gross Commission เดิม ไม่ใช่บวกเพิ่มซ้ำ
- ใช้ Visit เกิน Balance ต้องไม่ผ่าน
- Owner Net Commission ต้องไม่ติดลบ
- Refund ต้องสร้าง Adjustment และห้ามลบประวัติเดิม

## ผล Automated Test ปัจจุบัน

```text
InputRulesTest: 19 ผ่าน, 0 เฟล
RequestValidationTest: 7 ผ่าน, 0 เฟล
CommissionFlowTest: 22 ผ่าน, 0 เฟล
รวม: 48 ผ่าน, 0 เฟล
```

## ข้อจำกัดที่ควรตรวจเพิ่มใน Demo

- ถ้าผู้ป่วยมีหลาย Course ที่ Active ระบบจะเลือก Course ที่หมดอายุก่อน
- การ Complete Appointment จะตัด Course อัตโนมัติเฉพาะเมื่อผู้ป่วยมี Balance ที่ใช้ได้
- ราคาที่ใช้คำนวณ Pool ปัจจุบันคือราคาสุทธิหลังส่วนลด ควรยืนยันกับอาจารย์ว่าเป็นนโยบายที่ต้องการหรือไม่
