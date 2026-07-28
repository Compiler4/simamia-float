SIMAMIA FULL ACCOUNTANT PORTAL — CLEAN BLUE FINANCE DASHBOARD

Copy these three files into:
app/accountant/
  page.tsx
  AccountantDashboardClient.tsx
  AccountantDashboard.module.css

The Dashboard page now follows the supplied clean finance-dashboard reference:
- white sidebar and top navigation
- blue primary actions
- available balance wallet card
- quick staff funding avatars
- recent activity register
- income and spending cards
- income/expense cashflow chart
- float settlement and attendance progress
- responsive desktop, tablet and mobile layouts

All original accountant modules remain in the same AccountantDashboardClient.tsx file.
The client expects existing server endpoints such as /api/accountant/dashboard,
/api/accountant/actions, /api/accountant/control-centre and related endpoints.
