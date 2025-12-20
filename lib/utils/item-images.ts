// Item image mappings using Unsplash direct image URLs
// All images are optimized to 400x400px with crop fit

export const ITEM_IMAGE_MAP: Record<string, string> = {
  // Vegetables
  Tomatoes: '/fruits/vegetables/tomatoes.avif',
  Onions: '/fruits/vegetables/onions.avif',
  Potatoes: '/fruits/vegetables/potatoes.avif',
  Carrots: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=400&h=400&fit=crop',
  Cabbage: '/fruits/vegetables/cabbages.avif',
  'Bell Peppers': 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&h=400&fit=crop',
  Eggplant: 'https://images.unsplash.com/photo-1604977043462-727313649e4a?w=400&h=400&fit=crop',
  Okra: 'https://images.unsplash.com/photo-1623503074880-c8f0a4b34d91?w=400&h=400&fit=crop',
  'Green Beans': 'https://images.unsplash.com/photo-1590502593743-4b8c7e4a8a4b?w=400&h=400&fit=crop',
  Cauliflower: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',

  
  // Green Grocery
  Spinach: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=400&fit=crop',
  Kale: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=400&fit=crop',
  Lettuce: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400&h=400&fit=crop',
  Coriander: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  Parsley: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  Mint: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  Basil: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  Arugula: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  'Spring Onions': 'https://images.unsplash.com/photo-1618512496249-a7167dfb793d?w=400&h=400&fit=crop',
  Dill: 'https://images.unsplash.com/photo-1618164436269-6f36e3a5520d?w=400&h=400&fit=crop',
  
  // Fruits
  Bananas: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=400&fit=crop',
  Oranges: 'https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=400&h=400&fit=crop',
  Apples: '/fruits/apples.avif',
  Mangoes: '/fruits/mangoes.avif',
  Avocados: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&h=400&fit=crop',
  Watermelons: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=400&fit=crop',
  Pineapples: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&h=400&fit=crop',
  Papayas: 'https://images.unsplash.com/photo-1605027990121-1c5b0e0b5e8a?w=400&h=400&fit=crop',
  Grapes: 'https://images.unsplash.com/photo-1537640538966-79f369143a8f?w=400&h=400&fit=crop',
  Lemons: 'https://images.unsplash.com/photo-1608504267508-36e0b806b16c?w=400&h=400&fit=crop',
  
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
  return ITEM_IMAGE_MAP[itemName] || null;
}
