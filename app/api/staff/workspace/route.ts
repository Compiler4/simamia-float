import {
  GET as getStaffWorkspace,
  POST as postStaffWorkspace,
} from "@/lib/staff/workspace-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return getStaffWorkspace(request);
}

export async function POST(request: Request) {
  return postStaffWorkspace(request);
}
