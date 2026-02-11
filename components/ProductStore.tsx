'use client';

import { useState } from 'react';
import { ShoppingCart, Package, Leaf, Wheat, Apple, Carrot, UtensilsCrossed, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  image: string;
  price: number;
  unit: 'kg' | 'piece' | 'bunch';
  category: 'fruits' | 'vegetables' | 'cereals' | 'herbs';
  inStock: boolean;
}

const products: Product[] = [
  // Fruits
  { id: '1', name: 'Apples', image: '/fruits/apples.avif', price: 150, unit: 'kg', category: 'fruits', inStock: true },
  { id: '2', name: 'Avocado', image: '/fruits/avocado.jpg', price: 80, unit: 'piece', category: 'fruits', inStock: true },
  { id: '3', name: 'Bananas', image: '/fruits/bananas.jpeg', price: 120, unit: 'bunch', category: 'fruits', inStock: true },
  { id: '4', name: 'Dragon Fruit', image: '/fruits/dragon fruit.jpg', price: 300, unit: 'piece', category: 'fruits', inStock: true },
  { id: '5', name: 'Lemon', image: '/fruits/lemon.avif', price: 50, unit: 'kg', category: 'fruits', inStock: true },
  { id: '6', name: 'Lime', image: '/fruits/lime.jpeg', price: 60, unit: 'kg', category: 'fruits', inStock: true },
  { id: '7', name: 'Mangoes', image: '/fruits/mangoes.avif', price: 100, unit: 'kg', category: 'fruits', inStock: true },
  { id: '8', name: 'Oranges', image: '/fruits/oranges.jpg', price: 90, unit: 'kg', category: 'fruits', inStock: true },
  { id: '9', name: 'Passion Fruit', image: '/fruits/passion fruit.webp', price: 200, unit: 'kg', category: 'fruits', inStock: true },
  { id: '10', name: 'Pawpaw', image: '/fruits/Pawpaw.webp', price: 70, unit: 'piece', category: 'fruits', inStock: true },
  { id: '11', name: 'Pineapple', image: '/fruits/pineapple.webp', price: 100, unit: 'piece', category: 'fruits', inStock: true },
  { id: '12', name: 'Watermelon', image: '/fruits/watermelon.jpg', price: 80, unit: 'kg', category: 'fruits', inStock: true },
  
  // Vegetables
  { id: '13', name: 'Broccoli', image: '/fruits/vegetables/broccoli.jpeg', price: 200, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '14', name: 'Cabbage', image: '/fruits/vegetables/cabbage.jpeg', price: 60, unit: 'piece', category: 'vegetables', inStock: true },
  { id: '15', name: 'Carrots', image: '/fruits/vegetables/carrots.jpeg', price: 120, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '16', name: 'Cauliflower', image: '/fruits/vegetables/cauliflower.jpeg', price: 150, unit: 'piece', category: 'vegetables', inStock: true },
  { id: '17', name: 'Coriander', image: '/fruits/vegetables/corriander.webp', price: 30, unit: 'bunch', category: 'herbs', inStock: true },
  { id: '18', name: 'Cucumber', image: '/fruits/vegetables/cucumber.jpeg', price: 80, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '19', name: 'Eggplant', image: '/fruits/vegetables/egg plants.jpeg', price: 100, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '20', name: 'Ginger', image: '/fruits/vegetables/ginger.webp', price: 500, unit: 'kg', category: 'herbs', inStock: true },
  { id: '21', name: 'Green Peas', image: '/fruits/vegetables/green peas.webp', price: 150, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '22', name: 'Hoho (Bell Pepper)', image: '/fruits/vegetables/hoho.jpg', price: 200, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '23', name: 'Kales (Sukuma Wiki)', image: '/fruits/vegetables/kales.jpeg', price: 40, unit: 'bunch', category: 'vegetables', inStock: true },
  { id: '24', name: 'Okra', image: '/fruits/vegetables/okra.jpeg', price: 120, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '25', name: 'Onions', image: '/fruits/vegetables/onions.avif', price: 100, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '26', name: 'Peas', image: '/fruits/vegetables/peas.webp', price: 140, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '27', name: 'Potatoes', image: '/fruits/vegetables/potatoes.avif', price: 80, unit: 'kg', category: 'vegetables', inStock: true },
  { id: '28', name: 'Sukuma Wiki', image: '/fruits/vegetables/sukuma.jpg', price: 35, unit: 'bunch', category: 'vegetables', inStock: true },
  { id: '29', name: 'Tomatoes', image: '/fruits/vegetables/tomatoes.avif', price: 110, unit: 'kg', category: 'vegetables', inStock: true },
  
  // Cereals (sample data - you can add images later)
  { id: '30', name: 'Maize', image: '/fruits/vegetables/carrots.jpeg', price: 60, unit: 'kg', category: 'cereals', inStock: true },
  { id: '31', name: 'Rice', image: '/fruits/vegetables/carrots.jpeg', price: 180, unit: 'kg', category: 'cereals', inStock: true },
  { id: '32', name: 'Wheat Flour', image: '/fruits/vegetables/carrots.jpeg', price: 120, unit: 'kg', category: 'cereals', inStock: true },
];

const categories = [
  { id: 'all', name: 'All Products', icon: Package },
  { id: 'fruits', name: 'Fruits', icon: Apple },
  { id: 'vegetables', name: 'Vegetables', icon: Carrot },
  { id: 'cereals', name: 'Cereals', icon: Wheat },
  { id: 'herbs', name: 'Herbs & Spices', icon: Leaf },
];

export function ProductStore() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const handleAddToCart = (product: Product) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-white via-emerald-50/30 to-green-50 relative overflow-hidden" aria-labelledby="store-heading">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(52,211,153,0.08),transparent)]" />
      <div className="container mx-auto px-4 relative">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 id="store-heading" className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-emerald-800 to-gray-900 bg-clip-text text-transparent mb-4">
              Fresh Products Store
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Browse our wide selection of fresh fruits, vegetables, and more
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = selectedCategory === category.id;
              const count = category.id === 'all' 
                ? products.length 
                : products.filter(p => p.category === category.id).length;

              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300',
                    'hover:scale-105 hover:shadow-lg',
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-emerald-300 hover:shadow-emerald-500/10'
                  )}
                >
                  <Icon className={cn('w-5 h-5 transition-transform', isActive && 'drop-shadow-sm')} strokeWidth={2} />
                  <span>{category.name}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold',
                    isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-[0_25px_50px_-12px_rgba(5,150,105,0.2)] transition-all duration-300 hover:-translate-y-2 border border-emerald-100/50 hover:border-emerald-200"
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {!product.inStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                        Out of Stock
                      </span>
                    </div>
                  )}
                  {product.inStock && (
                    <div className="absolute top-2 right-2 bg-emerald-500/95 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-bold shadow-md">
                      In Stock
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {product.name}
                  </h3>
                  
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <span className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        KES {product.price}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">
                        / {product.unit}
                      </span>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <Button
                    onClick={() => handleAddToCart(product)}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 gap-2"
                    disabled={!product.inStock}
                  >
                    <ShoppingCart className="w-4 h-4" strokeWidth={2} />
                    Add to Cart
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No products found in this category</p>
            </div>
          )}

          {/* Category Info */}
          {selectedCategoryData && selectedCategory !== 'all' && (
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-50 rounded-full border border-emerald-200 shadow-sm">
                {selectedCategoryData.icon && (
                  <selectedCategoryData.icon className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                )}
                <span className="text-emerald-700 font-semibold">
                  Showing {filteredProducts.length} {selectedCategoryData.name.toLowerCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Coming Soon Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl shadow-inner border border-emerald-200/30">
                <Clock className="w-12 h-12 text-emerald-600" strokeWidth={2} />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              Coming Soon!
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {selectedProduct && (
                <>
                  <p className="text-base text-gray-700 mb-2">
                    E-commerce functionality for <span className="font-semibold text-emerald-600">{selectedProduct.name}</span> is coming soon!
                  </p>
                  <p className="text-sm text-gray-500">
                    We're working hard to bring you an amazing shopping experience. Stay tuned!
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="flex items-center justify-center gap-2 py-4 bg-emerald-50 rounded-lg mb-4">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">
                This feature will be available soon
              </span>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setIsDialogOpen(false)}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
