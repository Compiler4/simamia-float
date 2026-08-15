import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const rootPage = path.join(root, "app", "page.tsx");
const verificationPage = path.join(root, "app", "accountant", "verification-requests", "page.tsx");
const verificationClient = path.join(root, "app", "accountant", "verification-requests", "AccountantVerificationRequestsClient.tsx");
const staleEncodedRoute = path.join(root, "app", "agent-location", "%5Btoken%5D");

const errors = [];

if (!existsSync(rootPage)) {
  errors.push("app/page.tsx is missing.");
} else {
  const source = readFileSync(rootPage, "utf8");
  if (source.includes("AccountantVerificationRequestsClient")) {
    errors.push("app/page.tsx was overwritten with Accountant verification-request code.");
  }
  if (!source.includes('redirect("/login")') && !source.includes("redirect('/login')")) {
    errors.push("app/page.tsx must redirect the root route to /login.");
  }
}

if (!existsSync(verificationPage)) {
  errors.push("app/accountant/verification-requests/page.tsx is missing.");
}
if (!existsSync(verificationClient)) {
  errors.push("AccountantVerificationRequestsClient.tsx is missing from its route folder.");
}
if (existsSync(staleEncodedRoute)) {
  errors.push("Stale encoded route app/agent-location/%5Btoken%5D still exists; keep only app/agent-location/[token].");
}

if (errors.length) {
  console.error("SIMAMIA route validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("SIMAMIA route validation passed.");
console.log("- / redirects to /login");
console.log("- Accountant verification requests have their own page/client folder");
console.log("- stale encoded agent-location route is absent");
