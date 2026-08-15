import { type NextRequest } from "next/server";

import { performAccountantAction } from "@/lib/accountant/actions";
import { errorResponse, requireAccountant } from "@/lib/accountant/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Compatibility endpoint.
 *
 * Older accountant clients posted to /api/accountant/accountant/actions.
 * Keep that URL working, but route every action through the same service used
 * by /api/accountant/actions so OPEN_DAY / CLOSE_DAY can never drift apart.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireAccountant();
    const body = await request.json();
    const result = await performAccountantAction(context, body);
    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
