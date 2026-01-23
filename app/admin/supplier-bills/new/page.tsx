'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewSupplierBillPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main page with query parameter to open drawer
    router.replace('/admin/supplier-bills?new=true');
  }, [router]);

  return null;
}
