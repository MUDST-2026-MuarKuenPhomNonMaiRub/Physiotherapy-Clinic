#!/usr/bin/env python3
"""
Demo data for every screen of the app, on a fresh local database.

Everything is created through the backend API, so receipt numbers, course
balances and commission are worked out by the application itself rather than
typed in by hand. The API only books from today onward, so each earlier day is
created as "today" and then moved back to its real date in the database. Months
that have ended are then closed for commission, the way the office would.

Run it with the stack up (docker compose up -d):

    python3 database/seed/seed-demo.py

The demo staff logins share one password, stored in .env as
DEMO_STAFF_PASSWORD. Local development only: never run this against production.
"""

import json
import os
import random
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = os.environ.get("API_URL", "http://localhost:8080/api/v1")
CLINIC_TZ = timezone(timedelta(hours=7))  # APP_TIMEZONE=Asia/Bangkok
HISTORY_DAYS = 80
FUTURE_DAYS = 14
rng = random.Random(20260930)

TODAY = datetime.now(CLINIC_TZ).date()

# --- catalog, as shipped by the Flyway migrations ------------------------------
R9, BR = 1, 2
ASSESSMENT = 1
CONDITIONS = [  # (service id, course id or None, weight)
    (2, 1, 5),  # office syndrome -> 10-session course
    (4, 2, 4),  # lower back pain -> 5-session course
    (3, 3, 3),  # sports injury -> 8-session course
    (5, 4, 2),  # post-operative -> 12-session course
    (6, None, 1),  # neurological, paid per visit
]
SERVICE_MINUTES = {1: 30, 2: 45, 3: 60, 4: 45, 5: 60, 6: 60}
PRICES = {1: 500, 2: 900, 3: 1200, 4: 1000, 5: 1400, 6: 1500}
COURSE_PRICES = {1: 8100, 2: 4500, 3: 8800, 4: 15000}
CASH, TRANSFER, CARD = 1, 2, 4
ROOMS = {R9: [1, 2, 3], BR: [5, 6, 7]}
HOURS = [9, 10, 11, 13, 14, 15, 16, 17]

PHYSIOS = [
    ("ploy", "พลอยไพลิน ศรีสุข", "Ploypailin Srisuk", [R9], "bg-[#1A4A2E]"),
    ("fah", "ฟ้าใส วงศ์ไทย", "Fahsai Wongthai", [R9], "bg-[#24BEE2]"),
    ("tee", "ธีรวัฒน์ ใจดี", "Teerawat Jaidee", [R9, BR], "bg-[#2D6B45]"),
    ("mint", "มินตรา แก้วมณี", "Mintra Kaewmanee", [BR], "bg-[#F3AB3B]"),
    ("beam", "ปฐมพงศ์ ทองคำ", "Pathompong Thongkham", [BR], "bg-[#586050]"),
]

FIRST_M = ["สมชาย", "ธนพล", "วีระพงษ์", "อนุชา", "กิตติพงษ์", "ณัฐวุฒิ", "ชยพล", "ภาณุวัฒน์", "ศุภชัย", "พงศกร"]
FIRST_F = ["สุดารัตน์", "กมลชนก", "ปิยะนุช", "วรรณภา", "ชุติมา", "อรอุมา", "ณัฐธิดา", "พิมพ์ชนก", "ศิริพร", "จิราพร"]
LAST = ["สุขสวัสดิ์", "ทองดี", "ศรีวงศ์", "แสงทอง", "บุญมา", "จันทร์เพ็ญ", "รัตนพันธ์", "พึ่งบุญ",
        "เจริญสุข", "มั่นคง", "วัฒนากูล", "ชัยมงคล", "อินทร์แก้ว", "ประเสริฐศรี", "นาคสวัสดิ์"]
ROMAN = {"สมชาย": "Somchai", "ธนพล": "Thanapon", "วีระพงษ์": "Weerapong", "อนุชา": "Anucha",
         "กิตติพงษ์": "Kittipong", "ณัฐวุฒิ": "Nattawut", "ชยพล": "Chayapon", "ภาณุวัฒน์": "Panuwat",
         "ศุภชัย": "Supachai", "พงศกร": "Pongsakorn", "สุดารัตน์": "Sudarat", "กมลชนก": "Kamonchanok",
         "ปิยะนุช": "Piyanuch", "วรรณภา": "Wannapa", "ชุติมา": "Chutima", "อรอุมา": "Onuma",
         "ณัฐธิดา": "Nattida", "พิมพ์ชนก": "Pimchanok", "ศิริพร": "Siriporn", "จิราพร": "Jiraporn",
         "สุขสวัสดิ์": "Suksawat", "ทองดี": "Thongdee", "ศรีวงศ์": "Sriwong", "แสงทอง": "Saengthong",
         "บุญมา": "Boonma", "จันทร์เพ็ญ": "Janpen", "รัตนพันธ์": "Rattanapan", "พึ่งบุญ": "Phuengboon",
         "เจริญสุข": "Charoensuk", "มั่นคง": "Mankong", "วัฒนากูล": "Wattanakul", "ชัยมงคล": "Chaimongkol",
         "อินทร์แก้ว": "Inkaew", "ประเสริฐศรี": "Prasertsri", "นาคสวัสดิ์": "Naksawat"}
FOREIGNERS = [("John", "Miller", "MALE", "Mr.", "American"), ("Emma", "Schneider", "FEMALE", "Ms.", "German"),
              ("Kenji", "Tanaka", "MALE", "Mr.", "Japanese")]
GROUPS = ["WALKIN", "WALKIN", "MEMBER", "MEMBER", "VIP", "CORPORATE", "STAFF"]
REFERRALS = ["WALKBY", "LINE", "FACEBOOK", "INSTAGRAM", "GOOGLE", "FRIEND", "DOCTOR"]
INSURERS = ["NONE", "NONE", "NONE", "AIA", "MUANGTHAI", "BUPA", "ALLIANZ"]
NOTES = ["ปวดคอบ่าไหล่ร้าวลงแขนขวา", "ปวดหลังส่วนล่างเวลานั่งนาน", "เจ็บเข่าหลังวิ่ง",
         "ข้อเท้าพลิกระหว่างเล่นฟุตบอล", "ฟื้นฟูหลังผ่าตัดเข่า", "ขอเวลาเย็นหลังเลิกงาน", ""]


# --- plumbing ----------------------------------------------------------------------
def read_env():
    env = {}
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


def demo_password(env):
    if env.get("DEMO_STAFF_PASSWORD"):
        return env["DEMO_STAFF_PASSWORD"]
    password = f"Demo-{secrets.token_hex(6)}-Aa1!"
    with open(ROOT / ".env", "a") as f:
        f.write("\n# Shared password of the demo staff logins created by database/seed/seed-demo.py\n")
        f.write(f"DEMO_STAFF_PASSWORD={password}\n")
    return password


class Api:
    """Signs in the way the browser does: the session comes back as a cookie."""

    def __init__(self):
        self.session = None

    def login(self, email, password):
        self.call("POST", "/auth/login", {"email": email, "password": password})
        if not self.session:
            sys.exit("Signed in, but the API set no session cookie")

    def call(self, method, path, body=None):
        headers = {"Content-Type": "application/json"}
        if self.session:
            headers["Cookie"] = "clinic_session=" + self.session
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(API + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                for cookie in response.headers.get_all("Set-Cookie") or []:
                    if cookie.startswith("clinic_session="):
                        self.session = cookie.split(";", 1)[0].split("=", 1)[1]
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:600]
            sent = json.dumps(body, ensure_ascii=False)[:600]
            sys.exit(f"\n{method} {path} failed ({e.code}): {detail}\nsent: {sent}")

    def get(self, path):
        return self.call("GET", path)

    def post(self, path, body=None):
        return self.call("POST", path, body if body is not None else {})


def psql(sql):
    """Runs SQL in the postgres container, on the clinic's time zone."""
    result = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "sh", "-c",
         'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -At -F "\t"'],
        input="SET TIME ZONE 'Asia/Bangkok';\n" + sql, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        sys.exit(f"\nSQL failed: {result.stderr}\n{sql[:1500]}")
    return [line.split("\t") for line in result.stdout.splitlines() if line]


# --- moving a day's records back to their real date --------------------------------
SHIFTED_TABLES = ["patients", "appointments", "appointment_events", "visits", "sales_transactions",
                  "payments", "transaction_commissions", "transaction_cancellations", "patient_courses",
                  "course_ledger_entries", "course_commission_splits", "course_usages", "audit_logs"]
NOT_SHIFTED = {"birth_date", "deleted_at"}


def date_columns():
    names = ",".join(f"'{t}'" for t in SHIFTED_TABLES)
    columns = {t: [] for t in SHIFTED_TABLES}
    for table, column, kind in psql(
            "SELECT table_name, column_name, data_type FROM information_schema.columns"
            f" WHERE table_schema=current_schema() AND table_name IN ({names})"
            " AND (data_type='date' OR data_type LIKE 'timestamp%')"):
        if column not in NOT_SHIFTED:
            columns[table].append((column, kind))
    return columns


def high_water_marks():
    union = " UNION ALL ".join(f"SELECT '{t}', coalesce(max(id),0) FROM {t}" for t in SHIFTED_TABLES)
    return {table: int(value) for table, value in psql(union)}


def move_back(day, since, columns):
    """Moves every row created since `since` from today to `day`, then lines the
    clock times up with the appointment they belong to."""
    days = (day - TODAY).days
    sql = []
    for table, cols in columns.items():
        sets = ", ".join(f"{c} = {c} + {days}" if kind == "date" else f"{c} = {c} + make_interval(days => {days})"
                         for c, kind in cols)
        sql.append(f"UPDATE {table} SET {sets} WHERE id > {since[table]};")
    s = since
    sql.append(f"""
UPDATE patient_courses SET sale_month = date_trunc('month', sale_date)::date WHERE id > {s['patient_courses']};
UPDATE patients p SET registered_at = f.first_visit - interval '20 minutes',
       created_at = f.first_visit - interval '20 minutes', updated_at = f.first_visit - interval '20 minutes'
  FROM (SELECT patient_id, min(starts_at) first_visit FROM appointments GROUP BY 1) f
 WHERE f.patient_id = p.id AND p.id > {s['patients']};
UPDATE appointments a SET created_at = GREATEST(p.registered_at + interval '5 minutes', a.starts_at - interval '2 days'),
       updated_at = a.ends_at, cancelled_at = CASE WHEN a.cancelled_at IS NULL THEN NULL
         WHEN a.status = 'NO_SHOW' THEN a.starts_at + interval '20 minutes' ELSE a.starts_at - interval '3 hours' END
  FROM patients p WHERE p.id = a.patient_id AND a.id > {s['appointments']};
UPDATE appointment_events e SET occurred_at = CASE e.to_status
         WHEN 'ARRIVED' THEN a.starts_at - interval '10 minutes' WHEN 'IN_SERVICE' THEN a.starts_at
         WHEN 'COMPLETED' THEN a.ends_at WHEN 'CONFIRMED' THEN a.created_at ELSE coalesce(a.cancelled_at, a.starts_at) END
  FROM appointments a WHERE a.id = e.appointment_id AND e.id > {s['appointment_events']};
UPDATE visits v SET check_in_at = a.starts_at - interval '10 minutes', started_at = a.starts_at,
       completed_at = a.ends_at, created_at = a.starts_at - interval '10 minutes'
  FROM appointments a WHERE a.id = v.appointment_id AND v.id > {s['visits']};
UPDATE sales_transactions t SET sold_at = a.ends_at + interval '5 minutes', created_at = a.ends_at + interval '5 minutes'
  FROM appointments a WHERE a.id = t.appointment_id AND t.id > {s['sales_transactions']};
UPDATE sales_transactions t SET cancelled_at = t.sold_at + interval '40 minutes'
 WHERE t.cancelled_at IS NOT NULL AND t.id > {s['sales_transactions']};
UPDATE transaction_cancellations c SET cancelled_at = t.cancelled_at
  FROM sales_transactions t WHERE t.id = c.transaction_id AND c.id > {s['transaction_cancellations']};
UPDATE payments p SET paid_at = t.sold_at FROM sales_transactions t
 WHERE t.id = p.sales_transaction_id AND p.id > {s['payments']};
UPDATE transaction_commissions c SET created_at = t.sold_at FROM sales_transactions t
 WHERE t.id = c.sales_transaction_id AND c.id > {s['transaction_commissions']};
UPDATE patient_courses pc SET created_at = t.sold_at FROM sales_transactions t
 WHERE t.id = pc.sales_transaction_id AND pc.id > {s['patient_courses']};
UPDATE course_ledger_entries l SET created_at = t.sold_at FROM sales_transactions t
 WHERE t.id = l.related_transaction_id AND l.id > {s['course_ledger_entries']};
UPDATE course_usages u SET created_at = a.ends_at FROM visits v JOIN appointments a ON a.id = v.appointment_id
 WHERE v.id = u.visit_id AND u.id > {s['course_usages']};
""")
    psql("BEGIN;\n" + "\n".join(sql) + "\nCOMMIT;")


def renumber_hns():
    """HNs carry the month of registration; give the moved patients theirs."""
    psql("""
BEGIN;
CREATE TEMP TABLE new_hn AS
SELECT p.id, p.registered_branch_id AS branch_id, to_char(p.registered_at, 'YYYYMM') AS year_month,
       to_char(p.registered_at, 'YY') || trim(b.code) || to_char(p.registered_at, 'MM')
         || lpad(row_number() OVER (PARTITION BY p.registered_branch_id, to_char(p.registered_at, 'YYYYMM')
                                    ORDER BY p.registered_at, p.id)::text, 4, '0') AS hn
  FROM patients p JOIN branches b ON b.id = p.registered_branch_id;
UPDATE patients SET hn = 'TMP-' || id;
UPDATE patients p SET hn = n.hn FROM new_hn n WHERE n.id = p.id;
UPDATE patient_courses pc SET patient_hn_snapshot = p.hn FROM patients p WHERE p.id = pc.patient_id;
DELETE FROM hn_sequences;
INSERT INTO hn_sequences(branch_id, year_month, last_number)
SELECT branch_id, year_month, count(*) FROM new_hn GROUP BY 1, 2;
COMMIT;
""")


# --- the story ---------------------------------------------------------------------
class Seeder:
    def __init__(self, api, staff_password):
        self.api = api
        self.staff_password = staff_password
        self.staff = {}  # key -> {"id", "branches"}
        self.slots = {}  # (day, staff id) -> next free hour index
        self.national_ids = set()
        self.phones = set()

    # -- setup --
    def create_staff(self):
        for key, name, name_en, branches, color in PHYSIOS:
            created = self.api.post("/staff", {
                "name": name, "nameEn": name_en, "position": "Physiotherapist",
                "phone": self.phone(), "email": f"{key}.demo@example.com",
                "branchIds": json.dumps(branches, separators=(",", ":")), "role": "PHYSIO",
                "password": self.staff_password, "avatarColor": color, "hasAccount": True})
            self.staff[key] = {"id": created["staffId"], "branches": branches}
        created = self.api.post("/staff", {
            "name": "นิดา พรหมมา", "nameEn": "Nida Prommar", "position": "Salesperson",
            "phone": self.phone(), "branchIds": json.dumps([R9, BR], separators=(",", ":")), "hasAccount": False})
        self.staff["nida"] = {"id": created["staffId"], "branches": [R9, BR]}
        psql(f"UPDATE staff SET staff_type='SALESPERSON' WHERE id={created['staffId']};")

        # A therapist covering another's course visit is paid a treatment fee.
        self.api.post("/treatment-fee-rules", {
            "employeeGroup": "PHYSIOTHERAPIST", "feeType": "FIXED", "feeValue": 150,
            "effectiveFrom": "2026-01-01", "active": True})
        self.api.post("/treatment-fee-rules", {
            "employeeGroup": "PHYSIOTHERAPIST", "serviceId": 5, "feeType": "PERCENTAGE", "feeValue": 12,
            "percentageBase": "COURSE_VALUE_PER_VISIT", "effectiveFrom": "2026-01-01", "active": True})

    def physios_at(self, branch):
        return [k for k, *_ in PHYSIOS if branch in self.staff[k]["branches"]]

    def phone(self):
        while True:
            number = rng.choice(["08", "09", "06"]) + f"{rng.randrange(10**8):08d}"
            if number not in self.phones:
                self.phones.add(number)
                return number

    def national_id(self):
        while True:
            number = str(rng.choice([1, 3])) + f"{rng.randrange(10**12):012d}"
            if number not in self.national_ids:
                self.national_ids.add(number)
                return number

    # -- plan --
    def plan(self):
        """One journey per patient: an assessment, then either paid visits or a course."""
        journeys = []
        people = []
        for i in range(45):
            gender = "MALE" if i % 2 == 0 else "FEMALE"
            first = rng.choice(FIRST_M if gender == "MALE" else FIRST_F)
            people.append(("THAI", first, rng.choice(LAST), gender))
        people += [("FOREIGNER", first, last, gender) for first, last, gender, *_ in FOREIGNERS]
        rng.shuffle(people)

        for n, person in enumerate(people):
            branch = R9 if n % 5 < 3 else BR
            physio = rng.choice([k for k in self.physios_at(branch) if k != "tee"] or ["tee"])
            service, course, _ = rng.choices(CONDITIONS, weights=[c[2] for c in CONDITIONS])[0]
            if n < 3:  # new patients whose first visit is still ahead
                start = TODAY + timedelta(days=rng.randint(1, FUTURE_DAYS - 2))
            elif n < 5:
                start = TODAY
            else:
                start = TODAY - timedelta(days=rng.randint(3, HISTORY_DAYS))
            visits = [[self.open_day(start), "ASSESS", ASSESSMENT]]
            if course and rng.random() < 0.65:
                day = visits[0][0] + timedelta(days=rng.randint(2, 5))
                visits.append([self.open_day(day), "BUY", service])
                sessions = {1: 10, 2: 5, 3: 8, 4: 12}[course]
                for _ in range(sessions - 1 - rng.choice([0, 0, 1, 2])):
                    day = visits[-1][0] + timedelta(days=rng.randint(3, 7))
                    visits.append([self.open_day(day), "USE", service])
            else:
                course = None
                for _ in range(rng.choice([0, 1, 1, 2, 3])):
                    day = visits[-1][0] + timedelta(days=rng.randint(4, 10))
                    visits.append([self.open_day(day), "PAY", service])
            # Nothing is booked further ahead than the next visit or two.
            future = [v for v in visits if v[0] > TODAY]
            visits = [v for v in visits if v[0] <= TODAY] + future[:rng.choice([1, 2])]
            journeys.append({"person": person, "branch": branch, "physio": physio,
                             "course": course, "visits": visits})

        # Put a few ongoing patients' next visit on today's schedule.
        ongoing = [j for j in journeys[5:] if any(v[0] > TODAY for v in j["visits"])
                   and not any(v[0] == TODAY for v in j["visits"])]
        for j in rng.sample(ongoing, min(10, len(ongoing))):
            next(v for v in j["visits"] if v[0] > TODAY)[0] = TODAY
        return journeys

    @staticmethod
    def open_day(day):
        return day + timedelta(days=1) if day.weekday() == 6 else day  # closed on Sundays

    # -- one visit --
    def slot(self, day, staff_key, minutes):
        staff_id = self.staff[staff_key]["id"]
        index = self.slots.get((day, staff_id), rng.randint(0, 2))
        if index >= len(HOURS):
            return None
        self.slots[(day, staff_id)] = index + 1 + (1 if minutes > 45 and rng.random() < 0.3 else 0)
        # Earlier days are booked on today's date and moved back afterwards.
        start = datetime.combine(max(day, TODAY), datetime.min.time(), CLINIC_TZ).replace(hour=HOURS[index])
        return start, start + timedelta(minutes=minutes)

    def book(self, journey, day, service, provider):
        branch = journey["branch"]
        when = self.slot(day, provider, SERVICE_MINUTES[service])
        if when is None:
            return None
        physios = self.physios_at(branch)
        room = ROOMS[branch][physios.index(provider) % len(ROOMS[branch])]
        appointment = self.api.post("/appointments", {
            "patientId": journey["patient_id"], "branchId": branch,
            "providerStaffId": self.staff[provider]["id"], "serviceId": service, "roomId": room,
            "startsAt": when[0].isoformat(), "endsAt": when[1].isoformat(),
            "patientNote": rng.choice(NOTES) or None})
        return appointment["id"]

    def advance(self, appointment, to, course_id=None):
        for action in {"ARRIVED": ["arrive"], "IN_SERVICE": ["arrive", "start"],
                       "COMPLETED": ["arrive", "start", "complete"]}[to]:
            body = {"usePatientCourseId": course_id} if action == "complete" and course_id else {}
            self.api.post(f"/appointments/{appointment}/{action}", body)

    def payment(self, amount):
        method = rng.choices([CASH, TRANSFER, CARD], weights=[5, 3, 2])[0]
        fields = {"paymentMethodId": method}
        if method == CASH:
            step = 1000 if amount >= 2000 else 100
            fields["cashReceived"] = -(-amount // step) * step + rng.choice([0, 0, step])
        elif method == TRANSFER:
            fields["paymentReferenceNo"] = f"TRF{rng.randrange(10**8):08d}"
        else:
            fields["paymentReferenceNo"] = f"**** {rng.randrange(10**4):04d}"
        return fields

    def visit(self, journey, day, kind, service, outcome):
        """outcome: DONE, UNPAID, IN_SERVICE, ARRIVED, BOOKED, NO_SHOW or CANCELLED."""
        provider = journey["physio"]
        if kind == "USE" and rng.random() < 0.12:  # a colleague covers the session
            provider = rng.choice([k for k in self.physios_at(journey["branch"]) if k != provider])
        appointment = self.book(journey, day, service, provider)
        if appointment is None or outcome == "BOOKED":
            return
        if outcome in ("NO_SHOW", "CANCELLED"):
            action, reason = (("noshow", "ไม่มาตามนัด ติดต่อไม่ได้") if outcome == "NO_SHOW"
                              else ("cancel", rng.choice(["ติดธุระด่วน", "ไม่สบาย ขอเลื่อนไปก่อน"])))
            self.api.post(f"/appointments/{appointment}/{action}", {"reason": reason})
            return
        if outcome in ("ARRIVED", "IN_SERVICE"):
            self.advance(appointment, outcome)
            return

        use_course = journey.get("patient_course_id") if kind == "USE" else None
        self.advance(appointment, "COMPLETED", use_course)
        if outcome == "UNPAID":
            return
        body = {"patientId": journey["patient_id"], "branchId": journey["branch"],
                "appointmentId": appointment, "treatingStaffId": self.staff[provider]["id"]}
        if kind in ("ASSESS", "PAY"):
            price = PRICES[service]
            body.update(serviceId=service, servicePrice=price, **self.payment(price))
        elif kind == "BUY":
            price = COURSE_PRICES[journey["course"]]
            seller = "nida" if rng.random() < 0.35 else journey["physio"]
            body.update(purchaseCourseId=journey["course"], coursePurchasePrice=price,
                        useNewlyPurchasedSession=True, salespersonId=self.staff[seller]["id"],
                        caseOwnerEmployeeId=self.staff[journey["physio"]]["id"])
            if rng.random() < 0.3:
                discount = round(price * 0.1)
                body["adjustments"] = [{"label": "ส่วนลดโปรโมชั่นคอร์ส 10%", "amount": -discount}]
                price -= discount
            body.update(self.payment(price))
        else:  # USE: the session was spent when the visit was completed
            body.update(usePatientCourseId=use_course, useSessionsCount=1, paymentMethodId=CASH)
        receipt = self.api.post("/checkout", body)
        if kind == "BUY":
            journey["patient_course_id"] = receipt["patientCourseId"]
        return receipt

    def register(self, journey):
        customer_type, first, last, gender = journey["person"]
        if customer_type == "THAI":
            prefix = "นาย" if gender == "MALE" else rng.choice(["นาง", "นางสาว"])
            names = {"firstNameTh": first, "lastNameTh": last, "firstNameEn": ROMAN[first],
                     "lastNameEn": ROMAN[last], "nationalId": self.national_id(), "nationalityCode": "Thai"}
        else:
            prefix, nationality = next((p, n) for f, _, _, p, n in FOREIGNERS if f == first)
            names = {"firstNameTh": first, "lastNameTh": last, "firstNameEn": first, "lastNameEn": last,
                     "passportNo": f"P{rng.randrange(10**8):08d}", "nationalityCode": nationality}
        age = rng.randint(22, 68)
        patient = self.api.post("/patients", {
            "customerType": customer_type, "prefix": prefix, **names, "genderCode": gender,
            "nickname": None, "birthDate": (TODAY - timedelta(days=age * 365 + rng.randint(0, 364))).isoformat(),
            "phone": self.phone(), "email": f"{names['firstNameEn'].lower()}.{rng.randint(10, 99)}@example.com",
            "addressText": rng.choice(["แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ", "แขวงบางนา เขตบางนา กรุงเทพฯ",
                                       "ต.สำโรงเหนือ อ.เมืองสมุทรปราการ จ.สมุทรปราการ", ""]),
            "customerGroupCode": rng.choice(GROUPS), "referralChannelCode": rng.choice(REFERRALS),
            "insuranceCompanyCode": rng.choice(INSURERS), "registeredBranchId": journey["branch"]})
        journey["patient_id"] = patient["id"]

    # -- run --
    def run(self):
        self.create_staff()
        journeys = self.plan()
        by_day = {}
        for journey in journeys:
            for index, (day, kind, service) in enumerate(journey["visits"]):
                by_day.setdefault(day, []).append((journey, index, kind, service))

        columns = date_columns()
        past_days = sorted(d for d in by_day if d < TODAY)
        today_outcomes = iter(["DONE", "DONE", "DONE", "DONE", "UNPAID", "IN_SERVICE", "IN_SERVICE",
                               "ARRIVED", "ARRIVED"])
        voided = False
        for number, day in enumerate(past_days + [TODAY] + sorted(d for d in by_day if d > TODAY), 1):
            if day == TODAY:
                self.close_ended_months()
            since = high_water_marks() if day < TODAY else None
            for journey, index, kind, service in sorted(by_day.get(day, []), key=lambda e: e[1]):
                if index == 0:
                    self.register(journey)
                if day < TODAY:
                    miss = kind in ("USE", "PAY") and rng.random() < 0.08
                    outcome = rng.choice(["NO_SHOW", "CANCELLED"]) if miss else "DONE"
                elif day == TODAY:
                    outcome = next(today_outcomes, "BOOKED")
                    if kind == "USE" and not journey.get("patient_course_id"):
                        outcome = "BOOKED"
                else:
                    outcome = "BOOKED"
                if kind == "USE" and outcome not in ("BOOKED",) and not journey.get("patient_course_id"):
                    outcome = "BOOKED" if day >= TODAY else "CANCELLED"
                receipt = self.visit(journey, day, kind, service, outcome)
                if receipt and not voided and kind == "PAY" and day < TODAY - timedelta(days=10):
                    self.void_and_recharge(receipt, journey, service)
                    voided = True
            if since:
                move_back(day, since, columns)
            print(f"\r  day {number}/{len(by_day) + (TODAY not in by_day)}: {day}", end="", flush=True)
        print()
        self.today_extras()
        renumber_hns()

    def void_and_recharge(self, receipt, journey, service):
        """A receipt keyed with the wrong payment method, voided and issued again."""
        self.api.post(f"/transactions/{receipt['id']}/void", {"reason": "เลือกวิธีชำระเงินผิด ออกใบเสร็จใหม่"})
        self.api.post("/checkout", {
            "patientId": journey["patient_id"], "branchId": journey["branch"],
            "appointmentId": receipt["appointmentId"], "serviceId": service, "servicePrice": PRICES[service],
            "treatingStaffId": receipt["treatingStaffId"], "paymentMethodId": TRANSFER,
            "paymentReferenceNo": f"TRF{rng.randrange(10**8):08d}"})

    def close_ended_months(self):
        month = date(TODAY.year, TODAY.month, 1)
        first = (TODAY - timedelta(days=HISTORY_DAYS + 20)).replace(day=1)
        while first < month:
            self.api.post("/commission/closing/close",
                          {"month": first.strftime("%Y-%m"), "earlyClose": False})
            first = (first + timedelta(days=32)).replace(day=1)
        psql("UPDATE monthly_commission_closings SET closed_at = (closing_month + interval '1 month 2 days'"
             " + interval '10 hours') AT TIME ZONE 'Asia/Bangkok';")

    def today_extras(self):
        """A cancelled booking and a moved one, so both show up in the lists."""
        def starts(a):
            return datetime.fromisoformat(str(a.get("starts_at") or a.get("startsAt"))).astimezone(CLINIC_TZ)

        def ends(a):
            return datetime.fromisoformat(str(a.get("ends_at") or a.get("endsAt"))).astimezone(CLINIC_TZ)

        # Two sessions of a course handed on to a family member.
        course = psql("SELECT pc.id, pc.patient_id, pc.branch_id FROM patient_courses pc"
                      " WHERE pc.status='ACTIVE' AND pc.total_visits - pc.visits_used >= 4"
                      " ORDER BY pc.sale_date LIMIT 1")
        if course:
            course_id, owner, branch = course[0]
            to = psql(f"SELECT id FROM patients WHERE registered_branch_id={branch} AND id<>{owner}"
                      " AND customer_type='THAI' ORDER BY id DESC LIMIT 1")
            if to:
                self.api.post("/course-transfers", {"patientCourseId": int(course_id), "toPatientId": int(to[0][0]),
                                                    "sessions": 2, "reason": "โอนให้คู่สมรสใช้ต่อ"})

        future = [a for a in self.api.get("/appointments?limit=500")
                  if a.get("status") == "CONFIRMED" and starts(a).date() > TODAY + timedelta(days=1)]
        if len(future) < 2:
            return
        self.api.post(f"/appointments/{future[0]['id']}/cancel", {"reason": "ผู้ป่วยแจ้งยกเลิก เดินทางต่างจังหวัด"})
        moved = future[-1]
        self.api.post(f"/appointments/{moved['id']}/reschedule", {
            "startsAt": (starts(moved) + timedelta(days=1)).isoformat(),
            "endsAt": (ends(moved) + timedelta(days=1)).isoformat(), "reason": "ผู้ป่วยขอเลื่อนเป็นวันถัดไป"})


def main():
    env = read_env()
    counts = psql("SELECT (SELECT count(*) FROM patients), (SELECT count(*) FROM appointments),"
                  " (SELECT count(*) FROM sales_transactions), (SELECT count(*) FROM staff)")[0]
    if any(int(c) for c in counts):
        sys.exit("The database already holds patients, appointments, receipts or staff.\n"
                 "This script only seeds a fresh local database, so earlier records are never mixed in.")

    api = Api()
    api.login(env["BOOTSTRAP_ADMIN_EMAIL"], env["BOOTSTRAP_ADMIN_PASSWORD"])
    print(f"Seeding demo data ({TODAY - timedelta(days=HISTORY_DAYS)} to {TODAY + timedelta(days=FUTURE_DAYS)})")
    Seeder(api, demo_password(env)).run()

    summary = psql("SELECT (SELECT count(*) FROM patients), (SELECT count(*) FROM appointments),"
                   " (SELECT count(*) FROM sales_transactions), (SELECT count(*) FROM patient_courses),"
                   " (SELECT count(*) FROM monthly_commission_closings)")[0]
    print("Done: {} patients, {} appointments, {} receipts, {} courses sold, {} commission closings".format(*summary))
    print("Demo staff logins: ploy / fah / tee / mint / beam  .demo@example.com"
          " (password: DEMO_STAFF_PASSWORD in .env)")


if __name__ == "__main__":
    main()
