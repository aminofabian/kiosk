import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Store, TrendingUp, Zap } from 'lucide-react';
import { InstallApp } from '@/components/InstallApp';
import { DownloadButton } from '@/components/DownloadButton';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-6">
            <div className="inline-block p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg mb-6">
              <ShoppingCart className="w-16 h-16 text-emerald-600" />
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Grocery POS
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Modern, intuitive point-of-sale system designed for grocery stores.
              Fast, efficient, and easy to use.
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
                Open POS System
              </Button>
            </Link>
            <div>
              <DownloadButton
                size="lg"
                variant="outline"
                className="bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-emerald-600 text-emerald-600 hover:text-emerald-700 font-semibold px-8 py-6 text-lg rounded-xl shadow-lg hover-lift transition-smooth"
              />
            </div>
          </div>
        </div>
      </div>
      <InstallApp />
    </div>
  );
}