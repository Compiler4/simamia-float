# How the Staff Portal Works

## 1. Authentication and company isolation

A user signs in with a STAFF account. Every API reads the logged-in staff ID and
company ID. Broker, customer, float, collection, expense, file, GPS and report
queries are limited to that company and staff account.

## 2. Dashboard

The dashboard combines the current day's operational values:

- float received from the accountant
- float issued to registered brokers
- broker collections
- money returned or deposited
- available float balance
- pending controls
- attendance, GPS and performance indicators

## 3. Registered brokers and customers

The staff directory reads:

- brokers from `broker_customers`
- customers from `customers`

Only ACTIVE records from the logged-in staff user's company are shown.

## 4. Receive and confirm morning float

The accountant issues float to the staff officer. The staff officer confirms
receipt. Confirmation records operational attendance and makes the float
available for broker operations.

## 5. Issue float to a broker

The staff officer chooses a registered BrokerCustomer. The system checks the
available balance, creates a unique reference, records the transaction in
`float_transactions`, and stores the selected broker in `brokerCustomerId`.

## 6. Receive broker collections

The staff officer selects a registered BrokerCustomer, enters the amount and
date, and optionally uploads a receipt. The collection is stored in
`staff_collections`.

The reference is unique per company. When a supplied reference already exists,
the API safely adds a suffix or generates a new reference instead of returning
P2002.

## 7. Service visits

A service visit can point to a registered broker, a registered customer, or
both. GPS coordinates and the location name can be recorded. The visit is
stored in `service_activities`.

## 8. File and profile image workflow

The browser reduces large images first. The upload API then validates the file,
compresses images to WEBP when useful, writes the private file, calculates a
SHA-256 checksum, and stores metadata in `staff_files`.

The profile action verifies that the uploaded PROFILE file belongs to the
logged-in staff user before updating `users.profileImageUrl`.

## 9. Settlement and bank controls

Staff can return money to the accountant, deposit to a bank, upload proof, and
review verification results. Mismatch states and financial holds prevent unsafe
duplicate or unmatched deposits.

## 10. Expenses

Staff submit expense requests with an optional receipt. The request remains
pending until an authorized reviewer approves or rejects it.

## 11. Attendance and performance

Operational activity creates attendance records. Float, collection, bank,
attendance, GPS and service activity contribute to the staff performance score.

## 12. GPS

The portal uses browser geolocation after permission is granted. GPS pings are
stored, live points are displayed, travel history is drawn, and GPS-disabled or
other alert events are recorded.

## 13. Reports

The report page applies day, week, month or year filters and exports CSV or PDF
summaries using the staff officer's own company-scoped transactions.
