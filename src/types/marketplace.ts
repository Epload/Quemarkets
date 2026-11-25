export type DockTab = 'market' | 'search' | 'chats' | 'sell' | 'profile';

export type ItemCondition = 'Nuevo' | 'Como nuevo' | 'Usado';

export type ProximityOption = number | 'state' | 'country';

export interface CityLocation {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export type VehicleTransmission = 'Automática' | 'Sincrónica' | 'CVT' | 'No aplica';
export type VehicleFuel = 'Gasolina' | 'Diésel' | 'Eléctrico' | 'Híbrido';

export interface VehicleDetails {
  brand?: string;
  model?: string;
  year?: number;
  mileageKm?: number;
  transmission?: VehicleTransmission;
  fuel?: VehicleFuel;
  documents?: string;
}

export interface RealEstateDetails {
  areaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  amenities?: string[];
  legalStatus?: string;
}

export type ListingStatus = 'pending' | 'active' | 'sold' | 'rejected';

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  priceUsd: number;
  category: string;
  subcategory?: string;
  condition: ItemCondition;
  state: string;
  city: string;
  lat: number;
  lng: number;
  imageUrl: string;
  imageUrls?: string[];
  vehicleDetails?: VehicleDetails;
  realEstateDetails?: RealEstateDetails;
  status: ListingStatus;
  createdAtMs: number;
  autoApproveAtMs?: number;
  soldAtMs?: number;
  source?: 'firestore';
}

export type ChatMessageType = 'text' | 'image' | 'audio';

export interface ChatMessage {
  id: string;
  senderId: string;
  participantIds: [string, string];
  text: string;
  type?: ChatMessageType;
  imageUrl?: string;
  audioUrl?: string;
  audioDurationSec?: number;
  createdAtMs: number;
}

export interface ChatMessagePayload {
  text?: string;
  type?: ChatMessageType;
  imageUrl?: string;
  audioUrl?: string;
  audioDurationSec?: number;
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
  source?: 'firestore';
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

export type IdentityVerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface IdentityVerificationRecord {
  uid: string;
  displayName: string;
  city: string;
  state: string;
  selfieUrl: string;
  idCardUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  submittedAtMs: number;
  updatedAtMs: number;
  source?: 'firestore' | 'server';
}

export interface UserPreferences {
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  customCategories: string[];
  displayName: string;
  username?: string;
  age?: number;
  termsAccepted?: boolean;
  termsVersion?: string;
  photoURL?: string;
  bio?: string;
  suspended?: boolean;
  identityVerified?: boolean;
}

export interface PublicSellerProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  city: string;
  state: string;
  identityVerified?: boolean;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface EmailRegistrationPayload {
  username: string;
  email: string;
  age: number;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface PlatformSettings {
  announcementEnabled: boolean;
  announcementText: string;
  allowNewListings: boolean;
  maintenanceMessage: string;
  updatedBy: string;
  updatedAtMs: number;
}

export interface AdminUserRecord {
  uid: string;
  displayName: string;
  username?: string;
  age?: number;
  city: string;
  state: string;
  bio?: string;
  photoURL?: string;
  suspended: boolean;
  identityVerified?: boolean;
  updatedAtMs: number;
  isAdmin?: boolean;
}

export interface AdminRoleRecord {
  uid: string;
  email: string;
  grantedBy: string;
  createdAtMs: number;
}
