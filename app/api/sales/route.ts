import { NextRequest } from "next/server";
import { execute, queryOne, query, transaction } from "@/lib/db";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";
import { canAccessOthersPendingSale } from "@/lib/pos/pending-sale-access";
import { toProperCustomerName } from "@/lib/utils/customer-name";
import {
  primaryCreditPhone,
  serializeCreditPhones,
  sqlCreditAccountMatchesPhoneDigits,
} from "@/lib/utils/credit-phones";
import type { Sale } from "@/lib/db/types";
import { awardLoyaltyPointsForSale } from "@/lib/db/loyalty";
import { buildCreditDebtLineItemsSnapshotJson } from "@/lib/db/credit-debt-line-snapshot";
import { migrateCreditDebtLineItemsSnapshot } from "@/lib/db/migrate-credit-debt-line-items-snapshot";
import { migratePendingSales } from "@/lib/db/migrate-pending-sales";
import { validateSaleLines } from "@/lib/validation/sale-lines";
import { parseAllowSellOutOfStock } from "@/lib/utils/stock-settings";
import {
  processSaleStockDeduction,
  InsufficientBatchStockError,
  InsufficientItemStockError,
} from "@/lib/db/sale-stock";
import { logActivity } from "@/lib/db/activity-log";
import { eventBus } from "@/lib/sse/event-bus";

const EPS = 0.01;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requirePermission("sell");
    if (isAuthResponse(auth)) return auth;

    const sales = await query<Sale>(
      `SELECT * FROM sales
       WHERE business_id = ?
       ORDER BY sale_date DESC, created_at DESC`,
      [auth.businessId],
    );

    return jsonResponse({
      success: true,
      data: sales,
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch sales",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

interface SplitPaymentInput {
  method: "cash" | "mpesa" | "credit";
  amount: number;
  customerName?: string;
  customerPhone?: string;
}

const extractPhoneDigits = (phone: string) => {
  const coreDigits = phone.replace(/\D/g, "");
  if (coreDigits.startsWith("254") && coreDigits.length >= 12)
    return coreDigits.slice(-9);
  if (coreDigits.startsWith("0") && coreDigits.length >= 10)
    return coreDigits.slice(1);
  if (coreDigits.length >= 9) return coreDigits.slice(-9);
  return coreDigits;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fromEdit = body.fromEdit === true;
    const auth = fromEdit
      ? await requirePermission("view_all_sales")
      : await requirePermission("sell");
    if (isAuthResponse(auth)) return auth;

    // Block department staff from completing checkout (they cannot process payments)
    if (auth.role === "department_staff") {
      return jsonResponse(
        { success: false, message: "Department staff cannot process payments" },
        403,
      );
    }

    let {
      items,
      paymentMethod,
      cashReceived,
      customerName,
      customerPhone,
      creditAccountId,
      splitPayments,
    } = body;

    const pendingSaleId =
      typeof body.pendingSaleId === "string"
        ? body.pendingSaleId.trim()
        : undefined;

    if (pendingSaleId) {
      await migratePendingSales();
    }

    // If completing a pending sale, load its items from the database.
    let originatedByUserId: string | null = null;
    if (pendingSaleId) {
      const pendingSale = await queryOne<{
        id: string;
        user_id: string;
        status: string;
        customer_name: string | null;
        customer_phone: string | null;
        originated_by_user_id: string | null;
      }>(
        `SELECT id, user_id, status, customer_name, customer_phone, originated_by_user_id
         FROM sales
         WHERE id = ? AND business_id = ?`,
        [pendingSaleId, auth.businessId],
      );

      if (!pendingSale || pendingSale.status !== "pending") {
        return jsonResponse(
          { success: false, message: "Pending sale not found" },
          404,
        );
      }

      const canComplete = await canAccessOthersPendingSale(
        auth.role,
        auth.userId,
        pendingSale.user_id,
      );
      if (!canComplete) {
        return jsonResponse(
          {
            success: false,
            message: "Cannot complete another cashier's pending sale",
          },
          403,
        );
      }

      originatedByUserId = pendingSale.originated_by_user_id;

      const pendingItems = await query<{
        item_id: string;
        quantity_sold: number;
        sell_price_per_unit: number;
        inventory_batch_id: string | null;
      }>(
        `SELECT item_id, quantity_sold, sell_price_per_unit, inventory_batch_id
         FROM sale_items
         WHERE sale_id = ?`,
        [pendingSaleId],
      );

      if (pendingItems.length === 0) {
        return jsonResponse(
          { success: false, message: "Pending sale has no items" },
          400,
        );
      }

      items = pendingItems.map((pi) => ({
        itemId: pi.item_id,
        quantity: pi.quantity_sold,
        price: pi.sell_price_per_unit,
        inventoryBatchId: pi.inventory_batch_id || undefined,
      }));

      if (!customerName && pendingSale.customer_name) {
        customerName = pendingSale.customer_name;
      }
      if (!customerPhone && pendingSale.customer_phone) {
        customerPhone = pendingSale.customer_phone;
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, message: "Items are required" },
        400,
      );
    }

    if (!paymentMethod) {
      return jsonResponse(
        { success: false, message: "Payment method is required" },
        400,
      );
    }

    const managerPin =
      typeof body.managerPin === "string" ? body.managerPin.trim() : undefined;

    const businessSettings = await queryOne<{ settings: string | null }>(
      `SELECT settings FROM businesses WHERE id = ?`,
      [auth.businessId],
    );
    const allowSellOutOfStock = parseAllowSellOutOfStock(
      businessSettings?.settings,
    );

    const lineValidation = await validateSaleLines({
      businessId: auth.businessId,
      role: auth.role,
      lines: items.map(
        (item: {
          itemId: string;
          quantity: number;
          price: number;
          inventoryBatchId?: string;
        }) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price,
          inventoryBatchId: item.inventoryBatchId,
        }),
      ),
      managerPin,
      allowSellOutOfStock,
    });

    if (!lineValidation.ok) {
      const first = lineValidation.errors[0];
      return jsonResponse(
        {
          success: false,
          message: first?.message || "Sale validation failed",
          errors: lineValidation.errors,
        },
        400,
      );
    }

    // Validate split payments if split method is selected (not supported for fromEdit)
    if (paymentMethod === "split" && !fromEdit) {
      if (
        !splitPayments ||
        !Array.isArray(splitPayments) ||
        splitPayments.length === 0
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Split payments are required for split payment method",
          },
          400,
        );
      }

      // Check that each credit payment has a phone number
      for (const payment of splitPayments as SplitPaymentInput[]) {
        if (
          payment.method === "credit" &&
          (!payment.customerPhone || payment.customerPhone.trim().length === 0)
        ) {
          return jsonResponse(
            {
              success: false,
              message: "Customer phone is required for credit payments",
            },
            400,
          );
        }
      }
    }
    if (paymentMethod === "split" && fromEdit) {
      return jsonResponse(
        {
          success: false,
          message: "Split payment is not supported when editing a transaction",
        },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const saleId = pendingSaleId ?? generateUUID();

    const totalAmount = roundMoney(
      items.reduce(
        (sum: number, item: { quantity: number; price: number }) =>
          sum + item.quantity * item.price,
        0,
      ),
    );

    let cashReceivedNum = 0;
    if (typeof cashReceived === "number" && Number.isFinite(cashReceived)) {
      cashReceivedNum = roundMoney(cashReceived);
    } else if (typeof cashReceived === "string" && cashReceived.trim() !== "") {
      cashReceivedNum = roundMoney(parseFloat(cashReceived));
    }

    const walletCreditAccountIdRaw =
      typeof body.walletCreditAccountId === "string"
        ? body.walletCreditAccountId.trim()
        : "";

    let walletAmountApplied = 0;
    let walletSourceAccountId: string | null = null;

    if (!fromEdit) {
      const rawWallet = Number(body.walletAmountApplied);
      if (Number.isFinite(rawWallet) && rawWallet > EPS) {
        walletAmountApplied = roundMoney(rawWallet);
      }
      if (walletAmountApplied > EPS) {
        if (paymentMethod === "credit") {
          if (!creditAccountId) {
            return jsonResponse(
              {
                success: false,
                message:
                  "To pay from wallet on a credit sale, select an existing customer account first",
              },
              400,
            );
          }
          walletSourceAccountId = creditAccountId;
        } else {
          if (!walletCreditAccountIdRaw) {
            return jsonResponse(
              {
                success: false,
                message: "Select a customer to apply wallet balance",
              },
              400,
            );
          }
          walletSourceAccountId = walletCreditAccountIdRaw;
        }
        const wRow = await queryOne<{ wallet_balance: number }>(
          `SELECT COALESCE(wallet_balance, 0) AS wallet_balance FROM credit_accounts WHERE id = ? AND business_id = ?`,
          [walletSourceAccountId, auth.businessId],
        );
        if (!wRow) {
          return jsonResponse(
            { success: false, message: "Wallet customer account not found" },
            400,
          );
        }
        if (walletAmountApplied - wRow.wallet_balance > EPS) {
          return jsonResponse(
            { success: false, message: "Insufficient wallet balance" },
            400,
          );
        }
        if (walletAmountApplied - totalAmount > EPS) {
          return jsonResponse(
            {
              success: false,
              message: "Wallet amount cannot exceed order total",
            },
            400,
          );
        }
      }
    }

    const amountDue = roundMoney(
      Math.max(0, totalAmount - walletAmountApplied),
    );

    /** Credit account to earn loyalty for this sale (linked customer on tab, split credit, or wallet customer). */
    let loyaltyEarnAccountId: string | null = null;

    if (
      !fromEdit &&
      paymentMethod === "credit" &&
      amountDue < EPS &&
      !creditAccountId
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "When the wallet covers the full total on a credit sale, select the existing customer account first",
        },
        400,
      );
    }

    // Validate split payments total matches amount due (after wallet)
    if (paymentMethod === "split" && splitPayments && !fromEdit) {
      const splitTotal = (splitPayments as SplitPaymentInput[]).reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      if (Math.abs(splitTotal - amountDue) > 0.01) {
        return jsonResponse(
          {
            success: false,
            message:
              amountDue < totalAmount - EPS
                ? "Split payment total must equal amount due after wallet (remaining to pay)"
                : "Split payment total must equal order total",
          },
          400,
        );
      }
    }

    if (!fromEdit && paymentMethod === "cash") {
      if (cashReceivedNum + EPS < amountDue) {
        return jsonResponse(
          { success: false, message: "Cash received is less than amount due" },
          400,
        );
      }
    }

    let excessToWallet = 0;
    let overpayAccountId: string | null = null;
    if (!fromEdit && paymentMethod === "cash" && walletCreditAccountIdRaw) {
      overpayAccountId = walletCreditAccountIdRaw;
      if (cashReceivedNum > amountDue + EPS) {
        excessToWallet = roundMoney(cashReceivedNum - amountDue);
      }
    }
    if (!fromEdit && excessToWallet > EPS && overpayAccountId) {
      if (overpayAccountId !== walletSourceAccountId) {
        const op = await queryOne<{ id: string }>(
          "SELECT id FROM credit_accounts WHERE id = ? AND business_id = ?",
          [overpayAccountId, auth.businessId],
        );
        if (!op) {
          return jsonResponse(
            {
              success: false,
              message: "Selected customer for wallet (change) was not found",
            },
            400,
          );
        }
      }
    }

    // Get current open shift for user (skip for fromEdit - admin edit uses no shift)
    let shiftId: string | null = null;
    if (!fromEdit) {
      const shift = await queryOne<{ id: string }>(
        `SELECT id FROM shifts
         WHERE business_id = ? AND user_id = ? AND status = 'open'
         ORDER BY started_at DESC
         LIMIT 1`,
        [auth.businessId, auth.userId],
      );
      shiftId = shift?.id || null;

      // Require an open shift for any cash payment so every shilling is tied to a drawer
      const cashAmountForValidation =
        paymentMethod === "cash"
          ? amountDue
          : paymentMethod === "split" && splitPayments
            ? ((splitPayments as SplitPaymentInput[]).find(
                (p) => p.method === "cash",
              )?.amount ?? 0)
            : 0;
      if (cashAmountForValidation > 0 && !shiftId) {
        return jsonResponse(
          {
            success: false,
            message:
              "You must have an open shift to record cash payments. Please open a shift first.",
          },
          400,
        );
      }
    }

    // For credit payment: require either creditAccountId (existing creditor) or customerName (new)
    if (paymentMethod === "credit") {
      if (creditAccountId) {
        const existingAccount = await queryOne<{
          id: string;
          customer_name: string;
          customer_phone: string | null;
        }>(
          "SELECT id, customer_name, customer_phone FROM credit_accounts WHERE id = ? AND business_id = ?",
          [creditAccountId, auth.businessId],
        );
        if (!existingAccount) {
          return jsonResponse(
            { success: false, message: "Selected credit account not found" },
            400,
          );
        }
      } else {
        if (!customerPhone || customerPhone.trim().length === 0) {
          return jsonResponse(
            {
              success: false,
              message: "Phone number is required for credit payments",
            },
            400,
          );
        }
        if (!customerName || customerName.trim().length === 0) {
          return jsonResponse(
            {
              success: false,
              message: "Customer name is required for new credit account",
            },
            400,
          );
        }
        // Prevent duplicate: an account with this phone already exists
        const coreDigits = customerPhone.replace(/\D/g, "");
        const digits =
          coreDigits.startsWith("254") && coreDigits.length >= 12
            ? coreDigits.slice(-9)
            : coreDigits.startsWith("0") && coreDigits.length >= 10
              ? coreDigits.slice(1)
              : coreDigits.length >= 9
                ? coreDigits.slice(-9)
                : coreDigits;
        if (digits.length >= 6) {
          const ph = sqlCreditAccountMatchesPhoneDigits(
            "customer_phone",
            digits,
          );
          const existingByPhone = await queryOne<{ id: string }>(
            `SELECT id FROM credit_accounts
             WHERE business_id = ? AND ${ph.sql}`,
            [auth.businessId, ...ph.params],
          );
          if (existingByPhone) {
            return jsonResponse(
              {
                success: false,
                message:
                  "A customer with this phone number already exists. Please select them from the list.",
              },
              400,
            );
          }
        }
      }
    }

    // For split payments, we'll store customer info from credit portion if any
    let saleCustomerName = null;
    let saleCustomerPhone = null;
    if (paymentMethod === "credit") {
      if (creditAccountId) {
        const accountForSale = await queryOne<{
          customer_name: string;
          customer_phone: string | null;
        }>(
          "SELECT customer_name, customer_phone FROM credit_accounts WHERE id = ? AND business_id = ?",
          [creditAccountId, auth.businessId],
        );
        saleCustomerName = accountForSale?.customer_name ?? null;
        saleCustomerPhone = primaryCreditPhone(
          accountForSale?.customer_phone ?? null,
        );
      } else {
        saleCustomerName = customerName
          ? toProperCustomerName(customerName)
          : null;
        saleCustomerPhone = customerPhone || null;
      }
    } else if (paymentMethod === "split" && splitPayments) {
      const creditPayment = (splitPayments as SplitPaymentInput[]).find(
        (p) => p.method === "credit",
      );
      if (creditPayment) {
        saleCustomerName = creditPayment.customerName
          ? toProperCustomerName(creditPayment.customerName)
          : null;
        saleCustomerPhone = creditPayment.customerPhone || null;
      }
    }

    try {
      await transaction(async (tx) => {
        if (pendingSaleId) {
          const updated = await tx.execute(
            `UPDATE sales
             SET shift_id = ?, total_amount = ?, payment_method = ?,
                 status = 'completed', customer_name = ?, customer_phone = ?,
                 sale_date = ?, updated_at = ?
             WHERE id = ? AND business_id = ? AND status = 'pending'`,
            [
              shiftId,
              totalAmount,
              paymentMethod,
              saleCustomerName,
              saleCustomerPhone,
              now,
              now,
              saleId,
              auth.businessId,
            ],
          );
          if (updated.rowsAffected === 0) {
            throw new Error("Pending sale not found or already completed");
          }
          await tx.execute(`DELETE FROM sale_items WHERE sale_id = ?`, [
            saleId,
          ]);
        } else {
          await tx.execute(
            `INSERT INTO sales (
              id, business_id, user_id, shift_id, total_amount, payment_method,
              status, customer_name, customer_phone, sale_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              auth.businessId,
              auth.userId,
              shiftId,
              totalAmount,
              paymentMethod,
              "completed",
              saleCustomerName,
              saleCustomerPhone,
              now,
              now,
              now,
            ],
          );
        }

        let cashAmountForShift = 0;
        if (paymentMethod === "cash") {
          cashAmountForShift = totalAmount;
        } else if (paymentMethod === "split" && splitPayments) {
          const cashPayment = (splitPayments as SplitPaymentInput[]).find(
            (p) => p.method === "cash",
          );
          cashAmountForShift = cashPayment?.amount || 0;
        }

        if (shiftId && cashAmountForShift > 0) {
          await tx.execute(
            `UPDATE shifts
             SET expected_closing_cash = expected_closing_cash + ?
             WHERE id = ?`,
            [cashAmountForShift, shiftId],
          );
        }

        if (paymentMethod === "split" && splitPayments) {
          for (const payment of splitPayments as SplitPaymentInput[]) {
            const paymentId = generateUUID();
            await tx.execute(
              `INSERT INTO sale_payments (
                id, sale_id, payment_method, amount, customer_name, customer_phone, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                paymentId,
                saleId,
                payment.method,
                payment.amount,
                payment.customerName
                  ? toProperCustomerName(payment.customerName)
                  : null,
                payment.customerPhone || null,
                now,
              ],
            );
          }
        }

        if (!fromEdit && walletAmountApplied > EPS) {
          const walletPayId = generateUUID();
          await tx.execute(
            `INSERT INTO sale_payments (
              id, sale_id, payment_method, amount, customer_name, customer_phone, created_at
            ) VALUES (?, ?, 'wallet', ?, NULL, NULL, ?)`,
            [walletPayId, saleId, walletAmountApplied, now],
          );
        }

        await processSaleStockDeduction({
          tx,
          saleId,
          businessId: auth.businessId,
          items: items.map(
            (item: {
              itemId: string;
              quantity: number;
              price: number;
              inventoryBatchId?: string;
            }) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              price: item.price,
              inventoryBatchId: item.inventoryBatchId,
            }),
          ),
          now,
          allowNegativeStock: lineValidation.allowNegativeStock,
        });
      });
    } catch (stockError) {
      if (
        stockError instanceof InsufficientBatchStockError ||
        stockError instanceof InsufficientItemStockError
      ) {
        return jsonResponse(
          {
            success: false,
            message:
              "Stock changed during checkout. Please review your cart and try again.",
            code: "stock_conflict",
          },
          409,
        );
      }
      throw stockError;
    }

    let debtLineItemsSnapshotJson: string | null = null;
    if (!fromEdit) {
      const willRecordCreditDebt =
        (paymentMethod === "credit" && amountDue > EPS) ||
        (paymentMethod === "split" &&
          splitPayments &&
          (splitPayments as SplitPaymentInput[]).some(
            (p) => p.method === "credit" && Number(p.amount) > EPS,
          ));
      if (willRecordCreditDebt) {
        await migrateCreditDebtLineItemsSnapshot();
        debtLineItemsSnapshotJson =
          await buildCreditDebtLineItemsSnapshotJson(saleId);
      }
    }

    // Handle credit account creation if payment is credit or split with credit
    const handleCreditPayment = async (
      creditCustomerName: string,
      creditCustomerPhone: string | null,
      creditAmount: number,
      debtLineItemsJson: string | null,
    ): Promise<string> => {
      // ── Permission check: can_give_credit ────────────────────────
      // Only users with can_give_credit = 1 (or owner/admin) can create or add to credit accounts
      const creditUser = await queryOne<{ can_give_credit: number }>(
        `SELECT can_give_credit FROM users WHERE id = ? AND business_id = ?`,
        [auth.userId, auth.businessId],
      );
      if (!creditUser || !creditUser.can_give_credit) {
        throw new Error(
          "You are not authorized to take credit. Only approved staff can give credit. Contact an admin.",
        );
      }

      // Match by normalized phone first; fallback to name-only records if no phone provided
      const trimmedName = creditCustomerName.trim();
      const nameForStorage = toProperCustomerName(creditCustomerName);
      const phoneDigits = creditCustomerPhone
        ? extractPhoneDigits(creditCustomerPhone)
        : "";
      let creditAccount: { id: string; total_credit: number } | null = null;

      if (phoneDigits.length >= 6) {
        const ph = sqlCreditAccountMatchesPhoneDigits(
          "customer_phone",
          phoneDigits,
        );
        creditAccount = await queryOne<{ id: string; total_credit: number }>(
          `SELECT id, total_credit FROM credit_accounts
           WHERE business_id = ?
           AND ${ph.sql}
           LIMIT 1`,
          [auth.businessId, ...ph.params],
        );
      } else if (trimmedName.length > 0) {
        creditAccount = await queryOne<{ id: string; total_credit: number }>(
          `SELECT id, total_credit FROM credit_accounts
           WHERE business_id = ?
           AND customer_phone IS NULL
           AND LOWER(TRIM(customer_name)) = LOWER(?)
           LIMIT 1`,
          [auth.businessId, trimmedName],
        );
      }

      let creditAccountId: string;

      if (creditAccount) {
        // Update existing account
        creditAccountId = creditAccount.id;
        await execute(
          `UPDATE credit_accounts
           SET total_credit = total_credit + ?,
               last_transaction_at = ?,
               oldest_unpaid_debt_at = COALESCE(oldest_unpaid_debt_at, ?)
           WHERE id = ?`,
          [creditAmount, now, now, creditAccountId],
        );
      } else {
        // Check if new credit accounts are allowed
        const biz = await queryOne<{ credit_settings: string | null }>(
          `SELECT credit_settings FROM businesses WHERE id = ?`,
          [auth.businessId],
        );
        let allowNew = true;
        if (biz?.credit_settings) {
          try {
            const parsed = JSON.parse(biz.credit_settings);
            if (parsed.allow_new_credit_accounts === false) {
              allowNew = false;
            }
          } catch {
            /* ignore */
          }
        }
        if (!allowNew) {
          throw new Error(
            "New credit accounts are currently disabled by admin. Only existing customers can take credit.",
          );
        }
        // Create new account
        creditAccountId = generateUUID();
        await execute(
          `INSERT INTO credit_accounts (
            id, business_id, customer_name, customer_phone,
            total_credit, last_transaction_at, oldest_unpaid_debt_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            creditAccountId,
            auth.businessId,
            nameForStorage,
            creditCustomerPhone
              ? serializeCreditPhones([creditCustomerPhone])
              : null,
            creditAmount,
            now,
            now,
            now,
          ],
        );
      }

      // Create credit transaction (debt)
      const creditTransactionId = generateUUID();
      await execute(
        `INSERT INTO credit_transactions (
          id, credit_account_id, sale_id, type, amount,
          recorded_by, created_at, debt_line_items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          creditTransactionId,
          creditAccountId,
          saleId,
          "debt",
          creditAmount,
          auth.userId,
          now,
          debtLineItemsJson,
        ],
      );

      return creditAccountId;
    };

    // Add debt to an existing credit account by ID
    const addDebtToExistingAccount = async (
      accountId: string,
      amount: number,
      debtLineItemsJson: string | null,
    ) => {
      await execute(
        `UPDATE credit_accounts
         SET total_credit = total_credit + ?, last_transaction_at = ?, oldest_unpaid_debt_at = COALESCE(oldest_unpaid_debt_at, ?)
         WHERE id = ?`,
        [amount, now, now, accountId],
      );
      const creditTransactionId = generateUUID();
      await execute(
        `INSERT INTO credit_transactions (
          id, credit_account_id, sale_id, type, amount,
          recorded_by, created_at, debt_line_items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          creditTransactionId,
          accountId,
          saleId,
          "debt",
          amount,
          auth.userId,
          now,
          debtLineItemsJson,
        ],
      );
    };

    // Handle credit for regular credit payment (amount owed after wallet applied)
    if (paymentMethod === "credit") {
      if (creditAccountId) {
        loyaltyEarnAccountId = creditAccountId;
        if (amountDue > EPS) {
          await addDebtToExistingAccount(
            creditAccountId,
            amountDue,
            debtLineItemsSnapshotJson,
          );
        }
      } else if (customerName && amountDue > EPS) {
        loyaltyEarnAccountId = await handleCreditPayment(
          customerName,
          customerPhone || null,
          amountDue,
          debtLineItemsSnapshotJson,
        );
      }
    }

    // Handle credit for split payment with credit portion
    if (paymentMethod === "split" && splitPayments) {
      const creditPayment = (splitPayments as SplitPaymentInput[]).find(
        (p) => p.method === "credit",
      );
      if (
        creditPayment &&
        creditPayment.customerPhone &&
        creditPayment.amount > 0
      ) {
        const splitCreditPhone = creditPayment.customerPhone.trim();
        const splitCreditName = (creditPayment.customerName || "").trim();
        const digits = extractPhoneDigits(splitCreditPhone);
        if (digits.length < 6) {
          return jsonResponse(
            {
              success: false,
              message: "Enter a valid customer phone for split credit payment",
            },
            400,
          );
        }

        // For split-credit: use phone to find existing customer; create only when missing.
        const ph = sqlCreditAccountMatchesPhoneDigits("customer_phone", digits);
        const existingByPhone = await queryOne<{ customer_name: string }>(
          `SELECT customer_name FROM credit_accounts
           WHERE business_id = ?
           AND ${ph.sql}
           LIMIT 1`,
          [auth.businessId, ...ph.params],
        );

        if (!existingByPhone && splitCreditName.length === 0) {
          return jsonResponse(
            {
              success: false,
              message:
                "Customer name is required to create a new split credit account",
            },
            400,
          );
        }

        loyaltyEarnAccountId = await handleCreditPayment(
          existingByPhone?.customer_name || splitCreditName,
          splitCreditPhone,
          creditPayment.amount,
          debtLineItemsSnapshotJson,
        );
      }
    }

    if (!fromEdit && walletAmountApplied > EPS && walletSourceAccountId) {
      await execute(
        `UPDATE credit_accounts
         SET wallet_balance = wallet_balance - ?
         WHERE id = ? AND business_id = ? AND wallet_balance + 0.00001 >= ?`,
        [
          walletAmountApplied,
          walletSourceAccountId,
          auth.businessId,
          walletAmountApplied,
        ],
      );
      const walletDebitId = generateUUID();
      await execute(
        `INSERT INTO wallet_transactions (
          id, credit_account_id, sale_id, type, amount, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, 'debit', ?, NULL, ?, ?)`,
        [
          walletDebitId,
          walletSourceAccountId,
          saleId,
          walletAmountApplied,
          auth.userId,
          now,
        ],
      );
    }

    if (!fromEdit && excessToWallet > EPS && overpayAccountId) {
      await execute(
        `UPDATE credit_accounts SET wallet_balance = wallet_balance + ? WHERE id = ? AND business_id = ?`,
        [excessToWallet, overpayAccountId, auth.businessId],
      );
      const walletCreditId = generateUUID();
      await execute(
        `INSERT INTO wallet_transactions (
          id, credit_account_id, sale_id, type, amount, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)`,
        [
          walletCreditId,
          overpayAccountId,
          saleId,
          excessToWallet,
          "Cash overpayment (change to wallet)",
          auth.userId,
          now,
        ],
      );
    }

    if (!loyaltyEarnAccountId && walletCreditAccountIdRaw) {
      loyaltyEarnAccountId = walletCreditAccountIdRaw;
    }

    let loyaltyPointsAwarded = 0;
    if (!fromEdit && loyaltyEarnAccountId) {
      const lr = await awardLoyaltyPointsForSale({
        businessId: auth.businessId,
        creditAccountId: loyaltyEarnAccountId,
        saleId,
        totalAmountKes: totalAmount,
        recordedByUserId: auth.userId,
      });
      loyaltyPointsAwarded = lr.awarded;
    }

    await logActivity({
      businessId: auth.businessId,
      action: "create",
      entityType: "sale",
      entityId: saleId,
      entityNameSnapshot: `Sale ${saleId.slice(0, 8)}`,
      details: {
        totalAmount,
        paymentMethod,
        itemCount: items.length,
        walletAmountApplied,
        pendingSaleId: pendingSaleId || undefined,
      },
      performedBy: auth.userId,
    });

    // Notify clients when a pending/forwarded invoice is completed
    if (pendingSaleId) {
      try {
        eventBus.publish(`business:${auth.businessId}`, {
          type: "queue:update",
          data: { pendingSaleId, action: "completed" },
          timestamp: Date.now(),
        });
        if (originatedByUserId) {
          eventBus.publish(`staff:${originatedByUserId}`, {
            type: "order:completed",
            data: {
              saleId,
              pendingSaleId,
              totalAmount,
              itemCount: items.length,
              cashierName: auth.name,
              cashierId: auth.userId,
            },
            timestamp: Date.now(),
          });
        }
      } catch {
        /* non-critical */
      }
    }

    return jsonResponse({
      success: true,
      message: "Sale completed successfully",
      data: {
        saleId,
        totalAmount,
        amountDue,
        walletAmountApplied,
        excessCreditedToWallet: excessToWallet,
        loyaltyPointsAwarded,
        change:
          paymentMethod === "cash" && (cashReceivedNum > 0 || amountDue < EPS)
            ? roundMoney(
                Math.max(0, cashReceivedNum - amountDue - excessToWallet),
              )
            : 0,
      },
    });
  } catch (error) {
    console.error("Sale creation error:", error);
    return jsonResponse(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create sale",
      },
      500,
    );
  }
}
