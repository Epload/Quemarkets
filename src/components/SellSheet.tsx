import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  ImagePlus,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  BASE_CATEGORIES,
  SUBCATEGORIES_BY_CATEGORY,
  VENEZUELA_STATES,
} from '../data/venezuela';
import {
  BcvRateInfo,
  fetchDailyBcvRate,
  formatBolivares,
  getCachedBcvRate,
} from '../lib/bcvService';
import { compressListingPhotoToDataUrl } from '../lib/marketplaceService';
import {
  CityLocation,
  ItemCondition,
  Listing,
  RealEstateDetails,
  VehicleDetails,
} from '../types/marketplace';
import { BottomSheet } from './BottomSheet';
import { RealEstateDetailsModal, VehicleDetailsModal } from './CategoryDetailsModals';

const MAX_LISTING_IMAGES = 5;

interface SellSheetProps {
  open: boolean;
  onClose: () => void;
  userCity: CityLocation;
  customCategories: string[];
  onPublish: (
    data: Omit<Listing, 'id' | 'sellerId' | 'sellerName' | 'status' | 'createdAtMs' | 'source'>
  ) => Promise<void>;
}


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
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetails>({});
  const [realEstateDetails, setRealEstateDetails] = useState<RealEstateDetails>({});
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [realEstateModalOpen, setRealEstateModalOpen] = useState(false);
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [processingImages, setProcessingImages] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bcvRate, setBcvRate] = useState<BcvRateInfo | null>(() => getCachedBcvRate());
  const [bcvLoading, setBcvLoading] = useState(false);
  const [bcvError, setBcvError] = useState(false);

  const loadBcvRate = async (force = false) => {
    setBcvLoading(true);
    setBcvError(false);
    try {
      const info = await fetchDailyBcvRate(force);
      setBcvRate(info);
    } catch {
      setBcvError(true);
    } finally {
      setBcvLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadBcvRate(false);
    const onFocus = () => {
      loadBcvRate(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open]);

  const isVehicleCategory = category === 'Vehículos y Motos';
  const isRealEstateCategory = category === 'Inmuebles';
  const isUsdOnlyCategory = isVehicleCategory || isRealEstateCategory;
  const categorySubcategories = category ? SUBCATEGORIES_BY_CATEGORY[category] || [] : [];

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    setSubcategory('');
    setErrorMsg(null);
    if (nextCategory === 'Vehículos y Motos') {
      setVehicleModalOpen(true);
    } else if (nextCategory === 'Inmuebles') {
      setRealEstateModalOpen(true);
    }
  };

  const numericPricePreview = Number(price);
  const hasValidPricePreview = Number.isFinite(numericPricePreview) && numericPricePreview > 0;
  const convertedBs =
    !isUsdOnlyCategory && hasValidPricePreview && bcvRate
      ? numericPricePreview * bcvRate.usdToVes
      : null;

  const selectedStateObj =
    VENEZUELA_STATES.find((s) => s.state === stateName) || VENEZUELA_STATES[0];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = MAX_LISTING_IMAGES - imageUrls.length;
    if (remainingSlots <= 0) {
      setErrorMsg(`Solo puedes subir hasta ${MAX_LISTING_IMAGES} fotos por publicación.`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    setProcessingImages(true);
    setErrorMsg(null);
    try {
      const compressedList: string[] = [];
      for (const file of filesToProcess) {
        const dataUrl = await compressListingPhotoToDataUrl(file);
        compressedList.push(dataUrl);
      }
      setImageUrls((prev) => [...prev, ...compressedList].slice(0, MAX_LISTING_IMAGES));
      if (files.length > remainingSlots) {
        setErrorMsg(`Se agregaron ${filesToProcess.length} fotos (máximo ${MAX_LISTING_IMAGES}).`);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar una de las fotos. Intenta con otra imagen.'
      );
    } finally {
      setProcessingImages(false);
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImageUrls((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPreviewIndex((curr) => Math.max(0, Math.min(curr, next.length - 1)));
      return next;
    });
    setErrorMsg(null);
  };

  const handleMakeCoverImage = (idx: number) => {
    if (idx === 0) return;
    setImageUrls((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      return [target, ...prev.filter((_, i) => i !== idx)];
    });
    setPreviewIndex(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(price);
    if (imageUrls.length === 0) {
      setErrorMsg('Sube al menos una foto de tu producto para poder publicarlo.');
      return;
    }
    if (title.trim().length < 2) {
      setErrorMsg('Escribe un título breve para tu producto.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setErrorMsg('Ingresa un precio válido en USD.');
      return;
    }
    if (!category) {
      setErrorMsg('Selecciona una categoría para tu publicación.');
      return;
    }
    if (isVehicleCategory && !subcategory && Object.keys(vehicleDetails).length === 0) {
      setErrorMsg('Completa la ficha técnica del vehículo o moto.');
      setVehicleModalOpen(true);
      return;
    }
    if (isRealEstateCategory && !subcategory && Object.keys(realEstateDetails).length === 0) {
      setErrorMsg('Completa los detalles del inmueble.');
      setRealEstateModalOpen(true);
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
        ...(subcategory ? { subcategory } : {}),
        condition,
        state: cityObj.state,
        city: cityObj.city,
        lat: cityObj.lat,
        lng: cityObj.lng,
        imageUrl: imageUrls[0],
        imageUrls,
        ...(isVehicleCategory && Object.keys(vehicleDetails).length > 0
          ? { vehicleDetails }
          : {}),
        ...(isRealEstateCategory && Object.keys(realEstateDetails).length > 0
          ? { realEstateDetails }
          : {}),
      });
      setPublished(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar la publicación. Intenta nuevamente.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleResetAndClose = () => {
    if (published) {
      setPublished(false);
      setTitle('');
      setPrice('');
      setCategory('');
      setSubcategory('');
      setVehicleDetails({});
      setRealEstateDetails({});
      setDescription('');
      setImageUrls([]);
      setPreviewIndex(0);
    }
    setErrorMsg(null);
    onClose();
  };

  return (
    <>
      <BottomSheet
        open={open}
        onClose={handleResetAndClose}
        aboveDock
        title={published ? 'Publicación enviada' : 'Publicar producto'}
        subtitle={
          published
            ? 'Recibimos tu artículo correctamente'
            : 'Rápido, directo y sin comisiones'
        }
      >
      {published ? (
        <div className="py-6 px-2 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200/80 text-amber-700 mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="font-display text-lg font-bold text-[#141118]">
              Publicación en revisión
            </h3>
            <p className="text-sm text-[#584B63] leading-relaxed">
              Nuestro equipo revisará tu artículo para confirmar que todo esté en orden y pronto
              estará visible para todos.
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed pt-1">
              Puedes consultar su estado en{' '}
              <span className="font-semibold text-[#362B3D]">Perfil → Mis publicaciones</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-full h-12 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Entendido
          </button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Multi-Photo Uploader (full window width + up to 5 images) */}
        <div className="space-y-2.5 w-full">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-zinc-500">
              Fotos del producto ({imageUrls.length}/{MAX_LISTING_IMAGES})
            </label>
            {imageUrls.length > 0 && (
              <span className="text-[11px] text-zinc-400">
                {imageUrls.length < MAX_LISTING_IMAGES
                  ? `Puedes añadir ${MAX_LISTING_IMAGES - imageUrls.length} más`
                  : 'Máximo 5 fotos'}
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {imageUrls.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processingImages}
              aria-label="Subir hasta 5 fotos"
              className="w-full h-36 px-4 rounded-2xl border-2 border-dashed border-[#362B3D]/25 bg-[#F6F1FC]/75 hover:bg-[#ECE2FA] text-[#362B3D] flex flex-col items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-60"
            >
              {processingImages ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-semibold">Procesando fotos...</span>
                </>
              ) : (
                <>
                  <div className="w-11 h-11 rounded-2xl bg-white/90 shadow-xs flex items-center justify-center text-[#362B3D]">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="text-sm font-semibold text-[#2A2130]">
                      Subir hasta {MAX_LISTING_IMAGES} fotos
                    </p>
                    <p className="text-[11px] text-[#584B63]">
                      Toca aquí para elegir de tu galería o cámara
                    </p>
                  </div>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2.5 w-full">
              {/* Full-width main preview of selected photo */}
              {(() => {
                const safePreview = Math.min(previewIndex, imageUrls.length - 1);
                const currentUrl = imageUrls[safePreview];
                return (
                  <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/80">
                    <img
                      src={currentUrl}
                      alt={`Vista previa foto ${safePreview + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold tabular-nums">
                        {safePreview === 0
                          ? `Portada · 1/${imageUrls.length}`
                          : `Foto ${safePreview + 1}/${imageUrls.length}`}
                      </span>
                      {safePreview !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleMakeCoverImage(safePreview)}
                          className="px-2.5 py-1 rounded-full bg-[#362B3D]/90 hover:bg-[#362B3D] text-white text-[11px] font-semibold backdrop-blur-sm transition-colors"
                        >
                          Usar como portada
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(safePreview)}
                      aria-label={`Eliminar foto ${safePreview + 1}`}
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })()}

              {/* 5-slot strip spanning full window width */}
              <div className="grid grid-cols-5 gap-2 w-full">
                {imageUrls.map((url, idx) => {
                  const isSelected = idx === Math.min(previewIndex, imageUrls.length - 1);
                  return (
                    <div
                      key={`${idx}-${url.slice(0, 24)}`}
                      className={`relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-100 border-2 transition-all ${
                        isSelected ? 'border-[#362B3D]' : 'border-zinc-200/80 opacity-80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewIndex(idx)}
                        aria-label={`Ver foto ${idx + 1}`}
                        className="w-full h-full block focus:outline-none"
                      >
                        <img
                          src={url}
                          alt={`Foto ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-[#362B3D]/90 text-white text-[8.5px] font-bold leading-none pointer-events-none">
                          Portada
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        aria-label={`Eliminar foto ${idx + 1}`}
                        className="absolute top-1 right-1 w-4.5 h-4.5 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}

                {imageUrls.length < MAX_LISTING_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processingImages}
                    aria-label="Añadir más fotos"
                    className="w-full aspect-square rounded-xl border-2 border-dashed border-[#362B3D]/25 bg-[#F6F1FC]/75 hover:bg-[#ECE2FA] text-[#362B3D] flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 disabled:opacity-60"
                  >
                    {processingImages ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="w-4 h-4" />
                        <span className="text-[10px] font-semibold leading-none">Añadir</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Category & Subcategory / Specialized Modal Trigger Card right after photos */}
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={`w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25 ${
                category ? 'text-[#141118]' : 'text-zinc-500'
              }`}
            >
              <option value="">Selecciona categoría...</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {isVehicleCategory ? (
            <button
              type="button"
              onClick={() => setVehicleModalOpen(true)}
              className="w-full p-3.5 rounded-2xl bg-[#F6F1FC] hover:bg-[#EFE5FA] border border-[#362B3D]/15 flex items-center justify-between gap-3 text-left transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white text-[#362B3D] flex items-center justify-center shrink-0 shadow-xs">
                  <Car className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#141118] truncate">
                    {subcategory || 'Ficha del vehículo o moto'}
                  </p>
                  <p className="text-[11px] text-[#584B63] truncate mt-0.5">
                    {[
                      vehicleDetails.brand,
                      vehicleDetails.model,
                      vehicleDetails.year,
                      typeof vehicleDetails.mileageKm === 'number'
                        ? `${vehicleDetails.mileageKm.toLocaleString('es-VE')} km`
                        : null,
                      vehicleDetails.transmission,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Toca para agregar marca, modelo, año, km y transmisión'}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B4E8E] shrink-0">
                {subcategory || Object.keys(vehicleDetails).length > 0 ? 'Editar' : 'Completar'}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          ) : isRealEstateCategory ? (
            <button
              type="button"
              onClick={() => setRealEstateModalOpen(true)}
              className="w-full p-3.5 rounded-2xl bg-[#F6F1FC] hover:bg-[#EFE5FA] border border-[#362B3D]/15 flex items-center justify-between gap-3 text-left transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white text-[#362B3D] flex items-center justify-center shrink-0 shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#141118] truncate">
                    {subcategory || 'Detalles del inmueble'}
                  </p>
                  <p className="text-[11px] text-[#584B63] truncate mt-0.5">
                    {[
                      typeof realEstateDetails.areaSqm === 'number'
                        ? `${realEstateDetails.areaSqm} m²`
                        : null,
                      typeof realEstateDetails.bedrooms === 'number'
                        ? `${realEstateDetails.bedrooms} hab`
                        : null,
                      typeof realEstateDetails.bathrooms === 'number'
                        ? `${realEstateDetails.bathrooms} baños`
                        : null,
                      typeof realEstateDetails.parkingSpaces === 'number'
                        ? `${realEstateDetails.parkingSpaces} estac.`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Toca para agregar metraje, habitaciones, baños y servicios'}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B4E8E] shrink-0">
                {subcategory || Object.keys(realEstateDetails).length > 0 ? 'Editar' : 'Completar'}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          ) : categorySubcategories.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">
                Subcategoría (opcional)
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className={`w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25 ${
                  subcategory ? 'text-[#141118]' : 'text-zinc-500'
                }`}
              >
                <option value="">Selecciona subcategoría...</option>
                {categorySubcategories.map((sub) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {/* Title & Price */}
        <div className="space-y-2">
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

          {/* Price currency rule: USD-only for Vehicles & Real Estate, BCV Bs equivalent otherwise */}
          {isUsdOnlyCategory ? (
            <div className="rounded-2xl bg-[#F6F1FC] border border-[#362B3D]/12 px-3.5 py-2.5 flex items-center gap-2.5">
              {isVehicleCategory ? (
                <Car className="w-4 h-4 text-[#6B4E8E] shrink-0" />
              ) : (
                <Building2 className="w-4 h-4 text-[#6B4E8E] shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#2A2130]">
                  Publicación netamente en USD ($)
                </p>
                <p className="text-[11px] text-[#584B63] mt-0.5">
                  {isVehicleCategory
                    ? 'Los vehículos y motos no aplican cambio a bolívares.'
                    : 'Los inmuebles no aplican cambio a bolívares.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#F6F1FC] border border-[#362B3D]/10 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                {bcvRate ? (
                  <>
                    <p className="text-xs font-bold text-[#2A2130] tabular-nums truncate">
                      {convertedBs !== null
                        ? `Equivalente BCV: Bs. ${formatBolivares(convertedBs)}`
                        : `Tasa BCV del día: Bs. ${formatBolivares(bcvRate.usdToVes)} / $`}
                    </p>
                    <p className="text-[11px] text-[#584B63] tabular-nums truncate mt-0.5">
                      {convertedBs !== null
                        ? `Tasa ${bcvRate.source}: Bs. ${formatBolivares(bcvRate.usdToVes)} / $`
                        : `Fuente: ${bcvRate.source}`}
                      {bcvRate.valueDateLabel ? ` · ${bcvRate.valueDateLabel}` : ''}
                    </p>
                  </>
                ) : bcvLoading ? (
                  <p className="text-xs font-medium text-[#584B63]">
                    Consultando tasa oficial en bcv.org.ve...
                  </p>
                ) : bcvError ? (
                  <p className="text-xs font-medium text-rose-600">
                    No se pudo consultar la tasa de bcv.org.ve.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => loadBcvRate(true)}
                disabled={bcvLoading}
                title="Actualizar tasa BCV"
                aria-label="Actualizar tasa BCV"
                className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white text-[#6B4E8E] flex items-center justify-center shrink-0 transition-colors active:scale-95 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bcvLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
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

        {/* State & City */}
        <div className="grid grid-cols-2 gap-2.5">
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
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Ciudad</label>
            <select
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              className="w-full h-11 px-3 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            >
              {selectedStateObj.cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          </div>
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
          {publishing ? 'Enviando a revisión...' : 'Enviar publicación'}
        </button>
      </form>
      )}

      </BottomSheet>

      <VehicleDetailsModal
        open={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        initialSubcategory={subcategory}
        initialDetails={vehicleDetails}
        onSave={(nextSub, nextDetails) => {
          setSubcategory(nextSub);
          setVehicleDetails(nextDetails);
          setErrorMsg(null);
        }}
      />

      <RealEstateDetailsModal
        open={realEstateModalOpen}
        onClose={() => setRealEstateModalOpen(false)}
        initialSubcategory={subcategory}
        initialDetails={realEstateDetails}
        onSave={(nextSub, nextDetails) => {
          setSubcategory(nextSub);
          setRealEstateDetails(nextDetails);
          setErrorMsg(null);
        }}
      />
    </>
  );
}
