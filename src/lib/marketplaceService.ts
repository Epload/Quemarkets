import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ChatMessage,
  ChatThread,
  ItemCondition,
  Listing,
  Purchase,
  UserPreferences,
} from '../types/marketplace';
import { db, handleFirestoreError, OperationType } from './firebase';

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

export function subscribeListings(onData: (items: Listing[]) => void): () => void {
  const q = query(collection(db, 'listings'), where('status', 'in', ['active', 'sold']));
  return onSnapshot(
    q,
    (snap) => {
      const parsed: Listing[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          sellerId: String(data.sellerId ?? ''),
          sellerName: String(data.sellerName ?? 'Vendedor'),
          title: String(data.title ?? ''),
          description: String(data.description ?? ''),
          priceUsd: Number(data.priceUsd ?? 0),
          category: String(data.category ?? 'Otros'),
          condition: (data.condition as ItemCondition) ?? 'Usado',
          state: String(data.state ?? ''),
          city: String(data.city ?? ''),
          lat: Number(data.lat ?? 10.2469),
          lng: Number(data.lng ?? -67.5958),
          imageUrl: String(data.imageUrl ?? ''),
          status: data.status === 'sold' ? 'sold' : 'active',
          createdAtMs: toMillis(data.createdAt),
          source: 'firestore',
        };
      });
      parsed.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(parsed);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    }
  );
}

export async function createFirestoreListing(
  input: Omit<Listing, 'id' | 'status' | 'createdAtMs' | 'source'>
): Promise<string> {
  const id = makeSafeId('lst');
  const path = `listings/${id}`;
  try {
    await setDoc(doc(db, 'listings', id), {
      id,
      sellerId: input.sellerId,
      sellerName: input.sellerName.trim().slice(0, 80) || 'Vendedor',
      title: input.title.trim().slice(0, 100),
      description: input.description.trim().slice(0, 600),
      priceUsd: Math.min(1000000, Math.max(1, Number(input.priceUsd))),
      category: input.category.trim().slice(0, 50),
      condition: input.condition,
      state: input.state.trim().slice(0, 60),
      city: input.city.trim().slice(0, 60),
      lat: Number(input.lat),
      lng: Number(input.lng),
      imageUrl: input.imageUrl.slice(0, 350000),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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

export async function saveUserProfile(
  uid: string,
  prefs: UserPreferences,
  photoURL?: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      uid,
      displayName: prefs.displayName.trim().slice(0, 80) || 'Usuario Quemarket',
      city: prefs.city.trim().slice(0, 60),
      state: prefs.state.trim().slice(0, 60),
      customCategories: prefs.customCategories.slice(0, 12).map((c) => c.trim().slice(0, 50)),
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      payload.photoURL = photoURL.slice(0, 500);
    }
    await setDoc(doc(db, 'users', uid), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
        city: typeof d.city === 'string' ? d.city : undefined,
        state: typeof d.state === 'string' ? d.state : undefined,
        customCategories: Array.isArray(d.customCategories)
          ? d.customCategories.filter((x): x is string => typeof x === 'string')
          : undefined,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
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
      onData(threads);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    }
  );
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
        return {
          id: String(data.id ?? d.id),
          senderId: String(data.senderId ?? ''),
          participantIds: [String(participants[0] ?? ''), String(participants[1] ?? '')],
          text: String(data.text ?? ''),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      msgs.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(msgs);
    },
    (error) => {
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
}): Promise<void> {
  const { chatId, listing, buyerId, buyerName, firstMessage } = params;
  const participantIds: [string, string] = [buyerId, listing.sellerId];
  const chatPath = `chats/${chatId}`;
  try {
    await setDoc(doc(db, 'chats', chatId), {
      id: chatId,
      listingId: listing.id,
      listingTitle: listing.title.slice(0, 100),
      listingPrice: listing.priceUsd,
      listingImage: listing.imageUrl.slice(0, 350000),
      buyerId,
      buyerName: buyerName.trim().slice(0, 80) || 'Comprador',
      sellerId: listing.sellerId,
      sellerName: listing.sellerName.trim().slice(0, 80) || 'Vendedor',
      participantIds,
      lastMessage: firstMessage.trim().slice(0, 300),
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    const msgId = makeSafeId('msg');
    await setDoc(doc(db, 'chats', chatId, 'messages', msgId), {
      id: msgId,
      senderId: buyerId,
      participantIds,
      text: firstMessage.trim().slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, chatPath);
  }
}

export async function sendFirestoreChatMessage(params: {
  chatId: string;
  senderId: string;
  participantIds: [string, string];
  text: string;
}): Promise<void> {
  const { chatId, senderId, participantIds, text } = params;
  const cleanText = text.trim().slice(0, 500);
  if (!cleanText) return;
  const msgId = makeSafeId('msg');
  const msgPath = `chats/${chatId}/messages/${msgId}`;
  try {
    await setDoc(doc(db, 'chats', chatId, 'messages', msgId), {
      id: msgId,
      senderId,
      participantIds,
      text: cleanText,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: cleanText.slice(0, 300),
      lastMessageAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
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
