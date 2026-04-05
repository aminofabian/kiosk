import { NextRequest } from 'next/server';
import { execute, queryOne, query } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getBatchesForSale, calculateProfit } from '@/lib/utils/fifo';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { toProperCustomerName } from '@/lib/utils/customer-name';
import {
  primaryCreditPhone,
  serializeCreditPhones,
  sqlCreditAccountMatchesPhoneDigits,
} from '@/lib/utils/credit-phones';
import type { Sale } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const sales = await query<Sale>(
      `SELECT * FROM sales 
       WHERE business_id = ? 
       ORDER BY sale_date DESC, created_at DESC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: sales,
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch sales',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

interface SplitPaymentInput {
  method: 'cash' | 'mpesa' | 'credit';
  amount: number;
  customerName?: string;
  customerPhone?: string;
}

const extractPhoneDigits = (phone: string) => {
  const coreDigits = phone.replace(/\D/g, '');
  if (coreDigits.startsWith('254') && coreDigits.length >= 12) return coreDigits.slice(-9);
  if (coreDigits.startsWith('0') && coreDigits.length >= 10) return coreDigits.slice(1);
  if (coreDigits.length >= 9) return coreDigits.slice(-9);
  return coreDigits;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fromEdit = body.fromEdit === true;
    const auth = fromEdit
      ? await requirePermission('view_all_sales')
      : await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const {
      items,
      paymentMethod,
      cashReceived,
      customerName,
      customerPhone,
      creditAccountId,
      splitPayments,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, message: 'Items are required' },
        400
      );
    }

    if (!paymentMethod) {
      return jsonResponse(
        { success: false, message: 'Payment method is required' },
        400
      );
    }

    // Validate split payments if split method is selected (not supported for fromEdit)
    if (paymentMethod === 'split' && !fromEdit) {
      if (!splitPayments || !Array.isArray(splitPayments) || splitPayments.length === 0) {
        return jsonResponse(
          { success: false, message: 'Split payments are required for split payment method' },
          400
        );
      }

      // Check that each credit payment has a phone number
      for (const payment of splitPayments as SplitPaymentInput[]) {
        if (payment.method === 'credit' && (!payment.customerPhone || payment.customerPhone.trim().length === 0)) {
          return jsonResponse(
            { success: false, message: 'Customer phone is required for credit payments' },
            400
          );
        }
      }
    }
    if (paymentMethod === 'split' && fromEdit) {
      return jsonResponse(
        { success: false, message: 'Split payment is not supported when editing a transaction' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const saleId = generateUUID();

    const totalAmount = items.reduce(
      (sum: number, item: { quantity: number; price: number }) =>
        sum + item.quantity * item.price,
      0
    );

    // Validate split payments total matches order total
    if (paymentMethod === 'split' && splitPayments && !fromEdit) {
      const splitTotal = (splitPayments as SplitPaymentInput[]).reduce(
        (sum, p) => sum + p.amount,
        0
      );
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        return jsonResponse(
          { success: false, message: 'Split payment total must equal order total' },
          400
        );
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
        [auth.businessId, auth.userId]
      );
      shiftId = shift?.id || null;

      // Require an open shift for any cash payment so every shilling is tied to a drawer
      const cashAmountForValidation =
        paymentMethod === 'cash'
          ? totalAmount
          : paymentMethod === 'split' && splitPayments
            ? (splitPayments as SplitPaymentInput[]).find((p) => p.method === 'cash')?.amount ?? 0
            : 0;
      if (cashAmountForValidation > 0 && !shiftId) {
        return jsonResponse(
          {
            success: false,
            message:
              'You must have an open shift to record cash payments. Please open a shift first.',
          },
          400
        );
      }
    }

    // For credit payment: require either creditAccountId (existing creditor) or customerName (new)
    if (paymentMethod === 'credit') {
      if (creditAccountId) {
        const existingAccount = await queryOne<{ id: string; customer_name: string; customer_phone: string | null }>(
          'SELECT id, customer_name, customer_phone FROM credit_accounts WHERE id = ? AND business_id = ?',
          [creditAccountId, auth.businessId]
        );
        if (!existingAccount) {
          return jsonResponse(
            { success: false, message: 'Selected credit account not found' },
            400
          );
        }
      } else {
        if (!customerPhone || customerPhone.trim().length === 0) {
          return jsonResponse(
            { success: false, message: 'Phone number is required for credit payments' },
            400
          );
        }
        if (!customerName || customerName.trim().length === 0) {
          return jsonResponse(
            { success: false, message: 'Customer name is required for new credit account' },
            400
          );
        }
        // Prevent duplicate: an account with this phone already exists
        const coreDigits = customerPhone.replace(/\D/g, '');
        const digits =
          coreDigits.startsWith('254') && coreDigits.length >= 12
            ? coreDigits.slice(-9)
            : coreDigits.startsWith('0') && coreDigits.length >= 10
              ? coreDigits.slice(1)
              : coreDigits.length >= 9
                ? coreDigits.slice(-9)
                : coreDigits;
        if (digits.length >= 6) {
          const ph = sqlCreditAccountMatchesPhoneDigits('customer_phone', digits);
          const existingByPhone = await queryOne<{ id: string }>(
            `SELECT id FROM credit_accounts 
             WHERE business_id = ? AND ${ph.sql}`,
            [auth.businessId, ...ph.params]
          );
          if (existingByPhone) {
            return jsonResponse(
              {
                success: false,
                message:
                  'A customer with this phone number already exists. Please select them from the list.',
              },
              400
            );
          }
        }
      }
    }

    // For split payments, we'll store customer info from credit portion if any
    let saleCustomerName = null;
    let saleCustomerPhone = null;
    if (paymentMethod === 'credit') {
      if (creditAccountId) {
        const accountForSale = await queryOne<{ customer_name: string; customer_phone: string | null }>(
          'SELECT customer_name, customer_phone FROM credit_accounts WHERE id = ? AND business_id = ?',
          [creditAccountId, auth.businessId]
        );
        saleCustomerName = accountForSale?.customer_name ?? null;
        saleCustomerPhone = primaryCreditPhone(accountForSale?.customer_phone ?? null);
      } else {
        saleCustomerName = customerName ? toProperCustomerName(customerName) : null;
        saleCustomerPhone = customerPhone || null;
      }
    } else if (paymentMethod === 'split' && splitPayments) {
      const creditPayment = (splitPayments as SplitPaymentInput[]).find(p => p.method === 'credit');
      if (creditPayment) {
        saleCustomerName = creditPayment.customerName
          ? toProperCustomerName(creditPayment.customerName)
          : null;
        saleCustomerPhone = creditPayment.customerPhone || null;
      }
    }

    await execute(
      `INSERT INTO sales (
        id, business_id, user_id, shift_id, total_amount, payment_method, 
        status, customer_name, customer_phone, sale_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        auth.businessId,
        auth.userId,
        shiftId,
        totalAmount,
        paymentMethod,
        'completed',
        saleCustomerName,
        saleCustomerPhone,
        now,
        now,
      ]
    );

    // Calculate cash amount for shift tracking
    let cashAmountForShift = 0;
    if (paymentMethod === 'cash') {
      cashAmountForShift = totalAmount;
    } else if (paymentMethod === 'split' && splitPayments) {
      const cashPayment = (splitPayments as SplitPaymentInput[]).find(p => p.method === 'cash');
      cashAmountForShift = cashPayment?.amount || 0;
    }

    // Update shift expected_closing_cash if shift exists and there's cash payment
    if (shiftId && cashAmountForShift > 0) {
      await execute(
        `UPDATE shifts 
         SET expected_closing_cash = expected_closing_cash + ? 
         WHERE id = ?`,
        [cashAmountForShift, shiftId]
      );
    }

    // Store split payment details if split payment
    if (paymentMethod === 'split' && splitPayments) {
      for (const payment of splitPayments as SplitPaymentInput[]) {
        const paymentId = generateUUID();
        await execute(
          `INSERT INTO sale_payments (
            id, sale_id, payment_method, amount, customer_name, customer_phone, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentId,
            saleId,
            payment.method,
            payment.amount,
            payment.customerName ? toProperCustomerName(payment.customerName) : null,
            payment.customerPhone || null,
            now,
          ]
        );
      }
    }

    // Process each item (FIFO or cashier-selected batch)
    for (const item of items) {
      const inventoryBatchId = (item as { inventoryBatchId?: string }).inventoryBatchId;

      // Fetch item's current type for snapshot
      const itemData = await queryOne<{ item_type: string }>(
        'SELECT item_type FROM items WHERE id = ?',
        [item.itemId]
      );
      const itemTypeSnapshot = itemData?.item_type || 'retail';

      let batches: { batchId: string; quantity: number; buyPrice: number }[];
      if (inventoryBatchId) {
        // Cashier selected a specific batch - use it first
        const selectedBatch = await queryOne<{
          id: string;
          quantity_remaining: number;
          buy_price_per_unit: number;
          item_id: string;
        }>(
          `SELECT id, quantity_remaining, buy_price_per_unit, item_id
           FROM inventory_batches
           WHERE id = ? AND business_id = ? AND item_id = ? AND status = 'active'`,
          [inventoryBatchId, auth.businessId, item.itemId]
        );
        if (selectedBatch && selectedBatch.quantity_remaining > 0) {
          const take = Math.min(item.quantity, selectedBatch.quantity_remaining);
          batches = [{
            batchId: selectedBatch.id,
            quantity: take,
            buyPrice: selectedBatch.buy_price_per_unit,
          }];
        } else {
          batches = [];
        }
      } else {
        batches = await getBatchesForSale(item.itemId, item.quantity);
      }

      let remainingQuantity = item.quantity;

      // If we have batches, consume them
      if (batches.length > 0) {
        for (const batch of batches) {
          const saleItemId = generateUUID();
          const profit = calculateProfit(
            item.price,
            batch.buyPrice,
            batch.quantity
          );

          // Create sale_item record with item_type_snapshot
          await execute(
            `INSERT INTO sale_items (
              id, sale_id, item_id, inventory_batch_id, quantity_sold,
              sell_price_per_unit, buy_price_per_unit, profit, item_type_snapshot, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleItemId,
              saleId,
              item.itemId,
              batch.batchId,
              batch.quantity,
              item.price,
              batch.buyPrice,
              profit,
              itemTypeSnapshot,
              now,
            ]
          );

          // Update batch quantity_remaining and set status=depleted when empty
          await execute(
            `UPDATE inventory_batches 
             SET quantity_remaining = quantity_remaining - ?,
                 status = CASE WHEN (quantity_remaining - ?) <= 0 THEN 'depleted' ELSE status END
             WHERE id = ?`,
            [batch.quantity, batch.quantity, batch.batchId]
          );

          remainingQuantity -= batch.quantity;
        }
      }

      // If we still have remaining quantity (no batches or insufficient stock)
      // Try to get buy price from most recent batch or purchase breakdown
      if (remainingQuantity > 0) {
        // Get most recent buy price from any batch (even if depleted)
        const recentBatch = await queryOne<{ buy_price_per_unit: number }>(
          `SELECT buy_price_per_unit 
           FROM inventory_batches 
           WHERE item_id = ? 
           ORDER BY received_at DESC 
           LIMIT 1`,
          [item.itemId]
        );

        // If no batch, try to get from most recent purchase breakdown
        let buyPrice = recentBatch?.buy_price_per_unit || 0;
        if (!buyPrice) {
          const recentBreakdown = await queryOne<{ buy_price_per_unit: number }>(
            `SELECT pb.buy_price_per_unit 
             FROM purchase_breakdowns pb
             JOIN purchase_items pi ON pb.purchase_item_id = pi.id
             JOIN purchases p ON pi.purchase_id = p.id
             WHERE pb.item_id = ? AND p.business_id = ?
             ORDER BY pb.confirmed_at DESC 
             LIMIT 1`,
            [item.itemId, auth.businessId]
          );
          buyPrice = recentBreakdown?.buy_price_per_unit || 0;
        }

        const saleItemId = generateUUID();
        const profit = buyPrice > 0 ? calculateProfit(item.price, buyPrice, remainingQuantity) : 0;

        await execute(
          `INSERT INTO sale_items (
            id, sale_id, item_id, quantity_sold, sell_price_per_unit,
            buy_price_per_unit, profit, item_type_snapshot, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleItemId,
            saleId,
            item.itemId,
            remainingQuantity,
            item.price,
            buyPrice,
            profit,
            itemTypeSnapshot,
            now,
          ]
        );
      }

      // Update item stock (always decrement, even if no batches)
      await execute(
        `UPDATE items 
         SET current_stock = current_stock - ? 
         WHERE id = ? AND business_id = ?`,
        [item.quantity, item.itemId, auth.businessId]
      );
    }

    // Handle credit account creation if payment is credit or split with credit
    const handleCreditPayment = async (creditCustomerName: string, creditCustomerPhone: string | null, creditAmount: number) => {
      // Match by normalized phone first; fallback to name-only records if no phone provided
      const trimmedName = creditCustomerName.trim();
      const nameForStorage = toProperCustomerName(creditCustomerName);
      const phoneDigits = creditCustomerPhone ? extractPhoneDigits(creditCustomerPhone) : '';
      let creditAccount: { id: string; total_credit: number } | null = null;

      if (phoneDigits.length >= 6) {
        const ph = sqlCreditAccountMatchesPhoneDigits('customer_phone', phoneDigits);
        creditAccount = await queryOne<{ id: string; total_credit: number }>(
          `SELECT id, total_credit FROM credit_accounts
           WHERE business_id = ?
           AND ${ph.sql}
           LIMIT 1`,
          [auth.businessId, ...ph.params]
        );
      } else if (trimmedName.length > 0) {
        creditAccount = await queryOne<{ id: string; total_credit: number }>(
          `SELECT id, total_credit FROM credit_accounts
           WHERE business_id = ?
           AND customer_phone IS NULL
           AND LOWER(TRIM(customer_name)) = LOWER(?)
           LIMIT 1`,
          [auth.businessId, trimmedName]
        );
      }

      let creditAccountId: string;

      if (creditAccount) {
        // Update existing account
        creditAccountId = creditAccount.id;
        await execute(
          `UPDATE credit_accounts 
           SET total_credit = total_credit + ?, 
               last_transaction_at = ? 
           WHERE id = ?`,
          [creditAmount, now, creditAccountId]
        );
      } else {
        // Create new account
        creditAccountId = generateUUID();
        await execute(
          `INSERT INTO credit_accounts (
            id, business_id, customer_name, customer_phone, 
            total_credit, last_transaction_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            creditAccountId,
            auth.businessId,
            nameForStorage,
            creditCustomerPhone ? serializeCreditPhones([creditCustomerPhone]) : null,
            creditAmount,
            now,
            now,
          ]
        );
      }

      // Create credit transaction (debt)
      const creditTransactionId = generateUUID();
      await execute(
        `INSERT INTO credit_transactions (
          id, credit_account_id, sale_id, type, amount, 
          recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          creditTransactionId,
          creditAccountId,
          saleId,
          'debt',
          creditAmount,
          auth.userId,
          now,
        ]
      );
    };

    // Add debt to an existing credit account by ID
    const addDebtToExistingAccount = async (accountId: string, amount: number) => {
      await execute(
        `UPDATE credit_accounts 
         SET total_credit = total_credit + ?, last_transaction_at = ? 
         WHERE id = ?`,
        [amount, now, accountId]
      );
      const creditTransactionId = generateUUID();
      await execute(
        `INSERT INTO credit_transactions (
          id, credit_account_id, sale_id, type, amount, 
          recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [creditTransactionId, accountId, saleId, 'debt', amount, auth.userId, now]
      );
    };

    // Handle credit for regular credit payment
    if (paymentMethod === 'credit') {
      if (creditAccountId) {
        await addDebtToExistingAccount(creditAccountId, totalAmount);
      } else if (customerName) {
        await handleCreditPayment(customerName, customerPhone || null, totalAmount);
      }
    }

    // Handle credit for split payment with credit portion
    if (paymentMethod === 'split' && splitPayments) {
      const creditPayment = (splitPayments as SplitPaymentInput[]).find(p => p.method === 'credit');
      if (creditPayment && creditPayment.customerPhone && creditPayment.amount > 0) {
        const splitCreditPhone = creditPayment.customerPhone.trim();
        const splitCreditName = (creditPayment.customerName || '').trim();
        const digits = extractPhoneDigits(splitCreditPhone);
        if (digits.length < 6) {
          return jsonResponse(
            { success: false, message: 'Enter a valid customer phone for split credit payment' },
            400
          );
        }

        // For split-credit: use phone to find existing customer; create only when missing.
        const ph = sqlCreditAccountMatchesPhoneDigits('customer_phone', digits);
        const existingByPhone = await queryOne<{ customer_name: string }>(
          `SELECT customer_name FROM credit_accounts
           WHERE business_id = ?
           AND ${ph.sql}
           LIMIT 1`,
          [auth.businessId, ...ph.params]
        );

        if (!existingByPhone && splitCreditName.length === 0) {
          return jsonResponse(
            {
              success: false,
              message: 'Customer name is required to create a new split credit account',
            },
            400
          );
        }

        await handleCreditPayment(
          existingByPhone?.customer_name || splitCreditName,
          splitCreditPhone,
          creditPayment.amount
        );
      }
    }

    return jsonResponse({
      success: true,
      message: 'Sale completed successfully',
      data: {
        saleId,
        totalAmount,
        change: cashReceived ? cashReceived - totalAmount : 0,
      },
    });
  } catch (error) {
    console.error('Sale creation error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create sale',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

