import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { Listing } from '../types/marketplace';

interface ProductCardProps {
  listing: Listing;
  distanceKm?: number;
  onSelect: (listing: Listing) => void;
}

export function ProductCard({ listing, distanceKm, onSelect }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

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
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200/70 text-zinc-400 p-4 text-center">
            <Package className="w-7 h-7 mb-1.5" />
            <span className="text-xs font-medium text-zinc-500 line-clamp-1">{listing.title}</span>
          </div>
        )}
      </div>

      <div className="p-3.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 truncate">
          <span>{listing.category}</span>
          <span aria-hidden="true">·</span>
          <span>{listing.condition}</span>
        </div>

        <h3 className="font-display text-[15px] font-semibold text-[#141118] leading-snug line-clamp-1">
          {listing.title}
        </h3>

        <div className="flex items-baseline justify-between gap-2 pt-0.5">
          <span className="font-display text-[17px] font-bold text-[#141118] tabular-nums">
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
