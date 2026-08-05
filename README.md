# Schedula Backend (`schedula-jagadeesh`)

[![Live Production API](https://img.shields.io/badge/Render-Live_Production-230433?style=for-the-badge&logo=render&logoColor=white)](https://schedula-backend-45oj.onrender.com/)
[![PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-v17_TLS-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://schedula-backend-45oj.onrender.com/)
[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](./LICENSE)

Schedula is a production-grade healthcare booking, scheduling, and availability management API built with **NestJS**, **TypeScript**, **TypeORM**, and **PostgreSQL**.

### 🌐 Live Production Infrastructure
* **Live Public API Base URL**: [`https://schedula-backend-45oj.onrender.com/`](https://schedula-backend-45oj.onrender.com/)
* **Hosted Cloud Database**: Neon PostgreSQL (AWS US East 1, Postgres v17 over TLS)
* **GitHub Repository**: [`https://github.com/Jagadeesh729/schedula-jagadeesh`](https://github.com/Jagadeesh729/schedula-jagadeesh)

---

## 📌 Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Functional Modules](#core-functional-modules)
- [Tech Stack & Dependencies](#tech-stack--dependencies)
- [API Endpoint Reference (22 Endpoints)](#api-endpoint-reference-22-endpoints)
- [Sample API Request & Response Payloads](#sample-api-request--response-payloads)
- [Elastic Doctor Scheduling Architecture (Day 11)](#elastic-doctor-scheduling-architecture-day-11)
- [Database Schema & Migration System](#database-schema--migration-system)
- [Concurrency & Transactional Protections](#concurrency--transactional-protections)
- [Installation & Local Setup](#installation--local-setup)
- [Automated Testing & Verification](#automated-testing--verification)
- [Technical References](#technical-references)

---

## Overview

Schedula simplifies doctor-patient interactions by replacing rigid clinic booking systems with dynamic availability management, strategy-driven slot generation (`STREAM` & `WAVE`), instant double-booking prevention, collision-free token allocation, and role-based clinical onboarding.

The backend is engineered following a clean **4-tier NestJS architecture**, enforcing separation of concerns, strong DTO domain validation (`class-validator`), idempotent database migrations (`synchronize: false`), pessimistic row-level locking (`pessimistic_write`), and strict resource ownership boundaries.

---

## System Architecture

```text
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  HTTP Client │ ──► │ Controller Layer │ ──► │ Service Layer  │ ──► │ TypeORM Repos    │ ──► │ PostgreSQL   │
│  (Postman)   │     │ (DTO Validation) │     │ (Domain Logic) │     │ (Database Layer) │     │ (Neon DB)    │
└──────────────┘     └──────────────────┘     └────────────────┘     └──────────────────┘     └──────────────┘
```

1. **Controller Layer**: Handles HTTP requests, path parameters, DTO validation, and role authorization (`JwtAuthGuard`, `RolesGuard`). Contains zero business or database logic.
2. **Service Layer**: Implements domain logic, interval arithmetic, calendar date reconstruction, token allocation algorithms, ownership verification, and transactional isolation.
3. **Repository Layer**: TypeORM repositories managing entity persistence, custom queries, and database transactions.
4. **Database Layer**: PostgreSQL database operating with explicit schema migrations, filtered partial unique indexes, and foreign keys (`synchronize: false`).

---

## Core Functional Modules

### 1. Authentication & Role-Based Authorization
* **JWT Authentication**: Secure user registration (`/auth/signup`) and authentication (`/auth/login`) issuing signed JWT tokens.
* **Bcrypt Password Security**: Password hashing with custom salt rounds prior to persistence.
* **Role-Based Access Control (RBAC)**: Custom `@Roles('DOCTOR')` and `@Roles('PATIENT')` decorators enforced by `RolesGuard`.

### 2. Clinical Profile Onboarding & Management
* **Doctor Profile Management**: Professional onboarding (`POST`, `GET`, `PATCH` under `/doctor/profile`) capturing specialization, experience, qualification, consultation fees, and bio.
* **Patient Profile Management**: Clinical intake onboarding (`POST`, `GET`, `PATCH` under `/patient/profile`) recording age, gender, contact details, and medical intake notes.

### 3. Doctor Availability Engine
* **Weekly Recurring Schedules**: Configure recurring daily slots (`POST`, `GET`, `PATCH`, `DELETE` under `/doctor/availability`) for specific weekdays (`Monday`–`Sunday`).
* **Custom Date Overrides**: Override weekly recurring availability on specific calendar dates (`POST /doctor/availability/override`) for holidays or special clinic hours.
* **Dynamic Date Lookup**: Query available slots for any calendar date (`GET /doctor/availability/date?date=YYYY-MM-DD`). Overrides automatically take precedence over recurring schedules.
* **Stateless Overlap Validation**: Algorithmic validation preventing overlapping slot creation while permitting valid adjacent slots (e.g. `09:00–10:00` followed by `10:00–11:00`).

### 4. Advanced Doctor Scheduling (`STREAM` & `WAVE`)
* **STREAM Strategy (Exact Appointment Times)**: Fixed slot duration and optional buffer time (e.g. 15-min slots + 5-min buffer). Deterministically generates non-overlapping slots.
* **WAVE Strategy (Token-Based Window Capacity)**: Time window booking with max patient capacity (e.g., 10:00 AM – 11:00 AM, max capacity = 5). Transactionally assigns incremental tokens (`1, 2, 3...`).

### 5. Elastic Doctor Scheduling (Shrink & Expand)
* **EXPAND Operation**: When working hours increase, new slots/capacity are generated for the added window without modifying existing bookings.
* **SHRINK Operation**: When working hours decrease, system queries active bookings in the removed window. If bookings exist, automated relocation or reschedule flagging takes effect.

### 6. Appointment Booking & Management
* **Polymorphic Booking Endpoint (`POST /appointment`)**: Book available STREAM slots or WAVE windows. Rejects past dates/times (`400`), un-generated slots (`400`), overbooking (`409`), and double-booking attempts (`409`).
* **Patient & Doctor Portals**: Dedicated endpoints (`GET /appointment/my`, `GET /doctor/appointments`) returning patient and doctor appointment schedules with full intake metadata.
* **IDOR-Protected Cancellation (`PATCH /appointment/:id/cancel`)**: Authenticated owner cancellation with resource ownership checks. Automatically restores STREAM slot availability and frees up WAVE window capacity.

### 7. Appointment Rescheduling Engine (Day 12)
* **Atomic Reschedule Endpoint (`PATCH /appointment/:id/reschedule`)**: Enables patients to reschedule active appointments while enforcing identical validation rules. Supports singular and plural route aliases (`/appointments/:id/reschedule`).
* **30-Minute Cutoff Enforcement**: Rejects rescheduling or cancellation requests within 30 minutes of appointment start time (`400 Bad Request`).
* **Slot Release & Token Reassignment**: Atomically releases previous slot/token and reserves new target slot/token inside a TypeORM transaction (`pessimistic_write` row locking).
* **Suggested Next Available Slot**: Automatically scans upcoming 14 days and populates `suggestedNextAvailable` in `409 Conflict` response payloads when target slot or WAVE capacity is unavailable.

---

## Tech Stack & Dependencies

| Layer | Technology | Version | Description |
|---|---|---|---|
| **Framework** | [NestJS](https://nestjs.com/) | `^11.0.1` | Enterprise Node.js framework |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.7.3` | Strongly-typed JavaScript |
| **Runtime** | [Node.js](https://nodejs.org/) | `v20+` / `v24+` | JavaScript runtime environment |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | `v17` | Cloud Neon PostgreSQL DB |
| **ORM** | [TypeORM](https://typeorm.io/) | `^1.1.0` | Data mapper object-relational mapping |
| **Authentication** | Passport JWT | `^11.0.2` | Strategy-based authentication |
| **Password Security**| `bcrypt` | `^6.0.0` | Cryptographic password hashing |
| **Validation** | `class-validator` | `^0.15.1` | Declarative DTO validation |

---

## API Endpoint Reference (22 Endpoints)

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
| **22** | Appointments | `PATCH` | `/appointment/:id/reschedule` | Reschedule an existing appointment (`STREAM` / `WAVE`) | Yes | `ROLE=PATIENT` |

---

## Sample API Request & Response Payloads

### 1. User Registration (`POST /auth/signup`)
```json
// Request Body
{
  "email": "doctor@hospital.com",
  "password": "Password123!",
  "role": "DOCTOR"
}

// Response (210 Created)
{
  "message": "User registered successfully",
  "user": {
    "id": "a1b2c3d4-0000-1111-2222-333344445555",
    "email": "doctor@hospital.com",
    "role": "DOCTOR",
    "createdAt": "2026-08-03T10:00:00.000Z"
  }
}
```

### 2. User Authentication (`POST /auth/login`)
```json
// Request Body
{
  "email": "doctor@hospital.com",
  "password": "Password123!"
}

// Response (200 OK)
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-0000-1111-2222-333344445555",
    "email": "doctor@hospital.com",
    "role": "DOCTOR"
  }
}
```

### 3. Doctor Scheduling Strategy (`POST /doctors/:doctorId/scheduling`)
```json
// STREAM Strategy Request Body
{
  "type": "STREAM",
  "slotDurationMinutes": 15,
  "bufferTimeMinutes": 5
}

// WAVE Strategy Request Body
{
  "type": "WAVE",
  "windowDurationMinutes": 60,
  "maxCapacityPerWindow": 5
}
```

### 4. Book Appointment (`POST /appointment`)
```json
// Request Body (Patient Role)
{
  "doctorId": "a1b2c3d4-0000-1111-2222-333344445555",
  "date": "2026-08-10",
  "startTime": "10:00",
  "endTime": "10:15"
}

// Response (201 Created)
{
  "id": "f9e8d7c6-5555-4444-3333-222211110000",
  "doctorId": "a1b2c3d4-0000-1111-2222-333344445555",
  "patientId": "b2c3d4e5-1111-2222-3333-444455556666",
  "date": "2026-08-10",
  "slotStartTime": "10:00",
  "slotEndTime": "10:15",
  "scheduleType": "STREAM",
  "status": "CONFIRMED"
}
```

### 5. Reschedule Appointment (`PATCH /appointment/:id/reschedule`)
```json
// Request Body (Patient Role)
{
  "date": "2026-08-10",
  "startTime": "10:20",
  "endTime": "10:35"
}

// Response (200 OK)
{
  "id": "f9e8d7c6-5555-4444-3333-222211110000",
  "date": "2026-08-10",
  "slotStartTime": "10:20",
  "slotEndTime": "10:35",
  "scheduleType": "STREAM",
  "status": "CONFIRMED",
  "message": "Appointment rescheduled successfully"
}

// Response (409 Conflict - Slot Unavailable)
{
  "statusCode": 409,
  "message": "Requested slot is already booked",
  "suggestedNextAvailable": {
    "date": "2026-08-10",
    "startTime": "10:40",
    "endTime": "10:55"
  }
}
```

---

## Elastic Doctor Scheduling Architecture (Day 11)

Elastic Doctor Scheduling handles dynamic working hour updates without invalidating existing patient bookings.

### EXPAND & SHRINK Decision Pipeline

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

### Architectural Breakdown
1. **EXPAND Flow**: Extends start/end times (e.g., `10:00 AM – 12:00 PM` $\rightarrow$ `09:00 AM – 12:00 PM`). Generates new slots for `09:00 AM – 10:00 AM`, keeping existing bookings in `10:00 AM – 12:00 PM` untouched.
2. **SHRINK Flow**: Reduces working hours (e.g., ending at `11:00 AM` instead of `12:00 PM`). Checks for active bookings in `11:00 AM – 12:00 PM`. If bookings exist, automatically relocates patients to nearest available slots or flags for resolution.

---

## Database Schema & Migration System

The application enforces a **code-first migration policy**:
* **`synchronize: false`**: Automatic schema synchronization is disabled to prevent data corruption.
* **`migrationsRun: true`**: Pending migrations are automatically applied on bootstrap.

### Migration Audit Trail
1. `1784700000001-CreateDoctorProfile.ts`: `doctor_profiles` table
2. `1784700000002-CreatePatientProfile.ts`: `patient_profiles` table
3. `1784800000001-CreateDoctorAvailability.ts`: `recurring_availabilities` & `custom_availabilities` tables
4. `1784900000001-CreateAdvancedScheduling.ts`: `scheduling_configs` & `appointments` tables with `status = 'CONFIRMED'` filtered partial unique indexes.

---

## Concurrency & Transactional Protections

1. **Pessimistic Write Locking (`pessimistic_write`)**: WAVE window token allocations execute inside database transactions with row-level locks on active window appointments.
2. **Lowest Missing Positive Integer Token Allocation**: Dynamically fills token gaps created by cancellations without token collision.
3. **Status-Filtered Partial Unique Indexes**:
   - `idx_wave_window_patient_unique`: Enforces single active booking per patient per wave window (`WHERE status = 'CONFIRMED'`).
   - `idx_wave_window_token_unique`: Guarantees active token uniqueness (`WHERE status = 'CONFIRMED'`).

---

## Installation & Local Setup

### Prerequisites
* **Node.js**: `v20.x` or higher
* **PostgreSQL**: `v17.x` (Local or Cloud URL)

### Environment Configuration (`.env`)
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/schedula
JWT_SECRET=super_secret_key_for_jwt
PORT=3000
```

### Running Locally
```bash
# Clone Repository
git clone https://github.com/Jagadeesh729/schedula-jagadeesh.git
cd schedula-jagadeesh

# Install Dependencies
npm install

# Start Development Server (Watch Mode)
npm run start:dev

# Build Production Bundle
npm run build

# Run Production Server
node dist/main
```

---

## Automated Testing & Verification

Run automated test suites while the server is running (`node dist/main`):

```bash
# 1. Jest Unit Tests
npm test -- --runInBand

# 2. Appointment Rescheduling Engine Test Suite (12 Scenarios)
node test-rescheduling-suite.js

# 3. STREAM & WAVE Advanced Scheduling Concurrency Suite (26 Scenarios)
node test-advanced-scheduling.js

# 4. Appointment Booking & Management Integration Suite (19 Scenarios)
node test-appointment-management.js

# 5. Core Availability & Onboarding Regression Suite (28 Scenarios)
node run-tests.js
```

---

## Technical References

* 📊 **Google Sheets API Endpoint Documentation**: [Hospital Backend API Documentation](https://docs.google.com/spreadsheets/d/10eVEnYG-3JAC4MrIJZ0CaLHuIdU8tPBY/edit?usp=sharing)
* 📐 **System Sequence Flowcharts**: See [`docs/FLOWCHARTS.md`](./docs/FLOWCHARTS.md)

---

## Conclusion

The Schedula Backend (`schedula-jagadeesh`) is fully implemented, verified, and merged into `main`. The application compiles cleanly with zero TypeScript errors, passes all unit and integration test suites (77 total scenarios), and enforces strict database-level concurrency protections.
