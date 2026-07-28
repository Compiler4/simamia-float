# Prisma merge checklist

1. Keep your existing `generator client` and `datasource db` blocks.
2. Append the seven new models from `accountant-control-centre.prisma`.
3. Copy the commented field groups into the existing `User`, `Expense`, `Attendance`, `BankDeposit`, `FloatTransaction`, and `Notification` models.
4. Keep one `@@unique([userId, date], name: "userId_date")` in `Attendance`.
5. Your existing IDs must be `String`. If your project uses `Int`, change every new `String` foreign key to `Int` before migration.
6. Run:

```powershell
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```
