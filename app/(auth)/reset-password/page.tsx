import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">🛒 GroceryPOS</h1>
          <p className="text-slate-600 mt-2">Simple. Fast. Reliable.</p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}

