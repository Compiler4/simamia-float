import { type NextRequest } from "next/server";

import { performAccountantAction } from "@/lib/accountant/actions";
import { errorResponse, requireAccountant } from "@/lib/accountant/portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
