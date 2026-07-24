# Schedula Backend (`schedula-jagadeesh`)

Schedula is a robust, production-grade healthcare booking and availability management API built with **NestJS**, **TypeScript**, **TypeORM**, and **PostgreSQL**.

This repository implements core backend infrastructure including authentication, role-based authorization, doctor/patient profile onboarding, Doctor Availability management, and the **Advanced Doctor Scheduling Engine** (supporting **STREAM** and **WAVE** scheduling strategies).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Folder Structure](#folder-structure)
- [Advanced Doctor Scheduling Engine](#advanced-doctor-scheduling-engine)
  - [STREAM Scheduling](#1-stream-scheduling)
  - [WAVE Scheduling](#2-wave-scheduling)
- [Installation & Environment Setup](#installation--environment-setup)
- [Database Setup & Migrations](#database-setup--migrations)
- [Running the Project](#running-the-project)
- [API Reference](#api-reference)
  - [Authentication (`/auth`)](#1-authentication-auth)
  - [Doctor Profile (`/doctor/profile`)](#2-doctor-profile-doctorprofile)
  - [Patient Profile (`/patient/profile`)](#3-patient-profile-patientprofile)
  - [Doctor Availability (`/doctor/availability`)](#4-doctor-availability-doctoravailability)
  - [Doctor Scheduling (`/doctors/:doctorId/scheduling`)](#5-doctor-scheduling-doctorsdoctoridscheduling)
  - [Doctor Availability Engine (`/doctors/:doctorId/availability`)](#6-doctor-availability-engine-doctorsdoctoridavailability)
  - [Appointments (`/appointments`)](#7-appointments-appointments)
- [Flowcharts](#flowcharts)
- [Edge Cases & Error Handling](#edge-cases--error-handling)
- [Testing & Verification](#testing--verification)
- [License](#license)

---

## Overview

Schedula simplifies doctor-patient interactions by replacing rigid clinic booking systems with dynamic availability management, instant slot validation, concurrency-safe token generation, and role-based clinical onboarding. 

The backend is built around a clean, layered NestJS architecture enforcing separation of concerns, strong domain validation, idempotent database migrations, atomic database transactions, and explicit resource ownership boundaries.

---

## Features

### Authentication & Authorization
* **JWT Authentication**: User registration (`/auth/signup`) and secure authentication (`/auth/login`) issuing signed JWT tokens.
* **Bcrypt Hashing**: Secure password hashing prior to persistence.
* **Role-Based Access Control (RBAC)**: `JwtAuthGuard` and `RolesGuard` protecting endpoints based on `@Roles('DOCTOR')` and `@Roles('PATIENT')`.

### Profile Onboarding & Management
* **Doctor Profile Management**: Professional onboarding (`POST`, `GET`, `PATCH` under `/doctor/profile`) covering specialization, experience, qualification, consultation fees, and bio.
* **Patient Profile Management**: Clinical intake onboarding (`POST`, `GET`, `PATCH` under `/patient/profile`) recording age, gender, contact details, and basic health information.

### Doctor Availability System
* **Weekly Recurring Schedules**: Configure recurring daily slots (`POST`, `GET`, `PATCH`, `DELETE` under `/doctor/availability`) for specific weekdays (`Monday`–`Sunday`).
* **Custom Date Overrides**: Override weekly recurring availability on specific calendar dates (`POST /doctor/availability/override`).
* **Interval Overlap Validation**: Stateless algorithm preventing overlapping slot creation while permitting valid adjacent slots (e.g., `09:00–10:00` followed by `10:00–11:00`).

### Advanced Doctor Scheduling Engine (STREAM & WAVE)
* **STREAM Scheduling Strategy**:
  * Doctor configures `slotDuration` (e.g., 15 mins) and `bufferTime` (e.g., 5 mins).
  * System automatically computes available consultation slots within availability windows.
  * Patients book exact slots (e.g., `10:00-10:15`); booked slots immediately transition to `available: false`.
* **WAVE Scheduling Strategy**:
  * Doctor configures time window (e.g., `10:00-11:00`) and `maxCapacity` (e.g., 5 patients).
  * Concurrency-safe token generation assigns sequential arrival tokens (1, 2, 3, 4, 5) using PostgreSQL write locks inside database transactions.
  * Rejects bookings exceeding capacity with `409 Conflict` ("Wave Full").
  * Rejects duplicate patient bookings for the same wave window with `409 Conflict`.

### Database & Reliability
* **Code-First Migrations**: Idempotent TypeORM migrations executing automatically on server startup.
* **Strict Schema Rules**: Native PostgreSQL `TIME`, `DATE`, `VARCHAR` columns, foreign keys with `ON DELETE CASCADE`, composite `UNIQUE` constraints, and performance indexes.

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

## Project Architecture

The application implements a 4-tier clean architecture:

```text
HTTP Client ──► Controller ──► Service ──► Repository / Entity ──► PostgreSQL DB
```

1. **Controller Layer**: Handles HTTP requests, path parameter validation (`ParseUUIDPipe`), DTO validation, and delegates execution to service layer.
2. **Service Layer**: Isolated, modular services (`SchedulingConfigService`, `SlotGenerationService`, `WaveBookingService`, `AppointmentService`) handling scheduling logic, slot generation, token generation, and interval arithmetic.
3. **Repository / Entity Layer**: TypeORM repositories managing database operations for underlying PostgreSQL tables.
4. **Database Layer**: PostgreSQL database with explicit schema rules, pessimistic write locking for concurrency, indexes, and constraints (`synchronize: false`).

---

## Advanced Doctor Scheduling Engine

### 1. STREAM Scheduling

In STREAM scheduling, consultation time is divided into distinct, non-overlapping fixed-duration slots separated by buffer times.

- **Doctor Configuration**:
  - `schedulingType`: `"STREAM"`
  - `slotDuration`: Consultation length in minutes (e.g. `15`)
  - `bufferTime`: Rest/buffer length in minutes (e.g. `5`)
- **Generation Logic**:
  For an availability window of `10:00` to `11:00` with `duration=15` and `buffer=5`:
  - `Slot 1`: `10:00` - `10:15`
  - `Slot 2`: `10:20` - `10:35`
  - `Slot 3`: `10:40` - `10:55`
- **Patient Booking**: Patient selects an exact slot. Once booked, that slot's `available` flag becomes `false`.

### 2. WAVE Scheduling

In WAVE scheduling, multiple patients are booked into a common time window and receive sequential token numbers.

- **Doctor Configuration**:
  - `schedulingType`: `"WAVE"`
  - `maxCapacity`: Maximum patients per window (e.g. `5`)
- **Token Assignment Logic**:
  - Patient 1 books -> Window `"10:00-11:00"`, Token `1`
  - Patient 2 books -> Window `"10:00-11:00"`, Token `2`
  - Patient 5 books -> Window `"10:00-11:00"`, Token `5`
  - Patient 6 books -> Returns `409 Conflict` ("Wave Full")
- **Race Condition Prevention**: `WaveBookingService` uses PostgreSQL `pessimistic_write` row locking inside database transactions to ensure sequential token assignment without duplicates or race conditions.

---

## Installation & Environment Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Jagadeesh729/schedula-jagadeesh.git
cd schedula-jagadeesh
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/schedula
JWT_SECRET=super_secret_key_for_jwt
PORT=3000
```

---

## Database Setup & Migrations

Migrations execute automatically on server startup (`migrationsRun: true`).

The database contains 4 migration scripts in `src/migrations/`:
1. `1784700000001-CreateDoctorProfile.ts` -> Creates `doctor_profiles` table.
2. `1784700000002-CreatePatientProfile.ts` -> Creates `patient_profiles` table.
3. `1784800000001-CreateDoctorAvailability.ts` -> Creates `recurring_availabilities` and `custom_availabilities` tables.
4. `1784900000001-CreateAdvancedScheduling.ts` -> Creates `scheduling_configs` and `appointments` tables.

---

## Running the Project

```bash
# Build TypeScript artifacts
npm run build

# Start production server
npm run start:prod
```

---

## API Reference

### 1. Doctor Scheduling Strategy (`POST /doctors/:doctorId/scheduling`)

Configures a doctor's scheduling strategy (`STREAM` or `WAVE`).

- **Headers**: `Authorization: Bearer <DOCTOR_JWT>`
- **Path Parameter**: `:doctorId` (UUID, validated via `ParseUUIDPipe`)

#### Sample Request (STREAM):
```json
POST /doctors/1ef2cb98-85fa-465d-993e-cc06dbead71c/scheduling
{
  "schedulingType": "STREAM",
  "slotDuration": 15,
  "bufferTime": 5
}
```

#### Sample Response:
```json
{
  "id": "7b8f9e12-3456-7890-abcd-ef1234567890",
  "doctorId": "1ef2cb98-85fa-465d-993e-cc06dbead71c",
  "schedulingType": "STREAM",
  "slotDuration": 15,
  "bufferTime": 5,
  "maxCapacity": null,
  "createdAt": "2026-07-24T05:51:44.000Z",
  "updatedAt": "2026-07-24T05:51:44.000Z"
}
```

#### Sample Request (WAVE):
```json
POST /doctors/a3595f3f-86e3-4340-8d7d-188afd792c64/scheduling
{
  "schedulingType": "WAVE",
  "maxCapacity": 5
}
```

---

### 2. Doctor Availability Engine (`GET /doctors/:doctorId/availability`)

Returns calculated available slots or windows based on the doctor's active scheduling strategy.

- **Path Parameter**: `:doctorId` (UUID, validated via `ParseUUIDPipe`)
- **Query Parameter**: `date` (`YYYY-MM-DD`)

#### Sample Response (STREAM):
```json
GET /doctors/1ef2cb98-85fa-465d-993e-cc06dbead71c/availability?date=2026-08-03

[
  {
    "startTime": "10:00",
    "endTime": "10:15",
    "available": true
  },
  {
    "startTime": "10:20",
    "endTime": "10:35",
    "available": true
  },
  {
    "startTime": "10:40",
    "endTime": "10:55",
    "available": true
  }
]
```

#### Sample Response (WAVE):
```json
GET /doctors/a3595f3f-86e3-4340-8d7d-188afd792c64/availability?date=2026-08-03

[
  {
    "window": "10:00-11:00",
    "available": true,
    "capacity": 5
  }
]
```

---

### 3. Create Appointment (`POST /appointments`)

Books a consultation appointment under STREAM or WAVE strategy.

#### Sample Request (STREAM Booking):
```json
POST /appointments
{
  "doctorId": "1ef2cb98-85fa-465d-993e-cc06dbead71c",
  "date": "2026-08-03",
  "slot": {
    "startTime": "10:00",
    "endTime": "10:15"
  }
}
```

#### Sample Response (STREAM Booking):
```json
{
  "appointmentId": "1c9ae936-85d9-4de5-a201-15fef27c5412",
  "scheduleType": "STREAM",
  "token": null,
  "window": null,
  "slot": {
    "startTime": "10:00",
    "endTime": "10:15"
  },
  "status": "CONFIRMED"
}
```

#### Sample Request (WAVE Booking):
```json
POST /appointments
{
  "doctorId": "a3595f3f-86e3-4340-8d7d-188afd792c64",
  "date": "2026-08-03",
  "window": "10:00-11:00"
}
```

#### Sample Response (WAVE Booking):
```json
{
  "appointmentId": "2e8d219e-acc1-406e-ba3b-f139bc6548c6",
  "scheduleType": "WAVE",
  "token": 1,
  "window": "10:00-11:00",
  "slot": null,
  "status": "CONFIRMED"
}
```

---

### 4. Fetch Appointment Details (`GET /appointments/:id`)

Fetches appointment details by ID.

- **Path Parameter**: `:id` (UUID, validated via `ParseUUIDPipe`)

#### Sample Response:
```json
GET /appointments/1c9ae936-85d9-4de5-a201-15fef27c5412

{
  "appointmentId": "1c9ae936-85d9-4de5-a201-15fef27c5412",
  "doctorId": "1ef2cb98-85fa-465d-993e-cc06dbead71c",
  "patientId": "89e9c4e3-93e8-475f-82e6-c97e3517bd69",
  "scheduleType": "STREAM",
  "token": null,
  "window": null,
  "slot": {
    "startTime": "10:00",
    "endTime": "10:15"
  },
  "date": "2026-08-03",
  "status": "CONFIRMED",
  "createdAt": "2026-07-24T05:51:44.334Z"
}
```

---

## Flowcharts

Comprehensive Mermaid flowcharts for STREAM and WAVE workflows are available in [`docs/FLOWCHARTS.md`](./docs/FLOWCHARTS.md).

---

## Edge Cases & Error Handling

| Scenario | HTTP Code | Error Message / Details |
|---|---|---|
| Invalid UUID path parameter | `400 Bad Request` | `Validation failed (uuid is expected)` via `ParseUUIDPipe` |
| Invalid slotDuration (`<= 0`) | `400 Bad Request` | `invalid slot duration` |
| Negative bufferTime (`< 0`) | `400 Bad Request` | `negative buffer` |
| Duration exceeds window | `400 Bad Request` | `duration exceeds window` |
| Invalid maxCapacity (`<= 0`) | `400 Bad Request` | `capacity <= 0` |
| Booking past date/time | `400 Bad Request` | `Cannot book appointments for past dates or times` |
| Doctor profile not found | `404 Not Found` | `Doctor profile not found` |
| Doctor config missing | `404 Not Found` | `Doctor scheduling configuration not found` |
| Appointment ID not found | `404 Not Found` | `Appointment not found` |
| STREAM slot already booked | `409 Conflict` | `Slot already booked` |
| Duplicate WAVE booking | `409 Conflict` | `Patient already booked for this wave window` |
| WAVE capacity exceeded | `409 Conflict` | `Wave Full: Maximum capacity reached for this window` |

---

## Testing & Verification

### Running Automated Test Suites

Ensure backend server is running on port 3000 (`npm run start:prod`), then run:

```bash
# Run Advanced Scheduling Test Suite (21 test scenarios)
node test-advanced-scheduling.js

# Run Doctor Availability & Core Suite (28 test scenarios)
node run-tests.js
```

### Test Coverage Highlights
- ✅ Stream slot generation with buffer calculation
- ✅ Wave booking & sequential token assignment
- ✅ Capacity exceeded validation (`409 Conflict`)
- ✅ Duplicate booking prevention (`409 Conflict`)
- ✅ Overlap validation (`409 Conflict`)
- ✅ Past date booking rejection (`400 Bad Request`)
- ✅ ParseUUIDPipe parameter rejection (`400 Bad Request`)
- ✅ Doctor / Appointment Not Found handling (`404 Not Found`)

---

## License

This project is open-source software licensed under the [MIT License](LICENSE).
