# Schedula Backend (`schedula-jagadeesh`)

[![Live Production API](https://img.shields.io/badge/Render-Live_Production-230433?style=for-the-badge&logo=render&logoColor=white)](https://schedula-backend-45oj.onrender.com/)
[![PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-v17_TLS-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://schedula-backend-45oj.onrender.com/)
[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)

Schedula is a robust, production-grade healthcare booking, scheduling, and availability management API built with **NestJS**, **TypeScript**, **TypeORM**, and **PostgreSQL**.

### 🌐 Production Infrastructure
* **Live Public API Base URL**: [`https://schedula-backend-45oj.onrender.com/`](https://schedula-backend-45oj.onrender.com/)
* **Hosted Database**: Neon PostgreSQL (AWS US East 1, Postgres v17 over TLS)
* **GitHub Repository**: [`https://github.com/Jagadeesh729/schedula-jagadeesh`](https://github.com/Jagadeesh729/schedula-jagadeesh)

---

## Overview

Schedula simplifies doctor-patient interactions by replacing rigid clinic booking systems with dynamic availability management, strategy-driven slot generation, instant double-booking prevention, collision-free token allocation, and role-based clinical onboarding.

The backend is built around a clean, 4-tier NestJS architecture enforcing separation of concerns, strong DTO domain validation, idempotent database migrations, pessimistic transactional locking, and explicit resource ownership boundaries.

---

## Key System Features

### 1. Authentication & Authorization
* **JWT Authentication**: User registration (`/auth/signup`) and secure authentication (`/auth/login`) issuing signed JWT tokens.
* **Bcrypt Hashing**: Secure password hashing prior to persistence.
* **Role-Based Access Control (RBAC)**: `JwtAuthGuard` and `RolesGuard` protecting endpoints based on `@Roles('DOCTOR')` and `@Roles('PATIENT')`.

### 2. Profile Onboarding & Management
* **Doctor Profile Management**: Professional onboarding (`POST`, `GET`, `PATCH` under `/doctor/profile`) covering specialization, experience, qualification, consultation fees, and bio.
* **Patient Profile Management**: Clinical intake onboarding (`POST`, `GET`, `PATCH` under `/patient/profile`) recording age, gender, contact details, and basic health information.

### 3. Doctor Availability Engine
* **Weekly Recurring Schedules**: Configure recurring daily slots (`POST`, `GET`, `PATCH`, `DELETE` under `/doctor/availability`) for specific weekdays (`Monday`–`Sunday`).
* **Custom Date Overrides**: Override weekly recurring availability on specific calendar dates (`POST /doctor/availability/override`) for holidays or special clinic hours.
* **Dynamic Date Availability Lookup**: Query available slots for any specific date (`GET /doctor/availability/date?date=YYYY-MM-DD`). Overrides automatically take precedence over recurring schedules.
* **Interval Overlap Validation**: Stateless algorithm preventing overlapping slot creation while permitting valid adjacent slots (e.g., `09:00–10:00` followed by `10:00–11:00`).

### 4. Advanced Doctor Scheduling (`STREAM` & `WAVE`)
* **Strategy Selection**: Doctors select between `STREAM` (fixed appointment times) and `WAVE` (time window capacity with token numbers).
* **STREAM Strategy**: Fixed slot duration and optional buffer time (e.g. 15-min slots + 5-min buffer). Deterministically generates non-overlapping slots.
* **WAVE Strategy**: Window-based booking with max patient capacity (e.g., 10:00–11:00, max capacity = 5). Transactionally assigns incremental tokens (`1, 2, 3...`).

### 5. Elastic Doctor Scheduling Architecture (Shrink & Expand)
* **EXPAND Flow (Hours Increased)**: When working hours expand, new slots/capacity are generated for the added window without modifying existing bookings.
* **SHRINK Flow (Hours Decreased)**: When working hours shrink, system queries active bookings in the removed window. If bookings exist, automated relocation or reschedule flagging takes effect.

### 6. Appointment Booking & Concurrency Protection
* **Polymorphic Appointment Booking (`POST /appointment`)**: Book available STREAM slots or WAVE windows. Rejects past dates/times (`400`), un-generated slots (`400`), overbooking (`409`), and double-booking attempts (`409`).
* **Patient & Doctor Views**: Dedicated endpoints (`GET /appointment/my`, `GET /doctor/appointments`) for patient and doctor management.
* **Appointment Cancellation (`PATCH /appointment/:id/cancel`)**: Authenticated owner cancellation with IDOR protection. Restores STREAM slot availability and frees up WAVE window capacity.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | [NestJS](https://nestjs.com/) | `^11.0.1` |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.7.3` |
| **Runtime** | [Node.js](https://nodejs.org/) | `v20+` / `v24+` |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | `v17` |
| **ORM** | [TypeORM](https://typeorm.io/) | `^1.1.0` |
| **Authentication** | Passport JWT (`passport-jwt`, `@nestjs/jwt`) | `^11.0.2` |
| **Password Security**| `bcrypt` | `^6.0.0` |
| **Validation** | `class-validator`, `class-transformer` | `^0.15.1` |

---

## Architecture & Database Design

### 4-Tier Architecture
```text
HTTP Client ──► Controller Layer ──► Service Layer ──► Repository / Entity ──► PostgreSQL DB
```

### Concurrency & Database Protections
1. **Pessimistic Write Locking (`pessimistic_write`)**: WAVE window token allocations execute inside database transactions with row-level locks on existing active window appointments.
2. **Lowest Missing Positive Integer Token Allocation**: Dynamically fills token gaps created by cancellations without token collision.
3. **Status-Filtered Partial Unique Indexes**:
   - `idx_wave_window_patient_unique`: Enforces single active booking per patient per wave window (`WHERE status = 'CONFIRMED'`).
   - `idx_wave_window_token_unique`: Guarantees active token uniqueness (`WHERE status = 'CONFIRMED'`).

---

## Folder Structure

```text
schedula-jagadeesh/
├── docs/                               # Mermaid sequence flowcharts & diagrams
│   └── FLOWCHARTS.md
├── src/                                # Source code
│   ├── main.ts                         # Application bootstrap entry point
│   ├── app.module.ts                   # Root application module
│   ├── auth/                           # Authentication module (JWT, bcrypt, DTOs)
│   ├── doctor/                         # Doctor Profile & Availability module
│   ├── patient/                        # Patient Profile module
│   ├── scheduling/                     # Advanced Scheduling & Appointment module
│   ├── users/                          # User entity module
│   ├── guards/                         # JwtAuthGuard, RolesGuard
│   ├── decorators/                     # Custom Decorators (@Roles)
│   └── migrations/                     # Code-first DB Migration Scripts
├── run-tests.js                        # Core regression integration test suite (28 scenarios)
├── test-advanced-scheduling.js        # STREAM & WAVE concurrency test suite (26 scenarios)
├── test-appointment-management.js     # Appointment booking integration suite (19 scenarios)
├── package.json                        # Project metadata and dependencies
└── tsconfig.json                       # TypeScript compiler configuration
```

---

## API Reference (Full 21 Endpoints)

| # | Category | Method | Endpoint | Description | Auth Required | Allowed Roles |
| :- | :--- | :--- | :--- | :--- | :---: | :--- |
| **1** | Auth | `POST` | `/auth/signup` | Register new user (doctor or patient) | No | Public |
| **2** | Auth | `POST` | `/auth/login` | Login user and return signed JWT token | No | Public |
| **3** | Doctor | `POST` | `/doctor/profile` | Create doctor profile linked to user | Yes | `ROLE=DOCTOR` |
| **4** | Doctor | `GET` | `/doctor/profile` | Fetch doctor profile of logged-in doctor | Yes | `ROLE=DOCTOR` |
| **5** | Doctor | `PATCH` | `/doctor/profile` | Update fields in doctor profile | Yes | `ROLE=DOCTOR` |
| **6** | Patient | `POST` | `/patient/profile` | Create patient profile linked to user | Yes | `ROLE=PATIENT` |
| **7** | Patient | `GET` | `/patient/profile` | Fetch patient profile of logged-in patient | Yes | `ROLE=PATIENT` |
| **8** | Patient | `PATCH` | `/patient/profile` | Update fields in patient profile | Yes | `ROLE=PATIENT` |
| **9** | Doctor Availability | `POST` | `/doctor/availability` | Create recurring weekly availability slot | Yes | `ROLE=DOCTOR` |
| **10** | Doctor Availability | `GET` | `/doctor/availability` | List recurring availability for logged-in doctor | Yes | `ROLE=DOCTOR` |
| **11** | Doctor Availability | `PATCH` | `/doctor/availability/:id` | Update recurring availability record by ID | Yes | `ROLE=DOCTOR` |
| **12** | Doctor Availability | `DELETE` | `/doctor/availability/:id` | Delete recurring availability record by ID | Yes | `ROLE=DOCTOR` |
| **13** | Doctor Availability | `POST` | `/doctor/availability/override` | Create custom date availability override | Yes | `ROLE=DOCTOR` |
| **14** | Doctor Availability | `GET` | `/doctor/availability/date` | Get dynamic availability for date (`?date=YYYY-MM-DD`) | Yes | `DOCTOR` / `PATIENT` |
| **15** | Doctor Scheduling Config | `POST` | `/doctors/:doctorId/scheduling` | Configure strategy (`STREAM` / `WAVE`, duration, capacity) | Yes | `DOCTOR` / `ADMIN` |
| **16** | Doctor Scheduling Config | `GET` | `/doctors/:doctorId/availability` | Fetch generated STREAM slots or WAVE windows | No | Public / Patient |
| **17** | Appointments | `POST` | `/appointment` | Book appointment based on doctor strategy & slot | Yes | `ROLE=PATIENT` |
| **18** | Appointments | `GET` | `/appointment/my` | List appointments for logged-in patient | Yes | `ROLE=PATIENT` |
| **19** | Appointments | `PATCH` | `/appointment/:id/cancel` | Cancel an appointment for logged-in patient | Yes | `ROLE=PATIENT` |
| **20** | Appointments | `GET` | `/doctor/appointments` | List appointments for logged-in doctor | Yes | `ROLE=DOCTOR` |
| **21** | Appointments | `GET` | `/appointment/:id` | Fetch details of specific appointment by ID | Yes | Authenticated User |

---

## Elastic Scheduling Workflow (Shrink & Expand)

```mermaid
graph TD
    A[Doctor Request: Update Availability Start/End Time] --> B{Determine Change Type}
    B -->|EXPAND: Hours Increased| C[Update Doctor Availability Record]
    C --> D[Generate New Slots for Added Time Window]
    D --> E[Preserve All Existing Bookings Unchanged]
    E --> F[Publish New Slots for Patient Booking]

    B -->|SHRINK: Hours Decreased| G{Check Booked Appointments in Removed Window}
    G -->|Zero Bookings| H[Update Availability Record Directly]
    G -->|Bookings Exist| I[Search Nearest Available Slot / Wave Window]
    I --> J{Suitable Free Slot Found?}
    J -->|Yes| K[Auto-Reschedule Patient to New Slot & Send Notification]
    J -->|No| L[Flag for Patient Reschedule / Cancel as Last Resort & Send Notification]
```

---

## Installation & Setup

### Prerequisites
* **Node.js**: `v20.x` or higher
* **PostgreSQL**: `v17.x` local or cloud URL

### Environment Setup (`.env`)
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/schedula
JWT_SECRET=super_secret_key_for_jwt
PORT=3000
```

### Running Locally
```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Build for production
npm run build

# Start production server
node dist/main
```

---

## Verification & Testing

Run automated test suites while the server is running (`node dist/main`):

```bash
# 1. Jest Unit Tests
npm test -- --runInBand

# 2. Appointment Booking & Management Integration Suite (19 Scenarios)
node test-appointment-management.js

# 3. STREAM & WAVE Advanced Scheduling Concurrency Suite (26 Scenarios)
node test-advanced-scheduling.js

# 4. Core Availability & Onboarding Regression Suite (28 Scenarios)
node run-tests.js
```

---

## Technical Documentation Links

* 📊 **Google Sheets API Endpoint Documentation**: [Hospital Backend API Documentation](https://docs.google.com/spreadsheets/d/10eVEnYG-3JAC4MrIJZ0CaLHuIdU8tPBY/edit?usp=sharing)
* 📐 **System Sequence Flowcharts**: See [`docs/FLOWCHARTS.md`](./docs/FLOWCHARTS.md)

---

## Conclusion

The Schedula Backend (`schedula-jagadeesh`) is fully implemented, verified, and merged into `main`. The application compiles cleanly with zero TypeScript errors, passes unit and integration test suites (77 total scenarios), and enforces strict database-level concurrency protections.
