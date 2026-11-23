import React, { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { MapPin, SlidersHorizontal } from 'lucide-react';
import { BottomDock } from './components/BottomDock';
import { ChatsView } from './components/ChatsView';
import { CityPickerSheet } from './components/CityPickerSheet';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingLocation } from './components/OnboardingLocation';
import { ProductCard } from './components/ProductCard';
import { ProductDetailSheet } from './components/ProductDetailSheet';
import { ProfileView } from './components/ProfileView';
import { QuemarketLogo } from './components/QuemarketLogo';
import { SearchSheet } from './components/SearchSheet';
import { SellSheet } from './components/SellSheet';
import {
  BASE_CATEGORIES,
  buildSeedListings,
  DEFAULT_CITY,
  getDistanceKm,
} from './data/venezuela';
import { auth, googleProvider, testConnection } from './lib/firebase';
import {
  createFirestoreChatThread,
  createFirestoreListing,
  createFirestorePurchase,
  deleteFirestoreListing,
  makeSafeId,
  markFirestoreListingSold,
  saveUserProfile,
  sendFirestoreChatMessage,
  subscribeChatMessages,
  subscribeListings,
  subscribePurchases,
  subscribeUserChats,
  subscribeUserProfile,
} from './lib/marketplaceService';
import {
  ChatMessage,
  ChatThread,
  CityLocation,
  DockTab,
  Listing,
  ProximityOption,
  Purchase,
} from './types/marketplace';

const STORAGE_CITY_KEY = 'mercao_user_city_v1';
const STORAGE_ONBOARDED_KEY = 'mercao_onboarded_v1';
const STORAGE_CUSTOM_CATS_KEY = 'mercao_custom_cats_v1';
const STORAGE_LOCAL_LISTINGS_KEY = 'mercao_local_listings_v1';
const STORAGE_LOCAL_PURCHASES_KEY = 'mercao_local_purchases_v1';
const STORAGE_LOCAL_CHATS_KEY = 'mercao_local_chats_v1';
const STORAGE_LOCAL_MSGS_KEY = 'mercao_local_msgs_v1';

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean>(() =>
    readJsonStorage<boolean>(STORAGE_ONBOARDED_KEY, false)
  );
  const [userCity, setUserCity] = useState<CityLocation>(() =>
    readJsonStorage<CityLocation>(STORAGE_CITY_KEY, DEFAULT_CITY)
  );
  const [customCategories, setCustomCategories] = useState<string[]>(() =>
    readJsonStorage<string[]>(STORAGE_CUSTOM_CATS_KEY, ['Tecnología', 'Hogar'])
  );

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [activeTab, setActiveTab] = useState<DockTab>('market');

  // Bottom sheets
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [sellSheetOpen, setSellSheetOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<string>('Todos');
  const [filterCity, setFilterCity] = useState<string>('Todas');
  const [filterCategory, setFilterCategory] = useState<string>('Todas');
  const [proximity, setProximity] = useState<ProximityOption>('country');

  // Data stores (Cloud Firestore + Instant Local)
  const [cloudListings, setCloudListings] = useState<Listing[]>([]);
  const [localListings, setLocalListings] = useState<Listing[]>(() =>
    readJsonStorage<Listing[]>(STORAGE_LOCAL_LISTINGS_KEY, [])
  );
  const [cloudPurchases, setCloudPurchases] = useState<Purchase[]>([]);
  const [localPurchases, setLocalPurchases] = useState<Purchase[]>(() =>
    readJsonStorage<Purchase[]>(STORAGE_LOCAL_PURCHASES_KEY, [])
  );
  const [cloudThreads, setCloudThreads] = useState<ChatThread[]>([]);
  const [localThreads, setLocalThreads] = useState<ChatThread[]>(() =>
    readJsonStorage<ChatThread[]>(STORAGE_LOCAL_CHATS_KEY, [])
  );
  const [cloudMessages, setCloudMessages] = useState<Record<string, ChatMessage[]>>({});
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>(() =>
    readJsonStorage<Record<string, ChatMessage[]>>(STORAGE_LOCAL_MSGS_KEY, {})
  );
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const currentUserId = firebaseUser?.uid || 'local_user_ve';
  const currentUserName =
    firebaseUser?.displayName ||
    firebaseUser?.email?.split('@')[0] ||
    'Usuario Quemarket';
  const isCloudVerified = Boolean(firebaseUser && firebaseUser.emailVerified);

  // Persist local preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_CITY_KEY, JSON.stringify(userCity));
  }, [userCity]);

  useEffect(() => {
    localStorage.setItem(STORAGE_ONBOARDED_KEY, JSON.stringify(onboarded));
  }, [onboarded]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CUSTOM_CATS_KEY, JSON.stringify(customCategories));
  }, [customCategories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOCAL_LISTINGS_KEY, JSON.stringify(localListings));
  }, [localListings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOCAL_PURCHASES_KEY, JSON.stringify(localPurchases));
  }, [localPurchases]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOCAL_CHATS_KEY, JSON.stringify(localThreads));
  }, [localThreads]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOCAL_MSGS_KEY, JSON.stringify(localMessages));
  }, [localMessages]);

  // Boot Firestore connection & public listings listener
  useEffect(() => {
    testConnection();
    const unsubListings = subscribeListings((items) => {
      setCloudListings(items);
    });
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => {
      unsubListings();
      unsubAuth();
    };
  }, []);

  // Private user listeners when authenticated
  useEffect(() => {
    if (!firebaseUser) {
      setCloudChatsReset();
      return;
    }

    const unsubProfile = subscribeUserProfile(firebaseUser.uid, (profile) => {
      if (profile?.customCategories && profile.customCategories.length > 0) {
        setCustomCategories(profile.customCategories);
      }
    });
    const unsubChats = subscribeUserChats(firebaseUser.uid, (threads) => {
      setCloudThreads(threads);
    });
    const unsubPurchases = subscribePurchases(firebaseUser.uid, (items) => {
      setCloudPurchases(items);
    });

    return () => {
      unsubProfile();
      unsubChats();
      unsubPurchases();
    };
  }, [firebaseUser]);

  function setCloudChatsReset() {
    setCloudThreads([]);
    setCloudPurchases([]);
    setCloudMessages({});
  }

  // Subscribe to messages for the active Firestore thread
  useEffect(() => {
    if (!firebaseUser || !activeThreadId) return;
    const isCloudThread = cloudThreads.some((t) => t.id === activeThreadId);
    if (!isCloudThread) return;

    const unsub = subscribeChatMessages(activeThreadId, firebaseUser.uid, (msgs) => {
      setCloudMessages((prev) => ({ ...prev, [activeThreadId]: msgs }));
    });
    return () => unsub();
  }, [firebaseUser, activeThreadId, cloudThreads]);

  // Seed listings adapted to user's confirmed city + local + cloud listings
  const seedListings = useMemo(() => buildSeedListings(userCity), [userCity]);

  const allActiveListings = useMemo(() => {
    const merged = [...cloudListings, ...localListings, ...seedListings];
    return merged.filter((item) => item.status === 'active');
  }, [cloudListings, localListings, seedListings]);

  const myListings = useMemo(() => {
    const mine = [...cloudListings, ...localListings].filter(
      (item) => item.sellerId === currentUserId || item.sellerId === 'local_user_ve'
    );
    return mine.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [cloudListings, localListings, currentUserId]);

  const allThreads = useMemo(() => {
    const merged = [...cloudThreads, ...localThreads];
    return merged.sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
  }, [cloudThreads, localThreads]);

  const allMessagesByThread = useMemo(
    () => ({ ...localMessages, ...cloudMessages }),
    [localMessages, cloudMessages]
  );

  const allPurchases = useMemo(() => {
    return [...cloudPurchases, ...localPurchases].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [cloudPurchases, localPurchases]);

  // Compute filtered & proximity-sorted listings
  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const withDist = allActiveListings.map((item) => ({
      item,
      dist: getDistanceKm(userCity.lat, userCity.lng, item.lat, item.lng),
    }));

    const filtered = withDist.filter(({ item, dist }) => {
      if (q) {
        const hay = `${item.title} ${item.description} ${item.category} ${item.city} ${item.state}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterState !== 'Todos' && item.state !== filterState) return false;
      if (filterCity !== 'Todas' && item.city !== filterCity) return false;
      if (filterCategory !== 'Todas' && item.category !== filterCategory) return false;

      if (proximity === '5km' && dist > 5) return false;
      if (proximity === '15km' && dist > 15) return false;
      if (proximity === '50km' && dist > 50) return false;
      if (proximity === 'state' && item.state !== (filterState === 'Todos' ? userCity.state : filterState)) {
        return false;
      }
      return true;
    });

    // Prioritize local city & custom categories naturally
    filtered.sort((a, b) => {
      const aFav = customCategories.includes(a.item.category) ? 1 : 0;
      const bFav = customCategories.includes(b.item.category) ? 1 : 0;
      if (a.item.city === userCity.city && b.item.city !== userCity.city) return -1;
      if (b.item.city === userCity.city && a.item.city !== userCity.city) return 1;
      if (aFav !== bFav) return bFav - aFav;
      return a.dist - b.dist;
    });

    return filtered;
  }, [
    allActiveListings,
    userCity,
    searchQuery,
    filterState,
    filterCity,
    filterCategory,
    proximity,
    customCategories,
  ]);

  const orderedQuickCategories = useMemo(() => {
    const merged = Array.from(new Set([...customCategories, ...BASE_CATEGORIES]));
    return ['Todas', ...merged];
  }, [customCategories]);

  // Handlers
  const handleConfirmOnboarding = (loc: CityLocation) => {
    setUserCity(loc);
    setOnboarded(true);
    if (firebaseUser && firebaseUser.emailVerified) {
      saveUserProfile(
        firebaseUser.uid,
        {
          city: loc.city,
          state: loc.state,
          lat: loc.lat,
          lng: loc.lng,
          customCategories,
          displayName: currentUserName,
        },
        firebaseUser.photoURL || undefined
      ).catch(() => {});
    }
  };

  const handleCityChange = (loc: CityLocation) => {
    setUserCity(loc);
    if (firebaseUser && firebaseUser.emailVerified) {
      saveUserProfile(
        firebaseUser.uid,
        {
          city: loc.city,
          state: loc.state,
          lat: loc.lat,
          lng: loc.lng,
          customCategories,
          displayName: currentUserName,
        },
        firebaseUser.photoURL || undefined
      ).catch(() => {});
    }
  };

  const handleDockSelect = (tab: DockTab) => {
    if (tab === 'sell') {
      setSellSheetOpen(true);
      return;
    }
    if (tab === 'market') {
      setSearchSheetOpen(false);
      setSellSheetOpen(false);
      setActiveThreadId(null);
      setActiveTab('market');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (tab === 'search') {
      setActiveTab('search');
      setSearchSheetOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const handlePublish = async (
    data: Omit<Listing, 'id' | 'sellerId' | 'sellerName' | 'status' | 'createdAtMs' | 'source'>
  ) => {
    if (isCloudVerified && firebaseUser) {
      await createFirestoreListing({
        ...data,
        sellerId: firebaseUser.uid,
        sellerName: currentUserName,
      });
    } else {
      const localItem: Listing = {
        ...data,
        id: makeSafeId('loc'),
        sellerId: currentUserId,
        sellerName: currentUserName,
        status: 'active',
        createdAtMs: Date.now(),
        source: 'local',
      };
      setLocalListings((prev) => [localItem, ...prev]);
    }
    setActiveTab('market');
  };

  const handleMarkSold = async (listing: Listing) => {
    if (listing.source === 'firestore' && firebaseUser) {
      await markFirestoreListingSold(listing.id);
    } else {
      setLocalListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, status: 'sold' } : l))
      );
    }
  };

  const handleDeleteListing = async (listing: Listing) => {
    if (listing.source === 'firestore' && firebaseUser) {
      await deleteFirestoreListing(listing.id);
    } else {
      setLocalListings((prev) => prev.filter((l) => l.id !== listing.id));
    }
  };

  const handleStartChat = async (listing: Listing) => {
    const existing = allThreads.find(
      (t) =>
        t.listingId === listing.id &&
        (t.buyerId === currentUserId || t.buyerId === 'local_user_ve')
    );
    if (existing) {
      setActiveThreadId(existing.id);
      setActiveTab('chats');
      return;
    }

    const firstMsg = `Hola ${listing.sellerName.split(' ')[0]}, me interesa "${listing.title}". ¿Sigue disponible?`;
    const chatId = makeSafeId('chat');

    if (firebaseUser && listing.source === 'firestore' && listing.sellerId !== firebaseUser.uid) {
      await createFirestoreChatThread({
        chatId,
        listing,
        buyerId: firebaseUser.uid,
        buyerName: firebaseUser.displayName || 'Comprador',
        firstMessage: firstMsg,
      });
      setActiveThreadId(chatId);
      setActiveTab('chats');
      return;
    }

    // Local / showcase seamless WhatsApp-style thread
    const now = Date.now();
    const newThread: ChatThread = {
      id: chatId,
      listingId: listing.id,
      listingTitle: listing.title,
      listingPrice: listing.priceUsd,
      listingImage: listing.imageUrl,
      buyerId: currentUserId,
      buyerName: currentUserName,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      participantIds: [currentUserId, listing.sellerId],
      lastMessage: firstMsg,
      lastMessageAtMs: now,
      createdAtMs: now,
      source: 'local',
    };

    const initialMessage: ChatMessage = {
      id: makeSafeId('msg'),
      senderId: currentUserId,
      participantIds: [currentUserId, listing.sellerId],
      text: firstMsg,
      createdAtMs: now,
    };

    setLocalThreads((prev) => [newThread, ...prev]);
    setLocalMessages((prev) => ({ ...prev, [chatId]: [initialMessage] }));
    setActiveThreadId(chatId);
    setActiveTab('chats');

    // Quick realistic seller reply for showcase listings
    setTimeout(() => {
      const replyText = `¡Hola! Sí, aún está disponible en ${listing.city}. Acepto Pago Móvil, Zelle o efectivo.`;
      const replyMsg: ChatMessage = {
        id: makeSafeId('msg'),
        senderId: listing.sellerId,
        participantIds: [currentUserId, listing.sellerId],
        text: replyText,
        createdAtMs: Date.now(),
      };
      setLocalMessages((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), replyMsg],
      }));
      setLocalThreads((prev) =>
        prev.map((t) =>
          t.id === chatId ? { ...t, lastMessage: replyText, lastMessageAtMs: Date.now() } : t
        )
      );
    }, 900);
  };

  const handleSendMessage = async (thread: ChatThread, text: string) => {
    if (thread.source === 'firestore' && firebaseUser) {
      await sendFirestoreChatMessage({
        chatId: thread.id,
        senderId: firebaseUser.uid,
        participantIds: thread.participantIds,
        text,
      });
      return;
    }

    const now = Date.now();
    const msg: ChatMessage = {
      id: makeSafeId('msg'),
      senderId: currentUserId,
      participantIds: thread.participantIds,
      text,
      createdAtMs: now,
    };
    setLocalMessages((prev) => ({
      ...prev,
      [thread.id]: [...(prev[thread.id] || []), msg],
    }));
    setLocalThreads((prev) =>
      prev.map((t) =>
        t.id === thread.id ? { ...t, lastMessage: text, lastMessageAtMs: now } : t
      )
    );
  };

  const handleBuyNow = async (listing: Listing) => {
    if (firebaseUser && listing.source === 'firestore') {
      await createFirestorePurchase(listing, firebaseUser.uid);
      return;
    }

    const newPurchase: Purchase = {
      id: makeSafeId('pur'),
      listingId: listing.id,
      listingTitle: listing.title,
      listingImage: listing.imageUrl,
      priceUsd: listing.priceUsd,
      buyerId: currentUserId,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      city: listing.city,
      state: listing.state,
      status: 'completed',
      createdAtMs: Date.now(),
    };
    setLocalPurchases((prev) => [newPurchase, ...prev]);
  };

  const handleToggleCustomCategory = (cat: string) => {
    setCustomCategories((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat].slice(0, 12);
      if (isCloudVerified && firebaseUser) {
        saveUserProfile(
          firebaseUser.uid,
          {
            city: userCity.city,
            state: userCity.state,
            lat: userCity.lat,
            lng: userCity.lng,
            customCategories: next,
            displayName: currentUserName,
          },
          firebaseUser.photoURL || undefined
        ).catch(() => {});
      }
      return next;
    });
  };

  const handleAddCustomCategory = (cat: string) => {
    setCustomCategories((prev) => {
      if (prev.includes(cat) || prev.length >= 12) return prev;
      const next = [...prev, cat];
      if (isCloudVerified && firebaseUser) {
        saveUserProfile(
          firebaseUser.uid,
          {
            city: userCity.city,
            state: userCity.state,
            lat: userCity.lat,
            lng: userCity.lng,
            customCategories: next,
            displayName: currentUserName,
          },
          firebaseUser.photoURL || undefined
        ).catch(() => {});
      }
      return next;
    });
  };

  const handleSignInGoogle = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(
      res.user.uid,
      {
        city: userCity.city,
        state: userCity.state,
        lat: userCity.lat,
        lng: userCity.lng,
        customCategories,
        displayName: res.user.displayName || 'Usuario Quemarket',
      },
      res.user.photoURL || undefined
    );
  };

  const handleSignInEmail = async (
    email: string,
    password: string,
    mode: 'login' | 'register'
  ) => {
    if (mode === 'register') {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const fallbackName = email.split('@')[0] || 'Usuario Quemarket';
      await updateProfile(cred.user, { displayName: fallbackName });
      await sendEmailVerification(cred.user);
      return;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (cred.user.emailVerified) {
      await saveUserProfile(
        cred.user.uid,
        {
          city: userCity.city,
          state: userCity.state,
          lat: userCity.lat,
          lng: userCity.lng,
          customCategories,
          displayName: cred.user.displayName || email.split('@')[0] || 'Usuario Quemarket',
        },
        cred.user.photoURL || undefined
      );
    }
  };

  const handleResendVerification = async () => {
    if (firebaseUser && !firebaseUser.emailVerified) {
      await sendEmailVerification(firebaseUser);
    }
  };

  const handleSignOut = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    setActiveThreadId(null);
    setActiveTab('market');
    setOnboarded(false);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterState('Todos');
    setFilterCity('Todas');
    setFilterCategory('Todas');
    setProximity('country');
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    filterState !== 'Todos' ||
    filterCity !== 'Todas' ||
    filterCategory !== 'Todas' ||
    proximity !== 'country';

  if (!onboarded) {
    return (
      <ErrorBoundary>
        <OnboardingLocation
          firebaseUser={firebaseUser}
          initialCity={userCity}
          onSignInGoogle={handleSignInGoogle}
          onSignInEmail={handleSignInEmail}
          onConfirm={handleConfirmOnboarding}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] bg-[#FAFAFC] text-[#141118] flex flex-col">
        {/* Compact Sticky Top Bar (<= 54px) */}
        <header className="sticky top-0 z-30 h-[54px] bg-white/88 backdrop-blur-md border-b border-zinc-200/70">
          <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('market');
                setActiveThreadId(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="whitespace-nowrap shrink-0"
            >
              <QuemarketLogo size="sm" />
            </button>

            <button
              type="button"
              onClick={() => setCityPickerOpen(true)}
              className="h-9 px-3 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-xs font-semibold text-[#141118] inline-flex items-center gap-1.5 transition-colors max-w-[200px]"
            >
              <MapPin className="w-3.5 h-3.5 text-[#6B4E8E] shrink-0" />
              <span className="truncate">
                {userCity.city}, {userCity.state}
              </span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-4 pb-24">
          {(activeTab === 'market' || activeTab === 'search') && (
            <div className="space-y-4">
              {/* Quick category & filter row */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchSheetOpen(true)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                    hasActiveFilters
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-white border border-zinc-200/80 text-[#141118] hover:bg-zinc-50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filtros
                </button>

                <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {orderedQuickCategories.map((cat) => {
                    const active = filterCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFilterCategory(cat)}
                        className={`h-9 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                          active
                            ? 'bg-[#362B3D] text-white'
                            : 'bg-white border border-zinc-200/80 text-zinc-600 hover:text-[#141118]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clean section header */}
              <div className="flex items-baseline justify-between px-0.5">
                <h1 className="font-display text-lg font-bold text-[#141118] truncate">
                  {filterCity !== 'Todas'
                    ? `En ${filterCity}`
                    : filterState !== 'Todos'
                      ? `Estado ${filterState}`
                      : `Cerca de ${userCity.city}`}
                </h1>
                <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                  {filteredListings.length}{' '}
                  {filteredListings.length === 1 ? 'artículo' : 'artículos'}
                </span>
              </div>

              {/* Product Grid */}
              {filteredListings.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {filteredListings.map(({ item, dist }) => (
                    <ProductCard
                      key={item.id}
                      listing={item}
                      distanceKm={dist}
                      onSelect={setSelectedListing}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-[26px] border border-zinc-200/75 p-8 text-center space-y-3">
                  <p className="font-display text-base font-bold text-[#141118]">
                    Sin resultados con estos filtros
                  </p>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                    Prueba ampliar el radio de proximidad o cambiar de estado.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="h-10 px-5 rounded-xl bg-[#362B3D] text-white text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Mostrar todo en Venezuela
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chats' && (
            <ChatsView
              currentUserId={currentUserId}
              threads={allThreads}
              activeThreadId={activeThreadId}
              onSelectThread={setActiveThreadId}
              messagesByThread={allMessagesByThread}
              onSendMessage={handleSendMessage}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              firebaseUser={firebaseUser}
              displayName={currentUserName}
              userCity={userCity}
              customCategories={customCategories}
              myListings={myListings}
              purchases={allPurchases}
              onSignInGoogle={handleSignInGoogle}
              onSignOut={handleSignOut}
              onOpenCityPicker={() => setCityPickerOpen(true)}
              onToggleCustomCategory={handleToggleCustomCategory}
              onAddCustomCategory={handleAddCustomCategory}
              onMarkListingSold={handleMarkSold}
              onDeleteListing={handleDeleteListing}
              onOpenSell={() => setSellSheetOpen(true)}
              onResendVerification={handleResendVerification}
            />
          )}
        </main>

        {/* Single 5-Button Bottom Dock anchored flush to bottom (hidden inside open chat room) */}
        {!(activeTab === 'chats' && activeThreadId !== null) && (
          <BottomDock
            activeTab={activeTab}
            onSelectTab={handleDockSelect}
            unreadCount={allThreads.length}
          />
        )}

        {/* Bottom Sheets rising from the dock */}
        <SearchSheet
          open={searchSheetOpen}
          onClose={() => {
            setSearchSheetOpen(false);
            if (activeTab === 'search') setActiveTab('market');
          }}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedState={filterState}
          onSelectState={setFilterState}
          selectedCity={filterCity}
          onSelectCity={setFilterCity}
          selectedCategory={filterCategory}
          onSelectCategory={setFilterCategory}
          proximity={proximity}
          onSelectProximity={setProximity}
          customCategories={customCategories}
          resultCount={filteredListings.length}
          onReset={resetFilters}
        />

        <SellSheet
          open={sellSheetOpen}
          onClose={() => setSellSheetOpen(false)}
          userCity={userCity}
          customCategories={customCategories}
          onPublish={handlePublish}
        />

        <CityPickerSheet
          open={cityPickerOpen}
          onClose={() => setCityPickerOpen(false)}
          currentCity={userCity}
          onSelectCity={handleCityChange}
        />

        <ProductDetailSheet
          listing={selectedListing}
          distanceKm={
            selectedListing
              ? getDistanceKm(userCity.lat, userCity.lng, selectedListing.lat, selectedListing.lng)
              : undefined
          }
          isOwnListing={
            Boolean(selectedListing) &&
            (selectedListing?.sellerId === currentUserId ||
              selectedListing?.sellerId === 'local_user_ve')
          }
          onClose={() => setSelectedListing(null)}
          onStartChat={handleStartChat}
          onBuyNow={handleBuyNow}
        />
      </div>
    </ErrorBoundary>
  );
}
