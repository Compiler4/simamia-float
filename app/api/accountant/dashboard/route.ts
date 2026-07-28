import { type NextRequest } from "next/server";

import {
  buildPortalData,
  errorResponse,
  parseRange,
  requireAccountant,
} from "@/lib/accountant/portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const context = await requireAccountant();
    const range = parseRange(request.nextUrl.searchParams);
    const data = await buildPortalData(context, range);
    return Response.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
