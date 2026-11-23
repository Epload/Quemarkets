import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronRight, MapPin, Navigation } from 'lucide-react';
import { ALL_CITIES, VENEZUELA_STATES, findNearestVenezuelanCity } from '../data/venezuela';
import { CityLocation } from '../types/marketplace';
import { BottomSheet } from './BottomSheet';

interface CityPickerSheetProps {
  open: boolean;
  onClose: () => void;
  currentCity: CityLocation;
  onSelectCity: (loc: CityLocation) => void;
}

export function CityPickerSheet({
  open,
  onClose,
  currentCity,
  onSelectCity,
}: CityPickerSheetProps) {
  const [selectedState, setSelectedState] = useState<string>(currentCity.state);
  const [queryText, setQueryText] = useState('');
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleUseGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Tu dispositivo no soporta geolocalización.');
      return;
    }
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestVenezuelanCity(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        onSelectCity(nearest);
        onClose();
      },
      () => {
        setLocating(false);
        setGpsError('No pudimos acceder a tu ubicación. Selecciona tu ciudad abajo.');
      },
      { timeout: 6000 }
    );
  };

  const filteredCities = queryText.trim()
    ? ALL_CITIES.filter(
        (c) =>
          c.city.toLowerCase().includes(queryText.toLowerCase()) ||
          c.state.toLowerCase().includes(queryText.toLowerCase())
      )
    : VENEZUELA_STATES.find((s) => s.state === selectedState)?.cities || [];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Elige tu ciudad"
      subtitle="Mostraremos publicaciones cercanas en Venezuela"
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleUseGps}
          disabled={locating}
          className="w-full min-h-[48px] px-4 rounded-2xl bg-[#F4EFFA] hover:bg-[#ECE2FA] text-[#362B3D] font-medium text-sm flex items-center justify-between transition-colors active:scale-[0.99]"
        >
          <span className="flex items-center gap-2.5">
            <Navigation className="w-4 h-4" />
            {locating ? 'Detectando ubicación...' : 'Detectar mi ciudad con GPS'}
          </span>
          <ChevronRight className="w-4 h-4 opacity-70" />
        </button>

        {gpsError && <p className="text-xs text-rose-600 px-1">{gpsError}</p>}

        <div>
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Buscar ciudad o estado (ej. Caracas, Valencia...)"
            className="w-full h-11 px-4 rounded-2xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
          />
        </div>

        {!queryText.trim() && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {VENEZUELA_STATES.map((s) => {
              const active = selectedState === s.state;
              return (
                <button
                  key={s.state}
                  type="button"
                  onClick={() => setSelectedState(s.state)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                >
                  {s.state}
                </button>
              );
            })}
          </div>
        )}

        <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-2xl overflow-hidden">
          {filteredCities.map((loc) => {
            const isSelected = loc.city === currentCity.city && loc.state === currentCity.state;
            return (
              <button
                key={`${loc.state}-${loc.city}`}
                type="button"
                onClick={() => {
                  onSelectCity(loc);
                  onClose();
                }}
                className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 text-[#362B3D] flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#141118] truncate">{loc.city}</p>
                    <p className="text-xs text-zinc-500 truncate">{loc.state} · Venezuela</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#362B3D] shrink-0" />}
              </button>
            );
          })}
          {filteredCities.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-400">
              No encontramos esa ciudad. Prueba otro nombre.
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
