import React, { useState } from 'react';
import { Camera, Package } from 'lucide-react';
import { Listing } from '../types/marketplace';

interface ProductCardProps {
  listing: Listing;
  distanceKm?: number;
  onSelect: (listing: Listing) => void;
}

export function ProductCard({ listing, distanceKm, onSelect }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const photoCount = listing.imageUrls?.length || (listing.imageUrl ? 1 : 0);
  const isSold = listing.status === 'sold';

  return (
    <button
      type="button"
      onClick={() => onSelect(listing)}
      className="group text-left w-full bg-white rounded-[22px] border border-zinc-200/75 overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#362B3D]"
    >
      <div className="relative aspect-[4/3] w-full bg-zinc-100 overflow-hidden">
        {!imgError && listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              isSold ? 'opacity-75 saturate-75' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200/70 text-zinc-400 p-4 text-center">
            <Package className="w-7 h-7 mb-1.5" />
            <span className="text-xs font-medium text-zinc-500 line-clamp-1">{listing.title}</span>
          </div>
        )}
        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-display text-lg sm:text-xl font-black tracking-[0.22em] uppercase text-red-500 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
              Vendido
            </span>
          </div>
        )}
        {photoCount > 1 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold inline-flex items-center gap-1 tabular-nums">
            <Camera className="w-3 h-3" />
            {photoCount}
          </span>
        )}
      </div>

      <div className="p-3.5 space-y-1">
        <div className="flex items-center justify-between gap-1.5">
          <h3 className="font-display text-[15px] font-semibold text-[#141118] leading-snug line-clamp-1">
            {listing.title}
          </h3>
          {isSold && (
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide shrink-0">
              Vendido
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2 pt-0.5">
          <span
            className={`font-display text-[17px] font-bold tabular-nums ${
              isSold ? 'text-zinc-400 line-through' : 'text-[#141118]'
            }`}
          >
            ${listing.priceUsd.toLocaleString('es-VE')}
          </span>
          <span className="text-[11px] text-zinc-500 truncate tabular-nums">
            {listing.city}
            {typeof distanceKm === 'number' && distanceKm <= 150 ? ` · ${distanceKm} km` : ''}
          </span>
        </div>
      </div>
    </button>
  );
}
