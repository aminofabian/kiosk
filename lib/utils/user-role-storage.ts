const USER_ROLE_STORAGE_KEY = 'pos_user_role';

export function storeUserRole(role: string | null): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (role) {
      localStorage.setItem(USER_ROLE_STORAGE_KEY, role);
    } else {
      localStorage.removeItem(USER_ROLE_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function getUserRole(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(USER_ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearUserRole(): void {
  storeUserRole(null);
}

export function getUserRoleStorageKey(): string {
  return USER_ROLE_STORAGE_KEY;
}

