import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'chatgpt-42.p.rapidapi.com';

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { reportData } = body;

    if (!reportData) {
      return jsonResponse({ success: false, message: 'Report data is required' }, 400);
    }

    if (!RAPIDAPI_KEY) {
      return jsonResponse({ success: false, message: 'AI service not configured. Set RAPIDAPI_KEY in .env' }, 500);
    }

    const prompt = buildPrompt(reportData);

    // Try multiple endpoints in order of preference
    const endpoints = [
      'https://chatgpt-42.p.rapidapi.com/gpt4',
      'https://chatgpt-42.p.rapidapi.com/chatgpt',
      'https://chatgpt-42.p.rapidapi.com/conversationgpt4',
    ];

    let lastError = '';

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': RAPIDAPI_KEY,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are a data-driven retail analyst for a Kenyan SME. Your job is to analyze THIS business's actual numbers and give recommendations that reference specific products, categories, and figures from the data.

RULES (strict):
- NEVER give generic advice (e.g. "improve marketing", "reduce costs"). Every point MUST cite a specific product name, category name, or number from the data (e.g. "Your top seller 'Unga' brings KES 45,000 — consider a 2-for-1 to move more units").
- Use the exact product and category names from the data. Do not invent or generalize.
- For profitability: compare revenue vs profit per product/category. Call out high-margin items to push and low-margin or high-volume-low-revenue items to repackage or reprice.
- For customer movement: use transaction count, avg order value, peak hour, and department split. Suggest concrete actions (e.g. "Peak hour is 14:00 — ensure full staffing then" or "Avg order is KES 1,200 — suggest add-ons for items under KES 500").
- For products: say which exact products to promote, bundle, or watch (use the names in the data). If grocery vs retail split is given, use it.
- Format with clear **Section** headers. Use bullet points. Keep each recommendation to 1–2 sentences. Use KES for all amounts.
- End with "Action Plan This Week": exactly 5 concrete actions, each tied to a specific product, category, or metric from the data.`,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            web_access: false,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `${endpoint}: ${response.status} - ${errorText}`;
          continue;
        }

        const data = await response.json();

        // Handle various response formats
        const aiResponse =
          data?.result ||
          data?.content ||
          data?.message?.content ||
          data?.choices?.[0]?.message?.content ||
          data?.response ||
          data?.text ||
          (typeof data === 'string' ? data : null);

        if (aiResponse) {
          return jsonResponse({
            success: true,
            data: {
              insights: aiResponse,
              generatedAt: new Date().toISOString(),
              period: reportData.period,
            },
          });
        }

        lastError = `${endpoint}: Unexpected response format: ${JSON.stringify(data).slice(0, 200)}`;
      } catch (endpointError) {
        lastError = `${endpoint}: ${endpointError instanceof Error ? endpointError.message : 'Unknown error'}`;
        continue;
      }
    }

    return jsonResponse(
      { success: false, message: `AI service unavailable. Last error: ${lastError}` },
      502
    );
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return jsonResponse(
      { success: false, message: 'Failed to generate AI insights' },
      500
    );
  }
}

function buildPrompt(data: Record<string, unknown>): string {
  const s = data.summary as Record<string, number>;
  const c = data.comparison as Record<string, number>;
  const topQ = data.topByQuantity as Array<Record<string, unknown>>;
  const topR = data.topByRevenue as Array<Record<string, unknown>>;
  const topG = data.topGrocery as Array<Record<string, unknown>>;
  const topRt = data.topRetail as Array<Record<string, unknown>>;
  const pm = data.paymentMethods as Array<Record<string, unknown>>;
  const dept = data.itemTypeBreakdown as Array<Record<string, unknown>>;
  const cats = data.categoryBreakdown as Array<Record<string, unknown>>;
  const staff = data.staffPerformance as Array<Record<string, unknown>>;
  const credit = data.creditSummary as Record<string, number>;
  const expenses = data.expensesSummary as Record<string, number>;
  const supplier = data.supplierSummary as Record<string, number>;
  const peak = data.peakHour as Record<string, number> | null;
  const hourlyData = data.hourlyData as Array<Record<string, number>> | undefined;
  const dailyData = data.dailyData as Array<Record<string, unknown> & { revenue: number; transactions: number }> | undefined;

  const fmt = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
  const totalRev = s.totalRevenue || 1;

  let prompt = `Below is my actual business data for **${data.businessName}** for the period **${data.period}**. Analyze these exact numbers, products, and categories. Every recommendation you give MUST reference specific products, categories, or figures from this data — no generic advice.\n\n`;

  prompt += `---\n## 1. OVERALL PERFORMANCE\n`;
  prompt += `- Revenue: ${fmt(s.totalRevenue)} | Profit: ${fmt(s.totalProfit)} | Margin: ${s.profitMargin?.toFixed(1)}%\n`;
  prompt += `- Transactions: ${s.totalTransactions} | Items sold: ${s.totalItemsSold} | Unique customers (named): ${s.uniqueCustomers}\n`;
  prompt += `- Avg order value: ${fmt(s.avgTransactionValue)} — use this to suggest add-ons or bundles.\n`;
  prompt += `- Vs previous period: Revenue ${c.revenueChange >= 0 ? '+' : ''}${c.revenueChange?.toFixed(1)}%, Profit ${c.profitChange >= 0 ? '+' : ''}${c.profitChange?.toFixed(1)}%, Transactions ${c.transactionsChange >= 0 ? '+' : ''}${c.transactionsChange?.toFixed(1)}% (prev revenue was ${fmt(c.prevRevenue)}).\n\n`;

  if (dept && dept.length > 0) {
    prompt += `## 2. DEPARTMENT SPLIT (Grocery vs Retail)\n`;
    dept.forEach((d) => {
      const rev = d.revenue as number;
      const pct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(0) : '0';
      const margin = rev > 0 ? (((d.profit as number) / rev) * 100).toFixed(1) : '0';
      prompt += `- **${d.item_type}**: Revenue ${fmt(rev)} (${pct}% of total), Profit ${fmt(d.profit as number)}, margin ${margin}%, ${d.items_sold} items, ${d.transaction_count} orders.\n`;
    });
    prompt += `Use this to say which department to focus on for profitability.\n\n`;
  }

  if (topR && topR.length > 0) {
    prompt += `## 3. TOP PRODUCTS BY REVENUE (use these exact names in your recommendations)\n`;
    topR.slice(0, 15).forEach((item, i) => {
      const name = item.variant_name ? `${item.item_name} - ${item.variant_name}` : item.item_name;
      const rev = item.total_revenue as number;
      const profit = item.total_profit as number;
      const marginPct = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
      prompt += `${i + 1}. **${name}** | Category: ${item.category_name} | Revenue: ${fmt(rev)} | Profit: ${fmt(profit)} | Margin: ${marginPct}% | Qty sold: ${item.total_quantity}\n`;
    });
    prompt += `Recommend which of these to push (high margin) or repackage (high volume, low margin).\n\n`;
  }

  if (topQ && topQ.length > 0) {
    prompt += `## 4. TOP PRODUCTS BY QUANTITY SOLD\n`;
    topQ.slice(0, 12).forEach((item, i) => {
      const name = item.variant_name ? `${item.item_name} - ${item.variant_name}` : item.item_name;
      const rev = item.total_revenue as number;
      const profit = item.total_profit as number;
      const marginPct = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
      prompt += `${i + 1}. **${name}** (${item.category_name}): ${item.total_quantity} units, ${fmt(rev)} revenue, ${fmt(profit)} profit, ${marginPct}% margin\n`;
    });
    prompt += `Identify items that sell a lot but have low margin — suggest bundling or upsell.\n\n`;
  }

  if (cats && cats.length > 0) {
    prompt += `## 5. REVENUE BY CATEGORY (use category names in recommendations)\n`;
    cats.forEach((cat) => {
      const rev = cat.total_revenue as number;
      const pct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(0) : '0';
      prompt += `- **${cat.category_name}**: ${fmt(rev)} (${pct}% of revenue), ${cat.total_items_sold} items sold, ${cat.transaction_count} transactions\n`;
    });
    prompt += `Suggest which categories to promote or protect.\n\n`;
  }

  if (topG && topG.length > 0) {
    prompt += `## 6. TOP GROCERY ITEMS (by revenue)\n`;
    topG.forEach((item, i) => {
      const rev = item.total_revenue as number;
      const profit = item.total_profit as number;
      const marginPct = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
      prompt += `${i + 1}. **${item.item_name}** (${item.category_name}): ${fmt(rev)} revenue, ${fmt(profit)} profit, ${marginPct}% margin, ${item.total_quantity} sold\n`;
    });
    prompt += `\n`;
  }

  if (topRt && topRt.length > 0) {
    prompt += `## 7. TOP RETAIL ITEMS (by revenue)\n`;
    topRt.forEach((item, i) => {
      const rev = item.total_revenue as number;
      const profit = item.total_profit as number;
      const marginPct = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
      prompt += `${i + 1}. **${item.item_name}** (${item.category_name}): ${fmt(rev)} revenue, ${fmt(profit)} profit, ${marginPct}% margin, ${item.total_quantity} sold\n`;
    });
    prompt += `\n`;
  }

  if (peak || (hourlyData && hourlyData.length > 0)) {
    prompt += `## 8. CUSTOMER MOVEMENT / PEAK TIMES\n`;
    if (peak) {
      prompt += `- Peak hour: **${peak.hour}:00** — Revenue ${fmt(peak.revenue)}, ${peak.transactions} transactions. Suggest staffing or promotions for this hour.\n`;
    }
    if (hourlyData && hourlyData.length > 0) {
      const sorted = [...hourlyData].sort((a, b) => b.revenue - a.revenue);
      prompt += `- Busiest hours (by revenue): `;
      prompt += sorted.slice(0, 5).map((h) => `${h.hour}:00 (${fmt(h.revenue)})`).join(', ');
      prompt += `.\n- Quietest hours: `;
      const quiet = [...hourlyData].sort((a, b) => a.revenue - b.revenue).slice(0, 3);
      prompt += quiet.map((h) => `${h.hour}:00`).join(', ');
      prompt += ` — suggest deals or restocking in these slots.\n`;
    }
    prompt += `\n`;
  }

  if (dailyData && dailyData.length > 0) {
    prompt += `## 9. DAILY PATTERN (revenue per day)\n`;
    dailyData.slice(0, 14).forEach((d) => {
      prompt += `- ${d.date_label}: ${fmt(d.revenue)} revenue, ${d.transactions} transactions\n`;
    });
    prompt += `Use to suggest which days to run promotions or order stock.\n\n`;
  }

  if (pm && pm.length > 0) {
    prompt += `## 10. PAYMENT MIX\n`;
    pm.forEach((p) => {
      const tot = p.total as number;
      const pct = totalRev > 0 ? ((tot / totalRev) * 100).toFixed(0) : '0';
      prompt += `- ${p.payment_method}: ${fmt(tot)} (${pct}%), ${p.count} transactions\n`;
    });
    prompt += `\n`;
  }

  if (staff && staff.length > 0) {
    prompt += `## 11. STAFF PERFORMANCE\n`;
    staff.forEach((st) => {
      const rev = st.total_revenue as number;
      const avgPerSale = (st.total_sales as number) > 0 ? rev / (st.total_sales as number) : 0;
      prompt += `- **${st.user_name}**: ${st.total_sales} sales, ${fmt(rev)} revenue, ${fmt(avgPerSale)} avg per sale, ${st.items_sold} items sold\n`;
    });
    prompt += `Only recommend staff actions if the data shows clear gaps (e.g. one person much lower).\n\n`;
  }

  prompt += `## 12. CASH FLOW & COSTS\n`;
  prompt += `- Credit given this period: ${fmt(credit?.total_credit_given || 0)} | Collected: ${fmt(credit?.total_credit_paid || 0)}\n`;
  prompt += `- Expenses: ${fmt(expenses?.total_expenses || 0)} (${expenses?.expense_count || 0} items)\n`;
  prompt += `- Supplier bills (this period): ${fmt(supplier?.total_amount || 0)} (${supplier?.total_bills || 0} bills, ${supplier?.bills_paid || 0} paid)\n`;
  const netResult = s.totalRevenue - (supplier?.total_amount || 0) - (expenses?.total_expenses || 0);
  prompt += `- Net result (revenue - supplier bills - expenses): ${fmt(netResult)}\n\n`;

  const peakExample = peak ? `${peak.hour}:00 with ${fmt(peak.revenue)} revenue` : 'your busiest hour';
  prompt += `---\nUsing ONLY the data above, provide your analysis. For every recommendation, cite the specific product name, category name, or number (e.g. "Push **Unga** — it has 28% margin and is in your top 3 by revenue" or "Peak hour is ${peakExample} — ensure full staff then"). End with **Action Plan This Week**: exactly 5 actions, each tied to a product, category, or metric from this report.`;
  return prompt;
}
