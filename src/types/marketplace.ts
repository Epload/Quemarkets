export type DockTab = 'market' | 'search' | 'chats' | 'sell' | 'profile';

export type ItemCondition = 'Nuevo' | 'Como nuevo' | 'Usado';

export type ProximityOption = '5km' | '15km' | '50km' | 'state' | 'country';

export interface CityLocation {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  priceUsd: number;
  category: string;
  condition: ItemCondition;
  state: string;
  city: string;
  lat: number;
  lng: number;
  imageUrl: string;
  status: 'active' | 'sold';
  createdAtMs: number;
  source?: 'seed' | 'firestore' | 'local';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  participantIds: [string, string];
  text: string;
  createdAtMs: number;
}

export interface ChatThread {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  listingImage: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  participantIds: [string, string];
  lastMessage: string;
  lastMessageAtMs: number;
  createdAtMs: number;
  source?: 'local' | 'firestore';
}

export interface Purchase {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  priceUsd: number;
  buyerId: string;
  sellerId: string;
  sellerName: string;
  city: string;
  state: string;
  status: 'completed';
  createdAtMs: number;
}

export interface UserPreferences {
  city: string;
  state: string;
  lat: number;
  lng: number;
  customCategories: string[];
  displayName: string;
}
