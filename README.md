# Schedula Backend (`schedula-jagadeesh`)

Schedula is a robust, production-grade healthcare booking and availability management API built with **NestJS**, **TypeScript**, **TypeORM**, and **PostgreSQL**.

This repository implements the core backend infrastructure including authentication, role-based authorization, doctor/patient profile onboarding, and the Day 4 Doctor Availability Engine (supporting recurring weekly schedules and custom date overrides).

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
- [Validation Architecture](#validation-architecture)
- [Authorization & Security](#authorization--security)
- [Database Schema](#database-schema)
- [Testing & Verification](#testing--verification)
- [Engineering Decisions](#engineering-decisions)
- [Future Improvements](#future-improvements)
- [Conclusion](#conclusion)

---

## Overview

Schedula simplifies doctor-patient interactions by replacing rigid clinic booking systems with dynamic availability management, instant slot validation, and role-based clinical onboarding. 

The backend is built around a clean, layered NestJS architecture enforcing separation of concerns, strong domain validation, idempotent database migrations, and explicit resource ownership boundaries.

---

## Features

### Authentication & Authorization
* **JWT Authentication**: User registration (`/auth/signup`) and secure authentication (`/auth/login`) issuing signed JWT tokens.
* **Bcrypt Hashing**: Secure password hashing prior to persistence.
* **Role-Based Access Control (RBAC)**: `JwtAuthGuard` and `RolesGuard` protecting endpoints based on `@Roles('DOCTOR')` and `@Roles('PATIENT')`.

### Profile Onboarding & Management
* **Doctor Profile Management**: Professional onboarding (`POST`, `GET`, `PATCH` under `/doctor/profile`) covering specialization, experience, qualification, consultation fees, and bio.
* **Patient Profile Management**: Clinical intake onboarding (`POST`, `GET`, `PATCH` under `/patient/profile`) recording age, gender, contact details, and basic health information.

### Doctor Availability System (Day 4 Core)
* **Weekly Recurring Schedules**: Configure recurring daily slots (`POST`, `GET`, `PATCH`, `DELETE` under `/doctor/availability`) for specific weekdays (`Monday`–`Sunday`).
* **Custom Date Overrides**: Override weekly recurring availability on specific calendar dates (`POST /doctor/availability/override`) for holidays or special clinic hours.
* **Dynamic Date Availability Lookup**: Query available slots for any specific date (`GET /doctor/availability/date?date=YYYY-MM-DD`). Overrides automatically take precedence over recurring schedules.
* **Interval Overlap Validation**: Stateless algorithm preventing overlapping slot creation while permitting valid adjacent slots (e.g., `09:00–10:00` followed by `10:00–11:00`).
* **Calendar Date Verification**: Prevents invalid calendar date registration (e.g., rejecting non-existent dates like `2026-02-30`).
* **Resource Ownership Enforcement**: Doctors can only modify or delete availability slots belonging directly to their own profile.

### Database & Reliability
* **Code-First Migrations**: Idempotent TypeORM migrations executing automatically on server startup.
* **Strict Schema Rules**: Native PostgreSQL `TIME` and `DATE` columns, foreign keys with `ON DELETE CASCADE`, composite `UNIQUE` constraints, and performance indexes.

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
2. **Service Layer**: Contains all domain logic, interval arithmetic, calendar date reconstruction, ownership verification, and repository calls.
3. **Repository / Entity Layer**: TypeORM repositories managing database operations for underlying PostgreSQL tables.
4. **Database Layer**: PostgreSQL database operating with explicit schema rules, indexes, and constraints (`synchronize: false`).

---

## Folder Structure

```text
schedula-jagadeesh/
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
│   │   │   ├── create-doctor-profile.dto.ts
│   │   │   ├── update-doctor-profile.dto.ts
│   │   │   ├── create-recurring-availability.dto.ts
│   │   │   ├── update-recurring-availability.dto.ts
│   │   │   └── create-custom-availability.dto.ts
│   │   ├── entities/
│   │   │   ├── doctor-profile.entity.ts
│   │   │   ├── recurring-availability.entity.ts
│   │   │   └── custom-availability.entity.ts
│   │   └── enums/
│   │       └── weekday.enum.ts
│   ├── patient/                        # Patient Profile module
│   │   ├── patient.controller.ts
│   │   ├── patient.module.ts
│   │   ├── patient.service.ts
│   │   ├── dto/
│   │   │   ├── create-patient-profile.dto.ts
│   │   │   └── update-patient-profile.dto.ts
│   │   └── entities/
│   │       └── patient-profile.entity.ts
│   ├── users/                          # User entity module
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   ├── guards/                         # Security Guards
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/                     # Custom Decorators
│   │   └── roles.decorator.ts
│   └── migrations/                     # Database Migration Scripts
│       ├── 1784700000001-CreateDoctorProfile.ts
│       ├── 1784700000002-CreatePatientProfile.ts
│       └── 1784800000001-CreateDoctorAvailability.ts
├── run-tests.js                        # Complete 28-scenario integration test suite
├── test-availability.js                # Day 4 availability verification test script
├── package.json                        # Project metadata and dependencies
├── tsconfig.json                       # TypeScript compiler configuration
└── README.md                           # Documentation
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
   git clone <REPOSITORY_URL>
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

| Variable | Description | Default / Example | Required |
|---|---|---|---|
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://postgres:postgres123@localhost:5432/schedula` | Yes |
| `JWT_SECRET` | Secret key used for signing & verifying JWTs | `super_secret_key_for_jwt` | Yes |
| `PORT` | Listening port for NestJS server | `3000` | No (Defaults to `3000`) |

---

## Database Setup & Migrations

The project follows a **strict migration strategy**:

* **`synchronize: false`**: Automatic schema synchronization is disabled in `app.module.ts` to prevent accidental data loss or implicit table alterations in development and production environments.
* **`migrationsRun: true`**: TypeORM automatically executes pending migration files listed in `app.module.ts` upon application bootstrap.

### Executing Migrations
When starting the server (`npm run start:dev` or `node dist/main`), TypeORM automatically checks and runs all unapplied migrations:
1. `CreateDoctorProfile1784700000001`
2. `CreatePatientProfile1784700000002`
3. `CreateDoctorAvailability1784800000001`

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

#### `POST /auth/signup`
* **Authorization**: Public
* **Purpose**: Register a new user (`DOCTOR` or `PATIENT`).
* **Request Body**:
  ```json
  {
    "name": "Dr. Jane Doe",
    "email": "jane.doe@clinic.com",
    "password": "Password123!",
    "role": "DOCTOR"
  }
  ```
* **Response (`201 Created`)**:
  ```json
  {
    "id": "u472b5a1-...",
    "name": "Dr. Jane Doe",
    "email": "jane.doe@clinic.com",
    "role": "DOCTOR",
    "createdAt": "2026-07-23T12:00:00.000Z"
  }
  ```

#### `POST /auth/login`
* **Authorization**: Public
* **Purpose**: Authenticate user credentials and receive a JWT Bearer token.
* **Request Body**:
  ```json
  {
    "email": "jane.doe@clinic.com",
    "password": "Password123!"
  }
  ```
* **Response (`200 OK`)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```

---

### 2. Doctor Profile (`/doctor/profile`)

#### `POST /doctor/profile`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required)
* **Purpose**: Create doctor profile onboarding data.
* **Request Body**:
  ```json
  {
    "fullName": "Dr. Jane Doe",
    "specialization": "Cardiology",
    "experience": 8,
    "qualification": "MD, FACC",
    "consultationFee": 750.00,
    "availability": "Mon-Fri",
    "profileDetails": "Cardiologist with 8 years of clinical experience."
  }
  ```
* **Response (`201 Created`)**: Returns created `DoctorProfile` entity object.

#### `GET /doctor/profile`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required)
* **Purpose**: Retrieve profile details for the authenticated doctor.
* **Response (`200 OK`)**: Returns `DoctorProfile` entity object.

#### `PATCH /doctor/profile`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required)
* **Purpose**: Update specific profile fields for the authenticated doctor.
* **Response (`200 OK`)**: Returns updated `DoctorProfile` entity object.

---

### 3. Patient Profile (`/patient/profile`)

#### `POST /patient/profile`
* **Authorization**: `Bearer <JWT_TOKEN>` (`PATIENT` role required)
* **Purpose**: Create patient clinical intake profile.
* **Request Body**:
  ```json
  {
    "fullName": "John Smith",
    "age": 34,
    "gender": "Male",
    "contactDetails": "+15551234567",
    "basicHealthInformation": "No known allergies. Mild hypertension."
  }
  ```
* **Response (`201 Created`)**: Returns created `PatientProfile` entity object.

#### `GET /patient/profile`
* **Authorization**: `Bearer <JWT_TOKEN>` (`PATIENT` role required)
* **Purpose**: Retrieve profile details for the authenticated patient.
* **Response (`200 OK`)**: Returns `PatientProfile` entity object.

#### `PATCH /patient/profile`
* **Authorization**: `Bearer <JWT_TOKEN>` (`PATIENT` role required)
* **Purpose**: Update specific patient intake details.
* **Response (`200 OK`)**: Returns updated `PatientProfile` entity object.

---

### 4. Doctor Availability (`/doctor/availability`)

#### `POST /doctor/availability`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required)
* **Purpose**: Add a recurring weekly availability slot.
* **Request Body**:
  ```json
  {
    "weekday": "Monday",
    "startTime": "09:00",
    "endTime": "11:00"
  }
  ```
* **Response (`201 Created`)**:
  ```json
  {
    "id": "c89f10a2-...",
    "weekday": "Monday",
    "startTime": "09:00",
    "endTime": "11:00",
    "createdAt": "2026-07-23T12:30:00.000Z",
    "updatedAt": "2026-07-23T12:30:00.000Z"
  }
  ```

#### `GET /doctor/availability`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required)
* **Purpose**: List all recurring weekly slots for the authenticated doctor.
* **Response (`200 OK`)**: Array of `RecurringAvailability` objects.

#### `GET /doctor/availability/date?date=YYYY-MM-DD`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required)
* **Purpose**: Query availability slots for a specific date. Custom overrides take precedence over recurring schedules.
* **Response (`200 OK`)**:
  ```json
  {
    "source": "custom",
    "slots": [
      {
        "id": "e12089b3-...",
        "date": "2026-08-04",
        "startTime": "10:00",
        "endTime": "12:00"
      }
    ]
  }
  ```

#### `PATCH /doctor/availability/:id`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required; ownership checked)
* **Purpose**: Update an existing recurring availability slot.
* **Request Body**:
  ```json
  {
    "startTime": "08:00",
    "endTime": "10:00"
  }
  ```
* **Response (`200 OK`)**: Returns updated `RecurringAvailability` object.

#### `DELETE /doctor/availability/:id`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required; ownership checked)
* **Purpose**: Delete a recurring availability slot.
* **Response (`200 OK`)**: Returns deleted `RecurringAvailability` object.

#### `POST /doctor/availability/override`
* **Authorization**: `Bearer <JWT_TOKEN>` (`DOCTOR` role required)
* **Purpose**: Create a custom availability override for a specific date.
* **Request Body**:
  ```json
  {
    "date": "2026-08-04",
    "startTime": "10:00",
    "endTime": "12:00"
  }
  ```
* **Response (`201 Created`)**: Returns created `CustomAvailability` object.

---

## Validation Architecture

The application uses a **two-tier validation architecture**:

### 1. DTO-Level Validation (Syntactic Boundary)
Handled automatically at the framework boundary by NestJS's global `ValidationPipe` (`whitelist: true`, `transform: true`):
* **`@IsEnum(Weekday)`**: Restricts `weekday` fields to valid enum values (`Monday` through `Sunday`).
* **`@Matches(/^([0-1]\d|2[0-3]):[0-5]\d$/)`**: Restricts time strings to `HH:MM` 24-hour format.
* **`@Matches(/^\d{4}-\d{2}-\d{2}$/)`**: Restricts date strings to `YYYY-MM-DD` format.

### 2. Service-Level Validation (Semantic Domain)
Handled inside `DoctorAvailabilityService` private helper functions:
* **`validateTimeRange(startTime, endTime)`**: Converts times to minutes from midnight (`timeToMinutes`) and throws `BadRequestException` if `startTime >= endTime`.
* **`checkOverlap(existingSlots, newStart, newEnd)`**: Evaluates `newStart < existingEnd && existingStart < newEnd`. Throws `ConflictException` (`409`) on overlap while permitting adjacent boundaries.
* **`validateDate(date)`**: Reconstructs parsed year/month/day parameters into a JavaScript `Date` to catch invalid dates (e.g. throwing `BadRequestException` for `2026-02-30`).
* **`resolveDoctorProfile(userId)`**: Confirms doctor profile existence, throwing `NotFoundException` (`404`) if onboarding is incomplete.

---

## Authorization & Security

1. **JWT Strategy**: Requests carry `Authorization: Bearer <TOKEN>`. `JwtStrategy` validates the signature and populates `req.user` with `{ id, email, role }`.
2. **Role Guards**: `RolesGuard` evaluates `@Roles('DOCTOR')` or `@Roles('PATIENT')` against `req.user.role`. Access by unauthorized roles throws `403 Forbidden`.
3. **Identity Resolution**: `doctorId` is **never accepted in request bodies or query parameters**. Doctor identity is always resolved directly from `req.user.id`.
4. **Ownership Verification**: Before mutating or deleting availability records, the service verifies that `slot.doctor.id === resolvedDoctorProfile.id`. Mismatches throw `ForbiddenException`.

---

## Database Schema

```mermaid
erDiagram
    users ||--o| doctor_profiles : "has profile"
    users ||--o| patient_profiles : "has profile"
    doctor_profiles ||--o{ recurring_availabilities : "defines"
    doctor_profiles ||--o{ custom_availabilities : "overrides"

    users {
        uuid id PK
        string email UK
        string password
        string role
        timestamp created_at
    }

    doctor_profiles {
        uuid id PK
        uuid user_id FK, UK
        string full_name
        string specialization
        int experience
        string qualification
        decimal consultation_fee
        string availability
        text profile_details
        timestamp created_at
    }

    patient_profiles {
        uuid id PK
        uuid user_id FK, UK
        string full_name
        int age
        string gender
        string contact_details
        text basic_health_information
        timestamp created_at
    }

    recurring_availabilities {
        uuid id PK
        uuid doctor_id FK
        string weekday
        time start_time
        time end_time
        timestamp created_at
        timestamp updated_at
    }

    custom_availabilities {
        uuid id PK
        uuid doctor_id FK
        date date
        time start_time
        time end_time
        timestamp created_at
        timestamp updated_at
    }
```

### Table Summary & Constraints

| Table Name | Primary Key | Foreign Keys | Composite Constraints & Indexes |
|---|---|---|---|
| `users` | `id` (UUID) | None | `UNIQUE (email)` |
| `doctor_profiles` | `id` (UUID) | `user_id` → `users(id)` ON DELETE CASCADE | `UNIQUE (user_id)` |
| `patient_profiles` | `id` (UUID) | `user_id` → `users(id)` ON DELETE CASCADE | `UNIQUE (user_id)` |
| `recurring_availabilities` | `id` (UUID) | `doctor_id` → `doctor_profiles(id)` ON DELETE CASCADE | `UNIQUE (doctor_id, weekday, start_time, end_time)`, INDEX `(doctor_id, weekday)` |
| `custom_availabilities` | `id` (UUID) | `doctor_id` → `doctor_profiles(id)` ON DELETE CASCADE | `UNIQUE (doctor_id, date, start_time, end_time)`, INDEX `(doctor_id, date)` |

---

## Testing & Verification

The repository includes a comprehensive, automated test runner (`run-tests.js`) that validates the server at runtime.

### Running Automated Integration Tests

1. Start the server in one terminal:
   ```bash
   npm run start:dev
   ```

2. Run the test suite in a second terminal:
   ```bash
   node run-tests.js
   ```

### Test Suite Output Summary (28 Scenarios)

```text
═══════════════════════════════════════════════════════════
  Day 4 — Runtime Verification
  Target: http://localhost:3000
═══════════════════════════════════════════════════════════

══════ SETUP ══════
  Doctor 1 register: 201
  ✓ Doctor 1 registered and logged in
  ✓ Doctor 1 profile created
  Doctor 2 register: 201
  ✓ Doctor 2 registered and logged in
  Patient register: 201
  ✓ Patient registered and logged in

══════ AUTHORIZATION ══════
  ✓ PASS — T01 — No token → 401 | actual: 401
  ✓ PASS — T02 — Patient token → 403 | actual: 403

══════ RECURRING AVAILABILITY ══════
  ✓ PASS — T03 — Create valid recurring slot → 201 | actual: 201
  ✓ PASS — T04 — Create second non-overlapping slot → 201 | actual: 201
  ✓ PASS — T05 — Adjacent slot (11:00 after 09:00–11:00) → 201 (allowed) | actual: 201
  ✓ PASS — T06 — Overlapping slot → 409 | actual: 409
  ✓ PASS — T07 — Exact duplicate slot → 409 | actual: 409

══════ DTO VALIDATION ══════
  ✓ PASS — T08 — Invalid weekday → 400 | actual: 400
  ✓ PASS — T09 — startTime >= endTime → 400 | actual: 400
  ✓ PASS — T10 — Invalid time format (9:00 not HH:MM) → 400 | actual: 400

══════ GET RECURRING ══════
  ✓ PASS — T11 — GET recurring → 200 | actual: 200
  ✓ PASS — T12 — Returns array | actual: "object"

══════ UPDATE ══════
  ✓ PASS — T13 — Update own slot → 200 | actual: 200
  ✓ PASS — T14 — Updated startTime reflects change | actual: "08:00"
  ✓ PASS — T15 — Update another doctor slot → 403 | actual: 403

══════ DELETE ══════
  ✓ PASS — T16 — Delete own slot → 200 | actual: 200

══════ CUSTOM OVERRIDE ══════
  ✓ PASS — T17 — Create valid custom override → 201 | actual: 201
  ✓ PASS — T18 — Invalid calendar date (2026-02-30) → 400 | actual: 400
  ✓ PASS — T19 — Invalid calendar date (month 13) → 400 | actual: 400

══════ GET BY DATE ══════
  ✓ PASS — T20 — GET by date with override → 200 | actual: 200
  ✓ PASS — T21 — Returns source: custom | actual: "custom"
  ✓ PASS — T22 — Does not return recurring | actual: "custom"
  ✓ PASS — T23 — GET by date (Monday) with no override → 200 | actual: 200
  ✓ PASS — T24 — Returns source: recurring | actual: "recurring"
  ✓ PASS — T25 — GET /date with no query param → 400 | actual: 400

══════ REGRESSION — DAY 1-3 APIs ══════
  ✓ PASS — R01 — GET /doctor/profile still works → 200 | actual: 200
  ✓ PASS — R02 — PATCH /doctor/profile still works → 200 | actual: 200
  ✓ PASS — R03 — Login with wrong creds still returns 401 | actual: 401

═══════════════════════════════════════════════════════════
  RESULTS: 28 passed, 0 failed
═══════════════════════════════════════════════════════════
```

---

## Engineering Decisions

1. **Native PostgreSQL `TIME` Data Type**: Enables native PostgreSQL time validation and ordering. Prevents string format mismatches across application layers.
2. **`VARCHAR` Weekday Storage with TypeScript Enum**: Storing weekdays as `VARCHAR` while validating with `@IsEnum(Weekday)` at the DTO layer avoids rigid PostgreSQL `CREATE TYPE` DDL migrations while preserving strict compile-time and runtime validation.
3. **Stateless Interval Arithmetic**: Time inputs (`HH:MM`) are converted to minutes from midnight for all range checks. Strict comparison (`newStart < existingEnd && existingStart < newEnd`) cleanly allows adjacent slot boundaries (`09:00–10:00` and `10:00–11:00`) without triggering false conflicts.
4. **Static Route Declaration Order**: Placing static `@Get('date')` before dynamic `@Get(':id')` in `DoctorAvailabilityController` prevents NestJS route parameter shadowing.
5. **Defense-in-Depth Duplicate Prevention**: Combining application-level overlap checking with database composite `UNIQUE` constraints guarantees data integrity even during concurrent write operations.

---

## Future Improvements

*(Optional enhancements beyond the internship assignment scope)*

* **SQL-Level Overlap Operators**: Migrate overlap calculations from in-memory processing to PostgreSQL `OVERLAPS` or QueryBuilder range queries for ultra-high-volume slot datasets.
* **Calendar-Order Weekday Sorting**: Sort recurring weekday slot output by calendar day sequence (Monday–Sunday) rather than alphabetical `VARCHAR` sorting (`ASC`).
* **UUID Parameter Pipes**: Apply NestJS `ParseUUIDPipe` to path parameters to return `400 Bad Request` instead of `404 Not Found` when malformed UUID strings are passed.

---

## Conclusion

The Schedula Backend (`schedula-jagadeesh`) feature implementation for Day 4 Doctor Availability is **complete and verified**. The application compiles cleanly with zero TypeScript errors, auto-executes database schema migrations on startup, and passes a comprehensive 28-scenario integration test suite validating business rules, authorization guards, DTO schema boundaries, custom override precedence, and regression safety across existing Day 1–3 endpoints.
