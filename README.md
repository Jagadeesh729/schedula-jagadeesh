# 🗓️ Schedula — Enterprise Medical Appointment & Elastic Scheduling Engine

[![NestJS](https://img.shields.io/badge/Framework-NestJS_v11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_v5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_v17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeORM](https://img.shields.io/badge/ORM-TypeORM_v1.1-FE0803?logo=typeorm&logoColor=white)](https://typeorm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deployment Status](https://img.shields.io/badge/Deployment-Render_Live-20C997?logo=render&logoColor=white)](https://schedula-backend-45oj.onrender.com/)

**Schedula** is a production-grade, highly reliable medical appointment scheduling backend engineered with **NestJS**, **TypeScript**, and **PostgreSQL (Neon Cloud DB over TLS)**. It features polymorphic scheduling strategies (**STREAM** 1-on-1 time slots & **WAVE** window-based token allocations), transactional row locking (`pessimistic_write`), database partial unique index safeguards, 30-minute pre-start rescheduling cutoffs, IDOR-protected cancellations, automatic next-available slot discovery, and an **Elastic Availability Engine (Shrink & Expand Auto-Rescheduling)**.

---

## 🌐 Live Application Deployment

- **Live Deployed API Base URL**: [`https://schedula-backend-45oj.onrender.com/`](https://schedula-backend-45oj.onrender.com/)
- **Live Health Reachability Status**: `200 OK`
- **Hosted Database**: Neon Cloud PostgreSQL v17 (AWS `us-east-1` over TLS)

---

## 📌 Problem Statement & Core Value Proposition

Healthcare scheduling systems face severe concurrency and operational challenges:
1. **Double-Booking Under High Concurrency**: Multi-patient booking spikes on popular doctor availability slots often result in race conditions.
2. **Rigid Strategy Support**: Traditional systems force doctors into fixed time slots, neglecting high-throughput walk-in wave windows.
3. **Rescheduling Collisions**: Last-minute appointment shifts lead to corrupted slot availability or orphaned tokens.
4. **Availability Shrink Disruptions**: When doctors shrink their working hours or delete availability windows, existing booked appointments get cancelled or lost without audit trails.

**Schedula** solves these challenges through:
- **Polymorphic Scheduling Engine**: Dynamic support for **STREAM** (individual fixed-duration slots + buffer time) and **WAVE** (max-patient token allocation windows).
- **Elastic Availability Engine (Shrink & Expand)**: Automatically detects appointments affected when a doctor shrinks availability hours or removes working days, auto-rescheduling them to the next available future slot/window with full audit metadata while preserving transaction safety (`QueryRunner`).
- **Pessimistic Transactional Row Locks**: Acquires TypeORM `pessimistic_write` locks during appointment modification, eliminating race conditions.
- **Database Partial Unique Indexes**: Enforces slot uniqueness directly in PostgreSQL (`WHERE status = 'CONFIRMED'`), ensuring storage-level integrity even under heavy load.
- **Automatic Alternative Discovery**: Returns `409 Conflict` with a populated `suggestedNextAvailable` slot object whenever a desired slot or window is full.

---

## 🏗️ Architecture & System Design

Schedula is built following a clean **4-Tier NestJS Architecture** (Controller $\rightarrow$ Service $\rightarrow$ Repository $\rightarrow$ Database Layer) with strict domain isolation and DTO validation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HTTP REQUEST TRANSPORT LAYER                    │
│   - Global ValidationPipe ({ whitelist: true })                        │
│   - RateLimiterGuard (Global & Auth Route Request Throttling)          │
│   - JwtAuthGuard -> RolesGuard (@Roles('DOCTOR' | 'PATIENT' | 'ADMIN')) │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION CONTROLLERS                       │
│  - AuthController          (/auth/signup, /auth/login)                 │
│  - DoctorController        (/doctor/profile)                           │
│  - PatientController       (/patient/profile)                          │
│  - DoctorAvailabilityCtrl  (/doctor/availability, /doctor/availability/:id)│
│  - DoctorsSchedulingCtrl   (/doctors/:doctorId/scheduling)             │
│  - AppointmentController   (/appointment/book, /appointment/reschedule)│
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           DOMAIN SERVICES                              │
│  - AppointmentService      (Rescheduling Engine & Lock Manager)        │
│  - DoctorAvailabilityServ  (Elastic Shrink/Expand Engine & Overrides) │
│  - SchedulingConfigServ    (Strategy Engine)                           │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         PERSISTENCE STORAGE                            │
│  - TypeORM QueryRunner Transaction (pessimistic_write locks & Rollbacks)│
│  - Neon PostgreSQL v17 (Partial Unique Indexes & Elastic Audit Columns)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Sequence Diagram: Elastic Availability Shrink Engine

```mermaid
sequenceDiagram
    autonumber
    actor Doctor as Doctor Client
    participant Ctrl as DoctorAvailabilityController
    participant Svc as DoctorAvailabilityService
    participant DB as PostgreSQL (TypeORM QueryRunner)

    Doctor->>Ctrl: PATCH /doctor/availability/:id (Shrink Hours / Remove Day)
    Ctrl->>Svc: updateRecurring(userId, id, dto)
    Svc->>DB: BEGIN TRANSACTION & acquire pessimistic_write locks
    Svc->>DB: Apply Recurring Availability Reduction
    Svc->>Svc: Detect Active Appointments Affected by Availability Shrink
    alt Affected Appointments Exist
        loop For Each Affected Appointment
            Svc->>Svc: Search Next 30 Days for Available STREAM Slot / WAVE Window
            alt Valid Future Slot Found
                Svc->>DB: Update Appointment Date/Slot/Token & Store Audit Metadata
            else No Future Slot Available
                Svc->>DB: ROLLBACK TRANSACTION
                Svc-->>Doctor: 400 Bad Request ("Cannot shrink availability: affected appointments could not be auto-rescheduled")
            end
        end
    end
    Svc->>DB: COMMIT TRANSACTION
    DB-->>Svc: Updated Availability & Auto-Rescheduled Audit Summary
    Svc-->>Doctor: 200 OK ({ autoRescheduledAppointmentsCount, autoRescheduledAppointments })
```

---

### 🔍 Sequence Diagram: Shrink Preview Dry-Run Engine (Read-Only)

```mermaid
sequenceDiagram
    autonumber
    actor Doctor as Doctor Client
    participant Ctrl as DoctorAvailabilityController
    participant Svc as DoctorAvailabilityService
    participant DB as PostgreSQL Database

    Doctor->>Ctrl: GET /doctor/availability/:id/shrink-preview?startTime=HH:MM&endTime=HH:MM
    Ctrl->>Svc: previewShrink(userId, id, startTime, endTime)
    Svc->>DB: Query Active CONFIRMED Appointments for Doctor
    Svc->>Svc: Detect Appointments Falling Outside Proposed Working Window
    Svc-->>Ctrl: Return Affected Count & Impacted Appointments (Read-Only Dry-Run)
    Ctrl-->>Doctor: 200 OK ({ affectedCount, affectedAppointments })
```

---

## 📁 Repository Directory Structure

```
schedula-jagadeesh/
├── .gitattributes                  # Vendor setup for 99% TypeScript Linguist classification
├── package.json                    # Project dependencies & npm scripts
├── tsconfig.json                   # TypeScript compiler configuration
├── nest-cli.json                   # NestJS CLI configuration
├── run-tests.js                    # Core Auth & Availability Test Suite (28 Scenarios)
├── test-appointment-management.js  # Booking & IDOR Cancellation Test Suite (19 Scenarios)
├── test-advanced-scheduling.js     # STREAM/WAVE Concurrency Test Suite (26 Scenarios)
├── test-rescheduling-suite.js      # Rescheduling & Cutoff Test Suite (12 Scenarios)
├── test-elastic-scheduling.js      # Elastic Shrink & Expand Engine Test Suite (18 Scenarios)
├── test-notification-workflow.js    # Notification System & Workflow Integration Test Suite
└── src/
    ├── main.ts                     # NestJS Bootstrap, CORS, ValidationPipe
    ├── app.module.ts              # Root AppModule, TypeORM connection, RateLimiterGuard
    ├── auth/                      # Authentication module (JWT, Bcrypt, Login/Signup)
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── auth.module.ts
    │   └── jwt.strategy.ts
    ├── doctor/                    # Doctor profile & elastic availability management
    │   ├── doctor.controller.ts
    │   ├── doctor.service.ts
    │   ├── doctor-availability.controller.ts
    │   ├── doctor-availability.service.ts
    │   └── entities/
    │       ├── doctor-profile.entity.ts
    │       ├── recurring-availability.entity.ts
    │       └── custom-availability.entity.ts
    ├── patient/                   # Patient profile management
    │   ├── patient.controller.ts
    │   ├── patient.service.ts
    │   └── entities/patient-profile.entity.ts
    ├── notification/              # Event-Based Notification Module
    │   ├── notification.controller.ts
    │   ├── notification.service.ts
    │   ├── notification.module.ts
    │   ├── dto/notification.dto.ts
    │   ├── entities/notification.entity.ts
    │   └── enums/notification-type.enum.ts
    ├── guards/                    # Security & Rate Limiting guards
    │   ├── jwt-auth.guard.ts
    │   ├── roles.guard.ts
    │   └── rate-limiter.guard.ts
    ├── scheduling/                # Core Scheduling Engine
    │   ├── controllers/
    │   │   ├── appointment.controller.ts
    │   │   └── doctors-scheduling.controller.ts
    │   ├── services/
    │   │   ├── appointment.service.ts
    │   │   └── scheduling-config.service.ts
    │   ├── dto/                   # DTOs with class-validator decorators
    │   │   ├── scheduling.dto.ts
    │   │   └── reschedule-appointment.dto.ts
    │   └── entities/
    │       ├── appointment.entity.ts
    │       └── scheduling-config.entity.ts
    └── migrations/                # Code-First TypeORM Migrations
        ├── 1784700000000-CreateUsers.ts
        ├── 1784700000001-CreateDoctorProfile.ts
        ├── 1784700000002-CreatePatientProfile.ts
        ├── 1784800000001-CreateDoctorAvailability.ts
        ├── 1784900000001-CreateAdvancedScheduling.ts
        ├── 1785000000001-AddElasticSchedulingMetadata.ts
        └── 1785100000001-CreateNotifications.ts
```

---

## 🗄️ Database Design & Partial Unique Indexes

Schedula utilizes PostgreSQL **Partial Unique Indexes** to enforce slot uniqueness directly at the database engine layer for active bookings while allowing historical cancelled records to persist for audit trails.

```sql
-- STREAM Strategy: Prevents double-booking the same exact slot for active appointments
CREATE UNIQUE INDEX idx_stream_slot_unique 
ON appointments (doctor_id, date, slot_start_time) 
WHERE status = 'CONFIRMED' AND slot_start_time IS NOT NULL;

-- WAVE Strategy: Enforces single patient per window and unique token allocation
CREATE UNIQUE INDEX idx_wave_window_patient_unique 
ON appointments (doctor_id, date, window, patient_id) 
WHERE status = 'CONFIRMED' AND window IS NOT NULL AND patient_id IS NOT NULL;

CREATE UNIQUE INDEX idx_wave_window_token_unique 
ON appointments (doctor_id, date, window, token) 
WHERE status = 'CONFIRMED' AND window IS NOT NULL AND token IS NOT NULL;

-- Event-Based Notifications: Enforces DB-level event deduplication
CREATE UNIQUE INDEX idx_notification_event_unique 
ON notifications (event_id) 
WHERE event_id IS NOT NULL;
```

---

## 🛠️ Technology Stack & Dependencies

| Layer | Component | Version / Library |
| :--- | :--- | :--- |
| **Core Framework** | NestJS | `v11.0.1` |
| **Language** | TypeScript | `v5.7.3` (`tsc --noEmit` clean) |
| **Database Engine**| PostgreSQL | `v17` (Neon Serverless PostgreSQL over TLS) |
| **ORM** | TypeORM | `v1.1.0` (Code-first migrations enabled) |
| **Authentication** | Passport.js + JWT | `@nestjs/jwt^11.0.0`, `passport-jwt^4.0.1` |
| **Password Security**| Bcrypt | `bcrypt^5.1.1` (Salt rounds: 10) |
| **Validation** | Class Validator | `class-validator^0.14.1`, `class-transformer^0.5.1` |

---

## 🔑 Key Features & Subsystems

### 1. Elastic Scheduling (Shrink & Expand Availability) Engine
- **Expansion**: Expanding availability hours or adding working days preserves all existing appointments while making newly created time slots/windows immediately bookable.
- **Shrink Auto-Rescheduling**: Shrinking availability hours or deleting recurring slots automatically detects affected active appointments and reschedules them to the next available recurring date/time for that doctor.
- **Audit Metadata Persistence**: Retains `previousDate`, `previousSlotStartTime`, `previousWindow`, `previousToken`, `isAutoRescheduled: true`, and `rescheduledReason: 'ELASTIC_AVAILABILITY_SHRINK'`.
- **Atomic Rollback Guarantee**: If any affected appointment cannot find a valid future slot within 30 days, the transaction rolls back (`queryRunner.rollbackTransaction()`), returning `400 Bad Request` to preserve data integrity.

### 2. STREAM & WAVE Scheduling Strategies
- **STREAM**: Generates discrete time slots (e.g. 15-minute appointment slots with 5-minute buffer intervals) based on doctor operational windows.
- **WAVE**: Assigns sequential token numbers (Token #1, Token #2, etc.) to patients booking within a fixed time window up to a maximum patient capacity (e.g. max 5 patients per 1-hour window).

### 3. Appointment Rescheduling Engine & Cutoff Guard
- **Pre-Start Cutoff Rule**: Rejects rescheduling requests attempted within 30 minutes of appointment start time (`400 Bad Request`).
- **Atomic Slot Swap**: Releases old slot reservation and acquires new slot inside a single TypeORM transaction with `pessimistic_write` row locks.
- **Conflict Resolution**: If the target slot is unavailable, scans the upcoming 14 days and returns `409 Conflict` with `suggestedNextAvailable`.

---

## 📑 Complete API Endpoint Table (22 Endpoints)

| Method | Path Alias 1 | Path Alias 2 | Auth Required | Description |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/auth/signup` | — | No | Register new Doctor or Patient account |
| `POST` | `/auth/login` | — | No | Authenticate user & receive JWT Bearer token |
| `POST` | `/doctor/profile` | — | Yes (`DOCTOR`) | Create or update Doctor profile |
| `GET` | `/doctor/profile` | — | Yes (`DOCTOR`) | Get authenticated Doctor profile |
| `POST` | `/patient/profile` | — | Yes (`PATIENT`) | Create or update Patient profile |
| `GET` | `/patient/profile` | — | Yes (`PATIENT`) | Get authenticated Patient profile |
| `POST` | `/doctor/availability` | — | Yes (`DOCTOR`) | Create recurring weekly availability slot |
| `GET` | `/doctor/availability` | — | Yes (`DOCTOR`) | List recurring availability slots |
| `PATCH`| `/doctor/availability/:id` | — | Yes (`DOCTOR`) | Update availability (Elastic Shrink/Expand Engine) |
| `GET`  | `/doctor/availability/:id/shrink-preview` | — | Yes (`DOCTOR`) | Dry-run preview of affected appointments for shrink |
| `DELETE`| `/doctor/availability/:id` | — | Yes (`DOCTOR`) | Delete availability (Elastic Shrink Auto-Reschedule) |
| `POST` | `/doctor/availability/override` | — | Yes (`DOCTOR`) | Set specific date override (e.g. Day Off) |
| `GET` | `/doctor/availability/date` | — | Yes | Query available slots for a doctor on date |
| `POST` | `/doctors/:doctorId/scheduling` | `/doctor/:doctorId/scheduling` | Yes (`ADMIN` / `DOCTOR`) | Setup STREAM or WAVE scheduling strategy |
| `GET` | `/doctors/:doctorId/scheduling` | `/doctor/:doctorId/scheduling` | Yes | Get doctor scheduling strategy config |
| `GET` | `/doctors/:doctorId/availability/windows` | `/doctor/:doctorId/availability/windows` | Yes | Get available slot windows for doctor |
| `POST` | `/appointment/book` | `/appointments/book` | Yes (`PATIENT`) | Book STREAM slot or WAVE token appointment |
| `GET` | `/appointment/my-appointments` | `/appointments/my-appointments` | Yes (`PATIENT`) | List authenticated patient's appointments |
| `PATCH`| `/appointment/:id/cancel` | `/appointments/:id/cancel` | Yes (`PATIENT`) | Cancel appointment with IDOR check |
| `PATCH`| `/appointment/:id/reschedule` | `/appointments/:id/reschedule` | Yes (`PATIENT`) | Reschedule appointment (30-min cutoff) |
| `GET` | `/doctor/appointments` | — | Yes (`DOCTOR`) | List doctor's appointments by date range |
| `GET` | `/doctor/appointments/today` | — | Yes (`DOCTOR`) | Get doctor's appointments scheduled for today |
| `GET` | `/notifications` | `/notification` | Yes (`PATIENT`) | Get patient's notifications (latest first) |
| `PATCH`| `/notifications/:id/read` | `/notification/:id/read` | Yes (`PATIENT`) | Mark notification as read |
| `PATCH`| `/notifications/read-all` | `/notification/read-all` | Yes (`PATIENT`) | Mark all unread notifications as read |
| `DELETE`| `/notifications/:id` | `/notification/:id` | Yes (`PATIENT`) | Delete a specific notification |
| `DELETE`| `/notifications` | `/notification` | Yes (`PATIENT`) | Delete all notifications for the patient |

---

## ⚡ Quick Start & Local Setup Guide

### Prerequisites
- Node.js `v20.18.0` or higher
- PostgreSQL instance running locally or a Neon DB cloud connection string

### 1. Installation
```bash
git clone https://github.com/Jagadeesh729/schedula-jagadeesh.git
cd schedula-jagadeesh
npm install
```

### 2. Environment Variables (`.env`)
Create a `.env` file in the project root:
```env
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=schedula_db
DATABASE_SSL=false
JWT_SECRET=your_super_secret_jwt_key_here
```

### 3. Database Migration Execution
```bash
# Run TypeORM migrations to set up tables, partial indexes, and elastic metadata
npm run migration:run
```

### 4. Build & Run Application
```bash
# Development mode
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

---

## 🧪 Automated Test Suite Execution

The repository includes **9 comprehensive test runner scripts** verifying **121 explicitly enumerated test cases** plus a **50-request high-contention stress test**:

```bash
# 1. Type Check (Ensure 0 compilation errors)
npx tsc --noEmit

# 2. Run Core Auth & Availability Suite (28 Test Cases)
node run-tests.js

# 3. Run Appointment Booking & IDOR Cancellation Suite (19 Test Cases)
node test-appointment-management.js

# 4. Run Advanced STREAM & WAVE Concurrency Suite (26 Test Cases)
node test-advanced-scheduling.js

# 5. Run Rescheduling & 30-Min Cutoff Suite (12 Test Cases)
node test-rescheduling-suite.js

# 6. Run Elastic Scheduling Engine Suite (18 Test Cases)
node test-elastic-scheduling.js

# 7. Run Event-Based Notification Workflow Suite (8 Test Cases)
node test-notification-workflow.js

# 8. Run Boundary Condition & Idempotent Edge-Case Suite (7 Test Cases)
node test-edge-cases.js

# 9. Run Direct PostgreSQL Partial Unique Index Invariant Suite (3 Test Cases - Code 23505)
node test-db-partial-index.js

# 10. Run 50-Way Parallel High-Contention Stress Suite (50 Parallel Requests - 1/49/0 Result)
node test-concurrency-stress.js
```

Archived test execution log file preserved at: [`scratch/logs/test-execution.log`](file:///C:/Users/kunda/.gemini/antigravity/brain/01ac7018-4860-437d-84e1-5df4ec62fd37/scratch/logs/test-execution.log).

---

## 📄 License & Author

- **Author**: Jagadeesh ([@Jagadeesh729](https://github.com/Jagadeesh729))
- **License**: MIT License — see [LICENSE](LICENSE) for details.
