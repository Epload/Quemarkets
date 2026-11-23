import { CityLocation, Listing } from '../types/marketplace';

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

export const BASE_CATEGORIES = [
  'Tecnología',
  'Hogar',
  'Vehículos',
  'Moda',
  'Deportes',
  'Servicios',
] as const;

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

export function buildSeedListings(userCity: CityLocation): Listing[] {
  const now = Date.now();
  return [
    {
      id: 'seed_iphone_15_pro',
      sellerId: 'seller_carlos_mcy',
      sellerName: 'Carlos Mendoza',
      title: 'iPhone 15 Pro 256GB Titanio',
      description:
        'Liberado de fábrica, batería al 96%, con caja original y cable USB-C. Entrega personal en centro comercial seguro.',
      priceUsd: 790,
      category: 'Tecnología',
      condition: 'Como nuevo',
      state: userCity.state,
      city: userCity.city,
      lat: userCity.lat + 0.014,
      lng: userCity.lng - 0.012,
      imageUrl: '/src/assets/images/product_iphone_pro_1795464745375.jpg',
      status: 'active',
      createdAtMs: now - 1000 * 60 * 35,
      source: 'seed',
    },
    {
      id: 'seed_cafetera_aura',
      sellerId: 'seller_valeria_mcy',
      sellerName: 'Valeria Rojas',
      title: 'Cafetera Espresso Acero 15 Bar',
      description:
        'Espumador de leche profesional y portafiltro doble. Ideal para casa u oficina, poquísimo uso.',
      priceUsd: 165,
      category: 'Hogar',
      condition: 'Nuevo',
      state: userCity.state,
      city: userCity.city,
      lat: userCity.lat - 0.022,
      lng: userCity.lng + 0.018,
      imageUrl: '/src/assets/images/product_cafetera_espresso_1795464746423.jpg',
      status: 'active',
      createdAtMs: now - 1000 * 60 * 90,
      source: 'seed',
    },
    {
      id: 'seed_casco_moto',
      sellerId: 'seller_andres_val',
      sellerName: 'Andrés Silva',
      title: 'Casco Integral Matte DOT Talla M',
      description:
        'Visor polarizado anti-rayas, ventilación superior y broche micrométrico. Totalmente nuevo en su funda.',
      priceUsd: 95,
      category: 'Vehículos',
      condition: 'Nuevo',
      state: userCity.state === 'Carabobo' ? 'Aragua' : 'Carabobo',
      city: userCity.state === 'Carabobo' ? 'Maracay' : 'Valencia',
      lat: userCity.state === 'Carabobo' ? 10.2469 : 10.162,
      lng: userCity.state === 'Carabobo' ? -67.5958 : -67.9912,
      imageUrl: '/src/assets/images/product_moto_casco_1795464745697.jpg',
      status: 'active',
      createdAtMs: now - 1000 * 60 * 180,
      source: 'seed',
    },
    {
      id: 'seed_sneakers_sand',
      sellerId: 'seller_sofia_ccs',
      sellerName: 'Sofía Martínez',
      title: 'Zapatillas Cuero & Gamuza Talla 41',
      description:
        'Color blanco hueso con detalles en arena. Súper cómodas, suela vulcanizada original sin detalles.',
      priceUsd: 78,
      category: 'Moda',
      condition: 'Nuevo',
      state: userCity.state,
      city: userCity.city,
      lat: userCity.lat + 0.032,
      lng: userCity.lng + 0.026,
      imageUrl: '/src/assets/images/product_sneakers_urban_1795464747268.jpg',
      status: 'active',
      createdAtMs: now - 1000 * 60 * 240,
      source: 'seed',
    },
    {
      id: 'seed_macbook_air_m2',
      sellerId: 'seller_diego_ccs',
      sellerName: 'Diego Hernández',
      title: 'MacBook Air M2 13" 8GB / 256GB',
      description:
        'Plateada impecable, 42 ciclos de batería. Incluye cargador MagSafe original y funda minimalista.',
      priceUsd: 860,
      category: 'Tecnología',
      condition: 'Como nuevo',
      state: userCity.state === 'Distrito Capital' ? 'Miranda' : 'Distrito Capital',
      city: userCity.state === 'Distrito Capital' ? 'Chacao' : 'Caracas',
      lat: userCity.state === 'Distrito Capital' ? 10.4958 : 10.4806,
      lng: userCity.state === 'Distrito Capital' ? -66.8536 : -66.9036,
      imageUrl: '/src/assets/images/product_macbook_air_1795464747108.jpg',
      status: 'active',
      createdAtMs: now - 1000 * 60 * 320,
      source: 'seed',
    },
    {
      id: 'seed_bici_mtb',
      sellerId: 'seller_luis_lar',
      sellerName: 'Luis Cabrera',
      title: 'Bicicleta MTB Rin 29 Frenos Hidráulicos',
      description:
        'Cuadro de aluminio liviano talla M, transmisión 1x12 y cauchos Maxxis al 90%. Lista para rodar.',
      priceUsd: 440,
      category: 'Deportes',
      condition: 'Usado',
      state: userCity.state,
      city: userCity.city,
      lat: userCity.lat - 0.045,
      lng: userCity.lng - 0.038,
      imageUrl: '/src/assets/images/product_bicicleta_mtb_1795464747978.jpg',
      status: 'active',
      createdAtMs: now - 1000 * 60 * 480,
      source: 'seed',
    },
  ];
}
