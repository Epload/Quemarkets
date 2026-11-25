import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AdminRoleRecord,
  AdminUserRecord,
  ChatThread,
  IdentityVerificationRecord,
  IdentityVerificationStatus,
  Listing,
  ListingStatus,
  PlatformSettings,
  Purchase,
} from '../types/marketplace';
import { BcvRateInfo } from './bcvService';
import { db, handleFirestoreError, OperationType } from './firebase';
import { parseFirestoreListingDoc } from './marketplaceService';

export const PRIMARY_ADMIN_EMAIL = 'admin@quemarket.com';
export const BOOTSTRAPPED_ADMIN_EMAILS = ['admin@quemarket.com', 'pagoestar@gmail.com'];

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  announcementEnabled: false,
  announcementText: '',
  allowNewListings: true,
  maintenanceMessage: '',
  updatedBy: PRIMARY_ADMIN_EMAIL,
  updatedAtMs: 0,
};

export interface AdminServerStatus {
  adminEmail: string;
  configured: boolean;
  mode: 'env' | 'claimed' | 'unconfigured';
}

export interface AdminSessionResult {
  token: string;
  email: string;
  expiresAtMs: number;
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export async function fetchAdminServerStatus(): Promise<AdminServerStatus> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/status`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('No se pudo consultar el estado del servicio de administración.');
  }
  return (await res.json()) as AdminServerStatus;
}

export async function setupAdminPassword(params: {
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<AdminSessionResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<AdminSessionResult> & {
    error?: string;
  };
  if (!res.ok || !data.token || !data.email) {
    throw new Error(data.error || 'No se pudo activar la clave de administrador.');
  }
  return {
    token: data.token,
    email: data.email,
    expiresAtMs: Number(data.expiresAtMs || Date.now() + 8 * 60 * 60 * 1000),
  };
}

export async function loginAdminServer(params: {
  email: string;
  password: string;
}): Promise<AdminSessionResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<AdminSessionResult> & {
    error?: string;
    needsSetup?: boolean;
  };
  if (!res.ok || !data.token || !data.email) {
    const err = new Error(data.error || 'Credenciales de administrador inválidas.') as Error & {
      needsSetup?: boolean;
    };
    err.needsSetup = data.needsSetup;
    throw err;
  }
  return {
    token: data.token,
    email: data.email,
    expiresAtMs: Number(data.expiresAtMs || Date.now() + 8 * 60 * 60 * 1000),
  };
}

export async function logoutAdminServer(token: string): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/admin/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore network failures on logout
  }
}

export async function fetchPlatformSettingsServer(): Promise<PlatformSettings | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/platform-settings`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PlatformSettings>;
    return {
      announcementEnabled: Boolean(data.announcementEnabled),
      announcementText: typeof data.announcementText === 'string' ? data.announcementText : '',
      allowNewListings: typeof data.allowNewListings === 'boolean' ? data.allowNewListings : true,
      maintenanceMessage: typeof data.maintenanceMessage === 'string' ? data.maintenanceMessage : '',
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : PRIMARY_ADMIN_EMAIL,
      updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function savePlatformSettingsServer(
  token: string,
  settings: Omit<PlatformSettings, 'updatedBy' | 'updatedAtMs'>
): Promise<PlatformSettings> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<PlatformSettings> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo guardar la configuración de la plataforma.');
  }
  return {
    announcementEnabled: Boolean(data.announcementEnabled),
    announcementText: typeof data.announcementText === 'string' ? data.announcementText : '',
    allowNewListings: typeof data.allowNewListings === 'boolean' ? data.allowNewListings : true,
    maintenanceMessage: typeof data.maintenanceMessage === 'string' ? data.maintenanceMessage : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : PRIMARY_ADMIN_EMAIL,
    updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : Date.now(),
  };
}

export async function refreshBcvRateAsAdmin(token: string): Promise<BcvRateInfo> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/bcv-refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as BcvRateInfo & { error?: string };
  if (!res.ok || typeof data.usdToVes !== 'number') {
    throw new Error(data.error || 'No se pudo actualizar la tasa oficial del BCV.');
  }
  return data;
}

// --- Server-side Listing Review Queue & 30-Minute Auto-Approval ---

export async function submitListingForReviewServer(
  listing: Omit<Listing, 'status' | 'createdAtMs'>
): Promise<Listing | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/listings/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listing),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { listing?: Listing };
    return data.listing ?? null;
  } catch {
    return null;
  }
}

export async function fetchPublicModeratedListingsServer(): Promise<{
  listings: Listing[];
  rejectedIds: string[];
}> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/listings/public`, { cache: 'no-store' });
    if (!res.ok) return { listings: [], rejectedIds: [] };
    const data = (await res.json()) as { listings?: Listing[]; rejectedIds?: string[] };
    return {
      listings: Array.isArray(data.listings) ? data.listings : [],
      rejectedIds: Array.isArray(data.rejectedIds) ? data.rejectedIds : [],
    };
  } catch {
    return { listings: [], rejectedIds: [] };
  }
}

export async function fetchListingStatusesServer(
  ids: string[]
): Promise<Record<string, { status: ListingStatus; autoApproveAtMs: number; soldAtMs?: number }>> {
  if (ids.length === 0) return {};
  try {
    const qs = encodeURIComponent(ids.slice(0, 40).join(','));
    const res = await fetch(`${getApiBaseUrl()}/api/listings/status?ids=${qs}`, {
      cache: 'no-store',
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      statuses?: Record<
        string,
        { status: ListingStatus; autoApproveAtMs: number; soldAtMs?: number }
      >;
    };
    return data.statuses || {};
  } catch {
    return {};
  }
}

export async function fetchAdminListingsServer(token: string): Promise<Listing[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/listings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { listings?: Listing[] };
  return Array.isArray(data.listings) ? data.listings : [];
}

export async function updateListingStatusServer(
  token: string,
  listingId: string,
  status: ListingStatus
): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/admin/listings/${encodeURIComponent(listingId)}/status`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'No se pudo actualizar el estado de la publicación.');
  }
}

export async function deleteListingServer(token: string, listingId: string): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/admin/listings/${encodeURIComponent(listingId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'No se pudo eliminar la publicación.');
  }
}

// --- Server-side Identity Verification (Selfie + Cédula) ---

export async function submitIdentityVerificationServer(params: {
  uid: string;
  displayName: string;
  city: string;
  state: string;
  selfieUrl: string;
  idCardUrl: string;
}): Promise<{ status: IdentityVerificationStatus; submittedAtMs?: number; updatedAtMs?: number }> {
  const res = await fetch(`${getApiBaseUrl()}/api/verifications/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: IdentityVerificationStatus;
    submittedAtMs?: number;
    updatedAtMs?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo enviar la solicitud de verificación.');
  }
  return {
    status: data.status || 'pending',
    submittedAtMs: data.submittedAtMs,
    updatedAtMs: data.updatedAtMs,
  };
}

export async function fetchMyIdentityVerificationServer(uid: string): Promise<{
  status: IdentityVerificationStatus;
  rejectionReason?: string;
  submittedAtMs?: number;
  updatedAtMs?: number;
} | null> {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/verifications/status?uid=${encodeURIComponent(uid)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: IdentityVerificationStatus;
      rejectionReason?: string;
      submittedAtMs?: number;
      updatedAtMs?: number;
    };
    const status: IdentityVerificationStatus =
      data.status === 'pending' || data.status === 'approved' || data.status === 'rejected'
        ? data.status
        : 'none';
    return {
      status,
      rejectionReason: typeof data.rejectionReason === 'string' ? data.rejectionReason : undefined,
      submittedAtMs: typeof data.submittedAtMs === 'number' ? data.submittedAtMs : undefined,
      updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchPublicVerifiedUidsServer(): Promise<string[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/verifications/public`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as { verifiedUids?: string[] };
    return Array.isArray(data.verifiedUids)
      ? data.verifiedUids.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function fetchAdminVerificationsServer(
  token: string
): Promise<IdentityVerificationRecord[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/admin/verifications`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as {
    verifications?: IdentityVerificationRecord[];
  };
  return Array.isArray(data.verifications)
    ? data.verifications.map((v) => ({ ...v, source: 'server' as const }))
    : [];
}

export async function decideIdentityVerificationServer(
  token: string,
  uid: string,
  decision: 'approved' | 'rejected',
  meta?: { rejectionReason?: string; displayName?: string; city?: string; state?: string }
): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/admin/verifications/${encodeURIComponent(uid)}/decision`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        decision,
        ...(meta?.rejectionReason ? { rejectionReason: meta.rejectionReason } : {}),
        ...(meta?.displayName ? { displayName: meta.displayName } : {}),
        ...(meta?.city ? { city: meta.city } : {}),
        ...(meta?.state ? { state: meta.state } : {}),
      }),
    }
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'No se pudo actualizar la verificación del usuario.');
  }
}

// --- Firebase RBAC Admin helpers ---

export async function checkIsFirebaseAdmin(params: {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}): Promise<boolean> {
  if (!params.emailVerified) return false;
  const cleanEmail = (params.email || '').trim().toLowerCase();
  if (BOOTSTRAPPED_ADMIN_EMAILS.includes(cleanEmail)) {
    return true;
  }
  try {
    const snap = await getDoc(doc(db, 'admins', params.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export function subscribeGlobalPlatformSettingsFirestore(
  onData: (settings: PlatformSettings) => void
): () => void {
  return onSnapshot(
    doc(db, 'admin_settings', 'global'),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      onData({
        announcementEnabled: Boolean(d.announcementEnabled),
        announcementText: typeof d.announcementText === 'string' ? d.announcementText : '',
        allowNewListings: typeof d.allowNewListings === 'boolean' ? d.allowNewListings : true,
        maintenanceMessage: typeof d.maintenanceMessage === 'string' ? d.maintenanceMessage : '',
        updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : PRIMARY_ADMIN_EMAIL,
        updatedAtMs: toMillis(d.updatedAt),
      });
    },
    () => {
      // Non-fatal if global settings document has not been initialized yet
    }
  );
}

export async function saveGlobalPlatformSettingsFirestore(
  settings: Omit<PlatformSettings, 'updatedBy' | 'updatedAtMs'>,
  updatedBy: string
): Promise<void> {
  const path = 'admin_settings/global';
  try {
    await setDoc(doc(db, 'admin_settings', 'global'), {
      announcementEnabled: Boolean(settings.announcementEnabled),
      announcementText: settings.announcementText.trim().slice(0, 280),
      allowNewListings: Boolean(settings.allowNewListings),
      maintenanceMessage: settings.maintenanceMessage.trim().slice(0, 280),
      updatedBy: updatedBy.trim().slice(0, 120) || PRIMARY_ADMIN_EMAIL,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAllUsersForAdmin(): Promise<AdminUserRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users: AdminUserRecord[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: String(data.uid ?? d.id),
        displayName: String(data.displayName ?? 'Usuario'),
        username: typeof data.username === 'string' ? data.username : undefined,
        age: typeof data.age === 'number' ? data.age : undefined,
        city: String(data.city ?? ''),
        state: String(data.state ?? ''),
        bio: typeof data.bio === 'string' ? data.bio : undefined,
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
        suspended: Boolean(data.suspended),
        identityVerified: Boolean(data.identityVerified),
        updatedAtMs: toMillis(data.updatedAt),
      };
    });
    users.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    return users;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function fetchAllAdminRoles(): Promise<AdminRoleRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: String(data.uid ?? d.id),
        email: String(data.email ?? ''),
        grantedBy: String(data.grantedBy ?? ''),
        createdAtMs: toMillis(data.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admins');
  }
}

export async function fetchAllPurchasesForAdmin(): Promise<Purchase[]> {
  try {
    const snap = await getDocs(collection(db, 'purchases'));
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
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'purchases');
  }
}

export async function fetchAllChatsForAdmin(): Promise<ChatThread[]> {
  try {
    const snap = await getDocs(collection(db, 'chats'));
    const threads: ChatThread[] = snap.docs.map((d) => {
      const data = d.data();
      const participants = Array.isArray(data.participantIds) ? data.participantIds : ['', ''];
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
        participantIds: [String(participants[0] ?? ''), String(participants[1] ?? '')],
        lastMessage: String(data.lastMessage ?? ''),
        lastMessageAtMs: toMillis(data.lastMessageAt),
        createdAtMs: toMillis(data.createdAt),
        source: 'firestore',
      };
    });
    threads.sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
    return threads;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'chats');
  }
}

export async function setUserSuspendedAsAdmin(uid: string, suspended: boolean): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      suspended,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function grantAdminRoleAsAdmin(
  uid: string,
  email: string,
  grantedBy: string
): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await setDoc(doc(db, 'admins', uid), {
      uid,
      email: email.trim().slice(0, 120) || 'admin@quemarket.com',
      grantedBy,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeAdminRoleAsAdmin(uid: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAllListingsForAdmin(): Promise<Listing[]> {
  try {
    const snap = await getDocs(collection(db, 'listings'));
    const items = snap.docs.map((d) =>
      parseFirestoreListingDoc(d.id, d.data() as Record<string, unknown>)
    );
    items.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'listings');
  }
}

export async function updateListingStatusAsAdmin(
  listingId: string,
  status: ListingStatus
): Promise<void> {
  const path = `listings/${listingId}`;
  try {
    await updateDoc(doc(db, 'listings', listingId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteListingAsAdmin(listingId: string): Promise<void> {
  const path = `listings/${listingId}`;
  try {
    await deleteDoc(doc(db, 'listings', listingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteChatAsAdmin(chatId: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const msgsSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
    if (!msgsSnap.empty) {
      const docs = msgsSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((m) => batch.delete(m.ref));
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, 'chats', chatId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAllIdentityVerificationsFirestore(): Promise<
  IdentityVerificationRecord[]
> {
  try {
    const snap = await getDocs(collection(db, 'identity_verifications'));
    const items: IdentityVerificationRecord[] = snap.docs.map((d) => {
      const data = d.data();
      const rawStatus = String(data.status || 'pending');
      const status: 'pending' | 'approved' | 'rejected' =
        rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';
      return {
        uid: String(data.uid ?? d.id),
        displayName: String(data.displayName ?? 'Usuario'),
        city: String(data.city ?? ''),
        state: String(data.state ?? ''),
        selfieUrl: typeof data.selfieUrl === 'string' ? data.selfieUrl : '',
        idCardUrl: typeof data.idCardUrl === 'string' ? data.idCardUrl : '',
        status,
        rejectionReason:
          typeof data.rejectionReason === 'string' ? data.rejectionReason : undefined,
        reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : undefined,
        submittedAtMs: toMillis(data.submittedAt),
        updatedAtMs: toMillis(data.updatedAt),
        source: 'firestore',
      };
    });
    items.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return b.submittedAtMs - a.submittedAtMs;
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'identity_verifications');
  }
}

export async function decideIdentityVerificationFirestore(
  uid: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
  rejectionReason?: string
): Promise<void> {
  const cleanReason = (rejectionReason || '').trim().slice(0, 240);
  const cleanReviewer = reviewedBy.trim().slice(0, 120) || PRIMARY_ADMIN_EMAIL;
  const verRef = doc(db, 'identity_verifications', uid);

  try {
    const verSnap = await getDoc(verRef);
    if (verSnap.exists()) {
      await updateDoc(verRef, {
        status: decision,
        reviewedBy: cleanReviewer,
        rejectionReason: decision === 'rejected' && cleanReason ? cleanReason : deleteField(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `identity_verifications/${uid}`);
  }

  const isVerified = decision === 'approved';
  await updateDoc(doc(db, 'users', uid), {
    identityVerified: isVerified,
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  await updateDoc(doc(db, 'sellers', uid), {
    identityVerified: isVerified,
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}

