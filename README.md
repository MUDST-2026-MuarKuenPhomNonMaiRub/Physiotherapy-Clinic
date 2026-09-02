# PhysioCare Clinic

Starter monorepo based on the Clinic Figma design.

## Run with Docker

```bash
bash setup-local.sh
```

The first run creates the PostgreSQL database and a local bootstrap admin account.
The setup script generates a random admin password and prints it once. Do not
commit `.env`.

For a shared team database, put the same cloud PostgreSQL JDBC connection URL
in `DATABASE_URL_DOCKER`, username in `DATABASE_USERNAME_DOCKER`, and password
in `DATABASE_PASSWORD_DOCKER` in every person's private `.env` file. Keep the
username, password and URL private. The Flyway migrations run against that
shared database when the backend starts, so all team members use the same users
and staff accounts.

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

ค่าเริ่มต้นเป็น PostgreSQL local ใน Docker ดังนั้นแต่ละเครื่องจะมีข้อมูลของตัวเอง

ถ้าทีมต้องการใช้ database กลาง ให้ใส่ค่าต่อไปนี้ใน `.env` ส่วนตัวของแต่ละคน และห้าม commit ไฟล์ `.env`:

```env
DATABASE_URL_DOCKER=jdbc:postgresql://<database-host>:5432/<database-name>
DATABASE_USERNAME_DOCKER=<database-username>
DATABASE_PASSWORD_DOCKER=<database-password>
```

ทุกคนต้องใช้ database เดียวกันและมีสิทธิ์เชื่อมต่อ PostgreSQL ได้

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
