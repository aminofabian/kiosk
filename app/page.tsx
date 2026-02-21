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
      
      <div className="min-h-screen bg-mesh-blobs">
      {/* Navigation Bar */}
      <header>
        <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-emerald-100/80 shadow-[0_4px_30px_rgba(5,150,105,0.08)]" aria-label="Main navigation">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 rounded-xl shadow-lg shadow-emerald-500/25 group-hover:scale-110 group-hover:shadow-emerald-500/40 group-hover:rotate-3 transition-all duration-300 border border-emerald-400/30">
                <ShoppingCart className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
                {businessName} POS
              </span>
            </Link>
            
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link href="/pos">
                    <Button variant="outline" size="sm" className="gap-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
                      <BarChart3 className="w-4 h-4" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/pos">
                    <Button size="sm" className="gap-2 bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 text-white" style={{ backgroundColor: '#059669' }}>
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
                    <Button size="sm" className="gap-2 bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 text-white" style={{ backgroundColor: '#059669' }}>
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
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/30 backdrop-blur-sm border border-white/30 badge-shine">
                <Zap className="w-5 h-5 drop-shadow-md animate-float-icon" strokeWidth={2.5} />
                <span className="text-sm font-bold tracking-wide">100% FREE</span>
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
                <div className="group relative hero-card-glass rounded-3xl p-8 shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(5,150,105,0.25)] transition-all duration-300 hover:-translate-y-2 border-2 border-emerald-100/50 hover:border-emerald-200/80">
                  <div className="absolute top-4 right-4">
                    <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full shadow-lg shadow-emerald-500/25 badge-shine">
                      FOR BUSINESS
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="p-6 bg-gradient-to-br from-emerald-100 via-teal-50 to-emerald-100 rounded-3xl group-hover:scale-110 transition-transform duration-300 shadow-inner border border-emerald-200/30 group-hover:shadow-emerald-200/50 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(5,150,105,0.1),transparent)]" />
                      <StoreIcon className="w-16 h-16 text-emerald-600 icon-glow-emerald relative z-10 group-hover:icon-spin-hover" strokeWidth={2} />
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
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 drop-shadow-sm" strokeWidth={2.5} />
                        <span>100% Free Forever</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 drop-shadow-sm" strokeWidth={2.5} />
                        <span>Setup in 2 minutes</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 drop-shadow-sm" strokeWidth={2.5} />
                        <span>No credit card required</span>
                      </div>
                    </div>

                    <Link href={user ? "/pos" : "/register"} className="w-full">
                      <Button
                        size="lg"
                        className="w-full bg-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 gap-2 group-hover:scale-105"
                        style={{ backgroundColor: '#059669' }}
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
                <div className="group relative hero-card-glass rounded-3xl p-8 shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(234,88,12,0.25)] transition-all duration-300 hover:-translate-y-2 border-2 border-orange-100/50 hover:border-orange-200/80">
                  <div className="absolute top-4 right-4">
                    <div className="px-3 py-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-500/25 badge-shine">
                      FOR CUSTOMERS
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="p-6 bg-gradient-to-br from-orange-100 via-amber-50 to-pink-100 rounded-3xl group-hover:scale-110 transition-transform duration-300 shadow-inner border border-orange-200/30 group-hover:shadow-orange-200/50 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(234,88,12,0.1),transparent)]" />
                      <ShoppingBag className="w-16 h-16 text-orange-600 icon-glow-orange relative z-10 group-hover:icon-spin-hover" strokeWidth={2} />
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
                        <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0" strokeWidth={2.5} />
                        <span>Fresh & Quality Products</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0" strokeWidth={2.5} />
                        <span>Competitive Prices</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0" strokeWidth={2.5} />
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
    

      {/* Content Section */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-6xl mx-auto">
          {/* Features Grid */}
          <section aria-labelledby="features-heading">
            <h2 id="features-heading" className="sr-only">Key Features</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100/80 group card-gradient-border">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-inner border border-emerald-200/30">
                <Zap className="w-7 h-7 text-emerald-600 icon-glow-emerald" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Lightning Fast
              </h3>
              <p className="text-gray-600">
                Quick checkout process designed for speed and efficiency. Process sales in seconds.
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-teal-100/80 group card-gradient-border">
              <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-teal-200 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 shadow-inner border border-teal-200/30">
                <Store className="w-7 h-7 text-teal-600" style={{ filter: 'drop-shadow(0 0 6px rgb(20 184 166 / 0.4))' }} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Easy Management
              </h3>
              <p className="text-gray-600">
                Simple inventory and category management at your fingertips. No training needed.
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-green-100/80 group card-gradient-border">
              <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-inner border border-green-200/30">
                <TrendingUp className="w-7 h-7 text-green-600" style={{ filter: 'drop-shadow(0 0 6px rgb(34 197 94 / 0.4))' }} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Real-time Updates
              </h3>
              <p className="text-gray-600">
                Track sales and inventory in real-time with live updates. Always know your numbers.
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-blue-100/80 group card-gradient-border">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 shadow-inner border border-blue-200/30">
                <Smartphone className="w-7 h-7 text-blue-600" style={{ filter: 'drop-shadow(0 0 6px rgb(59 130 246 / 0.4))' }} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Mobile Ready
              </h3>
              <p className="text-gray-600">
                Works perfectly on phones and tablets. Install as an app for instant access.
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-purple-100/80 group card-gradient-border">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-inner border border-purple-200/30">
                <Shield className="w-7 h-7 text-purple-600" style={{ filter: 'drop-shadow(0 0 6px rgb(147 51 234 / 0.4))' }} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Secure & Private
              </h3>
              <p className="text-gray-600">
                Your data is safe and secure. Multi-user support with role-based access control.
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-amber-100/80 group card-gradient-border">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-orange-200 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 shadow-inner border border-amber-200/30">
                <BarChart3 className="w-7 h-7 text-orange-600 icon-glow-orange" strokeWidth={2} />
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
            <section className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-3xl p-8 md:p-12 mb-16 shadow-xl shadow-emerald-500/25 overflow-hidden" aria-labelledby="cta-heading">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_50%)]" />
              <div className="relative text-center text-white mb-8">
                <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg">
                  Ready to Get Started?
                </h2>
                <p className="text-lg opacity-90 max-w-2xl mx-auto">
                  Join hundreds of businesses already using our POS system. Set up takes less than 2 minutes.
                </p>
              </div>
              
              <div className="relative grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/30 hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-3 mx-auto">
                    <Clock className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Quick Setup</h3>
                  <p className="text-sm text-white/80">Get started in under 2 minutes</p>
                </div>
                
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/30 hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-3 mx-auto">
                    <DollarSign className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Free Forever</h3>
                  <p className="text-sm text-white/80">No credit card required</p>
                </div>
                
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/30 hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-3 mx-auto">
                    <Package className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Full Features</h3>
                  <p className="text-sm text-white/80">All features included</p>
                </div>
              </div>
              
              <div className="relative text-center mt-8">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="bg-white text-emerald-600 hover:bg-gray-50 px-8 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 gap-2 border-2 border-white/50"
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
            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-emerald-100/60 shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 group">
              <div className="text-3xl font-bold text-emerald-600 mb-2 animate-stat-pop group-hover:scale-110 transition-transform">100%</div>
              <div className="text-sm text-gray-600 font-medium">Free Forever</div>
            </div>
            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-teal-100/60 shadow-lg hover:shadow-teal-500/10 hover:-translate-y-1 transition-all duration-300 group">
              <div className="text-3xl font-bold text-teal-600 mb-2 animate-stat-pop group-hover:scale-110 transition-transform">&lt;2min</div>
              <div className="text-sm text-gray-600 font-medium">Setup Time</div>
            </div>
            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-green-100/60 shadow-lg hover:shadow-green-500/10 hover:-translate-y-1 transition-all duration-300 group">
              <div className="text-3xl font-bold text-green-600 mb-2 animate-stat-pop group-hover:scale-110 transition-transform">24/7</div>
              <div className="text-sm text-gray-600 font-medium">Available</div>
            </div>
            <div className="text-center p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-blue-100/60 shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 group">
              <div className="text-3xl font-bold text-blue-600 mb-2 animate-stat-pop group-hover:scale-110 transition-transform">∞</div>
              <div className="text-sm text-gray-600 font-medium">Unlimited Items</div>
            </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/90 backdrop-blur-xl border-t border-emerald-100/80 mt-20 shadow-[0_-4px_30px_rgba(5,150,105,0.06)]">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                <ShoppingCart className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
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