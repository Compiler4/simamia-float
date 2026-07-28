# Feature map

| Requirement | Implementation |
|---|---|
| Multiple network SIM lines per staff | `StaffNetworkLine`, admin Network tab, staff Networks & Funding view |
| Float and cash repeatedly each day | `StaffFundingReceipt`; no one-per-day uniqueness restriction |
| Daily automatic funding report | `fundingByDay` in `/api/staff/operations` |
| Day/week/month/year filters | `periodBounds()` and global Staff Advanced Operations controls |
| Staff-only brokers by area | `StaffBrokerCustomerAssignment` plus `User.assignedRegion` fallback |
| First letters/words search | Multi-term `contains` filtering in assigned broker endpoints/UI |
| SMS/receipt proof | `StaffProofSubmission`, SMS extraction, private file upload |
| Required transaction details | API validates reference/transaction ID, sender, receiver and amount |
| Admin/accountant verification | `/api/company-admin/staff-operations-review` |
| Staff-only grand report | `/api/staff/operations/report` scoped to authenticated staff ID |
| PDF/CSV/print | PDF and CSV response formats plus print control |
| Proof append | PDF, JPG, PNG and WEBP proof append in grand PDF |
| Read-only preview | `/api/staff/files/[id]` ownership/company authorization |
| Weekly folders/totals | `groupWeekly()` in staff operations route |
| Other expenses and requests | New Expense fields and `SUBMIT_EXPENSE_REQUEST` |
| Expense approval | Review API and admin/accountant page |
| Auto service report | `RECORD_SERVICE`, `ServiceActivity`, `BrokerServiceVisit` |
| Broker location update | Service action updates BrokerCustomer coordinates and service metadata |
| Own transactions/performance | Staff ID filters in every new query |
| Morning/evening attendance | `autoAttendanceFromLocation()` and read-only attendance boxes |
| Automatic live location | `StaffLocationTracker` mounted in staff dashboard |
| Staff/broker map pointers | Enhanced `LiveMap` |
| Dotted travel route/distance | GPS pings, dashed Leaflet polyline, Haversine distance |
| Forgotten broker reminder | `CHECK_MISSED_BROKERS` and unserved broker alerts |
| Staff notifications | userId/companyId-scoped Notification queries |
| Responsive/animated UI | `StaffAdvancedOperations.module.css` |
