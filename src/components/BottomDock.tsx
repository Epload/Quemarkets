import React from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Plus, Search, Store, User } from 'lucide-react';
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
  { id: 'market', label: 'Mercado', icon: Store },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'chats', label: 'Chats', icon: MessageCircle },
  { id: 'sell', label: 'Vender', icon: Plus },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function BottomDock({ activeTab, onSelectTab, unreadCount = 0 }: BottomDockProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-zinc-200/85 shadow-[0_-6px_28px_rgba(20,17,24,0.06)] pb-[env(safe-area-inset-bottom,0px)]">
      <nav
        aria-label="Navegación principal"
        className="w-full max-w-lg mx-auto px-2 py-1.5 grid grid-cols-5 gap-1"
      >
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isSell = item.id === 'sell';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative min-h-[52px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                isActive
                  ? 'text-white'
                  : isSell
                    ? 'text-[#362B3D] hover:bg-zinc-100/70'
                    : 'text-zinc-500 hover:text-[#141118] hover:bg-zinc-100/60'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="dock-active-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-2xl bg-[#362B3D] shadow-xs"
                />
              )}

              <span className="relative z-10 flex items-center justify-center">
                <Icon className="w-[19px] h-[19px]" />
                {item.id === 'chats' && unreadCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center ${
                      isActive ? 'bg-white text-[#362B3D]' : 'bg-[#362B3D] text-white'
                    }`}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>

              <span className="relative z-10 text-[10.5px] font-semibold tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
