param(
  [string]$ProjectRoot = "C:\Users\Micha\simamia float"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "SIMAMIA project root not found: $ProjectRoot"
}

$rootPage = Join-Path $ProjectRoot "app\page.tsx"
$verificationDir = Join-Path $ProjectRoot "app\accountant\verification-requests"
$client = Join-Path $verificationDir "AccountantVerificationRequestsClient.tsx"
$verificationPage = Join-Path $verificationDir "page.tsx"

if (-not (Test-Path $client)) {
  throw "Missing $client. Use the complete corrected project ZIP so the client component is restored."
}

$rootCode = @'
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}
'@
Set-Content -Path $rootPage -Value $rootCode -Encoding UTF8

$verificationCode = @'
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import AccountantVerificationRequestsClient from "./AccountantVerificationRequestsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountantVerificationRequestsPage() {
  const user = (await getCurrentUser()) as any;
  if (!user) redirect("/login");
  if (String(user.role).toUpperCase() !== "ACCOUNTANT") redirect("/dashboard");
  if (!user.companyId) redirect("/dashboard");

  return (
    <AccountantVerificationRequestsClient
      accountant={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? "Accountant"),
        email: String(user.email ?? ""),
      }}
    />
  );
}
'@
Set-Content -Path $verificationPage -Value $verificationCode -Encoding UTF8

$staleEncoded = Join-Path $ProjectRoot "app\agent-location\%5Btoken%5D"
if (Test-Path $staleEncoded) {
  Remove-Item -Recurse -Force $staleEncoded
}

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $ProjectRoot ".next") -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Root route and verification-request route repaired." -ForegroundColor Green
Write-Host "Next run: npm run check:routes"
Write-Host "Then: npx prisma generate"
Write-Host "Then: npx tsc --noEmit --incremental false"
Write-Host "Then: npm run dev"
