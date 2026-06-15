'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { apiGet } from '@/lib/utils/api-client';

export function parseDeptTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function useDepartmentTypes() {
  const { user } = useCurrentUser();
  const sessionDeptTypes = useMemo(
    () => parseDeptTypes(user?.department),
    [user?.department],
  );
  const [assignedTypes, setAssignedTypes] = useState<string[]>(sessionDeptTypes);

  useEffect(() => {
    setAssignedTypes(sessionDeptTypes);
  }, [sessionDeptTypes]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const result = await apiGet<{ department: string | null }>('/api/users/me');
      if (result.success && result.data) {
        const fromApi = parseDeptTypes(result.data.department);
        if (fromApi.length > 0) {
          setAssignedTypes(fromApi);
        }
      }
    })();
  }, [user?.id]);

  return { assignedTypes, user };
}
