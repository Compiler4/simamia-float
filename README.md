# Simamia Login Logo and CSS Compatibility Fix

This package fixes:

- Safari `user-select` compatibility by adding `-webkit-user-select`.
- Chromium/Edge/Samsung `mask-image` compatibility by adding `-webkit-mask-image`.
- Safari `backdrop-filter` compatibility by adding `-webkit-backdrop-filter`.
- Firefox warning caused by `min-height: auto`.
- `/icons/icon-192x192.png` 404 by installing real Simamia logo images.
- Login page and metadata references to the installed icon files.
- Your existing `/manifest.webmanifest` keeps working and its icon URLs stop returning 404.

## Install

Open PowerShell in this extracted folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\APPLY-LOGIN-LOGO-FIX.ps1 -ProjectPath "C:\Users\Micha\simamia-float"
```

Then:

```powershell
cd C:\Users\Micha\simamia-float
npx tsc --noEmit
npm run dev
```

Test:

- `http://localhost:3000/icons/icon-192x192.png`
- `http://localhost:3000/icons/icon-512x512.png`
- `http://localhost:3000/login`
