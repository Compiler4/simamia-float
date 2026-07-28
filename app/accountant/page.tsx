import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Compatibility entry route.
 *
 * The authenticated accountant landing URL is /accountant/dashboard.
 * Keeping /accountant as an alias prevents old bookmarks from returning 404.
 */
export default function AccountantEntryPage() {
  redirect("/accountant/dashboard");
}
