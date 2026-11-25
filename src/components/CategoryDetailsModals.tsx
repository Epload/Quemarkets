import React, { useEffect, useState } from 'react';
import {
  Bath,
  BedDouble,
  Building2,
  Calendar,
  Car,
  Check,
  FileText,
  Fuel,
  Gauge,
  Maximize2,
  ParkingCircle,
  Settings2,
} from 'lucide-react';
import { SUBCATEGORIES_BY_CATEGORY } from '../data/venezuela';
import {
  Listing,
  RealEstateDetails,
  VehicleDetails,
  VehicleFuel,
  VehicleTransmission,
} from '../types/marketplace';
import { BottomSheet } from './BottomSheet';

const VEHICLE_TRANSMISSIONS: VehicleTransmission[] = [
  'Automática',
  'Sincrónica',
  'CVT',
  'No aplica',
];
const VEHICLE_FUELS: VehicleFuel[] = ['Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'];
const VEHICLE_DOCS = [
  'Título en mano (1-1)',
  'Traspaso directo',
  'Certificado de origen',
  'Por acordar',
];

const REAL_ESTATE_DOCS = [
  'Documento registrado',
  'Título supletorio',
  'Contrato de arrendamiento',
  'Por acordar',
];
const REAL_ESTATE_AMENITIES = [
  'Planta eléctrica',
  'Pozo de agua',
  'Tanque propio',
  'Internet fibra',
  'Amoblado',
  'Vigilancia 24h',
  'Aire central',
  'Maletero',
];

interface VehicleDetailsModalProps {
  open: boolean;
  onClose: () => void;
  initialSubcategory: string;
  initialDetails: VehicleDetails;
  onSave: (subcategory: string, details: VehicleDetails) => void;
}

export function VehicleDetailsModal({
  open,
  onClose,
  initialSubcategory,
  initialDetails,
  onSave,
}: VehicleDetailsModalProps) {
  const subcategories = SUBCATEGORIES_BY_CATEGORY['Vehículos y Motos'] || [];
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const [brand, setBrand] = useState(initialDetails.brand || '');
  const [model, setModel] = useState(initialDetails.model || '');
  const [year, setYear] = useState(initialDetails.year ? String(initialDetails.year) : '');
  const [mileageKm, setMileageKm] = useState(
    typeof initialDetails.mileageKm === 'number' ? String(initialDetails.mileageKm) : ''
  );
  const [transmission, setTransmission] = useState<VehicleTransmission | ''>(
    initialDetails.transmission || ''
  );
  const [fuel, setFuel] = useState<VehicleFuel | ''>(initialDetails.fuel || '');
  const [documents, setDocuments] = useState(initialDetails.documents || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubcategory(initialSubcategory);
      setBrand(initialDetails.brand || '');
      setModel(initialDetails.model || '');
      setYear(initialDetails.year ? String(initialDetails.year) : '');
      setMileageKm(
        typeof initialDetails.mileageKm === 'number' ? String(initialDetails.mileageKm) : ''
      );
      setTransmission(initialDetails.transmission || '');
      setFuel(initialDetails.fuel || '');
      setDocuments(initialDetails.documents || '');
      setErrorMsg(null);
    }
  }, [open, initialSubcategory, initialDetails]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcategory) {
      setErrorMsg('Elige el tipo de vehículo o moto.');
      return;
    }
    const parsedYear = year.trim() ? Number(year) : undefined;
    if (
      parsedYear !== undefined &&
      (!Number.isFinite(parsedYear) || parsedYear < 1950 || parsedYear > 2030)
    ) {
      setErrorMsg('Ingresa un año válido (entre 1950 y 2030).');
      return;
    }
    const parsedKm = mileageKm.trim() ? Number(mileageKm) : undefined;
    if (parsedKm !== undefined && (!Number.isFinite(parsedKm) || parsedKm < 0)) {
      setErrorMsg('Ingresa un kilometraje válido.');
      return;
    }

    onSave(subcategory, {
      ...(brand.trim() ? { brand: brand.trim().slice(0, 50) } : {}),
      ...(model.trim() ? { model: model.trim().slice(0, 60) } : {}),
      ...(parsedYear !== undefined ? { year: Math.round(parsedYear) } : {}),
      ...(parsedKm !== undefined ? { mileageKm: Math.round(parsedKm) } : {}),
      ...(transmission ? { transmission } : {}),
      ...(fuel ? { fuel } : {}),
      ...(documents ? { documents } : {}),
    });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      zIndexClass="z-[60]"
      title="Ficha del vehículo o moto"
      subtitle="Información clave para compradores en Venezuela"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-2xl bg-[#F6F1FC] border border-[#362B3D]/12 px-3.5 py-2.5 flex items-center gap-2.5">
          <Car className="w-4 h-4 text-[#6B4E8E] shrink-0" />
          <p className="text-xs font-semibold text-[#2A2130]">
            Esta categoría se publica netamente en USD ($), sin conversión a bolívares.
          </p>
        </div>

        {/* Subcategory */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
            Tipo de vehículo
          </label>
          <div className="flex flex-wrap gap-1.5">
            {subcategories.map((sub) => {
              const active = subcategory === sub.name;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSubcategory(sub.name);
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70'
                  }`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brand & Model */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Marca</label>
            <input
              type="text"
              maxLength={50}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ej. Toyota, Yamaha, Bera..."
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Modelo</label>
            <input
              type="text"
              maxLength={60}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ej. Corolla, KLR 650..."
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
        </div>

        {/* Year & Mileage */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Año</label>
            <input
              type="number"
              min={1950}
              max={2030}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2019"
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm tabular-nums text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Kilometraje (km)
            </label>
            <input
              type="number"
              min={0}
              max={2000000}
              value={mileageKm}
              onChange={(e) => setMileageKm(e.target.value)}
              placeholder="68000"
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm tabular-nums text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
        </div>

        {/* Transmission */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Transmisión</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VEHICLE_TRANSMISSIONS.map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setTransmission((prev) => (prev === tr ? '' : tr))}
                className={`h-10 rounded-xl text-xs font-semibold transition-colors ${
                  transmission === tr
                    ? 'bg-[#362B3D] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>

        {/* Fuel */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Combustible</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VEHICLE_FUELS.map((fl) => (
              <button
                key={fl}
                type="button"
                onClick={() => setFuel((prev) => (prev === fl ? '' : fl))}
                className={`h-10 rounded-xl text-xs font-semibold transition-colors ${
                  fuel === fl
                    ? 'bg-[#362B3D] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                }`}
              >
                {fl}
              </button>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">
            Documentación
          </label>
          <select
            value={documents}
            onChange={(e) => setDocuments(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
          >
            <option value="">Selecciona una opción (opcional)</option>
            {VEHICLE_DOCS.map((doc) => (
              <option key={doc} value={doc}>
                {doc}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}

        <button
          type="submit"
          className="w-full h-12 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <Check className="w-4 h-4" />
          Guardar ficha del vehículo
        </button>
      </form>
    </BottomSheet>
  );
}

interface RealEstateDetailsModalProps {
  open: boolean;
  onClose: () => void;
  initialSubcategory: string;
  initialDetails: RealEstateDetails;
  onSave: (subcategory: string, details: RealEstateDetails) => void;
}

export function RealEstateDetailsModal({
  open,
  onClose,
  initialSubcategory,
  initialDetails,
  onSave,
}: RealEstateDetailsModalProps) {
  const subcategories = SUBCATEGORIES_BY_CATEGORY['Inmuebles'] || [];
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const [areaSqm, setAreaSqm] = useState(
    typeof initialDetails.areaSqm === 'number' ? String(initialDetails.areaSqm) : ''
  );
  const [bedrooms, setBedrooms] = useState(
    typeof initialDetails.bedrooms === 'number' ? String(initialDetails.bedrooms) : ''
  );
  const [bathrooms, setBathrooms] = useState(
    typeof initialDetails.bathrooms === 'number' ? String(initialDetails.bathrooms) : ''
  );
  const [parkingSpaces, setParkingSpaces] = useState(
    typeof initialDetails.parkingSpaces === 'number' ? String(initialDetails.parkingSpaces) : ''
  );
  const [legalStatus, setLegalStatus] = useState(initialDetails.legalStatus || '');
  const [amenities, setAmenities] = useState<string[]>(initialDetails.amenities || []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubcategory(initialSubcategory);
      setAreaSqm(typeof initialDetails.areaSqm === 'number' ? String(initialDetails.areaSqm) : '');
      setBedrooms(
        typeof initialDetails.bedrooms === 'number' ? String(initialDetails.bedrooms) : ''
      );
      setBathrooms(
        typeof initialDetails.bathrooms === 'number' ? String(initialDetails.bathrooms) : ''
      );
      setParkingSpaces(
        typeof initialDetails.parkingSpaces === 'number' ? String(initialDetails.parkingSpaces) : ''
      );
      setLegalStatus(initialDetails.legalStatus || '');
      setAmenities(initialDetails.amenities || []);
      setErrorMsg(null);
    }
  }, [open, initialSubcategory, initialDetails]);

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : prev.length < 8 ? [...prev, item] : prev
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcategory) {
      setErrorMsg('Elige el tipo de operación o inmueble.');
      return;
    }

    const parsedArea = areaSqm.trim() ? Number(areaSqm) : undefined;
    if (parsedArea !== undefined && (!Number.isFinite(parsedArea) || parsedArea <= 0)) {
      setErrorMsg('Ingresa un metraje válido en m².');
      return;
    }

    const parseCount = (val: string) => {
      if (!val.trim()) return undefined;
      const num = Number(val);
      return Number.isFinite(num) && num >= 0 && num <= 50 ? Math.round(num) : undefined;
    };

    onSave(subcategory, {
      ...(parsedArea !== undefined ? { areaSqm: Math.round(parsedArea) } : {}),
      ...(parseCount(bedrooms) !== undefined ? { bedrooms: parseCount(bedrooms) } : {}),
      ...(parseCount(bathrooms) !== undefined ? { bathrooms: parseCount(bathrooms) } : {}),
      ...(parseCount(parkingSpaces) !== undefined
        ? { parkingSpaces: parseCount(parkingSpaces) }
        : {}),
      ...(amenities.length > 0 ? { amenities } : {}),
      ...(legalStatus ? { legalStatus } : {}),
    });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      zIndexClass="z-[60]"
      title="Detalles del inmueble"
      subtitle="Especificaciones clave de la propiedad"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-2xl bg-[#F6F1FC] border border-[#362B3D]/12 px-3.5 py-2.5 flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-[#6B4E8E] shrink-0" />
          <p className="text-xs font-semibold text-[#2A2130]">
            Los inmuebles se publican netamente en USD ($), sin conversión a bolívares.
          </p>
        </div>

        {/* Subcategory */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
            Tipo de operación e inmueble
          </label>
          <div className="flex flex-wrap gap-1.5">
            {subcategories.map((sub) => {
              const active = subcategory === sub.name;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSubcategory(sub.name);
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70'
                  }`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Area & Rooms */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Área (m²)</label>
            <input
              type="number"
              min={1}
              max={1000000}
              value={areaSqm}
              onChange={(e) => setAreaSqm(e.target.value)}
              placeholder="110"
              className="w-full h-11 px-3 rounded-2xl bg-zinc-100 text-sm tabular-nums text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Habitaciones
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              placeholder="3"
              className="w-full h-11 px-3 rounded-2xl bg-zinc-100 text-sm tabular-nums text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Baños</label>
            <input
              type="number"
              min={0}
              max={50}
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              placeholder="2"
              className="w-full h-11 px-3 rounded-2xl bg-zinc-100 text-sm tabular-nums text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Puestos est.</label>
            <input
              type="number"
              min={0}
              max={50}
              value={parkingSpaces}
              onChange={(e) => setParkingSpaces(e.target.value)}
              placeholder="1"
              className="w-full h-11 px-3 rounded-2xl bg-zinc-100 text-sm tabular-nums text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
            />
          </div>
        </div>

        {/* Legal / Contract Status */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">
            Documentación / Modalidad
          </label>
          <select
            value={legalStatus}
            onChange={(e) => setLegalStatus(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 text-sm font-medium text-[#141118] focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
          >
            <option value="">Selecciona una opción (opcional)</option>
            {REAL_ESTATE_DOCS.map((doc) => (
              <option key={doc} value={doc}>
                {doc}
              </option>
            ))}
          </select>
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
            Servicios y extras incluidos
          </label>
          <div className="flex flex-wrap gap-1.5">
            {REAL_ESTATE_AMENITIES.map((item) => {
              const selected = amenities.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleAmenity(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-[#362B3D] text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}

        <button
          type="submit"
          className="w-full h-12 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <Check className="w-4 h-4" />
          Guardar ficha del inmueble
        </button>
      </form>
    </BottomSheet>
  );
}

interface ListingSpecsDetailModalProps {
  open: boolean;
  onClose: () => void;
  listing: Listing | null;
}

export function ListingSpecsDetailModal({
  open,
  onClose,
  listing,
}: ListingSpecsDetailModalProps) {
  if (!listing) return null;

  const isVehicle = listing.category === 'Vehículos y Motos' && listing.vehicleDetails;
  const isRealEstate = listing.category === 'Inmuebles' && listing.realEstateDetails;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      zIndexClass="z-[60]"
      title={isVehicle ? 'Ficha técnica del vehículo' : 'Especificaciones del inmueble'}
      subtitle={listing.subcategory ? `${listing.category} · ${listing.subcategory}` : listing.category}
    >
      <div className="space-y-4">
        {isVehicle && listing.vehicleDetails && (
          <div className="grid grid-cols-2 gap-2.5">
            {listing.vehicleDetails.brand && (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-[#6B4E8E]" /> Marca
                </p>
                <p className="text-sm font-bold text-[#141118] mt-0.5">
                  {listing.vehicleDetails.brand}
                </p>
              </div>
            )}
            {listing.vehicleDetails.model && (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-[#6B4E8E]" /> Modelo
                </p>
                <p className="text-sm font-bold text-[#141118] mt-0.5">
                  {listing.vehicleDetails.model}
                </p>
              </div>
            )}
            {listing.vehicleDetails.year && (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#6B4E8E]" /> Año
                </p>
                <p className="text-sm font-bold text-[#141118] tabular-nums mt-0.5">
                  {listing.vehicleDetails.year}
                </p>
              </div>
            )}
            {typeof listing.vehicleDetails.mileageKm === 'number' && (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-[#6B4E8E]" /> Kilometraje
                </p>
                <p className="text-sm font-bold text-[#141118] tabular-nums mt-0.5">
                  {listing.vehicleDetails.mileageKm.toLocaleString('es-VE')} km
                </p>
              </div>
            )}
            {listing.vehicleDetails.transmission && (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Settings2 className="w-3.5 h-3.5 text-[#6B4E8E]" /> Transmisión
                </p>
                <p className="text-sm font-bold text-[#141118] mt-0.5">
                  {listing.vehicleDetails.transmission}
                </p>
              </div>
            )}
            {listing.vehicleDetails.fuel && (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-[#6B4E8E]" /> Combustible
                </p>
                <p className="text-sm font-bold text-[#141118] mt-0.5">
                  {listing.vehicleDetails.fuel}
                </p>
              </div>
            )}
            {listing.vehicleDetails.documents && (
              <div className="col-span-2 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-[#6B4E8E]" /> Documentación
                </p>
                <p className="text-sm font-bold text-[#141118] mt-0.5">
                  {listing.vehicleDetails.documents}
                </p>
              </div>
            )}
          </div>
        )}

        {isRealEstate && listing.realEstateDetails && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {typeof listing.realEstateDetails.areaSqm === 'number' && (
                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <Maximize2 className="w-3.5 h-3.5 text-[#6B4E8E]" /> Superficie
                  </p>
                  <p className="text-sm font-bold text-[#141118] tabular-nums mt-0.5">
                    {listing.realEstateDetails.areaSqm.toLocaleString('es-VE')} m²
                  </p>
                </div>
              )}
              {typeof listing.realEstateDetails.bedrooms === 'number' && (
                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <BedDouble className="w-3.5 h-3.5 text-[#6B4E8E]" /> Habitaciones
                  </p>
                  <p className="text-sm font-bold text-[#141118] tabular-nums mt-0.5">
                    {listing.realEstateDetails.bedrooms}
                  </p>
                </div>
              )}
              {typeof listing.realEstateDetails.bathrooms === 'number' && (
                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5 text-[#6B4E8E]" /> Baños
                  </p>
                  <p className="text-sm font-bold text-[#141118] tabular-nums mt-0.5">
                    {listing.realEstateDetails.bathrooms}
                  </p>
                </div>
              )}
              {typeof listing.realEstateDetails.parkingSpaces === 'number' && (
                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <ParkingCircle className="w-3.5 h-3.5 text-[#6B4E8E]" /> Estacionamiento
                  </p>
                  <p className="text-sm font-bold text-[#141118] tabular-nums mt-0.5">
                    {listing.realEstateDetails.parkingSpaces}{' '}
                    {listing.realEstateDetails.parkingSpaces === 1 ? 'puesto' : 'puestos'}
                  </p>
                </div>
              )}
              {listing.realEstateDetails.legalStatus && (
                <div className="col-span-2 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-[#6B4E8E]" /> Documentación / Modalidad
                  </p>
                  <p className="text-sm font-bold text-[#141118] mt-0.5">
                    {listing.realEstateDetails.legalStatus}
                  </p>
                </div>
              )}
            </div>

            {listing.realEstateDetails.amenities &&
              listing.realEstateDetails.amenities.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-2">
                  <p className="text-xs font-semibold text-zinc-600">Servicios y extras</p>
                  <div className="flex flex-wrap gap-1.5">
                    {listing.realEstateDetails.amenities.map((a) => (
                      <span
                        key={a}
                        className="px-2.5 py-1 rounded-xl bg-white border border-zinc-200 text-xs font-medium text-[#141118]"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        <div className="rounded-2xl bg-[#F6F1FC] border border-[#362B3D]/12 px-3.5 py-2.5 text-center">
          <p className="text-xs font-semibold text-[#2A2130]">
            Precio neto en USD ($ {listing.priceUsd.toLocaleString('es-VE')}) · Sin conversión a Bs.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
