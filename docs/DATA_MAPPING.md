# Uploaded data mapping

## Float-agent workbook

Source columns:

| Excel column | Database destination |
|---|---|
| `Agent_name` | `BrokerCustomer.name`, `sourceAgentName`, `BrokerAgentAccount.accountName` |
| `Agent_MSISDN` | `BrokerCustomer.phone`, `sourceMsisdn`, `BrokerAgentAccount.simPhoneNumber` |
| `Alias_code` | `BrokerCustomer.code`, `sourceAliasCode`, `BrokerAgentAccount.agentNumber` |
| Excel row number | `BrokerCustomer.sourceRowNumber` |
| Sheet name | `BrokerCustomer.sourceSheetName` |

The workbook has 2,273 data rows. One row has an empty agent name, so the importer assigns `UNNAMED AGENT <alias>` instead of dropping that record.

The workbook does not contain a network column. Imported agent accounts are therefore stored with `network = OTHER`. Staff or Company Admin must review and change the network later.

The workbook does not contain region, district, ward or physical location. Imported brokers use:

```text
IMPORTED - LOCATION REQUIRED
```

until the company completes their area information.

## Bank statement

The included JSON represents the CRDB statement for:

- account name: ARDHISOL (T) LIMITED
- branch: OHIO
- account number: 0150959326500
- period: 16 July 2026 to 17 July 2026
- 27 transactions

Credit transactions are matched to imported brokers by normalized sender name when a reliable match exists.
