import { type NextRequest, NextResponse } from "next/server";

import { requirePortalRole } from "@/lib/accountant/auth";
import { saveLocalUpload } from "@/lib/accountant/local-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["ACCOUNTANT", "COMPANY_ADMIN", "STAFF"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const category = String(form.get("category") ?? "documents").trim() || "documents";
    if (!(file instanceof File)) throw new Error("Choose a file to upload.");

    const uploaded = await saveLocalUpload({
      file,
      companyId: String(auth.user.companyId),
      category,
      maxBytes: 12 * 1024 * 1024,
    });

    return NextResponse.json({ success: true, message: "Document uploaded successfully.", ...uploaded });
  } catch (error) {
    console.error("[ACCOUNTANT_UPLOAD]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "The file could not be uploaded." },
      { status: 400 },
    );
  }
}
