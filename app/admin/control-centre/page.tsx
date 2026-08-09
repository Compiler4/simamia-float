import { redirect } from "next/navigation";

import { getCurrentUser, getRoleLabel } from "@/lib/auth";
import CompanyAdminControlCentreClient, {
  type ControlCentreModule,
} from "./CompanyAdminControlCentreClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODULES = new Set<ControlCentreModule>([
  "overview",
  "staff-areas",
  "finance",
  "verification",
  "staff-operations",
]);

type PageProps = {
  searchParams?: Promise<{
    module?: string | string[];
  }>;
};

function readModule(value: string | string[] | undefined): ControlCentreModule {
  const supplied = Array.isArray(value) ? value[0] : value;
  return MODULES.has(supplied as ControlCentreModule)
    ? (supplied as ControlCentreModule)
    : "overview";
}

export default async function CompanyAdminControlCentrePage({
  searchParams,
}: PageProps) {
  const user = (await getCurrentUser()) as any;

  if (!user) redirect("/login");

  const role = String(user.role ?? "").toUpperCase();
  if (role !== "COMPANY_ADMIN") redirect("/dashboard");

  if (!user.companyId) {
    throw new Error("The Company Admin is not assigned to a company.");
  }

  const params = searchParams ? await searchParams : {};

  return (
    <CompanyAdminControlCentreClient
      initialModule={readModule(params.module)}
      dashboardHref="/admin/dashboard"
      user={{
        id: String(user.id),
        name: String(user.name ?? user.username ?? user.email ?? "Company Admin"),
        email: String(user.email ?? ""),
        role,
        roleLabel: getRoleLabel(user.role),
        companyId: String(user.companyId),
        profileImageUrl:
          user.profileImageUrl == null ? null : String(user.profileImageUrl),
      }}
    />
  );
}
