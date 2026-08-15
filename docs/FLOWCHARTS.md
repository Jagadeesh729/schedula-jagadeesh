# 📊 Schedula System Architecture & Workflow Flowcharts

This document details the end-to-end operational workflows and engineering flowcharts for all scheduling strategies, event notifications, elastic adjustments, and background cron reminder jobs in **Schedula**.

---

## 1. 🗓️ STREAM Appointment Booking Flow

```mermaid
graph TD
    A[Patient Request: Book STREAM Slot POST /appointment/book] --> B{Check Doctor Config}
    B -->|STREAM Mode| C[Validate Slot Duration & Buffer Times]
    C --> D{Check Slot Availability in PostgreSQL}
    D -->|Slot Available| E[Acquire Row Lock & Set Status to CONFIRMED]
    E --> F[Trigger APPOINTMENT_BOOKED Notification Event]
    F --> G[Dispatch Real-Time WebSocket Message & Log Email]
    G --> H[Return 201 Created with Booking Details]
    D -->|Already Booked| I[Rollback & Return 409 Conflict]
    B -->|WAVE Mode| J[Return 400 Bad Request: Doctor Uses WAVE Strategy]
```

---

## 2. 🎟️ WAVE Appointment Booking & Token Assignment Flow

```mermaid
graph TD
    A[Patient Request: Book WAVE Window POST /appointment/book] --> B{Check Doctor Config}
    B -->|WAVE Mode| C[Begin Database Transaction]
    C --> D[Acquire Pessimistic Write Lock on Doctor Date Window]
    D --> E{Patient Already Booked in Window?}
    E -->|Yes: Duplicate Booking| F[Rollback & Return 409 Conflict]
    E -->|No: New Booking| G{Check Window Capacity vs Max Patients}
    G -->|Capacity Full| H[Rollback & Return 409 Conflict]
    G -->|Capacity Available| I[Calculate Lowest Missing Positive Integer Token]
    I --> J[Save Appointment with Assigned Token & Status CONFIRMED]
    J --> K[Trigger APPOINTMENT_BOOKED Notification Event]
    K --> L[Commit Transaction & Broadcast Real-Time WebSocket Event]
    L --> M[Return 201 Created with Window & Token #]
```

---

## 3. 🚫 Appointment Cancellation & 30-Minute Cutoff Guard

```mermaid
graph TD
    A[Patient Request: Cancel Appointment PATCH /appointment/:id/cancel] --> B{Appointment Exists?}
    B -->|No| C[Return 404 Not Found]
    B -->|Yes| D{Patient Owns Appointment?}
    D -->|No: Unauthorized User| E[Return 403 Forbidden IDOR]
    D -->|Yes: Authenticated Owner| F{Status = CONFIRMED?}
    F -->|No: Already Cancelled| G[Return 400 Bad Request: Already Cancelled]
    F -->|Yes: Active Booking| H{30-Min Cutoff Guard: StartTime - Now >= 30 mins?}
    H -->|No: Within Cutoff| I[Return 400 Bad Request: Cannot Cancel within 30 mins]
    H -->|Yes: Eligible| J[Update Status to CANCELLED]
    J --> K[Reopen STREAM Slot / WAVE Capacity without Token Collision]
    K --> L[Trigger APPOINTMENT_CANCELLED Notification Event]
    L --> M[Return 200 OK Cancelled Successfully]
```

---

## 4. 🔄 Appointment Rescheduling & Conflict Alternative Discovery

```mermaid
graph TD
    A[Patient Request: Reschedule Appointment PATCH /appointment/:id/reschedule] --> B{Appointment Exists?}
    B -->|No| C[Return 404 Not Found]
    B -->|Yes| D{Patient Owns Appointment?}
    D -->|No: Unauthorized User| E[Return 403 Forbidden IDOR]
    D -->|Yes: Authenticated Owner| F{Status = CONFIRMED?}
    F -->|No: Cancelled| G[Return 400 Bad Request: Cannot Reschedule Cancelled]
    F -->|Yes| H{30-Min Cutoff Guard: StartTime - Now >= 30 mins?}
    H -->|No: Within Cutoff| I[Return 400 Bad Request: Reschedule Cutoff Expired]
    H -->|Yes| J{Target Slot / Date Same as Current?}
    J -->|Yes| K[Return 400 Bad Request: Cannot Reschedule to Same Slot]
    J -->|No| L[Begin QueryRunner Transaction & Acquire Pessimistic Locks]
    L --> M{Is Target Slot / Wave Window Available?}
    M -->|No: Slot Unavailable| N[Scan Next 14 Days for Doctor Available Slots]
    N --> O[Rollback & Return 409 Conflict with suggestedNextAvailable]
    M -->|Yes: Target Available| P[Release Old Slot Reservation & Acquire New Target Slot]
    P --> Q[Update Appointment Date, Time & Token]
    Q --> R[Trigger APPOINTMENT_RESCHEDULED Notification Event]
    R --> S[Commit Transaction & Return 200 OK Rescheduled]
```

---

## 5. 📐 Elastic Scheduling (Shrink & Expand Availability)

```mermaid
graph TD
    A[Doctor Request: Update Availability PATCH /doctor/availability/:id] --> B{Determine Adjustment Type}
    B -->|EXPAND: Working Hours Widened| C[Update Doctor Availability Record]
    C --> D[Generate New Bookable Slots for Expanded Window]
    D --> E[Preserve All Existing Bookings Unchanged]
    E --> F[Return 200 OK with Expanded Slot Availability]

    B -->|SHRINK: Working Hours Reduced / Day Removed| G[Query Active CONFIRMED Bookings in Removed Window]
    G --> H{Affected Appointments Exist?}
    H -->|No Bookings Impacted| I[Update Availability Record Directly & Return 200 OK]
    H -->|Bookings Impacted| J[Begin Transaction & Search Next 30 Days for Replacements]
    J --> K{All Affected Bookings Reassigned?}
    K -->|Yes: All Relocated| L[Persist Audit Metadata: isAutoRescheduled=true, rescheduledReason]
    L --> M[Trigger APPOINTMENT_RESCHEDULED Notifications to All Patients]
    M --> N[Commit Transaction & Return 200 OK with Rescheduled Summary]
    K -->|No: Any Booking Cannot Be Relocated| O[Rollback Transaction]
    O --> P[Return 400 Bad Request: Cannot Shrink without Data Loss]
```

---

## 6. 🔔 Event-Based Notification System Workflow

```mermaid
graph TD
    A[Domain Event Trigger: Booked / Cancelled / Rescheduled] --> B[Construct Event Payload with Deterministic eventId]
    B --> C[Check PostgreSQL Partial Unique Index: idx_notification_event_unique]
    C --> D{Is Event Unique?}
    D -->|No: Duplicate Key 23505| E[Ignore Duplicate & Prevent Redundant Notification]
    D -->|Yes: New Event| F[Save Notification to PostgreSQL with isRead = false]
    F --> G[Push Real-Time Socket.IO WebSocket Event to Patient Room]
    G --> H[Simulate Structured Transactional Email Delivery]
    H --> I[Patient Retrieves via GET /notifications latest-first]
```

---

## 7. ⏰ Automated Appointment Reminder Cron Scheduler

```mermaid
graph TD
    A[Cron Job Trigger: @Cron EVERY_MINUTE] --> B[Acquire Distributed Advisory Lock: pg_try_advisory_xact_lock]
    B --> C{Lock Acquired?}
    C -->|No: Another Pod Is Leader| D[Skip Execution: Zero Pod Collision]
    C -->|Yes: Elected Leader| E[Query Upcoming CONFIRMED Appointments within REMINDER_WINDOW_MINUTES]
    E --> F{Eligible Appointments Found?}
    F -->|No| G[Log 0 Processed & Release Lock]
    F -->|Yes| H[Iterate Through Appointments]
    H --> I{Validate Appointment State}
    I -->|CANCELLED or COMPLETED| J[Skip & Increment Skipped Breakdown]
    I -->|Past Date or Invalid Data| K[Skip & Log Data Warning]
    I -->|Valid Active Upcoming| L{Check reminder_appointmentId Deduplication}
    L -->|Already Sent| M[Skip Duplicate Reminder]
    L -->|New Reminder| N{Determine Scheduling Type}
    N -->|STREAM| O[Format Stream Template: Doctor Name, Date, Slot Time]
    N -->|WAVE| P[Format Wave Template: Doctor Name, Reporting Time, Token #]
    O --> Q[Insert Notification Record & Emit WebSocket Alert]
    P --> Q
    Q --> R[Increment Sent Reminders Counter]
    R --> S[Log Summary Telemetry & Release Advisory Lock]
```
