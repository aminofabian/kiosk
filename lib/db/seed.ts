import { execute } from './index';
import type { UnitType } from '@/lib/constants';

// Simple UUID generator (for seeding, we don't need crypto.randomUUID)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const now = Math.floor(Date.now() / 1000); // Unix timestamp

export async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');

    // 1. Create dummy business
    const businessId = generateUUID();
    console.log('Creating business...');
    await execute(
      `INSERT INTO businesses (id, name, currency, timezone, created_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [businessId, 'Demo Grocery Store', 'KES', 'Africa/Nairobi', now]
    );
    console.log(`✓ Created business: ${businessId}`);

    // 2. Create dummy owner user (needed for selling_prices foreign key)
    const userId = generateUUID();
    console.log('Creating owner user...');
    await execute(
      `INSERT INTO users (id, business_id, name, email, password_hash, role, active, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        businessId,
        'Demo Owner',
        'owner@demo.com',
        'dummy_hash', // Not used in Phase 1
        'owner',
        1,
        now,
      ]
    );
    console.log(`✓ Created owner user: ${userId}`);

    // 3. Create categories
    const categories = [
      { name: 'Vegetables', icon: '🥬', position: 1 },
      { name: 'Green Grocery', icon: '🥗', position: 2 },
      { name: 'Fruits', icon: '🍎', position: 3 },
      { name: 'Grains & Cereals', icon: '🌾', position: 4 },
    ];

    const categoryIds: Record<string, string> = {};
    console.log('Creating categories...');
    for (const category of categories) {
      const id = generateUUID();
      categoryIds[category.name] = id;
      await execute(
        `INSERT INTO categories (id, business_id, name, position, icon, active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, businessId, category.name, category.position, category.icon, 1, now]
      );
      console.log(`✓ Created category: ${category.name}`);
    }

    // 3. Create items
    const items = [
      // Vegetables
      { name: 'Tomatoes', category: 'Vegetables', unitType: 'piece' as UnitType, stock: 50, price: 120 },
      { name: 'Onions', category: 'Vegetables', unitType: 'piece' as UnitType, stock: 30, price: 80 },
      { name: 'Potatoes', category: 'Vegetables', unitType: 'kg' as UnitType, stock: 40, price: 100 },
      { name: 'Carrots', category: 'Vegetables', unitType: 'kg' as UnitType, stock: 25, price: 150 },
      { name: 'Cabbage', category: 'Vegetables', unitType: 'piece' as UnitType, stock: 20, price: 50 },
      { name: 'Bell Peppers', category: 'Vegetables', unitType: 'kg' as UnitType, stock: 18, price: 200 },
      { name: 'Eggplant', category: 'Vegetables', unitType: 'kg' as UnitType, stock: 15, price: 180 },
      { name: 'Okra', category: 'Vegetables', unitType: 'kg' as UnitType, stock: 12, price: 250 },
      { name: 'Green Beans', category: 'Vegetables', unitType: 'kg' as UnitType, stock: 22, price: 220 },
      { name: 'Cauliflower', category: 'Vegetables', unitType: 'piece' as UnitType, stock: 10, price: 120 },
      
      // Green Grocery
      { name: 'Spinach', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 25, price: 30 },
      { name: 'Kale', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 20, price: 40 },
      { name: 'Lettuce', category: 'Green Grocery', unitType: 'piece' as UnitType, stock: 15, price: 60 },
      { name: 'Coriander', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 30, price: 20 },
      { name: 'Parsley', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 25, price: 25 },
      { name: 'Mint', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 18, price: 35 },
      { name: 'Basil', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 12, price: 40 },
      { name: 'Arugula', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 10, price: 50 },
      { name: 'Spring Onions', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 28, price: 25 },
      { name: 'Dill', category: 'Green Grocery', unitType: 'bunch' as UnitType, stock: 15, price: 30 },
      
      // Fruits
      { name: 'Bananas', category: 'Fruits', unitType: 'bunch' as UnitType, stock: 30, price: 80 },
      { name: 'Oranges', category: 'Fruits', unitType: 'kg' as UnitType, stock: 35, price: 200 },
      { name: 'Apples', category: 'Fruits', unitType: 'kg' as UnitType, stock: 28, price: 250 },
      { name: 'Mangoes', category: 'Fruits', unitType: 'piece' as UnitType, stock: 50, price: 30 },
      { name: 'Avocados', category: 'Fruits', unitType: 'piece' as UnitType, stock: 40, price: 50 },
      { name: 'Watermelons', category: 'Fruits', unitType: 'piece' as UnitType, stock: 10, price: 300 },
      { name: 'Pineapples', category: 'Fruits', unitType: 'piece' as UnitType, stock: 15, price: 150 },
      { name: 'Papayas', category: 'Fruits', unitType: 'piece' as UnitType, stock: 20, price: 80 },
      { name: 'Grapes', category: 'Fruits', unitType: 'kg' as UnitType, stock: 12, price: 400 },
      { name: 'Lemons', category: 'Fruits', unitType: 'kg' as UnitType, stock: 18, price: 180 },
      
      // Grains & Cereals
      { name: 'Rice (1kg)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 100, price: 150 },
      { name: 'Maize Flour (2kg)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 80, price: 200 },
      { name: 'Wheat Flour (1kg)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 60, price: 120 },
      { name: 'Beans (1kg)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 70, price: 180 },
      { name: 'Lentils (500g)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 45, price: 100 },
      { name: 'Oats (500g)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 35, price: 140 },
      { name: 'Barley (1kg)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 30, price: 160 },
      { name: 'Quinoa (500g)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 25, price: 350 },
      { name: 'Millet (1kg)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 40, price: 130 },
      { name: 'Sorghum (1kg)', category: 'Grains & Cereals', unitType: 'piece' as UnitType, stock: 35, price: 120 },
    ];

    console.log('Creating items...');
    for (const item of items) {
      const id = generateUUID();
      const categoryId = categoryIds[item.category];
      
      await execute(
        `INSERT INTO items (
          id, business_id, category_id, name, unit_type, 
          current_stock, current_sell_price, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          businessId,
          categoryId,
          item.name,
          item.unitType,
          item.stock,
          item.price,
          1,
          now,
        ]
      );
      
      // Create initial selling price record
      await execute(
        `INSERT INTO selling_prices (id, item_id, price, effective_from, set_by, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [generateUUID(), id, item.price, now, userId, now]
      );
      
      console.log(`✓ Created item: ${item.name} (${item.unitType}) - KES ${item.price}`);
    }

    console.log('\n✅ Database seeded successfully!');
    console.log(`\nBusiness ID: ${businessId}`);
    console.log(`Categories: ${categories.length}`);
    console.log(`Items: ${items.length}`);
    
    return { businessId, categoryCount: categories.length, itemCount: items.length };
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// To run seed, use the API route: /api/db/seed
// Or import and call seedDatabase() from a script

