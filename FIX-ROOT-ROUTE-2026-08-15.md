# SIMAMIA root route / verification-request fix

The root App Router page must not contain Accountant verification-request UI.

Correct ownership:
- `app/page.tsx` redirects `/` to `/login`.
- `app/accountant/verification-requests/page.tsx` owns the verification-request server page.
- `app/accountant/verification-requests/AccountantVerificationRequestsClient.tsx` owns its client UI.

The stale literal directory `app/agent-location/%5Btoken%5D` was also removed. The valid dynamic route is `app/agent-location/[token]`.

Validation:

```powershell
npm run check:routes
npx prisma generate
npx tsc --noEmit --incremental false
```
