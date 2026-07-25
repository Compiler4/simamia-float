# Included source data

- `float data_063712.xlsx`: 2,273 Excel agent rows with `Agent_name`, `Agent_MSISDN` and `Alias_code`.
- `accountTransactionHistory (16).pdf`: CRDB account statement for account `0150959326500`, period 16/07/2026-17/07/2026.

Import both files after the company exists:

```powershell
npm run import:all -- YOUR_COMPANY_CODE
```

The Excel file does not include a network column. Imported `BrokerAgentAccount` rows are therefore stored with network `OTHER`; review each record and select Vodacom, Mix by Yas, Airtel, Halotel or another network in the portal.
