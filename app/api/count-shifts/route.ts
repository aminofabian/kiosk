import { NextRequest } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";
import {
  buildItemTypeFilter,
  resolveCountDepartmentKey,
  startOfLocalDay,
  yesterdaySaleRange,
} from "@/lib/department/count-shift-utils";
import { getStaffDepartmentKeys } from "@/lib/department/purchase-order-access";
import type { CountShift } from "@/lib/db/types";

const DEFAULT_BATCH_SIZE = 10;
const SELLABLE_ITEM_FILTER = ` AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (
  SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1
))`;

export async function OPTIONS() {
  return optionsResponse();
}

/** List count shifts (admin: all; stock manager: own) */
export async function GET(_request: NextRequest) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(_request.url);
    const status = searchParams.get("status");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200,
    );

    let sql = `
      SELECT cs.*, u.name as user_name,
        (SELECT COUNT(*) FROM count_batches cb WHERE cb.count_shift_id = cs.id) AS batch_count
      FROM count_shifts cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE cs.business_id = ?
    `;
    const params: (string | number)[] = [auth.businessId];

    if (auth.role === "department_stock_manager") {
      sql += " AND cs.user_id = ?";
      params.push(auth.userId);
    }

    const validStatuses = ["open", "counting", "morning_complete", "closed"];
    if (status && validStatuses.includes(status)) {
      sql += " AND cs.status = ?";
      params.push(status);
    }

    sql += " ORDER BY cs.opened_at DESC LIMIT ?";
    params.push(limit);

    const shifts = await query<CountShift & { user_name: string; batch_count: number }>(
      sql,
      params,
    );

    return jsonResponse({ success: true, data: shifts });
  } catch (error) {
    console.error("Error fetching count shifts:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch count shifts",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

/** Open a new count shift — selects items and creates count batches */
export async function POST(request: NextRequest) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (!["department_stock_manager", "admin", "owner"].includes(auth.role)) {
      return jsonResponse(
        {
          success: false,
          message: "Only department stock managers can open count shifts",
        },
        403,
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedDepartmentKey =
      typeof body.departmentKey === "string" ? body.departmentKey.trim() : null;

    const departmentKeys = await getStaffDepartmentKeys(
      auth.userId,
      auth.businessId,
    );

    if (departmentKeys.length === 0 && auth.role === "department_stock_manager") {
      return jsonResponse(
        { success: false, message: "No department assigned to your account" },
        400,
      );
    }

    const departmentKey = resolveCountDepartmentKey(
      departmentKeys.length > 0 ? departmentKeys : [requestedDepartmentKey ?? ""].filter(Boolean),
      requestedDepartmentKey,
    );

    if (!departmentKey) {
      return jsonResponse(
        {
          success: false,
          message:
            "Select which department to count (multiple types assigned to your account)",
        },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const todayStart = startOfLocalDay(now);
    const tomorrowStart = todayStart + 86400;

    const existingDeptShift = await queryOne<{ id: string }>(
      `SELECT id FROM count_shifts
       WHERE business_id = ? AND department = ?
         AND opened_at >= ? AND opened_at < ?`,
      [auth.businessId, departmentKey, todayStart, tomorrowStart],
    );

    if (existingDeptShift) {
      return jsonResponse(
        {
          success: false,
          message: "A count shift for this department already exists today",
        },
        400,
      );
    }

    const existingUserShift = await queryOne<{ id: string }>(
      `SELECT id FROM count_shifts
       WHERE business_id = ? AND user_id = ? AND status IN ('open', 'counting', 'morning_complete')`,
      [auth.businessId, auth.userId],
    );

    if (existingUserShift) {
      return jsonResponse(
        { success: false, message: "You already have an open count shift" },
        400,
      );
    }

    const typeFilter = buildItemTypeFilter([departmentKey], "i");
    const { start: yesterdayStart, end: yesterdayEnd } = yesterdaySaleRange(now);

    const pinnedItems = await query<{ item_id: string }>(
      `SELECT cip.item_id
       FROM count_item_pool cip
       JOIN items i ON i.id = cip.item_id
       WHERE cip.business_id = ? AND cip.pinned = 1 AND cip.excluded = 0
         AND i.active = 1 AND i.business_id = ?
         ${typeFilter.sql}`,
      [auth.businessId, auth.businessId, ...typeFilter.params],
    );

    let selectedItems: Array<{ item_id: string; current_stock: number }> = [];

    if (pinnedItems.length > 0) {
      const pinnedWithStock = await query<{
        item_id: string;
        current_stock: number;
      }>(
        `SELECT i.id AS item_id, i.current_stock
         FROM items i
         WHERE i.id IN (${pinnedItems.map(() => "?").join(",")})
           AND i.business_id = ? AND i.active = 1
           ${SELLABLE_ITEM_FILTER}
         LIMIT ?`,
        [
          ...pinnedItems.map((p) => p.item_id),
          auth.businessId,
          DEFAULT_BATCH_SIZE,
        ],
      );
      selectedItems = pinnedWithStock;
    }

    const remaining = DEFAULT_BATCH_SIZE - selectedItems.length;

    if (remaining > 0) {
      const alreadySelected = new Set(selectedItems.map((i) => i.item_id));
      const excludeIds = await query<{ item_id: string }>(
        `SELECT item_id FROM count_item_pool WHERE business_id = ? AND excluded = 1`,
        [auth.businessId],
      );
      const excludeSet = new Set([
        ...alreadySelected,
        ...excludeIds.map((e) => e.item_id),
      ]);

      const yesterdaySold = await query<{
        item_id: string;
        current_stock: number;
      }>(
        `SELECT si.item_id, i.current_stock
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         WHERE s.business_id = ?
           AND s.status = 'completed'
           AND COALESCE(s.sale_date, s.created_at) >= ?
           AND COALESCE(s.sale_date, s.created_at) < ?
           AND i.business_id = ? AND i.active = 1
           ${SELLABLE_ITEM_FILTER}
           ${typeFilter.sql}
         GROUP BY si.item_id
         ORDER BY COUNT(si.id) DESC
         LIMIT 100`,
        [
          auth.businessId,
          yesterdayStart,
          yesterdayEnd,
          auth.businessId,
          ...typeFilter.params,
        ],
      );

      const shuffled = yesterdaySold
        .filter((i) => !excludeSet.has(i.item_id))
        .sort(() => Math.random() - 0.5);
      selectedItems.push(...shuffled.slice(0, remaining));

      if (selectedItems.length < DEFAULT_BATCH_SIZE) {
        const alreadySet = new Set(selectedItems.map((i) => i.item_id));
        const moreNeeded = DEFAULT_BATCH_SIZE - selectedItems.length;
        const fallbackItems = await query<{
          item_id: string;
          current_stock: number;
        }>(
          `SELECT i.id AS item_id, i.current_stock
           FROM items i
           WHERE i.business_id = ? AND i.active = 1
             ${SELLABLE_ITEM_FILTER}
             ${typeFilter.sql}
           ORDER BY RANDOM()
           LIMIT ?`,
          [auth.businessId, ...typeFilter.params, moreNeeded * 3],
        );
        const extra = fallbackItems.filter((i) => !alreadySet.has(i.item_id));
        selectedItems.push(...extra.slice(0, moreNeeded));
      }
    }

    if (selectedItems.length === 0) {
      return jsonResponse(
        {
          success: false,
          message: "No items available for counting in your department",
        },
        400,
      );
    }

    const shiftId = generateUUID();

    await execute(
      `INSERT INTO count_shifts (id, business_id, user_id, department, status, opened_at, created_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
      [shiftId, auth.businessId, auth.userId, departmentKey, now, now],
    );

    for (const item of selectedItems) {
      const batchId = generateUUID();
      await execute(
        `INSERT INTO count_batches (
          id, count_shift_id, item_id, system_stock_morning, status, created_at
        ) VALUES (?, ?, ?, ?, 'pending', ?)`,
        [batchId, shiftId, item.item_id, item.current_stock ?? 0, now],
      );
    }

    const itemIds = selectedItems.map((i) => i.item_id);
    if (itemIds.length > 0) {
      await execute(
        `UPDATE count_item_pool SET last_selected_at = ?
         WHERE business_id = ? AND item_id IN (${itemIds.map(() => "?").join(",")})`,
        [now, auth.businessId, ...itemIds],
      );
    }

    logActivity({
      businessId: auth.businessId,
      action: "open",
      entityType: "count_shift",
      entityId: shiftId,
      entityNameSnapshot: `Count shift opened — ${departmentKey}`,
      details: { department: departmentKey, itemCount: selectedItems.length },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: `Count shift opened with ${selectedItems.length} items`,
      data: { shiftId, itemCount: selectedItems.length, department: departmentKey },
    });
  } catch (error) {
    console.error("Error opening count shift:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to open count shift",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
