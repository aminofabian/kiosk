import { queryOne } from "@/lib/db";

export function parseDepartmentKeys(
  department: string | null | undefined,
): string[] {
  try {
    const parsed = JSON.parse(department || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}

export async function getStaffDepartmentKeys(
  userId: string,
  businessId: string,
): Promise<string[]> {
  const user = await queryOne<{ department: string | null }>(
    `SELECT department FROM users WHERE id = ? AND business_id = ?`,
    [userId, businessId],
  );
  return parseDepartmentKeys(user?.department);
}

export interface DepartmentPOAccess {
  recorded_by: string;
  department: string | null;
}

export function staffCanViewPO(
  po: Pick<DepartmentPOAccess, "department">,
  deptKeys: string[],
): boolean {
  if (!po.department) return false;
  return deptKeys.includes(po.department);
}

export function staffCanMutatePO(
  po: DepartmentPOAccess,
  userId: string,
  deptKeys: string[],
): boolean {
  return po.recorded_by === userId && staffCanViewPO(po, deptKeys);
}

export function staffCanDeliverPO(
  po: Pick<DepartmentPOAccess, "department">,
  deptKeys: string[],
): boolean {
  return staffCanViewPO(po, deptKeys);
}
