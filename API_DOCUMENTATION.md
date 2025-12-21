# POS System API Documentation

This document describes all available API endpoints for the POS system. All endpoints support CORS and can be used by external clients, including React Native mobile applications.

## Base URL

```
http://localhost:3000/api
```

For production, replace with your deployed domain.

## Authentication

**Note:** Currently, all endpoints use a hardcoded demo business ID. In Phase 7, authentication will be implemented using session-based authentication. For now, all endpoints are accessible without authentication.

## Response Format

All endpoints return JSON responses with the following structure:

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## CORS

All endpoints support Cross-Origin Resource Sharing (CORS) with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

All endpoints respond to `OPTIONS` requests for CORS preflight.

---

## Endpoints

### 1. Get Categories

Retrieve all active categories for the business.

**Endpoint:** `GET /api/categories`

**Request:**
- No parameters required
- No request body

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "business_id": "string",
      "name": "string",
      "position": 0,
      "icon": "string | null",
      "active": 1,
      "created_at": 1234567890
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

**Example (cURL):**
```bash
curl -X GET http://localhost:3000/api/categories
```

**Example (React Native):**
```typescript
const response = await fetch('http://localhost:3000/api/categories');
const result = await response.json();
if (result.success) {
  const categories = result.data;
}
```

---

### 2. Get Items

Retrieve items, optionally filtered by category.

**Endpoint:** `GET /api/items`

**Query Parameters:**
- `categoryId` (string, required if `all` is not true) - Filter items by category ID
- `all` (boolean, optional) - If `true`, returns all items for the business (admin use)

**Request:**
- Query parameters in URL
- No request body

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "business_id": "string",
      "category_id": "string",
      "name": "string",
      "unit_type": "kg" | "g" | "piece" | "bunch" | "tray" | "litre" | "ml",
      "current_stock": 0.0,
      "min_stock_level": 0.0 | null,
      "current_sell_price": 0.0,
      "image_url": "string | null",
      "active": 1,
      "created_at": 1234567890
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing categoryId when all is not true)
- `500` - Server error

**Example (cURL):**
```bash
# Get items by category
curl -X GET "http://localhost:3000/api/items?categoryId=abc-123"

# Get all items
curl -X GET "http://localhost:3000/api/items?all=true"
```

**Example (React Native):**
```typescript
// Get items by category
const categoryId = 'abc-123';
const response = await fetch(
  `http://localhost:3000/api/items?categoryId=${categoryId}`
);
const result = await response.json();

// Get all items
const allResponse = await fetch(
  'http://localhost:3000/api/items?all=true'
);
const allResult = await allResponse.json();
```

---

### 3. Get Item by ID

Retrieve a specific item by its ID.

**Endpoint:** `GET /api/items/{id}`

**Path Parameters:**
- `id` (string, required) - Item ID

**Request:**
- No request body

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "business_id": "string",
    "category_id": "string",
    "name": "string",
    "unit_type": "kg" | "g" | "piece" | "bunch" | "tray" | "litre" | "ml",
    "current_stock": 0.0,
    "min_stock_level": 0.0 | null,
    "current_sell_price": 0.0,
    "image_url": "string | null",
    "active": 1,
    "created_at": 1234567890
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Item not found
- `500` - Server error

**Example (cURL):**
```bash
curl -X GET http://localhost:3000/api/items/item-123
```

**Example (React Native):**
```typescript
const itemId = 'item-123';
const response = await fetch(`http://localhost:3000/api/items/${itemId}`);
const result = await response.json();
if (result.success) {
  const item = result.data;
}
```

---

### 4. Update Item Price

Update the selling price for an item. Creates a new price history record.

**Endpoint:** `POST /api/items/{id}/price`

**Path Parameters:**
- `id` (string, required) - Item ID

**Request Body:**
```json
{
  "price": 0.0,
  "effectiveFrom": 1234567890
}
```

**Request Fields:**
- `price` (number, required) - New selling price (must be greater than 0)
- `effectiveFrom` (number, optional) - Unix timestamp when price becomes effective (defaults to now)

**Response:**
```json
{
  "success": true,
  "message": "Price updated successfully",
  "data": {
    "priceId": "string",
    "price": 0.0
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (invalid price)
- `404` - Item not found
- `500` - Server error

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/api/items/item-123/price \
  -H "Content-Type: application/json" \
  -d '{
    "price": 150.0
  }'
```

**Example (React Native):**
```typescript
const itemId = 'item-123';
const response = await fetch(`http://localhost:3000/api/items/${itemId}/price`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ price: 150.0 }),
});
const result = await response.json();
```

---

### 5. Create Sale

Create a new sale transaction. Uses FIFO (First In, First Out) inventory management for profit calculation.

**Endpoint:** `POST /api/sales`

**Request Body:**
```json
{
  "items": [
    {
      "itemId": "string",
      "quantity": 0.0,
      "price": 0.0
    }
  ],
  "paymentMethod": "cash" | "mpesa" | "credit" | "split",
  "cashReceived": 0.0,
  "customerName": "string",
  "customerPhone": "string"
}
```

**Request Fields:**
- `items` (array, required) - Array of items being sold
  - `itemId` (string, required) - Item ID
  - `quantity` (number, required) - Quantity sold
  - `price` (number, required) - Price per unit
- `paymentMethod` (string, required) - Payment method: `cash`, `mpesa`, `credit`, or `split`
- `cashReceived` (number, optional) - Cash amount received (for cash payments)
- `customerName` (string, optional) - Customer name (required for credit payments)
- `customerPhone` (string, optional) - Customer phone number (for credit payments)

**Notes:**
- Uses FIFO inventory management: items are sold from oldest batches first
- Automatically calculates profit based on buy price from inventory batches
- For items without batches, buy_price and profit are set to 0
- For credit payments, automatically creates or updates credit account
- Stock is decremented for all items regardless of batch availability

**Response:**
```json
{
  "success": true,
  "message": "Sale completed successfully",
  "data": {
    "saleId": "string",
    "totalAmount": 0.0,
    "change": 0.0
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing required fields)
- `500` - Server error

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "itemId": "item-123",
        "quantity": 2,
        "price": 100.0
      }
    ],
    "paymentMethod": "cash",
    "cashReceived": 250.0
  }'
```

**Example (Credit Payment):**
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "itemId": "item-123",
        "quantity": 2,
        "price": 100.0
      }
    ],
    "paymentMethod": "credit",
    "customerName": "John Doe",
    "customerPhone": "+1234567890"
  }'
```

**Example (React Native):**
```typescript
const saleData = {
  items: [
    {
      itemId: 'item-123',
      quantity: 2,
      price: 100.0,
    },
  ],
  paymentMethod: 'cash',
  cashReceived: 250.0,
};

const response = await fetch('http://localhost:3000/api/sales', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(saleData),
});

const result = await response.json();
if (result.success) {
  const { saleId, totalAmount, change } = result.data;
}
```

---

### 6. Get Sale by ID

Retrieve a specific sale with its items.

**Endpoint:** `GET /api/sales/{id}`

**Path Parameters:**
- `id` (string, required) - Sale ID

**Request:**
- No request body

**Response:**
```json
{
  "success": true,
  "data": {
    "sale": {
      "id": "string",
      "business_id": "string",
      "user_id": "string",
      "shift_id": "string | null",
      "total_amount": 0.0,
      "payment_method": "cash" | "mpesa" | "credit" | "split",
      "status": "completed" | "voided",
      "voided_reason": "string | null",
      "voided_by": "string | null",
      "customer_name": "string | null",
      "customer_phone": "string | null",
      "sale_date": 1234567890,
      "created_at": 1234567890
    },
    "items": [
      {
        "id": "string",
        "sale_id": "string",
        "item_id": "string",
        "inventory_batch_id": "string | null",
        "quantity_sold": 0.0,
        "sell_price_per_unit": 0.0,
        "buy_price_per_unit": 0.0,
        "profit": 0.0,
        "created_at": 1234567890,
        "item_name": "string",
        "item_unit_type": "kg" | "g" | "piece" | "bunch" | "tray" | "litre" | "ml"
      }
    ]
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Sale not found
- `500` - Server error

**Example (cURL):**
```bash
curl -X GET http://localhost:3000/api/sales/sale-123
```

**Example (React Native):**
```typescript
const saleId = 'sale-123';
const response = await fetch(
  `http://localhost:3000/api/sales/${saleId}`
);
const result = await response.json();
if (result.success) {
  const { sale, items } = result.data;
}
```

---

---

### 7. Get Purchases

Retrieve all purchases for the business.

**Endpoint:** `GET /api/purchases`

**Request:**
- No parameters
- No request body

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "business_id": "string",
      "recorded_by": "string",
      "supplier_name": "string | null",
      "purchase_date": 1234567890,
      "total_amount": 0.0,
      "extra_costs": 0.0,
      "notes": "string | null",
      "status": "pending" | "partial" | "complete",
      "created_at": 1234567890
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

**Example (cURL):**
```bash
curl -X GET http://localhost:3000/api/purchases
```

**Example (React Native):**
```typescript
const response = await fetch('http://localhost:3000/api/purchases');
const result = await response.json();
if (result.success) {
  const purchases = result.data;
}
```

---

### 8. Create Purchase

Create a new purchase record with purchase items.

**Endpoint:** `POST /api/purchases`

**Request Body:**
```json
{
  "supplierName": "string",
  "purchaseDate": 1234567890,
  "totalAmount": 0.0,
  "extraCosts": 0.0,
  "notes": "string",
  "items": [
    {
      "itemId": "string | null",
      "itemName": "string",
      "quantityNote": "string",
      "amount": 0.0,
      "notes": "string"
    }
  ]
}
```

**Request Fields:**
- `purchaseDate` (number, required) - Unix timestamp of purchase date
- `totalAmount` (number, required) - Total purchase amount
- `items` (array, required) - Array of purchase items
  - `itemId` (string, optional) - Item ID if item exists in system
  - `itemName` (string, required) - Item name (snapshot)
  - `quantityNote` (string, required) - Quantity description (e.g., "5 kg", "10 pieces")
  - `amount` (number, required) - Amount paid for this item
  - `notes` (string, optional) - Additional notes
- `supplierName` (string, optional) - Supplier name
- `extraCosts` (number, optional) - Additional costs (transport, etc.)
- `notes` (string, optional) - Purchase notes

**Response:**
```json
{
  "success": true,
  "message": "Purchase created successfully",
  "data": {
    "purchaseId": "string"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing required fields)
- `500` - Server error

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/api/purchases \
  -H "Content-Type: application/json" \
  -d '{
    "supplierName": "ABC Supplier",
    "purchaseDate": 1234567890,
    "totalAmount": 5000.0,
    "items": [
      {
        "itemName": "Tomatoes",
        "quantityNote": "20 kg",
        "amount": 2000.0
      }
    ]
  }'
```

---

### 9. Get Purchase by ID

Retrieve a specific purchase with its items.

**Endpoint:** `GET /api/purchases/{id}`

**Path Parameters:**
- `id` (string, required) - Purchase ID

**Request:**
- No request body

**Response:**
```json
{
  "success": true,
  "data": {
    "purchase": {
      "id": "string",
      "business_id": "string",
      "recorded_by": "string",
      "supplier_name": "string | null",
      "purchase_date": 1234567890,
      "total_amount": 0.0,
      "extra_costs": 0.0,
      "notes": "string | null",
      "status": "pending" | "partial" | "complete",
      "created_at": 1234567890
    },
    "items": [
      {
        "id": "string",
        "purchase_id": "string",
        "item_id": "string | null",
        "item_name_snapshot": "string",
        "quantity_note": "string",
        "amount": 0.0,
        "notes": "string | null",
        "status": "pending" | "broken_down",
        "created_at": 1234567890,
        "item_name": "string",
        "item_unit_type": "string"
      }
    ]
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Purchase not found
- `500` - Server error

**Example (cURL):**
```bash
curl -X GET http://localhost:3000/api/purchases/purchase-123
```

---

### 10. Create Purchase Breakdown

Break down a purchase item into inventory batches. This creates inventory batches that can be used for FIFO sales.

**Endpoint:** `POST /api/purchases/{id}/breakdown`

**Path Parameters:**
- `id` (string, required) - Purchase ID

**Request Body:**
```json
{
  "purchaseItemId": "string",
  "itemId": "string",
  "usableQuantity": 0.0,
  "wastageQuantity": 0.0,
  "buyPricePerUnit": 0.0,
  "notes": "string"
}
```

**Request Fields:**
- `purchaseItemId` (string, required) - Purchase item ID to break down
- `itemId` (string, required) - Item ID to assign stock to
- `usableQuantity` (number, required) - Usable quantity to add to inventory
- `wastageQuantity` (number, optional) - Wastage/loss quantity
- `buyPricePerUnit` (number, required) - Buy price per unit
- `notes` (string, optional) - Breakdown notes

**Response:**
```json
{
  "success": true,
  "message": "Breakdown created successfully",
  "data": {
    "breakdownId": "string",
    "batchId": "string",
    "purchaseStatus": "partial" | "complete"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing required fields)
- `500` - Server error

**Notes:**
- Creates an inventory batch that can be used for FIFO sales
- Updates item stock automatically
- Marks purchase item as "broken_down"
- Updates purchase status to "complete" when all items are broken down

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/api/purchases/purchase-123/breakdown \
  -H "Content-Type: application/json" \
  -d '{
    "purchaseItemId": "item-123",
    "itemId": "item-456",
    "usableQuantity": 20.0,
    "wastageQuantity": 2.0,
    "buyPricePerUnit": 100.0
  }'
```

---

### 11. Get Stock

Retrieve all items with their current stock levels and category information.

**Endpoint:** `GET /api/stock`

**Request:**
- No parameters
- No request body

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "business_id": "string",
      "category_id": "string",
      "name": "string",
      "unit_type": "kg" | "g" | "piece" | "bunch" | "tray" | "litre" | "ml",
      "current_stock": 0.0,
      "min_stock_level": 0.0 | null,
      "current_sell_price": 0.0,
      "image_url": "string | null",
      "active": 1,
      "created_at": 1234567890,
      "category_name": "string"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

**Example (cURL):**
```bash
curl -X GET http://localhost:3000/api/stock
```

**Example (React Native):**
```typescript
const response = await fetch('http://localhost:3000/api/stock');
const result = await response.json();
if (result.success) {
  const stockItems = result.data;
}
```

---

### 12. Get Profit Report

Get profit analysis for a specific time period.

**Endpoint:** `GET /api/profit`

**Query Parameters:**
- `start` (number, required) - Start timestamp (Unix seconds)
- `end` (number, required) - End timestamp (Unix seconds)

**Request:**
- Query parameters in URL
- No request body

**Response:**
```json
{
  "success": true,
  "data": {
    "totalProfit": 0.0,
    "totalSales": 0.0,
    "totalCost": 0.0,
    "profitMargin": 0.0,
    "itemProfits": [
      {
        "item_id": "string",
        "item_name": "string",
        "total_profit": 0.0,
        "total_sales": 0.0,
        "total_cost": 0.0
      }
    ]
  }
}
```

**Response Fields:**
- `totalProfit` - Total profit for the period
- `totalSales` - Total sales revenue
- `totalCost` - Total cost of goods sold
- `profitMargin` - Profit margin (profit / sales)
- `itemProfits` - Profit breakdown by item, sorted by profit descending

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing timestamps)
- `500` - Server error

**Example (cURL):**
```bash
curl -X GET "http://localhost:3000/api/profit?start=1704067200&end=1704153600"
```

**Example (React Native):**
```typescript
const startTimestamp = Math.floor(new Date('2024-01-01').getTime() / 1000);
const endTimestamp = Math.floor(new Date('2024-01-31').getTime() / 1000);
const response = await fetch(
  `http://localhost:3000/api/profit?start=${startTimestamp}&end=${endTimestamp}`
);
const result = await response.json();
if (result.success) {
  const { totalProfit, totalSales, profitMargin, itemProfits } = result.data;
}
```

---

## Database Management Endpoints

These endpoints are for development and setup purposes. In production, these should be protected or removed.

### 13. Test Database Connection

Test the database connection.

**Endpoint:** `GET /api/db/test`

**Request:**
- No parameters
- No request body

**Response:**
```json
{
  "success": true,
  "message": "Database connection successful",
  "data": [{ "test": 1 }]
}
```

**Status Codes:**
- `200` - Success
- `500` - Database connection failed

**Example (cURL):**
```bash
curl -X GET http://localhost:3000/api/db/test
```

---

### 14. Run Database Migrations

Execute database migrations to set up or update the schema.

**Endpoint:** `POST /api/db/migrate`

**Request:**
- No request body

**Response:**
```json
{
  "success": true,
  "message": "Migration completed successfully"
}
```

**Status Codes:**
- `200` - Success
- `500` - Migration failed

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/api/db/migrate
```

**Warning:** This endpoint should be protected in production.

---

### 15. Seed Database

Populate the database with initial demo data.

**Endpoint:** `POST /api/db/seed`

**Request:**
- No request body

**Response:**
```json
{
  "success": true,
  "message": "Database seeded successfully",
  "data": {
    "businessId": "string",
    "userId": "string",
    "categoriesCount": 0,
    "itemsCount": 0
  }
}
```

**Status Codes:**
- `200` - Success
- `500` - Seed failed

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/api/db/seed
```

**Warning:** This endpoint should be protected in production.

---

## Data Types

### Unit Types
- `kg` - Kilograms
- `g` - Grams
- `piece` - Individual pieces
- `bunch` - Bunches
- `tray` - Trays
- `litre` - Litres
- `ml` - Milliliters

### Payment Methods
- `cash` - Cash payment
- `mpesa` - M-Pesa mobile payment
- `credit` - Credit/debt payment
- `split` - Split payment (multiple methods)

### Sale Status
- `completed` - Sale completed successfully
- `voided` - Sale was voided/cancelled

---

## Error Handling

All endpoints follow consistent error handling:

1. **Validation Errors (400):** Missing or invalid request parameters
2. **Not Found (404):** Resource not found
3. **Server Errors (500):** Internal server errors

Error responses include:
- `success: false`
- `message`: Human-readable error message
- `error`: Detailed error message (for debugging)

**Example Error Response:**
```json
{
  "success": false,
  "message": "Failed to fetch items",
  "error": "Database connection timeout"
}
```

---

## React Native Integration Example

Here's a complete example of how to use the API in a React Native application:

```typescript
// api.ts
const API_BASE_URL = 'http://localhost:3000/api';

export interface Category {
  id: string;
  name: string;
  position: number;
  icon: string | null;
}

export interface Item {
  id: string;
  name: string;
  unit_type: string;
  current_stock: number;
  current_sell_price: number;
  image_url: string | null;
}

export interface SaleItem {
  itemId: string;
  quantity: number;
  price: number;
}

export const api = {
  async getCategories(): Promise<Category[]> {
    const response = await fetch(`${API_BASE_URL}/categories`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async getItems(categoryId?: string): Promise<Item[]> {
    const url = categoryId
      ? `${API_BASE_URL}/items?categoryId=${categoryId}`
      : `${API_BASE_URL}/items?all=true`;
    const response = await fetch(url);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async createSale(
    items: SaleItem[],
    paymentMethod: string,
    cashReceived?: number
  ): Promise<{ saleId: string; totalAmount: number; change: number }> {
    const response = await fetch(`${API_BASE_URL}/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items,
        paymentMethod,
        cashReceived,
      }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async getSale(saleId: string) {
    const response = await fetch(`${API_BASE_URL}/sales/${saleId}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async getItem(itemId: string): Promise<Item> {
    const response = await fetch(`${API_BASE_URL}/items/${itemId}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async updateItemPrice(
    itemId: string,
    price: number,
    effectiveFrom?: number
  ): Promise<{ priceId: string; price: number }> {
    const response = await fetch(`${API_BASE_URL}/items/${itemId}/price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ price, effectiveFrom }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async getPurchases() {
    const response = await fetch(`${API_BASE_URL}/purchases`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async createPurchase(purchaseData: {
    supplierName?: string;
    purchaseDate: number;
    totalAmount: number;
    extraCosts?: number;
    notes?: string;
    items: Array<{
      itemId?: string;
      itemName: string;
      quantityNote: string;
      amount: number;
      notes?: string;
    }>;
  }): Promise<{ purchaseId: string }> {
    const response = await fetch(`${API_BASE_URL}/purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(purchaseData),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async getPurchase(purchaseId: string) {
    const response = await fetch(`${API_BASE_URL}/purchases/${purchaseId}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async createPurchaseBreakdown(
    purchaseId: string,
    breakdownData: {
      purchaseItemId: string;
      itemId: string;
      usableQuantity: number;
      wastageQuantity?: number;
      buyPricePerUnit: number;
      notes?: string;
    }
  ): Promise<{
    breakdownId: string;
    batchId: string;
    purchaseStatus: string;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/purchases/${purchaseId}/breakdown`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(breakdownData),
      }
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async getStock() {
    const response = await fetch(`${API_BASE_URL}/stock`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },

  async getProfit(startTimestamp: number, endTimestamp: number) {
    const response = await fetch(
      `${API_BASE_URL}/profit?start=${startTimestamp}&end=${endTimestamp}`
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  },
};
```

---

## Notes

1. **Business ID:** Currently, all endpoints use a hardcoded demo business ID. In production, this will be determined from the authenticated session.

2. **Timestamps:** All timestamps are Unix timestamps (seconds since epoch).

3. **Active Flags:** The `active` field uses `1` for true and `0` for false (SQLite boolean representation).

4. **Stock Updates:** Creating a sale automatically decrements item stock using FIFO (First In, First Out) inventory management.

5. **FIFO Inventory:** Sales use FIFO to track which inventory batches are sold, enabling accurate profit calculation based on actual buy prices.

6. **Credit Sales:** When payment method is "credit", the system automatically creates or updates credit accounts and records credit transactions.

7. **CORS:** All endpoints support CORS for cross-origin requests from web and mobile applications.

8. **Production Considerations:**
   - Add authentication/authorization
   - Protect database management endpoints
   - Implement rate limiting
   - Add request validation middleware
   - Use environment-specific base URLs
   - Implement proper error logging

---

## Changelog

- **2024-01-XX:** Initial API documentation
  - Added CORS support to all endpoints
  - Documented all existing endpoints
  - Added React Native integration examples
  - Updated Create Sale endpoint with FIFO inventory management
  - Added credit sales support
  - Added all missing endpoints: Items, Purchases, Stock, Profit



