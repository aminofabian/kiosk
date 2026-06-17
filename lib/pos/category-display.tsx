"use client";

import {
  Package,
  Pill,
  Coffee as CoffeeIcon,
  Cake,
  Heart as HeartIcon,
  Droplets,
  Sparkles,
  BookOpen,
  Flame,
  Shirt,
  UtensilsCrossed,
  Wheat,
  Candy,
  Home as HomeIcon,
} from "lucide-react";
import { CATEGORY_ICON_MAP } from "@/lib/pos/category-maps";

export function getCategoryIcon(categoryName: string) {
    if (!categoryName) return <Package className="w-7 h-7" />;

    const normalizedName = categoryName.trim();
    const lowerName = normalizedName.toLowerCase();

    // Direct match first
    if (CATEGORY_ICON_MAP[normalizedName]) {
      return CATEGORY_ICON_MAP[normalizedName];
    }

    // Try case-insensitive match
    for (const [key, value] of Object.entries(CATEGORY_ICON_MAP)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }

    // Try normalized variations
    const normalized = lowerName
      .replace(/&/g, "and")
      .replace(/\s+/g, " ")
      .trim();

    const variations: Record<string, string> = {
      vegetables: "Vegetables",
      vegetable: "Vegetables",
      fruits: "Fruits",
      fruit: "Fruits",
      "grains and cereals": "Grains & Cereals",
      "grains & cereals": "Grains & Cereals",
      "cereals and grains": "Grains & Cereals",
      "cereals & grains": "Grains & Cereals",
      "grain and cereal": "Grains & Cereals",
      "grain & cereal": "Grains & Cereals",
      "grains&cereals": "Grains & Cereals",
      spices: "Spices",
      spice: "Spices",
      beverages: "Beverages",
      beverage: "Beverages",
      drinks: "Beverages",
      snacks: "Snacks",
      snack: "Snacks",
      "green grocery": "Green Grocery",
      "green-grocery": "Green Grocery",
      dairy: "Dairy",
      meat: "Meat",
      bakery: "Bakery",
      "baked goods": "Bakery",
      "frozen foods": "Frozen Foods",
      "frozen food": "Frozen Foods",
      frozen: "Frozen Foods",
      "canned goods": "Canned Goods",
      "canned good": "Canned Goods",
      canned: "Canned Goods",
      "food essentials": "Food Essentials",
      "food essential": "Food Essentials",
      "snacks & confectionery": "Snacks & Confectionery",
      "snacks and confectionery": "Snacks & Confectionery",
      confectionery: "Snacks & Confectionery",
      "cleaning products": "Cleaning Products",
      "cleaning product": "Cleaning Products",
      "personal care": "Personal Care",
      "household items": "Household Items",
      "household item": "Household Items",
      "household goods": "Household Items",
      "paper products": "Paper Products",
      "paper product": "Paper Products",
      "general merchandise": "General Merchandise",
      "general merchandize": "General Merchandise",
      merchandise: "General Merchandise",
      merchandize: "General Merchandise",
    };

    if (variations[normalized] && CATEGORY_ICON_MAP[variations[normalized]]) {
      return CATEGORY_ICON_MAP[variations[normalized]];
    }

    // Keyword-based matching for custom categories - all icons use consistent size w-7 h-7
    if (
      lowerName.includes("medicine") ||
      lowerName.includes("meds") ||
      lowerName.includes("pill") ||
      lowerName.includes("drug")
    ) {
      return <Pill className="w-7 h-7" />;
    }
    if (lowerName.includes("coffee") || lowerName.includes("tea")) {
      return <CoffeeIcon className="w-7 h-7" />;
    }
    if (
      lowerName.includes("cake") ||
      lowerName.includes("pastry") ||
      lowerName.includes("baked")
    ) {
      return <Cake className="w-7 h-7" />;
    }
    if (
      lowerName.includes("beauty") ||
      lowerName.includes("cosmetic") ||
      lowerName.includes("makeup")
    ) {
      return <HeartIcon className="w-7 h-7" />;
    }
    if (
      lowerName.includes("juice") ||
      lowerName.includes("drink") ||
      lowerName.includes("soda")
    ) {
      return <Droplets className="w-7 h-7" />;
    }
    if (
      lowerName.includes("detergent") ||
      lowerName.includes("soap") ||
      lowerName.includes("cleaner")
    ) {
      return <Sparkles className="w-7 h-7" />;
    }
    if (
      lowerName.includes("stationery") ||
      lowerName.includes("pen") ||
      lowerName.includes("paper") ||
      lowerName.includes("notebook")
    ) {
      return <BookOpen className="w-7 h-7" />;
    }
    if (lowerName.includes("match") || lowerName.includes("lighter")) {
      return <Flame className="w-7 h-7" />;
    }
    if (
      lowerName.includes("shoe") ||
      lowerName.includes("polish") ||
      lowerName.includes("suede")
    ) {
      return <Shirt className="w-7 h-7" />;
    }
    if (
      lowerName.includes("lotion") ||
      lowerName.includes("cream") ||
      lowerName.includes("body")
    ) {
      return <HeartIcon className="w-7 h-7" />;
    }
    if (
      lowerName.includes("sauce") ||
      lowerName.includes("condiment") ||
      lowerName.includes("ketchup") ||
      lowerName.includes("tomato")
    ) {
      return <UtensilsCrossed className="w-7 h-7" />;
    }
    if (
      lowerName.includes("flour") ||
      lowerName.includes("wheat") ||
      lowerName.includes("maize") ||
      lowerName.includes("grain") ||
      lowerName.includes("cereal") ||
      lowerName.includes("weetabix")
    ) {
      return <Wheat className="w-7 h-7" />;
    }
    if (lowerName.includes("oil") || lowerName.includes("cooking")) {
      return <Droplets className="w-7 h-7" />;
    }
    if (lowerName.includes("sugar") || lowerName.includes("sweet")) {
      return <Candy className="w-7 h-7" />;
    }
    if (lowerName.includes("household") || lowerName.includes("goods")) {
      return <HomeIcon className="w-7 h-7" />;
    }

    // Default fallback - always return an icon
    return <Package className="w-7 h-7" />;
}
