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

type FormMode = 'standalone' | 'parent' | 'variant';

const CATEGORY_ITEM_SUGGESTIONS: Record<string, string[]> = {
  'Vegetables': ['Tomatoes', 'Onions', 'Potatoes', 'Carrots', 'Cabbage', 'Bell Peppers', 'Eggplant', 'Okra', 'Green Beans', 'Cauliflower', 'Broccoli', 'Spinach', 'Lettuce', 'Cucumber', 'Zucchini'],
  'Fruits': ['Bananas', 'Apples', 'Oranges', 'Mangoes', 'Grapes', 'Strawberries', 'Watermelon', 'Pineapple', 'Papaya', 'Avocado', 'Pears', 'Cherries', 'Peaches', 'Plums', 'Berries'],
  'Grains & Cereals': ['Rice', 'Wheat', 'Maize', 'Oats', 'Barley', 'Quinoa', 'Millet', 'Sorghum', 'Flour', 'Pasta', 'Noodles'],
  'Spices': ['Salt', 'Black Pepper', 'Turmeric', 'Cumin', 'Coriander', 'Garlic', 'Ginger', 'Chili Powder', 'Paprika', 'Cinnamon', 'Cardamom', 'Cloves'],
  'Beverages': ['Water', 'Juice', 'Soda', 'Tea', 'Coffee', 'Milk', 'Yogurt Drink', 'Energy Drink', 'Soft Drink', 'Mineral Water'],
  'Snacks': ['Chips', 'Biscuits', 'Cookies', 'Crackers', 'Nuts', 'Popcorn', 'Chocolate', 'Candy', 'Cakes', 'Pastries'],
  'Green Grocery': ['Spinach', 'Kale', 'Lettuce', 'Coriander', 'Parsley', 'Mint', 'Basil', 'Arugula', 'Spring Onions', 'Dill', 'Chives'],
  'Dairy': ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Eggs', 'Cream', 'Sour Cream', 'Cottage Cheese', 'Mozzarella'],
  'Meat': ['Beef', 'Chicken', 'Pork', 'Lamb', 'Fish', 'Turkey', 'Bacon', 'Sausages', 'Ham', 'Mince'],
  'Bakery': ['Bread', 'White Bread', 'Brown Bread', 'Baguette', 'Croissant', 'Donuts', 'Muffins', 'Cookies', 'Cakes', 'Pastries'],
  'Frozen Foods': ['Ice Cream', 'Frozen Vegetables', 'Frozen Fruits', 'Frozen Meat', 'Frozen Fish', 'Frozen Pizza'],
  'Canned Goods': ['Canned Tomatoes', 'Canned Beans', 'Canned Corn', 'Canned Peas', 'Canned Fish', 'Canned Fruits'],
};

// Product-specific variant suggestions - these make sense for each product type
const PRODUCT_VARIANT_SUGGESTIONS: Record<string, string[]> = {
  // ===== GRAINS & CEREALS - strains/types/sizes =====
  'Rice': ['Pishori', 'Pakistani', 'Basmati', 'Jasmine', 'Brown Rice', 'White Rice', 'Long Grain', 'Short Grain', 'Sindano', '1 Kg', '2 Kg', '5 Kg'],
  'Wheat': ['Whole Wheat', 'Refined', 'Durum', '1 Kg', '2 Kg', '5 Kg', '10 Kg'],
  'Flour': ['All Purpose', 'Whole Wheat', 'Self Rising', 'Bread Flour', 'Cake Flour', 'Chapati Flour', '500g', '1 Kg', '2 Kg', '5 Kg'],
  'Maize': ['White Maize', 'Yellow Maize', '1 Kg', '2 Kg', '5 Kg', '10 Kg', '90 Kg'],
  'Maize Flour': ['Sifted', 'Unsifted', '500g', '1 Kg', '2 Kg', '5 Kg', 'Jogoo', 'Pembe', 'Hostess'],
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
  'Salt': ['500g', '1 Kg', '2 Kg', 'Table Salt', 'Sea Salt', 'Rock Salt', 'Iodized', 'Pink Himalayan'],
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
  'Eggs': ['Per Piece', 'Half Dozen', 'Dozen', 'Tray (30)', 'Kienyeji', 'Grade A', 'Grade B', 'Free Range', 'Organic'],
  
  // ===== DAIRY - sizes/volumes =====
  'Milk': ['250ml', '500ml', '1 Litre', '2 Litre', '5 Litre', 'Fresh', 'UHT', 'Full Cream', 'Skimmed', 'Semi-Skimmed', 'Maziwa Lala'],
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
  'Cowpeas': ['Per Kg', '500g', '1 Kg'],
  'Pigeon Peas': ['Per Kg', '500g', '1 Kg', 'Mbaazi'],
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
  'Water': ['250ml', '500ml', '1 Litre', '1.5 Litre', '5 Litre', '10 Litre', '20 Litre', 'Still', 'Sparkling'],
  'Mineral Water': ['250ml', '500ml', '1 Litre', '1.5 Litre', '5 Litre'],
  'Juice': ['250ml', '500ml', '1 Litre', '2 Litre', 'Orange', 'Mango', 'Apple', 'Mixed Fruit', 'Tropical', 'Fresh'],
  'Soda': ['300ml', '350ml', '500ml', '1 Litre', '1.5 Litre', '2 Litre', 'Coke', 'Fanta', 'Sprite', 'Pepsi', 'Krest', 'Stoney'],
  'Soft Drink': ['300ml', '500ml', '1 Litre', '2 Litre'],
  'Energy Drink': ['250ml', '350ml', '500ml', 'Red Bull', 'Monster', 'Power Horse'],
  'Tea': ['50g', '100g', '250g', '500g', 'Tea Bags (25)', 'Tea Bags (50)', 'Tea Bags (100)', 'Green Tea', 'Black Tea', 'Herbal'],
  'Coffee': ['50g', '100g', '250g', '500g', 'Instant', 'Ground', 'Beans', 'Decaf', 'Sachets (10)', 'Sachets (25)'],
  
  // ===== BAKERY =====
  'Bread': ['White', 'Brown', 'Whole Wheat', 'Sliced', 'Unsliced', '400g', '600g', '800g', 'Small', 'Large'],
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
  'Biscuits': ['100g', '200g', '400g', 'Per Packet', 'Cream', 'Chocolate', 'Digestive', 'Marie'],
  'Crackers': ['100g', '200g', '300g', 'Salted', 'Plain', 'Whole Wheat'],
  'Nuts': ['100g', '250g', '500g', 'Mixed', 'Cashews', 'Almonds', 'Peanuts', 'Roasted', 'Salted'],
  'Cashew Nuts': ['100g', '250g', '500g', 'Raw', 'Roasted', 'Salted'],
  'Almonds': ['100g', '250g', '500g', 'Raw', 'Roasted', 'Sliced'],
  'Popcorn': ['50g', '100g', '200g', 'Salted', 'Sweet', 'Butter', 'Caramel'],
  'Chocolate': ['50g', '100g', '200g', 'Milk', 'Dark', 'White', 'With Nuts', 'Bar', 'Block'],
  'Candy': ['Per Piece', '100g', '250g', '500g', 'Hard', 'Soft', 'Chewy'],
  'Sweets': ['Per Piece', '100g', '250g', 'Mixed', 'Fruit', 'Mint'],
  
  // ===== COOKING ESSENTIALS =====
  'Cooking Oil': ['500ml', '1 Litre', '2 Litre', '3 Litre', '5 Litre', '10 Litre', '20 Litre', 'Sunflower', 'Vegetable', 'Corn'],
  'Oil': ['500ml', '1 Litre', '2 Litre', '5 Litre', 'Sunflower', 'Vegetable', 'Olive', 'Coconut', 'Corn'],
  'Olive Oil': ['250ml', '500ml', '1 Litre', 'Extra Virgin', 'Virgin', 'Regular'],
  'Coconut Oil': ['250ml', '500ml', '1 Litre', 'Virgin', 'Refined'],
  'Sugar': ['500g', '1 Kg', '2 Kg', '5 Kg', 'White', 'Brown', 'Icing', 'Caster'],
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
};

// Category-based fallback suggestions when product isn't in the specific list
const CATEGORY_VARIANT_SUGGESTIONS: Record<string, string[]> = {
  'Vegetables': ['Per Kg', 'Per Piece', 'Per Bunch', 'Small', 'Medium', 'Large'],
  'Fruits': ['Per Kg', 'Per Piece', 'Per Bunch', 'Small', 'Medium', 'Large', 'Ripe', 'Raw'],
  'Grains & Cereals': ['500g', '1 Kg', '2 Kg', '5 Kg', '10 Kg', '25 Kg', '50 Kg'],
  'Spices': ['50g', '100g', '250g', '500g', 'Ground', 'Whole'],
  'Beverages': ['250ml', '500ml', '1 Litre', '2 Litre', '5 Litre'],
  'Snacks': ['Small', 'Medium', 'Large', 'Family Pack', '50g', '100g', '200g'],
  'Green Grocery': ['Per Bunch', 'Per Kg', '100g', '250g'],
  'Dairy': ['250ml', '500ml', '1 Litre', '100g', '250g', '500g'],
  'Meat': ['Per Kg', '500g', '1 Kg', 'Whole', 'Half', 'Portion'],
  'Bakery': ['Small', 'Medium', 'Large', 'Sliced', 'Unsliced', 'Per Piece'],
  'Frozen Foods': ['500g', '1 Kg', 'Small Pack', 'Family Pack'],
  'Canned Goods': ['Small', 'Medium', 'Large', '400g', '800g'],
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
        const [categoriesRes, parentsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/items?all=true&parentsOnly=true'),
        ]);
        
        const categoriesResult = await categoriesRes.json();
        const parentsResult = await parentsRes.json();
        
        if (categoriesResult.success) {
          setCategories(categoriesResult.data);
        }
        if (parentsResult.success) {
          setParentItems(parentsResult.data);
        }
        
        // If parentItemId is set, get the parent's category
        if (parentItemId && parentsResult.success) {
          const parent = parentsResult.data.find((p: Item) => p.id === parentItemId);
          if (parent) {
            setCategoryId(parent.category_id);
          }
        }
        
        // If editing a variant and parent not in list, try to fetch it
        if (itemId && initialData?.parent_item_id && parentsResult.success) {
          const parent = parentsResult.data.find((p: Item) => p.id === initialData.parent_item_id);
          if (!parent && initialData.parent_item_id) {
            // Parent not in parents list, try to fetch it directly
            try {
              const parentRes = await fetch(`/api/items/${initialData.parent_item_id}`);
              const parentResult = await parentRes.json();
              if (parentResult.success && parentResult.data) {
                // Add to parent items list if it's actually a parent
                if (parentResult.data.isParent) {
                  setParentItems(prev => [...prev, parentResult.data]);
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
      }

      if (!categoryId && !isCustomCategory) {
        setError('Category is required');
        return;
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
        const categoryResponse = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: customCategoryName.trim() }),
        });
        
        const categoryResult = await categoryResponse.json();
        if (!categoryResult.success) {
          setError(categoryResult.message || 'Failed to create category');
          setIsSubmitting(false);
          return;
        }
        
        // Fetch updated categories to get the new category ID
        const categoriesRes = await fetch('/api/categories');
        const categoriesResult = await categoriesRes.json();
        if (categoriesResult.success) {
          const newCategory = categoriesResult.data.find(
            (cat: Category) => cat.name === customCategoryName.trim()
          );
          if (newCategory) {
            finalCategoryId = newCategory.id;
            setCategories(categoriesResult.data);
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
      const method = itemId ? 'PUT' : 'POST';
      
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

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });

      const result = await response.json();

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

        <Separator />

        {/* Category Selection */}
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
                    disabled={isSubmitting || (mode === 'variant' && !!parentItemId)}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all duration-200
                      text-left hover:shadow-sm
                      ${isSelected 
                        ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm' 
                        : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                      }
                      ${isSubmitting || (mode === 'variant' && !!parentItemId) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
                disabled={isSubmitting || (mode === 'variant' && !!parentItemId)}
                className={`
                  relative p-3 rounded-lg border-2 border-dashed transition-all duration-200
                  text-left hover:shadow-sm
                  ${isCustomCategory
                    ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm'
                    : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                  }
                  ${isSubmitting || (mode === 'variant' && !!parentItemId) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
              disabled={isSubmitting || (mode === 'variant' && !!parentItemId)}
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
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="unit" className="text-base font-semibold">How do you sell this? *</Label>
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
              This determines how you measure and price the product
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

