'use client';

import { useState, useEffect } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPostLoginPath } from '@/lib/utils/post-login-redirect';
import { storeUserRole } from '@/lib/utils/user-role-storage';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const DEFAULT_DOMAIN = 'kiosk.co.ke';
const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];

function isPublicDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === DEFAULT_DOMAIN || LOCALHOST_DOMAINS.includes(lower);
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [domainLoading, setDomainLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    const resolveDomain = async () => {
      try {
        const hostname = window.location.hostname.toLowerCase();
        
        const publicDomain = isPublicDomain(hostname);
        setIsPublic(publicDomain);

        if (publicDomain) {
          setDomainLoading(false);
          return;
        }

        // Remove port if present
        let domainToResolve = hostname;
        const portIndex = domainToResolve.indexOf(':');
        if (portIndex > -1) {
          domainToResolve = domainToResolve.substring(0, portIndex);
        }

        const response = await fetch(`/api/domain/resolve?domain=${encodeURIComponent(domainToResolve)}`);
        const result = await response.json();

        if (result.success && result.data) {
          setBusinessId(result.data.businessId);
          setBusinessName(result.data.businessName);
        }
      } catch (err) {
        console.error('Failed to resolve domain:', err);
      } finally {
        setDomainLoading(false);
      }
    };

    resolveDomain();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const signInParams: {
        email: string;
        password: string;
        businessId?: string;
        redirect: boolean;
      } = {
        email,
        password,
        redirect: false,
      };

      if (!isPublic && businessId) {
        signInParams.businessId = businessId;
      }

      const result = await signIn('credentials', signInParams);

      if (result?.error) {
        if (result.error.includes('suspended')) {
          setError('This business is suspended. Please contact support.');
        } else {
          setError('Invalid email or password');
        }
        setIsLoading(false);
        return;
      }

      const session = await getSession();
      const role = session?.user?.role;
      if (role) storeUserRole(role);

      router.push(getPostLoginPath(role));
      router.refresh();
    } catch {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          Welcome Back
        </CardTitle>
        <CardDescription>
          {domainLoading ? (
            'Loading...'
          ) : isPublic ? (
            'Sign in to access your POS dashboard'
          ) : businessName ? (
            <>Sign in to <span className="font-semibold text-emerald-600">{businessName}</span></>
          ) : (
            'Sign in to access your POS dashboard'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-12"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 pr-12"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-12 bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            style={{ backgroundColor: '#059669', color: '#ffffff' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Register your business
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
