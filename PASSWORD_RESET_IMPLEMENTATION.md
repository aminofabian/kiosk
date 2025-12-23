# Password Reset Implementation

This document describes the password reset functionality implemented using Resend for email delivery.

## Overview

Users can now reset their passwords through a secure email-based flow:
1. Request password reset via email
2. Receive reset link via email (using Resend)
3. Reset password using the token from the email link

## Environment Variables

Add these to your `.env.local` file:

```env
# Resend API Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Optional, defaults to noreply@kiosk.ke
APP_NAME=POS System  # Optional, defaults to "POS System"
NEXTAUTH_URL=http://localhost:3000  # Your app URL (required for reset links)
```

### Getting Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Create an API key in the dashboard
3. Add your domain and verify it (for production)
4. For development, you can use Resend's test domain

## Database Migration

A new `password_reset_tokens` table has been added. Run migrations:

```bash
# Via API endpoint (if available)
curl -X POST http://localhost:3000/api/db/migrate

# Or migrations run automatically when the app starts (if configured)
```

The migration creates:
- `password_reset_tokens` table with token storage
- Indexes for efficient token lookups
- Foreign key relationship to users table

## API Routes

### POST `/api/auth/forgot-password`

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### POST `/api/auth/reset-password`

Reset password using token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

## Pages

- `/forgot-password` - Request password reset
- `/reset-password?token=xxx` - Reset password with token

## Components

- `components/auth/ForgotPasswordForm.tsx` - Form to request reset
- `components/auth/ResetPasswordForm.tsx` - Form to reset password

## Security Features

1. **Token Expiration**: Reset tokens expire after 1 hour
2. **One-Time Use**: Tokens are marked as used after successful reset
3. **Secure Tokens**: Cryptographically secure random tokens (32 bytes)
4. **Password Validation**: Minimum 6 characters required
5. **User Verification**: Only active users can reset passwords

## Email Template

The password reset email includes:
- Branded header with gradient styling
- Clear call-to-action button
- Fallback link (if button doesn't work)
- Expiration notice
- Security notice

## Testing

1. **Request Reset:**
   - Go to `/login`
   - Click "Forgot your password?"
   - Enter email address
   - Check email inbox

2. **Reset Password:**
   - Click link in email (or copy/paste)
   - Enter new password
   - Confirm password
   - Redirected to login

## Files Created/Modified

### New Files
- `lib/utils/email.ts` - Resend email service
- `lib/db/migrate-password-reset.ts` - Database migration
- `app/api/auth/forgot-password/route.ts` - Request reset API
- `app/api/auth/reset-password/route.ts` - Reset password API
- `components/auth/ForgotPasswordForm.tsx` - Request form component
- `components/auth/ResetPasswordForm.tsx` - Reset form component
- `app/(auth)/forgot-password/page.tsx` - Request page
- `app/(auth)/reset-password/page.tsx` - Reset page

### Modified Files
- `lib/db/types.ts` - Added PasswordResetToken type
- `lib/db/migrate.ts` - Added password reset migration
- `components/auth/LoginForm.tsx` - Added "Forgot password?" link
- `package.json` - Added resend dependency

## Notes

- Tokens are stored in the database with expiration timestamps
- Old/unused tokens are automatically invalidated after expiration
- The system doesn't reveal if an email exists (security best practice)
- Email sending failures are logged but don't expose internal errors to users

