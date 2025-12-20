import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/lib/db';
import type { User, SuperAdmin } from '@/lib/db/types';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'owner' | 'admin' | 'cashier' | 'superadmin';
      businessId: string | null;
      businessName: string | null;
      isSuperAdmin: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'cashier' | 'superadmin';
    businessId: string | null;
    businessName: string | null;
    isSuperAdmin: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'cashier' | 'superadmin';
    businessId: string | null;
    businessName: string | null;
    isSuperAdmin: boolean;
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
          isSuperAdmin: false,
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
          isSuperAdmin: false,
        };
      },
    }),
    CredentialsProvider({
      id: 'superadmin',
      name: 'Super Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const admin = await queryOne<SuperAdmin>(
          `SELECT * FROM super_admins WHERE email = ? AND active = 1`,
          [credentials.email]
        );

        if (!admin) {
          throw new Error('Invalid email or password');
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          admin.password_hash
        );

        if (!isValidPassword) {
          throw new Error('Invalid email or password');
        }

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: 'superadmin' as const,
          businessId: null,
          businessName: null,
          isSuperAdmin: true,
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
        token.isSuperAdmin = user.isSuperAdmin;
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
        isSuperAdmin: token.isSuperAdmin,
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
