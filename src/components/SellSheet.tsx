import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus } from 'lucide-react';
import { BASE_CATEGORIES, VENEZUELA_STATES } from '../data/venezuela';
import { compressImageToDataUrl } from '../lib/marketplaceService';
import { CityLocation, ItemCondition, Listing } from '../types/marketplace';
import { BottomSheet } from './BottomSheet';

interface SellSheetProps {
  open: boolean;
  onClose: () => void;
  userCity: CityLocation;
  customCategories: string[];
  onPublish: (
    data: Omit<Listing, 'id' | 'sellerId' | 'sellerName' | 'status' | 'createdAtMs' | 'source'>
  ) => Promise<void>;
}

const SAMPLE_PHOTOS = [
  {
    label: 'Tecnología',
    url: '/src/assets/images/product_iphone_pro_1795464745375.jpg',
  },
  {
    label: 'Hogar',
    url: '/src/assets/images/product_cafetera_espresso_1795464746423.jpg',
  },
  {
    label: 'Moda',
    url: '/src/assets/images/product_sneakers_urban_1795464747268.jpg',
  },
  {
    label: 'Deportes',
    url: '/src/assets/images/product_bicicleta_mtb_1795464747978.jpg',
  },
];

export function SellSheet({
  open,
  onClose,
  userCity,
  customCategories,
  onPublish,
}: SellSheetProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const allCategories = Array.from(new Set([...BASE_CATEGORIES, ...customCategories]));

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>(allCategories[0] || 'Tecnología');
  const [condition, setCondition] = useState<ItemCondition>('Como nuevo');
  const [stateName, setStateName] = useState(userCity.state);
  const [cityName, setCityName] = useState(userCity.city);

  useEffect(() => {
    if (open) {
      setStateName(userCity.state);
      setCityName(userCity.city);
    }
  }, [open, userCity.state, userCity.city]);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(SAMPLE_PHOTOS[0].url);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedStateObj =
    VENEZUELA_STATES.find((s) => s.state === stateName) || VENEZUELA_STATES[0];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      setImageUrl(compressed);
      setErrorMsg(null);
    } catch {
      setErrorMsg('No se pudo procesar la foto. Intenta con otra imagen.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(price);
    if (title.trim().length < 2) {
      setErrorMsg('Escribe un título breve para tu producto.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setErrorMsg('Ingresa un precio válido en USD.');
      return;
    }

    const cityObj =
      selectedStateObj.cities.find((c) => c.city === cityName) || selectedStateObj.cities[0];

    setPublishing(true);
    setErrorMsg(null);
    try {
      await onPublish({
        title: title.trim(),
        description:
          description.trim() ||
          `Entrega coordinada en ${cityObj.city}, ${cityObj.state}.`,
        priceUsd: numericPrice,
        category,
        condition,
        state: cityObj.state,
        city: cityObj.city,
        lat: cityObj.lat,
        lng: cityObj.lng,
        imageUrl,
      });
      setPublished(true);
      setTimeout(() => {
        setPublished(false);
        setTitle('');
        setPrice('');
        setDescription('');
        onClose();
      }, 950);
    } catch {
      setErrorMsg('No se pudo publicar. Intenta nuevamente.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Publicar producto"
      subtitle="Rápido, directo y sin comisiones"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image Uploader + Quick Presets */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-24 h-20 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/70 shrink-0">
              <img
                src={imageUrl}
                alt="Vista previa"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-11 px-3.5 rounded-2xl bg-[#F4EFFA] hover:bg-[#ECE2FA] text-[#362B3D] text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Camera className="w-4 h-4" />
                Subir foto de tu galería
              </button>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {SAMPLE_PHOTOS.map((sample) => (
                  <button
                    key={sample.url}
                    type="button"
                    onClick={() => setImageUrl(sample.url)}
                    className={`w-8 h-8 rounded-lg overflow-hidden border shrink-0 transition-all ${
                      imageUrl === sample.url
                        ? 'border-[#362B3D] ring-2 ring-[#362B3D]/25'
                        : 'border-zinc-200 opacity-70 hover:opacity-100'
                    }`}
                    title={sample.label}
                  >
                    <img
                      src={sample.url}
                      alt={sample.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                <span className="text-[11px] text-zinc-400 pl-1 flex items-center gap-1 whitespace-nowrap">
                  <ImagePlus className="w-3 h-3" /> Fotos rápidas
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Title & Price */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              ¿Qué vendes?
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. iPhone 15 Pro, Bicicleta..."
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Precio ($)
            </label>
            <input
              type="number"
              required
              min={1}
              max={1000000}
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="120"
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-semibold tabular-nums text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Estado</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Nuevo', 'Como nuevo', 'Usado'] as ItemCondition[]).map((cond) => (
              <button
                key={cond}
                type="button"
                onClick={() => setCondition(cond)}
                className={`h-10 rounded-xl text-xs font-semibold transition-colors ${
                  condition === cond
                    ? 'bg-[#362B3D] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                }`}
              >
                {cond}
              </button>
            ))}
          </div>
        </div>

        {/* Category & City */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-3 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            >
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Estado (Vzla)</label>
            <select
              value={stateName}
              onChange={(e) => {
                const nextState = e.target.value;
                setStateName(nextState);
                const firstCity =
                  VENEZUELA_STATES.find((s) => s.state === nextState)?.cities[0]?.city || '';
                setCityName(firstCity);
              }}
              className="w-full h-11 px-3 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            >
              {VENEZUELA_STATES.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Ciudad</label>
          <select
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
          >
            {selectedStateObj.cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">
            Detalle breve (opcional)
          </label>
          <textarea
            rows={2}
            maxLength={600}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Métodos de pago, punto de entrega, detalles..."
            className="w-full p-3.5 rounded-2xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
          />
        </div>

        {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={publishing || published}
          className="w-full h-13 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-80"
        >
          {published ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              ¡Publicado con éxito!
            </>
          ) : publishing ? (
            'Publicando...'
          ) : (
            'Publicar ahora'
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
