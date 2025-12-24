import Link from 'next/link';
import { headers } from 'next/headers';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Store, TrendingUp, Zap } from 'lucide-react';
import { InstallApp } from '@/components/InstallApp';
import { getCurrentUser } from '@/lib/auth';

function extractBusinessNameFromDomain(hostname: string | null): string {
  const DEFAULT_DOMAIN = 'kiosk.co.ke';
  const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];
  
  if (!hostname) {
    return 'Kiosk';
  }
  
  // Remove port if present
  let domain = hostname.split(':')[0].toLowerCase();
  
  // Use default for localhost
  if (LOCALHOST_DOMAINS.includes(domain)) {
    domain = DEFAULT_DOMAIN;
  }
  
  // Extract the subdomain or main domain name
  // e.g., "kiosk.co.ke" -> "Kiosk", "shop.example.com" -> "Shop"
  const parts = domain.split('.');
  
  // Remove common TLDs
  const tlds = ['co', 'com', 'net', 'org', 'ke', 'uk', 'us', 'io'];
  const filteredParts = parts.filter(part => !tlds.includes(part));
  
  // Get the first meaningful part (usually the business name)
  const businessName = filteredParts[0] || parts[0] || 'Kiosk';
  
  // Capitalize first letter
  return businessName.charAt(0).toUpperCase() + businessName.slice(1);
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const headersList = await headers();
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host');
  const businessName = user?.businessName || extractBusinessNameFromDomain(hostname);
  
  // Creative taglines for different business types - rotate based on business name hash
  const taglines = [
    'for fruits, vegetables, and fresh produce',
    'for vendors, kiosks, and small businesses',
    'for mama mboga, dukas, and local shops',
    'for groceries, markets, and retail stores',
    'for quick sales and easy checkout',
    'for your everyday shopping needs',
    'powering local businesses across Kenya',
  ];
  
  // Use business name to consistently select a tagline (not random)
  const taglineIndex = businessName.length % taglines.length;
  const tagline = taglines[taglineIndex];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-6">
            <div className="inline-block p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg mb-6">
              <ShoppingCart className="w-16 h-16 text-emerald-600" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-lg mb-4">
              <span className="text-sm font-bold">100% FREE</span>
              <span className="text-xs opacity-90">No hidden fees • No credit card required</span>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
              {businessName} POS
            </h1>
            <p className="text-2xl font-semibold text-gray-700 max-w-3xl mx-auto mb-2">
              {tagline.charAt(0).toUpperCase() + tagline.slice(1)}
            </p>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Modern, intuitive point-of-sale system. Fast, efficient, and easy to use.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Lightning Fast
              </h3>
              <p className="text-gray-600">
                Quick checkout process designed for speed and efficiency.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                <Store className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Easy Management
              </h3>
              <p className="text-gray-600">
                Simple inventory and category management at your fingertips.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover-lift border border-emerald-100">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Real-time Updates
              </h3>
              <p className="text-gray-600">
                Track sales and inventory in real-time with live updates.
              </p>
            </div>
          </div>

          <div className="text-center space-y-4">
            <Link href="/pos">
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover-lift transition-smooth"
              >
                <ShoppingCart className="mr-2 w-5 h-5" />
                Start Free - No Credit Card Required
              </Button>
            </Link>
            <p className="text-sm text-gray-500 font-medium">
              ✓ 100% Free Forever • ✓ No Setup Fees • ✓ No Hidden Costs
            </p>
          </div>
        </div>
      </div>
      <InstallApp />
    </div>
  );
}