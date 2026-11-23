import React, { useState } from 'react';
import { CheckCircle2, MapPin, MessageCircle, Package, ShoppingBag } from 'lucide-react';
import { Listing } from '../types/marketplace';
import { BottomSheet } from './BottomSheet';

interface ProductDetailSheetProps {
  listing: Listing | null;
  distanceKm?: number;
  isOwnListing: boolean;
  onClose: () => void;
  onStartChat: (listing: Listing) => void;
  onBuyNow: (listing: Listing) => Promise<void>;
}

export function ProductDetailSheet({
  listing,
  distanceKm,
  isOwnListing,
  onClose,
  onStartChat,
  onBuyNow,
}: ProductDetailSheetProps) {
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleBuy = async () => {
    if (!listing || buying) return;
    setBuying(true);
    try {
      await onBuyNow(listing);
      setBought(true);
      setTimeout(() => {
        setBought(false);
        onClose();
      }, 1100);
    } finally {
      setBuying(false);
    }
  };

  return (
    <BottomSheet
      open={Boolean(listing)}
      onClose={() => {
        setBought(false);
        onClose();
      }}
    >
      {listing && (
        <div className="space-y-4">
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-zinc-100">
            {!imgError && listing.imageUrl ? (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                <Package className="w-10 h-10" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{listing.category}</span>
              <span aria-hidden="true">·</span>
              <span>{listing.condition}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {listing.city}, {listing.state}
                {typeof distanceKm === 'number' ? ` (${distanceKm} km)` : ''}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-bold text-[#141118] leading-tight text-balance">
                {listing.title}
              </h2>
              <span className="font-display text-2xl font-extrabold text-[#362B3D] tabular-nums shrink-0">
                ${listing.priceUsd.toLocaleString('es-VE')}
              </span>
            </div>

            {listing.description && (
              <p className="text-sm text-zinc-600 leading-relaxed pt-1">{listing.description}</p>
            )}
          </div>

          <div className="flex items-center justify-between py-3 px-3.5 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#362B3D] text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                {listing.sellerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#141118] truncate">
                  {listing.sellerName}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  Vendedor en {listing.city}
                </p>
              </div>
            </div>
          </div>

          {!isOwnListing ? (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartChat(listing);
                }}
                className="h-12 px-4 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 text-[#141118] font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <MessageCircle className="w-4 h-4" />
                Chatear
              </button>

              <button
                type="button"
                onClick={handleBuy}
                disabled={buying || bought}
                className="h-12 px-4 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-75"
              >
                {bought ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ¡Comprado!
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    {buying ? 'Procesando...' : 'Comprar'}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="py-2.5 text-center text-xs font-medium text-zinc-500 bg-zinc-50 rounded-2xl">
              Esta es una de tus publicaciones activas
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
