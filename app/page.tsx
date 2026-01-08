import Link from 'next/link';
import { headers } from 'next/headers';
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
} from 'lucide-react';
import { InstallApp } from '@/components/InstallApp';
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100 shadow-sm">
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
                    <Button size="sm" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600">
                      <ShoppingCart className="w-4 h-4" />
                      POS
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
                    <Button size="sm" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600">
                      <UserPlus className="w-4 h-4" />
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[650px] md:min-h-[750px] flex items-center justify-center py-8 md:py-12">
        <div className="container mx-auto px-4">
          {/* Background Image with Margin */}
          <div 
            className="absolute inset-4 md:inset-8 lg:inset-12 rounded-3xl bg-cover bg-center bg-no-repeat shadow-2xl"
            style={{
              backgroundImage: 'url(/images/image.webp)',
            }}
          >
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-900/85 via-teal-900/75 to-green-900/85" />
            <div className="absolute inset-0 rounded-3xl bg-black/25" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 max-w-5xl mx-auto py-12 md:py-16">
            <div className="text-center space-y-6 md:space-y-8 animate-fade-in">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-xl mb-2 animate-gentle-pulse backdrop-blur-sm border border-white/20">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-bold">100% FREE FOREVER</span>
                <span className="text-xs opacity-90">• No credit card required</span>
              </div>
              
              {/* Icon */}
              <div className="inline-block p-5 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl mb-4 hover-lift border-2 border-white/30">
                <ShoppingCart className="w-16 h-16 md:w-20 md:h-20 text-emerald-600" />
              </div>
              
              {/* Main Headline - Benefit-focused */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-3 leading-tight drop-shadow-2xl px-4">
                Grow Your Business with
                <span className="block bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                  {businessName} POS
                </span>
              </h1>
              
              {/* Subheadline - Value Proposition */}
              <p className="text-xl md:text-2xl lg:text-3xl font-bold text-white/95 max-w-3xl mx-auto mb-3 drop-shadow-lg px-4">
                {tagline.charAt(0).toUpperCase() + tagline.slice(1)}
              </p>
              
              {/* Supporting Copy */}
              <p className="text-base md:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto mb-6 drop-shadow-md px-4">
                Start selling in minutes. No setup fees, no credit card, no hidden costs. 
                <span className="block mt-1 font-semibold text-emerald-200">
                  Join hundreds of successful businesses already using our platform.
                </span>
              </p>

              {/* Social Proof */}
              <div className="flex items-center justify-center gap-2 mb-6 text-white/80">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 border-2 border-white"></div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 border-2 border-white"></div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-400 border-2 border-white"></div>
                </div>
                <span className="text-sm font-medium">
                  <span className="font-bold text-white">500+</span> businesses trust us
                </span>
              </div>

              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                <Link href={user ? "/pos" : "/register"} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:via-emerald-600 hover:to-teal-700 text-white px-10 py-7 text-lg md:text-xl font-bold rounded-2xl shadow-2xl hover-lift transition-all duration-300 gap-3 border-2 border-white/30 hover:scale-105"
                  >
                    {user ? (
                      <>
                        <ShoppingCart className="w-6 h-6" />
                        Open POS Now
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-6 h-6" />
                        Start Selling Free Today
                      </>
                    )}
                    <ArrowRight className="w-6 h-6" />
                  </Button>
                </Link>
                
                {!user && (
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto px-10 py-7 text-lg md:text-xl font-semibold rounded-2xl border-2 border-white/40 bg-white/15 backdrop-blur-md text-white hover:bg-white/25 hover:border-white/60 hover-lift transition-all duration-300 gap-3"
                    >
                      <LogIn className="w-6 h-6" />
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 pt-2">
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 shadow-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                  <span className="font-semibold text-white text-sm md:text-base">100% Free Forever</span>
                </div>
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 shadow-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                  <span className="font-semibold text-white text-sm md:text-base">Setup in 2 Minutes</span>
                </div>
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 shadow-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                  <span className="font-semibold text-white text-sm md:text-base">No Hidden Costs</span>
                </div>
              </div>

              {/* Urgency/Value Add */}
              {!user && (
                <p className="text-sm md:text-base text-emerald-200 font-medium pt-2 animate-gentle-pulse">
                  ⚡ Limited time: Get started today and unlock all premium features at no cost
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-6xl mx-auto">
          {/* Features Grid */}
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

          {/* Quick Actions Section */}
          {!user && (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-8 md:p-12 mb-16 shadow-xl">
              <div className="text-center text-white mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
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
            </div>
          )}

          {/* Stats Section */}
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
        </div>
      </section>

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
  );
}