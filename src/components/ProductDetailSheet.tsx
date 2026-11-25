import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  Building2,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Maximize2,
  Package,
  Send,
  ShieldAlert,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Listing, PublicSellerProfile } from '../types/marketplace';
import { BottomSheet } from './BottomSheet';
import { ListingSpecsDetailModal } from './CategoryDetailsModals';

interface ProductDetailSheetProps {
  listing: Listing | null;
  sellerProfile?: PublicSellerProfile | null;
  distanceKm?: number;
  isOwnListing: boolean;
  onClose: () => void;
  onOpenSeller: (listing: Listing) => void;
  onStartChat: (listing: Listing, initialMessage?: string) => void | Promise<void>;
  onMarkSold?: (listing: Listing) => Promise<void>;
  zIndexClass?: string;
  aboveDock?: boolean;
}

export function ProductDetailSheet({
  listing,
  sellerProfile,
  distanceKm,
  isOwnListing,
  onClose,
  onOpenSeller,
  onStartChat,
  onMarkSold,
  zIndexClass,
  aboveDock = false,
}: ProductDetailSheetProps) {
  const [markingSold, setMarkingSold] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [specsModalOpen, setSpecsModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatError, setChatError] = useState('');

  // Fullscreen image viewer state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const photos = listing
    ? listing.imageUrls && listing.imageUrls.length > 0
      ? listing.imageUrls
      : listing.imageUrl
        ? [listing.imageUrl]
        : []
    : [];
  const safeIndex = Math.min(activePhotoIndex, Math.max(0, photos.length - 1));
  const currentPhotoUrl = photos[safeIndex] || '';

  useEffect(() => {
    setActivePhotoIndex(0);
    setImgError(false);
    setAvatarError(false);
    setSpecsModalOpen(false);
    setMessageText('');
    setSendingMessage(false);
    setChatError('');
    setLightboxOpen(false);
    setZoomed(false);
  }, [listing?.id, sellerProfile?.photoURL]);

  useEffect(() => {
    setImgError(false);
    setZoomed(false);
  }, [safeIndex]);

  const showPrevPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const showNextPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev + 1) % photos.length);
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        showPrevPhoto();
      } else if (e.key === 'ArrowRight') {
        showNextPhoto();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, photos.length]);

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = messageText.trim();
    if (!listing || !trimmed || sendingMessage) return;

    setSendingMessage(true);
    setChatError('');
    try {
      await onStartChat(listing, trimmed);
      setMessageText('');
      onClose();
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar el mensaje. Intenta nuevamente.'
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    if (zoomed || e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleLightboxTouchEnd = (e: React.TouchEvent) => {
    if (zoomed || touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        showNextPhoto();
      } else {
        showPrevPhoto();
      }
    }
  };

  const handleLightboxImageTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setZoomed((prev) => !prev);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const sellerDisplayName = sellerProfile?.displayName || listing?.sellerName || 'Vendedor';
  const sellerPhoto = sellerProfile?.photoURL;

  const lightboxNode =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {lightboxOpen && listing && currentPhotoUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => {
                  if (!zoomed) setLightboxOpen(false);
                }}
                className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col select-none"
                role="dialog"
                aria-modal="true"
                aria-label={`Galería de ${listing.title}`}
              >
                {/* Top Controls */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-[max(0.75rem,env(safe-area-inset-top))] px-4 pb-3 flex items-center justify-between gap-3 shrink-0"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    {photos.length > 1 && (
                      <span className="px-2.5 py-1 rounded-full bg-white/14 text-white text-xs font-semibold tabular-nums shrink-0">
                        {safeIndex + 1} / {photos.length}
                      </span>
                    )}
                    <p className="text-sm font-medium text-white/90 truncate">
                      {listing.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setZoomed((prev) => !prev)}
                      aria-label={zoomed ? 'Alejar imagen' : 'Acercar imagen'}
                      className="w-10 h-10 rounded-full bg-white/14 hover:bg-white/24 text-white flex items-center justify-center transition-colors active:scale-95"
                    >
                      {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(false)}
                      aria-label="Cerrar imagen ampliada"
                      className="w-10 h-10 rounded-full bg-white/14 hover:bg-white/24 text-white flex items-center justify-center transition-colors active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Main Image Stage */}
                <div
                  onTouchStart={handleLightboxTouchStart}
                  onTouchEnd={handleLightboxTouchEnd}
                  className={`relative flex-1 min-h-0 flex items-center justify-center px-2 sm:px-14 ${
                    zoomed ? 'overflow-auto' : 'overflow-hidden'
                  }`}
                >
                  <img
                    src={currentPhotoUrl}
                    alt={`${listing.title} (${safeIndex + 1})`}
                    referrerPolicy="no-referrer"
                    onClick={handleLightboxImageTap}
                    draggable={false}
                    className={
                      zoomed
                        ? 'w-[185%] max-w-none h-auto rounded-lg cursor-zoom-out transition-all duration-200'
                        : 'max-h-full max-w-full object-contain rounded-lg cursor-zoom-in transition-all duration-200'
                    }
                  />

                  {photos.length > 1 && !zoomed && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          showPrevPhoto();
                        }}
                        aria-label="Foto anterior"
                        className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/55 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition-colors active:scale-95"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          showNextPhoto();
                        }}
                        aria-label="Siguiente foto"
                        className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/55 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition-colors active:scale-95"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </>
                  )}
                </div>

                {/* Bottom Thumbnail Strip */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] px-4 shrink-0"
                >
                  {photos.length > 1 ? (
                    <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
                      {photos.map((url, idx) => (
                        <button
                          key={`lb-${idx}-${url.slice(0, 20)}`}
                          type="button"
                          onClick={() => setActivePhotoIndex(idx)}
                          aria-label={`Ver foto ${idx + 1}`}
                          className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                            idx === safeIndex
                              ? 'border-white opacity-100 scale-105'
                              : 'border-white/20 opacity-55 hover:opacity-90'
                          }`}
                        >
                          <img
                            src={url}
                            alt={`${listing.title} miniatura ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-white/60">
                      Toca dos veces o usa el botón de lupa para acercar
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      <BottomSheet
        open={Boolean(listing)}
        aboveDock={aboveDock}
        zIndexClass={zIndexClass}
        onClose={() => {
          setLightboxOpen(false);
          onClose();
        }}
      >
        {listing && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div
                onClick={() => {
                  if (!imgError && currentPhotoUrl) {
                    setLightboxOpen(true);
                  }
                }}
                className={`relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-zinc-100 ${
                  !imgError && currentPhotoUrl ? 'cursor-zoom-in group' : ''
                }`}
              >
                {!imgError && currentPhotoUrl ? (
                  <img
                    src={currentPhotoUrl}
                    alt={`${listing.title} (${safeIndex + 1})`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.015] ${
                      listing.status === 'sold' ? 'opacity-75 saturate-75' : ''
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <Package className="w-10 h-10" />
                  </div>
                )}

                {listing.status === 'sold' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="font-display text-2xl sm:text-3xl font-black tracking-[0.24em] uppercase text-red-500 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      Vendido
                    </span>
                  </div>
                )}

                {!imgError && currentPhotoUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(true);
                    }}
                    aria-label="Expandir imagen"
                    className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition-colors active:scale-95"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        showPrevPhoto();
                      }}
                      aria-label="Foto anterior"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors active:scale-95"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        showNextPhoto();
                      }}
                      aria-label="Siguiente foto"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors active:scale-95"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-semibold tabular-nums backdrop-blur-sm pointer-events-none">
                      {safeIndex + 1} / {photos.length}
                    </span>
                  </>
                )}
              </div>

              {photos.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {photos.map((url, idx) => (
                    <button
                      key={`${idx}-${url.slice(0, 20)}`}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      aria-label={`Ver foto ${idx + 1}`}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        idx === safeIndex
                          ? 'border-[#362B3D] opacity-100'
                          : 'border-transparent opacity-60 hover:opacity-90'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`${listing.title} miniatura ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-xl font-bold text-[#141118] leading-tight text-balance">
                  {listing.title}
                </h2>
                <div className="text-right shrink-0">
                  <span className="font-display text-2xl font-extrabold text-[#362B3D] tabular-nums block">
                    ${listing.priceUsd.toLocaleString('es-VE')}
                  </span>
                  {(listing.category === 'Vehículos y Motos' ||
                    listing.category === 'Inmuebles') && (
                    <span className="text-[10.5px] font-semibold text-zinc-500">
                      Neto en USD
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1 font-medium text-zinc-600">
                  <MapPin className="w-3.5 h-3.5 text-[#6B4E8E]" />
                  {listing.city}, {listing.state}
                </span>
              </div>

              {listing.description && (
                <p className="text-sm text-zinc-600 leading-relaxed pt-1">{listing.description}</p>
              )}

              {((listing.category === 'Vehículos y Motos' && listing.vehicleDetails) ||
                (listing.category === 'Inmuebles' && listing.realEstateDetails)) && (
                <button
                  type="button"
                  onClick={() => setSpecsModalOpen(true)}
                  className="w-full p-3 rounded-2xl bg-[#F6F1FC] hover:bg-[#EFE5FA] border border-[#362B3D]/12 flex items-center justify-between gap-3 text-left transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white text-[#362B3D] flex items-center justify-center shrink-0">
                      {listing.category === 'Vehículos y Motos' ? (
                        <Car className="w-4 h-4" />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#141118] truncate">
                        {listing.category === 'Vehículos y Motos'
                          ? 'Ficha técnica del vehículo'
                          : 'Especificaciones del inmueble'}
                      </p>
                      <p className="text-[11px] text-[#584B63] truncate">
                        {listing.vehicleDetails
                          ? [
                              listing.vehicleDetails.brand,
                              listing.vehicleDetails.model,
                              listing.vehicleDetails.year,
                              typeof listing.vehicleDetails.mileageKm === 'number'
                                ? `${listing.vehicleDetails.mileageKm.toLocaleString('es-VE')} km`
                                : null,
                              listing.vehicleDetails.transmission,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : listing.realEstateDetails
                            ? [
                                typeof listing.realEstateDetails.areaSqm === 'number'
                                  ? `${listing.realEstateDetails.areaSqm} m²`
                                  : null,
                                typeof listing.realEstateDetails.bedrooms === 'number'
                                  ? `${listing.realEstateDetails.bedrooms} hab`
                                  : null,
                                typeof listing.realEstateDetails.bathrooms === 'number'
                                  ? `${listing.realEstateDetails.bathrooms} baños`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : ''}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B4E8E] shrink-0">
                    Ver más
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </button>
              )}
            </div>

            {/* Clickable Seller Card -> Opens full Seller Info Sheet */}
            <button
              type="button"
              onClick={() => onOpenSeller(listing)}
              className="w-full min-h-[60px] flex items-center justify-between gap-3 py-3 px-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100/90 border border-zinc-200/70 text-left transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                {sellerPhoto && !avatarError ? (
                  <img
                    src={sellerPhoto}
                    alt={sellerDisplayName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-11 h-11 rounded-full object-cover border border-zinc-200 shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[#362B3D] text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                    {sellerDisplayName.replace(/^@/, '').charAt(0).toUpperCase() || 'V'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-semibold text-[#141118] truncate">
                      {sellerDisplayName}
                    </p>
                    {sellerProfile?.identityVerified ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        <BadgeCheck className="w-3 h-3 shrink-0" />
                        Verificado
                      </span>
                    ) : (
                      <span
                        title="No verificado"
                        aria-label="No verificado"
                        className="inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 bg-zinc-100 text-zinc-500 border border-zinc-200/80"
                      >
                        <ShieldAlert className="w-3 h-3 shrink-0" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">
                    Vendedor en {sellerProfile?.city || listing.city}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B4E8E] whitespace-nowrap shrink-0">
                Ver perfil
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {listing.status === 'sold' ? (
              <div className="py-2 text-center space-y-0.5">
                <p className="font-display text-sm font-extrabold tracking-wide uppercase text-red-600">
                  Vendido
                </p>
                <p className="text-xs text-zinc-500 leading-snug">
                  Esta publicación fue vendida y seguirá visible durante 1 hora en el catálogo.
                </p>
              </div>
            ) : !isOwnListing ? (
              <form
                onSubmit={handleSendDirectMessage}
                className="pt-1 space-y-2"
              >
                <label
                  htmlFor="listing-seller-message"
                  className="block text-xs font-semibold text-[#362B3D]"
                >
                  Enviar mensaje a {sellerDisplayName}
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5 focus-within:border-[#362B3D] focus-within:bg-white transition-colors">
                  <input
                    id="listing-seller-message"
                    type="text"
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      if (chatError) setChatError('');
                    }}
                    placeholder="Escribe un mensaje al vendedor..."
                    disabled={sendingMessage}
                    maxLength={500}
                    className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-base sm:text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sendingMessage}
                    aria-label="Enviar mensaje"
                    className="h-10 px-4 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none"
                  >
                    {sendingMessage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar</span>
                      </>
                    )}
                  </button>
                </div>
                {chatError && (
                  <p className="text-xs font-medium text-rose-600 px-1 leading-snug">
                    {chatError}
                  </p>
                )}
              </form>
            ) : (
              <div className="space-y-2">
                {onMarkSold && (
                  <button
                    type="button"
                    disabled={markingSold}
                    onClick={async () => {
                      if (!listing || markingSold) return;
                      setMarkingSold(true);
                      try {
                        await onMarkSold(listing);
                      } finally {
                        setMarkingSold(false);
                      }
                    }}
                    className="w-full h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {markingSold ? 'Marcando...' : 'Marcar como vendido'}
                  </button>
                )}
                <div className="py-2 text-center text-xs font-medium text-zinc-500 bg-zinc-50 rounded-2xl">
                  Esta es una de tus publicaciones activas
                </div>
              </div>
            )}
          </div>
        )}

      </BottomSheet>

      <ListingSpecsDetailModal
        open={specsModalOpen}
        onClose={() => setSpecsModalOpen(false)}
        listing={listing}
      />

      {lightboxNode}
    </>
  );
}
