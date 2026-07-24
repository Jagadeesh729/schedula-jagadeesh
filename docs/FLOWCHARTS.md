# Advanced Doctor Scheduling System — Architecture & Flowcharts

This document provides system architecture flowcharts for **STREAM** and **WAVE** scheduling strategies.

---

## 1. STREAM Scheduling Workflow

STREAM scheduling automatically divides doctor availability windows into fixed-duration consultation slots separated by buffer times.

```mermaid
graph TD
    A[Doctor Authentication] --> B[POST /doctors/:doctorId/scheduling]
    B -->|Configures STREAM: slotDuration=15, bufferTime=5| C[Save SchedulingConfig in DB]
    C --> D[POST /doctor/availability]
    D -->|Doctor defines window e.g. 10:00-11:00| E[Save Availability Window in DB]
    E --> F[Patient Query: GET /doctors/:doctorId/availability?date=YYYY-MM-DD]
    F --> G[SlotGenerationService: Initialize current = windowStart]
    G --> H{current + slotDuration <= windowEnd?}
    H -- Yes --> I[Generate Slot bounds e.g. 10:00-10:15]
    I --> J{Slot overlaps with CONFIRMED Appointment?}
    J -- No --> K[Set slot available: true]
    J -- Yes --> L[Set slot available: false]
    K --> M[Advance current += slotDuration + bufferTime]
    L --> M
    M --> H
    H -- No --> N[Return Generated Stream Slots Array]
    N --> O[Patient Booking: POST /appointments]
    O --> P{Validate: Valid UUID, Future Date, Slot within Window & Not Booked?}
    P -- Yes --> Q[Save Appointment Record: scheduleType=STREAM]
    Q --> R[Return 201 Created with Slot Payload]
    P -- No --> S[Return 400 Bad Request / 409 Conflict]
```

---

## 2. WAVE Scheduling Workflow

WAVE scheduling assigns patient arrival tokens for a common time window up to a configured maximum capacity, enforcing sequential token generation without race conditions.

```mermaid
graph TD
    A[Doctor Authentication] --> B[POST /doctors/:doctorId/scheduling]
    B -->|Configures WAVE: maxCapacity=5| C[Save SchedulingConfig in DB]
    C --> D[POST /doctor/availability]
    D -->|Doctor defines window e.g. 10:00-11:00| E[Save Availability Window in DB]
    E --> F[Patient Query: GET /doctors/:doctorId/availability?date=YYYY-MM-DD]
    F --> G[Query Active Appointments Count for Window]
    G --> H[Check available = bookedCount < maxCapacity]
    H --> I[Return Window Object: window, available, capacity]
    I --> J[Patient Booking: POST /appointments]
    J --> K[WaveBookingService: Start DB Transaction with Pessimistic Write Lock]
    K --> L{Check Duplicate Patient Booking for Window?}
    L -- Duplicate --> M[Rollback & Return 409 Conflict: Patient already booked]
    L -- Unique --> N{bookedCount >= maxCapacity?}
    N -- Yes --> O[Rollback & Return 409 Conflict: Wave Full]
    N -- No --> P[Calculate Token = bookedCount + 1]
    P --> Q[Save Appointment: scheduleType=WAVE, token=N]
    Q --> R[Commit Transaction & Return 201 Created with Token Payload]
```
