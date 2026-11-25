import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Loader2,
  LogOut,
  Maximize2,
  Megaphone,
  MessageSquare,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  AdminRoleRecord,
  AdminUserRecord,
  ChatThread,
  IdentityVerificationRecord,
  Listing,
  ListingStatus,
  PlatformSettings,
  Purchase,
} from '../types/marketplace';
import {
  decideIdentityVerificationFirestore,
  decideIdentityVerificationServer,
  deleteChatAsAdmin,
  deleteListingAsAdmin,
  deleteListingServer,
  fetchAdminListingsServer,
  fetchAdminVerificationsServer,
  fetchAllAdminRoles,
  fetchAllChatsForAdmin,
  fetchAllIdentityVerificationsFirestore,
  fetchAllListingsForAdmin,
  fetchAllPurchasesForAdmin,
  fetchAllUsersForAdmin,
  grantAdminRoleAsAdmin,
  refreshBcvRateAsAdmin,
  revokeAdminRoleAsAdmin,
  saveGlobalPlatformSettingsFirestore,
  savePlatformSettingsServer,
  setUserSuspendedAsAdmin,
  updateListingStatusAsAdmin,
  updateListingStatusServer,
} from '../lib/adminService';
import { BcvRateInfo, fetchDailyBcvRate, formatBolivares } from '../lib/bcvService';

type AdminTab = 'overview' | 'verifications' | 'listings' | 'users' | 'activity' | 'settings';

interface AdminPanelProps {
  adminEmail: string;
  adminToken: string | null;
  isFirebaseAdmin: boolean;
  firebaseAdminUid: string | null;
  listings: Listing[];
  platformSettings: PlatformSettings;
  onPlatformSettingsUpdated: (next: PlatformSettings) => void;
  onPreviewListing: (listing: Listing) => void;
  onAdminListingMutated: (
    listingId: string,
    action: 'approve' | 'reject' | 'mark-sold' | 'reactivate' | 'delete'
  ) => void;
  onVerificationChanged?: () => void;
  onClose: () => void;
  onSignOutAdmin: () => Promise<void>;
  showBackButton?: boolean;
}

export function AdminPanel({
  adminEmail,
  adminToken,
  isFirebaseAdmin,
  firebaseAdminUid,
  listings,
  platformSettings,
  onPlatformSettingsUpdated,
  onPreviewListing,
  onAdminListingMutated,
  onVerificationChanged,
  onClose,
  onSignOutAdmin,
  showBackButton = false,
}: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [serverListings, setServerListings] = useState<Listing[]>([]);
  const [cloudAdminListings, setCloudAdminListings] = useState<Listing[]>([]);
  const [serverVerifications, setServerVerifications] = useState<IdentityVerificationRecord[]>([]);
  const [cloudVerifications, setCloudVerifications] = useState<IdentityVerificationRecord[]>([]);
  const [cloudUsers, setCloudUsers] = useState<AdminUserRecord[]>([]);
  const [cloudAdmins, setCloudAdmins] = useState<AdminRoleRecord[]>([]);
  const [cloudPurchases, setCloudPurchases] = useState<Purchase[]>([]);
  const [cloudChats, setCloudChats] = useState<ChatThread[]>([]);
  const [bcvRate, setBcvRate] = useState<BcvRateInfo | null>(null);
  const [refreshingBcv, setRefreshingBcv] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [apkInfo, setApkInfo] = useState<{
    available: boolean;
    sizeLabel: string;
    versionName: string;
  } | null>(null);

  // Filters & confirmations
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<
    'all' | 'pending' | 'active' | 'sold' | 'rejected'
  >('all');
  const [verificationSearch, setVerificationSearch] = useState('');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState<
    'pending' | 'approved' | 'rejected' | 'all'
  >('pending');
  const [rejectingUid, setRejectingUid] = useState<string | null>(null);
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState('');
  const [photoPreview, setPhotoPreview] = useState<{ label: string; url: string } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [activitySubTab, setActivitySubTab] = useState<'purchases' | 'chats'>('purchases');
  const [confirmDeleteListingId, setConfirmDeleteListingId] = useState<string | null>(null);
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Settings form state
  const [announcementEnabled, setAnnouncementEnabled] = useState(
    platformSettings.announcementEnabled
  );
  const [announcementText, setAnnouncementText] = useState(platformSettings.announcementText);
  const [allowNewListings, setAllowNewListings] = useState(platformSettings.allowNewListings);
  const [maintenanceMessage, setMaintenanceMessage] = useState(platformSettings.maintenanceMessage);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setAnnouncementEnabled(platformSettings.announcementEnabled);
    setAnnouncementText(platformSettings.announcementText);
    setAllowNewListings(platformSettings.allowNewListings);
    setMaintenanceMessage(platformSettings.maintenanceMessage);
  }, [platformSettings]);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((curr) => (curr?.text === text ? null : curr));
    }, 3200);
  };

  const loadAdminData = async () => {
    setLoadingCloud(true);
    try {
      const baseApiUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const [rateRes, apkRes, serverListingsRes, serverVerRes] = await Promise.allSettled([
        fetchDailyBcvRate(false),
        fetch(`${baseApiUrl}/api/apk-info`, { cache: 'no-store' }).then((r) =>
          r.ok ? r.json() : null
        ),
        adminToken ? fetchAdminListingsServer(adminToken) : Promise.resolve([]),
        adminToken ? fetchAdminVerificationsServer(adminToken) : Promise.resolve([]),
      ]);
      if (rateRes.status === 'fulfilled') setBcvRate(rateRes.value);
      if (apkRes.status === 'fulfilled' && apkRes.value) setApkInfo(apkRes.value);
      if (serverListingsRes.status === 'fulfilled') setServerListings(serverListingsRes.value);
      if (serverVerRes.status === 'fulfilled') setServerVerifications(serverVerRes.value);

      if (isFirebaseAdmin) {
        const [usersRes, adminsRes, purchasesRes, chatsRes, cloudListingsRes, cloudVerRes] =
          await Promise.allSettled([
            fetchAllUsersForAdmin(),
            fetchAllAdminRoles(),
            fetchAllPurchasesForAdmin(),
            fetchAllChatsForAdmin(),
            fetchAllListingsForAdmin(),
            fetchAllIdentityVerificationsFirestore(),
          ]);
        if (usersRes.status === 'fulfilled') setCloudUsers(usersRes.value);
        if (adminsRes.status === 'fulfilled') setCloudAdmins(adminsRes.value);
        if (purchasesRes.status === 'fulfilled') setCloudPurchases(purchasesRes.value);
        if (chatsRes.status === 'fulfilled') setCloudChats(chatsRes.value);
        if (cloudListingsRes.status === 'fulfilled') setCloudAdminListings(cloudListingsRes.value);
        if (cloudVerRes.status === 'fulfilled') setCloudVerifications(cloudVerRes.value);
      }
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [isFirebaseAdmin, adminToken]);

  const allPurchases = useMemo(() => {
    return [...cloudPurchases].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [cloudPurchases]);

  const allChats = useMemo(() => {
    return [...cloudChats].sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
  }, [cloudChats]);

  const combinedListings = useMemo(() => {
    const map = new Map<string, Listing>();
    listings.forEach((l) => map.set(l.id, l));
    cloudAdminListings.forEach((l) => map.set(l.id, l));
    serverListings.forEach((l) => map.set(l.id, l));
    return Array.from(map.values())
      .map((item) => {
        const autoAt = item.autoApproveAtMs || item.createdAtMs + 30 * 60 * 1000;
        if (item.status === 'pending' && nowMs >= autoAt) {
          return { ...item, status: 'active' as ListingStatus, autoApproveAtMs: autoAt };
        }
        return { ...item, autoApproveAtMs: autoAt };
      })
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return b.createdAtMs - a.createdAtMs;
      });
  }, [listings, cloudAdminListings, serverListings, nowMs]);

  const combinedVerifications = useMemo(() => {
    const map = new Map<string, IdentityVerificationRecord>();
    cloudVerifications.forEach((v) => map.set(v.uid, v));
    serverVerifications.forEach((v) => {
      const existing = map.get(v.uid);
      if (!existing) {
        map.set(v.uid, v);
      } else {
        const useServer = v.updatedAtMs >= existing.updatedAtMs;
        map.set(v.uid, {
          ...(useServer ? v : existing),
          selfieUrl: (useServer ? v.selfieUrl : existing.selfieUrl) || existing.selfieUrl || v.selfieUrl,
          idCardUrl: (useServer ? v.idCardUrl : existing.idCardUrl) || existing.idCardUrl || v.idCardUrl,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return b.submittedAtMs - a.submittedAtMs;
    });
  }, [cloudVerifications, serverVerifications]);

  const approvedVerificationUids = useMemo(() => {
    const set = new Set<string>();
    combinedVerifications.forEach((v) => {
      if (v.status === 'approved') set.add(v.uid);
    });
    return set;
  }, [combinedVerifications]);

  // Combine Firestore users with seller summaries inferred from listings so panel always shows marketplace sellers
  const directoryUsers = useMemo(() => {
    const adminUids = new Set(cloudAdmins.map((a) => a.uid));
    const map = new Map<string, AdminUserRecord & { listingCount: number; source: 'cloud' | 'catalog' }>();

    cloudUsers.forEach((u) => {
      map.set(u.uid, {
        ...u,
        identityVerified: Boolean(u.identityVerified) || approvedVerificationUids.has(u.uid),
        isAdmin: adminUids.has(u.uid),
        listingCount: 0,
        source: 'cloud',
      });
    });

    combinedListings.forEach((l) => {
      const existing = map.get(l.sellerId);
      if (existing) {
        existing.listingCount += 1;
      } else {
        map.set(l.sellerId, {
          uid: l.sellerId,
          displayName: l.sellerName,
          username: l.sellerName.startsWith('@') ? l.sellerName : undefined,
          city: l.city,
          state: l.state,
          suspended: false,
          identityVerified: approvedVerificationUids.has(l.sellerId),
          updatedAtMs: l.createdAtMs,
          isAdmin: adminUids.has(l.sellerId),
          listingCount: 1,
          source: 'catalog',
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.source !== b.source) return a.source === 'cloud' ? -1 : 1;
      return b.listingCount - a.listingCount;
    });
  }, [cloudUsers, cloudAdmins, combinedListings, approvedVerificationUids]);

  const metrics = useMemo(() => {
    const pendingListings = combinedListings.filter((l) => l.status === 'pending');
    const activeListings = combinedListings.filter((l) => l.status === 'active');
    const soldListings = combinedListings.filter((l) => l.status === 'sold');
    const rejectedListings = combinedListings.filter((l) => l.status === 'rejected');
    const catalogUsd = activeListings.reduce((sum, l) => sum + (Number(l.priceUsd) || 0), 0);
    const salesUsd = allPurchases.reduce((sum, p) => sum + (Number(p.priceUsd) || 0), 0);

    const byCategory = new Map<string, number>();
    combinedListings.forEach((l) => {
      byCategory.set(l.category, (byCategory.get(l.category) || 0) + 1);
    });
    const topCategories = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const pendingVerificationsCount = combinedVerifications.filter(
      (v) => v.status === 'pending'
    ).length;
    const approvedVerificationsCount = combinedVerifications.filter(
      (v) => v.status === 'approved'
    ).length;

    return {
      totalListings: combinedListings.length,
      pendingCount: pendingListings.length,
      activeCount: activeListings.length,
      soldCount: soldListings.length,
      rejectedCount: rejectedListings.length,
      pendingVerificationsCount,
      approvedVerificationsCount,
      catalogUsd,
      salesUsd,
      purchasesCount: allPurchases.length,
      usersCount: directoryUsers.length,
      chatsCount: allChats.length,
      topCategories,
    };
  }, [combinedListings, combinedVerifications, allPurchases, directoryUsers, allChats]);

  const filteredListings = useMemo(() => {
    const q = listingSearch.trim().toLowerCase();
    return combinedListings.filter((item) => {
      if (listingStatusFilter !== 'all' && item.status !== listingStatusFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.sellerName.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [combinedListings, listingSearch, listingStatusFilter]);

  const filteredVerifications = useMemo(() => {
    const q = verificationSearch.trim().toLowerCase();
    return combinedVerifications.filter((v) => {
      if (verificationStatusFilter !== 'all' && v.status !== verificationStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        v.displayName.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.state.toLowerCase().includes(q) ||
        v.uid.toLowerCase().includes(q)
      );
    });
  }, [combinedVerifications, verificationSearch, verificationStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return directoryUsers;
    return directoryUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        u.state.toLowerCase().includes(q)
    );
  }, [directoryUsers, userSearch]);

  const handleDecideVerification = async (
    record: IdentityVerificationRecord,
    decision: 'approved' | 'rejected',
    reason?: string
  ) => {
    setBusyId(`ver_${record.uid}`);
    const cleanReason = decision === 'rejected' ? (reason || '').trim().slice(0, 240) : undefined;
    try {
      if (adminToken) {
        await decideIdentityVerificationServer(adminToken, record.uid, decision, {
          rejectionReason: cleanReason,
          displayName: record.displayName,
          city: record.city,
          state: record.state,
        });
      }
      if (isFirebaseAdmin) {
        await decideIdentityVerificationFirestore(record.uid, decision, adminEmail, cleanReason);
      }

      const now = Date.now();
      const applyUpdate = (list: IdentityVerificationRecord[]) =>
        list.map((item) =>
          item.uid === record.uid
            ? {
                ...item,
                status: decision,
                reviewedBy: adminEmail,
                rejectionReason: cleanReason,
                updatedAtMs: now,
              }
            : item
        );

      setServerVerifications(applyUpdate);
      setCloudVerifications(applyUpdate);
      setCloudUsers((prev) =>
        prev.map((u) =>
          u.uid === record.uid ? { ...u, identityVerified: decision === 'approved' } : u
        )
      );
      setRejectingUid(null);
      setRejectionReasonDraft('');
      onVerificationChanged?.();
      showToast(
        'ok',
        decision === 'approved'
          ? `${record.displayName} ahora está verificado.`
          : `Verificación de ${record.displayName} rechazada.`
      );
    } catch (err) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'No se pudo actualizar la verificación.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSetListingStatus = async (item: Listing, nextStatus: ListingStatus) => {
    setBusyId(item.id);
    try {
      if (adminToken) {
        await updateListingStatusServer(adminToken, item.id, nextStatus);
      }
      if (item.source === 'firestore' && isFirebaseAdmin) {
        await updateListingStatusAsAdmin(item.id, nextStatus);
      }

      setServerListings((prev) =>
        prev.map((l) =>
          l.id === item.id
            ? { ...l, status: nextStatus, soldAtMs: nextStatus === 'sold' ? Date.now() : undefined }
            : l
        )
      );
      setCloudAdminListings((prev) =>
        prev.map((l) =>
          l.id === item.id
            ? { ...l, status: nextStatus, soldAtMs: nextStatus === 'sold' ? Date.now() : undefined }
            : l
        )
      );

      if (nextStatus === 'active') {
        onAdminListingMutated(item.id, item.status === 'pending' ? 'approve' : 'reactivate');
      } else if (nextStatus === 'rejected') {
        onAdminListingMutated(item.id, 'reject');
      } else if (nextStatus === 'sold') {
        onAdminListingMutated(item.id, 'mark-sold');
      }

      const msg =
        nextStatus === 'active'
          ? item.status === 'pending'
            ? 'Publicación aprobada y visible para todos.'
            : 'Publicación reactivada.'
          : nextStatus === 'rejected'
            ? 'Publicación rechazada.'
            : 'Publicación marcada como vendida.';
      showToast('ok', msg);
    } catch (err) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'No se pudo actualizar el estado de la publicación.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteListing = async (item: Listing) => {
    setBusyId(item.id);
    try {
      if (adminToken) {
        await deleteListingServer(adminToken, item.id);
      }
      if (isFirebaseAdmin) {
        await deleteListingAsAdmin(item.id);
      }
      setServerListings((prev) => prev.filter((l) => l.id !== item.id));
      setCloudAdminListings((prev) => prev.filter((l) => l.id !== item.id));
      onAdminListingMutated(item.id, 'delete');
      setConfirmDeleteListingId(null);
      showToast('ok', 'Publicación eliminada correctamente.');
    } catch (err) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'No se pudo eliminar la publicación.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleSuspendUser = async (user: AdminUserRecord) => {
    if (!isFirebaseAdmin) {
      showToast('err', 'Requiere sesión Firebase administradora verificada.');
      return;
    }
    setBusyId(user.uid);
    try {
      const next = !user.suspended;
      await setUserSuspendedAsAdmin(user.uid, next);
      setCloudUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, suspended: next } : u))
      );
      showToast('ok', next ? 'Usuario suspendido.' : 'Usuario reactivado.');
    } catch {
      showToast('err', 'No se pudo actualizar el estado del usuario.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleAdminRole = async (user: AdminUserRecord) => {
    if (!isFirebaseAdmin || !firebaseAdminUid) {
      showToast('err', 'Requiere sesión Firebase administradora verificada.');
      return;
    }
    if (user.uid === firebaseAdminUid) {
      showToast('err', 'No puedes revocar tu propio rol administrador.');
      return;
    }
    setBusyId(user.uid);
    try {
      if (user.isAdmin) {
        await revokeAdminRoleAsAdmin(user.uid);
        setCloudAdmins((prev) => prev.filter((a) => a.uid !== user.uid));
        showToast('ok', 'Rol de administrador revocado.');
      } else {
        await grantAdminRoleAsAdmin(
          user.uid,
          user.username || user.displayName,
          firebaseAdminUid
        );
        setCloudAdmins((prev) => [
          ...prev,
          {
            uid: user.uid,
            email: user.username || user.displayName,
            grantedBy: firebaseAdminUid,
            createdAtMs: Date.now(),
          },
        ]);
        showToast('ok', 'Usuario promovido a administrador.');
      }
    } catch {
      showToast('err', 'No se pudo cambiar el rol de administrador.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteChat = async (chat: ChatThread) => {
    if (!isFirebaseAdmin) {
      showToast('err', 'Requiere sesión Firebase administradora para moderar chats en la nube.');
      return;
    }
    setBusyId(chat.id);
    try {
      await deleteChatAsAdmin(chat.id);
      setCloudChats((prev) => prev.filter((c) => c.id !== chat.id));
      setConfirmDeleteChatId(null);
      showToast('ok', 'Conversación eliminada.');
    } catch {
      showToast('err', 'No se pudo eliminar la conversación.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRefreshBcv = async () => {
    if (refreshingBcv) return;
    setRefreshingBcv(true);
    try {
      const updated = adminToken
        ? await refreshBcvRateAsAdmin(adminToken)
        : await fetchDailyBcvRate(true);
      setBcvRate(updated);
      showToast('ok', `Tasa BCV actualizada: Bs. ${updated.rawRate}`);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Error al refrescar tasa BCV.');
    } finally {
      setRefreshingBcv(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSettings) return;
    setSavingSettings(true);
    const payload = {
      announcementEnabled,
      announcementText: announcementText.trim().slice(0, 280),
      allowNewListings,
      maintenanceMessage: maintenanceMessage.trim().slice(0, 280),
    };
    try {
      let saved: PlatformSettings = {
        ...payload,
        updatedBy: adminEmail,
        updatedAtMs: Date.now(),
      };
      if (adminToken) {
        saved = await savePlatformSettingsServer(adminToken, payload);
      }
      if (isFirebaseAdmin) {
        await saveGlobalPlatformSettingsFirestore(payload, adminEmail);
      }
      onPlatformSettingsUpdated(saved);
      showToast('ok', 'Configuración de plataforma guardada.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'No se pudo guardar la configuración.');
    } finally {
      setSavingSettings(false);
    }
  };

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { id: 'overview', label: 'Resumen', icon: BarChart3 },
      { id: 'verifications', label: 'Verificaciones', icon: BadgeCheck },
      { id: 'listings', label: 'Publicaciones', icon: Package },
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'activity', label: 'Actividad', icon: ShoppingBag },
      { id: 'settings', label: 'Ajustes', icon: Settings },
    ];

  return (
    <div className="fixed inset-0 z-[60] bg-[#FAFAFC] text-[#141118] flex flex-col overflow-hidden">
      {/* Top Admin Header */}
      <header className="shrink-0 pt-[env(safe-area-inset-top,0px)] bg-[#362B3D] text-white border-b border-white/10">
        <div className="max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {showBackButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Volver"
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#DFCFF3] shrink-0" />
                <h1 className="font-display text-sm sm:text-base font-bold truncate">
                  Administración Quemarket
                </h1>
              </div>
              <p className="text-[11px] text-white/70 truncate">{adminEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadAdminData()}
              disabled={loadingCloud}
              aria-label="Actualizar datos"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCloud ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => void onSignOutAdmin()}
              className="h-9 px-3 rounded-xl bg-white/10 hover:bg-rose-500/80 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-white text-[#2A2130] shadow-xs'
                      : 'bg-white/10 text-white/80 hover:bg-white/18 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.id === 'verifications' && metrics.pendingVerificationsCount > 0 && (
                    <span
                      className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        active ? 'bg-emerald-600 text-white' : 'bg-emerald-400 text-[#141118]'
                      }`}
                    >
                      {metrics.pendingVerificationsCount}
                    </span>
                  )}
                  {t.id === 'listings' && metrics.pendingCount > 0 && (
                    <span
                      className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        active ? 'bg-amber-500 text-white' : 'bg-amber-400 text-[#2A2130]'
                      }`}
                    >
                      {metrics.pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* Inline Feedback Toast */}
        {feedback && (
          <div className="max-w-6xl w-full mx-auto px-4 pt-3 shrink-0">
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-6xl mx-auto px-4 py-4 pb-10 space-y-4">
            {tab === 'overview' && (
              <div className="space-y-4">
                {metrics.pendingVerificationsCount > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-[22px] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-emerald-950">
                          {metrics.pendingVerificationsCount}{' '}
                          {metrics.pendingVerificationsCount === 1
                            ? 'solicitud de verificación pendiente'
                            : 'solicitudes de verificación pendientes'}
                        </p>
                        <p className="text-xs text-emerald-800">
                          Revisa la selfie y la foto de cédula para aprobar o rechazar cada usuario.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationStatusFilter('pending');
                        setTab('verifications');
                      }}
                      className="h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors shrink-0"
                    >
                      Revisar identidades
                    </button>
                  </div>
                )}

                {metrics.pendingCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-[22px] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-amber-950">
                          {metrics.pendingCount}{' '}
                          {metrics.pendingCount === 1
                            ? 'publicación esperando revisión'
                            : 'publicaciones esperando revisión'}
                        </p>
                        <p className="text-xs text-amber-800">
                          Puedes aprobarlas o rechazarlas ahora. Las no rechazadas se aceptan
                          automáticamente a los 30 minutos.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setListingStatusFilter('pending');
                        setTab('listings');
                      }}
                      className="h-9 px-3.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-semibold transition-colors shrink-0"
                    >
                      Revisar ahora
                    </button>
                  </div>
                )}

                {/* Access Mode Notice */}
                <div className="bg-white rounded-[22px] border border-zinc-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-[#141118]">
                        Sesión administrativa activa
                      </p>
                      <p className="text-xs text-zinc-500">
                        Las nuevas publicaciones pasan primero por revisión y se aceptan
                        automáticamente a los 30 minutos si no son rechazadas.
                      </p>
                    </div>
                  </div>
                  <span className="h-7 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold inline-flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {isFirebaseAdmin ? 'Nube + Servidor' : 'Servidor'}
                  </span>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white rounded-[22px] border border-zinc-200/80 p-4">
                    <p className="text-xs font-medium text-zinc-500">Publicaciones activas</p>
                    <p className="font-display text-2xl font-bold text-[#141118] mt-1 tabular-nums">
                      {metrics.activeCount}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                      {metrics.pendingCount} en revisión · {metrics.soldCount} vendidas
                    </p>
                  </div>

                <div className="bg-white rounded-[22px] border border-zinc-200/80 p-4">
                  <p className="text-xs font-medium text-zinc-500">Valor del catálogo</p>
                  <p className="font-display text-2xl font-bold text-[#141118] mt-1 tabular-nums">
                    ${metrics.catalogUsd.toLocaleString('es-VE')}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums truncate">
                    {bcvRate
                      ? `Bs. ${formatBolivares(metrics.catalogUsd * bcvRate.usdToVes)}`
                      : 'En USD activos'}
                  </p>
                </div>

                <div className="bg-white rounded-[22px] border border-zinc-200/80 p-4">
                  <p className="text-xs font-medium text-zinc-500">Vendedores y usuarios</p>
                  <p className="font-display text-2xl font-bold text-[#141118] mt-1 tabular-nums">
                    {metrics.usersCount}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                    {cloudUsers.length} registrados en nube
                  </p>
                </div>

                <div className="bg-white rounded-[22px] border border-zinc-200/80 p-4">
                  <p className="text-xs font-medium text-zinc-500">Ventas y chats</p>
                  <p className="font-display text-2xl font-bold text-[#141118] mt-1 tabular-nums">
                    {metrics.purchasesCount}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                    ${metrics.salesUsd.toLocaleString('es-VE')} · {metrics.chatsCount} chats
                  </p>
                </div>
              </div>

              {/* Two-column lower section: Category Breakdown & Live BCV Rate */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="bg-white rounded-[24px] border border-zinc-200/80 p-4 space-y-3">
                  <h2 className="font-display text-sm font-bold text-[#141118]">
                    Categorías con más publicaciones
                  </h2>
                  {metrics.topCategories.length === 0 ? (
                    <p className="text-xs text-zinc-500">No hay publicaciones registradas aún.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {metrics.topCategories.map(([cat, count]) => {
                        const pct = Math.max(
                          6,
                          Math.round((count / Math.max(1, metrics.totalListings)) * 100)
                        );
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-[#141118] truncate pr-2">
                                {cat}
                              </span>
                              <span className="text-zinc-500 tabular-nums shrink-0">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#362B3D]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="bg-white rounded-[24px] border border-zinc-200/80 p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-sm font-bold text-[#141118]">
                        Tasa oficial BCV (USD → Bs.)
                      </h2>
                      <button
                        type="button"
                        onClick={handleRefreshBcv}
                        disabled={refreshingBcv}
                        className="h-8 px-3 rounded-xl bg-[#F4EFFA] hover:bg-[#E7DBF7] text-[#362B3D] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${refreshingBcv ? 'animate-spin' : ''}`}
                        />
                        Refrescar
                      </button>
                    </div>
                    {bcvRate ? (
                      <div className="rounded-2xl bg-zinc-50 border border-zinc-200/70 p-3.5 space-y-1">
                        <p className="font-display text-2xl font-bold text-[#141118] tabular-nums">
                          Bs. {bcvRate.rawRate}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Fecha valor: {bcvRate.valueDateLabel || bcvRate.caracasDate}
                        </p>
                        <p className="text-[11px] text-zinc-400">Fuente: {bcvRate.source}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Consultando tasa BCV...</p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-zinc-50 border border-zinc-200/70 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Smartphone className="w-4 h-4 text-[#362B3D] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#141118] truncate">
                          Paquete Android (APK)
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {apkInfo?.available
                            ? `Disponible v${apkInfo.versionName} · ${apkInfo.sizeLabel}`
                            : 'Proyecto Capacitor sincronizado (sin binario en releases/)'}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === 'verifications' && (
            <div className="space-y-3">
              <div className="bg-white rounded-[22px] border border-zinc-200/80 p-3 flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={verificationSearch}
                    onChange={(e) => setVerificationSearch(e.target.value)}
                    placeholder="Buscar por usuario, ciudad o estado..."
                    className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
                  />
                </div>
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar">
                  {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setVerificationStatusFilter(st)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        verificationStatusFilter === st
                          ? 'bg-white text-[#141118] shadow-xs'
                          : 'text-zinc-500 hover:text-[#141118]'
                      }`}
                    >
                      {st === 'pending'
                        ? `Pendientes (${metrics.pendingVerificationsCount})`
                        : st === 'approved'
                          ? `Aprobadas (${metrics.approvedVerificationsCount})`
                          : st === 'rejected'
                            ? 'Rechazadas'
                            : 'Todas'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredVerifications.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-zinc-200/80 p-8 text-center space-y-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#F4EFFA] text-[#362B3D] mx-auto flex items-center justify-center">
                    <BadgeCheck className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-[#141118]">
                    {verificationStatusFilter === 'pending'
                      ? 'No hay solicitudes pendientes de verificación'
                      : 'No se encontraron solicitudes'}
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Cuando un usuario envíe su selfie y foto de cédula desde Mi Perfil aparecerá aquí
                    para tu aprobación.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredVerifications.map((ver) => {
                    const isBusy = busyId === `ver_${ver.uid}`;
                    const isRejecting = rejectingUid === ver.uid;
                    return (
                      <div
                        key={ver.uid}
                        className={`bg-white rounded-[22px] border p-4 space-y-3.5 ${
                          ver.status === 'pending'
                            ? 'border-amber-300/90 bg-amber-50/15'
                            : 'border-zinc-200/80'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-display text-sm font-bold text-[#141118] truncate">
                                {ver.displayName}
                              </p>
                              {ver.status === 'approved' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                  <BadgeCheck className="w-3 h-3" />
                                  Verificado
                                </span>
                              ) : ver.status === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                                  <XCircle className="w-3 h-3" />
                                  Rechazado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  <Clock className="w-3 h-3" />
                                  Pendiente de revisión
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                              {ver.city}
                              {ver.state ? `, ${ver.state}` : ''} · Enviado el{' '}
                              {new Date(ver.submittedAtMs).toLocaleString('es-VE')}
                            </p>
                            {ver.rejectionReason && ver.status === 'rejected' && (
                              <p className="text-xs text-rose-700 mt-1">
                                Motivo: {ver.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Selfie + Cédula side by side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-2.5 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-[#141118]">
                              <span className="inline-flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-[#6B4E8E]" />
                                Selfie del usuario
                              </span>
                              {ver.selfieUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoPreview({
                                      label: `Selfie — ${ver.displayName}`,
                                      url: ver.selfieUrl,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B4E8E] hover:text-[#362B3D]"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  Ampliar
                                </button>
                              )}
                            </div>
                            {ver.selfieUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPhotoPreview({
                                    label: `Selfie — ${ver.displayName}`,
                                    url: ver.selfieUrl,
                                  })
                                }
                                className="block w-full rounded-xl overflow-hidden bg-white border border-zinc-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#362B3D]"
                              >
                                <img
                                  src={ver.selfieUrl}
                                  alt={`Selfie de ${ver.displayName}`}
                                  className="w-full h-48 object-cover"
                                />
                              </button>
                            ) : (
                              <div className="h-32 rounded-xl bg-zinc-100 flex items-center justify-center text-xs text-zinc-400">
                                Sin foto disponible
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-2.5 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-[#141118]">
                              <span className="inline-flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-[#6B4E8E]" />
                                Foto de la cédula
                              </span>
                              {ver.idCardUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoPreview({
                                      label: `Cédula — ${ver.displayName}`,
                                      url: ver.idCardUrl,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B4E8E] hover:text-[#362B3D]"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  Ampliar
                                </button>
                              )}
                            </div>
                            {ver.idCardUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPhotoPreview({
                                    label: `Cédula — ${ver.displayName}`,
                                    url: ver.idCardUrl,
                                  })
                                }
                                className="block w-full rounded-xl overflow-hidden bg-white border border-zinc-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#362B3D]"
                              >
                                <img
                                  src={ver.idCardUrl}
                                  alt={`Cédula de ${ver.displayName}`}
                                  className="w-full h-48 object-cover"
                                />
                              </button>
                            ) : (
                              <div className="h-32 rounded-xl bg-zinc-100 flex items-center justify-center text-xs text-zinc-400">
                                Sin foto disponible
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Decision Controls */}
                        {isRejecting ? (
                          <div className="rounded-2xl bg-rose-50/70 border border-rose-200/80 p-3 space-y-2.5">
                            <label className="block text-xs font-semibold text-rose-900">
                              Motivo del rechazo (opcional)
                            </label>
                            <input
                              type="text"
                              value={rejectionReasonDraft}
                              onChange={(e) => setRejectionReasonDraft(e.target.value)}
                              maxLength={240}
                              placeholder="Ej. La cédula sale borrosa o no coincide con la selfie."
                              className="w-full h-10 px-3 rounded-xl bg-white border border-rose-200 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setRejectingUid(null);
                                  setRejectionReasonDraft('');
                                }}
                                className="h-9 px-3 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleDecideVerification(
                                    ver,
                                    'rejected',
                                    rejectionReasonDraft
                                  )
                                }
                                className="h-9 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Confirmar rechazo
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {ver.status !== 'approved' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDecideVerification(ver, 'approved')}
                                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <BadgeCheck className="w-4 h-4" />
                                )}
                                Aprobar verificación
                              </button>
                            )}
                            {ver.status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setRejectingUid(ver.uid);
                                  setRejectionReasonDraft('');
                                }}
                                className="h-10 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                {ver.status === 'approved' ? 'Revocar' : 'Rechazar'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'listings' && (
            <div className="space-y-3">
              <div className="bg-white rounded-[22px] border border-zinc-200/80 p-3 flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    placeholder="Buscar por título, vendedor, categoría o ciudad..."
                    className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
                  />
                </div>
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar">
                  {(['pending', 'all', 'active', 'sold', 'rejected'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setListingStatusFilter(st)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        listingStatusFilter === st
                          ? 'bg-white text-[#141118] shadow-xs'
                          : 'text-zinc-500 hover:text-[#141118]'
                      }`}
                    >
                      {st === 'pending'
                        ? `En revisión (${metrics.pendingCount})`
                        : st === 'all'
                          ? 'Todas'
                          : st === 'active'
                            ? 'Activas'
                            : st === 'sold'
                              ? 'Vendidas'
                              : 'Rechazadas'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredListings.length === 0 ? (
                  <div className="bg-white rounded-[24px] border border-zinc-200/80 p-8 text-center">
                    <p className="text-sm font-semibold text-[#141118]">
                      {listingStatusFilter === 'pending'
                        ? 'No hay publicaciones pendientes de revisión'
                        : 'No se encontraron publicaciones'}
                    </p>
                  </div>
                ) : (
                  filteredListings.map((item) => {
                    const isBusy = busyId === item.id;
                    const confirmingDelete = confirmDeleteListingId === item.id;
                    const autoAt = item.autoApproveAtMs || item.createdAtMs + 30 * 60 * 1000;
                    const minsLeft = Math.max(1, Math.ceil((autoAt - nowMs) / 60000));
                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
                          item.status === 'pending'
                            ? 'border-amber-300/90 bg-amber-50/20'
                            : 'border-zinc-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-16 h-14 rounded-xl object-cover bg-zinc-100 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-display text-sm font-bold text-[#141118] truncate">
                                {item.title}
                              </p>
                              {item.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold shrink-0">
                                  <Clock className="w-3 h-3" />
                                  En revisión · auto en {minsLeft} min
                                </span>
                              )}
                              {item.status === 'rejected' && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold uppercase shrink-0">
                                  Rechazada
                                </span>
                              )}
                              {item.status === 'sold' && (
                                <span className="text-[11px] font-extrabold uppercase text-red-600 shrink-0">
                                  Vendido
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 truncate mt-0.5 tabular-nums">
                              ${item.priceUsd.toLocaleString('es-VE')} · {item.sellerName} ·{' '}
                              {item.city}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {item.category}
                              {item.subcategory ? ` · ${item.subcategory}` : ''} · Firebase
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end flex-wrap gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onPreviewListing(item)}
                            className="h-9 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </button>

                          {item.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSetListingStatus(item, 'active')}
                                className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Aprobar
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSetListingStatus(item, 'rejected')}
                                className="h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Rechazar
                              </button>
                            </>
                          ) : item.status === 'rejected' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleSetListingStatus(item, 'active')}
                              className="h-9 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Aprobar
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleSetListingStatus(
                                  item,
                                  item.status === 'active' ? 'sold' : 'active'
                                )
                              }
                              className={`h-9 px-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                                item.status === 'active'
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : item.status === 'active' ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                              {item.status === 'active' ? 'Vendido' : 'Reactivar'}
                            </button>
                          )}

                          {confirmingDelete ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDeleteListing(item)}
                                className="h-9 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteListingId(null)}
                                className="h-9 px-2 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-semibold"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteListingId(item.id)}
                              aria-label="Eliminar publicación"
                              className="w-9 h-9 rounded-xl hover:bg-rose-50 text-zinc-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-3">
              <div className="bg-white rounded-[22px] border border-zinc-200/80 p-3 flex items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por @usuario, nombre o ciudad..."
                    className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredUsers.map((u) => {
                  const isBusy = busyId === u.uid;
                  return (
                    <div
                      key={u.uid}
                      className="bg-white rounded-2xl border border-zinc-200/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-full object-cover bg-zinc-100 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-[#362B3D] text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                            {u.displayName.replace(/^@/, '').charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-display text-sm font-bold text-[#141118] truncate">
                              {u.displayName}
                            </p>
                            {u.identityVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                                <BadgeCheck className="w-3 h-3" />
                                Verificado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded-md">
                                <ShieldAlert className="w-3 h-3" />
                                No verificado
                              </span>
                            )}
                            {u.isAdmin && (
                              <span className="text-[10px] font-bold uppercase text-[#6B4E8E] bg-[#F4EFFA] px-2 py-0.5 rounded-md">
                                Admin
                              </span>
                            )}
                            {u.suspended && (
                              <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                                Suspendido
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 truncate mt-0.5 tabular-nums">
                            {u.city}
                            {u.state ? `, ${u.state}` : ''} · {u.listingCount}{' '}
                            {u.listingCount === 1 ? 'publicación' : 'publicaciones'}
                            {u.age ? ` · ${u.age} años` : ''}
                          </p>
                        </div>
                      </div>

                      {u.source === 'cloud' && isFirebaseAdmin ? (
                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy || u.uid === firebaseAdminUid}
                            onClick={() => void handleToggleAdminRole(u)}
                            className="h-9 px-3 rounded-xl bg-[#F4EFFA] hover:bg-[#E7DBF7] text-[#362B3D] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {u.isAdmin ? 'Quitar admin' : 'Hacer admin'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || u.uid === firebaseAdminUid}
                            onClick={() => void handleToggleSuspendUser(u)}
                            className={`h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors ${
                              u.suspended
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {u.suspended ? 'Reactivar' : 'Suspender'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-zinc-400 shrink-0">
                          {u.source === 'cloud' ? 'Perfil nube' : 'Vendedor catálogo'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-200/70 rounded-2xl max-w-md">
                <button
                  type="button"
                  onClick={() => setActivitySubTab('purchases')}
                  className={`h-9 rounded-xl text-xs font-semibold transition-all tabular-nums ${
                    activitySubTab === 'purchases'
                      ? 'bg-white text-[#141118] shadow-xs'
                      : 'text-zinc-600'
                  }`}
                >
                  Compras ({allPurchases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivitySubTab('chats')}
                  className={`h-9 rounded-xl text-xs font-semibold transition-all tabular-nums ${
                    activitySubTab === 'chats'
                      ? 'bg-white text-[#141118] shadow-xs'
                      : 'text-zinc-600'
                  }`}
                >
                  Chats ({allChats.length})
                </button>
              </div>

              {activitySubTab === 'purchases' ? (
                allPurchases.length === 0 ? (
                  <div className="bg-white rounded-[24px] border border-zinc-200/80 p-8 text-center">
                    <p className="text-sm font-semibold text-[#141118]">
                      Sin compras registradas todavía
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {allPurchases.map((pur) => (
                      <div
                        key={pur.id}
                        className="bg-white rounded-2xl border border-zinc-200/80 p-3 flex items-center gap-3"
                      >
                        <img
                          src={pur.listingImage}
                          alt={pur.listingTitle}
                          referrerPolicy="no-referrer"
                          className="w-14 h-12 rounded-xl object-cover bg-zinc-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm font-bold text-[#141118] truncate">
                            {pur.listingTitle}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            Vendedor: {pur.sellerName} · {pur.city}, {pur.state}
                          </p>
                          <p className="text-[11px] text-zinc-400 tabular-nums mt-0.5">
                            {new Date(pur.createdAtMs).toLocaleString('es-VE')}
                          </p>
                        </div>
                        <span className="font-display text-sm font-bold text-emerald-700 tabular-nums shrink-0">
                          ${pur.priceUsd.toLocaleString('es-VE')}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : allChats.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-zinc-200/80 p-8 text-center">
                  <p className="text-sm font-semibold text-[#141118]">
                    Sin conversaciones registradas
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {allChats.map((chat) => {
                    const confirming = confirmDeleteChatId === chat.id;
                    const isBusy = busyId === chat.id;
                    return (
                      <div
                        key={chat.id}
                        className="bg-white rounded-2xl border border-zinc-200/80 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-sm font-bold text-[#141118] truncate">
                              {chat.listingTitle}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                              {chat.buyerName} → {chat.sellerName}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {chat.lastMessage || 'Sin mensajes'}
                            </p>
                          </div>
                        </div>

                        {isFirebaseAdmin && chat.source === 'firestore' && (
                          <div className="shrink-0">
                            {confirming ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleDeleteChat(chat)}
                                  className="h-8 px-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold"
                                >
                                  Eliminar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteChatId(null)}
                                  className="h-8 px-2 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-semibold"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteChatId(chat.id)}
                                aria-label="Eliminar conversación"
                                className="w-9 h-9 rounded-xl hover:bg-rose-50 text-zinc-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
              <section className="bg-white rounded-[24px] border border-zinc-200/80 p-4 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-sm font-bold text-[#141118]">
                      Aviso global del marketplace
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Muestra un comunicado visible en la parte superior del inicio.
                    </p>
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 border border-zinc-200/70 px-3.5 py-2.5 cursor-pointer">
                  <span className="text-xs font-semibold text-[#141118]">
                    Activar banner de aviso
                  </span>
                  <input
                    type="checkbox"
                    checked={announcementEnabled}
                    onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#362B3D]"
                  />
                </label>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="admin-announcement-text"
                      className="text-xs font-semibold text-[#141118]"
                    >
                      Mensaje del aviso
                    </label>
                    <span className="text-[11px] text-zinc-400 tabular-nums">
                      {announcementText.length}/280
                    </span>
                  </div>
                  <textarea
                    id="admin-announcement-text"
                    rows={2}
                    maxLength={280}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Ej. Bienvenidos a Quemarket Venezuela. Verifica siempre al vendedor antes de pagar."
                    className="w-full p-3 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20 resize-none"
                  />
                </div>
              </section>

              <section className="bg-white rounded-[24px] border border-zinc-200/80 p-4 space-y-4">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#141118]">
                    Control de publicaciones
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Permite pausar temporalmente la creación de nuevos anuncios por mantenimiento.
                  </p>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 border border-zinc-200/70 px-3.5 py-2.5 cursor-pointer">
                  <span className="text-xs font-semibold text-[#141118]">
                    Permitir nuevas publicaciones
                  </span>
                  <input
                    type="checkbox"
                    checked={allowNewListings}
                    onChange={(e) => setAllowNewListings(e.target.checked)}
                    className="w-4 h-4 accent-[#362B3D]"
                  />
                </label>

                {!allowNewListings && (
                  <div className="space-y-1">
                    <label
                      htmlFor="admin-maintenance-text"
                      className="text-xs font-semibold text-[#141118]"
                    >
                      Motivo mostrado al intentar publicar
                    </label>
                    <input
                      id="admin-maintenance-text"
                      type="text"
                      maxLength={280}
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="Publicaciones pausadas temporalmente por mantenimiento."
                      className="w-full h-10 px-3.5 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
                    />
                  </div>
                )}
              </section>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-55"
              >
                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar configuración
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Fullscreen Selfie / Cédula Inspection Modal */}
      {photoPreview && (
        <div
          onClick={() => setPhotoPreview(null)}
          className="fixed inset-0 z-[90] bg-black/92 flex flex-col items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl flex items-center justify-between gap-3 mb-3 text-white"
          >
            <p className="font-display text-sm font-bold truncate">{photoPreview.label}</p>
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              aria-label="Cerrar vista ampliada"
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={photoPreview.url}
            alt={photoPreview.label}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[82dvh] rounded-2xl object-contain bg-black"
          />
        </div>
      )}
    </div>
  );
}
