# Prisma schema merge

Open `prisma/schema.prisma` and copy the enum and two models from:

`prisma/LIVE-LOCATION-SCHEMA-ADDITIONS.prisma`

Also add these relations inside `model Company`:

```prisma
brokerAgentLocationDevices BrokerAgentLocationDevice[]
brokerAgentLocationPings   BrokerAgentLocationPing[]
```

Add these relations inside `model BrokerCustomer`:

```prisma
liveLocationDevice BrokerAgentLocationDevice?
liveLocationPings  BrokerAgentLocationPing[]
```

Then run:

```powershell
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
```

The included SQL migration is provided for teams that use committed Prisma migrations. Do not run both `prisma db push` and the raw migration manually against the same database unless you understand the migration state.
