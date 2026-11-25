import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Calendar,
  ChevronRight,
  MapPin,
  MessageCircle,
  Package,
  ShieldAlert,
} from 'lucide-react';
import { Listing, PublicSellerProfile } from '../types/marketplace';
import { BottomSheet } from './BottomSheet';

interface SellerProfileSheetProps {
  open: boolean;
  seller: PublicSellerProfile | null;
  sellerListings: Listing[];
  isOwnProfile: boolean;
  onClose: () => void;
  onSelectListing: (listing: Listing) => void;
  onStartChat: (listing: Listing) => void;
}

export function SellerProfileSheet({
  open,
  seller,
  sellerListings,
  isOwnProfile,
  onClose,
  onSelectListing,
  onStartChat,
}: SellerProfileSheetProps) {
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [seller?.uid, seller?.photoURL, open]);

  const activeListings = sellerListings.filter((l) => l.status === 'active');
  const soldCount = sellerListings.filter((l) => l.status === 'sold').length;
  const primaryListing = activeListings[0] || sellerListings[0];

  const memberSinceLabel = seller?.createdAtMs
    ? new Date(seller.createdAtMs).toLocaleDateString('es-VE', {
        month: 'short',
        year: 'numeric',
      })
    : 'Comunidad Quemarket';

  return (
    <BottomSheet open={open && Boolean(seller)} onClose={onClose} zIndexClass="z-[75]">
      {seller && (
        <div className="space-y-5 pt-1 pb-2">
          {/* Seller Avatar & Identity */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            {seller.photoURL && !avatarError ? (
              <img
                src={seller.photoURL}
                alt={seller.displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md bg-zinc-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#362B3D] text-white font-display font-bold text-2xl flex items-center justify-center shadow-md">
                {seller.displayName.replace(/^@/, '').charAt(0).toUpperCase() || 'V'}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h2 className="font-display text-xl font-bold text-[#141118] text-balance">
                  {seller.displayName}
                </h2>
                {seller.identityVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200/80">
                    <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    No verificado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1 font-medium text-[#362B3D]">
                  <MapPin className="w-3.5 h-3.5 text-[#6B4E8E]" />
                  {seller.city}, {seller.state}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {memberSinceLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Seller Bio / Notes */}
          <div className="rounded-2xl bg-[#FAFAFC] border border-zinc-200/75 px-4 py-3 text-sm text-[#42374C] leading-relaxed">
            {seller.bio?.trim()
              ? seller.bio
              : `Vendedor activo en ${seller.city}, ${seller.state}. Coordina entrega personal y métodos de pago directamente por chat.`}
          </div>

          {/* Clean Tabular Activity Summary */}
          <div className="grid grid-cols-3 divide-x divide-zinc-200/80 rounded-2xl border border-zinc-200/75 bg-white py-3 text-center">
            <div className="px-2">
              <p className="font-display text-lg font-bold text-[#141118] tabular-nums">
                {activeListings.length}
              </p>
              <p className="text-[11px] text-zinc-500">Activas</p>
            </div>
            <div className="px-2">
              <p className="font-display text-lg font-bold text-[#141118] tabular-nums">
                {soldCount}
              </p>
              <p className="text-[11px] text-zinc-500">Vendidas</p>
            </div>
            <div className="px-2 min-w-0">
              <p className="font-display text-sm font-bold text-[#141118] truncate pt-1">
                {seller.city}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{seller.state}</p>
            </div>
          </div>

          {/* Seller's Active Publications */}
          <div className="space-y-2.5">
            <h3 className="font-display text-sm font-bold text-[#141118]">
              Publicaciones de {seller.displayName} ({activeListings.length})
            </h3>

            {activeListings.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200/75 p-5 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                <Package className="w-5 h-5 text-zinc-400" />
                Este vendedor no tiene otras publicaciones activas en este momento.
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                {activeListings.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectListing(item);
                    }}
                    className="w-full min-h-[64px] rounded-2xl border border-zinc-200/75 bg-white hover:bg-zinc-50 p-2.5 flex items-center gap-3 text-left transition-colors active:scale-[0.99]"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-14 h-12 rounded-xl object-cover bg-zinc-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold text-[#141118] truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                        ${item.priceUsd.toLocaleString('es-VE')} · {item.condition}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Action */}
          {!isOwnProfile && primaryListing && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartChat(primaryListing);
              }}
              className="w-full h-12 px-5 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <MessageCircle className="w-4 h-4" />
              Chatear con {seller.displayName}
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
