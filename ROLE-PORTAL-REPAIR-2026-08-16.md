# Role Portal Repair – 2026-08-16

This repair unifies role normalization and login routing for Staff, Super Admin and System Developer accounts.

## Redirects
- STAFF -> /staff/dashboard
- SUPER_ADMIN -> /super-admin/dashboard
- SYSTEM_DEVELOPER -> /developer/dashboard

## Staff reliability
- Staff entry and dashboard pages validate session, role and company.
- Staff dashboard API returns 401/403/422 for authentication/authorization/company problems instead of a misleading generic 500.
- The Staff client redirects expired sessions to /login and wrong roles to /dashboard.
- A route loading page is included for a cleaner dashboard transition.

Run `npm run check:roles` and `npm run typecheck` after installation.
