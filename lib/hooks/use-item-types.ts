'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet } from '@/lib/utils/api-client';
import {
  DEFAULT_PRODUCT_TYPES,
  type ProductTypeConfig,
} from '@/lib/types/product-types';

export interface UseItemTypesResult {
  productTypes: ProductTypeConfig[];
  /** Stable array of keys for validation and API params */
  itemTypeKeys: string[];
  /** When true, cashiers may sell items with zero or insufficient stock */
  allowSellOutOfStock: boolean;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
}

export function useItemTypes(): UseItemTypesResult {
  const [productTypes, setProductTypes] = useState<ProductTypeConfig[]>(DEFAULT_PRODUCT_TYPES);
  const [allowSellOutOfStock, setAllowSellOutOfStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiGet<{
        productTypes: ProductTypeConfig[];
        allowSellOutOfStock?: boolean;
      }>('/api/settings');
      if (res.success && res.data?.productTypes?.length) {
        setProductTypes(res.data.productTypes);
      }
      if (res.success && res.data) {
        setAllowSellOutOfStock(res.data.allowSellOutOfStock === true);
      }
    } catch {
      setError(true);
      setProductTypes(DEFAULT_PRODUCT_TYPES);
      setAllowSellOutOfStock(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const itemTypeKeys = useMemo(() => productTypes.map((t) => t.key), [productTypes]);

  return {
    productTypes,
    itemTypeKeys,
    allowSellOutOfStock,
    loading,
    error,
    refetch: fetchTypes,
  };
}
