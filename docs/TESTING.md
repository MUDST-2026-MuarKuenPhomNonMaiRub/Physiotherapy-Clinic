# Testing Log

บันทึกผลการทดสอบระบบ LA BALANCE Clinic ERP สำหรับการส่งงานและการตรวจสอบภายใน

## Test environment

- Branch: `dev3`
- Backend: Spring Boot 3.5.5, Java 21 target
- Database: PostgreSQL 16
- Frontend: Next.js 16.3.0
- Test framework: JUnit 5 และ Spring Boot Test

## Latest result — 12 September 2026

| Test suite | Scope | Passed | Failed | Errors | Skipped | Result |
|---|---|---:|---:|---:|---:|---|
| `InputRulesTest` | Unit validation rules | 23 | 0 | 0 | 0 | PASS |
| `RequestValidationTest` | Request validation for auth, patients, catalogue, appointments and checkout | 7 | 0 | 0 | 0 | PASS |
| `CommissionFlowTest` | Commission flow with temporary real PostgreSQL | 26 | 0 | 0 | 0 | PASS |
| **Total automated** |  | **56** | **0** | **0** | **0** | **PASS** |

## Failure log

Latest run: **no failed tests**.

- Failed: 0
- Errors: 0
- Skipped: 0
- Issues requiring a fix from this run: None

Rerun note: a later verification attempt could not write to
`backend/target/classes` (`Operation not permitted`). This is an environment
permission issue, not a failed test, and is not counted as a test failure.

For a future failure, record the suite and test name, the field or condition
involved, expected value, actual result, and fix status in this section.

## Unit test coverage

`InputRulesTest` checks the following rules without using a database:

- Required values and allowed-value lists
- Money: negative values, maximum amount and decimal precision
- Numeric ranges and service duration limits
- Date of birth: future dates and implausibly old dates
- Thai national ID: exactly 13 digits
- Passport: 5–20 alphanumeric characters
- Phone number: exactly 10 digits
- Email format
- Appointment booking window: no past dates and no more than two years ahead
- Thai-language patient names
- Maximum text length
- Branch code and branch phone number

`RequestValidationTest` checks the required fields and basic constraints on:

- User creation and password policy
- Patient registration
- Service and course creation
- Appointment creation
- Checkout and payment adjustments

### Request field coverage

| Area | Fields checked | Result |
|---|---|---|
| User creation | email, password, firstName, lastName, role | PASS |
| Patient | customerType, prefix, firstNameTh, lastNameTh, genderCode, phone, registeredBranchId | PASS |
| Service | nameTh, serviceType, durationMinutes, basePrice | PASS |
| Course | nameTh, totalSessions, bonusSessions, validityDays, price | PASS |
| Appointment | patientId, branchId, providerStaffId, serviceId, startsAt, endsAt | PASS |
| Checkout | patientId, branchId, paymentMethodId | PASS |
| Adjustment | label, amount, and negative discount amount case | PASS |

This table covers every Request DTO field currently marked as required or
having a basic validation constraint. It does not claim to cover every UI,
database, or end-to-end scenario.

Run from IntelliJ by right-clicking `InputRulesTest.java` and choosing **Run**.

Or run from the backend directory:

```bash
./mvnw -Dtest=InputRulesTest test -B
```

To run all validation unit tests:

```bash
./mvnw -Dtest=InputRulesTest,RequestValidationTest test -B
```

Latest successful result: `30 tests passed, 0 failed`.

## Integration test coverage

`CommissionFlowTest` is an integration test: it combines multiple application
components and runs against a temporary real PostgreSQL 16 database. It checks:

- Commission tier is frozen when a course is purchased
- Old courses continue releasing commission when there is no new sale
- Course usage cannot exceed the remaining balance
- Substitute therapist fixed-fee and percentage-fee allocation
- Owner therapist receives the full commission without substitute fee
- Commission overflow policies: cap, company top-up, and approval blocking
- Shared course balance and member allocation
- Commission rounding and total-pool invariants
- Course usage lineage and adjustment behavior
- Zero-price course usage without creating a payment
- Course purchase, provisional pool, and frozen rate after monthly closing
- Course transfer without creating a new sale or commission pool
- Released course commission in the Commission report
- Most-specific Treatment Fee Rule resolution

The test database is disposable and is removed automatically after the run. It
does not use the application's normal PostgreSQL database.

Run from the backend directory:

```bash
bash run-commission-tests.sh
```

Expected result:

```text
Tests run: 26, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

The 26 integration scenarios cover tier freezing, old-course release,
appointment usage, balance limits, fixed and percentage treatment fees, owner
treatment, overflow policies, shared courses, pool reconciliation, usage
voids, refunds, termination policies, idempotent monthly closing, duplicate
checkout protection, zero-price usage, course purchase and frozen rates,
course transfers, released commission reporting, and treatment-fee rule
resolution.

## Manual smoke checks

The following pages were opened successfully in the local browser during the
latest check:

- Services / Treatment and Courses
- Dashboard
- Checkout
- Calendar
- Patients
- Appointments
- Reports

Docker health check during the same check:

- Frontend container: running on port 3000
- Backend health endpoint: `UP` on port 8080
- PostgreSQL container: healthy on port 5432

## Submission checklist

- Include `InputRulesTest`, `RequestValidationTest`, and `CommissionFlowTest`.
- Include an IntelliJ or terminal screenshot showing 56 passed and 0 failed.
- Include the green `Clinic CI` GitHub Actions run.
- Explain that `InputRulesTest` is a unit test, while `CommissionFlowTest` is an
  integration test because it uses real PostgreSQL.

## Not covered by automated tests

- Browser end-to-end flows still require a manual smoke test: patient creation,
  appointment, checkout, course usage, transfer, and report verification.
- The frontend pipeline runs lint and build; it does not currently include UI
  automation tests.

## Notes

- A passing unit test does not replace an integration test; the suites are
  intentionally reported separately.
- The test runner uses `./mvnw`, so a separate Maven installation is not needed.
