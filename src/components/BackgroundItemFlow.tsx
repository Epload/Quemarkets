import React from 'react';
import { motion } from 'motion/react';

interface FlowCardItem {
  title: string;
  price: string;
  city: string;
  image: string;
}

const LANE_ONE: FlowCardItem[] = [
  {
    title: 'iPhone 15 Pro',
    price: '$790',
    city: 'Maracay',
    image: '/src/assets/images/product_iphone_pro_1795464745375.jpg',
  },
  {
    title: 'Cafetera Espresso',
    price: '$165',
    city: 'Caracas',
    image: '/src/assets/images/product_cafetera_espresso_1795464746423.jpg',
  },
  {
    title: 'Zapatillas Gamuza',
    price: '$78',
    city: 'Valencia',
    image: '/src/assets/images/product_sneakers_urban_1795464747268.jpg',
  },
  {
    title: 'MacBook Air M2',
    price: '$860',
    city: 'Chacao',
    image: '/src/assets/images/product_macbook_air_1795464747108.jpg',
  },
];

const LANE_TWO: FlowCardItem[] = [
  {
    title: 'Casco Matte DOT',
    price: '$95',
    city: 'Valencia',
    image: '/src/assets/images/product_moto_casco_1795464745697.jpg',
  },
  {
    title: 'Bicicleta MTB 29"',
    price: '$440',
    city: 'Maracay',
    image: '/src/assets/images/product_bicicleta_mtb_1795464747978.jpg',
  },
  {
    title: 'iPhone 15 Pro',
    price: '$790',
    city: 'Barquisimeto',
    image: '/src/assets/images/product_iphone_pro_1795464745375.jpg',
  },
  {
    title: 'Cafetera Espresso',
    price: '$165',
    city: 'Lechería',
    image: '/src/assets/images/product_cafetera_espresso_1795464746423.jpg',
  },
];

const LANE_THREE: FlowCardItem[] = [
  {
    title: 'MacBook Air M2',
    price: '$860',
    city: 'Caracas',
    image: '/src/assets/images/product_macbook_air_1795464747108.jpg',
  },
  {
    title: 'Zapatillas Gamuza',
    price: '$78',
    city: 'Maracay',
    image: '/src/assets/images/product_sneakers_urban_1795464747268.jpg',
  },
  {
    title: 'Bicicleta MTB 29"',
    price: '$440',
    city: 'Mérida',
    image: '/src/assets/images/product_bicicleta_mtb_1795464747978.jpg',
  },
  {
    title: 'Casco Matte DOT',
    price: '$95',
    city: 'Caracas',
    image: '/src/assets/images/product_moto_casco_1795464745697.jpg',
  },
];

function FlowLane({
  items,
  direction = 'left',
  durationSec = 28,
}: {
  items: FlowCardItem[];
  direction?: 'left' | 'right';
  durationSec?: number;
}) {
  const repeated = [...items, ...items];
  const fromX = direction === 'left' ? '0%' : '-50%';
  const toX = direction === 'left' ? '-50%' : '0%';

  return (
    <div className="overflow-hidden w-full select-none">
      <motion.div
        className="flex gap-3.5 w-max will-change-transform"
        animate={{ x: [fromX, toX] }}
        transition={{
          repeat: Infinity,
          ease: 'linear',
          duration: durationSec,
        }}
      >
        {repeated.map((item, idx) => (
          <div
            key={`${item.title}-${idx}`}
            className="w-40 sm:w-48 rounded-[22px] bg-white/85 border border-white/80 shadow-[0_8px_24px_rgba(54,43,61,0.06)] overflow-hidden shrink-0"
          >
            <div className="aspect-[4/3] w-full bg-zinc-100 overflow-hidden">
              <img
                src={item.image}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#2A2130] truncate">
                {item.title}
              </span>
              <span className="text-[11px] font-bold text-[#6B4E8E] tabular-nums shrink-0">
                {item.price}
              </span>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function BackgroundItemFlow() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Tilted flowing product lanes simulating a live video reel */}
      <div className="absolute -inset-x-16 -top-10 flex flex-col gap-4 -rotate-6 scale-105 opacity-75">
        <FlowLane items={LANE_ONE} direction="left" durationSec={30} />
        <FlowLane items={LANE_TWO} direction="right" durationSec={34} />
        <FlowLane items={LANE_THREE} direction="left" durationSec={26} />
        <FlowLane items={LANE_ONE} direction="right" durationSec={32} />
      </div>

      {/* Luminous lavender-to-white atmospheric frosted veil for crisp text legibility */}
      <div
        className="absolute inset-0 backdrop-blur-[2.5px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(237,227,249,0.74) 0%, rgba(246,241,252,0.84) 44%, rgba(255,255,255,0.97) 78%, #FFFFFF 100%)',
        }}
      />
    </div>
  );
}
