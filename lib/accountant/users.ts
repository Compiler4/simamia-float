import { prisma } from "@/lib/prisma";

export type StaffView = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "STAFF";
  assignedRegion: string;
};

export async function getCompanyStaff(companyId: string | number): Promise<StaffView[]> {
  const rows = await prisma.user.findMany({
    where: { companyId, role: "STAFF" } as any,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  } as any);

  return rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? row.username ?? row.email ?? "STAFF user"),
    username: String(row.username ?? ""),
    email: String(row.email ?? ""),
    role: "STAFF",
    assignedRegion: "",
  }));
}

export async function assertCompanyStaff(companyId: string | number, userId: string) {
  const staff = await getCompanyStaff(companyId);
  const row = staff.find((item) => item.id === String(userId));
  if (!row) throw new Error("The selected user is not a STAFF user in this company.");
  return row;
}
