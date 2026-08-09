# Important API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/company-admin/dashboard` | Complete real-data dashboard payload |
| POST | `/api/company-admin/users` | Create company user |
| PATCH | `/api/company-admin/users/{id}` | Edit/reactivate/deactivate user |
| DELETE | `/api/company-admin/users/{id}` | Remove company user |
| POST | `/api/company-admin/branches` | Create branch |
| PATCH | `/api/company-admin/branches/{id}` | Update branch |
| DELETE | `/api/company-admin/branches/{id}` | Remove empty branch |
| POST | `/api/company-admin/expenses` | Submit expense |
| PATCH | `/api/company-admin/expenses/{id}` | Approve/reject expense |
| POST | `/api/company-admin/bank-verifications` | Upload bank record metadata |
| PATCH | `/api/company-admin/bank-verifications/{id}` | Seen/status decision |
| POST | `/api/company-admin/bank-verifications/{id}/message` | Review message |
| POST | `/api/company-admin/attendance` | Upsert attendance mark |
| PATCH | `/api/company-admin/notifications/{id}/read` | Mark one read |
| PATCH | `/api/company-admin/notifications/read-all` | Mark all read |
| PATCH | `/api/company-admin/settings` | Save company settings |
| POST | `/api/company-admin/uploads` | Local simulation upload |
| POST | `/api/company-admin/gps-devices` | Register GPS device |
| PATCH | `/api/company-admin/gps-devices/{id}` | Activate/deactivate device |
| POST | `/api/gps/ping` | Receive phone/hardware location |
