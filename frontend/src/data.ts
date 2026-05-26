import { MenuItem, RestaurantConfig } from './types';

export const DEFAULT_RESTAURANT_CONFIG: RestaurantConfig = {
  name: "Gusto Ceylon Bistro",
  address: "No. 45, Galle Road, Colombo 03, Sri Lanka",
  phone: "+94 11 234 5678",
  taxRate: 0.10, // 10%
  currency: "LKR",
  currencySymbol: "Rs."
};

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: "item-1",
    name: "Sri Lankan Spice Burger",
    price: 1650.00,
    category: "Burgers",
    description: "Angus beef patty infused with native Ceylon cardamoms and black pepper, caramelized onions, curry leaf mayo.",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-2",
    name: "Crispy Devilled Chicken Burger",
    price: 1550.00,
    category: "Burgers",
    description: "Crispy devilled chicken thigh, spicy Lankan kochchi chili aioli, sliced red onions, and sweet banana pepper rings.",
    imageUrl: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-3",
    name: "Cheese Kottu Roti (Chicken)",
    price: 1850.00,
    category: "Rice & Mains",
    description: "Freshly chopped parotta flatbread cooked on iron griddle with rich chicken curry gravy, vegetables, eggs, and dynamic cheddar melting.",
    imageUrl: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-4",
    name: "Signature Pol Roti & Black Pork Curry",
    price: 1950.00,
    category: "Rice & Mains",
    description: "3 freshly baked rustic grated-coconut flatbreads served with gourmet slow-simmered rich Ceylon black pork curry.",
    imageUrl: "https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-5",
    name: "Aromatic Seafood Fried Rice",
    price: 2150.00,
    category: "Rice & Mains",
    description: "Premium basmati wok-tossed with local fresh lagoon prawns, cuttlefish, organic egg, spring leeks, and chili paste.",
    imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-6",
    name: "Crispy Egg Hopper Basket",
    price: 520.00,
    category: "Sides",
    description: "Lacy, bowl-shaped thin fermented rice flour pancakes (1 Egg Hopper + 2 Plains) served with spicy Katta Sambol.",
    imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-7",
    name: "Cassava Fries with Chili Salt",
    price: 650.00,
    category: "Sides",
    description: "Fried local manioc strips tossed in a fiery mixture of sea salt and dynamic crushed Ceylon Kochchi chili seasoning.",
    imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-8",
    name: "Classic Sweet Royal Faluda",
    price: 850.00,
    category: "Beverages",
    description: "Rose syrup milk beverage layered with soft basil seeds, vermicelli, vanilla ice cream scoop, and cashew nuts garnish.",
    imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-9",
    name: "Organic Woodapple Smoothie",
    price: 680.00,
    category: "Beverages",
    description: "Chilled blended fresh local woodapple fruit pulp mixed with organic coconut water and a dash of sweet brown sugar syrup.",
    imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  },
  {
    id: "item-10",
    name: "Gourmet Cardamom Watalappam",
    price: 750.00,
    category: "Desserts",
    description: "Steamed coconut custard sweetened with authentic dark kitul jaggery syrup and roasted aromatic cashews.",
    imageUrl: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&q=80&w=200",
    isAvailable: true
  }
];

export const AVAILABLE_CATEGORIES = [
  "Burgers",
  "Rice & Mains",
  "Sides",
  "Beverages",
  "Desserts"
];
