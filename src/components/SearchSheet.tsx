import React from 'react';
import { MapPin, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { BASE_CATEGORIES, VENEZUELA_STATES } from '../data/venezuela';
import { ProximityOption } from '../types/marketplace';
import { BottomSheet } from './BottomSheet';

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
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

const PROXIMITY_OPTIONS: { id: ProximityOption; label: string }[] = [
  { id: '5km', label: 'A 5 km' },
  { id: '15km', label: 'A 15 km' },
  { id: '50km', label: 'A 50 km' },
  { id: 'state', label: 'Todo el estado' },
  { id: 'country', label: 'Toda Venezuela' },
];

export function SearchSheet({
  open,
  onClose,
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

        {/* Proximity filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Proximidad</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROXIMITY_OPTIONS.map((opt) => {
              const active = proximity === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectProximity(opt.id)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
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
              <option value="Todos">Toda Venezuela</option>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectCategory('Todas')}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedCategory === 'Todas'
                  ? 'bg-[#362B3D] text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
              }`}
            >
              Todas
            </button>
            {allCategories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onSelectCategory(cat)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
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
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-sm font-semibold active:scale-[0.98] transition-all tabular-nums"
          >
            Ver {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
