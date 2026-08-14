# ADR-001: Multi-Layer Concurrency via Pessimistic Row Locking and Partial Unique Indexes

- **Status**: Accepted
- **Date**: 2026-08-08
- **Author**: Kunda Jagadeesh (`@Jagadeesh729`)
- **Domain**: Database Engineering & Concurrency Control

---

## 1. Context & Problem Statement

Doctor appointment scheduling systems must handle concurrent booking attempts targeting the exact same time slot (STREAM strategy) or token allocation (WAVE strategy). Under high sub-millisecond parallel request bursts, standard application-level read-then-write checks (`findFirst` followed by `create`) suffer from Time-of-Check to Time-of-Use (TOCTOU) race conditions, allowing double-bookings.

---

## 2. Decision Drivers

- **Zero Double-Booking Guarantee**: Active (`CONFIRMED`) bookings must never overlap for the same doctor, date, and slot.
- **Historical Record Preservation**: Cancelled (`CANCELLED`) appointments must remain in the database for compliance and auditing without blocking future bookings for that same slot.
- **Database-Enforced Invariants**: Concurrency guarantees must hold even if application logic is bypassed or deployed across multiple stateless server nodes.

---

## 3. Considered Options

1. **Application-Only Checks**: Simple `findOne` query followed by `save`. Rejected due to TOCTOU race conditions under parallel execution.
2. **Prisma ORM Standard Constraints**: Standard unique indexes on `(doctor_id, date, slot_start_time)`. Rejected because cancelling an appointment leaves a row in the table, preventing future bookings for that slot unless soft deletes or partial indexes are used.
3. **TypeORM `pessimistic_write` + PostgreSQL Partial Unique Indexes**:
   - Application Layer: Explicit `SELECT FOR UPDATE` row locks inside TypeORM `QueryRunner` transactions.
   - Database Engine Layer: PostgreSQL Partial Unique Indexes (`CREATE UNIQUE INDEX ... WHERE status = 'CONFIRMED'`).

---

## 4. Decision Outcome

Option 3 was chosen and implemented.

### Implementation Details:

1. **PostgreSQL Partial Unique Index DDL**:

   ```sql
   CREATE UNIQUE INDEX idx_stream_slot_unique
   ON appointments (doctor_id, date, slot_start_time)
   WHERE status = 'CONFIRMED' AND slot_start_time IS NOT NULL;
   ```

2. **TypeORM Pessimistic Row Locking**:
   ```typescript
   const existing = await queryRunner.manager.findOne(Appointment, {
     where: { doctorId, date, slotStartTime, status: 'CONFIRMED' },
     lock: { mode: 'pessimistic_write' },
   });
   ```

---

## 5. Consequences

### Positive:

- Physical serialization of concurrent booking requests at the database row level.
- Engine-level duplicate booking rejection in PostgreSQL if application locks are ever bypassed.
- Small index size and O(1) B-tree lookup speeds by excluding cancelled records.

### Negative / Trade-Offs:

- Requires PostgreSQL-specific migration DDL syntax.
- Short lock wait time during parallel request bursts.
