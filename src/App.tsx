import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ChevronDown,
  LayoutGrid,
  MapPin,
  Megaphone,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AdminAuthSheet } from './components/AdminAuthSheet';
import { AdminPanel } from './components/AdminPanel';
import { BottomDock } from './components/BottomDock';
import { CategoryPickerSheet } from './components/CategoryPickerSheet';
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
import { SellerProfileSheet } from './components/SellerProfileSheet';
import { ShareToSellSheet } from './components/ShareToSellSheet';
import {
  DEFAULT_CITY,
  getDistanceKm,
} from './data/venezuela';
import { initCapacitorShell, registerNativeBackButton } from './lib/capacitorApp';
import { auth, googleProvider, testConnection } from './lib/firebase';
import {
  claimUsername,
  createFirestoreChatThread,
  createFirestoreListing,
  deleteFirestoreChatThread,
  deleteFirestoreListing,
  fetchPublicSeller,
  fetchUserProfile,
  findExistingFirestoreChatThread,
  isUsernameAvailable,
  LEGAL_TERMS_VERSION,
  LISTING_REVIEW_AUTO_APPROVE_MS,
  makeSafeId,
  markFirestoreListingSold,
  promoteFirestoreListingAfterReviewWindow,
  saveUserProfile,
  sendFirestoreChatMessage,
  submitFirestoreIdentityVerification,
  subscribeChatMessages,
  subscribeListings,
  subscribeMyIdentityVerification,
  subscribePurchases,
  subscribeSellerListings,
  subscribeUserChats,
  subscribeUserProfile,
} from './lib/marketplaceService';
import {
  areAllAppPermissionsGranted,
  probeAppPermissions,
} from './lib/nativePermissions';
import {
  dispatchChatPushNotification,
  initPushNotificationChannel,
  setPushOpenThreadHandler,
} from './lib/pushNotifications';
import {
  AdminSessionResult,
  checkIsFirebaseAdmin,
  DEFAULT_PLATFORM_SETTINGS,
  fetchAdminServerStatus,
  fetchListingStatusesServer,
  fetchMyIdentityVerificationServer,
  fetchPlatformSettingsServer,
  fetchPublicModeratedListingsServer,
  fetchPublicVerifiedUidsServer,
  loginAdminServer,
  logoutAdminServer,
  PRIMARY_ADMIN_EMAIL,
  submitIdentityVerificationServer,
  submitListingForReviewServer,
  subscribeGlobalPlatformSettingsFirestore,
} from './lib/adminService';
import {
  ChatMessage,
  ChatMessagePayload,
  ChatThread,
  CityLocation,
  DockTab,
  EmailRegistrationPayload,
  IdentityVerificationStatus,
  Listing,
  ListingStatus,
  PlatformSettings,
  ProximityOption,
  PublicSellerProfile,
  Purchase,
  UserPreferences,
} from './types/marketplace';

const STORAGE_CITY_KEY = 'mercao_user_city_v1';
const STORAGE_ONBOARDED_KEY = 'mercao_onboarded_v1';
const STORAGE_LOCATION_CONFIRMED_KEY = 'quemarket_location_confirmed_v1';
const STORAGE_CUSTOM_CATS_KEY = 'mercao_custom_cats_v1';
const STORAGE_PENDING_REG_PREFIX = 'mercao_pending_reg_v1_';
const STORAGE_SELL_UNLOCK_PREFIX = 'quemarket_sell_unlock_v1_';
const STORAGE_CHAT_READS_PREFIX = 'quemarket_chat_reads_v1_';
const LEGACY_LOCAL_STORAGE_KEYS = [
  'mercao_local_listings_v1',
  'mercao_local_purchases_v1',
  'mercao_local_chats_v1',
  'mercao_local_msgs_v1',
];

interface SellUnlockState {
  unlocked: boolean;
  unlockAtMs: number;
}

interface PendingRegistrationMeta {
  username: string;
  age: number;
  termsAccepted: boolean;
  termsVersion: string;
}

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
  const [hasConfirmedLocation, setHasConfirmedLocation] = useState<boolean>(() => {
    const stored = readJsonStorage<boolean | null>(STORAGE_LOCATION_CONFIRMED_KEY, null);
    if (stored !== null) return stored;
    return readJsonStorage<boolean>(STORAGE_ONBOARDED_KEY, false);
  });
  const [needsMissingPermissionsPrompt, setNeedsMissingPermissionsPrompt] = useState(false);
  const [permissionsCheckedThisSession, setPermissionsCheckedThisSession] = useState(false);
  const [userCity, setUserCity] = useState<CityLocation>(() =>
    readJsonStorage<CityLocation>(STORAGE_CITY_KEY, DEFAULT_CITY)
  );
  const [customCategories, setCustomCategories] = useState<string[]>(() =>
    readJsonStorage<string[]>(STORAGE_CUSTOM_CATS_KEY, [])
  );

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('market');

  // Bottom sheets
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [sellSheetOpen, setSellSheetOpen] = useState(false);
  const [shareToSellOpen, setShareToSellOpen] = useState(false);
  const [sellUnlockAtMs, setSellUnlockAtMs] = useState<number>(() => Date.now() + 30 * 60 * 1000);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [sellerSheetProfile, setSellerSheetProfile] = useState<PublicSellerProfile | null>(null);
  const [sellerCache, setSellerCache] = useState<Record<string, PublicSellerProfile>>({});

  // Admin state (Bearer token stays strictly in React memory, never in Web Storage)
  const [adminSession, setAdminSession] = useState<AdminSessionResult | null>(null);
  const [configuredAdminEmail, setConfiguredAdminEmail] = useState<string>(PRIMARY_ADMIN_EMAIL);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS
  );
  const [sellBlockNotice, setSellBlockNotice] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<string>('Todos');
  const [filterCity, setFilterCity] = useState<string>('Todas');
  const [filterCategory, setFilterCategory] = useState<string>('Todas');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('Todas');
  const [proximity, setProximity] = useState<ProximityOption>('country');

  // Cloud Firestore data stores + Server moderation mirror
  const [cloudListings, setCloudListings] = useState<Listing[]>([]);
  const [myCloudListings, setMyCloudListings] = useState<Listing[]>([]);
  const [serverPublicListings, setServerPublicListings] = useState<Listing[]>([]);
  const [serverRejectedIds, setServerRejectedIds] = useState<string[]>([]);
  const [serverStatusMap, setServerStatusMap] = useState<
    Record<string, { status: ListingStatus; autoApproveAtMs: number; soldAtMs?: number }>
  >({});
  const promotedFirestoreIdsRef = useRef<Set<string>>(new Set());
  const [cloudPurchases, setCloudPurchases] = useState<Purchase[]>([]);
  const [cloudThreads, setCloudThreads] = useState<ChatThread[]>([]);
  const [cloudMessages, setCloudMessages] = useState<Record<string, ChatMessage[]>>({});
  const [cloudProfileMeta, setCloudProfileMeta] = useState<Partial<UserPreferences> | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [pendingRegMeta, setPendingRegMeta] = useState<PendingRegistrationMeta | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Identity Verification state (users start unverified until admin approves selfie + cédula)
  const [serverVerifiedUids, setServerVerifiedUids] = useState<string[]>([]);
  const [myServerVerification, setMyServerVerification] = useState<{
    status: IdentityVerificationStatus;
    rejectionReason?: string;
    updatedAtMs?: number;
  }>({ status: 'none' });
  const [myCloudVerification, setMyCloudVerification] = useState<{
    status: IdentityVerificationStatus;
    rejectionReason?: string;
    updatedAtMs?: number;
  }>({ status: 'none' });

  const currentUserId = firebaseUser?.uid || '';
  const [chatReadMap, setChatReadMap] = useState<Record<string, number>>({});
  const [cloudChatsHydrated, setCloudChatsHydrated] = useState(false);
  const knownThreadTimestampsRef = useRef<Record<string, number>>({});
  const pushWarmupUserRef = useRef<string | null>(null);
  const lastSentByMeRef = useRef<Record<string, number>>({});
  const startingChatRef = useRef<boolean>(false);
  const privateUnsubsRef = useRef<(() => void)[]>([]);
  const activeChatMsgUnsubRef = useRef<(() => void) | null>(null);
  const signingOutRef = useRef<boolean>(false);

  const teardownPrivateListeners = () => {
    for (const unsub of privateUnsubsRef.current) {
      try {
        unsub();
      } catch {
        // ignore listener cleanup errors
      }
    }
    privateUnsubsRef.current = [];
    if (activeChatMsgUnsubRef.current) {
      try {
        activeChatMsgUnsubRef.current();
      } catch {
        // ignore listener cleanup errors
      }
      activeChatMsgUnsubRef.current = null;
    }
  };

  const isMySellerId = (sellerId?: string | null): boolean => {
    return Boolean(firebaseUser && sellerId && sellerId === firebaseUser.uid);
  };

  const isMyChatThread = (thread: ChatThread, uid: string): boolean => {
    if (!thread || !uid) return false;
    if (!thread.buyerId || !thread.sellerId || thread.buyerId === thread.sellerId) return false;
    return thread.buyerId === uid || thread.sellerId === uid;
  };

  useEffect(() => {
    setChatReadMap(
      currentUserId
        ? readJsonStorage<Record<string, number>>(`${STORAGE_CHAT_READS_PREFIX}${currentUserId}`, {})
        : {}
    );
    setActiveThreadId(null);
    setSelectedListing(null);
    setSellerSheetProfile(null);
    setMyServerVerification({ status: 'none' });
    setSellBlockNotice(null);
    knownThreadTimestampsRef.current = {};
    lastSentByMeRef.current = {};
    pushWarmupUserRef.current = null;
  }, [currentUserId]);

  const lockedUsername = cloudProfileMeta?.username || pendingRegMeta?.username;
  const currentUserName =
    lockedUsername ||
    firebaseUser?.displayName ||
    firebaseUser?.email?.split('@')[0] ||
    'Usuario Quemarket';
  const effectiveAvatarUrl = cloudProfileMeta?.photoURL || firebaseUser?.photoURL || undefined;
  const effectiveBio = cloudProfileMeta?.bio || '';
  const isCloudVerified = Boolean(firebaseUser && firebaseUser.emailVerified);

  const hasCompletedLegalProfile = useMemo(() => {
    if (!firebaseUser) return false;
    const effectiveAge = cloudProfileMeta?.age ?? pendingRegMeta?.age;
    const effectiveTerms = Boolean(
      cloudProfileMeta?.termsAccepted || pendingRegMeta?.termsAccepted
    );
    const effectiveUsername = cloudProfileMeta?.username || pendingRegMeta?.username;
    return Boolean(
      effectiveUsername &&
        typeof effectiveAge === 'number' &&
        effectiveAge >= 18 &&
        effectiveTerms
    );
  }, [firebaseUser, cloudProfileMeta, pendingRegMeta]);

  const needsGoogleCompletion = Boolean(
    firebaseUser && profileLoaded && !hasCompletedLegalProfile
  );

  // Persist local preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_CITY_KEY, JSON.stringify(userCity));
  }, [userCity]);

  useEffect(() => {
    localStorage.setItem(STORAGE_ONBOARDED_KEY, JSON.stringify(onboarded));
  }, [onboarded]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOCATION_CONFIRMED_KEY, JSON.stringify(hasConfirmedLocation));
  }, [hasConfirmedLocation]);

  // On app launch for returning users, only prompt again if at least one permission is still missing
  useEffect(() => {
    if (!onboarded || permissionsCheckedThisSession || adminPanelOpen) return;
    let active = true;
    probeAppPermissions()
      .then((perms) => {
        if (!active) return;
        setPermissionsCheckedThisSession(true);
        setNeedsMissingPermissionsPrompt(!areAllAppPermissionsGranted(perms));
      })
      .catch(() => {
        if (active) setPermissionsCheckedThisSession(true);
      });
    return () => {
      active = false;
    };
  }, [onboarded, permissionsCheckedThisSession, adminPanelOpen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CUSTOM_CATS_KEY, JSON.stringify(customCategories));
  }, [customCategories]);

  // Boot Firestore connection, purge any legacy local caches, Capacitor shell, push channel & public listings listener
  useEffect(() => {
    try {
      for (const legacyKey of LEGACY_LOCAL_STORAGE_KEYS) {
        localStorage.removeItem(legacyKey);
      }
    } catch {
      // ignore storage cleanup errors
    }
    initCapacitorShell();
    void initPushNotificationChannel((threadId) => {
      setActiveThreadId(threadId);
      setActiveTab('chats');
    });
    testConnection();
    const unsubListings = subscribeListings((items) => {
      setCloudListings(items);
    });
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    const unsubSettings = subscribeGlobalPlatformSettingsFirestore((cloudSettings) => {
      if (cloudSettings) {
        setPlatformSettings((prev) => ({ ...prev, ...cloudSettings }));
      }
    });
    fetchPlatformSettingsServer()
      .then((serverSettings) => {
        if (serverSettings) {
          setPlatformSettings((prev) => ({ ...prev, ...serverSettings }));
        }
      })
      .catch(() => {});
    fetchAdminServerStatus()
      .then((status) => {
        if (status?.adminEmail) {
          setConfiguredAdminEmail(status.adminEmail.trim().toLowerCase());
        }
      })
      .catch(() => {});

    const syncServerPublic = () => {
      fetchPublicModeratedListingsServer()
        .then(({ listings: pubListings, rejectedIds }) => {
          setServerPublicListings(pubListings);
          setServerRejectedIds(rejectedIds);
        })
        .catch(() => {});
      fetchPublicVerifiedUidsServer()
        .then((uids) => {
          setServerVerifiedUids(uids);
        })
        .catch(() => {});
    };
    syncServerPublic();
    const publicPollId = window.setInterval(syncServerPublic, 20000);

    return () => {
      window.clearInterval(publicPollId);
      setPushOpenThreadHandler(null);
      unsubListings();
      unsubAuth();
      unsubSettings();
    };
  }, []);

  // Resolve Firebase Admin RBAC role whenever Firebase Auth state updates
  useEffect(() => {
    if (!firebaseUser) {
      setIsFirebaseAdmin(false);
      return;
    }
    let active = true;
    checkIsFirebaseAdmin({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,
    })
      .then((isAdm) => {
        if (active) setIsFirebaseAdmin(isAdm);
      })
      .catch(() => {
        if (active) setIsFirebaseAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [firebaseUser]);

  const nativeBackHandlerRef = useRef<() => boolean>(() => false);
  nativeBackHandlerRef.current = () => {
    if (selectedListing) {
      setSelectedListing(null);
      return true;
    }
    if (adminAuthOpen) {
      setAdminAuthOpen(false);
      return true;
    }
    if (adminPanelOpen) {
      void handleSignOutAdmin();
      return true;
    }
    if (sellerSheetProfile) {
      setSellerSheetProfile(null);
      return true;
    }
    if (sellSheetOpen) {
      setSellSheetOpen(false);
      return true;
    }
    if (shareToSellOpen) {
      setShareToSellOpen(false);
      return true;
    }
    if (searchSheetOpen) {
      setSearchSheetOpen(false);
      return true;
    }
    if (cityPickerOpen) {
      setCityPickerOpen(false);
      return true;
    }
    if (categoryPickerOpen) {
      setCategoryPickerOpen(false);
      return true;
    }
    if (activeTab === 'chats' && activeThreadId !== null) {
      setActiveThreadId(null);
      return true;
    }
    if (activeTab !== 'market') {
      setActiveTab('market');
      return true;
    }
    return false;
  };

  useEffect(() => {
    return registerNativeBackButton(() => nativeBackHandlerRef.current());
  }, []);

  // Private user listeners when authenticated
  const activeFirebaseUid = firebaseUser?.uid ?? null;
  useEffect(() => {
    teardownPrivateListeners();
    setCloudChatsReset();
    setPendingRegMeta(null);

    if (!activeFirebaseUid) {
      setCloudProfileMeta(null);
      setProfileLoaded(false);
      setCloudChatsHydrated(true);
      return;
    }

    const uid = activeFirebaseUid;
    setCloudChatsHydrated(false);
    const pendingKey = `${STORAGE_PENDING_REG_PREFIX}${uid}`;
    const storedPending = readJsonStorage<PendingRegistrationMeta | null>(pendingKey, null);
    if (storedPending) {
      setPendingRegMeta(storedPending);
    }

    const unsubProfile = subscribeUserProfile(uid, (profile) => {
      setCloudProfileMeta(profile);
      setProfileLoaded(true);
      if (profile?.customCategories && profile.customCategories.length > 0) {
        setCustomCategories(profile.customCategories);
      }

      // Sync pending email registration fields once user verifies email
      const pending = readJsonStorage<PendingRegistrationMeta | null>(pendingKey, null);
      const currentAuthUser = auth.currentUser;
      if (currentAuthUser && currentAuthUser.uid === uid && currentAuthUser.emailVerified && pending && !profile?.username) {
        Promise.all([
          saveUserProfile(
            uid,
            {
              city: profile?.city || userCity.city,
              state: profile?.state || userCity.state,
              customCategories:
                profile?.customCategories && profile.customCategories.length > 0
                  ? profile.customCategories
                  : customCategories,
              displayName: pending.username,
              username: pending.username,
              age: pending.age,
              termsAccepted: pending.termsAccepted,
              termsVersion: pending.termsVersion,
            },
            currentAuthUser.photoURL || undefined
          ),
          claimUsername(pending.username, uid),
        ])
          .then(() => {
            localStorage.removeItem(pendingKey);
            setPendingRegMeta(null);
          })
          .catch(() => {});
      }
    });
    const unsubChats = subscribeUserChats(uid, (threads) => {
      setCloudThreads(threads);
      setCloudChatsHydrated(true);
    });
    const unsubPurchases = subscribePurchases(uid, (items) => {
      setCloudPurchases(items);
    });
    const unsubMyListings = subscribeSellerListings(uid, (items) => {
      setMyCloudListings(items);
    });
    const unsubMyVerification = subscribeMyIdentityVerification(uid, (info) => {
      setMyCloudVerification(info);
    });

    privateUnsubsRef.current = [
      unsubProfile,
      unsubChats,
      unsubPurchases,
      unsubMyListings,
      unsubMyVerification,
    ];

    return () => {
      teardownPrivateListeners();
    };
  }, [activeFirebaseUid]);

  // Poll server verification status for the active authenticated user
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const syncMine = () => {
      fetchMyIdentityVerificationServer(currentUserId)
        .then((info) => {
          if (!cancelled && info) {
            setMyServerVerification(info);
          }
        })
        .catch(() => {});
    };
    syncMine();
    const timer = window.setInterval(syncMine, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUserId]);

  function setCloudChatsReset() {
    setCloudThreads([]);
    setCloudPurchases([]);
    setCloudMessages({});
    setMyCloudListings([]);
    setMyCloudVerification({ status: 'none' });
  }

  const isActiveCloudThread = useMemo(
    () =>
      Boolean(
        firebaseUser &&
          activeThreadId &&
          cloudThreads.some((t) => t.id === activeThreadId && isMyChatThread(t, firebaseUser.uid))
      ),
    [firebaseUser, activeThreadId, cloudThreads]
  );

  // Subscribe to messages for the active Firestore thread (stable across thread metadata updates)
  useEffect(() => {
    if (!firebaseUser || !activeThreadId || !isActiveCloudThread) return;

    const uid = firebaseUser.uid;
    const unsub = subscribeChatMessages(activeThreadId, uid, (msgs) => {
      setCloudMessages((prev) => ({ ...prev, [activeThreadId]: msgs }));
    });
    activeChatMsgUnsubRef.current = unsub;
    return () => {
      unsub();
      if (activeChatMsgUnsubRef.current === unsub) {
        activeChatMsgUnsubRef.current = null;
      }
    };
  }, [firebaseUser?.uid, activeThreadId, isActiveCloudThread]);

  const allAdminListings = useMemo(() => {
    const byId = new Map<string, Listing>();
    for (const item of cloudListings) byId.set(item.id, item);
    for (const item of myCloudListings) byId.set(item.id, item);
    for (const item of serverPublicListings) {
      if (item.source === 'firestore') byId.set(item.id, item);
    }
    return Array.from(byId.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [cloudListings, myCloudListings, serverPublicListings]);

  const [marketClockMs, setMarketClockMs] = useState(() => Date.now());

  const hasTimedListings = useMemo(() => {
    const SOLD_WINDOW_MS = 60 * 60 * 1000;
    const combined = [...cloudListings, ...myCloudListings, ...serverPublicListings];
    return combined.some(
      (item) =>
        item.status === 'pending' ||
        (item.status === 'sold' &&
          typeof item.soldAtMs === 'number' &&
          marketClockMs - item.soldAtMs < SOLD_WINDOW_MS)
    );
  }, [cloudListings, myCloudListings, serverPublicListings, marketClockMs]);

  useEffect(() => {
    if (!hasTimedListings) return;
    const id = window.setInterval(() => {
      setMarketClockMs(Date.now());
    }, 20000);
    return () => window.clearInterval(id);
  }, [hasTimedListings]);

  // Poll server review status for seller's own cloud listings so approvals/rejections reflect immediately
  const ownListingIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const item of myCloudListings) ids.add(item.id);
    return Array.from(ids).sort().join(',');
  }, [myCloudListings]);

  useEffect(() => {
    if (!ownListingIdsKey) return;
    const ids = ownListingIdsKey.split(',').filter(Boolean);
    let cancelled = false;
    const syncStatuses = () => {
      fetchListingStatusesServer(ids)
        .then((statuses) => {
          if (!cancelled && Object.keys(statuses).length > 0) {
            setServerStatusMap((prev) => ({ ...prev, ...statuses }));
          }
        })
        .catch(() => {});
    };
    syncStatuses();
    const timer = window.setInterval(syncStatuses, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ownListingIdsKey]);

  // Automatically promote pending Firestore listings 30 minutes after submission (unless rejected by admin)
  useEffect(() => {
    if (!firebaseUser) return;
    const rejectedSet = new Set(serverRejectedIds);
    for (const item of myCloudListings) {
      if (item.status !== 'pending') continue;
      const srv = serverStatusMap[item.id];
      if (rejectedSet.has(item.id) || srv?.status === 'rejected') continue;
      const targetAt = item.createdAtMs + LISTING_REVIEW_AUTO_APPROVE_MS + 5000;
      if (marketClockMs >= targetAt && !promotedFirestoreIdsRef.current.has(item.id)) {
        promotedFirestoreIdsRef.current.add(item.id);
        void promoteFirestoreListingAfterReviewWindow(item.id);
      }
    }
  }, [marketClockMs, serverRejectedIds, serverStatusMap, myCloudListings, firebaseUser]);

  const allActiveListings = useMemo(() => {
    const SOLD_WINDOW_MS = 60 * 60 * 1000;
    const rejectedSet = new Set(serverRejectedIds);
    const byId = new Map<string, Listing>();

    for (const item of cloudListings) {
      byId.set(item.id, item);
    }
    for (const item of serverPublicListings) {
      if (item.source === 'firestore') {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values()).filter((item) => {
      if (rejectedSet.has(item.id) || serverStatusMap[item.id]?.status === 'rejected') {
        return false;
      }
      if (item.status === 'active') return true;
      return (
        item.status === 'sold' &&
        typeof item.soldAtMs === 'number' &&
        marketClockMs - item.soldAtMs < SOLD_WINDOW_MS
      );
    });
  }, [cloudListings, serverPublicListings, serverRejectedIds, serverStatusMap, marketClockMs]);

  const myListings = useMemo(() => {
    if (!firebaseUser) return [];
    const uid = firebaseUser.uid;
    const rejectedSet = new Set(serverRejectedIds);
    const serverPublicById = new Map(serverPublicListings.map((item) => [item.id, item]));
    const byId = new Map<string, Listing>();

    for (const item of cloudListings) {
      if (item.sellerId === uid) {
        byId.set(item.id, item);
      }
    }
    for (const item of myCloudListings) {
      if (item.sellerId === uid) {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values())
      .map((item) => {
        const srv = serverStatusMap[item.id];
        const pubItem = serverPublicById.get(item.id);
        let status: ListingStatus = srv?.status ?? pubItem?.status ?? item.status;
        if (rejectedSet.has(item.id)) {
          status = 'rejected';
        } else if (status === 'pending') {
          const targetAt =
            srv?.autoApproveAtMs ??
            item.autoApproveAtMs ??
            item.createdAtMs + LISTING_REVIEW_AUTO_APPROVE_MS;
          if (marketClockMs >= targetAt) {
            status = 'active';
          }
        }
        return {
          ...item,
          status,
          autoApproveAtMs:
            srv?.autoApproveAtMs ??
            item.autoApproveAtMs ??
            item.createdAtMs + LISTING_REVIEW_AUTO_APPROVE_MS,
          soldAtMs: srv?.soldAtMs ?? pubItem?.soldAtMs ?? item.soldAtMs,
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [
    cloudListings,
    myCloudListings,
    serverPublicListings,
    serverRejectedIds,
    serverStatusMap,
    firebaseUser,
    marketClockMs,
  ]);

  const allThreads = useMemo(() => {
    if (!firebaseUser) return [];
    return cloudThreads
      .filter((thread) => isMyChatThread(thread, firebaseUser.uid))
      .sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
  }, [cloudThreads, firebaseUser]);

  const markThreadAsRead = (threadId: string, minTimestampMs?: number) => {
    const readAt = Math.max(Date.now(), minTimestampMs || 0);
    setChatReadMap((prev) => {
      if ((prev[threadId] || 0) >= readAt) return prev;
      const next = { ...prev, [threadId]: readAt };
      try {
        localStorage.setItem(`${STORAGE_CHAT_READS_PREFIX}${currentUserId}`, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  const handleSelectThread = (threadId: string | null) => {
    setActiveThreadId(threadId);
    if (threadId) {
      const target = allThreads.find((t) => t.id === threadId);
      markThreadAsRead(threadId, target?.lastMessageAtMs);
    }
  };

  // Clear unread indicator whenever user is actively viewing an open chat
  useEffect(() => {
    if (!activeThreadId) return;
    const openThread = allThreads.find((t) => t.id === activeThreadId);
    if (openThread) {
      markThreadAsRead(activeThreadId, openThread.lastMessageAtMs);
    }
  }, [activeThreadId, allThreads]);

  // Dispatch push/local notification when an incoming message arrives on an inactive chat
  useEffect(() => {
    if (firebaseUser && !cloudChatsHydrated) return;

    if (pushWarmupUserRef.current !== currentUserId) {
      const initialMap: Record<string, number> = {};
      for (const t of allThreads) {
        initialMap[t.id] = t.lastMessageAtMs;
      }
      knownThreadTimestampsRef.current = initialMap;
      pushWarmupUserRef.current = currentUserId;
      return;
    }

    const nextKnown: Record<string, number> = {};
    for (const thread of allThreads) {
      nextKnown[thread.id] = thread.lastMessageAtMs;
      const prevTs = knownThreadTimestampsRef.current[thread.id];
      const isNewOrUpdated =
        prevTs === undefined ? thread.lastMessageAtMs > 0 : thread.lastMessageAtMs > prevTs;

      if (!isNewOrUpdated) continue;

      const sentJustNowByMe =
        Date.now() - (lastSentByMeRef.current[thread.id] || 0) < 4000;
      const isViewingThread = activeTab === 'chats' && activeThreadId === thread.id;

      if (!sentJustNowByMe && !isViewingThread && thread.lastMessage) {
        const senderLabel =
          thread.buyerId === currentUserId ? thread.sellerName : thread.buyerName;
        void dispatchChatPushNotification({
          title: `${senderLabel} · ${thread.listingTitle}`,
          body: thread.lastMessage,
          threadId: thread.id,
        });
      }
    }
    knownThreadTimestampsRef.current = nextKnown;
  }, [allThreads, activeTab, activeThreadId, currentUserId, firebaseUser, cloudChatsHydrated]);

  const unreadThreadIds = useMemo(() => {
    const unread = new Set<string>();
    for (const thread of allThreads) {
      if (activeTab === 'chats' && activeThreadId === thread.id) continue;
      const readAt = chatReadMap[thread.id] || 0;
      if (thread.lastMessageAtMs > readAt) {
        unread.add(thread.id);
      }
    }
    return unread;
  }, [allThreads, chatReadMap, activeTab, activeThreadId]);

  const allMessagesByThread = useMemo(() => {
    const scoped: Record<string, ChatMessage[]> = {};
    for (const thread of allThreads) {
      scoped[thread.id] = cloudMessages[thread.id] || [];
    }
    return scoped;
  }, [allThreads, cloudMessages]);

  const allPurchases = useMemo(() => {
    if (!firebaseUser) return [];
    return cloudPurchases
      .filter((purchase) => purchase.buyerId === firebaseUser.uid)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [cloudPurchases, firebaseUser]);

  // Compute filtered & proximity-sorted listings
  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const withDist = allActiveListings.map((item) => ({
      item,
      dist: getDistanceKm(userCity.lat, userCity.lng, item.lat, item.lng),
    }));

    const filtered = withDist.filter(({ item, dist }) => {
      if (q) {
        const hay = `${item.title} ${item.description} ${item.category} ${item.subcategory || ''} ${item.city} ${item.state}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterState !== 'Todos' && item.state !== filterState) return false;
      if (filterCity !== 'Todas' && item.city !== filterCity) return false;
      if (filterCategory !== 'Todas' && item.category !== filterCategory) return false;
      if (filterSubcategory !== 'Todas' && item.subcategory !== filterSubcategory) return false;

      if (typeof proximity === 'number' && dist > proximity) return false;
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
    filterSubcategory,
    proximity,
    customCategories,
  ]);

  // Fetch public seller profile when viewing a listing
  useEffect(() => {
    if (!selectedListing) return;
    if (
      selectedListing.source !== 'firestore' ||
      selectedListing.sellerId === currentUserId ||
      sellerCache[selectedListing.sellerId]
    ) {
      return;
    }
    let cancelled = false;
    fetchPublicSeller(selectedListing.sellerId).then((seller) => {
      if (!cancelled && seller) {
        setSellerCache((prev) => ({ ...prev, [selectedListing.sellerId]: seller }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedListing, currentUserId, sellerCache]);

  const myVerificationState = useMemo<{
    status: IdentityVerificationStatus;
    rejectionReason?: string;
  }>(() => {
    if (
      cloudProfileMeta?.identityVerified === true ||
      myCloudVerification.status === 'approved' ||
      myServerVerification.status === 'approved' ||
      serverVerifiedUids.includes(currentUserId)
    ) {
      return { status: 'approved' };
    }
    const candidates = [myCloudVerification, myServerVerification].filter(
      (c) => c.status !== 'none'
    );
    if (candidates.length === 0) {
      return { status: 'none' };
    }
    candidates.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
    return {
      status: candidates[0].status,
      rejectionReason: candidates[0].rejectionReason,
    };
  }, [
    cloudProfileMeta?.identityVerified,
    myCloudVerification,
    myServerVerification,
    serverVerifiedUids,
    currentUserId,
  ]);

  const verifiedUserIds = useMemo(() => {
    const set = new Set<string>(serverVerifiedUids);
    for (const [uid, profile] of Object.entries(sellerCache)) {
      if (profile.identityVerified) {
        set.add(uid);
      }
    }
    if (myVerificationState.status === 'approved') {
      set.add(currentUserId);
    }
    return set;
  }, [serverVerifiedUids, sellerCache, myVerificationState.status, currentUserId]);

  // Fetch public seller profiles for chat counterparties so Firestore-verified badges stay synced
  useEffect(() => {
    if (allThreads.length === 0) return;
    const missingIds = new Set<string>();
    for (const thread of allThreads) {
      if (thread.source !== 'firestore') continue;
      const otherId = thread.sellerId === currentUserId ? thread.buyerId : thread.sellerId;
      if (otherId && otherId !== currentUserId && !sellerCache[otherId]) {
        missingIds.add(otherId);
      }
    }
    if (missingIds.size === 0) return;
    let cancelled = false;
    missingIds.forEach((uid) => {
      fetchPublicSeller(uid)
        .then((seller) => {
          if (!cancelled && seller) {
            setSellerCache((prev) => (prev[uid] ? prev : { ...prev, [uid]: seller }));
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [allThreads, currentUserId, sellerCache]);

  const buildSellerProfileForListing = (listing: Listing | null): PublicSellerProfile | null => {
    if (!listing) return null;
    if (isMySellerId(listing.sellerId)) {
      return {
        uid: currentUserId,
        displayName: currentUserName,
        photoURL: effectiveAvatarUrl,
        bio: effectiveBio,
        city: userCity.city,
        state: userCity.state,
        identityVerified: myVerificationState.status === 'approved',
      };
    }
    if (sellerCache[listing.sellerId]) {
      return {
        ...sellerCache[listing.sellerId],
        identityVerified:
          Boolean(sellerCache[listing.sellerId].identityVerified) ||
          verifiedUserIds.has(listing.sellerId),
      };
    }
    return {
      uid: listing.sellerId,
      displayName: listing.sellerName,
      city: listing.city,
      state: listing.state,
      identityVerified: verifiedUserIds.has(listing.sellerId),
    };
  };

  const selectedListingSeller = buildSellerProfileForListing(selectedListing);

  const activeSellerListings = useMemo(() => {
    if (!sellerSheetProfile) return [];
    return allActiveListings
      .filter((item) => item.sellerId === sellerSheetProfile.uid)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [sellerSheetProfile, allActiveListings]);

  // Handlers
  const buildUserProfilePayload = (
    loc: CityLocation,
    cats: string[]
  ): UserPreferences => ({
    city: loc.city,
    state: loc.state,
    lat: loc.lat,
    lng: loc.lng,
    customCategories: cats,
    displayName: currentUserName,
    ...(lockedUsername ? { username: lockedUsername } : {}),
    ...(cloudProfileMeta?.age ? { age: cloudProfileMeta.age } : pendingRegMeta?.age ? { age: pendingRegMeta.age } : {}),
    ...(cloudProfileMeta?.termsAccepted || pendingRegMeta?.termsAccepted
      ? {
          termsAccepted: true,
          termsVersion:
            cloudProfileMeta?.termsVersion ||
            pendingRegMeta?.termsVersion ||
            LEGAL_TERMS_VERSION,
        }
      : {}),
    ...(effectiveAvatarUrl ? { photoURL: effectiveAvatarUrl } : {}),
    ...(effectiveBio ? { bio: effectiveBio } : {}),
  });

  const handleUpdateAvatar = async (dataUrl: string) => {
    if (!firebaseUser || !isCloudVerified) {
      throw new Error('Verifica tu correo electrónico para guardar tu foto de perfil en la nube.');
    }
    await saveUserProfile(
      firebaseUser.uid,
      { ...buildUserProfilePayload(userCity, customCategories), photoURL: dataUrl },
      dataUrl
    );
    setCloudProfileMeta((prev) => ({ ...(prev || {}), photoURL: dataUrl }));
    setSellerCache((prev) => ({
      ...prev,
      [firebaseUser.uid]: {
        uid: firebaseUser.uid,
        displayName: currentUserName,
        photoURL: dataUrl,
        bio: effectiveBio,
        city: userCity.city,
        state: userCity.state,
      },
    }));
  };

  const handleUpdateBio = async (bio: string) => {
    if (!firebaseUser || !isCloudVerified) {
      throw new Error('Verifica tu correo electrónico para guardar tu descripción en la nube.');
    }
    await saveUserProfile(
      firebaseUser.uid,
      { ...buildUserProfilePayload(userCity, customCategories), bio },
      effectiveAvatarUrl
    );
    setCloudProfileMeta((prev) => ({ ...(prev || {}), bio }));
    setSellerCache((prev) => ({
      ...prev,
      [firebaseUser.uid]: {
        uid: firebaseUser.uid,
        displayName: currentUserName,
        photoURL: effectiveAvatarUrl,
        bio,
        city: userCity.city,
        state: userCity.state,
      },
    }));
  };

  const handleSubmitIdentityVerification = async (payload: {
    selfieUrl: string;
    idCardUrl: string;
  }) => {
    if (!firebaseUser || !isCloudVerified) {
      throw new Error('Verifica tu correo electrónico antes de enviar tu verificación de identidad.');
    }
    await submitFirestoreIdentityVerification({
      uid: firebaseUser.uid,
      displayName: currentUserName,
      city: userCity.city,
      state: userCity.state,
      selfieUrl: payload.selfieUrl,
      idCardUrl: payload.idCardUrl,
    });
    const serverRes = await submitIdentityVerificationServer({
      uid: firebaseUser.uid,
      displayName: currentUserName,
      city: userCity.city,
      state: userCity.state,
      selfieUrl: payload.selfieUrl,
      idCardUrl: payload.idCardUrl,
    });
    setMyServerVerification({
      status: serverRes.status,
      updatedAtMs: serverRes.updatedAtMs || Date.now(),
    });
  };

  const refreshVerificationState = () => {
    fetchPublicVerifiedUidsServer()
      .then((uids) => setServerVerifiedUids(uids))
      .catch(() => {});
    fetchMyIdentityVerificationServer(currentUserId)
      .then((info) => {
        if (info) setMyServerVerification(info);
      })
      .catch(() => {});
  };

  const handleLocationConfirmed = (loc: CityLocation) => {
    setUserCity(loc);
    setHasConfirmedLocation(true);
    if (firebaseUser && firebaseUser.emailVerified) {
      saveUserProfile(
        firebaseUser.uid,
        buildUserProfilePayload(loc, customCategories),
        effectiveAvatarUrl
      ).catch(() => {});
    }
  };

  const handleConfirmOnboarding = (loc: CityLocation) => {
    setUserCity(loc);
    setHasConfirmedLocation(true);
    setOnboarded(true);
    setNeedsMissingPermissionsPrompt(false);
    setPermissionsCheckedThisSession(true);
    if (firebaseUser && firebaseUser.emailVerified) {
      saveUserProfile(
        firebaseUser.uid,
        buildUserProfilePayload(loc, customCategories),
        effectiveAvatarUrl
      ).catch(() => {});
    }
  };

  const handleCityChange = (loc: CityLocation) => {
    setUserCity(loc);
    if (firebaseUser && firebaseUser.emailVerified) {
      saveUserProfile(
        firebaseUser.uid,
        buildUserProfilePayload(loc, customCategories),
        effectiveAvatarUrl
      ).catch(() => {});
    }
  };

  const isAdminActive = Boolean(adminSession);
  const effectiveAdminEmail = adminSession?.email || configuredAdminEmail;

  const handleSignOutAdmin = async () => {
    if (adminSession?.token) {
      await logoutAdminServer(adminSession.token).catch(() => {});
    }
    const fbEmail = (auth.currentUser?.email || firebaseUser?.email)?.trim().toLowerCase();
    if (fbEmail && (fbEmail === configuredAdminEmail || fbEmail === PRIMARY_ADMIN_EMAIL)) {
      teardownPrivateListeners();
      await signOut(auth).catch(() => {});
    }
    setAdminSession(null);
    setAdminPanelOpen(false);
  };

  const refreshServerPublicListings = () => {
    fetchPublicModeratedListingsServer()
      .then(({ listings: pubListings, rejectedIds }) => {
        setServerPublicListings(pubListings);
        setServerRejectedIds(rejectedIds);
      })
      .catch(() => {});
  };

  const handleAdminListingMutated = (
    listingId: string,
    action: 'approve' | 'reject' | 'mark-sold' | 'reactivate' | 'delete'
  ) => {
    const now = Date.now();
    const nextStatus: ListingStatus =
      action === 'approve' || action === 'reactivate'
        ? 'active'
        : action === 'reject'
          ? 'rejected'
          : 'sold';

    if (action === 'reject' || action === 'delete') {
      setServerRejectedIds((prev) => (prev.includes(listingId) ? prev : [...prev, listingId]));
      setServerPublicListings((prev) => prev.filter((l) => l.id !== listingId));
    } else if (action === 'approve' || action === 'reactivate') {
      setServerRejectedIds((prev) => prev.filter((id) => id !== listingId));
    }

    if (action !== 'delete') {
      setServerStatusMap((prev) => ({
        ...prev,
        [listingId]: {
          status: nextStatus,
          autoApproveAtMs: prev[listingId]?.autoApproveAtMs ?? now,
          soldAtMs: action === 'mark-sold' ? now : undefined,
        },
      }));
    }

    setMarketClockMs(now);
    setSelectedListing((prev) => {
      if (!prev || prev.id !== listingId) return prev;
      if (action === 'delete') return null;
      return {
        ...prev,
        status: nextStatus,
        soldAtMs: action === 'mark-sold' ? now : undefined,
      };
    });

    refreshServerPublicListings();
  };

  const openSellFlow = () => {
    if (cloudProfileMeta?.suspended && !isAdminActive) {
      setSellBlockNotice('Tu cuenta se encuentra temporalmente suspendida para publicar artículos.');
      return;
    }
    if (!platformSettings.allowNewListings && !isAdminActive) {
      setSellBlockNotice(
        'Las nuevas publicaciones están pausadas temporalmente por administración.'
      );
      return;
    }
    setSellBlockNotice(null);

    if (myListings.length > 0) {
      setSellSheetOpen(true);
      return;
    }

    const unlockKey = `${STORAGE_SELL_UNLOCK_PREFIX}${currentUserId}`;
    const stored = readJsonStorage<SellUnlockState | null>(unlockKey, null);
    const now = Date.now();

    if (stored?.unlocked || (stored?.unlockAtMs && now >= stored.unlockAtMs)) {
      localStorage.setItem(
        unlockKey,
        JSON.stringify({ unlocked: true, unlockAtMs: stored?.unlockAtMs || now })
      );
      setSellSheetOpen(true);
      return;
    }

    const targetUnlockAt = stored?.unlockAtMs || now + 30 * 60 * 1000;
    if (!stored) {
      localStorage.setItem(
        unlockKey,
        JSON.stringify({ unlocked: false, unlockAtMs: targetUnlockAt })
      );
    }
    setSellUnlockAtMs(targetUnlockAt);
    setShareToSellOpen(true);
  };

  const handleSellUnlocked = () => {
    const unlockKey = `${STORAGE_SELL_UNLOCK_PREFIX}${currentUserId}`;
    localStorage.setItem(
      unlockKey,
      JSON.stringify({ unlocked: true, unlockAtMs: Date.now() })
    );
    setShareToSellOpen(false);
    setSellSheetOpen(true);
  };

  const handleDockSelect = (tab: DockTab) => {
    setSelectedListing(null);
    setSellerSheetProfile(null);
    if (tab === 'sell') {
      if (sellSheetOpen || shareToSellOpen) {
        setSellSheetOpen(false);
        setShareToSellOpen(false);
        return;
      }
      setSearchSheetOpen(false);
      openSellFlow();
      return;
    }
    if (tab === 'search') {
      if (searchSheetOpen) {
        setSearchSheetOpen(false);
        return;
      }
      setSellSheetOpen(false);
      setShareToSellOpen(false);
      setSearchSheetOpen(true);
      return;
    }
    setSearchSheetOpen(false);
    setSellSheetOpen(false);
    setShareToSellOpen(false);
    if (tab === 'market') {
      setActiveThreadId(null);
      setActiveTab('market');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveTab(tab);
  };

  const dockActiveTab: DockTab =
    sellSheetOpen || shareToSellOpen
      ? 'sell'
      : searchSheetOpen
        ? 'search'
        : activeTab;

  const handlePublish = async (
    data: Omit<Listing, 'id' | 'sellerId' | 'sellerName' | 'status' | 'createdAtMs' | 'source'>
  ) => {
    if (!firebaseUser) {
      throw new Error('Inicia sesión con tu cuenta para publicar artículos.');
    }
    if (!isCloudVerified) {
      throw new Error(
        'Verifica tu correo electrónico en Mi Perfil para publicar artículos en Quemarket.'
      );
    }

    const now = Date.now();
    const autoApproveAtMs = now + LISTING_REVIEW_AUTO_APPROVE_MS;

    const createdId = await createFirestoreListing({
      ...data,
      sellerId: firebaseUser.uid,
      sellerName: currentUserName,
    });
    // Register in server moderation queue so admin can review immediately and 30-min auto-approval runs server-side
    await submitListingForReviewServer({
      ...data,
      id: createdId,
      sellerId: firebaseUser.uid,
      sellerName: currentUserName,
      autoApproveAtMs,
      source: 'firestore',
    });
    setServerStatusMap((prev) => ({
      ...prev,
      [createdId]: { status: 'pending', autoApproveAtMs },
    }));
    setMarketClockMs(now);
  };

  const handleMarkSold = async (listing: Listing) => {
    if (!firebaseUser || !isCloudVerified) {
      throw new Error('Verifica tu correo electrónico para actualizar tus publicaciones.');
    }
    const now = Date.now();
    setMarketClockMs(now);
    await markFirestoreListingSold(listing.id);
    setSelectedListing((prev) =>
      prev && prev.id === listing.id ? { ...prev, status: 'sold', soldAtMs: now } : prev
    );
  };

  const handleDeleteListing = async (listing: Listing) => {
    if (!firebaseUser || !isCloudVerified) {
      throw new Error('Verifica tu correo electrónico para eliminar tus publicaciones.');
    }
    await deleteFirestoreListing(listing.id);
  };

  const handleStartChat = async (listing: Listing, customMessage?: string) => {
    if (isMySellerId(listing.sellerId)) {
      return;
    }
    if (!firebaseUser) {
      throw new Error('Inicia sesión con tu cuenta para chatear con este vendedor.');
    }
    if (!isCloudVerified) {
      throw new Error(
        'Verifica tu correo electrónico en Mi Perfil para enviar mensajes en tiempo real.'
      );
    }
    if (startingChatRef.current) return;
    startingChatRef.current = true;

    try {
      const trimmedCustom = customMessage?.trim() || '';
      const existing = allThreads.find(
        (t) =>
          t.listingId === listing.id &&
          t.buyerId === firebaseUser.uid &&
          t.sellerId === listing.sellerId
      );
      if (existing) {
        if (trimmedCustom) {
          await handleSendMessage(existing, { text: trimmedCustom, type: 'text' });
        }
        handleSelectThread(existing.id);
        setActiveTab('chats');
        return;
      }

      const firstMsg =
        trimmedCustom ||
        `Hola ${listing.sellerName.split(' ')[0]}, me interesa "${listing.title}". ¿Sigue disponible?`;

      // Prevent duplicate threads if Firestore snapshot is still hydrating
      const existingRemote = await findExistingFirestoreChatThread(
        firebaseUser.uid,
        listing.id,
        listing.sellerId
      );
      if (existingRemote) {
        setCloudThreads((prev) =>
          prev.some((t) => t.id === existingRemote.id) ? prev : [existingRemote, ...prev]
        );
        if (trimmedCustom) {
          await handleSendMessage(existingRemote, { text: trimmedCustom, type: 'text' });
        }
        handleSelectThread(existingRemote.id);
        setActiveTab('chats');
        return;
      }

      const chatId = makeSafeId('chat');
      const now = Date.now();
      lastSentByMeRef.current[chatId] = now;
      markThreadAsRead(chatId, now);

      const created = await createFirestoreChatThread({
        chatId,
        listing,
        buyerId: firebaseUser.uid,
        buyerName: currentUserName,
        firstMessage: firstMsg,
      });

      setCloudThreads((prev) =>
        prev.some((t) => t.id === created.thread.id) ? prev : [created.thread, ...prev]
      );
      setCloudMessages((prev) => ({
        ...prev,
        [created.thread.id]: prev[created.thread.id]?.length
          ? prev[created.thread.id]
          : [created.initialMessage],
      }));
      handleSelectThread(created.thread.id);
      setActiveTab('chats');
    } finally {
      startingChatRef.current = false;
    }
  };

  const handleSendMessage = async (thread: ChatThread, payload: ChatMessagePayload) => {
    if (!firebaseUser || !isMyChatThread(thread, firebaseUser.uid)) return;
    if (!isCloudVerified) {
      throw new Error(
        'Verifica tu correo electrónico para enviar mensajes en tiempo real.'
      );
    }

    const cleanText = (payload.text || '').trim();
    if (!cleanText && !payload.imageUrl && !payload.audioUrl) return;

    const now = Date.now();
    const canonicalParticipants: [string, string] = [thread.buyerId, thread.sellerId];
    lastSentByMeRef.current[thread.id] = now;
    markThreadAsRead(thread.id, now);

    await sendFirestoreChatMessage({
      chatId: thread.id,
      senderId: firebaseUser.uid,
      participantIds: canonicalParticipants,
      text: cleanText,
      type: payload.type,
      imageUrl: payload.imageUrl,
      audioUrl: payload.audioUrl,
      audioDurationSec: payload.audioDurationSec,
    });
  };

  const handleDeleteThread = async (thread: ChatThread) => {
    if (!firebaseUser || !isCloudVerified) {
      throw new Error('Verifica tu correo electrónico para eliminar conversaciones.');
    }
    await deleteFirestoreChatThread(thread.id, firebaseUser.uid);
    setCloudThreads((prev) => prev.filter((t) => t.id !== thread.id));
    setCloudMessages((prev) => {
      if (!(thread.id in prev)) return prev;
      const copy = { ...prev };
      delete copy[thread.id];
      return copy;
    });

    delete knownThreadTimestampsRef.current[thread.id];
    setChatReadMap((prev) => {
      if (!(thread.id in prev)) return prev;
      const next = { ...prev };
      delete next[thread.id];
      try {
        localStorage.setItem(`${STORAGE_CHAT_READS_PREFIX}${currentUserId}`, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
    if (activeThreadId === thread.id) {
      setActiveThreadId(null);
    }
  };

  const handleToggleCustomCategory = (cat: string) => {
    setCustomCategories((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat].slice(0, 12);
      if (isCloudVerified && firebaseUser) {
        saveUserProfile(
          firebaseUser.uid,
          buildUserProfilePayload(userCity, next),
          effectiveAvatarUrl
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
          buildUserProfilePayload(userCity, next),
          effectiveAvatarUrl
        ).catch(() => {});
      }
      return next;
    });
  };

  const handleSignInGoogle = async (): Promise<{ needsProfileCompletion: boolean }> => {
    const res = await signInWithPopup(auth, googleProvider);
    const existingProfile = await fetchUserProfile(res.user.uid);
    const complete = Boolean(
      existingProfile?.username &&
        existingProfile?.termsAccepted === true &&
        typeof existingProfile?.age === 'number' &&
        existingProfile.age >= 18
    );

    if (complete) {
      setCloudProfileMeta(existingProfile);
      setProfileLoaded(true);
      await saveUserProfile(
        res.user.uid,
        {
          city: existingProfile?.city || userCity.city,
          state: existingProfile?.state || userCity.state,
          customCategories:
            existingProfile?.customCategories && existingProfile.customCategories.length > 0
              ? existingProfile.customCategories
              : customCategories,
          displayName: existingProfile!.username!,
          username: existingProfile!.username!,
          age: existingProfile!.age!,
          termsAccepted: true,
          termsVersion: existingProfile?.termsVersion || LEGAL_TERMS_VERSION,
          ...(existingProfile?.bio ? { bio: existingProfile.bio } : {}),
        },
        existingProfile?.photoURL || res.user.photoURL || undefined
      ).catch(() => {});
      return { needsProfileCompletion: false };
    }

    setCloudProfileMeta(existingProfile);
    setProfileLoaded(true);
    return { needsProfileCompletion: true };
  };

  const handleCompleteGoogleProfile = async (data: {
    username: string;
    age: number;
    termsAccepted: boolean;
  }) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No hay sesión activa.');
    }
    if (!data.termsAccepted || !Number.isInteger(data.age) || data.age < 18) {
      throw new Error('Debes ser mayor de 18 años y aceptar los términos.');
    }
    const available = await isUsernameAvailable(data.username);
    if (!available) {
      throw new Error('auth/username-already-in-use');
    }

    await updateProfile(user, { displayName: data.username });
    await saveUserProfile(
      user.uid,
      {
        city: userCity.city,
        state: userCity.state,
        lat: userCity.lat,
        lng: userCity.lng,
        customCategories,
        displayName: data.username,
        username: data.username,
        age: data.age,
        termsAccepted: true,
        termsVersion: LEGAL_TERMS_VERSION,
      },
      user.photoURL || undefined
    );
    await claimUsername(data.username, user.uid);
    setCloudProfileMeta((prev) => ({
      ...prev,
      displayName: data.username,
      username: data.username,
      age: data.age,
      termsAccepted: true,
      termsVersion: LEGAL_TERMS_VERSION,
    }));
  };

  const handleSignInEmail = async (
    email: string,
    password: string,
    mode: 'login' | 'register',
    registration?: EmailRegistrationPayload
  ): Promise<{ isAdmin?: boolean } | void> => {
    const normalizedEmail = email.trim().toLowerCase();
    const isAdminAccount =
      normalizedEmail === configuredAdminEmail || normalizedEmail === PRIMARY_ADMIN_EMAIL;

    if (isAdminAccount) {
      if (mode === 'register') {
        throw new Error('auth/admin-email-reserved');
      }
      try {
        const session = await loginAdminServer({ email: normalizedEmail, password });
        setAdminSession(session);
        setAdminPanelOpen(true);
        // Optional background Firebase sync if the same admin account also exists in Firebase Auth
        signInWithEmailAndPassword(auth, normalizedEmail, password).catch(() => {});
        return { isAdmin: true };
      } catch (err) {
        const typedErr = err as Error & { needsSetup?: boolean };
        if (typedErr?.needsSetup) {
          setAdminAuthOpen(true);
          return { isAdmin: true };
        }
        if (typedErr?.message?.toLowerCase().includes('demasiados')) {
          throw new Error('auth/admin-rate-limited');
        }
        throw new Error('auth/admin-invalid-credentials');
      }
    }

    if (mode === 'register') {
      if (
        !registration ||
        !registration.termsAccepted ||
        !Number.isInteger(registration.age) ||
        registration.age < 18 ||
        registration.password !== registration.confirmPassword
      ) {
        throw new Error('Datos de registro incompletos o inválidos.');
      }

      const available = await isUsernameAvailable(registration.username);
      if (!available) {
        throw new Error('auth/username-already-in-use');
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const lockedHandle = registration.username;
      await updateProfile(cred.user, { displayName: lockedHandle });

      const pendingMeta: PendingRegistrationMeta = {
        username: lockedHandle,
        age: registration.age,
        termsAccepted: true,
        termsVersion: LEGAL_TERMS_VERSION,
      };
      localStorage.setItem(
        `${STORAGE_PENDING_REG_PREFIX}${cred.user.uid}`,
        JSON.stringify(pendingMeta)
      );
      setPendingRegMeta(pendingMeta);
      setCloudProfileMeta((prev) => ({ ...prev, ...pendingMeta, displayName: lockedHandle }));

      await sendEmailVerification(cred.user);
      return;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (cred.user.emailVerified) {
      const pendingKey = `${STORAGE_PENDING_REG_PREFIX}${cred.user.uid}`;
      const pending = readJsonStorage<PendingRegistrationMeta | null>(pendingKey, null);
      const effectiveName =
        pending?.username ||
        cred.user.displayName ||
        email.split('@')[0] ||
        'Usuario Quemarket';

      await saveUserProfile(
        cred.user.uid,
        {
          city: userCity.city,
          state: userCity.state,
          lat: userCity.lat,
          lng: userCity.lng,
          customCategories,
          displayName: effectiveName,
          ...(pending
            ? {
                username: pending.username,
                age: pending.age,
                termsAccepted: pending.termsAccepted,
                termsVersion: pending.termsVersion,
              }
            : {}),
        },
        cred.user.photoURL || undefined
      );
      if (pending) {
        await claimUsername(pending.username, cred.user.uid).catch(() => {});
        localStorage.removeItem(pendingKey);
      }
    }
  };

  const handleResendVerification = async () => {
    if (firebaseUser && !firebaseUser.emailVerified) {
      await sendEmailVerification(firebaseUser);
    }
  };

  const handleSignOut = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    try {
      // Unsubscribe all authenticated Firestore listeners BEFORE revoking auth
      // so Firestore never emits post-signout Missing Permissions errors.
      teardownPrivateListeners();

      setSearchSheetOpen(false);
      setSellSheetOpen(false);
      setShareToSellOpen(false);
      setCityPickerOpen(false);
      setCategoryPickerOpen(false);
      setAdminAuthOpen(false);
      setAdminPanelOpen(false);
      setAdminSession(null);
      setIsFirebaseAdmin(false);
      setActiveThreadId(null);
      setSelectedListing(null);
      setSellerSheetProfile(null);
      setSellerCache({});
      setSellBlockNotice(null);
      setCloudProfileMeta(null);
      setProfileLoaded(false);
      setPendingRegMeta(null);
      setMyServerVerification({ status: 'none' });
      setCloudChatsReset();
      setCloudChatsHydrated(false);
      knownThreadTimestampsRef.current = {};
      lastSentByMeRef.current = {};
      pushWarmupUserRef.current = null;

      if (auth.currentUser || firebaseUser) {
        await signOut(auth).catch(() => {});
      }

      setFirebaseUser(null);
      setActiveTab('market');
      setNeedsMissingPermissionsPrompt(false);
      setPermissionsCheckedThisSession(false);
      setOnboarded(false);
    } finally {
      signingOutRef.current = false;
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterState('Todos');
    setFilterCity('Todas');
    setFilterCategory('Todas');
    setFilterSubcategory('Todas');
    setProximity('country');
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    filterState !== 'Todos' ||
    filterCity !== 'Todas' ||
    filterCategory !== 'Todas' ||
    filterSubcategory !== 'Todas' ||
    proximity !== 'country';

  const sharedAdminOverlays = (
    <>
      <AdminAuthSheet
        open={adminAuthOpen}
        onClose={() => setAdminAuthOpen(false)}
        onAuthenticated={(session) => {
          setAdminSession(session);
          setAdminAuthOpen(false);
          setAdminPanelOpen(true);
        }}
      />

      {adminPanelOpen && isAdminActive && (
        <AdminPanel
          adminEmail={effectiveAdminEmail}
          adminToken={adminSession?.token ?? null}
          isFirebaseAdmin={isFirebaseAdmin}
          firebaseAdminUid={firebaseUser?.uid ?? null}
          listings={allAdminListings}
          platformSettings={platformSettings}
          onPlatformSettingsUpdated={setPlatformSettings}
          onPreviewListing={(item) => setSelectedListing(item)}
          onAdminListingMutated={handleAdminListingMutated}
          onVerificationChanged={refreshVerificationState}
          onClose={() => void handleSignOutAdmin()}
          onSignOutAdmin={handleSignOutAdmin}
          showBackButton={false}
        />
      )}

      <ProductDetailSheet
        listing={selectedListing}
        sellerProfile={selectedListingSeller}
        aboveDock={
          !(adminPanelOpen && isAdminActive) && !(activeTab === 'chats' && activeThreadId !== null)
        }
        zIndexClass={
          adminPanelOpen && isAdminActive
            ? 'z-[75]'
            : activeTab === 'chats' && activeThreadId !== null
              ? 'z-50'
              : undefined
        }
        distanceKm={
          selectedListing
            ? getDistanceKm(userCity.lat, userCity.lng, selectedListing.lat, selectedListing.lng)
            : undefined
        }
        isOwnListing={Boolean(selectedListing) && isMySellerId(selectedListing?.sellerId)}
        onClose={() => setSelectedListing(null)}
        onOpenSeller={(listing) => {
          const profile = buildSellerProfileForListing(listing);
          setSelectedListing(null);
          if (profile) {
            setSellerSheetProfile(profile);
          }
        }}
        onStartChat={handleStartChat}
        onMarkSold={handleMarkSold}
      />
    </>
  );

  if (!authReady) {
    return (
      <ErrorBoundary>
        <div className="min-h-[100dvh] bg-[#FAFAFC] flex flex-col items-center justify-center gap-4 px-6">
          <QuemarketLogo size="md" />
          <div className="w-7 h-7 rounded-full border-2 border-[#362B3D]/20 border-t-[#362B3D] animate-spin" />
        </div>
        {sharedAdminOverlays}
      </ErrorBoundary>
    );
  }

  if (!firebaseUser || !onboarded || needsGoogleCompletion || needsMissingPermissionsPrompt) {
    return (
      <ErrorBoundary>
        <OnboardingLocation
          firebaseUser={firebaseUser}
          needsProfileCompletion={needsGoogleCompletion}
          hasConfirmedLocation={hasConfirmedLocation}
          initialStep={
            needsMissingPermissionsPrompt && onboarded && !needsGoogleCompletion
              ? 'permissions'
              : undefined
          }
          initialCity={userCity}
          onSignInGoogle={handleSignInGoogle}
          onCompleteGoogleProfile={handleCompleteGoogleProfile}
          onSignInEmail={handleSignInEmail}
          onSignOut={handleSignOut}
          onLocationConfirmed={handleLocationConfirmed}
          onConfirm={handleConfirmOnboarding}
          initialShowEmailForm={typeof window !== 'undefined' && window.location.pathname === '/admin'}
        />
        {sharedAdminOverlays}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] bg-[#FAFAFC] text-[#141118] flex flex-col">
        {/* Compact Sticky Top Bar (<= 54px + safe area) */}
        <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)] h-[calc(54px+env(safe-area-inset-top,0px))] bg-white/88 backdrop-blur-md border-b border-zinc-200/70">
          <div className="max-w-6xl mx-auto h-[54px] px-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setSearchSheetOpen(false);
                setSellSheetOpen(false);
                setShareToSellOpen(false);
                setActiveTab('market');
                setActiveThreadId(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="whitespace-nowrap shrink-0"
            >
              <QuemarketLogo size="sm" />
            </button>

            {activeTab === 'chats' ? (
              <span className="font-display text-sm font-bold text-[#141118] tracking-tight px-1">
                Chats
              </span>
            ) : activeTab === 'profile' ? (
              <span className="font-display text-sm font-bold text-[#141118] tracking-tight px-1">
                Mi Perfil
              </span>
            ) : (
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
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-4 pb-24">
          {platformSettings.announcementEnabled && platformSettings.announcementText.trim() && (
            <div className="mb-3.5 bg-[#F4EFFA] border border-[#DFD2F2] rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#2A2130]">
              <Megaphone className="w-4 h-4 text-[#6B4E8E] shrink-0" />
              <p className="font-medium leading-snug">{platformSettings.announcementText}</p>
            </div>
          )}

          {sellBlockNotice && (
            <div className="mb-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900">
              <p className="font-medium leading-snug">{sellBlockNotice}</p>
              <button
                type="button"
                onClick={() => setSellBlockNotice(null)}
                aria-label="Cerrar aviso"
                className="w-6 h-6 rounded-full hover:bg-amber-200/60 flex items-center justify-center shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {(activeTab === 'market' || activeTab === 'search') && (
            <div className="space-y-4">
              {/* Grouped filter & category selector row */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchSheetOpen(true)}
                  className={`h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                    hasActiveFilters
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-white border border-zinc-200/80 text-[#141118] hover:bg-zinc-50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filtros
                </button>

                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen(true)}
                  className={`flex-1 min-w-0 h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center justify-between gap-2 transition-colors ${
                    filterCategory !== 'Todas'
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-white border border-zinc-200/80 text-[#141118] hover:bg-zinc-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0 truncate">
                    <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {filterCategory === 'Todas'
                        ? 'Categorías'
                        : filterSubcategory !== 'Todas'
                          ? `${filterCategory} · ${filterSubcategory}`
                          : filterCategory}
                    </span>
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-75" />
                </button>
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
              ) : allActiveListings.length === 0 ? (
                <div className="bg-white rounded-[26px] border border-zinc-200/75 p-8 text-center space-y-3">
                  <p className="font-display text-base font-bold text-[#141118]">
                    Aún no hay publicaciones activas
                  </p>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                    Sé el primero en publicar en Quemarket y llega a compradores en todo el país.
                  </p>
                  <button
                    type="button"
                    onClick={openSellFlow}
                    className="h-10 px-5 rounded-xl bg-[#362B3D] text-white text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Publicar artículo
                  </button>
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
              onSelectThread={handleSelectThread}
              messagesByThread={allMessagesByThread}
              onSendMessage={handleSendMessage}
              unreadThreadIds={unreadThreadIds}
              verifiedUserIds={verifiedUserIds}
              onDeleteThread={handleDeleteThread}
              onOpenListing={(thread) => {
                const existing = allAdminListings.find((l) => l.id === thread.listingId);
                if (existing) {
                  setSelectedListing(existing);
                  return;
                }
                setSelectedListing({
                  id: thread.listingId,
                  title: thread.listingTitle,
                  priceUsd: thread.listingPrice,
                  category: 'Otros',
                  condition: 'Usado',
                  description: '',
                  imageUrl: thread.listingImage,
                  imageUrls: thread.listingImage ? [thread.listingImage] : [],
                  city: userCity.city,
                  state: userCity.state,
                  lat: userCity.lat,
                  lng: userCity.lng,
                  sellerId: thread.sellerId,
                  sellerName: thread.sellerName,
                  status: 'active',
                  createdAtMs: thread.createdAtMs,
                  source: 'firestore',
                });
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              firebaseUser={firebaseUser}
              displayName={currentUserName}
              avatarUrl={effectiveAvatarUrl}
              sellerBio={effectiveBio}
              userCity={userCity}
              customCategories={customCategories}
              myListings={myListings}
              purchases={allPurchases}
              identityVerificationStatus={myVerificationState.status}
              identityRejectionReason={myVerificationState.rejectionReason}
              onSubmitIdentityVerification={handleSubmitIdentityVerification}
              onUpdateAvatar={handleUpdateAvatar}
              onUpdateBio={handleUpdateBio}
              onSignOut={handleSignOut}
              onOpenCityPicker={() => setCityPickerOpen(true)}
              onToggleCustomCategory={handleToggleCustomCategory}
              onAddCustomCategory={handleAddCustomCategory}
              onMarkListingSold={handleMarkSold}
              onDeleteListing={handleDeleteListing}
              onOpenSell={openSellFlow}
              onResendVerification={handleResendVerification}
            />
          )}
        </main>

        {/* Single 5-Button Bottom Dock anchored flush to bottom (hidden inside open chat room) */}
        {!(activeTab === 'chats' && activeThreadId !== null) && (
          <BottomDock
            activeTab={dockActiveTab}
            onSelectTab={handleDockSelect}
            unreadCount={unreadThreadIds.size}
          />
        )}

        {/* Bottom Sheets rising above the dock */}
        <SearchSheet
          open={searchSheetOpen}
          onClose={() => setSearchSheetOpen(false)}
          onApply={() => {
            setSearchSheetOpen(false);
            setActiveTab('market');
          }}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedState={filterState}
          onSelectState={setFilterState}
          selectedCity={filterCity}
          onSelectCity={setFilterCity}
          selectedCategory={filterCategory}
          onSelectCategory={(cat) => {
            setFilterCategory(cat);
            setFilterSubcategory('Todas');
          }}
          proximity={proximity}
          onSelectProximity={setProximity}
          customCategories={customCategories}
          resultCount={filteredListings.length}
          onReset={resetFilters}
        />

        <CategoryPickerSheet
          open={categoryPickerOpen}
          onClose={() => setCategoryPickerOpen(false)}
          selectedCategory={filterCategory}
          selectedSubcategory={filterSubcategory}
          customCategories={customCategories}
          onSelect={(cat, sub = 'Todas') => {
            setFilterCategory(cat);
            setFilterSubcategory(sub);
          }}
        />

        <ShareToSellSheet
          open={shareToSellOpen}
          onClose={() => setShareToSellOpen(false)}
          unlockAtMs={sellUnlockAtMs}
          onUnlocked={handleSellUnlocked}
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

        <SellerProfileSheet
          open={Boolean(sellerSheetProfile)}
          seller={sellerSheetProfile}
          sellerListings={activeSellerListings}
          isOwnProfile={Boolean(sellerSheetProfile) && isMySellerId(sellerSheetProfile?.uid)}
          onClose={() => setSellerSheetProfile(null)}
          onSelectListing={(item) => {
            setSellerSheetProfile(null);
            setSelectedListing(item);
          }}
          onStartChat={(item) => {
            setSellerSheetProfile(null);
            handleStartChat(item).catch((err) => {
              setSellBlockNotice(
                err instanceof Error
                  ? err.message
                  : 'No se pudo iniciar la conversación con este vendedor.'
              );
            });
          }}
        />
      </div>
      {sharedAdminOverlays}
    </ErrorBoundary>
  );
}
