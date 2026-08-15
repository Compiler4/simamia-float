# Open / Close Financial Day Button + Port 3000 Fix

## Port 3000

`EADDRINUSE` means another process is already listening on port 3000. It is not a Next.js compilation error.

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\START-DEV-CLEAN.ps1
```

The script stops a stale Node/Next/SIMAMIA process that owns port 3000 and starts the current project. It refuses to kill an unrelated non-Node application.

## Financial-day buttons

The Accountant Financial Day page now follows these UI rules:

- REST + no open day: **Open financial day** is clickable.
- ACTIVE + Open page: the main button becomes **Day is ACTIVE - go to Close Financial Day** and is clickable.
- REST + Close page: the main button becomes **Financial operations are at REST - open a day** and is clickable.
- ACTIVE + unresolved settlement: the Close button explains how many blockers remain; it is unavailable with a normal `not-allowed` cursor, not a fake loading cursor.
- ACTIVE + balanced settlement: **Close financial day** is clickable.
- `Opening financial day...` / `Closing financial day...` appears only after an actual click while the network request is in flight.
- The request state is cleared in `finally`, so a failed request does not leave the button permanently loading.
