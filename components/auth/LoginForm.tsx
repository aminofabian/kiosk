'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const DEFAULT_DOMAIN = 'kiosk.ke';
const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [domainLoading, setDomainLoading] = useState(true);

  useEffect(() => {
    const resolveDomain = async () => {
      try {
        let hostname = window.location.hostname.toLowerCase();
        
        // Map localhost to default domain
        if (LOCALHOST_DOMAINS.includes(hostname)) {
          hostname = DEFAULT_DOMAIN;
        }

        // Remove port if present
        const portIndex = hostname.indexOf(':');
        if (portIndex > -1) {
          hostname = hostname.substring(0, portIndex);
        }

        // Fetch business for this domain
        const response = await fetch(`/api/domain/resolve?domain=${encodeURIComponent(hostname)}`);
        const result = await response.json();

        if (result.success && result.data) {
          setBusinessId(result.data.businessId);
          setBusinessName(result.data.businessName);
        }
        // If no business found, businessId stays null - fallback login will be used
      } catch (err) {
        console.error('Failed to resolve domain:', err);
        // On error, businessId stays null - allows fallback login during initial setup
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
      const result = await signIn('credentials', {
        email,
        password,
        businessId: businessId || undefined,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes('suspended')) {
          setError('This business is suspended. Please contact support.');
        } else {
          setError('Invalid email or password');
        }
        setIsLoading(false);
        return;
      }

      router.push('/admin');
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
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-12"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
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
