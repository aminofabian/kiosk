"use client";

import {
  ClipboardList,
  FolderTree,
  HelpCircle,
  Layers,
  Package,
  PackageCheck,
  Scale,
  ShoppingCart,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface GuideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuideDrawer({ open, onOpenChange }: GuideDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="relative border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#1c6a1e]/10 to-blue-50 dark:from-[#1c6a1e]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5">
          <DrawerTitle className="flex items-center gap-3 pr-12 sm:pr-14 text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-[#1c6a1e] to-blue-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="leading-tight">How to Use This System</span>
          </DrawerTitle>
          <DrawerDescription className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 pr-12 sm:pr-14">
            Follow these simple steps to get started
          </DrawerDescription>
          <DrawerClose asChild>
            <button
              className="absolute top-4 right-4 sm:top-5 sm:right-6 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm touch-target"
              aria-label="Close guide"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
            </button>
          </DrawerClose>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 sm:px-6 py-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
          <div className="space-y-6 max-w-2xl">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Getting Started
              </h2>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1c6a1e] text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <FolderTree className="w-5 h-5 text-[#1c6a1e]" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Create Categories (Group Your Products!)
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Categories are broad groups that help organize what you sell!
                  Think of them like sections in a store - &quot;Fruits&quot; is
                  a category for all fruit items, &quot;Vegetables&quot; is a
                  category for all vegetable items, and &quot;Snacks&quot; is a
                  category for all snack items. This helps organize your
                  products and makes them easier to find!
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                  Example: Fruits (apples, mangoes, bananas), Vegetables
                  (tomatoes, onions, cabbages), Dairy, Snacks, Drinks
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1c6a1e] text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-[#1c6a1e]" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Add Your Products
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Now add the things you want to sell! Give each item a name
                  (like &quot;Mangoes&quot;), set a price (how much money it
                  costs), and tell the system how many you have (like &quot;50
                  pieces&quot; or &quot;20 kg&quot;).
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                  Example: Mangoes - KES 100 per kg - You have 50 kg
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Parent Items & Variants (Like a Supermarket Aisle!)
              </h2>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    What are Parent Items and Variants?
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                    Think of a supermarket aisle! The{" "}
                    <strong>Parent Item</strong> is like the aisle sign that
                    says &quot;Tomatoes&quot; - it&apos;s the main category. The{" "}
                    <strong>Variants</strong> are like all the different ways
                    you can buy tomatoes in that aisle - by the kilogram, by the
                    piece, in different sizes, etc.!
                  </p>
                  <div className="bg-white dark:bg-slate-800 rounded p-3 text-xs text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">
                      Example: Tomatoes Aisle (Parent)
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Tomatoes - Per Kg (KES 150 per kg)</li>
                      <li>Tomatoes - Per Piece (KES 10 per piece)</li>
                      <li>Tomatoes - Big Size (KES 15 per piece)</li>
                    </ul>
                    <p className="mt-2 text-blue-700 dark:text-blue-300">
                      When you tap &quot;Tomatoes&quot; on the POS screen (the
                      checkout counter), you&apos;ll see all the different ways
                      to sell tomatoes and pick the right one!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                A
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  How to Create Parent Items
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  When adding a new item, choose &quot;Parent Item&quot; mode.
                  Give it a name like &quot;Tomatoes&quot; or &quot;Eggs&quot;.
                  Parent items don&apos;t have prices or stock - they&apos;re
                  just containers!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                B
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  How to Add Variants
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  After creating a parent, add variants! Click &quot;Add
                  Item&quot; and choose &quot;Variant&quot; mode. Select the
                  parent (like &quot;Tomatoes&quot;) and give it a variant name
                  (like &quot;Per Kg&quot; or &quot;Big Size&quot;). Each
                  variant has its own price and stock!
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Using the POS (Point of Sale - Your Checkout Counter!)
              </h2>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1c6a1e] text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-5 h-5 text-[#1c6a1e]" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Open POS - Your Cashier Screen
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Click the big green &quot;Open POS&quot; button at the top!
                  This opens your checkout screen - like the cashier&apos;s
                  computer at a supermarket. When a customer brings items to
                  you, you tap on the products on the screen to add them to
                  their bill, then take their payment. It&apos;s your digital
                  cash register!
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                  Tip: If a product has variants (like different sizes),
                  you&apos;ll see a menu to pick which one the customer wants!
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Managing Your Stock (Keeping Track of Things!)
              </h2>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <PackageCheck className="w-5 h-5 text-orange-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Check Your Stock
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Click &quot;View Stock&quot; to see how many of each product
                  you have. The system automatically reduces stock when you
                  sell something, so you always know what&apos;s left!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                5
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-5 h-5 text-orange-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Add Stock (Fixing Mistakes!)
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Did something break? Spoil? Or did you count wrong? Use
                  &quot;Stock Adjustment&quot; to fix the numbers. Tell the
                  system what happened and how many items to add or remove.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                  Example: &quot;5 tomatoes spoiled&quot; → reduces stock by 5
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                6
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-5 h-5 text-orange-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Stock Take (Counting Everything!)
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Sometimes you need to count everything you have in your shop!
                  Use &quot;Stock Take&quot; to count all your products and
                  update the numbers in the system. This helps keep everything
                  accurate!
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Understanding Your Money (Profit Page!)
              </h2>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                    What is the Profit Page?
                  </h3>
                  <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-3">
                    The Profit page is like a magic calculator that tells you if
                    you&apos;re making money! It shows you three important
                    numbers:
                  </p>
                  <div className="bg-white dark:bg-slate-800 rounded p-3 text-xs space-y-2">
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        💰 Total Sales
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-300">
                        This is all the money customers gave you when they
                        bought things!
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        💸 Total Cost
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-300">
                        This is all the money you spent to buy those things from
                        suppliers!
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        🎉 Profit
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-300">
                        This is what&apos;s left! Sales minus Costs = Your
                        Profit (the money you actually made!)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                7
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  How to Use the Profit Page
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Click &quot;View Profit&quot; to see your money! You can
                  choose to see profits for &quot;Today&quot;, &quot;This
                  Week&quot;, &quot;This Month&quot;, or pick your own dates.
                  The page shows you which products made the most money, so you
                  know what to sell more of!
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                  Example: If you see &quot;Mangoes&quot; made KES 5000 profit,
                  that means selling mangoes was really good for your business!
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Quick Tips! 💡
              </h2>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
              <ul className="space-y-2 text-sm text-yellow-900 dark:text-yellow-100">
                <li className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <span>
                    Always update stock when you get new products from
                    suppliers!
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <span>
                    Check the Profit page regularly to see which products
                    customers love!
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <span>
                    Use parent items and variants when one product has
                    different sizes or ways to sell it!
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <span>
                    If stock numbers seem wrong, use Add Stock or Stock Take to
                    fix them!
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">•</span>
                  <span>
                    Remember: The system counts stock automatically when you
                    sell, but you need to add stock when you buy new items!
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
