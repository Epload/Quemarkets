import { CityLocation } from '../types/marketplace';

export interface VenezuelaState {
  state: string;
  cities: CityLocation[];
}

export const VENEZUELA_STATES: VenezuelaState[] = [
  {
    state: 'Aragua',
    cities: [
      { city: 'Maracay', state: 'Aragua', lat: 10.2469, lng: -67.5958 },
      { city: 'Turmero', state: 'Aragua', lat: 10.2286, lng: -67.4742 },
      { city: 'La Victoria', state: 'Aragua', lat: 10.2183, lng: -67.3336 },
      { city: 'Cagua', state: 'Aragua', lat: 10.1864, lng: -67.4594 },
    ],
  },
  {
    state: 'Distrito Capital',
    cities: [
      { city: 'Caracas', state: 'Distrito Capital', lat: 10.4806, lng: -66.9036 },
    ],
  },
  {
    state: 'Miranda',
    cities: [
      { city: 'Chacao', state: 'Miranda', lat: 10.4958, lng: -66.8536 },
      { city: 'Baruta', state: 'Miranda', lat: 10.4333, lng: -66.875 },
      { city: 'Los Teques', state: 'Miranda', lat: 10.3445, lng: -67.0432 },
      { city: 'Guarenas', state: 'Miranda', lat: 10.4675, lng: -66.6164 },
    ],
  },
  {
    state: 'Carabobo',
    cities: [
      { city: 'Valencia', state: 'Carabobo', lat: 10.162, lng: -67.9912 },
      { city: 'Naguanagua', state: 'Carabobo', lat: 10.2647, lng: -68.0128 },
      { city: 'Puerto Cabello', state: 'Carabobo', lat: 10.4731, lng: -68.0125 },
      { city: 'Guacara', state: 'Carabobo', lat: 10.2261, lng: -67.877 },
    ],
  },
  {
    state: 'Zulia',
    cities: [
      { city: 'Maracaibo', state: 'Zulia', lat: 10.6545, lng: -71.6395 },
      { city: 'San Francisco', state: 'Zulia', lat: 10.5833, lng: -71.6333 },
      { city: 'Cabimas', state: 'Zulia', lat: 10.3883, lng: -71.4399 },
    ],
  },
  {
    state: 'Lara',
    cities: [
      { city: 'Barquisimeto', state: 'Lara', lat: 10.0678, lng: -69.3474 },
      { city: 'Cabudare', state: 'Lara', lat: 10.0333, lng: -69.2667 },
      { city: 'Carora', state: 'Lara', lat: 10.1755, lng: -70.0827 },
    ],
  },
  {
    state: 'Anzoátegui',
    cities: [
      { city: 'Lechería', state: 'Anzoátegui', lat: 10.1931, lng: -64.6967 },
      { city: 'Barcelona', state: 'Anzoátegui', lat: 10.1333, lng: -64.6833 },
      { city: 'Puerto La Cruz', state: 'Anzoátegui', lat: 10.2167, lng: -64.6333 },
      { city: 'El Tigre', state: 'Anzoátegui', lat: 8.889, lng: -64.2525 },
    ],
  },
  {
    state: 'Mérida',
    cities: [
      { city: 'Mérida', state: 'Mérida', lat: 8.5897, lng: -71.1561 },
      { city: 'Ejido', state: 'Mérida', lat: 8.5467, lng: -71.2408 },
      { city: 'El Vigía', state: 'Mérida', lat: 8.6137, lng: -71.6528 },
    ],
  },
  {
    state: 'Táchira',
    cities: [
      { city: 'San Cristóbal', state: 'Táchira', lat: 7.7669, lng: -72.225 },
      { city: 'Táriba', state: 'Táchira', lat: 7.8167, lng: -72.2167 },
    ],
  },
  {
    state: 'Bolívar',
    cities: [
      { city: 'Puerto Ordaz', state: 'Bolívar', lat: 8.2969, lng: -62.7422 },
      { city: 'Ciudad Bolívar', state: 'Bolívar', lat: 8.1292, lng: -63.5409 },
    ],
  },
  {
    state: 'Nueva Esparta',
    cities: [
      { city: 'Porlamar', state: 'Nueva Esparta', lat: 10.9577, lng: -63.8491 },
      { city: 'Pampatar', state: 'Nueva Esparta', lat: 10.9969, lng: -63.7972 },
    ],
  },
  {
    state: 'Falcón',
    cities: [
      { city: 'Coro', state: 'Falcón', lat: 11.4045, lng: -69.6734 },
      { city: 'Punto Fijo', state: 'Falcón', lat: 11.6956, lng: -70.1996 },
    ],
  },
  {
    state: 'Sucre',
    cities: [
      { city: 'Cumaná', state: 'Sucre', lat: 10.4539, lng: -64.1826 },
      { city: 'Carúpano', state: 'Sucre', lat: 10.6678, lng: -63.2585 },
    ],
  },
  {
    state: 'Monagas',
    cities: [
      { city: 'Maturín', state: 'Monagas', lat: 9.7457, lng: -63.1832 },
    ],
  },
  {
    state: 'Barinas',
    cities: [
      { city: 'Barinas', state: 'Barinas', lat: 8.6226, lng: -70.2075 },
    ],
  },
  {
    state: 'Portuguesa',
    cities: [
      { city: 'Acarigua', state: 'Portuguesa', lat: 9.5545, lng: -69.1956 },
      { city: 'Guanare', state: 'Portuguesa', lat: 9.0418, lng: -69.7421 },
    ],
  },
  {
    state: 'Trujillo',
    cities: [
      { city: 'Valera', state: 'Trujillo', lat: 9.3178, lng: -70.6036 },
      { city: 'Trujillo', state: 'Trujillo', lat: 9.3667, lng: -70.4331 },
    ],
  },
  {
    state: 'La Guaira',
    cities: [
      { city: 'La Guaira', state: 'La Guaira', lat: 10.599, lng: -66.9332 },
      { city: 'Catia La Mar', state: 'La Guaira', lat: 10.6038, lng: -67.0303 },
    ],
  },
  {
    state: 'Guárico',
    cities: [
      { city: 'San Juan de los Morros', state: 'Guárico', lat: 9.9115, lng: -67.3538 },
      { city: 'Calabozo', state: 'Guárico', lat: 8.9242, lng: -67.4293 },
    ],
  },
  {
    state: 'Yaracuy',
    cities: [
      { city: 'San Felipe', state: 'Yaracuy', lat: 10.3399, lng: -68.7425 },
    ],
  },
  {
    state: 'Cojedes',
    cities: [
      { city: 'San Carlos', state: 'Cojedes', lat: 9.6612, lng: -68.5827 },
    ],
  },
  {
    state: 'Apure',
    cities: [
      { city: 'San Fernando de Apure', state: 'Apure', lat: 7.8878, lng: -67.4724 },
    ],
  },
  {
    state: 'Delta Amacuro',
    cities: [
      { city: 'Tucupita', state: 'Delta Amacuro', lat: 9.0581, lng: -62.05 },
    ],
  },
  {
    state: 'Amazonas',
    cities: [
      { city: 'Puerto Ayacucho', state: 'Amazonas', lat: 5.6639, lng: -67.6236 },
    ],
  },
];

export const ALL_CITIES: CityLocation[] = VENEZUELA_STATES.flatMap((s) => s.cities);

export const DEFAULT_CITY: CityLocation = {
  city: 'Maracay',
  state: 'Aragua',
  lat: 10.2469,
  lng: -67.5958,
};

export interface MarketplaceSubcategory {
  id: string;
  slug: string;
  name: string;
}

export interface MarketplaceCategory {
  id: string;
  slug: string;
  name: string;
  subcategories: readonly MarketplaceSubcategory[];
}

export const MARKETPLACE_CATEGORIES = [
  {
    id: 'vehiculos-y-motos',
    slug: 'vehiculos-y-motos',
    name: 'Vehículos y Motos',
    subcategories: [
      { id: 'carros', slug: 'carros', name: 'Carros' },
      { id: 'camionetas', slug: 'camionetas', name: 'Camionetas' },
      { id: 'motos', slug: 'motos', name: 'Motos' },
      { id: 'bicimotos-y-e-bikes', slug: 'bicimotos-y-e-bikes', name: 'Bicimotos y E-bikes' },
      { id: 'repuestos-y-cauchos', slug: 'repuestos-y-cauchos', name: 'Repuestos y Cauchos' },
    ],
  },
  {
    id: 'telefonos-y-tablets',
    slug: 'telefonos-y-tablets',
    name: 'Teléfonos y Tablets',
    subcategories: [
      { id: 'smartphones', slug: 'smartphones', name: 'Smartphones' },
      { id: 'tablets', slug: 'tablets', name: 'Tablets' },
      { id: 'accesorios-y-cargadores', slug: 'accesorios-y-cargadores', name: 'Accesorios y Cargadores' },
      { id: 'repuestos-y-pantallas', slug: 'repuestos-y-pantallas', name: 'Repuestos y Pantallas' },
    ],
  },
  {
    id: 'computacion-y-gaming',
    slug: 'computacion-y-gaming',
    name: 'Computación y Gaming',
    subcategories: [
      { id: 'laptops', slug: 'laptops', name: 'Laptops' },
      { id: 'pc-de-escritorio', slug: 'pc-de-escritorio', name: 'PC de escritorio' },
      { id: 'consolas-y-videojuegos', slug: 'consolas-y-videojuegos', name: 'Consolas y Videojuegos' },
      { id: 'componentes', slug: 'componentes', name: 'Componentes' },
      { id: 'redes-e-internet', slug: 'redes-e-internet', name: 'Redes e Internet' },
    ],
  },
  {
    id: 'energia-y-respaldo',
    slug: 'energia-y-respaldo',
    name: 'Energía y Respaldo',
    subcategories: [
      { id: 'plantas-electricas', slug: 'plantas-electricas', name: 'Plantas eléctricas' },
      { id: 'inversores', slug: 'inversores', name: 'Inversores' },
      { id: 'baterias', slug: 'baterias', name: 'Baterías' },
      { id: 'paneles-solares', slug: 'paneles-solares', name: 'Paneles solares' },
      { id: 'protectores-de-voltaje', slug: 'protectores-de-voltaje', name: 'Protectores de voltaje' },
    ],
  },
  {
    id: 'hogar-y-electrodomesticos',
    slug: 'hogar-y-electrodomesticos',
    name: 'Hogar y Electrodomésticos',
    subcategories: [
      { id: 'linea-blanca', slug: 'linea-blanca', name: 'Línea blanca' },
      { id: 'aires-acondicionados', slug: 'aires-acondicionados', name: 'Aires acondicionados' },
      { id: 'muebles', slug: 'muebles', name: 'Muebles' },
      { id: 'cocina', slug: 'cocina', name: 'Cocina' },
      { id: 'decoracion', slug: 'decoracion', name: 'Decoración' },
    ],
  },
  {
    id: 'moda-y-calzado',
    slug: 'moda-y-calzado',
    name: 'Moda y Calzado',
    subcategories: [
      { id: 'ropa-de-dama', slug: 'ropa-de-dama', name: 'Ropa de dama' },
      { id: 'ropa-de-caballero', slug: 'ropa-de-caballero', name: 'Ropa de caballero' },
      { id: 'ninos-y-bebes', slug: 'ninos-y-bebes', name: 'Niños y Bebés' },
      { id: 'calzado-y-sneakers', slug: 'calzado-y-sneakers', name: 'Calzado y Sneakers' },
      { id: 'relojes-y-accesorios', slug: 'relojes-y-accesorios', name: 'Relojes y Accesorios' },
    ],
  },
  {
    id: 'salud-y-belleza',
    slug: 'salud-y-belleza',
    name: 'Salud y Belleza',
    subcategories: [
      { id: 'maquillaje', slug: 'maquillaje', name: 'Maquillaje' },
      { id: 'cuidado-de-la-piel', slug: 'cuidado-de-la-piel', name: 'Cuidado de la piel' },
      { id: 'barberia-y-peluqueria', slug: 'barberia-y-peluqueria', name: 'Barbería y Peluquería' },
      { id: 'suplementos', slug: 'suplementos', name: 'Suplementos' },
      { id: 'equipos-medicos', slug: 'equipos-medicos', name: 'Equipos médicos' },
    ],
  },
  {
    id: 'inmuebles',
    slug: 'inmuebles',
    name: 'Inmuebles',
    subcategories: [
      { id: 'alquiler-residencial', slug: 'alquiler-residencial', name: 'Alquiler residencial' },
      { id: 'venta-de-casas-y-apartamentos', slug: 'venta-de-casas-y-apartamentos', name: 'Venta de casas y apartamentos' },
      { id: 'locales-comerciales', slug: 'locales-comerciales', name: 'Locales comerciales' },
      { id: 'terrenos', slug: 'terrenos', name: 'Terrenos' },
      { id: 'habitaciones', slug: 'habitaciones', name: 'Habitaciones' },
    ],
  },
  {
    id: 'herramientas-e-industria',
    slug: 'herramientas-e-industria',
    name: 'Herramientas e Industria',
    subcategories: [
      { id: 'herramientas-electricas-y-manuales', slug: 'herramientas-electricas-y-manuales', name: 'Herramientas eléctricas y manuales' },
      { id: 'equipos-de-taller', slug: 'equipos-de-taller', name: 'Equipos de taller' },
      { id: 'construccion', slug: 'construccion', name: 'Construcción' },
      { id: 'maquinaria-agricola', slug: 'maquinaria-agricola', name: 'Maquinaria agrícola' },
    ],
  },
  {
    id: 'deportes-y-aire-libre',
    slug: 'deportes-y-aire-libre',
    name: 'Deportes y Aire Libre',
    subcategories: [
      { id: 'bicicletas', slug: 'bicicletas', name: 'Bicicletas' },
      { id: 'gimnasio-y-pesas', slug: 'gimnasio-y-pesas', name: 'Gimnasio y pesas' },
      { id: 'camping-y-pesca', slug: 'camping-y-pesca', name: 'Camping y Pesca' },
      { id: 'ropa-deportiva', slug: 'ropa-deportiva', name: 'Ropa deportiva' },
    ],
  },
  {
    id: 'mascotas',
    slug: 'mascotas',
    name: 'Mascotas',
    subcategories: [
      { id: 'alimentos', slug: 'alimentos', name: 'Alimentos' },
      { id: 'accesorios', slug: 'accesorios', name: 'Accesorios' },
      { id: 'camas-y-jaulas', slug: 'camas-y-jaulas', name: 'Camas y jaulas' },
      { id: 'higiene-y-salud', slug: 'higiene-y-salud', name: 'Higiene y salud' },
    ],
  },
  {
    id: 'servicios-y-oficios',
    slug: 'servicios-y-oficios',
    name: 'Servicios y Oficios',
    subcategories: [
      { id: 'mecanica-y-latoneria', slug: 'mecanica-y-latoneria', name: 'Mecánica y latonería' },
      { id: 'refrigeracion', slug: 'refrigeracion', name: 'Refrigeración' },
      { id: 'reparacion-de-celulares-y-pc', slug: 'reparacion-de-celulares-y-pc', name: 'Reparación de celulares y PC' },
      { id: 'fletes-y-mudanzas', slug: 'fletes-y-mudanzas', name: 'Fletes y mudanzas' },
      { id: 'diseno-y-web', slug: 'diseno-y-web', name: 'Diseño y Web' },
    ],
  },
] as const satisfies readonly MarketplaceCategory[];

export const BASE_CATEGORIES = [
  'Vehículos y Motos',
  'Teléfonos y Tablets',
  'Computación y Gaming',
  'Energía y Respaldo',
  'Hogar y Electrodomésticos',
  'Moda y Calzado',
  'Salud y Belleza',
  'Inmuebles',
  'Herramientas e Industria',
  'Deportes y Aire Libre',
  'Mascotas',
  'Servicios y Oficios',
] as const;

export const SUBCATEGORIES_BY_CATEGORY: Record<string, readonly MarketplaceSubcategory[]> =
  Object.fromEntries(MARKETPLACE_CATEGORIES.map((cat) => [cat.name, cat.subcategories]));

export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function findNearestVenezuelanCity(lat: number, lng: number): CityLocation {
  let nearest = DEFAULT_CITY;
  let minDist = Infinity;
  for (const c of ALL_CITIES) {
    const d = getDistanceKm(lat, lng, c.lat, c.lng);
    if (d < minDist) {
      minDist = d;
      nearest = c;
    }
  }
  return nearest;
}
