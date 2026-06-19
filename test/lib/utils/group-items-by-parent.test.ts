import { describe, it, expect } from 'vitest';
import { groupItemsByParent, displayGroupedItemName } from '@/lib/utils/group-items-by-parent';
import type { Item } from '@/lib/db/types';

function item(
  overrides: Partial<Item> & Pick<Item, 'id' | 'name'>,
): Item {
  return {
    business_id: 'biz-1',
    category_id: 'cat-1',
    parent_item_id: null,
    variant_name: null,
    unit_type: 'piece',
    item_type: 'grocery',
    current_stock: 10,
    min_stock_level: null,
    expected_stock_level: null,
    current_sell_price: 100,
    image_url: null,
    barcode: null,
    product_code: null,
    expiry_date: null,
    bundle_quantity: null,
    bundle_price: null,
    bundle_name: null,
    packaging_unit_name: null,
    packaging_unit_qty: null,
    active: 1,
    created_at: 0,
    ...overrides,
  };
}

describe('groupItemsByParent', () => {
  it('groups variants under their parent label', () => {
    const groups = groupItemsByParent([
      { ...item({ id: 'v2', name: 'Tomatoes', parent_item_id: 'p1', variant_name: 'Large' }), parent_name: 'Tomatoes' },
      { ...item({ id: 'v1', name: 'Tomatoes', parent_item_id: 'p1', variant_name: 'Small' }), parent_name: 'Tomatoes' },
      item({ id: 's1', name: 'Onions' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Onions');
    expect(groups[0].isVariantGroup).toBe(false);
    expect(groups[1].label).toBe('Tomatoes');
    expect(groups[1].isVariantGroup).toBe(true);
    expect(groups[1].items.map((i) => i.id)).toEqual(['v2', 'v1']);
  });

  it('shows variant name for grouped rows', () => {
    const variant = {
      ...item({ id: 'v1', name: 'Tomatoes', parent_item_id: 'p1', variant_name: 'Small' }),
      parent_name: 'Tomatoes',
    };
    expect(displayGroupedItemName(variant)).toBe('Small');
  });
});
