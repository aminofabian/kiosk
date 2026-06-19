import { execute, query } from "./index";

/**
 * Phase 1 migration for Department Supply Management:
 * - department_suppliers junction table
 * - purchases: department + approval_status columns
 * - purchase_items: qty_ordered, qty_received, unit_cost_estimated columns
 */
export async function migrateDepartmentSuppliers(): Promise<void> {
  console.log("🔄 Starting department supply migration...");

  // ── department_suppliers junction table ──
  const tables = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table'`,
  );
  const tableNames = new Set(tables.map((t) => t.name));

  if (!tableNames.has("department_suppliers")) {
    await execute(`
      CREATE TABLE department_suppliers (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        department_key TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
        UNIQUE(business_id, department_key, supplier_id)
      )
    `);
    await execute(
      `CREATE INDEX idx_dept_suppliers_business_dept ON department_suppliers(business_id, department_key)`,
    );
    await execute(
      `CREATE INDEX idx_dept_suppliers_supplier ON department_suppliers(supplier_id)`,
    );
    console.log("✅ Created department_suppliers table");
  } else {
    console.log("✓ department_suppliers already exists");
  }

  // ── purchases columns ──
  if (tableNames.has("purchases")) {
    const purchaseColumns = await query<{ name: string }>(
      `PRAGMA table_info(purchases)`,
    );
    const colNames = new Set(purchaseColumns.map((c) => c.name));

    if (!colNames.has("department")) {
      await execute(`ALTER TABLE purchases ADD COLUMN department TEXT`);
      console.log("✅ Added purchases.department");
    }
    if (!colNames.has("approval_status")) {
      await execute(
        `ALTER TABLE purchases ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected'))`,
      );
      console.log("✅ Added purchases.approval_status");
    }
    if (!colNames.has("updated_at")) {
      const now = Math.floor(Date.now() / 1000);
      await execute(
        `ALTER TABLE purchases ADD COLUMN updated_at INTEGER NOT NULL DEFAULT ${now}`,
      );
      await execute(
        `UPDATE purchases SET updated_at = COALESCE(created_at, ${now})`,
      );
      console.log("✅ Added purchases.updated_at");
    }
    if (!colNames.has("rejection_reason")) {
      await execute(`ALTER TABLE purchases ADD COLUMN rejection_reason TEXT`);
      console.log("✅ Added purchases.rejection_reason");
    }
  }

  // ── purchase_items columns ──
  if (tableNames.has("purchase_items")) {
    const piColumns = await query<{ name: string }>(
      `PRAGMA table_info(purchase_items)`,
    );
    const piColNames = new Set(piColumns.map((c) => c.name));

    if (!piColNames.has("qty_ordered")) {
      await execute(`ALTER TABLE purchase_items ADD COLUMN qty_ordered REAL`);
      console.log("✅ Added purchase_items.qty_ordered");
    }
    if (!piColNames.has("qty_received")) {
      await execute(
        `ALTER TABLE purchase_items ADD COLUMN qty_received REAL NOT NULL DEFAULT 0`,
      );
      console.log("✅ Added purchase_items.qty_received");
    }
    if (!piColNames.has("unit_cost_estimated")) {
      await execute(
        `ALTER TABLE purchase_items ADD COLUMN unit_cost_estimated REAL`,
      );
      console.log("✅ Added purchase_items.unit_cost_estimated");
    }
  }

  console.log("✅ Department supply migration complete");

  // Fix POs where stock was received/broken down but approval_status was never updated
  const stuck = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM purchases
     WHERE department IS NOT NULL
       AND approval_status = 'pending_approval'
       AND status IN ('partial', 'complete')`,
  );
  if (stuck[0]?.count > 0) {
    const now = Math.floor(Date.now() / 1000);
    await execute(
      `UPDATE purchases
       SET approval_status = 'approved', updated_at = ?
       WHERE department IS NOT NULL
         AND approval_status = 'pending_approval'
         AND status IN ('partial', 'complete')`,
      [now],
    );
    console.log(
      `✅ Auto-approved ${stuck[0].count} department PO(s) with completed/partial delivery`,
    );
  }
}
