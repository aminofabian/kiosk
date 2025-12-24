// Item image mappings using Unsplash direct image URLs
// All images are optimized to 400x400px with crop fit

export const ITEM_IMAGE_MAP: Record<string, string> = {
  // Vegetables
  Tomatoes: '/fruits/vegetables/tomatoes.avif',
  Onions: '/fruits/vegetables/onions.avif',
  Potatoes: '/fruits/vegetables/potatoes.avif',
  Carrots: '/fruits/vegetables/carrots.jpeg',
  Cabbage: '/fruits/vegetables/cabbages.avif',
  'Bell Peppers': 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&h=400&fit=crop',
  Eggplant: '/fruits/vegetables/egg plants.jpeg',
  'Egg Plants': '/fruits/vegetables/egg plants.jpeg',
  Okra: '/fruits/vegetables/okra.jpeg',
  'Green Beans': 'https://images.unsplash.com/photo-1590502593743-4b8c7e4a8a4b?w=400&h=400&fit=crop',
  Cauliflower: '/fruits/vegetables/cauliflower.jpeg',
  Broccoli: '/fruits/vegetables/broccoli.jpeg',
  Cucumber: '/fruits/vegetables/cucumber.jpeg',
  Hoho: '/fruits/vegetables/hoho.jpg',
  Ginger: '/fruits/vegetables/ginger.webp',
  'Green Peas': '/fruits/vegetables/green peas.webp',
  Peas: '/fruits/vegetables/peas.webp',

  
  // Green Grocery
  Spinach: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=400&fit=crop',
  Kale: '/fruits/vegetables/kales.jpeg',
  Kales: '/fruits/vegetables/kales.jpeg',
  Lettuce: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400&h=400&fit=crop',
  Coriander: '/fruits/vegetables/corriander.webp',
  'Sukuma Wiki': '/fruits/vegetables/sukuma.jpg',
  Sukuma: '/fruits/vegetables/sukuma.jpg',
  Parsley: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  Mint: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  Basil: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  Arugula: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  'Spring Onions': 'https://images.unsplash.com/photo-1618512496249-a7167dfb793d?w=400&h=400&fit=crop',
  Dill: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  
  // Fruits
  Apples: '/fruits/apples.avif',
  Apple: '/fruits/apples.avif',
  Avocados: '/fruits/avocado.jpg',
  Avocado: '/fruits/avocado.jpg',
  Bananas: '/fruits/bananas.jpeg',
  Banana: '/fruits/bananas.jpeg',
  'Dragon Fruit': '/fruits/dragon fruit.jpg',
  Dragonfruit: '/fruits/dragon fruit.jpg',
  Lemons: '/fruits/lemon.avif',
  Lemon: '/fruits/lemon.avif',
  Limes: '/fruits/lime.jpeg',
  Lime: '/fruits/lime.jpeg',
  Mangoes: '/fruits/mangoes.avif',
  Mango: '/fruits/mangoes.avif',
  Oranges: '/fruits/oranges.jpg',
  Orange: '/fruits/oranges.jpg',
  'Passion Fruit': '/fruits/passion fruit.webp',
  Passionfruit: '/fruits/passion fruit.webp',
  Papayas: '/fruits/Pawpaw.webp',
  Papaya: '/fruits/Pawpaw.webp',
  Pawpaw: '/fruits/Pawpaw.webp',
  Pineapples: '/fruits/pineapple.webp',
  Pineapple: '/fruits/pineapple.webp',
  Watermelons: '/fruits/watermelon.jpg',
  Watermelon: '/fruits/watermelon.jpg',
  Grapes: 'https://images.unsplash.com/photo-1537640538966-79f369143a8f?w=400&h=400&fit=crop',
  
  // Grains & Cereals
  'Rice (1kg)': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
  'Maize Flour (2kg)': 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=400&h=400&fit=crop',
  'Wheat Flour (1kg)': 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=400&h=400&fit=crop',
  'Beans (1kg)': 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&h=400&fit=crop',
  'Lentils (500g)': 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&h=400&fit=crop',
  'Oats (500g)': 'https://images.unsplash.com/photo-1606312619070-d48b4e6c8e0a?w=400&h=400&fit=crop',
  'Barley (1kg)': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
  'Quinoa (500g)': 'https://images.unsplash.com/photo-1606312619070-d48b4e6c8e0a?w=400&h=400&fit=crop',
  'Millet (1kg)': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
  'Sorghum (1kg)': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
};

export function getItemImage(itemName: string): string | null {
  if (!itemName) return null;
  
  const normalized = itemName.trim();
  
  // Direct match
  if (ITEM_IMAGE_MAP[normalized]) {
    return ITEM_IMAGE_MAP[normalized];
  }
  
  // Case-insensitive match
  const lowerNormalized = normalized.toLowerCase();
  for (const [key, value] of Object.entries(ITEM_IMAGE_MAP)) {
    if (key.toLowerCase() === lowerNormalized) {
      return value;
    }
  }
  
  return null;
}
