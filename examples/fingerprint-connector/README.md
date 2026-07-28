# Generic fingerprint connector

Physical fingerprint devices use vendor-specific SDKs. Configure the device SDK, attendance software or local middleware to POST each punch to this bridge:

```text
POST http://127.0.0.1:8787/punch
Content-Type: application/json
```

```json
{
  "externalUserCode": "STAFF-0007",
  "occurredAt": "2026-07-27T08:03:00+03:00",
  "session": "MORNING"
}
```

Start the connector in PowerShell:

```powershell
$env:SIMAMIA_BASE_URL="http://localhost:3000"
$env:SIMAMIA_DEVICE_SERIAL="ZK-K40-001"
$env:SIMAMIA_DEVICE_SECRET="paste-the-secret-returned-by-device-registration"
node examples/fingerprint-connector/server.mjs
```

Only an Accountant or Company Admin can register the device and enrol users. Staff users cannot configure the device. The connector secret is verified by the Simamia device-punch endpoint.
