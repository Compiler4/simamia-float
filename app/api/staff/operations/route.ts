import {
  GET as getStaffWorkspace,
  POST as postStaffWorkspace,
} from "@/lib/staff/workspace-route";

/**
 * Backward-compatible Staff Operations API.
 *
 * The real JSON implementation lives in lib/staff/workspace-route.ts and is
 * also exposed at /api/staff/workspace. Keeping this route as a thin JSON-only
 * wrapper prevents it from ever being confused with the PDF/CSV report route
 * at /api/staff/operations/report.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return getStaffWorkspace(request);
}

export async function POST(request: Request) {
  return postStaffWorkspace(request);
}
