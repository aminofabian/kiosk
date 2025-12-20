import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/lib/db';
import type { User } from '@/lib/db/types';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'owner' | 'admin' | 'cashier';
      businessId: string;
      businessName: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'cashier';
    businessId: string;
    businessName: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'cashier';
    businessId: string;
    businessName: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await queryOne<User & { business_name: string }>(
          `SELECT u.*, b.name as business_name 
           FROM users u 
           JOIN businesses b ON u.business_id = b.id
           WHERE u.email = ? AND u.active = 1`,
          [credentials.email]
        );

        if (!user) {
          throw new Error('Invalid email or password');
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isValidPassword) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.business_id,
          businessName: user.business_name,
        };
      },
    }),
    CredentialsProvider({
      id: 'pin',
      name: 'PIN Login',
      credentials: {
        pin: { label: 'PIN', type: 'password' },
        businessId: { label: 'Business ID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.pin || !credentials?.businessId) {
          throw new Error('PIN and business are required');
        }

        const user = await queryOne<User & { business_name: string }>(
          `SELECT u.*, b.name as business_name 
           FROM users u 
           JOIN businesses b ON u.business_id = b.id
           WHERE u.pin = ? AND u.business_id = ? AND u.active = 1`,
          [credentials.pin, credentials.businessId]
        );

        if (!user) {
          throw new Error('Invalid PIN');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.business_id,
          businessName: user.business_name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.businessId = user.businessId;
        token.businessName = user.businessName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        role: token.role,
        businessId: token.businessId,
        businessName: token.businessName,
      };
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
