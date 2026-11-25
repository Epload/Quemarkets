import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ChatMessage,
  ChatMessageType,
  ChatThread,
  IdentityVerificationStatus,
  ItemCondition,
  Listing,
  ListingStatus,
  PublicSellerProfile,
  Purchase,
  RealEstateDetails,
  UserPreferences,
  VehicleDetails,
  VehicleFuel,
  VehicleTransmission,
} from '../types/marketplace';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export const LEGAL_TERMS_VERSION = 've-global-2026-v1';
export const LISTING_REVIEW_AUTO_APPROVE_MS = 30 * 60 * 1000;

export function normalizeUsernameHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (typeof val === 'number') {
    return val;
  }
  return Date.now();
}

export function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido'));
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        resolve(compressed.slice(0, 340000));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function compressListingPhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido'));
      img.onload = () => {
        const renderAt = (maxDim: number, startQuality: number): string | null => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          let q = startQuality;
          let out = canvas.toDataURL('image/jpeg', q);
          while (out.length > 155000 && q > 0.35) {
            q -= 0.1;
            out = canvas.toDataURL('image/jpeg', q);
          }
          return out;
        };

        let result = renderAt(760, 0.78);
        if (result && result.length > 160000) {
          result = renderAt(540, 0.68);
        }
        if (!result || result.length > 164000) {
          reject(new Error('La imagen es demasiado pesada. Prueba con otra foto.'));
          return;
        }
        resolve(result);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function compressAvatarToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido'));
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = Math.max(0, Math.floor((img.width - minSide) / 2));
        const sy = Math.max(0, Math.floor((img.height - minSide) / 2));
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        let quality = 0.82;
        let compressed = canvas.toDataURL('image/jpeg', quality);
        while (compressed.length > 180000 && quality > 0.4) {
          quality -= 0.1;
          compressed = canvas.toDataURL('image/jpeg', quality);
        }
        if (compressed.length > 195000) {
          reject(new Error('La foto es demasiado pesada, intenta con otra imagen.'));
          return;
        }
        resolve(compressed);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function parseFirestoreListingDoc(docId: string, data: Record<string, unknown>): Listing {
  const rawImageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
        .slice(0, 5)
    : [];
  const coverUrl = String(data.imageUrl ?? rawImageUrls[0] ?? '');
  const galleryUrls = rawImageUrls.length > 0 ? rawImageUrls : coverUrl ? [coverUrl] : [];
  const rawVehicle =
    data.vehicleDetails && typeof data.vehicleDetails === 'object'
      ? (data.vehicleDetails as Record<string, unknown>)
      : null;
  const vehicleDetails: VehicleDetails | undefined = rawVehicle
    ? {
        ...(typeof rawVehicle.brand === 'string' && rawVehicle.brand
          ? { brand: rawVehicle.brand }
          : {}),
        ...(typeof rawVehicle.model === 'string' && rawVehicle.model
          ? { model: rawVehicle.model }
          : {}),
        ...(typeof rawVehicle.year === 'number' ? { year: rawVehicle.year } : {}),
        ...(typeof rawVehicle.mileageKm === 'number' ? { mileageKm: rawVehicle.mileageKm } : {}),
        ...(typeof rawVehicle.transmission === 'string'
          ? { transmission: rawVehicle.transmission as VehicleTransmission }
          : {}),
        ...(typeof rawVehicle.fuel === 'string' ? { fuel: rawVehicle.fuel as VehicleFuel } : {}),
        ...(typeof rawVehicle.documents === 'string' && rawVehicle.documents
          ? { documents: rawVehicle.documents }
          : {}),
      }
    : undefined;

  const rawRealEstate =
    data.realEstateDetails && typeof data.realEstateDetails === 'object'
      ? (data.realEstateDetails as Record<string, unknown>)
      : null;
  const realEstateDetails: RealEstateDetails | undefined = rawRealEstate
    ? {
        ...(typeof rawRealEstate.areaSqm === 'number' ? { areaSqm: rawRealEstate.areaSqm } : {}),
        ...(typeof rawRealEstate.bedrooms === 'number'
          ? { bedrooms: rawRealEstate.bedrooms }
          : {}),
        ...(typeof rawRealEstate.bathrooms === 'number'
          ? { bathrooms: rawRealEstate.bathrooms }
          : {}),
        ...(typeof rawRealEstate.parkingSpaces === 'number'
          ? { parkingSpaces: rawRealEstate.parkingSpaces }
          : {}),
        ...(Array.isArray(rawRealEstate.amenities)
          ? {
              amenities: rawRealEstate.amenities
                .filter((a): a is string => typeof a === 'string' && a.length > 0)
                .slice(0, 8),
            }
          : {}),
        ...(typeof rawRealEstate.legalStatus === 'string' && rawRealEstate.legalStatus
          ? { legalStatus: rawRealEstate.legalStatus }
          : {}),
      }
    : undefined;

  const rawStatus = String(data.status ?? 'active');
  const status: ListingStatus =
    rawStatus === 'pending' || rawStatus === 'sold' || rawStatus === 'rejected'
      ? rawStatus
      : 'active';
  const createdAtMs = toMillis(data.createdAt);

  return {
    id: String(data.id ?? docId),
    sellerId: String(data.sellerId ?? ''),
    sellerName: String(data.sellerName ?? 'Vendedor'),
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    priceUsd: Number(data.priceUsd ?? 0),
    category: String(data.category ?? 'Otros'),
    ...(typeof data.subcategory === 'string' && data.subcategory
      ? { subcategory: data.subcategory }
      : {}),
    condition: (data.condition as ItemCondition) ?? 'Usado',
    state: String(data.state ?? ''),
    city: String(data.city ?? ''),
    lat: Number(data.lat ?? 10.2469),
    lng: Number(data.lng ?? -67.5958),
    imageUrl: coverUrl,
    imageUrls: galleryUrls,
    ...(vehicleDetails ? { vehicleDetails } : {}),
    ...(realEstateDetails ? { realEstateDetails } : {}),
    status,
    createdAtMs,
    autoApproveAtMs: createdAtMs + LISTING_REVIEW_AUTO_APPROVE_MS,
    soldAtMs: status === 'sold' ? toMillis(data.soldAt ?? data.updatedAt) : undefined,
    source: 'firestore',
  };
}

export function subscribeListings(onData: (items: Listing[]) => void): () => void {
  const q = query(collection(db, 'listings'), where('status', 'in', ['active', 'sold']));
  return onSnapshot(
    q,
    (snap) => {
      const parsed: Listing[] = snap.docs.map((d) =>
        parseFirestoreListingDoc(d.id, d.data() as Record<string, unknown>)
      );
      parsed.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(parsed);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    }
  );
}

export function subscribeSellerListings(
  sellerId: string,
  onData: (items: Listing[]) => void
): () => void {
  const q = query(collection(db, 'listings'), where('sellerId', '==', sellerId));
  return onSnapshot(
    q,
    (snap) => {
      const parsed: Listing[] = snap.docs.map((d) =>
        parseFirestoreListingDoc(d.id, d.data() as Record<string, unknown>)
      );
      parsed.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(parsed);
    },
    () => {
      // Non-fatal if user is unverified or disconnected
    }
  );
}

function sanitizeVehicleDetails(v?: VehicleDetails): VehicleDetails | undefined {
  if (!v) return undefined;
  const out: VehicleDetails = {};
  if (v.brand && v.brand.trim()) out.brand = v.brand.trim().slice(0, 50);
  if (v.model && v.model.trim()) out.model = v.model.trim().slice(0, 60);
  if (typeof v.year === 'number' && Number.isFinite(v.year) && v.year >= 1950 && v.year <= 2030) {
    out.year = Math.round(v.year);
  }
  if (
    typeof v.mileageKm === 'number' &&
    Number.isFinite(v.mileageKm) &&
    v.mileageKm >= 0 &&
    v.mileageKm <= 2000000
  ) {
    out.mileageKm = Math.round(v.mileageKm);
  }
  if (v.transmission) out.transmission = v.transmission;
  if (v.fuel) out.fuel = v.fuel;
  if (v.documents && v.documents.trim()) out.documents = v.documents.trim().slice(0, 80);
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeRealEstateDetails(r?: RealEstateDetails): RealEstateDetails | undefined {
  if (!r) return undefined;
  const out: RealEstateDetails = {};
  if (
    typeof r.areaSqm === 'number' &&
    Number.isFinite(r.areaSqm) &&
    r.areaSqm > 0 &&
    r.areaSqm <= 1000000
  ) {
    out.areaSqm = Math.round(r.areaSqm);
  }
  if (
    typeof r.bedrooms === 'number' &&
    Number.isFinite(r.bedrooms) &&
    r.bedrooms >= 0 &&
    r.bedrooms <= 50
  ) {
    out.bedrooms = Math.round(r.bedrooms);
  }
  if (
    typeof r.bathrooms === 'number' &&
    Number.isFinite(r.bathrooms) &&
    r.bathrooms >= 0 &&
    r.bathrooms <= 50
  ) {
    out.bathrooms = Math.round(r.bathrooms);
  }
  if (
    typeof r.parkingSpaces === 'number' &&
    Number.isFinite(r.parkingSpaces) &&
    r.parkingSpaces >= 0 &&
    r.parkingSpaces <= 50
  ) {
    out.parkingSpaces = Math.round(r.parkingSpaces);
  }
  if (Array.isArray(r.amenities) && r.amenities.length > 0) {
    out.amenities = r.amenities
      .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      .slice(0, 8)
      .map((a) => a.trim().slice(0, 40));
  }
  if (r.legalStatus && r.legalStatus.trim()) out.legalStatus = r.legalStatus.trim().slice(0, 80);
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function createFirestoreListing(
  input: Omit<Listing, 'id' | 'status' | 'createdAtMs' | 'source'>
): Promise<string> {
  const id = makeSafeId('lst');
  const path = `listings/${id}`;
  const normalizedGallery = (
    input.imageUrls && input.imageUrls.length > 0 ? input.imageUrls : [input.imageUrl]
  )
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .slice(0, 5)
    .map((u) => u.slice(0, 165000));
  const coverUrl = (normalizedGallery[0] || input.imageUrl).slice(0, 350000);
  const cleanSubcategory = input.subcategory?.trim().slice(0, 60);
  const cleanVehicle = sanitizeVehicleDetails(input.vehicleDetails);
  const cleanRealEstate = sanitizeRealEstateDetails(input.realEstateDetails);

  try {
    await setDoc(doc(db, 'listings', id), {
      id,
      sellerId: input.sellerId,
      sellerName: input.sellerName.trim().slice(0, 80) || 'Vendedor',
      title: input.title.trim().slice(0, 100),
      description: input.description.trim().slice(0, 600),
      priceUsd: Math.min(1000000, Math.max(1, Number(input.priceUsd))),
      category: input.category.trim().slice(0, 50),
      ...(cleanSubcategory ? { subcategory: cleanSubcategory } : {}),
      condition: input.condition,
      state: input.state.trim().slice(0, 60),
      city: input.city.trim().slice(0, 60),
      lat: Number(input.lat),
      lng: Number(input.lng),
      imageUrl: coverUrl,
      ...(normalizedGallery.length > 0 ? { imageUrls: normalizedGallery } : {}),
      ...(cleanVehicle ? { vehicleDetails: cleanVehicle } : {}),
      ...(cleanRealEstate ? { realEstateDetails: cleanRealEstate } : {}),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function promoteFirestoreListingAfterReviewWindow(listingId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'listings', listingId), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if Firestore server clock has not reached 30m yet or admin already moderated
  }
}

export async function markFirestoreListingSold(listingId: string): Promise<void> {
  const path = `listings/${listingId}`;
  try {
    await updateDoc(doc(db, 'listings', listingId), {
      status: 'sold',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFirestoreListing(listingId: string): Promise<void> {
  const path = `listings/${listingId}`;
  try {
    await deleteDoc(doc(db, 'listings', listingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function isUsernameAvailable(rawHandle: string): Promise<boolean> {
  const cleanHandle = normalizeUsernameHandle(rawHandle);
  if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
    return false;
  }
  try {
    const snap = await getDoc(doc(db, 'usernames', cleanHandle));
    return !snap.exists();
  } catch {
    return true;
  }
}

export async function claimUsername(rawHandle: string, uid: string): Promise<void> {
  const cleanHandle = normalizeUsernameHandle(rawHandle);
  if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) return;
  const path = `usernames/${cleanHandle}`;
  try {
    const ref = doc(db, 'usernames', cleanHandle);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return;
    }
    await setDoc(ref, {
      handle: cleanHandle,
      uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncPublicSellerProfile(
  uid: string,
  data: {
    displayName: string;
    city: string;
    state: string;
    photoURL?: string;
    bio?: string;
  }
): Promise<void> {
  const path = `sellers/${uid}`;
  try {
    const ref = doc(db, 'sellers', uid);
    const snap = await getDoc(ref);
    const sanitizedName = data.displayName.trim().slice(0, 80) || 'Vendedor Quemarket';
    const mutablePayload: Record<string, unknown> = {
      city: data.city.trim().slice(0, 60) || 'Caracas',
      state: data.state.trim().slice(0, 60) || 'Distrito Capital',
      updatedAt: serverTimestamp(),
    };
    if (typeof data.photoURL === 'string' && data.photoURL.length > 0 && data.photoURL.length <= 200000) {
      mutablePayload.photoURL = data.photoURL;
    }
    if (typeof data.bio === 'string') {
      mutablePayload.bio = data.bio.trim().slice(0, 240);
    }

    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        displayName: sanitizedName,
        ...mutablePayload,
        createdAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      const existingName =
        typeof existingData.displayName === 'string' ? existingData.displayName : '';
      // Preserve locked @username handle so we never violate sellers update rules
      const nextDisplayName = existingName.startsWith('@') ? existingName : sanitizedName;
      await updateDoc(ref, {
        ...mutablePayload,
        displayName: nextDisplayName,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchPublicSeller(sellerId: string): Promise<PublicSellerProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'sellers', sellerId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid ?? sellerId),
      displayName: typeof d.displayName === 'string' ? d.displayName : 'Vendedor Quemarket',
      photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
      bio: typeof d.bio === 'string' ? d.bio : undefined,
      city: typeof d.city === 'string' ? d.city : '',
      state: typeof d.state === 'string' ? d.state : '',
      identityVerified: Boolean(d.identityVerified),
      createdAtMs: d.createdAt ? toMillis(d.createdAt) : undefined,
      updatedAtMs: d.updatedAt ? toMillis(d.updatedAt) : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveUserProfile(
  uid: string,
  prefs: UserPreferences,
  photoURL?: string
): Promise<void> {
  const path = `users/${uid}`;
  const cleanCity = prefs.city.trim().slice(0, 60) || 'Caracas';
  const cleanState = prefs.state.trim().slice(0, 60) || 'Distrito Capital';
  const cleanCategories = prefs.customCategories
    .slice(0, 12)
    .map((c) => c.trim().slice(0, 50))
    .filter(Boolean);
  const lockedHandle = prefs.username
    ? `@${normalizeUsernameHandle(prefs.username)}`
    : undefined;
  const hasValidHandle = Boolean(lockedHandle && /^@[a-z0-9_]{3,24}$/.test(lockedHandle));
  const hasValidAge =
    typeof prefs.age === 'number' &&
    Number.isInteger(prefs.age) &&
    prefs.age >= 18 &&
    prefs.age <= 120;
  const hasValidTerms = prefs.termsAccepted === true;
  const effectivePhoto = photoURL ?? prefs.photoURL;
  const validPhoto =
    typeof effectivePhoto === 'string' &&
    effectivePhoto.length > 0 &&
    effectivePhoto.length <= 200000
      ? effectivePhoto
      : undefined;

  let resolvedSellerName =
    (hasValidHandle ? lockedHandle! : prefs.displayName.trim().slice(0, 80)) ||
    'Usuario Quemarket';
  let userDocWritten = false;

  try {
    const userRef = doc(db, 'users', uid);
    const existingSnap = await getDoc(userRef);

    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const hasExistingUsername =
        typeof existingData.username === 'string' && existingData.username.length > 0;

      if (hasExistingUsername) {
        // Only update mutable profile fields permitted when username is already locked
        const mutablePatch: Record<string, unknown> = {
          city: cleanCity,
          state: cleanState,
          customCategories: cleanCategories,
          updatedAt: serverTimestamp(),
        };
        if (validPhoto) {
          mutablePatch.photoURL = validPhoto;
        }
        if (typeof prefs.bio === 'string') {
          mutablePatch.bio = prefs.bio.trim().slice(0, 240);
        }
        await updateDoc(userRef, mutablePatch);
        resolvedSellerName =
          typeof existingData.displayName === 'string' && existingData.displayName.length > 0
            ? existingData.displayName
            : existingData.username;
        userDocWritten = true;
      } else {
        // Legacy user doc without locked username yet
        const legacyPatch: Record<string, unknown> = {
          city: cleanCity,
          state: cleanState,
          customCategories: cleanCategories,
          updatedAt: serverTimestamp(),
        };
        if (hasValidHandle && lockedHandle) {
          legacyPatch.username = lockedHandle;
          legacyPatch.displayName = lockedHandle;
          resolvedSellerName = lockedHandle;
        }
        if (!('age' in existingData) && hasValidAge) {
          legacyPatch.age = prefs.age;
        }
        if (!('termsAccepted' in existingData) && hasValidTerms) {
          legacyPatch.termsAccepted = true;
          if (!('termsVersion' in existingData)) {
            legacyPatch.termsVersion = (prefs.termsVersion || LEGAL_TERMS_VERSION).slice(0, 40);
          }
        }
        if (validPhoto) {
          legacyPatch.photoURL = validPhoto;
        }
        if (typeof prefs.bio === 'string') {
          legacyPatch.bio = prefs.bio.trim().slice(0, 240);
        }
        await updateDoc(userRef, legacyPatch);
        userDocWritten = true;
      }
    } else {
      // Document does not exist yet: creation requires username, age >= 18, termsAccepted & termsVersion
      if (!hasValidHandle || !lockedHandle || !hasValidAge || !hasValidTerms) {
        // Profile registration is not complete yet; skip premature create write
        return;
      }

      const createPayload: Record<string, unknown> = {
        uid,
        displayName: lockedHandle,
        username: lockedHandle,
        age: prefs.age,
        termsAccepted: true,
        termsVersion: (prefs.termsVersion || LEGAL_TERMS_VERSION).slice(0, 40),
        city: cleanCity,
        state: cleanState,
        customCategories: cleanCategories,
        updatedAt: serverTimestamp(),
      };
      if (validPhoto) {
        createPayload.photoURL = validPhoto;
      }
      if (typeof prefs.bio === 'string') {
        createPayload.bio = prefs.bio.trim().slice(0, 240);
      }

      await setDoc(userRef, createPayload);
      resolvedSellerName = lockedHandle;
      userDocWritten = true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  if (userDocWritten) {
    await syncPublicSellerProfile(uid, {
      displayName: resolvedSellerName,
      city: cleanCity,
      state: cleanState,
      photoURL: validPhoto,
      bio: prefs.bio,
    });
  }
}

export async function fetchUserProfile(uid: string): Promise<Partial<UserPreferences> | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
      username: typeof d.username === 'string' ? d.username : undefined,
      age: typeof d.age === 'number' ? d.age : undefined,
      termsAccepted: typeof d.termsAccepted === 'boolean' ? d.termsAccepted : undefined,
      termsVersion: typeof d.termsVersion === 'string' ? d.termsVersion : undefined,
      photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
      bio: typeof d.bio === 'string' ? d.bio : undefined,
      city: typeof d.city === 'string' ? d.city : undefined,
      state: typeof d.state === 'string' ? d.state : undefined,
      suspended: typeof d.suspended === 'boolean' ? d.suspended : undefined,
      identityVerified: Boolean(d.identityVerified),
      customCategories: Array.isArray(d.customCategories)
        ? d.customCategories.filter((x): x is string => typeof x === 'string')
        : undefined,
    };
  } catch {
    return null;
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (prefs: Partial<UserPreferences> | null) => void
): () => void {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
        username: typeof d.username === 'string' ? d.username : undefined,
        age: typeof d.age === 'number' ? d.age : undefined,
        termsAccepted: typeof d.termsAccepted === 'boolean' ? d.termsAccepted : undefined,
        termsVersion: typeof d.termsVersion === 'string' ? d.termsVersion : undefined,
        photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
        bio: typeof d.bio === 'string' ? d.bio : undefined,
        city: typeof d.city === 'string' ? d.city : undefined,
        state: typeof d.state === 'string' ? d.state : undefined,
        suspended: typeof d.suspended === 'boolean' ? d.suspended : undefined,
        identityVerified: Boolean(d.identityVerified),
        customCategories: Array.isArray(d.customCategories)
          ? d.customCategories.filter((x): x is string => typeof x === 'string')
          : undefined,
      });
    },
    (error) => {
      if (!auth.currentUser || auth.currentUser.uid !== uid) {
        return;
      }
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function submitFirestoreIdentityVerification(params: {
  uid: string;
  displayName: string;
  city: string;
  state: string;
  selfieUrl: string;
  idCardUrl: string;
}): Promise<void> {
  const path = `identity_verifications/${params.uid}`;
  try {
    const ref = doc(db, 'identity_verifications', params.uid);
    const snap = await getDoc(ref);
    const cleanDisplayName = params.displayName.trim().slice(0, 80) || 'Usuario Quemarket';
    const cleanCity = params.city.trim().slice(0, 60) || 'Venezuela';
    const cleanState = params.state.trim().slice(0, 60) || 'Venezuela';
    const cleanSelfie = params.selfieUrl.slice(0, 220000);
    const cleanIdCard = params.idCardUrl.slice(0, 220000);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: params.uid,
        displayName: cleanDisplayName,
        city: cleanCity,
        state: cleanState,
        selfieUrl: cleanSelfie,
        idCardUrl: cleanIdCard,
        status: 'pending',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const existingStatus = String(snap.data()?.status || '');
    if (existingStatus === 'rejected') {
      await updateDoc(ref, {
        displayName: cleanDisplayName,
        city: cleanCity,
        state: cleanState,
        selfieUrl: cleanSelfie,
        idCardUrl: cleanIdCard,
        status: 'pending',
        rejectionReason: deleteField(),
        reviewedBy: deleteField(),
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeMyIdentityVerification(
  uid: string,
  onData: (info: {
    status: IdentityVerificationStatus;
    rejectionReason?: string;
    submittedAtMs?: number;
    updatedAtMs?: number;
  }) => void
): () => void {
  return onSnapshot(
    doc(db, 'identity_verifications', uid),
    (snap) => {
      if (!snap.exists()) {
        onData({ status: 'none' });
        return;
      }
      const d = snap.data();
      const rawStatus = String(d.status || '');
      const status: IdentityVerificationStatus =
        rawStatus === 'pending' || rawStatus === 'approved' || rawStatus === 'rejected'
          ? rawStatus
          : 'none';
      onData({
        status,
        rejectionReason: typeof d.rejectionReason === 'string' ? d.rejectionReason : undefined,
        submittedAtMs: d.submittedAt ? toMillis(d.submittedAt) : undefined,
        updatedAtMs: d.updatedAt ? toMillis(d.updatedAt) : undefined,
      });
    },
    () => {
      // Non-fatal if user has no verification doc or lacks permissions
    }
  );
}

export function subscribeUserChats(
  uid: string,
  onData: (threads: ChatThread[]) => void
): () => void {
  const q = query(collection(db, 'chats'), where('participantIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const threads: ChatThread[] = snap.docs
        .map((d) => {
          const data = d.data();
          const buyerId = String(data.buyerId ?? '');
          const sellerId = String(data.sellerId ?? '');
          const participants = Array.isArray(data.participantIds)
            ? data.participantIds
            : [buyerId, sellerId];
          return {
            id: String(data.id ?? d.id),
            listingId: String(data.listingId ?? ''),
            listingTitle: String(data.listingTitle ?? ''),
            listingPrice: Number(data.listingPrice ?? 0),
            listingImage: String(data.listingImage ?? ''),
            buyerId,
            buyerName: String(data.buyerName ?? 'Comprador'),
            sellerId,
            sellerName: String(data.sellerName ?? 'Vendedor'),
            participantIds: [String(participants[0] ?? buyerId), String(participants[1] ?? sellerId)] as [
              string,
              string,
            ],
            lastMessage: String(data.lastMessage ?? ''),
            lastMessageAtMs: toMillis(data.lastMessageAt),
            createdAtMs: toMillis(data.createdAt),
            source: 'firestore' as const,
          };
        })
        .filter(
          (t) =>
            Boolean(t.buyerId) &&
            Boolean(t.sellerId) &&
            t.buyerId !== t.sellerId &&
            (t.buyerId === uid || t.sellerId === uid)
        );
      threads.sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
      onData(threads);
    },
    (error) => {
      if (!auth.currentUser || auth.currentUser.uid !== uid) {
        return;
      }
      handleFirestoreError(error, OperationType.LIST, 'chats');
    }
  );
}

export async function findExistingFirestoreChatThread(
  buyerId: string,
  listingId: string,
  sellerId: string
): Promise<ChatThread | null> {
  if (!buyerId || !listingId || !sellerId || buyerId === sellerId) return null;
  try {
    const q = query(collection(db, 'chats'), where('participantIds', 'array-contains', buyerId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (
        String(data.listingId ?? '') === listingId &&
        String(data.buyerId ?? '') === buyerId &&
        String(data.sellerId ?? '') === sellerId
      ) {
        return {
          id: String(data.id ?? d.id),
          listingId: String(data.listingId ?? ''),
          listingTitle: String(data.listingTitle ?? ''),
          listingPrice: Number(data.listingPrice ?? 0),
          listingImage: String(data.listingImage ?? ''),
          buyerId: String(data.buyerId ?? ''),
          buyerName: String(data.buyerName ?? 'Comprador'),
          sellerId: String(data.sellerId ?? ''),
          sellerName: String(data.sellerName ?? 'Vendedor'),
          participantIds: [buyerId, sellerId],
          lastMessage: String(data.lastMessage ?? ''),
          lastMessageAtMs: toMillis(data.lastMessageAt),
          createdAtMs: toMillis(data.createdAt),
          source: 'firestore',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function subscribeChatMessages(
  chatId: string,
  uid: string,
  onData: (messages: ChatMessage[]) => void
): () => void {
  const path = `chats/${chatId}/messages`;
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    where('participantIds', 'array-contains', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        const participants = Array.isArray(data.participantIds) ? data.participantIds : ['', ''];
        const rawType = data.type;
        const msgType: ChatMessageType | undefined =
          rawType === 'image' || rawType === 'audio' || rawType === 'text' ? rawType : undefined;
        return {
          id: String(data.id ?? d.id),
          senderId: String(data.senderId ?? ''),
          participantIds: [String(participants[0] ?? ''), String(participants[1] ?? '')],
          text: String(data.text ?? ''),
          type: msgType,
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
          audioUrl: typeof data.audioUrl === 'string' ? data.audioUrl : undefined,
          audioDurationSec:
            typeof data.audioDurationSec === 'number' ? data.audioDurationSec : undefined,
          createdAtMs: toMillis(data.createdAt),
        };
      });
      msgs.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(msgs);
    },
    (error) => {
      if (!auth.currentUser || auth.currentUser.uid !== uid) {
        return;
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createFirestoreChatThread(params: {
  chatId: string;
  listing: Listing;
  buyerId: string;
  buyerName: string;
  firstMessage: string;
}): Promise<{ thread: ChatThread; initialMessage: ChatMessage }> {
  const { chatId, listing, buyerId, buyerName, firstMessage } = params;
  if (!buyerId || !listing.sellerId || buyerId === listing.sellerId) {
    throw new Error('No puedes iniciar un chat contigo mismo.');
  }
  const participantIds: [string, string] = [buyerId, listing.sellerId];
  const chatPath = `chats/${chatId}`;
  const cleanTitle = listing.title.slice(0, 100);
  const cleanImage = listing.imageUrl.slice(0, 350000);
  const cleanBuyerName = buyerName.trim().slice(0, 80) || 'Comprador';
  const cleanSellerName = listing.sellerName.trim().slice(0, 80) || 'Vendedor';
  const cleanFirstMsg = firstMessage.trim().slice(0, 500);
  const cleanPreview = cleanFirstMsg.slice(0, 300);
  const now = Date.now();

  try {
    await setDoc(doc(db, 'chats', chatId), {
      id: chatId,
      listingId: listing.id,
      listingTitle: cleanTitle,
      listingPrice: listing.priceUsd,
      listingImage: cleanImage,
      buyerId,
      buyerName: cleanBuyerName,
      sellerId: listing.sellerId,
      sellerName: cleanSellerName,
      participantIds,
      lastMessage: cleanPreview,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    const msgId = makeSafeId('msg');
    await setDoc(doc(db, 'chats', chatId, 'messages', msgId), {
      id: msgId,
      senderId: buyerId,
      participantIds,
      text: cleanFirstMsg,
      type: 'text',
      createdAt: serverTimestamp(),
    });

    return {
      thread: {
        id: chatId,
        listingId: listing.id,
        listingTitle: cleanTitle,
        listingPrice: listing.priceUsd,
        listingImage: cleanImage,
        buyerId,
        buyerName: cleanBuyerName,
        sellerId: listing.sellerId,
        sellerName: cleanSellerName,
        participantIds,
        lastMessage: cleanPreview,
        lastMessageAtMs: now,
        createdAtMs: now,
        source: 'firestore',
      },
      initialMessage: {
        id: msgId,
        senderId: buyerId,
        participantIds,
        text: cleanFirstMsg,
        type: 'text',
        createdAtMs: now,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, chatPath);
  }
}

export function buildLastMessagePreview(params: {
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDurationSec?: number;
}): string {
  const cleanText = (params.text || '').trim();
  if (params.audioUrl) {
    const secs = typeof params.audioDurationSec === 'number' ? Math.round(params.audioDurationSec) : 0;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return secs > 0
      ? `🎤 Nota de voz (${mins}:${String(rem).padStart(2, '0')})`
      : '🎤 Nota de voz';
  }
  if (params.imageUrl) {
    return cleanText ? `📷 ${cleanText}`.slice(0, 300) : '📷 Imagen';
  }
  return cleanText.slice(0, 300);
}

export async function sendFirestoreChatMessage(params: {
  chatId: string;
  senderId: string;
  participantIds: [string, string];
  text?: string;
  type?: ChatMessageType;
  imageUrl?: string;
  audioUrl?: string;
  audioDurationSec?: number;
}): Promise<void> {
  const { chatId, senderId, participantIds, text, type, imageUrl, audioUrl, audioDurationSec } =
    params;
  const cleanText = (text || '').trim().slice(0, 500);
  const cleanImage = imageUrl ? imageUrl.slice(0, 350000) : undefined;
  const cleanAudio = audioUrl ? audioUrl.slice(0, 350000) : undefined;
  if (!cleanText && !cleanImage && !cleanAudio) return;

  const resolvedType: ChatMessageType =
    type || (cleanAudio ? 'audio' : cleanImage ? 'image' : 'text');
  const msgId = makeSafeId('msg');
  const msgPath = `chats/${chatId}/messages/${msgId}`;

  const docPayload: Record<string, unknown> = {
    id: msgId,
    senderId,
    participantIds,
    text: cleanText,
    type: resolvedType,
    createdAt: serverTimestamp(),
  };
  if (cleanImage) {
    docPayload.imageUrl = cleanImage;
  }
  if (cleanAudio) {
    docPayload.audioUrl = cleanAudio;
  }
  if (typeof audioDurationSec === 'number' && Number.isFinite(audioDurationSec)) {
    docPayload.audioDurationSec = Math.max(0, Math.min(120, Math.round(audioDurationSec)));
  }

  const lastMessage = buildLastMessagePreview({
    text: cleanText,
    imageUrl: cleanImage,
    audioUrl: cleanAudio,
    audioDurationSec,
  });

  try {
    await setDoc(doc(db, 'chats', chatId, 'messages', msgId), docPayload);
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage,
      lastMessageAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }
}

export async function deleteFirestoreChatThread(chatId: string, uid: string): Promise<void> {
  const chatPath = `chats/${chatId}`;
  try {
    const msgsQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      where('participantIds', 'array-contains', uid)
    );
    const snap = await getDocs(msgsQuery);
    if (!snap.empty) {
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, 'chats', chatId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, chatPath);
  }
}

export function subscribePurchases(
  uid: string,
  onData: (items: Purchase[]) => void
): () => void {
  const q = query(collection(db, 'purchases'), where('buyerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: Purchase[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          listingId: String(data.listingId ?? ''),
          listingTitle: String(data.listingTitle ?? ''),
          listingImage: String(data.listingImage ?? ''),
          priceUsd: Number(data.priceUsd ?? 0),
          buyerId: String(data.buyerId ?? ''),
          sellerId: String(data.sellerId ?? ''),
          sellerName: String(data.sellerName ?? ''),
          city: String(data.city ?? ''),
          state: String(data.state ?? ''),
          status: 'completed',
          createdAtMs: toMillis(data.createdAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      if (!auth.currentUser || auth.currentUser.uid !== uid) {
        return;
      }
      handleFirestoreError(error, OperationType.LIST, 'purchases');
    }
  );
}

export async function createFirestorePurchase(listing: Listing, buyerId: string): Promise<string> {
  const id = makeSafeId('pur');
  const path = `purchases/${id}`;
  try {
    await setDoc(doc(db, 'purchases', id), {
      id,
      listingId: listing.id,
      listingTitle: listing.title.slice(0, 100),
      listingImage: listing.imageUrl.slice(0, 350000),
      priceUsd: listing.priceUsd,
      buyerId,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName.slice(0, 80),
      city: listing.city.slice(0, 60),
      state: listing.state.slice(0, 60),
      status: 'completed',
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
