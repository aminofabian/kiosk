'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function ShiftOpenForm() {
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkOpenShift() {
      try {
        const response = await fetch('/api/shifts/current');
        const result = await response.json();
        if (result.success && result.data) {
          setHasOpenShift(true);
        } else {
          setHasOpenShift(false);
        }
      } catch (err) {
        console.error('Error checking shift:', err);
        setHasOpenShift(false);
      }
    }
    checkOpenShift();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) {
      setError('Please enter a valid opening cash amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openingCash: cash,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push('/pos');
      } else {
        setError(result.message || 'Failed to open shift');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Shift open error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (hasOpenShift === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking shift status...</p>
        </div>
      </div>
    );
  }

  if (hasOpenShift) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-[#259783]/10 rounded-2xl flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold">Shift Already Open</h2>
          <p className="text-muted-foreground">
            You already have an open shift. Please close it before opening a new one.
          </p>
          <Button onClick={() => router.push('/pos')} size="touch">
            Go to POS
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Open New Shift</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cash">Opening Cash (KES) *</Label>
              <Input
                id="cash"
                type="number"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                required
                className="text-lg h-14 touch-target"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Count the cash in the register and enter the amount
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="touch"
              disabled={isSubmitting}
              className="w-full bg-[#259783] hover:bg-[#45d827] text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Opening...
                </>
              ) : (
                'Open Shift'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

