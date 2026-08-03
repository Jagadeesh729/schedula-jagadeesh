# Schedula Backend (`schedula-jagadeesh`)

[![Live Production API](https://img.shields.io/badge/Render-Live_Production-230433?style=for-the-badge&logo=render&logoColor=white)](https://schedula-backend-45oj.onrender.com/)
[![PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-v17_TLS-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://schedula-backend-45oj.onrender.com/)
[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)

Schedula is a robust, production-grade healthcare booking, scheduling, and availability management API built with **NestJS**, **TypeScript**, **TypeORM**, and **PostgreSQL**.

### 🌐 Live Production Service:
* **Live Base Public URL**: [`https://schedula-backend-45oj.onrender.com/`](https://schedula-backend-45oj.onrender.com/)
* **Hosted Cloud Database**: Neon PostgreSQL (AWS US East 1, Postgres v17 over TLS)
* **GitHub Repository**: [`https://github.com/Jagadeesh729/schedula-jagadeesh`](https://github.com/Jagadeesh729/schedula-jagadeesh)
* **Deployment PR**: [PR #9 (Merged)](https://github.com/Jagadeesh729/schedula-jagadeesh/pull/9)

---

This repository implements the complete end-to-end clinical backend infrastructure including authentication, role-based authorization, doctor/patient profile onboarding, Doctor Availability Engine (supporting recurring weekly schedules and custom date overrides), Advanced Doctor Scheduling System (`STREAM` exact slots & `WAVE` token-based capacity), **Elastic Doctor Scheduling (Shrink & Expand Architecture)**, and the complete Appointment Booking & Management API lifecycle with database-level concurrency protection.


---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup & Migrations](#database-setup--migrations)
- [Running the Project](#running-the-project)
- [API Reference](#api-reference)
  - [Authentication (`/auth`)](#1-authentication-auth)
  - [Doctor Profile (`/doctor/profile`)](#2-doctor-profile-doctorprofile)
  - [Patient Profile (`/patient/profile`)](#3-patient-profile-patientprofile)
  - [Doctor Availability (`/doctor/availability`)](#4-doctor-availability-doctoravailability)
  - [Advanced Doctor Scheduling (`/doctors/:doctorId/scheduling`)](#5-advanced-doctor-scheduling-doctorsdoctoridscheduling)
  - [Appointment Booking & Management (`/appointment`, `/doctor/appointments`)](#6-appointment-booking--management-appointment-doctorappointments)
- [Validation Architecture](#validation-architecture)
- [Authorization & Security](#authorization--security)
- [Database Schema & Migrations](#database-schema--migrations)
- [Concurrency & Database Protection](#concurrency--database-protection)
- [Testing & Verification](#testing--verification)
- [Engineering Decisions](#engineering-decisions)
- [Flowcharts](#flowcharts)
- [Conclusion](#conclusion)

---

## Overview

Schedula simplifies doctor-patient interactions by replacing rigid clinic booking systems with dynamic availability management, strategy-driven slot generation, instant double-booking prevention, collision-free token allocation, and role-based clinical onboarding.

The backend is built around a clean, 4-tier NestJS architecture enforcing separation of concerns, strong DTO domain validation, idempotent database migrations, optimistic/pessimistic transactional locking, and explicit resource ownership boundaries.

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
* **Custom Date Overrides**: Override weekly recurring availability on specific calendar dates (`POST /doctor/availability/override`) for holidays or special clinic hours.
* **Dynamic Date Availability Lookup**: Query available slots for any specific date (`GET /doctor/availability/date?date=YYYY-MM-DD`). Overrides automatically take precedence over recurring schedules.
* **Interval Overlap Validation**: Stateless algorithm preventing overlapping slot creation while permitting valid adjacent slots (e.g., `09:00–10:00` followed by `10:00–11:00`).

### Advanced Doctor Scheduling (STREAM & WAVE)
* **Strategy Selection**: Doctors select between `STREAM` (fixed appointment times) and `WAVE` (time window capacity with token numbers).
* **STREAM Strategy**: Fixed slot duration and optional buffer time (e.g. 15-min slots + 5-min buffer). Deterministically generates non-overlapping slots.
* **WAVE Strategy**: Window-based booking with max patient capacity (e.g., 10:00–11:00, max capacity = 5). Transactionally assigns incremental tokens ($1, 2, 3...$).

### Appointment Booking & Management
* **Appointment Booking (`POST /appointment`)**: Book available STREAM slots or WAVE windows. Rejects past dates/times (`400`), un-generated slots (`400`), overbooking (`409`), and double-booking attempts (`409`).
* **Patient Appointment View (`GET /appointment/my`)**: Returns authenticated patient's bookings with doctor profile details, timings, and status.
* **Doctor Appointment View (`GET /doctor/appointments`)**: Returns assigned appointments with patient intake details.
* **Appointment Cancellation (`PATCH /appointment/:id/cancel`)**: Authenticated owner cancellation with IDOR protection. Restores STREAM slot availability and frees up WAVE window capacity for new patients.

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

1. **Controller Layer**: Handles HTTP requests, path parameters, DTO mapping, and delegates execution to the service layer. Contains no business or database logic.
2. **Service Layer**: Contains all domain logic, interval arithmetic, calendar date reconstruction, token allocation, ownership verification, and repository calls.
3. **Repository / Entity Layer**: TypeORM repositories managing database operations for underlying PostgreSQL tables.
4. **Database Layer**: PostgreSQL database operating with explicit schema rules, indexes, and constraints (`synchronize: false`).

---

## Folder Structure

```text
schedula-jagadeesh/
├── docs/                               # Mermaid sequence flowcharts
│   └── FLOWCHARTS.md
├── dist/                               # Compiled JavaScript build output
├── src/                                # Source code
│   ├── app.controller.ts               # Base application controller
│   ├── app.module.ts                   # Root application module
│   ├── app.service.ts                  # Base application service
│   ├── main.ts                         # Application bootstrap entry point
│   ├── auth/                           # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── signup.dto.ts
│   ├── doctor/                         # Doctor Profile & Availability module
│   │   ├── doctor.controller.ts
│   │   ├── doctor.module.ts
│   │   ├── doctor.service.ts
│   │   ├── doctor-availability.controller.ts
│   │   ├── doctor-availability.service.ts
│   │   ├── dto/
│   │   ├── entities/
│   │   └── enums/
│   ├── patient/                        # Patient Profile module
│   │   ├── patient.controller.ts
│   │   ├── patient.module.ts
│   │   ├── patient.service.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── scheduling/                     # Advanced Scheduling & Appointment module
│   │   ├── controllers/
│   │   │   ├── appointment.controller.ts
│   │   │   └── doctors-scheduling.controller.ts
│   │   ├── dto/
│   │   │   └── scheduling.dto.ts
│   │   ├── entities/
│   │   │   ├── appointment.entity.ts
│   │   │   └── scheduling-config.entity.ts
│   │   ├── enums/
│   │   │   ├── appointment-status.enum.ts
│   │   │   └── scheduling-type.enum.ts
│   │   ├── services/
│   │   │   ├── appointment.service.ts
│   │   │   ├── appointment.service.spec.ts
│   │   │   └── scheduling-config.service.ts
│   │   └── scheduling.module.ts
│   ├── users/                          # User entity module
│   ├── guards/                         # Security Guards (JwtAuthGuard, RolesGuard)
│   ├── decorators/                     # Custom Decorators (@Roles)
│   └── migrations/                     # Code-first DB Migration Scripts
├── run-tests.js                        # Core regression integration test suite (28 scenarios)
├── test-advanced-scheduling.js        # STREAM & WAVE concurrency test suite (26 scenarios)
├── test-appointment-management.js     # Appointment booking integration suite (19 scenarios)
├── package.json                        # Project metadata and dependencies
├── tsconfig.json                       # TypeScript compiler configuration
└── README.md                           # Comprehensive Documentation
```

---

## Installation

### Prerequisites
* **Node.js**: `v20.x` or higher
* **PostgreSQL**: `v17.x` running locally or accessible via network URL
* **npm**: `v10.x` or higher

### Steps

1. **Clone Repository**:
   ```bash
   git clone https://github.com/Jagadeesh729/schedula-jagadeesh.git
   cd schedula-jagadeesh
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root (see [Environment Variables](#environment-variables)).

4. **Verify Database Connection**:
   Ensure PostgreSQL is running and the target database exists.

---

## Environment Variables

Create a `.env` file in the project root with the following configuration:

```env
# PostgreSQL Database Connection URL
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/schedula

# JWT Secret Key for signing tokens
JWT_SECRET=super_secret_key_for_jwt

# Application HTTP Listening Port
PORT=3000
```

---

## Database Setup & Migrations

The project follows a **strict migration strategy**:

* **`synchronize: false`**: Automatic schema synchronization is disabled in `app.module.ts` to prevent accidental data loss or implicit table alterations in development and production environments.
* **`migrationsRun: true`**: TypeORM automatically executes pending migration files listed in `app.module.ts` upon application bootstrap.

### Migration Files
1. `1784700000001-CreateDoctorProfile.ts`: `doctor_profiles` table
2. `1784700000002-CreatePatientProfile.ts`: `patient_profiles` table
3. `1784800000001-CreateDoctorAvailability.ts`: `recurring_availabilities` & `custom_availabilities` tables
4. `1784900000001-CreateAdvancedScheduling.ts`: `scheduling_configs` & `appointments` tables with `status = 'CONFIRMED'` filtered partial unique indexes.

---

## Running the Project

### Development Server (Watch Mode)
```bash
npm run start:dev
```

### Production Build
```bash
npm run build
```

### Production Server
```bash
node dist/main
```

---

## API Reference

### 1. Authentication (`/auth`)
* `POST /auth/signup`: Register new user (`DOCTOR` or `PATIENT`).
* `POST /auth/login`: Authenticate credentials and receive signed JWT.

### 2. Doctor Profile (`/doctor/profile`)
* `POST /doctor/profile`: Onboard doctor details (`DOCTOR` role).
* `GET /doctor/profile`: Fetch doctor profile (`DOCTOR` role).
* `PATCH /doctor/profile`: Update doctor profile (`DOCTOR` role).

### 3. Patient Profile (`/patient/profile`)
* `POST /patient/profile`: Onboard patient intake details (`PATIENT` role).
* `GET /patient/profile`: Fetch patient profile (`PATIENT` role).
* `PATCH /patient/profile`: Update patient profile (`PATIENT` role).

### 4. Doctor Availability (`/doctor/availability`)
* `POST /doctor/availability`: Set recurring weekly availability.
* `GET /doctor/availability`: Get recurring weekly slots.
* `GET /doctor/availability/date?date=YYYY-MM-DD`: Resolve effective availability for date.
* `PATCH /doctor/availability/:id`: Update recurring slot.
* `DELETE /doctor/availability/:id`: Delete recurring slot.
* `POST /doctor/availability/override`: Set custom date override.

### 5. Advanced Doctor Scheduling (`/doctors/:doctorId/scheduling`)
* `POST /doctors/:doctorId/scheduling`: Configure strategy (`STREAM` or `WAVE`).
* `GET /doctors/:doctorId/availability?date=YYYY-MM-DD`: Fetch generated slots (`STREAM`) or capacity windows (`WAVE`).

### 6. Appointment Booking & Management (`/appointment`, `/doctor/appointments`)
* `POST /appointment`: Book STREAM slot or WAVE window (`PATIENT` role).
* `GET /appointment/my`: Fetch patient's appointments with doctor details (`PATIENT` role).
* `GET /doctor/appointments`: Fetch doctor's assigned patient appointments (`DOCTOR` role).
* `PATCH /appointment/:id/cancel`: Cancel appointment (`PATIENT` owner only).
* `GET /appointment/:id`: Fetch specific appointment by ID (`PATIENT` owner or `DOCTOR` assigned).

---

## Concurrency & Database Protection

1. **Pessimistic Write Locking (`pessimistic_write`)**: WAVE window token allocations execute inside database transactions with row-level locks on existing active window appointments.
2. **Lowest Missing Positive Integer Token Allocation**: Dynamically fills token gaps created by cancellations without token collision.
3. **Status-Filtered Partial Unique Indexes**:
   - `idx_wave_window_patient_unique`: Enforces single active booking per patient per wave window (`WHERE status = 'CONFIRMED'`).
   - `idx_wave_window_token_unique`: Guarantees active token uniqueness (`WHERE status = 'CONFIRMED'`).

---

## Testing & Verification

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

## Flowcharts

Visual sequence flowcharts are documented in [`docs/FLOWCHARTS.md`](./docs/FLOWCHARTS.md), illustrating:
1. `STREAM` Exact Slot Generation & Booking Flow
2. `WAVE` Window Capacity & Sequential Token Allocation Flow
3. Appointment Cancellation & Re-availability Lifecycle

---

## Conclusion

The Schedula Backend (`schedula-jagadeesh`) is fully implemented, verified, and merged into `main`. The application compiles cleanly with zero TypeScript errors, passes unit and integration test suites (77 total scenarios), and enforces strict database-level concurrency protections.
