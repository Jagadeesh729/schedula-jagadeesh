# Advanced Doctor Scheduling & Appointment Management Architecture Flowcharts

```mermaid
graph TD
    A[Patient Request: Book STREAM Slot] --> B{Check Doctor Config}
    B -->|STREAM| C[Validate Slot Duration & Buffer]
    C --> D{Check Slot Availability}
    D -->|Available| E[Create Appointment CONFIRMED]
    D -->|Already Booked| F[Return 409 Conflict]
    B -->|WAVE| G[Reject: Requires Wave Request]
```

```mermaid
graph TD
    A[Patient Request: Book WAVE Window] --> B{Check Doctor Config}
    B -->|WAVE| C[Begin Transaction & Acquire Lock]
    C --> D[Pessimistic Read/Write Lock on Window]
    D --> E{Check Patient Duplicate}
    E -->|Already Booked| F[Rollback & Return 409 Conflict]
    E -->|New Booking| G{Check Window Capacity}
    G -->|Capacity Full| H[Rollback & Return 409 Conflict]
    G -->|Capacity Available| I[Calculate Lowest Missing Positive Integer Token]
    I --> J[Save Appointment & Commit Transaction]
    J --> K[Return 201 Created with Token]
```

```mermaid
graph TD
    A[Patient Request: Cancel Appointment PATCH /appointment/:id/cancel] --> B{Appointment Exists?}
    B -->|No| C[Return 404 Not Found]
    B -->|Yes| D{Patient Owns Appointment?}
    D -->|No| E[Return 403 Forbidden IDOR]
    D -->|Yes| F{Status Already CANCELLED?}
    F -->|Yes| G[Return 400 Bad Request]
    F -->|No| H{Appointment Date/Time in Past?}
    H -->|Yes| I[Return 400 Bad Request: Past Appointment]
    H -->|No| J[Update Status to CANCELLED]
    J --> K[Reopen STREAM Slot & WAVE Capacity without Token Collision]
    K --> L[Return 200 OK Cancelled Success]
```

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

````mermaid
graph TD
    A[Patient Request: Reschedule Appointment PATCH /appointment/:id/reschedule] --> B{Appointment Exists?}
    B -->|No| C[Return 404 Not Found]
    B -->|Yes| D{Patient Owns Appointment?}
    D -->|No| E[Return 403 Forbidden IDOR]
    D -->|Yes| F{Status = CONFIRMED?}
    F -->|No| G[Return 400 Bad Request: Cancelled Appointment]
    F -->|Yes| H{30-Min Cutoff Check: start - now >= 30 mins?}
    H -->|No| I[Return 400 Bad Request: Cutoff Expired]
    H -->|Yes| J{Target Slot / Wave Same as Current?}
    J -->|Yes| K[Return 400 Bad Request: Same Slot]
    J -->|No| L[Begin Database Transaction & Acquire Pessimistic Lock]
    L --> M{Is Target Slot / Wave Window Available?}
    M -->|No| N[Find Suggested Next Available Slot up to 14 Days Ahead]
    N --> O[Rollback & Return 409 Conflict with suggestedNextAvailable]
    M -->|Yes| P[Release Old Slot / WAVE Token & Reserve New Target Slot / WAVE Token]
    P --> Q[Commit Transaction & Return 200 OK Rescheduled]

```mermaid
graph TD
    A[Cron Job Trigger: @Cron EVERY_MINUTE] --> B[Fetch Active CONFIRMED Appointments within REMINDER_WINDOW_MINUTES]
    B --> C{Appointments Found?}
    C -->|No| D[Log Zero Eligible Appointments & End Execution]
    C -->|Yes| E[Loop Through Each Appointment]
    E --> F{Check Appointment Status & Data}
    F -->|CANCELLED or COMPLETED| G[Skip: Excluded from Reminders]
    F -->|Incomplete / Invalid Data| H[Skip & Log Invalid Data]
    F -->|Valid Upcoming Appointment| I{Check Event Deduplication Index}
    I -->|reminder_${appointment.id} Already Exists| J[Skip: Duplicate Reminder Prevented]
    I -->|First Reminder| K[Determine Strategy Type]
    K -->|STREAM| L[Format Stream Message: Doctor Name, Date, Slot Time]
    K -->|WAVE| M[Format Wave Message: Doctor Name, Reporting Time, Token Number]
    L --> N[Insert Notification & Broadcast Real-Time WebSocket Event]
    M --> N
    N --> O[Log Reminder Created Successfully]
```
````
