import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Store,
  TrendingUp,
  Zap,
  Shield,
  Smartphone,
  BarChart3,
  Users,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  LogIn,
  UserPlus,
  StoreIcon,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { InstallApp } from '@/components/InstallApp';
import { ProductStore } from '@/components/ProductStore';
import { ScrollToSection } from '@/components/ScrollToSection';
import { getCurrentUser } from '@/lib/auth';

function extractBusinessNameFromDomain(hostname: string | null): string {
  const DEFAULT_DOMAIN = 'kiosk.co.ke';
  const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];
  
  if (!hostname) {
    return 'Kiosk';
  }
  
  let domain = hostname.split(':')[0].toLowerCase();
  
  if (LOCALHOST_DOMAINS.includes(domain)) {
    domain = DEFAULT_DOMAIN;
  }
  
  const parts = domain.split('.');
  const tlds = ['co', 'com', 'net', 'org', 'ke', 'uk', 'us', 'io'];
  const filteredParts = parts.filter(part => !tlds.includes(part));
  const businessName = filteredParts[0] || parts[0] || 'Kiosk';
  
  return businessName.charAt(0).toUpperCase() + businessName.slice(1);
}

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  const headersList = await headers();
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host');
  const businessName = user?.businessName || extractBusinessNameFromDomain(hostname);
  
  const taglines = [
    'for fruits, vegetables, and fresh produce',
    'for vendors, kiosks, and small businesses',
    'for mama mboga, dukas, and local shops',
    'for groceries, markets, and retail stores',
    'for quick sales and easy checkout',
    'for your everyday shopping needs',
    'powering local businesses across Kenya',
  ];
  
  const taglineIndex = businessName.length % taglines.length;
  const tagline = taglines[taglineIndex];
  const description = `${businessName} POS - ${tagline.charAt(0).toUpperCase() + tagline.slice(1)}. Free point-of-sale system with inventory management, sales tracking, and real-time reports. No credit card required.`;
  const title = `${businessName} POS - Free Point of Sale System | Start Selling Today`;
  const url = hostname ? `https://${hostname}` : 'https://kiosk.co.ke';
  
  return {
    title,
    description,
    keywords: [
      'point of sale',
      'POS system',
      'free POS',
      'inventory management',
      'sales tracking',
      'retail software',
      'grocery POS',
      'small business POS',
      'Kenya POS',
      'mama mboga POS',
      'duka POS',
      'kiosk POS',
      businessName,
      `${businessName} POS`,
    ].join(', '),
    authors: [{ name: businessName }],
    creator: businessName,
    publisher: businessName,
    metadataBase: new URL(url),
    alternates: {
      canonical: '/',
    },
    openGraph: {
      type: 'website',
      locale: 'en_KE',
      url,
      siteName: `${businessName} POS`,
      title,
      description,
      images: [
        {
          url: '/images/image.webp',
          width: 1200,
          height: 630,
          alt: `${businessName} POS - Free Point of Sale System`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/images/image.webp'],
      creator: `@${businessName.replace(/\s+/g, '')}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      // Add your verification codes here when available
      // google: 'your-google-verification-code',
      // yandex: 'your-yandex-verification-code',
    },
  };
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const headersList = await headers();
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host');
  const businessName = user?.businessName || extractBusinessNameFromDomain(hostname);
  
  const taglines = [
    'for fruits, vegetables, and fresh produce',
    'for vendors, kiosks, and small businesses',
    'for mama mboga, dukas, and local shops',
    'for groceries, markets, and retail stores',
    'for quick sales and easy checkout',
    'for your everyday shopping needs',
    'powering local businesses across Kenya',
  ];
  
  const taglineIndex = businessName.length % taglines.length;
  const tagline = taglines[taglineIndex];
  const baseUrl = hostname ? `https://${hostname}` : 'https://kiosk.co.ke';
  
  // Structured Data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${businessName} POS`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KES',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '500',
    },
    description: `${businessName} POS - ${tagline.charAt(0).toUpperCase() + tagline.slice(1)}. Free point-of-sale system with inventory management, sales tracking, and real-time reports.`,
    url: baseUrl,
    image: `${baseUrl}/images/image.webp`,
    featureList: [
      'Lightning Fast Checkout',
      'Inventory Management',
      'Real-time Sales Tracking',
      'Mobile Ready',
      'Secure & Private',
      'Smart Reports & Analytics',
    ],
  };
  
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: `${businessName} POS`,
    url: baseUrl,
    logo: `${baseUrl}/icon-512.png`,
    description: `Free point-of-sale system ${tagline}`,
    sameAs: [
      // Add social media links when available
    ],
  };
  
  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Navigation Bar */}
      <header>
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100 shadow-sm" aria-label="Main navigation">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {businessName} POS
              </span>
            </Link>
            
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/pos">
                    <Button size="sm" className="gap-2 bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600" style={{ color: '#ffffff', backgroundColor: '#059669' }}>
                      <ShoppingCart className="w-4 h-4" style={{ color: '#ffffff' }} />
                      <span style={{ color: '#ffffff' }}>POS</span>
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <LogIn className="w-4 h-4" />
                      Login
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="gap-2 bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600" style={{ color: '#ffffff', backgroundColor: '#059669' }}>
                      <UserPlus className="w-4 h-4" style={{ color: '#ffffff' }} />
                      <span style={{ color: '#ffffff' }}>Get Started</span>
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[650px] md:min-h-[750px] flex items-center justify-center py-8 md:py-12" aria-label="Hero section">
        <div className="container mx-auto px-4">
          {/* Background Image with Margin */}
          <div 
            className="absolute inset-4 md:inset-8 lg:inset-12 rounded-3xl bg-cover bg-center bg-no-repeat shadow-2xl"
            style={{
              backgroundImage: 'url(/images/image.webp)',
            }}
            role="img"
            aria-label="Point of sale system interface showing modern retail management"
          >
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-900/85 via-teal-900/75 to-green-900/85" />
            <div className="absolute inset-0 rounded-3xl bg-black/25" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 max-w-6xl mx-auto py-12 md:py-16">
            <div className="text-center space-y-8 md:space-y-12 animate-fade-in">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-xl backdrop-blur-sm border border-white/20">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-bold">100% FREE</span>
              </div>
              
              {/* Main Headline */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight drop-shadow-2xl px-4">
                Welcome to {businessName}
              </h1>
              
              {/* Subheadline */}
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto drop-shadow-lg px-4">
                Choose your path: Run your business or shop fresh products
              </p>

              {/* Two Path Cards */}
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto pt-8">
                {/* POS System Card */}
                <div className="group relative bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2 border-2 border-white/30">
                  <div className="absolute top-4 right-4">
                    <div className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full">
                      FOR BUSINESS
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="p-6 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl group-hover:scale-110 transition-transform duration-300">
                      <StoreIcon className="w-16 h-16 text-emerald-600" />
                    </div>
                    
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                        Use Our POS System
                      </h2>
                      <p className="text-gray-600 text-sm md:text-base mb-4">
                        Free point-of-sale system for your business. Manage sales, inventory, and reports all in one place.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span>100% Free Forever</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span>Setup in 2 minutes</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span>No credit card required</span>
                      </div>
                    </div>

                    <Link href={user ? "/pos" : "/register"} className="w-full">
                      <Button
                        size="lg"
                        className="w-full bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 gap-2 group-hover:scale-105"
                        style={{ color: '#ffffff', backgroundColor: '#059669' }}
                      >
                        {user ? (
                          <>
                            <StoreIcon className="w-5 h-5" style={{ color: '#ffffff' }} />
                            <span style={{ color: '#ffffff' }}>Open POS Dashboard</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-5 h-5" style={{ color: '#ffffff' }} />
                            <span style={{ color: '#ffffff' }}>Start Free POS</span>
                          </>
                        )}
                        <ArrowRight className="w-5 h-5" style={{ color: '#ffffff' }} />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Shopping Card */}
                <div className="group relative bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2 border-2 border-white/30">
                  <div className="absolute top-4 right-4">
                    <div className="px-3 py-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-bold rounded-full">
                      FOR CUSTOMERS
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="p-6 bg-gradient-to-br from-orange-100 to-pink-100 rounded-3xl group-hover:scale-110 transition-transform duration-300">
                      <ShoppingBag className="w-16 h-16 text-orange-600" />
                    </div>
                    
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                        Shop Fresh Products
                      </h2>
                      <p className="text-gray-600 text-sm md:text-base mb-4">
                        Browse our wide selection of fresh fruits, vegetables, and groceries. Quality products at great prices.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0" />
                        <span>Fresh & Quality Products</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0" />
                        <span>Competitive Prices</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0" />
                        <span>Easy Shopping Experience</span>
                      </div>
                    </div>

                    <ScrollToSection targetId="product-store" className="w-full">
                      <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 gap-2 group-hover:scale-105"
                      >
                        <ShoppingBag className="w-5 h-5" />
                        Browse Products
                        <ArrowRight className="w-5 h-5" />
                      </Button>
                    </ScrollToSection>
                  </div>
                </div>
              </div>

              {/* Or Divider */}
              <div className="flex items-center gap-4 pt-4">
                <div className="flex-1 h-px bg-white/30"></div>
                <span className="text-white/80 font-medium text-sm">OR</span>
                <div className="flex-1 h-px bg-white/30"></div>
              </div>

              {/* Quick Links */}
              {!user && (
                <div className="flex items-center justify-center gap-4 pt-2">
                  <Link href="/login" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
                    Already have an account? <span className="underline">Sign In</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Product Store Section */}
      <div id="product-store">
        <ProductStore />
      </div>

      {/* Content Section */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-6xl mx-auto">
          {/* Features Grid */}
          <section aria-labelledby="features-heading">
            <h2 id="features-heading" className="sr-only">Key Features</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100 group">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Lightning Fast
              </h3>
              <p className="text-gray-600">
                Quick checkout process designed for speed and efficiency. Process sales in seconds.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100 group">
              <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-teal-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Store className="w-7 h-7 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Easy Management
              </h3>
              <p className="text-gray-600">
                Simple inventory and category management at your fingertips. No training needed.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100 group">
              <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Real-time Updates
              </h3>
              <p className="text-gray-600">
                Track sales and inventory in real-time with live updates. Always know your numbers.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100 group">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Smartphone className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Mobile Ready
              </h3>
              <p className="text-gray-600">
                Works perfectly on phones and tablets. Install as an app for instant access.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100 group">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Secure & Private
              </h3>
              <p className="text-gray-600">
                Your data is safe and secure. Multi-user support with role-based access control.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100 group">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Smart Reports
              </h3>
              <p className="text-gray-600">
                Detailed sales reports, profit analysis, and inventory insights. Make data-driven decisions.
              </p>
            </div>
            </div>
          </section>

          {/* Quick Actions Section */}
          {!user && (
            <section className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-8 md:p-12 mb-16 shadow-xl" aria-labelledby="cta-heading">
              <div className="text-center text-white mb-8">
                <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold mb-4">
                  Ready to Get Started?
                </h2>
                <p className="text-lg opacity-90 max-w-2xl mx-auto">
                  Join hundreds of businesses already using our POS system. Set up takes less than 2 minutes.
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <Clock className="w-8 h-8 text-white mb-3" />
                  <h3 className="font-semibold text-white mb-2">Quick Setup</h3>
                  <p className="text-sm text-white/80">Get started in under 2 minutes</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <DollarSign className="w-8 h-8 text-white mb-3" />
                  <h3 className="font-semibold text-white mb-2">Free Forever</h3>
                  <p className="text-sm text-white/80">No credit card required</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <Package className="w-8 h-8 text-white mb-3" />
                  <h3 className="font-semibold text-white mb-2">Full Features</h3>
                  <p className="text-sm text-white/80">All features included</p>
                </div>
              </div>
              
              <div className="text-center mt-8">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-white text-emerald-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover-lift gap-2"
                  >
                    Create Free Account
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </section>
          )}

          {/* Stats Section */}
          <section aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="sr-only">Platform Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-2xl">
              <div className="text-3xl font-bold text-emerald-600 mb-2">100%</div>
              <div className="text-sm text-gray-600">Free Forever</div>
            </div>
            <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-2xl">
              <div className="text-3xl font-bold text-teal-600 mb-2">&lt;2min</div>
              <div className="text-sm text-gray-600">Setup Time</div>
            </div>
            <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-2xl">
              <div className="text-3xl font-bold text-green-600 mb-2">24/7</div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
            <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-2xl">
              <div className="text-3xl font-bold text-blue-600 mb-2">∞</div>
              <div className="text-sm text-gray-600">Unlimited Items</div>
            </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-emerald-100 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-gray-600">
                © {new Date().getFullYear()} {businessName} POS. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {user ? (
                <>
                  <Link href="/admin" className="hover:text-emerald-600 transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/pos" className="hover:text-emerald-600 transition-colors">
                    POS
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-emerald-600 transition-colors">
                    Login
                  </Link>
                  <Link href="/register" className="hover:text-emerald-600 transition-colors">
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>

      <InstallApp />
      </div>
    </>
  );
}