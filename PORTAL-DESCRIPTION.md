# Unified Staff Portal Description

## One action route

All staff operational POST requests use:

```text
/api/staff/actions
```

The obsolete `/api/staff/broker-actions` folder is removed by the installer.

## One Float Operations page

The page has three tabs:

- Issue Float
- Receive Collection
- Return Money

## One transaction page

Assigned Transactions and Transaction History are merged into:

```text
My Transactions
```

The API includes only records belonging to the logged-in staff officer.

## Server-side transaction isolation

The dashboard queries:

- float where `fromUserId` or `toUserId` is the current staff ID
- collections where `staffId` is the current staff ID
- deposits where `staffId` is the current staff ID
- expenses where `employeeId` is the current staff ID
- attendance, GPS, notifications, performance and visits for the current staff ID

## Attendance

A staff officer is expected to supply float five days per week, Monday to Friday.

```text
weekly rate = attended operational days / 5 × 100
```

PRESENT and LATE count as attended days.
