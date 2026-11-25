import React from 'react';
import { MapPin, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { BASE_CATEGORIES, VENEZUELA_STATES } from '../data/venezuela';
import { ProximityOption } from '../types/marketplace';
import { BottomSheet } from './BottomSheet';

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  onApply?: () => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  selectedState: string;
  onSelectState: (state: string) => void;
  selectedCity: string;
  onSelectCity: (city: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  proximity: ProximityOption;
  onSelectProximity: (p: ProximityOption) => void;
  customCategories: string[];
  resultCount: number;
  onReset: () => void;
}

export function SearchSheet({
  open,
  onClose,
  onApply,
  searchQuery,
  onSearchQueryChange,
  selectedState,
  onSelectState,
  selectedCity,
  onSelectCity,
  selectedCategory,
  onSelectCategory,
  proximity,
  onSelectProximity,
  customCategories,
  resultCount,
  onReset,
}: SearchSheetProps) {
  const allCategories = Array.from(new Set([...BASE_CATEGORIES, ...customCategories]));
  const stateObj = VENEZUELA_STATES.find((s) => s.state === selectedState);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      aboveDock
      title="Buscar y filtrar"
      subtitle="Elige estado, categoría o proximidad"
    >
      <div className="space-y-5">
        {/* Text query */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="¿Qué buscas hoy? (ej. iPhone, moto, café...)"
            className="w-full h-12 pl-10 pr-4 rounded-2xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
          />
        </div>

        {/* Proximity filter with interactive kilometer slider */}
        <div className="space-y-2.5 bg-zinc-50/90 border border-zinc-200/75 rounded-2xl p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B4E8E]" />
              <span>Radio de distancia</span>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-[#362B3D] text-white text-xs font-bold tabular-nums">
              {typeof proximity === 'number'
                ? `Hasta ${proximity} km`
                : proximity === 'state'
                  ? 'Estado'
                  : 'Venezuela'}
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <input
              type="range"
              min={1}
              max={205}
              step={1}
              aria-label="Distancia en kilómetros"
              value={
                typeof proximity === 'number'
                  ? Math.min(200, Math.max(1, proximity))
                  : 205
              }
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 200) {
                  onSelectProximity('country');
                } else {
                  onSelectProximity(val);
                }
              }}
              className="w-full h-2 rounded-lg bg-zinc-200 accent-[#362B3D] cursor-pointer"
            />
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 tabular-nums px-0.5">
              <span>1 km</span>
              <span>50 km</span>
              <span>100 km</span>
              <span>150 km</span>
              <span>200 km+</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSelectProximity(typeof proximity === 'number' ? proximity : 25)}
              className={`flex-1 h-8 px-2.5 rounded-xl text-[11px] font-semibold transition-colors ${
                typeof proximity === 'number'
                  ? 'bg-[#362B3D] text-white'
                  : 'bg-white border border-zinc-200/80 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {typeof proximity === 'number' ? `Por km (${proximity} km)` : 'Por kilómetros'}
            </button>
            <button
              type="button"
              onClick={() => onSelectProximity('state')}
              className={`flex-1 h-8 px-2.5 rounded-xl text-[11px] font-semibold transition-colors ${
                proximity === 'state'
                  ? 'bg-[#362B3D] text-white'
                  : 'bg-white border border-zinc-200/80 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Estado
            </button>
            <button
              type="button"
              onClick={() => onSelectProximity('country')}
              className={`flex-1 h-8 px-2.5 rounded-xl text-[11px] font-semibold transition-colors ${
                proximity === 'country'
                  ? 'bg-[#362B3D] text-white'
                  : 'bg-white border border-zinc-200/80 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Venezuela
            </button>
          </div>
        </div>

        {/* State & City */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>Estado y ciudad</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={selectedState}
              onChange={(e) => {
                const nextState = e.target.value;
                onSelectState(nextState);
                onSelectCity('Todas');
                if (nextState !== 'Todos' && proximity === 'country') {
                  onSelectProximity('state');
                }
              }}
              aria-label="Seleccionar estado"
              className="h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            >
              <option value="Todos">Venezuela</option>
              {VENEZUELA_STATES.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state}
                </option>
              ))}
            </select>

            <select
              value={selectedCity}
              onChange={(e) => onSelectCity(e.target.value)}
              disabled={selectedState === 'Todos'}
              aria-label="Seleccionar ciudad"
              className="h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            >
              <option value="Todas">Todas las ciudades</option>
              {stateObj?.cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-zinc-500">Categoría</span>
          <select
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            aria-label="Seleccionar categoría"
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
          >
            <option value="Todas">Todas las categorías</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onReset}
            className="h-12 px-4 rounded-2xl border border-zinc-200 text-zinc-600 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-50 active:scale-[0.98] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Limpiar
          </button>

          <button
            type="button"
            onClick={onApply ?? onClose}
            className="flex-1 h-12 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-sm font-semibold active:scale-[0.98] transition-all tabular-nums"
          >
            Ver {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
