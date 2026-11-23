import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Check,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { BASE_CATEGORIES } from '../data/venezuela';
import { CityLocation, Listing, Purchase } from '../types/marketplace';

interface ProfileViewProps {
  firebaseUser: FirebaseUser | null;
  displayName: string;
  userCity: CityLocation;
  customCategories: string[];
  myListings: Listing[];
  purchases: Purchase[];
  onSignInGoogle: () => Promise<void>;
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
  userCity,
  customCategories,
  myListings,
  purchases,
  onSignInGoogle,
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
  const [signingIn, setSigningIn] = useState(false);
  const [resentMsg, setResentMsg] = useState(false);

  const availableCategories = Array.from(new Set([...BASE_CATEGORIES, ...customCategories]));

  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newCategory.trim();
    if (!cleaned) return;
    onAddCustomCategory(cleaned);
    setNewCategory('');
  };

  const handleGoogleAuth = async () => {
    setSigningIn(true);
    try {
      await onSignInGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* User Summary Card */}
      <section className="bg-white rounded-[26px] border border-zinc-200/75 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {firebaseUser?.photoURL ? (
            <img
              src={firebaseUser.photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-13 h-13 rounded-full object-cover border border-zinc-200 shrink-0"
            />
          ) : (
            <div className="w-13 h-13 rounded-full bg-[#362B3D] text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[#141118] truncate">
              {displayName}
            </h2>
            <button
              type="button"
              onClick={onOpenCityPicker}
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-[#362B3D] transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#6B4E8E]" />
              <span className="truncate">
                {userCity.city}, {userCity.state}
              </span>
            </button>
          </div>
        </div>

        {firebaseUser ? (
          <button
            type="button"
            onClick={onSignOut}
            className="h-10 px-3.5 rounded-xl bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={signingIn}
            className="h-10 px-3.5 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5" />
            {signingIn ? 'Conectando...' : 'Conectar Google'}
          </button>
        )}
      </section>

      {firebaseUser && !firebaseUser.emailVerified && onResendVerification && (
        <section className="bg-amber-50/90 border border-amber-200/80 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-900 leading-snug">
            Revisa tu correo para verificar tu cuenta y sincronizar tus publicaciones en la nube.
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

      {/* Personalized Categories inside Profile */}
      <section className="bg-white rounded-[26px] border border-zinc-200/75 p-4 space-y-3">
        <div>
          <h3 className="font-display text-sm font-bold text-[#141118]">
            Categorías personalizadas
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Elige o crea tus intereses para priorizarlos en tu inicio.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableCategories.map((cat) => {
            const active = customCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onToggleCustomCategory(cat)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-[#362B3D] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                }`}
              >
                {active ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {cat}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleAddCat} className="flex gap-2 pt-1">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            maxLength={35}
            placeholder="Nueva categoría (ej. Gaming, Repuestos)"
            className="flex-1 h-10 px-3.5 rounded-xl bg-zinc-100 text-xs text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
          />
          <button
            type="submit"
            disabled={!newCategory.trim() || customCategories.length >= 12}
            className="h-10 px-4 rounded-xl bg-zinc-900 text-white text-xs font-semibold disabled:opacity-40 active:scale-95 transition-all"
          >
            Agregar
          </button>
        </form>
      </section>

      {/* Segmented Switch: Active Listings vs Purchase History */}
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
          Publicaciones activas ({myListings.length})
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
              No tienes publicaciones activas todavía
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
                    {item.status === 'sold' ? 'Vendida' : 'Activa'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => onMarkListingSold(item)}
                      title="Marcar como vendida"
                      className="h-9 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors"
                    >
                      Vendida
                    </button>
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
    </div>
  );
}
