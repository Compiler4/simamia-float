# Simamia Prisma Seed

This package creates:

- System Administrator (`SYSTEM_DEVELOPER`)
- Super Administrator (`SUPER_ADMIN`)
- Company Administrator
- Accountant
- Staff
- Broker portal user
- Company and head-office branch
- Company admin settings
- Broker portal assignment
- Broker-customer records
- Broker agent accounts
- Staff-to-broker-customer assignments

## Excel broker import

The seed looks for:

`data/float data_063712.xlsx`

Supported column names include:

- `Agent_name`
- `Agent_MSISDN`
- `Alias_code`

You can change the path with `BROKER_EXCEL_PATH` in `.env`.

When the file is absent, four editable sample brokers are inserted.

## Installation

From your project root:

```powershell
npm install bcryptjs dotenv xlsx @prisma/adapter-mariadb mariadb
npm install -D prisma tsx @types/node
```

Copy:

- `prisma/seed.ts` into your project's `prisma/seed.ts`
- `prisma.config.ts` into the project root
- values from `.env.seed.example` into your `.env`
- scripts from `package-scripts-snippet.json` into your existing `package.json`

Do not replace your whole existing `package.json`; merge only the scripts.

## Create/update tables and seed

For a local development database using migrations:

```powershell
npx prisma format
npx prisma generate
npx prisma migrate dev --name add_seed_users_and_brokers
npx prisma db seed
```

When you only need to synchronise the local database without creating a migration:

```powershell
npx prisma format
npx prisma generate
npx prisma db push
npx prisma db seed
```

## Verify

```powershell
npx prisma studio
```

Open these tables:

- `users`
- `companies`
- `branches`
- `broker_customers`
- `broker_agent_accounts`
- `staff_broker_assignments`
- `staff_broker_customer_assignments`
- `data_import_batches`

## Default development credentials

| Portal | Username | Password | Role |
|---|---|---|---|
| System admin | `system-admin` | `SystemAdmin@2026` | `SYSTEM_DEVELOPER` |
| Super admin | `super-admin` | `SuperAdmin@2026` | `SUPER_ADMIN` |
| Company admin | `company-admin` | `CompanyAdmin@2026` | `COMPANY_ADMIN` |
| Accountant | `accountant` | `Accountant@2026` | `ACCOUNTANT` |
| Staff | `staff` | `Staff@2026` | `STAFF` |
| Broker | `broker` | `Broker@2026` | `BROKER` |

Change these passwords before non-development use.
