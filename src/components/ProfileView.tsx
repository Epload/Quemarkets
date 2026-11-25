import React, { useEffect, useRef, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  LayoutGrid,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Terminal,
  Trash2,
} from 'lucide-react';
import { BASE_CATEGORIES } from '../data/venezuela';
import { compressAvatarToDataUrl } from '../lib/marketplaceService';
import { isNativeCapacitorApp } from '../lib/capacitorApp';
import {
  CityLocation,
  IdentityVerificationStatus,
  Listing,
  Purchase,
} from '../types/marketplace';
import { BottomSheet } from './BottomSheet';
import { IdentityVerificationSheet } from './IdentityVerificationSheet';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface ProfileViewProps {
  firebaseUser: FirebaseUser | null;
  displayName: string;
  avatarUrl?: string;
  sellerBio: string;
  userCity: CityLocation;
  customCategories: string[];
  myListings: Listing[];
  purchases: Purchase[];
  identityVerificationStatus: IdentityVerificationStatus;
  identityRejectionReason?: string;
  onSubmitIdentityVerification: (payload: {
    selfieUrl: string;
    idCardUrl: string;
  }) => Promise<void>;
  onUpdateAvatar: (dataUrl: string) => Promise<void>;
  onUpdateBio: (bio: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenCityPicker: () => void;
  onToggleCustomCategory: (cat: string) => void;
  onAddCustomCategory: (cat: string) => void;
  onMarkListingSold: (listing: Listing) => Promise<void>;
  onDeleteListing: (listing: Listing) => Promise<void>;
  onOpenSell: () => void;
  onResendVerification?: () => Promise<void>;
}

export function ProfileView({
  firebaseUser,
  displayName,
  avatarUrl,
  sellerBio,
  userCity,
  customCategories,
  myListings,
  purchases,
  identityVerificationStatus,
  identityRejectionReason,
  onSubmitIdentityVerification,
  onUpdateAvatar,
  onUpdateBio,
  onSignOut,
  onOpenCityPicker,
  onToggleCustomCategory,
  onAddCustomCategory,
  onMarkListingSold,
  onDeleteListing,
  onOpenSell,
  onResendVerification,
}: ProfileViewProps) {
  const [subTab, setSubTab] = useState<'listings' | 'purchases'>('listings');
  const [newCategory, setNewCategory] = useState('');
  const [resentMsg, setResentMsg] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [bioDraft, setBioDraft] = useState(sellerBio);
  const [savingBio, setSavingBio] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [apkInfo, setApkInfo] = useState<{
    available: boolean;
    sizeLabel: string;
    versionName: string;
    downloadUrl: string;
  } | null>(null);
  const [apkGuideOpen, setApkGuideOpen] = useState(false);
  const [categoriesSheetOpen, setCategoriesSheetOpen] = useState(false);
  const [verificationSheetOpen, setVerificationSheetOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installingPwa, setInstallingPwa] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const isNativeApp = isNativeCapacitorApp();
  const baseApiUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const externalApkUrl = (import.meta.env.VITE_APK_DOWNLOAD_URL || '').trim();
  const directApkAvailable = Boolean(externalApkUrl) || Boolean(apkInfo?.available);
  const apkDownloadHref = externalApkUrl
    ? externalApkUrl
    : isNativeApp
      ? `${baseApiUrl || 'https://ais-pre-vnzeuntrtragjdddiv43up-743009830964.us-east1.run.app'}/downloads/Quemarket.apk`
      : `${baseApiUrl}/downloads/Quemarket.apk`;

  useEffect(() => {
    setBioDraft(sellerBio);
  }, [sellerBio]);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (isNativeApp) return;
    let active = true;
    fetch(`${baseApiUrl}/api/apk-info`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setApkInfo(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isNativeApp, baseApiUrl]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPromptEvent || installingPwa) return;
    setInstallingPwa(true);
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
    } finally {
      setInstallingPwa(false);
    }
  };

  const handleCopyBuildCommand = async () => {
    try {
      await navigator.clipboard.writeText('npm run apk:build');
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const availableCategories = Array.from(new Set([...BASE_CATEGORIES, ...customCategories]));

  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newCategory.trim();
    if (!cleaned) return;
    onAddCustomCategory(cleaned);
    setNewCategory('');
  };

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const dataUrl = await compressAvatarToDataUrl(file);
      await onUpdateAvatar(dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingBio) return;
    setSavingBio(true);
    try {
      await onUpdateBio(bioDraft.trim());
      setBioSaved(true);
      window.setTimeout(() => setBioSaved(false), 2200);
    } finally {
      setSavingBio(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* User Summary Card (no sign-out button next to name) */}
      <section className="bg-white rounded-[26px] border border-zinc-200/75 p-4 space-y-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Subir foto de perfil"
            className="relative w-16 h-16 rounded-full shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#362B3D]"
          >
            {avatarUrl && !avatarImgFailed ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarImgFailed(true)}
                className="w-16 h-16 rounded-full object-cover border border-zinc-200 bg-zinc-100"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#362B3D] text-white font-display font-bold text-xl flex items-center justify-center">
                {displayName.replace(/^@/, '').charAt(0).toUpperCase() || 'U'}
              </div>
            )}

            <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#362B3D] group-hover:bg-[#2A2130] text-white border-2 border-white flex items-center justify-center shadow-xs transition-colors">
              {uploadingAvatar ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="font-display text-base font-bold text-[#141118] truncate">
                {displayName}
              </h2>
              {identityVerificationStatus === 'approved' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full shrink-0">
                  <BadgeCheck className="w-3 h-3" />
                  Verificado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded-full shrink-0">
                  <ShieldAlert className="w-3 h-3" />
                  No verificado
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={onOpenCityPicker}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-[#362B3D] transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#6B4E8E]" />
                <span className="truncate">
                  {userCity.city}, {userCity.state}
                </span>
              </button>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-xs font-semibold text-[#6B4E8E] hover:text-[#362B3D] transition-colors"
              >
                {uploadingAvatar ? 'Subiendo...' : avatarUrl ? 'Cambiar foto' : 'Subir foto de perfil'}
              </button>
            </div>
          </div>
        </div>

        {avatarError && (
          <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{avatarError}</p>
        )}

        {/* Public Seller Bio for buyers inspecting listings */}
        <form onSubmit={handleSaveBio} className="pt-2 border-t border-zinc-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="seller-bio-input"
              className="text-xs font-semibold text-[#141118]"
            >
              Información visible para compradores
            </label>
            <span className="text-[11px] text-zinc-400 tabular-nums">
              {bioDraft.length}/240
            </span>
          </div>
          <div className="flex gap-2">
            <input
              id="seller-bio-input"
              type="text"
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              maxLength={240}
              placeholder="Ej. Entregas personales en centro comercial. Acepto Pago Móvil y Zelle."
              className="flex-1 h-10 px-3.5 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
            />
            <button
              type="submit"
              disabled={savingBio || bioDraft.trim() === sellerBio.trim()}
              className="h-10 px-4 rounded-xl bg-[#362B3D] text-white text-xs font-semibold disabled:opacity-40 active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              {bioSaved ? 'Guardado' : savingBio ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </section>

      {/* Segmented Switch: Active Listings vs Purchase History */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-200/70 rounded-2xl">
          <button
            type="button"
            onClick={() => setSubTab('listings')}
            className={`h-10 rounded-xl text-xs font-semibold transition-all tabular-nums ${
              subTab === 'listings'
                ? 'bg-white text-[#141118] shadow-xs'
                : 'text-zinc-600 hover:text-[#141118]'
            }`}
          >
            Mis publicaciones ({myListings.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('purchases')}
            className={`h-10 rounded-xl text-xs font-semibold transition-all tabular-nums ${
              subTab === 'purchases'
                ? 'bg-white text-[#141118] shadow-xs'
                : 'text-zinc-600 hover:text-[#141118]'
            }`}
          >
            Historial de compras ({purchases.length})
          </button>
        </div>

        {/* Lists */}
        {subTab === 'listings' ? (
          myListings.length === 0 ? (
            <div className="bg-white rounded-[26px] border border-zinc-200/75 p-7 text-center space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#F4EFFA] text-[#362B3D] mx-auto flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-[#141118]">
                No tienes publicaciones todavía
              </p>
              <button
                type="button"
                onClick={onOpenSell}
                className="h-10 px-5 rounded-xl bg-[#362B3D] text-white text-xs font-semibold active:scale-95 transition-transform"
              >
                Publicar mi primer artículo
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {myListings.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-zinc-200/75 p-3 flex items-center gap-3"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-14 rounded-xl object-cover bg-zinc-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-[#141118] truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                        ${item.priceUsd.toLocaleString('es-VE')} · {item.city} ·{' '}
                        {item.status === 'pending' ? (
                          <span className="font-semibold text-amber-700">En revisión</span>
                        ) : item.status === 'rejected' ? (
                          <span className="font-semibold text-rose-600">Rechazada</span>
                        ) : item.status === 'sold' ? (
                          <span className="font-bold text-red-600 uppercase">
                            Vendido
                            {item.soldAtMs && Date.now() - item.soldAtMs < 60 * 60 * 1000
                              ? ` (${Math.max(1, Math.ceil((60 * 60 * 1000 - (Date.now() - item.soldAtMs)) / 60000))} min visible)`
                              : ''}
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-700">Activa</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => onMarkListingSold(item)}
                          title="Marcar como vendido"
                          className="h-9 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors"
                        >
                          Vendido
                        </button>
                      ) : item.status === 'pending' ? (
                        <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] font-semibold text-amber-800 whitespace-nowrap">
                          En revisión
                        </span>
                      ) : item.status === 'rejected' ? (
                        <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200/80 text-[11px] font-semibold text-rose-700 whitespace-nowrap">
                          Rechazada
                        </span>
                      ) : (
                        <span className="px-1.5 text-xs font-extrabold uppercase tracking-wide text-red-600">
                          Vendido
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteListing(item)}
                        aria-label="Eliminar publicación"
                        className="w-9 h-9 rounded-xl hover:bg-rose-50 text-zinc-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          )
        ) : purchases.length === 0 ? (
          <div className="bg-white rounded-[26px] border border-zinc-200/75 p-7 text-center space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-[#F4EFFA] text-[#362B3D] mx-auto flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-[#141118]">Tu historial está vacío</p>
            <p className="text-xs text-zinc-500">
              Aquí aparecerán los productos que compres en Quemarket.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {purchases.map((pur) => (
              <div
                key={pur.id}
                className="bg-white rounded-2xl border border-zinc-200/75 p-3 flex items-center gap-3"
              >
                <img
                  src={pur.listingImage}
                  alt={pur.listingTitle}
                  referrerPolicy="no-referrer"
                  className="w-16 h-14 rounded-xl object-cover bg-zinc-100 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-[#141118] truncate">
                    {pur.listingTitle}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    Vendedor: {pur.sellerName} · {pur.city}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 tabular-nums">
                    Compra completada · {new Date(pur.createdAtMs).toLocaleDateString('es-VE')}
                  </p>
                </div>
                <span className="font-display text-sm font-bold text-[#141118] tabular-nums shrink-0">
                  ${pur.priceUsd.toLocaleString('es-VE')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {firebaseUser && !firebaseUser.emailVerified && onResendVerification && (
        <section className="bg-amber-50/90 border border-amber-200/80 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-900 leading-snug">
            Revisa tu correo para verificar tu cuenta y sincronizar tu foto y publicaciones en la nube.
          </p>
          <button
            type="button"
            onClick={async () => {
              await onResendVerification();
              setResentMsg(true);
            }}
            className="h-8 px-3 rounded-xl bg-amber-900 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 active:scale-95 transition-transform"
          >
            {resentMsg ? 'Enviado' : 'Reenviar'}
          </button>
        </section>
      )}

      {/* Identity Verification Card (Selfie + Cédula) */}
      {identityVerificationStatus === 'approved' ? (
        <section className="bg-emerald-50/80 border border-emerald-200/80 rounded-[26px] p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <BadgeCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-bold text-emerald-950">
              Identidad verificada
            </h3>
            <p className="text-xs text-emerald-800 mt-0.5 leading-snug">
              Tu cuenta muestra la insignia de usuario verificado en chats y publicaciones.
            </p>
          </div>
        </section>
      ) : identityVerificationStatus === 'pending' ? (
        <section className="bg-amber-50/85 border border-amber-200/85 rounded-[26px] p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-bold text-amber-950">
              Verificación en revisión
            </h3>
            <p className="text-xs text-amber-800 mt-0.5 leading-snug">
              Recibimos tu selfie y foto de cédula. Cuando administración apruebe tus datos aparecerás
              como verificado.
            </p>
          </div>
        </section>
      ) : identityVerificationStatus === 'rejected' ? (
        <section className="bg-rose-50/80 border border-rose-200/85 rounded-[26px] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold text-rose-950">
                Verificación rechazada
              </h3>
              <p className="text-xs text-rose-800 mt-0.5 leading-snug">
                {identityRejectionReason ||
                  'No pudimos validar las fotos enviadas. Intenta nuevamente con buena luz.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVerificationSheetOpen(true)}
            className="h-10 px-3.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 active:scale-95 transition-all"
          >
            Reintentar
          </button>
        </section>
      ) : (
        <section className="bg-white rounded-[26px] border border-zinc-200/75 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold text-[#141118]">
                Verificar mi identidad
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                Envía una selfie y foto de tu cédula para que administración verifique tu cuenta.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVerificationSheetOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-xs font-semibold whitespace-nowrap shrink-0 active:scale-95 transition-all"
          >
            Verificar
          </button>
        </section>
      )}

      {/* Android APK Download Card */}
      <section className="bg-white rounded-[26px] border border-zinc-200/75 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-sm font-bold text-[#141118] truncate">
                App Android (APK)
              </h3>
              {isNativeApp && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-full shrink-0">
                  Instalada
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 truncate tabular-nums">
              {apkInfo?.available && apkInfo.sizeLabel
                ? `Quemarket v${apkInfo.versionName} · ${apkInfo.sizeLabel}`
                : externalApkUrl
                  ? 'Instalador oficial para Android (v1.0)'
                  : 'Proyecto Capacitor listo para Android'}
            </p>
          </div>
        </div>

        {directApkAvailable ? (
          <a
            href={apkDownloadHref}
            download="Quemarket.apk"
            className="h-10 px-4 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition-all shrink-0 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar APK
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setApkGuideOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition-all shrink-0 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar APK
          </button>
        )}
      </section>

      {/* Personalized Categories compact selector card */}
      <button
        type="button"
        onClick={() => setCategoriesSheetOpen(true)}
        className="w-full text-left bg-white hover:bg-zinc-50/80 rounded-[26px] border border-zinc-200/75 p-4 flex items-center justify-between gap-3 transition-colors active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-[#141118] truncate">
                Categorías personalizadas
              </h3>
              {customCategories.length > 0 && (
                <span className="text-[11px] font-semibold text-[#6B4E8E] tabular-nums shrink-0">
                  ({customCategories.length})
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {customCategories.length > 0
                ? customCategories.join(', ')
                : 'Toca para elegir o crear tus intereses'}
            </p>
          </div>
        </div>

        <span className="w-9 h-9 rounded-xl bg-zinc-100 text-[#362B3D] flex items-center justify-center shrink-0">
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>

      {/* Dedicated Sign Out button in Profile */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onSignOut}
          className="w-full h-12 rounded-2xl border border-zinc-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-rose-600 text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>

      {/* Android APK / Installation Guide Modal when binary hasn't been compiled yet */}
      <BottomSheet
        open={apkGuideOpen}
        onClose={() => setApkGuideOpen(false)}
        title="Instalar Quemarket en Android"
        subtitle="App móvil con Capacitor y permisos nativos"
      >
        <div className="space-y-4">
          {installPromptEvent && (
            <div className="rounded-2xl bg-[#F4EFFA] border border-[#362B3D]/12 p-4 space-y-2.5">
              <p className="font-display text-sm font-bold text-[#2A2130]">
                Instalación inmediata en este dispositivo
              </p>
              <p className="text-xs text-[#584B63] leading-relaxed">
                Puedes instalar Quemarket ahora mismo en tu pantalla principal sin esperar la compilación del APK.
              </p>
              <button
                type="button"
                onClick={handleInstallPwa}
                disabled={installingPwa}
                className="w-full h-11 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60"
              >
                {installingPwa ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Instalar app ahora
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#362B3D] shrink-0" />
              <p className="font-display text-sm font-bold text-[#141118]">
                Compilar el archivo Quemarket.apk
              </p>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              El proyecto Android con Capacitor ya está sincronizado. Para generar el binario firmado o de pruebas:
            </p>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#1C1621] text-zinc-100 px-3 py-2.5">
              <code className="text-xs font-mono truncate">npm run apk:build</code>
              <button
                type="button"
                onClick={handleCopyBuildCommand}
                className="h-7 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedCmd ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <ol className="text-xs text-zinc-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                También puedes subir el proyecto a GitHub y ejecutar el workflow incluido{' '}
                <span className="font-semibold text-[#141118]">Compilar APK de Quemarket</span>{' '}
                para descargar <span className="font-semibold text-[#141118]">Quemarket.apk</span> sin instalar Android Studio.
              </li>
              <li>
                Una vez generado, colócalo en{' '}
                <span className="font-semibold text-[#141118]">releases/Quemarket.apk</span>{' '}
                (o define <span className="font-semibold text-[#141118]">VITE_APK_DOWNLOAD_URL</span>) y este botón iniciará la descarga directa automáticamente.
              </li>
            </ol>
          </div>
        </div>
      </BottomSheet>

      {/* Personalized Categories Picker Modal */}
      <BottomSheet
        open={categoriesSheetOpen}
        onClose={() => setCategoriesSheetOpen(false)}
        title="Categorías personalizadas"
        subtitle="Elige o crea tus intereses para priorizarlos en tu inicio"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {availableCategories.map((cat) => {
              const active = customCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onToggleCustomCategory(cat)}
                  className={`min-h-[44px] px-3 py-2 rounded-2xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all active:scale-[0.98] ${
                    active
                      ? 'bg-[#362B3D] border-[#362B3D] text-white shadow-xs'
                      : 'bg-zinc-50 border-zinc-200/80 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <span className="leading-snug line-clamp-2">{cat}</span>
                  <span
                    className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-zinc-400 border border-zinc-200'
                    }`}
                  >
                    {active ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleAddCat} className="pt-2 border-t border-zinc-100 space-y-2">
            <label
              htmlFor="new-custom-category-input"
              className="text-xs font-semibold text-[#141118] block"
            >
              Crear nueva categoría
            </label>
            <div className="flex gap-2">
              <input
                id="new-custom-category-input"
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                maxLength={35}
                placeholder="Ej. Gaming, Repuestos, Coleccionables"
                className="flex-1 h-10 px-3.5 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
              />
              <button
                type="submit"
                disabled={!newCategory.trim() || customCategories.length >= 12}
                className="h-10 px-4 rounded-xl bg-zinc-900 text-white text-xs font-semibold disabled:opacity-40 active:scale-95 transition-all shrink-0"
              >
                Agregar
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={() => setCategoriesSheetOpen(false)}
            className="w-full h-11 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-sm transition-colors active:scale-[0.98]"
          >
            Listo ({customCategories.length} seleccionada{customCategories.length === 1 ? '' : 's'})
          </button>
        </div>
      </BottomSheet>

      <IdentityVerificationSheet
        open={verificationSheetOpen}
        onClose={() => setVerificationSheetOpen(false)}
        onSubmit={onSubmitIdentityVerification}
        rejectionReason={
          identityVerificationStatus === 'rejected' ? identityRejectionReason : undefined
        }
      />
    </div>
  );
}
