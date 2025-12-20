import { NextRequest } from 'next/server';
import { execute, queryOne, query } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getBatchesForSale, calculateProfit } from '@/lib/utils/fifo';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const {
      items,
      paymentMethod,
      cashReceived,
      customerName,
      customerPhone,
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

    const now = Math.floor(Date.now() / 1000);
    const saleId = generateUUID();

    const totalAmount = items.reduce(
      (sum: number, item: { quantity: number; price: number }) =>
        sum + item.quantity * item.price,
      0
    );

    // Get current open shift for user
    const shift = await queryOne<{ id: string }>(
      `SELECT id FROM shifts 
       WHERE business_id = ? AND user_id = ? AND status = 'open'
       ORDER BY started_at DESC
       LIMIT 1`,
      [auth.businessId, auth.userId]
    );

    const shiftId = shift?.id || null;

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
        paymentMethod === 'credit' ? customerName || null : null,
        paymentMethod === 'credit' ? customerPhone || null : null,
        now,
        now,
      ]
    );

    // Update shift expected_closing_cash if shift exists and payment is cash
    if (shiftId && paymentMethod === 'cash') {
      await execute(
        `UPDATE shifts 
         SET expected_closing_cash = expected_closing_cash + ? 
         WHERE id = ?`,
        [totalAmount, shiftId]
      );
    }

    // Process each item with FIFO
    for (const item of items) {
      const batches = await getBatchesForSale(item.itemId, item.quantity);
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

          // Create sale_item record
          await execute(
            `INSERT INTO sale_items (
              id, sale_id, item_id, inventory_batch_id, quantity_sold,
              sell_price_per_unit, buy_price_per_unit, profit, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleItemId,
              saleId,
              item.itemId,
              batch.batchId,
              batch.quantity,
              item.price,
              batch.buyPrice,
              profit,
              now,
            ]
          );

          // Update batch quantity_remaining
          await execute(
            `UPDATE inventory_batches 
             SET quantity_remaining = quantity_remaining - ? 
             WHERE id = ?`,
            [batch.quantity, batch.batchId]
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
            buy_price_per_unit, profit, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleItemId,
            saleId,
            item.itemId,
            remainingQuantity,
            item.price,
            buyPrice,
            profit,
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

    // Handle credit account creation if payment is credit
    if (paymentMethod === 'credit' && customerName) {
      // Find existing credit account by phone or name
      const creditAccount = await queryOne<{ id: string; total_credit: number }>(
        `SELECT id, total_credit FROM credit_accounts 
         WHERE business_id = ? 
         AND (customer_phone = ? OR (customer_phone IS NULL AND customer_name = ?))
         LIMIT 1`,
        [
          auth.businessId,
          customerPhone || null,
          customerName,
        ]
      );

      let creditAccountId: string;

      if (creditAccount) {
        // Update existing account
        creditAccountId = creditAccount.id;
        await execute(
          `UPDATE credit_accounts 
           SET total_credit = total_credit + ?, 
               last_transaction_at = ? 
           WHERE id = ?`,
          [totalAmount, now, creditAccountId]
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
            customerName,
            customerPhone || null,
            totalAmount,
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
          totalAmount,
          auth.userId,
          now,
        ]
      );
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

