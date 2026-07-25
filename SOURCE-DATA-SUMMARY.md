# Source Data Audit Summary

## Excel workbook

- Source file: `float data_063712.xlsx`
- Worksheet: `Sheet1`
- Declared unique agents: `2,273`
- Imported rows: `2,273`
- Unique MSISDN values: `2,273`
- Unique alias codes: `2,273`
- Unique normalised names: `2,259`
- Duplicate-name groups: `13`
- Six-digit alias codes: `2,233`
- Five-digit alias codes: `40`
- Invalid Tanzanian-format MSISDN values: `0`

Duplicate names are retained because their MSISDN and alias-code values are different.

## Duplicate normalised agent names

| Agent name | Occurrences |
|---|---:|
| FRANK MIPAWA WAYI | 3 |
| ELIZABETH CHARLES KAPANDE | 2 |
| EMMANUEL VASCO BAHATI | 2 |
| ERICK ROBERT MASALU | 2 |
| HAPPYNESS FRANCIS MAYABU | 2 |
| IBRAHIM SALEHE RAMADHANI | 2 |
| KAZEMBE BAKARI CHIPEMBELE | 2 |
| KULWA MASAITE MAGESA | 2 |
| MOHAMED JUMA ALLY | 2 |
| NEEMA ABEL TAYAI | 2 |
| SAFE HARBOR REAL ESTATE COMPANY LIMITED | 2 |
| SELEMANI HARUNA IBATA | 2 |
| VENANCE LEVSON CHAMLOMO | 2 |

## CRDB bank statement

- Source file: `accountTransactionHistory (16).pdf`
- Account: `0150959326500`
- Account name: `ARDHISOL (T) LIMITED`
- Branch: `OHIO`
- Statement period: `16/07/2026 - 17/07/2026`
- Transactions: `27`
- Credit transactions: `22`
- Debit transactions: `5`
- Total credit: `38,369,600.00 TZS`
- Total debit: `39,800,000.00 TZS`
- Closing book balance: `1,697,115.12 TZS`

The seed does not silently treat every credit as an approved deposit. It imports the statement first, then matches identifiable sender names to the agent master with a confidence status.
