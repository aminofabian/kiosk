'use client';

const AUTH_ERROR_MESSAGES = [
  'Unauthorized',
  'Business is suspended or not found',
  'Super admin access required',
  'Forbidden',
] as const;

import { getUserRole } from './user-role-storage';

const DEFAULT_DOMAIN = 'kiosk.co.ke';
const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];

function isPublicDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === DEFAULT_DOMAIN || LOCALHOST_DOMAINS.includes(lower);
}

function isKioskDomain(hostname: string): boolean {
  return !isPublicDomain(hostname);
}

function getLoginUrl(): string {
  if (typeof window === 'undefined') return '/login';
  
  const pathname = window.location.pathname;
  const hostname = window.location.hostname;
  
  if (pathname.startsWith('/superadmin')) {
    return '/superadmin/login';
  }
  
  // Only redirect to /pos/login if:
  // 1. We're on a kiosk domain (business-specific)
  // 2. The stored user role is 'cashier' (if available)
  // This ensures PIN login is only shown for cashiers on kiosk/business-specific domains
  const storedRole = getUserRole();
  const isCashier = storedRole === 'cashier';
  const shouldUsePosLogin = pathname.startsWith('/pos') && isKioskDomain(hostname) && (isCashier || !storedRole);
  
  if (shouldUsePosLogin) {
    return '/pos/login';
  }
  
  return '/login';
}

function isAuthError(status: number, message?: string): boolean {
  if (status === 401) return true;
  
  if (status === 403 && message) {
    return AUTH_ERROR_MESSAGES.some((errorMsg) => message.includes(errorMsg));
  }
  
  return false;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  
  const loginUrl = getLoginUrl();
  window.location.href = loginUrl;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(url, options);
  const result: ApiResponse<T> = await response.json();

  if (isAuthError(response.status, result.message)) {
    redirectToLogin();
    return { success: false, message: 'Redirecting to login...' };
  }

  return result;
}

export async function apiGet<T = unknown>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url);
}

export async function apiPost<T = unknown>(
  url: string,
  body: unknown
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiPut<T = unknown>(
  url: string,
  body: unknown
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T = unknown>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { method: 'DELETE' });
}
