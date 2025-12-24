'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Layers, ShoppingCart, DollarSign, Box, AlertCircle, Info, Sparkles, Grid3x3 } from 'lucide-react';
import type { Category, Item } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';
import { apiGet, apiPost, apiPut } from '@/lib/utils/api-client';
import { getShopType, shouldShowCategory, type ShopType } from '@/lib/utils/shop-type';

interface ItemWithParentFlag extends Item {
  isParent?: boolean;
}

type FormMode = 'standalone' | 'parent' | 'variant';

// Kenyan market product suggestions by category
const CATEGORY_ITEM_SUGGESTIONS: Record<string, string[]> = {
  'Vegetables': [
    'Tomatoes', 'Onions', 'Potatoes', 'Cabbage', 'Carrots', 'Hoho', 'Capsicum', 
    'Cucumber', 'Eggplant', 'Okra', 'French Beans', 'Cauliflower', 'Broccoli', 
    'Courgette', 'Butternut', 'Pumpkin', 'Sweet Potatoes', 'Beetroot', 'Celery',
    'Mushrooms', 'Garlic', 'Ginger', 'Leeks', 'Radish', 'Turnips'
  ],
  'Fruits': [
    'Bananas', 'Mangoes', 'Oranges', 'Apples', 'Avocado', 'Pineapple', 'Pawpaw',
    'Watermelon', 'Passion Fruit', 'Grapes', 'Strawberries', 'Lemons', 'Limes',
    'Tangerines', 'Coconut', 'Guava', 'Tree Tomato', 'Melons', 'Pears', 'Plums',
    'Kiwi', 'Pomegranate', 'Dragon Fruit', 'Berries', 'Peaches'
  ],
  'Grains & Cereals': [
    'Rice', 'Maize', 'Maize Flour', 'Wheat Flour', 'Flour', 'Millet', 'Sorghum',
    'Oats', 'Barley', 'Pasta', 'Spaghetti', 'Noodles', 'Chapati Flour', 
    'Ugali Flour', 'Weetabix', 'Cornflakes', 'Muesli', 'Bread Flour'
  ],
  'Spices': [
    'Salt', 'Black Pepper', 'Turmeric', 'Cumin', 'Coriander Seeds', 'Pilipili',
    'Paprika', 'Cinnamon', 'Cardamom', 'Cloves', 'Royco', 'Knorr', 'Curry Powder',
    'Mixed Spice', 'Nutmeg', 'Garam Masala', 'Thyme', 'Rosemary', 'Oregano',
    'Bay Leaves', 'Vanilla', 'Sesame Seeds'
  ],
  'Beverages': [
    'Water', 'Juice', 'Soda', 'Tea', 'Coffee', 'Milk', 'Mala', 'Yogurt Drink',
    'Energy Drink', 'Mineral Water', 'Cocoa', 'Drinking Chocolate', 'Milo',
    'Ribena', 'Lucozade', 'Afia Juice', 'Pick N Peel', 'Del Monte',
    'Soft Drinks (Coca Cola, Pepsi, Fanta, Sprite, Mirinda, Krest, Stoney)',
    'Water (Keringet, Dasani, Aquamist, Alpine, Softa)',
    'Juice (Del Monte, Afia, Pick N Peel, Ribena, Lucozade)'
  ],
  'Snacks': [
    'Chips', 'Crisps', 'Biscuits', 'Cookies', 'Crackers', 'Nuts', 'Cashew Nuts',
    'Groundnuts', 'Popcorn', 'Chocolate', 'Sweets', 'Chewing Gum', 'Cakes',
    'Chevda', 'Samosa', 'Bhajia', 'Mandazi', 'Mabuyu', 'Njugu Karanga'
  ],
  'Green Grocery': [
    'Sukuma Wiki', 'Spinach', 'Kale', 'Dhania', 'Parsley', 'Mint', 'Spring Onions',
    'Lettuce', 'Managu', 'Terere', 'Mrenda', 'Kunde', 'Saga', 'Mchicha',
    'Rosemary', 'Thyme', 'Basil', 'Arugula', 'Leeks'
  ],
  'Dairy': [
    'Milk', 'Mala', 'Yogurt', 'Cheese', 'Butter', 'Eggs', 'Cream', 'Ghee',
    'Margarine', 'Cottage Cheese', 'Mozzarella', 'Cheddar', 'Blue Band',
    'Fresh Cream', 'Sour Cream', 'Paneer'
  ],
  'Meat': [
    'Beef', 'Chicken', 'Goat', 'Lamb', 'Pork', 'Fish', 'Tilapia', 'Nile Perch',
    'Omena', 'Sausages', 'Bacon', 'Mince', 'Liver', 'Tripe', 'Oxtail', 
    'Kienyeji Chicken', 'Turkey', 'Duck', 'Prawns', 'Calamari'
  ],
  'Bakery': [
    'Bread', 'Chapati', 'Mandazi', 'Cakes', 'Buns', 'Doughnuts', 'Muffins',
    'Croissants', 'Scones', 'Samosa', 'Sausage Roll', 'Meat Pie', 'Cookies',
    'Danish', 'Swiss Roll', 'Queen Cakes', 'Mahamri', 'Naan'
  ],
  'Frozen Foods': [
    'Ice Cream', 'Frozen Chicken', 'Frozen Fish', 'Frozen Vegetables', 'French Fries',
    'Frozen Prawns', 'Frozen Samosa', 'Frozen Chapati', 'Frozen Pizza', 
    'Fish Fingers', 'Chicken Nuggets', 'Sausages', 'Frozen Chips'
  ],
  'Canned Goods': [
    'Baked Beans', 'Tuna', 'Sardines', 'Corned Beef', 'Canned Tomatoes', 
    'Tomato Paste', 'Canned Peas', 'Canned Corn', 'Canned Fruits', 'Pilchards',
    'Canned Beans', 'Coconut Milk', 'Evaporated Milk', 'Condensed Milk'
  ],
  'Legumes': [
    'Beans', 'Green Grams', 'Ndengu', 'Lentils', 'Chickpeas', 'Peas', 'Cowpeas',
    'Mbaazi', 'Groundnuts', 'Soya Beans', 'Black Beans', 'Red Kidney Beans',
    'Yellow Beans', 'Rose Coco', 'Njahi'
  ],
  'Cooking Essentials': [
    'Cooking Oil', 'Sugar', 'Salt', 'Flour', 'Rice', 'Maize Flour', 'Honey',
    'Vinegar', 'Tomato Paste', 'Soy Sauce', 'Cooking Cream', 'Baking Powder',
    'Yeast', 'Cocoa Powder', 'Custard Powder', 'Corn Starch', 'Coconut Cream'
  ],
  'Household': [
    'Detergent', 'Bleach', 'Dish Soap', 'Floor Cleaner', 'Air Freshener',
    'Toilet Cleaner', 'Matches', 'Candles', 'Charcoal', 'Firewood',
    'Bin Liners', 'Foil Paper', 'Cling Film', 'Briquettes'
  ],
  // Retail Categories (Broader)
  'Food Essentials': [
    'Sugar (Mumias, Kibos, Nzoia, Sony, Chemelil)', 'Salt (Kensalt, Krystalline, Sunrise)', 
    'Flour (Maize, Wheat, All Purpose)', 'Cooking Oil (Elianto, Golden Fry, Fresh Fri, Rina, Kasuku)',
    'Tea (Ketepa, Kericho Gold, Fahari Ya Kenya, Jambo, Melvin\'s)', 
    'Coffee (Dormans, Java, Nescafe, Mocca, Kahawa)'
  ],
  'Snacks & Confectionery': [
    'Biscuits (Marie, Digestive, Cream Crackers, Rich Tea, Hobnobs, Oreo)',
    'Candies (Cadbury, Nestle, Halls, Mentos, Tic Tac)',
    'Chocolates', 'Sweets', 'Lollipops', 'Chewing Gum'
  ],
  'Cleaning Products': [
    'Detergents (Omo, Ariel, Sunlight)', 'Soap (Sunlight, Menengai, Jamaa, White Wash, Ndume)',
    'Cleaning Supplies (Star Shine, Scotch-Brite, Sawa, Sparkle, Cleanmate)',
    'Bleach (Jik)', 'Dish Soap', 'Floor Cleaner', 'Toilet Cleaner'
  ],
  'Personal Care': [
    'Colgate Toothpaste', 'Closeup Toothpaste', 'Sensodyne', 'Aquafresh',
    'Head & Shoulders Shampoo', 'Pantene', 'Dove Soap', 'Lifebuoy Soap',
    'Vaseline', 'Nivea Lotion', 'Johnson\'s Baby', 'Pampers', 'Always'
  ],
  'Household Items': [
    'Rhino Steel Wire', 'Lion Brand Wire', 'Strong Wire', 'Power Plus Wire', 'Nyati Wire',
    'Super Bright Steel Wool', 'Shine Steel Wool', 'Star Steel Wool', 'Clean Max Steel Wool', 'Golden Wool',
    'Plastic Buckets', 'Basins', 'Brooms', 'Mops', 'Dustpans',
    'Plastic Bags (Shopping, Garbage, Bin Liners, Refuse Bags)'
  ],
  'Paper Products': [
    'Tissue Paper', 'Toilet Paper (Soft & Gentle, Kleenex, Prestige, Nice & Soft, Tender Care)',
    'Paper Towels (Kitchen Towels, Absorbent Paper, Kitchen Roll, Serviettes)',
    'Facial Tissues', 'Kitchen Towels'
  ],
  'General Merchandise': [
    'Stationery (Bic Pens, Pilot Pens, Exercise Books, Notebooks, Rulers, Erasers)',
    'Batteries (Energizer, Duracell, Eveready, Panasonic - AA, AAA, C, D, 9V)',
    'Light Bulbs (Philips, Osram, GE - LED, Energy Saving, Incandescent)',
    'Matches (Super Match, Lion Match, Safari Match, Power Match, Sunrise Match)',
    'Candles (Paraffin, Wax, Emergency, Tea Light, Pillar, Votive)'
  ],
};

// Product-specific variant suggestions - these make sense for each product type
const PRODUCT_VARIANT_SUGGESTIONS: Record<string, string[]> = {
  // ===== GRAINS & CEREALS - strains/types/sizes =====
  'Rice': ['Pishori', 'Pakistani', 'Basmati', 'Jasmine', 'Brown Rice', 'White Rice', 'Long Grain', 'Short Grain', 'Sindano', 'Nice Rice', 'Pishori (Mwea)', 'Daawat', 'Sunrise', 'Pearl', '1 Kg', '2 Kg', '5 Kg'],
  'Wheat': ['Whole Wheat', 'Refined', 'Durum', '1 Kg', '2 Kg', '5 Kg', '10 Kg'],
  'Wheat Flour': ['EXE', 'Hostess', 'Raha', 'Golden Cloud', 'Ndovu', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Flour': ['All Purpose', 'Whole Wheat', 'Self Rising', 'Bread Flour', 'Cake Flour', 'Chapati Flour', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Maize': ['White Maize', 'Yellow Maize', '1 Kg', '2 Kg', '5 Kg', '10 Kg', '90 Kg'],
  'Maize Flour': ['Sifted', 'Unsifted', '500g', '1 Kg', '2 Kg', '5 Kg', 'Jogoo', 'Pembe', 'Hostess', 'Soko', 'Raha'],
  'Ugali Flour': ['Sifted', 'Unsifted', '1 Kg', '2 Kg', '5 Kg'],
  'Oats': ['Rolled Oats', 'Instant Oats', 'Steel Cut', '500g', '1 Kg'],
  'Barley': ['Pearl Barley', 'Hulled', '500g', '1 Kg'],
  'Quinoa': ['White', 'Red', 'Black', '500g', '1 Kg'],
  'Millet': ['Finger Millet', 'Pearl Millet', '1 Kg', '2 Kg', '5 Kg'],
  'Sorghum': ['White', 'Red', '1 Kg', '2 Kg', '5 Kg'],
  'Pasta': ['Spaghetti', 'Penne', 'Macaroni', 'Fusilli', '250g', '500g', '1 Kg'],
  'Noodles': ['Instant', 'Egg Noodles', 'Rice Noodles', 'Single Pack', 'Carton'],
  
  // ===== VEGETABLES - sizes and selling units =====
  'Tomatoes': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Cherry', 'Roma', 'Beef', 'Crate'],
  'Onions': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Red', 'White', 'Bag (2 Kg)'],
  'Spring Onions': ['Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch'],
  'Potatoes': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Red', 'White', 'Bag (5 Kg)', 'Bag (10 Kg)'],
  'Sweet Potatoes': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Orange', 'White'],
  'Cabbage': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Green', 'Red'],
  'Carrots': ['Per Kg', 'Per Bunch', 'Per Piece', 'Baby Carrots', 'Regular', 'Bag (1 Kg)'],
  'Bell Peppers': ['Per Piece', 'Per Kg', 'Green', 'Red', 'Yellow', 'Orange'],
  'Capsicum': ['Per Piece', 'Per Kg', 'Green', 'Red', 'Yellow'],
  'Hoho': ['Per Piece', 'Per Kg', 'Green', 'Red', 'Yellow'],
  'Eggplant': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large'],
  'Brinjal': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large'],
  'Okra': ['Per Kg', 'Per Bunch', '100g', '250g', '500g'],
  'Cauliflower': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large'],
  'Broccoli': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large'],
  'Cucumber': ['Per Piece', 'Per Kg', 'Regular', 'English', 'Small', 'Large'],
  'Zucchini': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large', 'Green', 'Yellow'],
  'Courgette': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large'],
  'Pumpkin': ['Per Kg', 'Per Piece', 'Whole', 'Half', 'Quarter', 'Slice'],
  'Butternut': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Whole', 'Half'],
  'Squash': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large'],
  
  // ===== GREEN LEAFY VEGETABLES =====
  'Spinach': ['Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch', '250g', '500g'],
  'Kale': ['Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch'],
  'Kales': ['Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch'],
  'Sukuma Wiki': ['Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch'],
  'Sukuma': ['Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch'],
  'Lettuce': ['Per Piece', 'Per Kg', 'Iceberg', 'Romaine', 'Butterhead', 'Mixed'],
  'Coriander': ['Per Bunch', '50g', '100g', 'Small Bunch', 'Large Bunch'],
  'Dhania': ['Per Bunch', '50g', '100g', 'Small Bunch', 'Large Bunch'],
  'Parsley': ['Per Bunch', '50g', '100g', 'Flat Leaf', 'Curly'],
  'Mint': ['Per Bunch', '50g', '100g', 'Small Bunch', 'Large Bunch'],
  'Basil': ['Per Bunch', '50g', '100g', 'Sweet Basil', 'Thai Basil'],
  'Arugula': ['Per Bunch', '100g', '250g'],
  'Dill': ['Per Bunch', '50g', '100g'],
  'Chives': ['Per Bunch', '50g', '100g'],
  'Terere': ['Per Bunch', 'Small Bunch', 'Large Bunch'],
  'Managu': ['Per Bunch', 'Small Bunch', 'Large Bunch'],
  'Mrenda': ['Per Bunch', 'Small Bunch', 'Large Bunch'],
  'Kunde': ['Per Bunch', 'Small Bunch', 'Large Bunch'],
  
  // ===== FRUITS - selling units =====
  'Bananas': ['Per Piece', 'Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch', 'Ripe', 'Green', 'Cooking'],
  'Ndizi': ['Per Piece', 'Per Bunch', 'Per Kg', 'Ripe', 'Green', 'Cooking'],
  'Apples': ['Per Kg', 'Per Piece', 'Fuji', 'Gala', 'Granny Smith', 'Red Delicious', 'Green', 'Small', 'Large'],
  'Oranges': ['Per Kg', 'Per Piece', 'Navel', 'Valencia', 'Small', 'Medium', 'Large', 'Bag (6)', 'Bag (12)'],
  'Mangoes': ['Per Kg', 'Per Piece', 'Apple Mango', 'Kent', 'Tommy', 'Ngowe', 'Dodo', 'Boribo', 'Ripe', 'Raw', 'Small', 'Large'],
  'Grapes': ['Per Kg', 'Per Bunch', 'Red', 'Green', 'Black', 'Seedless', '500g'],
  'Watermelon': ['Per Kg', 'Per Piece', 'Whole', 'Half', 'Quarter', 'Slice', 'Small', 'Large'],
  'Pineapple': ['Per Piece', 'Per Kg', 'Whole', 'Peeled', 'Sliced', 'Small', 'Medium', 'Large'],
  'Papaya': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large', 'Ripe', 'Raw', 'Solo'],
  'Pawpaw': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large', 'Ripe', 'Raw'],
  'Avocado': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large', 'Hass', 'Fuerte', 'Ripe'],
  'Pears': ['Per Kg', 'Per Piece', 'Green', 'Red', 'Williams', 'Bosc'],
  'Cherries': ['Per Kg', '250g', '500g'],
  'Peaches': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Ripe'],
  'Plums': ['Per Kg', 'Per Piece', 'Red', 'Black', 'Yellow'],
  'Berries': ['Per Punnet', '125g', '250g', '500g'],
  'Strawberries': ['Per Punnet', '250g', '500g', 'Per Kg'],
  'Blueberries': ['Per Punnet', '125g', '250g'],
  'Raspberries': ['Per Punnet', '125g', '250g'],
  'Passion Fruit': ['Per Piece', 'Per Kg', 'Per Dozen', 'Purple', 'Yellow', 'Ripe'],
  'Passion': ['Per Piece', 'Per Kg', 'Per Dozen', 'Purple', 'Yellow'],
  'Melon': ['Per Kg', 'Per Piece', 'Whole', 'Half', 'Slice', 'Honeydew', 'Cantaloupe', 'Galia'],
  'Honeydew': ['Per Kg', 'Per Piece', 'Whole', 'Half', 'Slice', 'Small', 'Large'],
  'Cantaloupe': ['Per Kg', 'Per Piece', 'Whole', 'Half', 'Slice', 'Small', 'Large'],
  'Lemon': ['Per Piece', 'Per Kg', 'Per Dozen', 'Small', 'Large'],
  'Lime': ['Per Piece', 'Per Kg', 'Per Dozen'],
  'Grapefruit': ['Per Piece', 'Per Kg', 'Pink', 'White', 'Ruby Red'],
  'Tangerine': ['Per Piece', 'Per Kg', 'Per Dozen', 'Small', 'Large'],
  'Coconut': ['Per Piece', 'Young', 'Mature', 'Husked', 'Dehusked'],
  'Guava': ['Per Piece', 'Per Kg', 'White', 'Pink', 'Small', 'Large'],
  'Pomegranate': ['Per Piece', 'Per Kg', 'Small', 'Medium', 'Large'],
  'Kiwi': ['Per Piece', 'Per Kg', 'Green', 'Gold'],
  'Dragon Fruit': ['Per Piece', 'Per Kg', 'Red', 'White'],
  'Tree Tomato': ['Per Piece', 'Per Kg', 'Red', 'Yellow'],
  'Tamarillo': ['Per Piece', 'Per Kg', 'Red', 'Yellow'],
  
  // ===== SPICES & HERBS =====
  'Salt': ['500g', '1 Kg', '2 Kg', 'Table Salt', 'Sea Salt', 'Rock Salt', 'Iodized', 'Pink Himalayan', 'Kensalt', 'Krystalline', 'Sunrise Salt', 'Naturel', 'Bob'],
  'Black Pepper': ['50g', '100g', '250g', 'Ground', 'Whole', 'Peppercorns'],
  'Pepper': ['50g', '100g', '250g', 'Black', 'White', 'Ground', 'Whole'],
  'Turmeric': ['50g', '100g', '250g', 'Ground', 'Fresh Root', 'Per Piece'],
  'Cumin': ['50g', '100g', '250g', 'Ground', 'Seeds', 'Whole'],
  'Coriander Seeds': ['50g', '100g', '250g', 'Ground', 'Whole'],
  'Garlic': ['Per Piece', 'Per Kg', 'Per Bulb', 'Peeled (100g)', 'Peeled (250g)', 'Minced', 'Powder'],
  'Ginger': ['Per Piece', 'Per Kg', '100g', '250g', '500g', 'Fresh', 'Powder', 'Ground'],
  'Tangawizi': ['Per Piece', 'Per Kg', '100g', '250g', 'Fresh'],
  'Chili Powder': ['50g', '100g', '250g', 'Mild', 'Hot', 'Extra Hot'],
  'Pilipili': ['50g', '100g', 'Per Bunch', 'Fresh', 'Dried', 'Green', 'Red'],
  'Paprika': ['50g', '100g', '250g', 'Sweet', 'Smoked', 'Hot'],
  'Cinnamon': ['50g', '100g', 'Ground', 'Sticks', 'Whole'],
  'Cardamom': ['25g', '50g', '100g', 'Green', 'Black', 'Ground', 'Pods'],
  'Cloves': ['25g', '50g', '100g', 'Ground', 'Whole'],
  'Nutmeg': ['Per Piece', '50g', 'Ground', 'Whole'],
  'Curry Powder': ['50g', '100g', '250g', 'Mild', 'Hot', 'Madras'],
  'Rosemary': ['Per Bunch', '25g', '50g', 'Fresh', 'Dried'],
  'Thyme': ['Per Bunch', '25g', '50g', 'Fresh', 'Dried'],
  'Oregano': ['25g', '50g', '100g', 'Dried'],
  'Bay Leaves': ['25g', '50g', 'Pack (10)', 'Pack (25)'],
  'Royco': ['Per Cube', 'Per Packet', 'Beef', 'Chicken', 'Mchuzi Mix'],
  'Knorr': ['Per Cube', 'Per Packet', 'Beef', 'Chicken'],
  
  // ===== EGGS - quantities =====
  'Eggs': ['Per Piece', 'Half Dozen', 'Dozen', 'Tray (30)', 'Kienyeji', 'Grade A', 'Grade B', 'Free Range', 'Organic', 'Kenchic Eggs', 'Muguku Poultry', 'Isinya Feeds', 'Sigma Feeds', 'Farmers\' Choice Eggs'],
  
  // ===== DAIRY - sizes/volumes =====
  'Milk': ['250ml', '500ml', '1 Litre', '2 Litre', '5 Litre', 'Fresh', 'UHT', 'Full Cream', 'Skimmed', 'Semi-Skimmed', 'Maziwa Lala', 'Brookside', 'New KCC', 'Tuzo', 'Daima', 'Molo Milk'],
  'Long-Life Milk': ['250ml', '500ml', '1 Litre', '2 Litre', 'Brookside', 'New KCC', 'Tuzo', 'Daima', 'Molo Milk'],
  'Yogurt': ['150ml', '250ml', '500ml', '1 Litre', 'Plain', 'Vanilla', 'Strawberry', 'Mixed Fruit', 'Greek'],
  'Yogurt Drink': ['250ml', '500ml', '1 Litre'],
  'Mala': ['250ml', '500ml', '1 Litre', '2 Litre'],
  'Cheese': ['100g', '200g', '250g', '500g', '1 Kg', 'Cheddar', 'Mozzarella', 'Parmesan', 'Sliced', 'Block', 'Grated'],
  'Butter': ['100g', '250g', '500g', 'Salted', 'Unsalted', 'Margarine'],
  'Cream': ['250ml', '500ml', 'Fresh', 'Whipping', 'Double', 'Single'],
  'Sour Cream': ['250ml', '500ml'],
  'Cottage Cheese': ['250g', '500g'],
  'Mozzarella': ['200g', '250g', '500g', 'Fresh', 'Block', 'Shredded'],
  'Ghee': ['250g', '500g', '1 Kg', 'Pure'],
  
  // ===== BEANS & LEGUMES - types =====
  'Beans': ['Red Kidney', 'Black', 'White', 'Pinto', 'Navy', 'Rose Coco', 'Yellow', 'Mwitemania', '500g', '1 Kg', '2 Kg'],
  'Green Grams': ['Per Kg', '500g', '1 Kg', '2 Kg', 'Ndengu', 'Whole', 'Split'],
  'Ndengu': ['Per Kg', '500g', '1 Kg', '2 Kg', 'Whole', 'Split'],
  'Lentils': ['Per Kg', '500g', '1 Kg', 'Red', 'Green', 'Brown', 'Black'],
  'Chickpeas': ['Per Kg', '500g', '1 Kg', 'Dried', 'Canned'],
  'Peas': ['Per Kg', '500g', '1 Kg', 'Green', 'Yellow', 'Split', 'Dried'],
  'Cowpeas': ['Per Kg', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Pigeon Peas': ['Per Kg', '500g', '1 Kg', '2 Kg', 'Fresh', 'Dried'],
  'Mbaazi': ['Per Kg', '500g', '1 Kg', '2 Kg', 'Fresh', 'Dried'],
  'Yellow Beans': ['Per Kg', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Rose Coco': ['Per Kg', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Red Kidney Beans': ['Per Kg', '500g', '1 Kg', '2 Kg'],
  'Black Beans': ['Per Kg', '500g', '1 Kg', '2 Kg'],
  'Groundnuts': ['Per Kg', '250g', '500g', 'Raw', 'Roasted', 'Salted'],
  'Peanuts': ['Per Kg', '250g', '500g', 'Raw', 'Roasted', 'Salted', 'Shelled'],
  
  // ===== MEAT - cuts and sizes =====
  'Beef': ['Per Kg', '500g', '1 Kg', 'Mince', 'Steak', 'Ribs', 'Stew Meat', 'Fillet', 'Brisket', 'Oxtail', 'Liver', 'Tripe'],
  'Chicken': ['Per Kg', 'Whole', 'Half', 'Quarter', 'Wings', 'Drumsticks', 'Breast', 'Thighs', 'Kienyeji', 'Broiler', 'Per Piece'],
  'Fish': ['Per Kg', 'Per Piece', 'Whole', 'Fillet', 'Tilapia', 'Nile Perch', 'Omena', 'Sardines', 'Tuna', 'Salmon', 'Ngege'],
  'Tilapia': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Whole', 'Fillet'],
  'Pork': ['Per Kg', '500g', 'Chops', 'Ribs', 'Belly', 'Shoulder', 'Mince', 'Sausages'],
  'Lamb': ['Per Kg', '500g', 'Chops', 'Leg', 'Shoulder', 'Ribs', 'Mince'],
  'Goat': ['Per Kg', '500g', 'Ribs', 'Leg', 'Shoulder', 'Mince', 'Whole'],
  'Turkey': ['Per Kg', 'Whole', 'Half', 'Breast', 'Drumsticks', 'Mince'],
  'Bacon': ['200g', '250g', '500g', 'Streaky', 'Back', 'Smoked'],
  'Sausages': ['Per Kg', '500g', 'Beef', 'Pork', 'Chicken', 'Pack (6)', 'Pack (12)'],
  'Ham': ['100g', '200g', '500g', 'Sliced', 'Smoked', 'Honey Glazed'],
  'Mince': ['Per Kg', '500g', 'Beef', 'Chicken', 'Pork', 'Lamb'],
  
  // ===== BEVERAGES - sizes =====
  'Water': ['250ml', '500ml', '1 Litre', '1.5 Litre', '5 Litre', '10 Litre', '20 Litre', 'Still', 'Sparkling', 'Keringet', 'Dasani', 'Aquamist', 'Alpine', 'Softa'],
  'Mineral Water': ['250ml', '500ml', '1 Litre', '1.5 Litre', '5 Litre', 'Keringet', 'Dasani', 'Aquamist', 'Alpine', 'Softa'],
  'Bottled Water': ['250ml', '500ml', '1 Litre', '1.5 Litre', '5 Litre', 'Keringet', 'Dasani', 'Aquamist', 'Alpine', 'Softa'],
  'Juice': ['250ml', '500ml', '1 Litre', '2 Litre', 'Orange', 'Mango', 'Apple', 'Mixed Fruit', 'Tropical', 'Fresh', 'Del Monte', 'Afia', 'Pick N Peel', 'Ribena', 'Lucozade'],
  'Del Monte Juice': ['250ml', '500ml', '1 Litre', 'Orange', 'Mango', 'Pineapple', 'Mixed Fruit'],
  'Afia Juice': ['250ml', '500ml', '1 Litre', 'Orange', 'Mango', 'Passion'],
  'Pick N Peel': ['250ml', '500ml', '1 Litre', 'Orange', 'Mango', 'Mixed Fruit'],
  'Soda': ['300ml', '350ml', '500ml', '1 Litre', '1.5 Litre', '2 Litre', 'Coke', 'Fanta', 'Sprite', 'Pepsi', 'Krest', 'Stoney', 'Mirinda', 'Mountain Dew', '7Up'],
  'Soft Drink': ['300ml', '500ml', '1 Litre', '2 Litre', 'Coca Cola', 'Pepsi', 'Fanta', 'Sprite', 'Mirinda'],
  'Soft Drinks': ['300ml', '350ml', '500ml', '1 Litre', '1.5 Litre', '2 Litre', 'Coca Cola', 'Pepsi', 'Fanta', 'Sprite', 'Mirinda', 'Krest', 'Stoney', 'Mountain Dew', '7Up'],
  'Coca Cola': ['300ml', '350ml', '500ml', '1 Litre', '1.5 Litre', '2 Litre', 'Coke', 'Diet Coke', 'Zero'],
  'Pepsi': ['300ml', '350ml', '500ml', '1 Litre', '1.5 Litre', '2 Litre', 'Regular', 'Diet', 'Max'],
  'Fanta': ['300ml', '350ml', '500ml', '1 Litre', '1.5 Litre', '2 Litre', 'Orange', 'Grape', 'Pineapple'],
  'Energy Drink': ['250ml', '350ml', '500ml', 'Red Bull', 'Monster', 'Power Horse'],
  'Tea': ['50g', '100g', '250g', '500g', 'Tea Bags (25)', 'Tea Bags (50)', 'Tea Bags (100)', 'Green Tea', 'Black Tea', 'Herbal', 'Ketepa', 'Kericho Gold', 'Fahari Ya Kenya', 'Jambo Tea', 'Melvin\'s'],
  'Tea Leaves': ['50g', '100g', '250g', '500g', 'Ketepa', 'Kericho Gold', 'Fahari Ya Kenya', 'Jambo Tea', 'Melvin\'s'],
  'Coffee': ['50g', '100g', '250g', '500g', 'Instant', 'Ground', 'Beans', 'Decaf', 'Sachets (10)', 'Sachets (25)', 'Dormans', 'Java', 'Nescafe', 'Mocca', 'Kahawa'],
  'Dormans Coffee': ['50g', '100g', '250g', '500g', 'Instant', 'Ground', 'Beans'],
  'Java Coffee': ['50g', '100g', '250g', '500g', 'Ground', 'Beans'],
  'Nescafe': ['50g', '100g', '200g', 'Instant', 'Classic', 'Gold', 'Sachets (10)', 'Sachets (25)'],
  
  // ===== BAKERY =====
  'Bread': ['White', 'Brown', 'Whole Wheat', 'Sliced', 'Unsliced', '400g', '600g', '800g', 'Small', 'Large', 'Blue Band Bread', 'Super Loaf', 'Festive', 'Broadways', 'Mini Baker'],
  'White Bread': ['400g', '600g', '800g', 'Sliced', 'Unsliced'],
  'Brown Bread': ['400g', '600g', '800g', 'Sliced', 'Unsliced'],
  'Baguette': ['Per Piece', 'Small', 'Large', 'French'],
  'Croissant': ['Per Piece', 'Plain', 'Butter', 'Chocolate', 'Almond', 'Pack (4)', 'Pack (6)'],
  'Donuts': ['Per Piece', 'Glazed', 'Chocolate', 'Sugar', 'Pack (6)', 'Pack (12)'],
  'Muffins': ['Per Piece', 'Blueberry', 'Chocolate', 'Banana', 'Pack (4)', 'Pack (6)'],
  'Cookies': ['Per Piece', '100g', '200g', '500g', 'Chocolate Chip', 'Butter', 'Oatmeal', 'Pack (6)', 'Pack (12)'],
  'Cakes': ['Per Piece', 'Slice', 'Whole', 'Small', 'Medium', 'Large', 'Chocolate', 'Vanilla', 'Fruit'],
  'Pastries': ['Per Piece', 'Danish', 'Puff', 'Savory', 'Sweet'],
  'Chapati': ['Per Piece', 'Small', 'Large', 'Pack (5)', 'Pack (10)'],
  'Mandazi': ['Per Piece', 'Small', 'Large', 'Pack (6)', 'Pack (12)'],
  
  // ===== SNACKS =====
  'Chips': ['50g', '100g', '150g', '200g', 'Family Pack', 'Ready Salted', 'Salt & Vinegar', 'BBQ', 'Cheese'],
  'Crisps': ['50g', '100g', '150g', '200g', 'Family Pack'],
  'Biscuits': ['100g', '200g', '400g', 'Per Packet', 'Cream', 'Chocolate', 'Digestive', 'Marie', 'Rich Tea', 'Ginger Nuts', 'Hobnobs', 'Oreo', 'Custard Creams', 'Shortbread'],
  'Marie Biscuits': ['100g', '200g', '400g', 'Per Packet', 'Pack (12)', 'Pack (24)'],
  'Digestive Biscuits': ['100g', '200g', '400g', 'Per Packet', 'Plain', 'Chocolate'],
  'Cream Crackers': ['100g', '200g', '400g', 'Per Packet', 'Pack (12)', 'Pack (24)'],
  'Crackers': ['100g', '200g', '300g', 'Salted', 'Plain', 'Whole Wheat'],
  'Nuts': ['100g', '250g', '500g', 'Mixed', 'Cashews', 'Almonds', 'Peanuts', 'Roasted', 'Salted'],
  'Cashew Nuts': ['100g', '250g', '500g', 'Raw', 'Roasted', 'Salted'],
  'Almonds': ['100g', '250g', '500g', 'Raw', 'Roasted', 'Sliced'],
  'Popcorn': ['50g', '100g', '200g', 'Salted', 'Sweet', 'Butter', 'Caramel'],
  'Chocolate': ['50g', '100g', '200g', 'Milk', 'Dark', 'White', 'With Nuts', 'Bar', 'Block'],
  'Candy': ['Per Piece', '100g', '250g', '500g', 'Hard', 'Soft', 'Chewy', 'Cadbury', 'Nestle', 'Halls', 'Mentos', 'Tic Tac'],
  'Sweets': ['Per Piece', '100g', '250g', 'Mixed', 'Fruit', 'Mint', 'Cadbury', 'Nestle'],
  'Chocolates': ['50g', '100g', '200g', 'Milk', 'Dark', 'White', 'With Nuts', 'Cadbury', 'Nestle', 'Bar', 'Block'],
  'Chewing Gum': ['Per Piece', 'Pack (5)', 'Pack (10)', 'Halls', 'Mentos', 'Tic Tac'],
  
  // ===== COOKING ESSENTIALS =====
  'Cooking Oil': ['500ml', '1 Litre', '2 Litre', '3 Litre', '5 Litre', '10 Litre', '20 Litre', 'Sunflower', 'Vegetable', 'Corn', 'Elianto', 'Golden Fry', 'Fresh Fri', 'Rina', 'Kasuku'],
  'Vegetable Oil': ['500ml', '1 Litre', '2 Litre', '3 Litre', '5 Litre', 'Elianto', 'Golden Fry', 'Fresh Fri', 'Rina', 'Kasuku'],
  'Oil': ['500ml', '1 Litre', '2 Litre', '5 Litre', 'Sunflower', 'Vegetable', 'Olive', 'Coconut', 'Corn'],
  'Olive Oil': ['250ml', '500ml', '1 Litre', 'Extra Virgin', 'Virgin', 'Regular'],
  'Coconut Oil': ['250ml', '500ml', '1 Litre', 'Virgin', 'Refined'],
  'Sugar': ['500g', '1 Kg', '2 Kg', '5 Kg', 'White', 'Brown', 'Icing', 'Caster', 'Mumias', 'Kibos', 'Nzoia', 'Sony', 'Chemelil'],
  'Honey': ['250g', '500g', '1 Kg', 'Pure', 'Raw', 'Local', 'Imported'],
  'Vinegar': ['250ml', '500ml', '1 Litre', 'White', 'Apple Cider', 'Balsamic'],
  'Soy Sauce': ['150ml', '250ml', '500ml', 'Light', 'Dark'],
  'Tomato Paste': ['70g', '140g', '400g', '800g'],
  'Tomato Sauce': ['250ml', '500ml', '1 Litre', 'Ketchup'],
  'Cooking Cream': ['250ml', '500ml'],
  
  // ===== FROZEN FOODS =====
  'Ice Cream': ['250ml', '500ml', '1 Litre', '2 Litre', 'Vanilla', 'Chocolate', 'Strawberry', 'Mixed'],
  'Frozen Vegetables': ['250g', '500g', '1 Kg', 'Mixed', 'Peas', 'Corn', 'Green Beans'],
  'Frozen Fruits': ['250g', '500g', 'Mixed Berries', 'Mango', 'Pineapple'],
  'Frozen Meat': ['500g', '1 Kg', 'Chicken', 'Beef', 'Fish'],
  'Frozen Fish': ['500g', '1 Kg', 'Tilapia', 'Salmon', 'Prawns'],
  'Frozen Pizza': ['Per Piece', 'Small', 'Medium', 'Large', 'Margherita', 'Pepperoni'],
  'French Fries': ['500g', '1 Kg', '2.5 Kg', 'Regular', 'Crinkle Cut', 'Wedges'],
  
  // ===== CANNED GOODS =====
  'Canned Tomatoes': ['400g', '800g', 'Whole', 'Chopped', 'Crushed'],
  'Canned Beans': ['400g', '800g', 'Baked Beans', 'Red Kidney', 'Black Beans'],
  'Canned Corn': ['200g', '400g', 'Sweet Corn', 'Creamed'],
  'Canned Peas': ['200g', '400g'],
  'Canned Fish': ['150g', '200g', '400g', 'Tuna', 'Sardines', 'Mackerel', 'Salmon'],
  'Canned Fruits': ['400g', '800g', 'Peaches', 'Pineapple', 'Mixed Fruit', 'Pears'],
  'Corned Beef': ['200g', '340g'],
  'Baked Beans': ['200g', '400g', '800g'],
  'Tuna': ['150g', '185g', '400g', 'In Oil', 'In Water', 'In Brine', 'Chunks', 'Flakes'],
  'Sardines': ['125g', '155g', 'In Oil', 'In Tomato Sauce', 'In Water'],
  'Pilchards': ['155g', '400g', 'In Tomato Sauce', 'In Chili'],
  'Coconut Milk': ['200ml', '400ml', 'Light', 'Regular'],
  'Evaporated Milk': ['170g', '400g'],
  'Condensed Milk': ['200g', '400g', 'Sweetened'],
  
  // ===== LEGUMES (Kenyan Market) =====
  'Njahi': ['Per Kg', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Soya Beans': ['Per Kg', '500g', '1 Kg', '2 Kg'],
  'Mwitemania': ['Per Kg', '500g', '1 Kg', '2 Kg'],
  
  // ===== PERSONAL CARE =====
  'Soap': ['Per Piece', 'Pack (3)', 'Pack (6)', 'Bar', 'Liquid', 'Antibacterial', 'Sunlight', 'Menengai', 'Jamaa', 'White Wash', 'Ndume'],
  'Multi-Purpose Bar Soap': ['Sunlight', 'Menengai', 'Jamaa', 'White Wash', 'Ndume', 'Per Bar', '100g', '150g', '200g', '250g'],
  'Toothpaste': ['50ml', '75ml', '100ml', '150ml', 'Colgate', 'Closeup', 'Aquafresh', 'Sensodyne', 'Crest', 'Oral-B'],
  'Shampoo': ['100ml', '200ml', '400ml', '1 Litre', 'Anti-Dandruff', 'Regular', 'Herbal', 'Head & Shoulders', 'Pantene', 'Dove', 'Tresemme'],
  'Lotion': ['100ml', '200ml', '400ml', '1 Litre', 'Body', 'Hand', 'Moisturizing', 'Nivea', 'Vaseline', 'Johnson\'s Baby'],
  'Deodorant': ['50ml', '100ml', '150ml', 'Roll On', 'Spray', 'Stick', 'Rexona', 'Dove', 'Nivea', 'Axe'],
  'Personal Care': ['Soap', 'Toothpaste', 'Shampoo', 'Lotion', 'Deodorant', 'Tissue Paper', 'Sanitary Pads', 'Diapers', 'Cotton Wool', 'Vaseline'],
  'Tissue Paper': ['Single Roll', 'Pack (4)', 'Pack (6)', 'Pack (12)', 'Toilet', 'Facial', 'Soft & Gentle', 'Kleenex', 'Prestige', 'Nice & Soft', 'Tender Care'],
  'Toilet Paper': ['Single Roll', 'Pack (4)', 'Pack (6)', 'Pack (12)', '2-Ply', '3-Ply', '4-Ply', 'Soft & Gentle', 'Kleenex', 'Prestige', 'Nice & Soft', 'Tender Care'],
  'Paper Towels': ['Single Roll', 'Pack (2)', 'Pack (4)', 'Pack (6)', 'Kitchen Towels', 'Absorbent Paper', 'Kitchen Roll', 'Serviettes'],
  'Sanitary Pads': ['Pack (8)', 'Pack (10)', 'Pack (16)', 'Regular', 'Overnight', 'Panty Liners', 'Always', 'Kotex', 'Stayfree'],
  'Diapers': ['Small', 'Medium', 'Large', 'Extra Large', 'Pack (10)', 'Pack (20)', 'Pack (40)', 'Jumbo', 'Pampers', 'Huggies', 'Molfix'],
  'Cotton Wool': ['50g', '100g', '200g', '500g', 'Sterile', 'Non-Sterile'],
  'Vaseline': ['50g', '100g', '250g', '500g', 'Pure', 'Blue Seal', 'Cocoa Butter', 'Aloe Vera', 'Total Moisture'],
  'Hair Oil': ['50ml', '100ml', '200ml', 'Coconut', 'Olive', 'Argan'],
  'Shower Gel': ['250ml', '500ml', '1 Litre'],
  'Hand Sanitizer': ['50ml', '100ml', '250ml', '500ml', '1 Litre'],
  'Face Cream': ['25ml', '50ml', '100ml', 'Day', 'Night', 'Moisturizing'],
  'Body Cream': ['100ml', '200ml', '400ml', '1 Litre'],
  
  // ===== HOUSEHOLD =====
  'Detergent': ['500g', '1 Kg', '2 Kg', '5 Kg', 'Powder', 'Liquid', 'Omo', 'Ariel', 'Sunlight', 'Persil', 'Tide'],
  'Sponge & Scrub': ['Star Shine', 'Scotch-Brite', 'Sawa', 'Sparkle', 'Cleanmate', 'Per Piece', 'Pack (2)', 'Pack (3)', 'Scrub Pads', 'Dish Sponges'],
  'Cleaning Supplies': ['Star Shine Sponge', 'Scotch-Brite Sponge', 'Sawa Sponge', 'Sparkle Sponge', 'Cleanmate Sponge', 'Scrub Pads', 'Dish Sponges', 'Cleaning Cloths', 'Scrub Brushes', 'Steel Wool'],
  'Steel Wire': ['Rhino', 'Lion Brand', 'Strong Wire', 'Power Plus', 'Nyati', 'Per Roll', 'Per Meter', '50m', '100m'],
  'Steel Wool': ['Super Bright', 'Shine', 'Star Steel', 'Clean Max', 'Golden Wool', 'Per Pack', 'Fine', 'Coarse', 'Extra Fine', 'Medium'],
  'Household Items': ['Rhino Steel Wire', 'Lion Brand Wire', 'Strong Wire', 'Power Plus Wire', 'Nyati Wire', 'Super Bright Steel Wool', 'Shine Steel Wool', 'Star Steel Wool', 'Clean Max Steel Wool', 'Golden Wool', 'Plastic Buckets', 'Basins', 'Brooms', 'Mops', 'Dustpans'],
  'Bleach': ['250ml', '500ml', '1 Litre', '5 Litre', 'Jik', 'Regular', 'Thick'],
  'Dish Soap': ['250ml', '500ml', '1 Litre', 'Liquid', 'Bar'],
  'Floor Cleaner': ['500ml', '1 Litre', '5 Litre', 'Tile', 'Wood', 'Multi-Surface'],
  'Air Freshener': ['250ml', '300ml', 'Spray', 'Gel', 'Automatic'],
  'Toilet Cleaner': ['500ml', '750ml', '1 Litre', 'Harpic', 'Liquid', 'Block'],
  'Matches': ['Small Box', 'Large Box', 'Pack (10)', 'Pack (20)', 'Super Match', 'Lion Match', 'Safari Match', 'Power Match', 'Sunrise Match'],
  'Matchboxes': ['Super Match', 'Lion Match', 'Safari Match', 'Power Match', 'Sunrise Match', 'Small Box', 'Large Box', 'Pack (10)', 'Pack (20)'],
  'Candles': ['Per Piece', 'Pack (6)', 'Pack (12)', 'White', 'Colored', 'Emergency', 'Paraffin Candles', 'Wax Candles', 'Tea Light Candles', 'Pillar Candles', 'Votive Candles', 'Birthday Candles', 'Church Candles'],
  'Plastic Bags': ['Shopping Bags', 'Garbage Bags', 'Bin Liners', 'Refuse Bags', 'Carrier Bags', 'Polythene Bags', 'Ziploc Bags', 'Freezer Bags', 'Small', 'Medium', 'Large', 'Extra Large'],
  'Charcoal': ['Per Kg', '5 Kg', '10 Kg', '20 Kg', 'Bag (Small)', 'Bag (Large)'],
  'Firewood': ['Per Piece', 'Per Bundle', 'Small Bundle', 'Large Bundle'],
  'Bin Liners': ['Pack (10)', 'Pack (20)', 'Pack (50)', 'Small', 'Medium', 'Large'],
  'Foil Paper': ['5m', '10m', '20m', 'Roll'],
  'Cling Film': ['30m', '50m', '100m', 'Roll'],
  'Briquettes': ['Per Kg', '5 Kg', '10 Kg'],
  
  // ===== STATIONERY =====
  'Stationery': ['Bic Pens', 'Pilot Pens', 'Reynolds Pens', 'Staedtler Pencils', 'HB Pencils', 'Exercise Books', 'Notebooks', 'Rulers', 'Erasers', 'Sharpeners', 'Staplers', 'Paper Clips', 'Rubber Bands', 'Glue Sticks', 'Markers'],
  'Pens': ['Bic', 'Pilot', 'Reynolds', 'Blue', 'Black', 'Red', 'Pack (2)', 'Pack (5)', 'Pack (10)'],
  'Pencils': ['Staedtler', 'HB', '2B', '4B', 'Pack (2)', 'Pack (5)', 'Pack (12)'],
  'Exercise Books': ['40 Pages', '60 Pages', '80 Pages', '96 Pages', 'Single Line', 'Double Line', 'Squared'],
  'Notebooks': ['A4', 'A5', 'A6', 'Spiral', 'Hard Cover', 'Soft Cover'],
  'Rulers': ['15cm', '30cm', '50cm', 'Plastic', 'Metal', 'Wooden'],
  'Erasers': ['Per Piece', 'Pack (2)', 'Pack (5)', 'White', 'Colored'],
  'Sharpeners': ['Single Hole', 'Double Hole', 'Plastic', 'Metal'],
  'Staplers': ['Mini', 'Standard', 'Heavy Duty'],
  'Paper Clips': ['Small', 'Medium', 'Large', 'Pack (100)', 'Pack (500)'],
  'Rubber Bands': ['Small', 'Medium', 'Large', 'Pack (100)', 'Pack (500)'],
  'Glue Sticks': ['10g', '20g', '40g', 'UHU', 'Pritt'],
  'Markers': ['Fine Tip', 'Broad Tip', 'Permanent', 'Washable', 'Pack (4)', 'Pack (8)'],
  
  // ===== BATTERIES =====
  'Batteries': ['Energizer', 'Duracell', 'Eveready', 'Panasonic', 'AA', 'AAA', 'C', 'D', '9V', 'Pack (2)', 'Pack (4)', 'Pack (8)'],
  'Energizer Batteries': ['AA', 'AAA', 'C', 'D', '9V', 'Pack (2)', 'Pack (4)', 'Pack (8)'],
  'Duracell Batteries': ['AA', 'AAA', 'C', 'D', '9V', 'Pack (2)', 'Pack (4)', 'Pack (8)'],
  'Eveready Batteries': ['AA', 'AAA', 'C', 'D', '9V', 'Pack (2)', 'Pack (4)', 'Pack (8)'],
  'Panasonic Batteries': ['AA', 'AAA', 'C', 'D', '9V', 'Pack (2)', 'Pack (4)'],
  'AA Batteries': ['Energizer', 'Duracell', 'Eveready', 'Panasonic', 'Pack (2)', 'Pack (4)', 'Pack (8)'],
  'AAA Batteries': ['Energizer', 'Duracell', 'Eveready', 'Panasonic', 'Pack (2)', 'Pack (4)', 'Pack (8)'],
  
  // ===== LIGHT BULBS =====
  'Light Bulbs': ['Philips', 'Osram', 'GE', 'LED', 'Energy Saving', 'Incandescent', 'Fluorescent', 'Halogen', 'CFL', '5W', '7W', '9W', '11W', '15W', '20W', '40W', '60W', '100W'],
  'Philips Bulbs': ['LED', 'Energy Saving', 'Incandescent', '5W', '7W', '9W', '11W', '15W', '20W', '40W', '60W', '100W'],
  'Osram Bulbs': ['LED', 'Energy Saving', 'Incandescent', '5W', '7W', '9W', '11W', '15W', '20W', '40W', '60W', '100W'],
  'GE Bulbs': ['LED', 'Energy Saving', 'Incandescent', '5W', '7W', '9W', '11W', '15W', '20W', '40W', '60W', '100W'],
  'LED Bulbs': ['5W', '7W', '9W', '11W', '15W', '20W', '40W', '60W', '100W', 'Warm White', 'Cool White', 'Daylight'],
  'Energy Saving Bulbs': ['5W', '7W', '9W', '11W', '15W', '20W', '40W', '60W', 'Warm White', 'Cool White'],
  'Incandescent Bulbs': ['40W', '60W', '100W', 'Clear', 'Frosted'],
  'Fluorescent Bulbs': ['T5', 'T8', 'T12', '18W', '36W', '58W'],
  'Halogen Bulbs': ['20W', '35W', '50W', '100W'],
  'CFL Bulbs': ['5W', '7W', '9W', '11W', '15W', '20W', 'Warm White', 'Cool White'],
  
  // ===== MORE COOKING ESSENTIALS =====
  'Baking Powder': ['50g', '100g', '250g', '500g'],
  'Yeast': ['Per Packet', '50g', '100g', 'Instant', 'Active Dry'],
  'Cocoa Powder': ['50g', '100g', '250g', '500g'],
  'Custard Powder': ['100g', '250g', '500g'],
  'Corn Starch': ['100g', '250g', '500g'],
  'Coconut Cream': ['200ml', '400ml', 'Light', 'Regular'],
  'Weetabix': ['Pack (12)', 'Pack (24)', 'Pack (48)'],
  'Cornflakes': ['250g', '500g', '750g', '1 Kg'],
  'Muesli': ['250g', '500g', '750g', 'Original', 'Fruit & Nut'],
  
  // ===== KENYAN SNACKS =====
  'Samosa': ['Per Piece', 'Pack (6)', 'Pack (12)', 'Beef', 'Chicken', 'Vegetable'],
  'Bhajia': ['Per Piece', 'Per Portion', 'Small', 'Large'],
  'Mabuyu': ['50g', '100g', '250g', 'Per Packet'],
  'Njugu Karanga': ['50g', '100g', '250g', '500g', 'Roasted', 'Salted', 'Coated'],
  'Chevda': ['100g', '250g', '500g', 'Per Packet'],
  
  // ===== KENYAN BAKERY =====
  'Buns': ['Per Piece', 'Pack (6)', 'Pack (12)', 'Plain', 'Coconut', 'Raisin'],
  'Scones': ['Per Piece', 'Pack (6)', 'Plain', 'Raisin', 'Cheese'],
  'Sausage Roll': ['Per Piece', 'Pack (6)', 'Beef', 'Chicken'],
  'Meat Pie': ['Per Piece', 'Pack (4)', 'Beef', 'Chicken'],
  'Swiss Roll': ['Per Piece', 'Whole', 'Slice', 'Chocolate', 'Vanilla', 'Strawberry'],
  'Queen Cakes': ['Per Piece', 'Pack (6)', 'Pack (12)'],
  'Mahamri': ['Per Piece', 'Pack (6)', 'Pack (12)'],
  'Naan': ['Per Piece', 'Plain', 'Garlic', 'Butter'],
  'Doughnuts': ['Per Piece', 'Pack (6)', 'Glazed', 'Sugar', 'Chocolate'],
  
  // ===== KENYAN BEVERAGES =====
  'Milo': ['100g', '200g', '400g', '1 Kg', 'Sachet'],
  'Drinking Chocolate': ['100g', '250g', '500g'],
  'Cocoa': ['100g', '250g', '500g', 'Pure', 'Sweetened'],
  'Ribena': ['250ml', '500ml', '1 Litre', 'Concentrate'],
  'Lucozade': ['250ml', '380ml', '500ml', 'Orange', 'Original'],
  // ===== MORE KENYAN PRODUCE =====
  'Nduma': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large'],
  'Arrow Roots': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large'],
  'Cassava': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Fresh', 'Dried'],
  'Yams': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large'],
  'Plantain': ['Per Piece', 'Per Bunch', 'Per Kg', 'Ripe', 'Green'],
  'Matoke': ['Per Piece', 'Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch'],
  'Mukimo': ['Per Portion', 'Small', 'Medium', 'Large'],
  'Ugali': ['Per Portion', 'Small', 'Medium', 'Large'],
  
  // ===== KENYAN DAIRY =====
  'Blue Band': ['100g', '250g', '500g', '1 Kg', 'Original', 'Low Fat'],
  'Margarine': ['100g', '250g', '500g', '1 Kg'],
  'Paneer': ['200g', '400g', 'Fresh'],
  
  // ===== MORE KENYAN VEGETABLES =====
  'Mushrooms': ['Per Punnet', 'Per Kg', '200g', '250g', 'Button', 'Oyster', 'Shiitake'],
  'Celery': ['Per Bunch', 'Per Kg', 'Sticks'],
  'Leeks': ['Per Piece', 'Per Bunch', 'Per Kg'],
  'Radish': ['Per Bunch', 'Per Kg', 'Red', 'White'],
  'Turnips': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large'],
  'Beetroot': ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', 'Fresh', 'Pickled'],
  
  // ===== KENYAN GREENS =====
  'Saga': ['Per Bunch', 'Small Bunch', 'Large Bunch'],
  'Mchicha': ['Per Bunch', 'Small Bunch', 'Large Bunch'],
};

// Category-based fallback suggestions when product isn't in the specific list
const CATEGORY_VARIANT_SUGGESTIONS: Record<string, string[]> = {
  'Vegetables': ['Per Kg', 'Per Piece', 'Per Bunch', 'Small', 'Medium', 'Large'],
  'Fruits': ['Per Kg', 'Per Piece', 'Per Bunch', 'Small', 'Medium', 'Large', 'Ripe', 'Raw'],
  'Grains & Cereals': ['500g', '1 Kg', '2 Kg', '5 Kg', '10 Kg', '25 Kg', '50 Kg'],
  'Spices': ['50g', '100g', '250g', '500g', 'Ground', 'Whole'],
  'Beverages': ['250ml', '500ml', '1 Litre', '2 Litre', '5 Litre'],
  'Snacks': ['Small', 'Medium', 'Large', 'Family Pack', '50g', '100g', '200g', 'Per Piece'],
  'Green Grocery': ['Per Bunch', 'Per Kg', 'Small Bunch', 'Large Bunch', '100g', '250g'],
  'Dairy': ['250ml', '500ml', '1 Litre', '100g', '250g', '500g', '1 Kg'],
  'Meat': ['Per Kg', '500g', '1 Kg', 'Whole', 'Half', 'Quarter', 'Per Piece'],
  'Bakery': ['Per Piece', 'Pack (6)', 'Pack (12)', 'Small', 'Medium', 'Large', 'Sliced'],
  'Frozen Foods': ['250g', '500g', '1 Kg', 'Small Pack', 'Family Pack'],
  'Canned Goods': ['200g', '400g', '800g', 'Small', 'Medium', 'Large'],
  'Legumes': ['Per Kg', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Cooking Essentials': ['250ml', '500ml', '1 Litre', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Personal Care': ['50ml', '100ml', '200ml', '500ml', 'Small', 'Medium', 'Large', 'Per Piece'],
  'Household': ['250ml', '500ml', '1 Litre', '5 Litre', 'Small', 'Medium', 'Large', 'Per Piece'],
};

// Helper function to get contextual variant suggestions
function getVariantSuggestions(productName: string, categoryName: string): string[] {
  // First check for exact product match
  const normalizedProductName = productName.trim();
  
  // Try exact match first
  if (PRODUCT_VARIANT_SUGGESTIONS[normalizedProductName]) {
    return PRODUCT_VARIANT_SUGGESTIONS[normalizedProductName];
  }
  
  // Try partial match (e.g., "Red Onions" should match "Onions")
  for (const [product, suggestions] of Object.entries(PRODUCT_VARIANT_SUGGESTIONS)) {
    if (normalizedProductName.toLowerCase().includes(product.toLowerCase()) ||
        product.toLowerCase().includes(normalizedProductName.toLowerCase())) {
      return suggestions;
    }
  }
  
  // Fall back to category suggestions
  if (CATEGORY_VARIANT_SUGGESTIONS[categoryName]) {
    return CATEGORY_VARIANT_SUGGESTIONS[categoryName];
  }
  
  // Generic fallback
  return ['Per Kg', 'Per Piece', 'Small', 'Medium', 'Large', '500g', '1 Kg'];
}

// Helper function to auto-detect unit type from variant name
function getUnitTypeFromVariant(variantName: string): UnitType | null {
  const variant = variantName.toLowerCase().trim();
  
  // Kilogram patterns
  if (variant.includes('per kg') || variant.includes('kg') || 
      variant.match(/^\d+\s*kg$/i) || variant === '1 kg' || variant === '2 kg' || 
      variant === '5 kg' || variant === '10 kg') {
    return 'kg';
  }
  
  // Gram patterns  
  if (variant.includes('per g') || variant.match(/^\d+\s*g$/i) || 
      variant === '100g' || variant === '250g' || variant === '500g') {
    return 'g';
  }
  
  // Piece patterns
  if (variant.includes('per piece') || variant === 'small' || variant === 'medium' || 
      variant === 'large' || variant === 'extra large' || variant.includes('whole') ||
      variant.includes('half') || variant.includes('quarter') || variant.includes('slice')) {
    return 'piece';
  }
  
  // Bunch patterns
  if (variant.includes('per bunch') || variant.includes('bunch') || 
      variant === 'small bunch' || variant === 'large bunch') {
    return 'bunch';
  }
  
  // Tray patterns
  if (variant.includes('tray') || variant.includes('crate')) {
    return 'tray';
  }
  
  // Litre patterns
  if (variant.includes('litre') || variant.includes('liter') || variant.includes('l') ||
      variant.match(/^\d+\s*l$/i) || variant === '500ml' || variant === '1 litre' || 
      variant === '2 litre' || variant === '5 litre') {
    return 'litre';
  }
  
  // Millilitre patterns
  if (variant.includes('ml') || variant.match(/^\d+\s*ml$/i)) {
    return 'ml';
  }
  
  // Dozen patterns (use piece)
  if (variant.includes('dozen') || variant.includes('pack')) {
    return 'piece';
  }
  
  return null; // No auto-detection possible
}

interface ItemFormProps {
  itemId?: string;
  initialData?: {
    name: string;
    category_id: string;
    unit_type: UnitType;
    current_stock: number;
    current_sell_price: number;
    min_stock_level: number | null;
    buy_price?: number | null;
    variant_name?: string | null;
    parent_item_id?: string | null;
  };
  parentItemId?: string; // If set, we're creating a variant for this parent
  defaultMode?: FormMode;
  onSuccess?: (updatedItem?: Item) => void;
  onCancel?: () => void;
}

export function ItemForm({ 
  itemId, 
  initialData, 
  parentItemId, 
  defaultMode = 'standalone',
  onSuccess, 
  onCancel 
}: ItemFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [shopType, setShopType] = useState<ShopType>(() => getShopType());
  const [parentItems, setParentItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<FormMode>(
    parentItemId ? 'variant' : 
    initialData?.parent_item_id ? 'variant' : 
    defaultMode
  );
  const [name, setName] = useState<string>(initialData?.name || '');
  const [selectedItemSuggestion, setSelectedItemSuggestion] = useState<string>('');
  const [isCustomItemName, setIsCustomItemName] = useState(true);
  const [variantName, setVariantName] = useState<string>(initialData?.variant_name || '');
  const [selectedVariantSuggestion, setSelectedVariantSuggestion] = useState<string>('');
  const [isCustomVariantName, setIsCustomVariantName] = useState(!!initialData?.variant_name);
  const [selectedParentId, setSelectedParentId] = useState<string>(parentItemId || initialData?.parent_item_id || '');
  const [categoryId, setCategoryId] = useState<string>(initialData?.category_id || '');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [unitType, setUnitType] = useState<UnitType>(initialData?.unit_type || 'piece');
  const [initialStock, setInitialStock] = useState<string>(initialData?.current_stock?.toString() || '0');
  const [buyPrice, setBuyPrice] = useState<string>(initialData?.buy_price?.toString() || '');
  const [sellPrice, setSellPrice] = useState<string>(initialData?.current_sell_price?.toString() || '');
  const [minStockLevel, setMinStockLevel] = useState<string>(initialData?.min_stock_level?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [categoriesResult, parentsResult] = await Promise.all([
          apiGet<Category[]>('/api/categories'),
          apiGet<Item[]>('/api/items?all=true&parentsOnly=true'),
        ]);
        
        if (categoriesResult.success) {
          const allCategories = categoriesResult.data ?? [];
          const currentShopType = getShopType();
          setShopType(currentShopType);
          const filteredCategories = allCategories.filter(cat => 
            shouldShowCategory(cat.name, currentShopType)
          );
          setCategories(filteredCategories);
        }
        if (parentsResult.success) {
          setParentItems(parentsResult.data ?? []);
        }
        
        // If parentItemId is set, get the parent's category
        if (parentItemId && parentsResult.success) {
          const parent = (parentsResult.data ?? []).find((p: Item) => p.id === parentItemId);
          if (parent) {
            setCategoryId(parent.category_id);
          }
        }
        
        // If editing a variant and parent not in list, try to fetch it
        if (itemId && initialData?.parent_item_id && parentsResult.success) {
          const parent = (parentsResult.data ?? []).find((p: Item) => p.id === initialData.parent_item_id);
          if (!parent && initialData.parent_item_id) {
            // Parent not in parents list, try to fetch it directly
            try {
              const parentResult = await apiGet<ItemWithParentFlag>(`/api/items/${initialData.parent_item_id}`);
              if (parentResult.success && parentResult.data) {
                // Add to parent items list if it's actually a parent
                if (parentResult.data.isParent) {
                  setParentItems(prev => [...prev, parentResult.data as Item]);
                }
              }
            } catch (err) {
              console.error('Error fetching parent item:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [parentItemId, itemId, initialData?.parent_item_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate category
    if (isCustomCategory) {
      if (!customCategoryName.trim()) {
        setError('Category name is required when creating a new category');
        return;
      }
    } else {
      if (!categoryId) {
        setError('Category is required');
        return;
      }
    }

    // Parent mode validation
    if (mode === 'parent') {
      if (!name.trim()) {
        setError('Item name is required');
        return;
      }
      if (!categoryId && !isCustomCategory) {
        setError('Category is required');
        return;
      }
    } else {
      // Standalone or variant mode validation
      if (!name.trim() && mode !== 'variant') {
        setError('Item name is required');
        return;
      }
      
      if (mode === 'variant') {
        if (!selectedParentId) {
          setError('Parent item is required for variants');
          return;
        }
        if (!variantName.trim()) {
          setError('Variant name is required');
          return;
        }
        // Category is inherited from parent for variants - no need to validate
      } else {
        // Category validation only for non-variants
        if (!categoryId && !isCustomCategory) {
          setError('Category is required');
          return;
        }
      }

      if (!sellPrice || parseFloat(sellPrice) <= 0) {
        setError('Sell price must be greater than 0');
        return;
      }
    }

    const stock = parseFloat(initialStock) || 0;
    const buy = buyPrice ? parseFloat(buyPrice) : null;
    const price = mode === 'parent' ? 0 : parseFloat(sellPrice);
    const minStock = minStockLevel ? parseFloat(minStockLevel) : null;

    if (mode !== 'parent' && stock > 0 && buy !== null && buy <= 0) {
      setError('Buy price must be greater than 0 when setting initial stock');
      return;
    }

    if (mode !== 'parent' && minStock !== null && minStock < 0) {
      setError('Min stock level cannot be negative');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalCategoryId = categoryId;
      
      // If custom category, create it first
      if (isCustomCategory && customCategoryName.trim()) {
        const categoryResult = await apiPost('/api/categories', { name: customCategoryName.trim() });
        
        if (!categoryResult.success) {
          setError(categoryResult.message || 'Failed to create category');
          setIsSubmitting(false);
          return;
        }
        
        // Fetch updated categories to get the new category ID
        const categoriesResult = await apiGet<Category[]>('/api/categories');
        if (categoriesResult.success) {
          const newCategory = (categoriesResult.data ?? []).find(
            (cat: Category) => cat.name === customCategoryName.trim()
          );
          if (newCategory) {
            finalCategoryId = newCategory.id;
            setCategories(categoriesResult.data ?? []);
            setIsCustomCategory(false);
            setCategoryId(newCategory.id);
          } else {
            setError('Category was created but could not be found');
            setIsSubmitting(false);
            return;
          }
        }
      }

      const url = itemId ? `/api/items/${itemId}` : '/api/items';
      
      // Get parent name for variant display name
      const parentItem = mode === 'variant' 
        ? parentItems.find(p => p.id === selectedParentId) 
        : null;
      
      // Build the item name: for variants, use "ParentName - VariantName"
      let itemName: string;
      if (mode === 'variant') {
        if (parentItem) {
          // Use parent name from the list
          itemName = `${parentItem.name} - ${variantName.trim()}`;
        } else if (itemId && initialData?.name) {
          // When editing a variant, if parent not found, extract parent name from existing name
          // Format is typically "ParentName - VariantName"
          const existingName = initialData.name;
          const existingVariantName = initialData.variant_name || '';
          
          if (existingName.includes(' - ') && existingVariantName) {
            // Extract parent name by removing the existing variant part
            const parentName = existingName.replace(` - ${existingVariantName}`, '').trim();
            itemName = `${parentName} - ${variantName.trim()}`;
          } else if (existingName.includes(' - ')) {
            // If we have the separator but no stored variant name, try to extract
            // by using the last part as the variant
            const parts = existingName.split(' - ');
            if (parts.length >= 2) {
              const parentName = parts.slice(0, -1).join(' - ').trim();
              itemName = `${parentName} - ${variantName.trim()}`;
            } else {
              itemName = existingName;
            }
          } else {
            // Fallback: if we can't extract, use the existing name structure
            // This handles cases where the name format might be different
            itemName = existingName;
          }
        } else if (itemId && name.trim()) {
          // Fallback: use the provided name (might already be correctly formatted)
          itemName = name.trim();
        } else {
          // New variant but parent not found - use provided name or build from variant
          itemName = name.trim() || (variantName.trim() ? `Item - ${variantName.trim()}` : '');
        }
      } else {
        itemName = name.trim();
      }

      const requestBody = {
        name: itemName,
        categoryId: finalCategoryId,
        unitType,
        initialStock: mode === 'parent' ? 0 : stock,
        buyPrice: mode === 'parent' ? null : buy,
        sellPrice: price,
        minStockLevel: mode === 'parent' ? null : minStock,
        isParent: mode === 'parent',
        parentItemId: mode === 'variant' ? selectedParentId : null,
        variantName: mode === 'variant' ? variantName.trim() : null,
      };

      const result = itemId 
        ? await apiPut<Item>(url, requestBody)
        : await apiPost<Item>(url, requestBody);

      if (result.success) {
        if (onSuccess) {
          onSuccess(result.data);
        } else {
          router.push('/admin/items');
        }
      } else {
        setError(result.message || 'Failed to save item');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Item save error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isEditingExistingItem = !!itemId;

  return (
    <div className="max-w-2xl mx-auto py-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mode Selection - only show for new items and not when creating variant for a parent */}
        {!isEditingExistingItem && !parentItemId && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-semibold">What type of product is this?</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMode('standalone')}
                disabled={isSubmitting}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                  hover:shadow-md group
                  ${mode === 'standalone'
                    ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm'
                    : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Single Product</p>
                    <p className="text-xs text-muted-foreground">
                      A regular item you sell (e.g., "Tomatoes", "Milk")
                    </p>
                  </div>
                </div>
                {mode === 'standalone' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-[#259783] animate-pulse" />
                  </div>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setMode('parent')}
                disabled={isSubmitting}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                  hover:shadow-md group
                  ${mode === 'parent'
                    ? 'border-purple-500 bg-purple-500/5 dark:bg-purple-500/10 shadow-sm'
                    : 'border-border bg-card hover:border-purple-500/50 hover:bg-accent/50'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                    <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Product with Variants</p>
                    <p className="text-xs text-muted-foreground">
                      Has different sizes/types (e.g., "Beans" → Big, Small)
                    </p>
                  </div>
                </div>
                {mode === 'parent' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                  </div>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setMode('variant')}
                disabled={isSubmitting}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                  hover:shadow-md group
                  ${mode === 'variant'
                    ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 shadow-sm'
                    : 'border-border bg-card hover:border-blue-500/50 hover:bg-accent/50'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                    <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Add Variant</p>
                    <p className="text-xs text-muted-foreground">
                      Add size/type to existing product
                    </p>
                  </div>
                </div>
                {mode === 'variant' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Variant-specific: Parent selection */}
        {mode === 'variant' && !parentItemId && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="parent" className="text-base font-semibold">Which product is this a variant of? *</Label>
              </div>
              <Select 
                value={selectedParentId} 
                onValueChange={(v) => {
                  setSelectedParentId(v);
                  const parent = parentItems.find(p => p.id === v);
                  if (parent) {
                    setCategoryId(parent.category_id);
                  }
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Choose the main product..." />
                </SelectTrigger>
                <SelectContent>
                  {parentItems.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">No products with variants found.</p>
                      <p className="text-xs text-muted-foreground">Create a "Product with Variants" first.</p>
                    </div>
                  ) : (
                    parentItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Variant Name (for variants) */}
        {mode === 'variant' && (() => {
          const selectedParent = parentItems.find(p => p.id === selectedParentId);
          const parentName = selectedParent?.name || '';
          const parentCategory = categories.find(c => c.id === selectedParent?.category_id);
          const categoryName = parentCategory?.name || '';
          const variantSuggestions = selectedParentId ? getVariantSuggestions(parentName, categoryName) : [];
          
          return (
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                What type of variant is this? *
              </Label>
              
              {/* Show parent product name prominently */}
              {selectedParentId && parentName && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Creating variant for: <span className="font-semibold">{parentName}</span>
                  </p>
                </div>
              )}
              
              {/* Variant suggestions - contextual based on product */}
              {selectedParentId && variantSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Common variants for <span className="font-medium">{parentName}</span>:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variantSuggestions.map((suggestion) => {
                      const isSelected = selectedVariantSuggestion === suggestion && !isCustomVariantName;
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setIsCustomVariantName(false);
                            setSelectedVariantSuggestion(suggestion);
                            setVariantName(suggestion);
                            // Auto-set unit type based on variant
                            const detectedUnit = getUnitTypeFromVariant(suggestion);
                            if (detectedUnit) {
                              setUnitType(detectedUnit);
                            }
                          }}
                          disabled={isSubmitting}
                          className={`
                            px-3 py-2 rounded-lg border text-sm transition-all
                            ${isSelected
                              ? 'border-[#259783] bg-[#259783]/10 text-[#259783] font-medium'
                              : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                            }
                            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          {suggestion}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomVariantName(true);
                        setSelectedVariantSuggestion('');
                        setVariantName('');
                      }}
                      disabled={isSubmitting}
                      className={`
                        px-3 py-2 rounded-lg border-2 border-dashed text-sm transition-all
                        ${isCustomVariantName
                          ? 'border-[#259783] bg-[#259783]/10 text-[#259783] font-medium'
                          : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                        }
                        ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <Sparkles className="h-3 w-3 inline mr-1" />
                      Other
                    </button>
                  </div>
                </div>
              )}
              
              {/* Show selected variant or custom input */}
              {selectedVariantSuggestion && !isCustomVariantName ? (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Variant type:</p>
                      <p className="font-semibold text-lg">{selectedVariantSuggestion}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomVariantName(true);
                        setSelectedVariantSuggestion('');
                        setVariantName('');
                      }}
                      disabled={isSubmitting}
                      className="text-xs text-primary hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : isCustomVariantName || !selectedParentId ? (
                <div className="space-y-2">
                  <Input
                    id="variantName"
                    value={variantName}
                    onChange={(e) => setVariantName(e.target.value)}
                    placeholder={parentName ? `Enter variant type for ${parentName}...` : 'Select a product first'}
                    required
                    disabled={isSubmitting || !selectedParentId}
                    className="h-12 text-base focus-visible:ring-[#259783]"
                  />
                  {isCustomVariantName && parentName && (
                    <p className="text-xs text-muted-foreground">
                      Examples: type, size, weight, or any distinguishing feature
                    </p>
                  )}
                </div>
              ) : null}
              
              {/* Preview how it will appear */}
              {variantName && parentName && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Will appear as:
                  </p>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                    {parentName} - {variantName}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Category Selection - only show for non-variant modes */}
        {mode !== 'variant' && (
          <>
            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Grid3x3 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Which category does this belong to? *</Label>
              </div>
              
              {categories.length > 0 && !isCustomCategory ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((category) => {
                    const isSelected = categoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(category.id);
                          setIsCustomCategory(false);
                          setCustomCategoryName('');
                          // Reset item name selection when category changes
                          setSelectedItemSuggestion('');
                          setIsCustomItemName(true);
                          setName('');
                        }}
                        disabled={isSubmitting}
                        className={`
                          relative p-3 rounded-lg border-2 transition-all duration-200
                          text-left hover:shadow-sm
                          ${isSelected 
                            ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm' 
                            : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                          }
                          ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{category.icon || '📦'}</span>
                          <span className="font-medium text-sm flex-1">{category.name}</span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-[#259783] animate-pulse" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(true);
                      setCategoryId('');
                      setCustomCategoryName('');
                    }}
                    disabled={isSubmitting}
                    className={`
                      relative p-3 rounded-lg border-2 border-dashed transition-all duration-200
                      text-left hover:shadow-sm
                      ${isCustomCategory
                        ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm'
                        : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                      }
                      ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium text-sm">New Category</span>
                    </div>
                    {isCustomCategory && (
                      <div className="absolute top-1.5 right-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#259783] animate-pulse" />
                      </div>
                    )}
                  </button>
                </div>
              ) : (
                <Select 
                  value={isCustomCategory ? 'custom' : categoryId} 
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setIsCustomCategory(true);
                      setCategoryId('');
                      setCustomCategoryName('');
                    } else {
                      setIsCustomCategory(false);
                      setCategoryId(value);
                      setSelectedItemSuggestion('');
                      setIsCustomItemName(true);
                      setName('');
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Choose a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <span>{category.icon || '📦'}</span>
                          <span>{category.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span>Create New Category</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {isCustomCategory && (
                <div className="mt-2 p-4 rounded-lg bg-muted/50 border">
                  <Label htmlFor="customCategory" className="text-sm font-medium mb-2 block">
                    New Category Name
                  </Label>
                  <Input
                    id="customCategory"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    placeholder="e.g., Electronics, Stationery"
                    disabled={isSubmitting}
                    className="h-11 focus-visible:ring-[#259783]"
                  />
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    A new category will be created automatically
                  </p>
                </div>
              )}
            </div>

            <Separator />
          </>
        )}

        {/* Item Name (for standalone and parent modes) */}
        {mode !== 'variant' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="name" className="text-base font-semibold">
                What's the product name? *
              </Label>
            </div>
            
            {/* Show suggestions if category is selected and we have suggestions (only for new items) */}
            {!itemId && categoryId && categoryId !== '' && !isCustomCategory && (() => {
              const categoryName = categories.find(c => c.id === categoryId)?.name || '';
              const suggestions = CATEGORY_ITEM_SUGGESTIONS[categoryName];
              return suggestions && suggestions.length > 0;
            })() && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Quick pick from common items:</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ITEM_SUGGESTIONS[categories.find(c => c.id === categoryId)?.name || '']?.slice(0, 8).map((itemName) => {
                    const isSelected = selectedItemSuggestion === itemName && !isCustomItemName;
                    return (
                      <button
                        key={itemName}
                        type="button"
                        onClick={() => {
                          setIsCustomItemName(false);
                          setSelectedItemSuggestion(itemName);
                          setName(itemName);
                        }}
                        disabled={isSubmitting}
                        className={`
                          px-3 py-1.5 rounded-lg border text-sm transition-all
                          ${isSelected
                            ? 'border-[#259783] bg-[#259783]/10 text-[#259783] font-medium'
                            : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                          }
                          ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {itemName}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomItemName(true);
                      setSelectedItemSuggestion('');
                      setName('');
                    }}
                    disabled={isSubmitting}
                    className={`
                      px-3 py-1.5 rounded-lg border-2 border-dashed text-sm transition-all
                      ${isCustomItemName
                        ? 'border-[#259783] bg-[#259783]/10 text-[#259783] font-medium'
                        : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                      }
                      ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    Custom
                  </button>
                </div>
              </div>
            )}
            
            {/* Input field */}
            {selectedItemSuggestion && !isCustomItemName ? (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Selected:</p>
                    <p className="font-semibold text-base">{selectedItemSuggestion}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomItemName(true);
                      setSelectedItemSuggestion('');
                      setName('');
                    }}
                    disabled={isSubmitting}
                    className="text-xs text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === 'parent' ? 'e.g., Beans, Rice, Flour' : 'e.g., Tomatoes, Milk, Bread'}
                required
                disabled={isSubmitting}
                className="h-12 text-base focus-visible:ring-[#259783]"
              />
            )}
          </div>
        )}

        <Separator />

        {/* Unit Type - only for non-parent items */}
        {mode !== 'parent' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="unit" className="text-base font-semibold">How do you sell this? *</Label>
              </div>
              {mode === 'variant' && variantName && getUnitTypeFromVariant(variantName) && (
                <Badge variant="secondary" className="text-xs">
                  Auto-detected from "{variantName}"
                </Badge>
              )}
            </div>
            <Select 
              value={unitType} 
              onValueChange={(v) => setUnitType(v as UnitType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="piece">By Piece (1, 2, 3...)</SelectItem>
                <SelectItem value="kg">By Kilogram (kg)</SelectItem>
                <SelectItem value="g">By Gram (g)</SelectItem>
                <SelectItem value="bunch">By Bunch</SelectItem>
                <SelectItem value="tray">By Tray</SelectItem>
                <SelectItem value="litre">By Litre (L)</SelectItem>
                <SelectItem value="ml">By Millilitre (ml)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              {mode === 'variant' && variantName && getUnitTypeFromVariant(variantName) 
                ? 'Auto-set based on variant. Change if needed.'
                : 'This determines how you measure and price the product'}
            </p>
          </div>
        )}

        {/* Stock and Price fields - only for non-parent items */}
        {mode !== 'parent' && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Pricing & Stock Information</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Selling Price */}
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium">
                    Selling Price (KES) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">KES</span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isSubmitting}
                      className="h-12 pl-12 text-base focus-visible:ring-[#259783]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How much you sell 1 {unitType} for
                  </p>
                </div>

                {/* Buying Price */}
                <div className="space-y-2">
                  <Label htmlFor="buyPrice" className="text-sm font-medium">
                    Buying Price (KES)
                    <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">KES</span>
                    <Input
                      id="buyPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                      className="h-12 pl-12 text-base focus-visible:ring-[#259783]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How much you buy 1 {unitType} for
                  </p>
                </div>
              </div>

              {/* Stock Information */}
              <div className="p-4 rounded-lg bg-muted/30 border space-y-4">
                {!itemId ? (
                  <div className="space-y-2">
                    <Label htmlFor="stock" className="text-sm font-medium">
                      Starting Stock ({unitType})
                      <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      step="0.01"
                      min="0"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                      className="h-12 text-base focus-visible:ring-[#259783]"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      How many {unitType}s you have right now (leave 0 if none)
                    </p>
                    {parseFloat(initialStock) > 0 && !buyPrice && (
                      <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Add buying price if you have stock
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Stock ({unitType})</Label>
                    <div className="h-12 px-4 flex items-center bg-background rounded-md border border-border">
                      <span className="text-foreground font-semibold text-lg">
                        {initialData?.current_stock?.toFixed(2) || '0.00'} {unitType}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Update stock by adding purchases
                    </p>
                  </div>
                )}

                {/* Min Stock Level */}
                <div className="space-y-2">
                  <Label htmlFor="minStock" className="text-sm font-medium">
                    Low Stock Alert ({unitType})
                    <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
                  </Label>
                  <Input
                    id="minStock"
                    type="number"
                    step="0.01"
                    min="0"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(e.target.value)}
                    placeholder="Leave empty for no alert"
                    disabled={isSubmitting}
                    className="h-12 text-base focus-visible:ring-[#259783]"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Get notified when stock goes below this amount
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Parent mode info */}
        {mode === 'parent' && (
          <>
            <Separator />
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800/30">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    Product with Variants
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    This product will have different sizes or types. After creating it, you can add variants like "Big", "Small", or "Red Kidney" with their own prices and stock.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Separator />

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                router.push('/admin/items');
              }
            }}
            className="flex-1 h-11"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-11 bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-md shadow-[#259783]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              itemId ? 'Update Product' : 
              mode === 'parent' ? 'Create Product' :
              mode === 'variant' ? 'Create Variant' :
              'Create Product'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

