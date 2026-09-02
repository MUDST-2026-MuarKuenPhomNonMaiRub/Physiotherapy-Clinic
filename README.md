# PhysioCare Clinic

Starter monorepo based on the Clinic Figma design.

## Run with Docker

```bash
bash setup-local.sh
```

The first run creates the PostgreSQL database and a local bootstrap admin account.
The setup script generates a random admin password and prints it once. Do not
commit `.env`.

For a shared team database, use the **Shared Database setup** below. Do not use
`setup-local.sh` for that setup because it is intended to create a local `.env`.

Frontend: http://localhost:3000 · API: http://localhost:8080

To stop the application without deleting data:

```bash
docker compose down
```

For local development without Docker, start PostgreSQL with `docker compose up -d postgres`,
then run the backend and frontend in separate terminals.

## Structure

- `frontend/`: Next.js, React and TypeScript clinic ERP UI.
- `backend/`: Spring Boot 3 REST API with PostgreSQL, Flyway, Spring Security and JWT authentication.

## คู่มือสำหรับเพื่อนที่ clone หรือ pull โปรเจกต์

### 1. ติดตั้งโปรแกรมที่ต้องใช้

- Git
- Docker Desktop และ Docker Compose
- Node.js 20 ขึ้นไป (เฉพาะกรณีรัน frontend นอก Docker)
- Java 21 ขึ้นไป (เฉพาะกรณีรัน backend นอก Docker)

### 2. Clone repository และเลือก branch `dev3`

```bash
git clone https://github.com/MUDST-2026-MuarKuenPhomNonMaiRub/Physiotherapy-Clinic.git
cd Physiotherapy-Clinic
git checkout dev3
```

ถ้ามี repository อยู่แล้ว:

```bash
cd Physiotherapy-Clinic
git checkout dev3
git pull origin dev3
```

### 3. เปิด Docker Desktop

```bash
docker --version
docker compose version
```

### 4. เริ่มระบบครั้งแรก

รันจากโฟลเดอร์หลักของโปรเจกต์:

```bash
bash setup-local.sh
```

สคริปต์จะสร้าง `.env`, JWT secret, รหัสผ่าน admin, PostgreSQL, backend และ frontend พร้อมรัน Flyway migration อัตโนมัติ

เก็บค่า `Admin email` และ `Admin password` ที่แสดงใน terminal ไว้สำหรับเข้าสู่ระบบ

### 5. เปิดระบบใน browser

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Backend health check: http://localhost:8080/actuator/health

ค่า database local เริ่มต้นคือ:

```text
Database: physiocare
Host: localhost
Port: 5432
Username: physiocare
```

ถ้าเครื่องมี PostgreSQL ใช้ port `5432` อยู่แล้ว ให้เปิดระบบด้วย port `5433`:

```bash
POSTGRES_PORT=5433 docker compose up --build -d
```

กรณีนี้ backend และ frontend ยังเปิดที่ port `8080` และ `3000` ตามเดิม เพราะ backend เชื่อม PostgreSQL ผ่าน network ภายใน Docker

ตรวจสอบ container:

```bash
docker compose ps
docker compose logs -f backend
```

ถ้า frontend เปิดได้และ health check แสดง `{"status":"UP"}` ถือว่าใช้งานได้

### 6. เมื่อมี code ใหม่บน `dev3`

```bash
git checkout dev3
git pull origin dev3
docker compose up --build -d
```

เมื่อ backend เริ่มทำงาน Flyway จะรัน migration ใหม่ให้อัตโนมัติ ห้ามแก้ไขหรือลบ migration ที่เคยถูกใช้งานแล้ว ให้เพิ่มไฟล์ version ใหม่แทน

### 7. หยุดและเริ่มระบบ

หยุดระบบโดยเก็บข้อมูล database ไว้:

```bash
docker compose down
```

เริ่มระบบอีกครั้ง:

```bash
docker compose up -d
```

ไม่ควรใช้ `docker compose down -v` เพราะจะลบ volume และข้อมูล PostgreSQL ของเครื่องนั้น

## Database กลางของทีม

ค่าเริ่มต้นของโปรเจกต์เป็น PostgreSQL local ใน Docker ดังนั้นแต่ละเครื่องจะมีข้อมูลของตัวเอง

ถ้าต้องการให้ทุกคนเห็นผู้ป่วย สาขา นัดหมาย คอร์ส และรายการการเงินชุดเดียวกัน ให้สร้าง
PostgreSQL กลางไว้บน provider เดียวกัน เช่น Supabase, Neon, Railway หรือ server ของทีม
แล้วให้ทุกคนใช้ค่าการเชื่อมต่อชุดเดียวกัน โดยห้าม commit credential ลง Git

### ตั้งค่าฐานข้อมูลกลางครั้งแรก

1. สร้าง PostgreSQL database กลางและจดค่า host, port, database name, username และ password
2. ตรวจว่า provider อนุญาต connection จากเครื่องของสมาชิกทีม และตั้ง SSL ตามที่ provider กำหนด
3. ที่เครื่องเจ้าของระบบ แก้ไฟล์ `.env` ส่วนตัวดังนี้:

```env
DATABASE_URL_DOCKER=jdbc:postgresql://<host>:<port>/<database>?sslmode=require
DATABASE_USERNAME_DOCKER=<username>
DATABASE_PASSWORD_DOCKER=<password>
```

ถ้า provider ไม่ต้องการ SSL ให้เอา `?sslmode=require` ออกตามเอกสารของ provider

4. รัน Backend เพื่อให้ Flyway สร้างตารางและ migration ในฐานกลาง:

```bash
docker compose up --build -d backend
docker compose logs -f backend
```

ใน log ต้องเห็น JDBC URL ของฐานกลางและข้อความ migration สำเร็จ จากนั้นเริ่ม frontend:

```bash
docker compose up --build -d frontend
```

5. ให้สมาชิกทุกคนสร้าง `.env` ส่วนตัวจาก `.env.example` แล้วใส่ `DATABASE_URL_DOCKER`,
`DATABASE_USERNAME_DOCKER` และ `DATABASE_PASSWORD_DOCKER` ชุดเดียวกัน จากนั้นรัน:

```bash
git checkout dev3
git pull origin dev3
docker compose up --build -d
```

ทุกคนจะใช้ users, branches และข้อมูลธุรกรรมจาก PostgreSQL กลางเดียวกัน การเพิ่มหรือแก้ไข
ข้อมูลจึงแสดงกับทุกคนหลัง refresh

### ตรวจว่าใช้ฐานเดียวกันจริง

```bash
docker compose logs backend | grep -E "Database:|Successfully applied"
curl http://localhost:8080/actuator/health
```

ห้ามใช้ `docker compose down -v` กับเครื่องที่ชี้ฐานกลาง และห้ามรัน `setup-local.sh` บนเครื่อง
ที่ตั้งใจใช้ฐานกลาง เพราะสคริปต์นี้มีไว้สร้างค่า local เท่านั้น

ถ้าต้องการกลับไปใช้ฐาน local ให้ล้างค่าตัวแปร `DATABASE_URL_DOCKER`,
`DATABASE_USERNAME_DOCKER` และ `DATABASE_PASSWORD_DOCKER` ใน `.env` แล้วใช้คำสั่ง local ตามด้านบน

## Deploy บน Server กลางให้เข้าจากที่ไหนก็ได้

สำหรับใช้งานจริง ให้เลือก VPS/Cloud ที่มี Public IP แล้วชี้ Domain ไปที่ IP นั้น
Docker จะรัน Frontend, Backend, PostgreSQL และ Caddy ใน Server เดียวกัน โดย PostgreSQL
จะไม่เปิด port ออก Internet และ Caddy จะออก HTTPS ให้อัตโนมัติเมื่อ DNS ชี้ถูกต้อง

บน Server:

```bash
git clone https://github.com/MUDST-2026-MuarKuenPhomNonMaiRub/Physiotherapy-Clinic.git
cd Physiotherapy-Clinic
git checkout dev3
cp .env.production.example .env
```

แก้ `PUBLIC_DOMAIN`, รหัสผ่าน PostgreSQL, `APP_JWT_SECRET` และรหัสผ่าน Admin ใน `.env`
ให้เป็นค่าจริง จากนั้นตรวจว่า DNS A record ของ Domain ชี้มาที่ Public IP ของ Server แล้วรัน:

```bash
docker compose -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.production.yml logs -f backend
```

ทุกคนเข้าใช้งานผ่าน `https://<PUBLIC_DOMAIN>` ไม่ต้องรัน Docker ในเครื่องตัวเอง
การเพิ่มผู้ป่วย นัดหมาย หรือข้อมูลอื่นจะเขียนลง PostgreSQL container กลางชุดเดียวกัน

อัปเดตเวอร์ชันบน Server:

```bash
git pull origin dev3
docker compose -f docker-compose.production.yml up --build -d
```

สำรองข้อมูลก่อน deploy หรือ migration สำคัญ:

```bash
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

ห้ามใช้ `docker compose down -v` บน Production เพราะจะลบข้อมูล PostgreSQL และห้ามเปิด
port `5432` สู่ Internet โดยตรง

## รัน frontend/backend แยกจาก Docker

เปิด PostgreSQL ก่อน:

```bash
docker compose up -d postgres
```

Terminal ที่ 1:

```bash
cd backend
./mvnw spring-boot:run
```

Terminal ที่ 2:

```bash
cd frontend
npm install
npm run dev
```

## ปัญหาที่พบบ่อย

### Port ถูกใช้งานอยู่

```bash
docker compose ps
docker compose down
docker compose up --build -d
```

### Login ไม่ได้

ใช้ email และ password ที่ `setup-local.sh` แสดงในครั้งแรก และอย่าเปลี่ยน `APP_JWT_SECRET` หลังจากมีผู้ใช้งานแล้ว

### Migration ล้มเหลว

ดู log ด้วย:

```bash
docker compose logs backend
```

ห้ามแก้ migration เดิมที่เคยรันแล้ว ให้สร้าง migration version ใหม่

## ตรวจสอบก่อน push

```bash
cd backend
./mvnw clean test

cd ../frontend
npm run lint
```

## ข้อมูลทดสอบสำหรับเล่น Flow

ข้อมูลทดสอบจะไม่ถูก seed อัตโนมัติและไม่อยู่ใน Frontend mock หากต้องการเล่น flow ให้รัน
บน Database ที่ต้องการทดสอบเท่านั้น เช่น Local Docker หรือ Staging:

```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < database/seed/test-data.sql
```

ชุดนี้สร้างข้อมูลจริงใน PostgreSQL สำหรับผู้ป่วย 2 สาขา, service, course, staff, payment,
course balance, appointment ที่รอดำเนินการ และ appointment ที่เสร็จแล้ว การรันซ้ำปลอดภัย
สำหรับรายการที่มีรหัสทดสอบเดิม โดยจะไม่ถูกนำไปใช้กับ Production อัตโนมัติ
