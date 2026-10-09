# LA BALANCE Clinic ERP

ระบบบริหารคลินิกกายภาพบำบัด LA BALANCE ใช้จัดการคนไข้ นัดหมาย การชำระเงิน คอร์ส ค่าคอมมิชชัน และรายงาน รองรับหลายสาขา

| ส่วน | เทคโนโลยี |
|---|---|
| หน้าเว็บ (frontend) | Next.js, React, TypeScript, Tailwind CSS |
| ระบบหลังบ้าน (backend / API) | Java 21, Spring Boot 3, Spring Security |
| ฐานข้อมูล | PostgreSQL 16 (สร้างตารางอัตโนมัติด้วย Flyway) |
| การรันระบบ | Docker และ Docker Compose |

> **อ่านไม่รู้เรื่องตรงไหน ไม่ต้องกังวล** ทำตามหัวข้อ [เริ่มใช้งานครั้งแรก](#2-เริ่มใช้งานครั้งแรก) ทีละขั้นก็เปิดระบบได้ ไม่ต้องเขียนโค้ดเป็น

---

## สารบัญ

1. [สิ่งที่ต้องติดตั้งก่อน](#1-สิ่งที่ต้องติดตั้งก่อน)
2. [เริ่มใช้งานครั้งแรก](#2-เริ่มใช้งานครั้งแรก)
3. [ใส่ข้อมูลตัวอย่าง (ไม่บังคับ)](#3-ใส่ข้อมูลตัวอย่าง-ไม่บังคับ)
4. [ใช้งานประจำวัน: เปิด ปิด อัปเดต](#4-ใช้งานประจำวัน-เปิด-ปิด-อัปเดต)
5. [ไฟล์ `.env` คืออะไร](#5-ไฟล์-env-คืออะไร)
6. [ตั้งค่าอีเมล (ลืมรหัสผ่าน)](#6-ตั้งค่าอีเมล-ลืมรหัสผ่าน)
7. [ตั้งค่า Google Calendar (ไม่บังคับ)](#7-ตั้งค่า-google-calendar-ไม่บังคับ)
8. [แก้ปัญหาที่พบบ่อย](#8-แก้ปัญหาที่พบบ่อย)
9. [สำหรับนักพัฒนา](#9-สำหรับนักพัฒนา)
10. [Deploy ขึ้นเซิร์ฟเวอร์จริง](#10-deploy-ขึ้นเซิร์ฟเวอร์จริง)
11. [เอกสารอื่นในโปรเจกต์](#11-เอกสารอื่นในโปรเจกต์)

---

## 1. สิ่งที่ต้องติดตั้งก่อน

ติดตั้งแค่ 2 โปรแกรมนี้ก็รันระบบได้

| โปรแกรม | ใช้ทำอะไร | ดาวน์โหลด |
|---|---|---|
| **Git** | ดาวน์โหลดโค้ดจาก GitHub | https://git-scm.com/downloads (Mac ส่วนใหญ่มีอยู่แล้ว) |
| **Docker Desktop** | รันระบบทั้งหมด (เว็บ, API, ฐานข้อมูล) โดยไม่ต้องลง Java/Node เอง | https://www.docker.com/products/docker-desktop/ |

แนะนำเพิ่ม (ไม่บังคับ): **VS Code** สำหรับเปิดดูและแก้ไฟล์ https://code.visualstudio.com/

**เช็คว่าติดตั้งสำเร็จ** เปิดโปรแกรม **Terminal** (Mac: กด `⌘ + Space` พิมพ์ `Terminal` แล้วกด Enter) แล้วพิมพ์ทีละบรรทัด:

```bash
git --version
```

```bash
docker --version
```

ถ้าขึ้นเลขเวอร์ชัน เช่น `git version 2.x` และ `Docker version 2x.x` แปลว่าพร้อมแล้ว

> **ผู้ใช้ Windows:** ให้ใช้โปรแกรม **Git Bash** (ติดมากับ Git) แทน Terminal เพราะต้องรันคำสั่ง `bash` ในขั้นตอนถัดไป

> **พื้นที่ดิสก์:** ควรมีที่ว่างอย่างน้อย **15 GB** ถ้าดิสก์เต็ม Docker จะค้างและเปิดไม่ขึ้น

---

## 2. เริ่มใช้งานครั้งแรก

ทำครั้งเดียวต่อเครื่อง ใช้เวลาประมาณ 10–15 นาที (ส่วนใหญ่คือรอ build)

### ขั้นที่ 1: เปิด Docker Desktop

เปิดแอป **Docker Desktop** แล้วรอจนไอคอนวาฬด้านบนจอ (Mac) หรือมุมล่างขวา (Windows) ขึ้นว่า **Docker Desktop is running**

### ขั้นที่ 2: ดาวน์โหลดโค้ด

ใน Terminal พิมพ์:

```bash
git clone -b dev https://github.com/MUDST-2026-MuarKuenPhomNonMaiRub/Physiotherapy-Clinic.git
```

แล้วเข้าไปในโฟลเดอร์โปรเจกต์:

```bash
cd Physiotherapy-Clinic
```

> ทุกคำสั่งต่อจากนี้ต้องรัน**ในโฟลเดอร์ `Physiotherapy-Clinic`** ถ้าปิด Terminal ไปแล้วเปิดใหม่ ให้ `cd` เข้าโฟลเดอร์นี้ก่อนทุกครั้ง

### ขั้นที่ 3: สร้างไฟล์ตั้งค่า `.env`

```bash
bash setup-local.sh
```

สคริปต์จะสร้างไฟล์ `.env` พร้อมรหัสลับที่สุ่มให้ และ**แสดงรหัสผ่าน admin แค่ครั้งเดียว** หน้าตาประมาณนี้:

```
  Admin email:    admin@example.com
  Admin password: 3f9a1c...
```

**คัดลอกรหัสผ่านนี้เก็บไว้ทันที** ใช้ล็อกอินครั้งแรก (ถ้าลืม ดูได้ในไฟล์ `.env` บรรทัด `BOOTSTRAP_ADMIN_PASSWORD`)

### ขั้นที่ 4: Build และเปิดระบบ

```bash
docker compose up -d --build
```

ครั้งแรกใช้เวลา **5–10 นาที** เพราะต้องดาวน์โหลดและ build ทุกอย่าง รอจนกลับมาที่บรรทัดพิมพ์คำสั่ง และมีข้อความ `Started` ครบ

เช็คว่าทุกส่วนทำงาน:

```bash
docker compose ps
```

ต้องเห็น `backend`, `frontend`, `postgres`, `mailpit` ขึ้นสถานะ `Up` หรือ `running`

### ขั้นที่ 5: เข้าใช้งาน

เปิดเบราว์เซอร์ไปที่ **http://localhost:3000**

- Email: `admin@example.com`
- Password: รหัสจากขั้นที่ 3

> ต้องเข้าด้วย `localhost:3000` เท่านั้น **ห้ามใช้ `127.0.0.1:3000`** ไม่อย่างนั้นจะล็อกอินแล้วเด้งกลับหน้า login

🎉 เสร็จแล้ว! ระบบจะสร้างตารางและข้อมูลตั้งต้น (บริการ คอร์ส ห้อง วิธีชำระเงิน) ให้อัตโนมัติ

---

## 3. ใส่ข้อมูลตัวอย่าง (ไม่บังคับ)

ถ้าอยากเห็นทุกหน้ามีข้อมูล (คนไข้ นัดหมาย ใบเสร็จ คอร์ส คอมมิชชันย้อนหลังประมาณ 3 เดือน และนัดหมายล่วงหน้า 2 สัปดาห์) ให้รันตอนระบบเปิดอยู่:

```bash
python3 database/seed/seed-demo.py
```

- ใช้ได้กับ**ฐานข้อมูลใหม่ที่ยังว่าง**เท่านั้น ถ้ามีคนไข้หรือนัดหมายอยู่แล้ว สคริปต์จะไม่ยอมรัน
- จะได้บัญชีนักกายภาพตัวอย่าง: `ploy.demo@example.com`, `fah.demo@example.com`, `tee.demo@example.com`, `mint.demo@example.com`, `beam.demo@example.com` รหัสผ่านดูได้ใน `.env` บรรทัด `DEMO_STAFF_PASSWORD`
- **ห้ามรันกับฐานข้อมูลที่ใช้ร่วมกันในทีมหรือฐานข้อมูลจริงเด็ดขาด**

---

## 4. ใช้งานประจำวัน: เปิด ปิด อัปเดต

| อยากทำอะไร | คำสั่ง |
|---|---|
| เปิดระบบ (หลังเปิดเครื่องใหม่) | `docker compose up -d` |
| ปิดระบบ (ข้อมูลไม่หาย) | `docker compose down` |
| ดูว่าอะไรรันอยู่ | `docker compose ps` |
| ดู log ของ backend | `docker compose logs -f backend` (กด `Ctrl + C` เพื่อออก) |
| ดู log ของหน้าเว็บ | `docker compose logs -f frontend` |
| รีสตาร์ทแค่ backend (เช่น หลังแก้ `.env`) | `docker compose up -d backend` |

**อัปเดตเป็นโค้ดล่าสุดจากทีม:**

```bash
git pull
```

```bash
docker compose up -d --build
```

**ที่อยู่ของแต่ละส่วน (ตอนรันบนเครื่อง):**

| ส่วน | ที่อยู่ |
|---|---|
| หน้าเว็บ | http://localhost:3000 |
| API (backend) | http://localhost:8080 |
| กล่องอีเมลทดสอบ (Mailpit) | http://localhost:8025 (รับอีเมลที่พอร์ต `1025`) |
| ฐานข้อมูล PostgreSQL | `localhost:5432` |

> ⚠️ `docker compose down -v` (มี `-v`) จะ**ลบข้อมูลในฐานข้อมูลทั้งหมด** ใช้เฉพาะตอนตั้งใจล้างข้อมูลเท่านั้น

---

## 5. ไฟล์ `.env` คืออะไร

`.env` คือไฟล์เก็บค่าตั้งค่าและรหัสลับของเครื่องคุณ สร้างจาก `setup-local.sh` อยู่ที่โฟลเดอร์หลักของโปรเจกต์

> 🔒 **ห้าม commit ไฟล์ `.env` ขึ้น GitHub และห้ามส่งรหัสในไฟล์นี้ในแชท** (`.gitignore` กันไว้ให้แล้ว)

ค่าที่ควรรู้จัก (ดูตัวอย่างครบทุกค่าได้ใน `.env.example`):

| ค่า | ความหมาย | ต้องแก้ไหม |
|---|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | บัญชี admin คนแรกที่ระบบสร้างให้ตอนเริ่มครั้งแรก | ไม่ต้อง (สคริปต์ตั้งให้) |
| `APP_JWT_SECRET` | รหัสลับสำหรับ session ล็อกอิน | ไม่ต้อง (สคริปต์สุ่มให้) |
| `POSTGRES_*`, `DATABASE_*` | การเชื่อมต่อฐานข้อมูล | ไม่ต้อง ถ้าใช้ฐานข้อมูลในเครื่อง |
| `DATABASE_URL_DOCKER`, `DATABASE_USERNAME_DOCKER`, `DATABASE_PASSWORD_DOCKER` | ใช้เมื่อทีมอยากใช้ฐานข้อมูลบน cloud ร่วมกัน | ใส่เฉพาะถ้าทีมใช้ฐานข้อมูลกลาง |
| `APP_TIMEZONE` | เขตเวลาของคลินิก (ค่าเริ่มต้น `Asia/Bangkok`) | ไม่ต้อง |
| `APP_FRONTEND_URL` | ที่อยู่หน้าเว็บ ใช้สร้างลิงก์ในอีเมลและ Google Calendar | ต้องแก้ตอน deploy จริง |
| `SMTP_*`, `MAIL_FROM` | การส่งอีเมล ดู [หัวข้อ 6](#6-ตั้งค่าอีเมล-ลืมรหัสผ่าน) | ใส่เมื่ออยากส่งอีเมลจริง |
| `GOOGLE_*` | Google Calendar ดู [หัวข้อ 7](#7-ตั้งค่า-google-calendar-ไม่บังคับ) | ใส่เมื่ออยากใช้ฟีเจอร์นี้ |

แก้ `.env` แล้วต้องรีสตาร์ท backend ทุกครั้ง: `docker compose up -d backend`

---

## 6. ตั้งค่าอีเมล (ลืมรหัสผ่าน)

หน้า login มีปุ่ม **"Forgot password?"** ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปทางอีเมล
- ลิงก์ใช้ได้ครั้งเดียว และหมดอายุใน 30 นาที
- ขอลิงก์ใหม่แล้ว ลิงก์เก่าจะใช้ไม่ได้ทันที
- ขอได้ไม่เกิน 3 ครั้งใน 15 นาทีต่ออีเมล
- ถ้ากรอกอีเมลที่ไม่มีในระบบ หน้าจอจะขึ้นเหมือนกัน แต่ไม่มีอีเมลส่งไป (ตั้งใจออกแบบไว้ กันคนสุ่มเดาอีเมล) ทดสอบต้องใช้อีเมลของบัญชีที่มีอยู่จริง
- เปลี่ยนรหัสสำเร็จแล้ว อุปกรณ์อื่นที่ล็อกอินค้างไว้จะถูกออกจากระบบ

### แบบที่ 1: ทดสอบบนเครื่อง (ไม่ต้องตั้งค่าอะไร)

ถ้าไม่ได้ใส่ `SMTP_HOST` ใน `.env` อีเมลทั้งหมดจะไปเข้า **Mailpit** กล่องอีเมลทดสอบในเครื่อง เปิดดูได้ที่ **http://localhost:8025** (ไม่ได้ส่งออกไปจริง)

### แบบที่ 2: ส่งเข้า Gmail จริง

1. เข้า https://myaccount.google.com/security แล้วเปิด **2-Step Verification**
2. เข้า https://myaccount.google.com/apppasswords สร้าง App Password จะได้รหัส 16 ตัว (ต้องใช้ App Password **ไม่ใช่รหัส Gmail ปกติ**)
3. เพิ่มใน `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=youremail@gmail.com
   SMTP_PASSWORD=รหัส16ตัวแบบไม่มีเว้นวรรค
   SMTP_AUTH=true
   SMTP_STARTTLS=true
   MAIL_FROM=LA BALANCE Physical Therapy Clinic <youremail@gmail.com>
   ```
4. รีสตาร์ท backend: `docker compose up -d backend`

> ตอนรันบนเครื่อง ลิงก์ในอีเมลจะเป็น `http://localhost:3000/...` กดได้เฉพาะบนเครื่องที่รันระบบอยู่ ตอน deploy จริงลิงก์จะเป็นโดเมนตาม `APP_FRONTEND_URL`

> ⚠️ ลิงก์ในอีเมลใช้เปลี่ยนรหัสบัญชีนั้นได้เลย **อย่าแคปหน้าจอที่เห็นลิงก์ส่งในกลุ่ม** ถ้าเผลอส่งไป ให้กดขอลิงก์ใหม่ ลิงก์เก่าจะใช้ไม่ได้ทันที

---

## 7. ตั้งค่า Google Calendar (ไม่บังคับ)

นักกายภาพแต่ละคนเชื่อม Google Calendar ของตัวเองได้ นัดหมายจะถูกส่งไปลงปฏิทินให้อัตโนมัติ
- เป็นการส่งทางเดียว ระบบคลินิกเป็นข้อมูลหลัก ถ้าไปแก้นัดใน Google ระบบจะเขียนทับในรอบถัดไป
- ในนัดที่ส่งไป Google มีแค่ชื่อเล่น (หรือ HN) ของคนไข้ บริการ ห้อง สาขา และลิงก์กลับเข้าระบบ **ไม่ส่งชื่อเต็มหรือเบอร์โทรของคนไข้**

ถ้าไม่ตั้งค่า `GOOGLE_CLIENT_ID` ฟีเจอร์นี้จะปิดอยู่ ระบบส่วนอื่นใช้งานได้ปกติ

**ตั้งค่าครั้งเดียวต่อระบบ:**

1. ใน [Google Cloud Console](https://console.cloud.google.com/) สร้างโปรเจกต์ แล้วเปิด **Google Calendar API**
2. ตั้งค่า **OAuth consent screen**
   - ถ้าคลินิกใช้ Google Workspace ให้เลือก *Internal* ไม่ต้องรอ Google ตรวจสอบ
   - ถ้าใช้ Gmail ธรรมดาให้เลือก *External* ตอนแรกจะอยู่ในโหมด *Testing* ใช้ได้เฉพาะอีเมลที่เพิ่มไว้ใน **Audience → Test users** และสิทธิ์จะหมดอายุทุก 7 วัน ถ้าจะใช้งานจริงให้กด **Publish app**
3. สร้าง **OAuth client ID** ชนิด *Web application* แล้วใส่ Authorized redirect URI เป็น `http://localhost:8080/api/v1/integrations/google/callback` (ตอนรันบนเครื่อง)
4. ใส่ใน `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:8080/api/v1/integrations/google/callback
   APP_FRONTEND_URL=http://localhost:3000
   ```
5. รีสตาร์ท backend: `docker compose up -d backend`

**วิธีใช้งาน:** นักกายภาพกดเมนูบัญชี (มุมขวาบน) → **Connect Google Calendar**
- นัดที่มีอยู่จะถูกส่งไปทันที และหลังจากนั้นการจอง เลื่อน ยกเลิก หรือปิดนัด จะตามไปเองทุกครั้ง
- กดยกเลิกการเชื่อม หรือปิดใช้งานพนักงานคนนั้น นัดของคลินิกจะถูกลบออกจากปฏิทินของเขา
- ถ้าส่งไม่สำเร็จ มีปุ่ม **Retry** ที่หน้ารายละเอียดนัด และปุ่ม **Reconnect** ที่หน้า Google Calendar settings

---

## 8. แก้ปัญหาที่พบบ่อย

<details>
<summary><b>หน้า login ขึ้นว่า "Cannot reach the clinic server"</b></summary>

backend ยังไม่ทำงาน หรือสตาร์ทไม่ผ่าน

1. รัน `docker compose ps` ดูว่า `backend` ขึ้น `Up` ไหม
2. ถ้าไม่ขึ้น ดูสาเหตุด้วย `docker compose logs backend --tail 50`
3. ถ้าเจอคำว่า `Migration checksum mismatch` ดูหัวข้อถัดไป
4. ถ้าเพิ่งรัน `docker compose up` อาจยังสตาร์ทไม่เสร็จ รอ 30 วินาทีแล้วรีเฟรชหน้า
</details>

<details>
<summary><b>backend ไม่ขึ้น: "Migration checksum mismatch" หรือ "Detected applied migration not resolved locally"</b></summary>

เกิดจากมีคนแก้หรือลบไฟล์ migration (`backend/src/main/resources/db/migration/V*.sql`) ที่เคยรันกับฐานข้อมูลไปแล้ว

- **ฐานข้อมูลในเครื่อง และไม่มีข้อมูลที่ต้องเก็บ:** ล้างแล้วสร้างใหม่
  ```bash
  docker compose down -v
  ```
  ```bash
  docker compose up -d --build
  ```
- **ฐานข้อมูลกลางของทีม หรือมีข้อมูลที่ต้องเก็บ: ห้ามล้าง** ให้ใช้คำสั่ง `repair` ของ Flyway แทน คำสั่งนี้แก้แค่ตารางประวัติ migration ไม่แตะข้อมูลจริง และ**ต้องบอกในกลุ่มทีมก่อนรันกับฐานข้อมูลกลาง** จะได้ไม่รันซ้ำกันพร้อมกัน
  ```bash
  docker run --rm \
    -v "$(pwd)/backend/src/main/resources/db/migration:/flyway/sql" \
    flyway/flyway:11 \
    -url="<ค่า DATABASE_URL_DOCKER แบบ jdbc:postgresql://...>" \
    -user="<DATABASE_USERNAME_DOCKER>" -password="<DATABASE_PASSWORD_DOCKER>" \
    repair
  ```
  จากนั้นรัน `docker compose up -d --build` ตามปกติ

**กฎของทีม:** ไฟล์ migration ที่ขึ้นไปแล้ว **ห้ามแก้หรือลบ** ถ้าจะเปลี่ยนโครงสร้างตาราง ให้สร้างไฟล์ใหม่ `V<เลขถัดไป>__คำอธิบาย.sql` เสมอ
</details>

<details>
<summary><b>ล็อกอินถูกแล้วแต่เด้งกลับหน้า login</b></summary>

ต้องเข้าที่ `http://localhost:3000` ไม่ใช่ `http://127.0.0.1:3000` เพราะ session ล็อกอินเก็บเป็น cookie ที่ผูกกับชื่อ `localhost`
</details>

<details>
<summary><b>ลืมรหัสผ่าน admin</b></summary>

- ถ้ายังเป็น admin คนแรก ดูได้ในไฟล์ `.env` บรรทัด `BOOTSTRAP_ADMIN_PASSWORD` ถ้ายังไม่เคยเปลี่ยนรหัส
- หรือกด **Forgot password?** ที่หน้า login แล้วเปิดอีเมลใน Mailpit ที่ http://localhost:8025
</details>

<details>
<summary><b>"port is already allocated" / พอร์ตถูกใช้อยู่</b></summary>

มีโปรแกรมอื่นใช้พอร์ต 3000, 8080, 5432, 8025 หรือ 1025 อยู่ เช่นรัน `npm run dev` ค้างไว้ หรือมี PostgreSQL อีกตัวในเครื่อง ให้ปิดโปรแกรมนั้นก่อน

ถ้าชนกับ PostgreSQL ในเครื่อง เปลี่ยนพอร์ตได้ด้วยการตั้ง `POSTGRES_PORT=5433` ใน `.env`
</details>

<details>
<summary><b>Docker ค้าง / เปิดไม่ขึ้น / build ไม่เดิน</b></summary>

ส่วนใหญ่เกิดจาก**ดิสก์เต็ม**

1. เช็คพื้นที่ว่าง ควรเหลืออย่างน้อย 10–15 GB
2. ถ้า Docker ยังทำงานอยู่ ล้าง image และ cache เก่า (ไม่ลบข้อมูลฐานข้อมูล):
   ```bash
   docker builder prune -af
   ```
   ```bash
   docker image prune -af
   ```
3. ถ้า Docker ค้างทั้งระบบ ให้ Quit Docker Desktop จากไอคอนวาฬ แล้วเปิดใหม่
</details>

<details>
<summary><b>กดลืมรหัสผ่านแล้วอีเมลไม่มา</b></summary>

1. ถ้ายังไม่ได้ตั้ง SMTP อีเมลจะอยู่ใน Mailpit ที่ http://localhost:8025 ไม่ได้ไปที่ Gmail
2. ดูในโฟลเดอร์สแปม
3. ต้องใช้อีเมลของบัญชีที่มีอยู่ในระบบ และบัญชีต้องยังเปิดใช้งานอยู่
4. ขอได้ไม่เกิน 3 ครั้งใน 15 นาทีต่ออีเมล
5. ดู log: `docker compose logs backend --tail 100 | grep -i mail` ถ้าเจอ `Authentication failed` แปลว่า App Password ผิด
</details>

<details>
<summary><b>แก้โค้ดแล้วหน้าเว็บไม่เปลี่ยน</b></summary>

ระบบที่รันผ่าน Docker เป็นโค้ดที่ build ไว้แล้ว ต้อง build ใหม่: `docker compose up -d --build`

ถ้าแก้โค้ดบ่อย ให้ใช้วิธีรันแบบ hot reload ใน [หัวข้อ 9](#รันแบบ-hot-reload-แก้โค้ดแล้วเห็นผลทันที)
</details>

---

## 9. สำหรับนักพัฒนา

### โครงสร้างโปรเจกต์

```
Physiotherapy-Clinic/
├── frontend/                  หน้าเว็บ Next.js
│   └── src/
│       ├── app/               หน้าต่างๆ (1 โฟลเดอร์ = 1 URL)
│       │   ├── (app)/         หน้าที่ต้องล็อกอิน
│       │   ├── login/         หน้าเข้าสู่ระบบ
│       │   ├── forgot-password/, reset-password/
│       ├── components/        UI ที่ใช้ซ้ำ
│       └── lib/               api (เรียก backend), domain (กฎธุรกิจ), i18n (ภาษาไทย), store
├── backend/                   API Spring Boot
│   └── src/main/
│       ├── java/com/physiocare/clinic/
│       │   ├── controller/    รับ HTTP request เท่านั้น
│       │   ├── service/       กฎธุรกิจ
│       │   ├── repository/    SQL / การอ่านเขียนฐานข้อมูล
│       │   ├── model/, dto/   โครงสร้างข้อมูล
│       │   ├── security/, config/
│       │   └── integration/google/   Google Calendar
│       └── resources/db/migration/   ไฟล์สร้างตาราง V1__..., V2__... (Flyway)
├── database/seed/             สคริปต์ข้อมูลตัวอย่าง
├── deploy/Caddyfile           ตั้งค่า HTTPS ตอน deploy
├── docs/                      คู่มือภาษาไทย
├── docker-compose.yml             สำหรับรันบนเครื่อง
└── docker-compose.production.yml  สำหรับเซิร์ฟเวอร์จริง
```

**การแปลภาษา:** หน้าเว็บเขียนข้อความเป็นภาษาอังกฤษ แล้วแปลเป็นไทยผ่าน `frontend/src/lib/i18n/translations.ts` ถ้าเพิ่มข้อความใหม่ ให้เพิ่มคำแปลในไฟล์นี้ด้วย

### รันแบบ hot reload (แก้โค้ดแล้วเห็นผลทันที)

ต้องติดตั้งเพิ่ม: **Java 21** และ **Node.js 22** แล้วเปิด Terminal 3 หน้าต่าง

หน้าต่างที่ 1: ฐานข้อมูล (และกล่องอีเมลทดสอบ)
```bash
docker compose up -d postgres mailpit
```

หน้าต่างที่ 2: backend
```bash
bash backend/run-local.sh
```

หน้าต่างที่ 3: frontend
```bash
cd frontend && npm install && npm run dev
```

- ถ้าก่อนหน้านี้รันผ่าน Docker อยู่ ให้ `docker compose stop backend frontend` ก่อน ไม่อย่างนั้นพอร์ตจะชนกัน
- `run-local.sh` จะโหลดค่าจาก `.env` ให้เอง ถ้ารัน `./mvnw spring-boot:run` ตรงๆ จะขึ้น error `Could not resolve placeholder 'APP_JWT_SECRET'`
- ถ้าอยากส่งอีเมลเข้า Mailpit ตอนรันแบบนี้ ใส่ `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_AUTH=false`, `SMTP_STARTTLS=false` ใน `.env`

### รันเทส

Backend: unit test ไม่ต้องใช้ฐานข้อมูล
```bash
cd backend && ./mvnw test
```

Backend: เทสคอมมิชชันและ Google Calendar ที่ใช้ PostgreSQL จริง สคริปต์จะสร้างฐานข้อมูลชั่วคราวแล้วลบทิ้งเอง ต้องเปิด Docker ไว้ ถ้าพอร์ต `15433` ไม่ว่างให้ตั้ง `IT_DB_PORT` เป็นพอร์ตอื่น และ**ห้ามชี้เทสไปที่ฐานข้อมูลจริง**
```bash
cd backend && bash run-commission-tests.sh
```

Frontend: lint และ build
```bash
cd frontend && npm run lint && npm run build
```

CI บน GitHub (`.github/workflows/ci.yml`) จะรันเทสเหล่านี้ให้อัตโนมัติเมื่อ push เข้า `dev` หรือ `main` และเมื่อเปิด Pull Request เข้า 2 branch นี้ ผลทดสอบล่าสุดดูได้ใน `docs/TESTING_TH.md`

### วิธีทำงานร่วมกันใน Git

- `dev`: branch หลักที่ใช้พัฒนา งานทุกอย่างรวมกันที่นี่
- `uat`: เวอร์ชันที่ส่งให้ลูกค้าทดสอบ (merge มาจาก `dev`)

ขั้นตอนเมื่อจะทำงานใหม่:

```bash
git switch dev
```
```bash
git pull
```
```bash
git switch -c feat/ชื่องาน
```

แก้เสร็จแล้ว commit แล้ว push ขึ้น GitHub แล้วเปิด Pull Request เข้า `dev` ให้เพื่อนรีวิว

```bash
git push -u origin feat/ชื่องาน
```

**กฎสำคัญ:**
- ห้าม commit `.env` หรือรหัสผ่านใดๆ
- ห้ามแก้หรือลบไฟล์ migration ที่ขึ้นไปแล้ว ให้สร้างไฟล์ใหม่แทน
- ใช้ `git add ชื่อไฟล์` ทีละไฟล์ ดีกว่า `git add .` จะได้ไม่เผลอ commit ไฟล์ที่ไม่ตั้งใจ

---

## 10. Deploy ขึ้นเซิร์ฟเวอร์จริง

ใช้ `docker-compose.production.yml` ซึ่งมี **Caddy** ทำหน้าที่ขอใบรับรอง HTTPS ให้อัตโนมัติ ไฟล์นี้ไม่มี Mailpit (ใช้แค่ตอนพัฒนา)

**สิ่งที่ต้องมี:**
- เซิร์ฟเวอร์ Linux ที่ติดตั้ง Docker แล้ว และเปิดพอร์ต 80 และ 443
- โดเมน เช่น `clinic.example.com` ที่ชี้ (DNS A record) มาที่ IP ของเซิร์ฟเวอร์
- บัญชีอีเมลสำหรับส่งอีเมลลืมรหัสผ่าน **ควรเป็นบัญชีที่ลูกค้าเป็นเจ้าของเอง**

**ขั้นตอน:**

1. Clone โค้ดลงเซิร์ฟเวอร์ (ใช้ branch ที่จะปล่อยจริง)
2. คัดลอกไฟล์ตัวอย่าง:
   ```bash
   cp .env.production.example .env
   ```
3. แก้ `.env` ให้ครบ:
   - `PUBLIC_DOMAIN`: โดเมนของระบบ
   - `APP_FRONTEND_URL`: `https://` ตามด้วยโดเมนเดียวกัน (ใช้สร้างลิงก์ในอีเมล ถ้าตั้งผิดลิงก์จะกดไม่ได้)
   - `POSTGRES_PASSWORD`, `APP_JWT_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`: ตั้งเป็นค่ายาวและสุ่ม สร้างได้ด้วย `openssl rand -base64 32` (`APP_JWT_SECRET` ต้องเป็นค่าจากคำสั่งนี้)
   - `SMTP_*`, `MAIL_FROM`: บัญชีอีเมลของลูกค้า
   - `GOOGLE_*`: ถ้าใช้ Google Calendar (`GOOGLE_REDIRECT_URI` = `https://โดเมน/api/v1/integrations/google/callback`)
4. เปิดระบบ:
   ```bash
   docker compose -f docker-compose.production.yml up -d --build
   ```
5. ตรวจหลัง deploy:
   - เปิด `https://โดเมน` แล้วล็อกอินด้วย admin ได้
   - **เปลี่ยนรหัส admin ทันที**
   - ลองกด Forgot password ด้วยอีเมลจริง เช็คว่าอีเมลเข้า และลิงก์เป็นโดเมนจริงที่กดได้
   - ถ้าใช้ Google Calendar ลองเชื่อมบัญชีหนึ่งบัญชี

**อัปเดตเวอร์ชันบนเซิร์ฟเวอร์:**
```bash
git pull && docker compose -f docker-compose.production.yml up -d --build
```

Migration ใหม่จะรันเองตอน backend สตาร์ท ข้อมูลเดิมไม่หาย

**ควรเขียนไว้ในเอกสารส่งมอบลูกค้า:**
- ระบบส่งอีเมลจากบัญชีไหน ใครเป็นเจ้าของ
- ถ้าเปลี่ยนรหัสอีเมล หรือ App Password ถูกเพิกถอน ต้องสร้าง App Password ใหม่แล้วใส่ใน `.env` ไม่อย่างนั้นอีเมลลืมรหัสผ่านจะหยุดส่งโดยไม่มีอะไรแจ้งเตือน (มีบอกแค่ใน log ของ backend)
- ใครดูแลเซิร์ฟเวอร์ และวิธีสำรองข้อมูลฐานข้อมูล

---

## 11. เอกสารอื่นในโปรเจกต์

| ไฟล์ | เนื้อหา |
|---|---|
| [`docs/USER_GUIDE_TH.md`](docs/USER_GUIDE_TH.md) | คู่มือการใช้งานระบบสำหรับพนักงานคลินิก |
| [`docs/COMMISSION_GUIDE_TH.md`](docs/COMMISSION_GUIDE_TH.md) | วิธีคิดค่าคอมมิชชัน |
| [`docs/TESTING_TH.md`](docs/TESTING_TH.md) | ผลการทดสอบระบบ |
| [`docs/requirments/`](docs/requirments/) | เอกสาร requirement และ feedback จากลูกค้า |
