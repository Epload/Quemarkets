import React from 'react';
import { motion } from 'motion/react';
import { DollarSign, MessageCircle, Search, Store, User } from 'lucide-react';
import { DockTab } from '../types/marketplace';

interface BottomDockProps {
  activeTab: DockTab;
  onSelectTab: (tab: DockTab) => void;
  unreadCount?: number;
}

const DOCK_ITEMS: {
  id: DockTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'market', label: 'Market', icon: Store },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'sell', label: 'Vender', icon: DollarSign },
  { id: 'chats', label: 'Chats', icon: MessageCircle },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function BottomDock({ activeTab, onSelectTab, unreadCount = 0 }: BottomDockProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none drop-shadow-[0_-10px_28px_rgba(16,12,22,0.26)]">
      <div className="relative pt-6 bg-[#1B1622] pb-[env(safe-area-inset-bottom,0px)] dock-upward-corners">
        {/* Upward-curving top border highlight */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="absolute top-0 left-0 w-6 h-6 pointer-events-none"
        >
          <path
            d="M 0 0 A 24 24 0 0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.25"
          />
        </svg>
        <div
          aria-hidden="true"
          className="absolute top-6 left-6 right-6 h-px bg-white/14 pointer-events-none"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="absolute top-0 right-0 w-6 h-6 pointer-events-none"
        >
          <path
            d="M 24 0 A 24 24 0 0 1 0 24"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.25"
          />
        </svg>

        <nav
          aria-label="Navegación principal"
          className="pointer-events-auto w-full max-w-lg mx-auto px-2 py-1.5 grid grid-cols-5 gap-1"
        >
          {DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isSell = item.id === 'sell';

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(item.id)}
                className={`relative min-h-[52px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-[0.96] ${
                  isActive
                    ? 'text-white'
                    : isSell
                      ? 'text-white/90 hover:text-white hover:bg-white/6'
                      : 'text-white/62 hover:text-white hover:bg-white/6'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="dock-active-well"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0.5 rounded-[14px] bg-[#0F0B14] border-t border-black/85 border-x border-black/55 border-b border-b-white/14 shadow-[inset_0_3px_7px_rgba(0,0,0,0.88),inset_0_1px_2px_rgba(0,0,0,0.92),0_1px_0_rgba(255,255,255,0.08)]"
                  />
                )}

                <span
                  className={`relative z-10 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 ${
                    isActive ? 'translate-y-[1.5px] scale-[0.96]' : ''
                  }`}
                >
                  <span className="relative flex items-center justify-center">
                    <Icon className="w-[19px] h-[19px]" />
                    {item.id === 'chats' && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center shadow-xs">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </span>

                  <span className="text-[10.5px] font-semibold tracking-tight whitespace-nowrap">
                    {item.label}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
