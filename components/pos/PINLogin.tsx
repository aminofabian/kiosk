'use client';

import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Delete } from 'lucide-react';

interface PINLoginProps {
  businessId: string;
  businessName: string;
}

export function PINLogin({ businessId, businessName }: PINLoginProps) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('Please enter 4 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('pin', {
        pin,
        businessId,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid PIN');
        setPin('');
        setIsLoading(false);
        return;
      }

      router.push('/pos');
      router.refresh();
    } catch {
      setError('An error occurred');
      setIsLoading(false);
    }
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{businessName}</CardTitle>
        <CardDescription>Enter your 4-digit PIN</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PIN Display */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                pin.length > i
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              {pin.length > i ? '•' : ''}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-center text-sm text-destructive">{error}</div>
        )}

        {isLoading && (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3">
          {digits.map((digit, i) => {
            if (digit === '') {
              return <div key={i} />;
            }
            if (digit === 'del') {
              return (
                <Button
                  key={i}
                  variant="outline"
                  className="h-14 text-lg"
                  onClick={handleDelete}
                  disabled={isLoading || pin.length === 0}
                >
                  <Delete className="h-5 w-5" />
                </Button>
              );
            }
            return (
              <Button
                key={i}
                variant="outline"
                className="h-14 text-xl font-semibold"
                onClick={() => handleKeyPress(digit)}
                disabled={isLoading || pin.length >= 4}
              >
                {digit}
              </Button>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="link" onClick={handleClear} disabled={isLoading}>
            Clear
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <a href="/login" className="text-emerald-600 hover:underline">
            Sign in with email instead
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
