import React, { ReactNode } from 'react';
import { AnimatePresence, motion, PanInfo } from 'motion/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  maxHeightClass?: string;
  zIndexClass?: string;
  aboveDock?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxHeightClass,
  zIndexClass,
  aboveDock = false,
}: BottomSheetProps) {
  const resolvedZIndex = zIndexClass ?? (aboveDock ? 'z-[35]' : 'z-50');
  const resolvedMaxHeight =
    maxHeightClass ??
    (aboveDock
      ? 'max-h-[calc(100dvh-84px-env(safe-area-inset-bottom,0px))]'
      : 'max-h-[88dvh]');

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 85 || info.velocity.y > 420) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className={
            aboveDock
              ? `fixed inset-x-0 top-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] ${resolvedZIndex} flex items-end justify-center sm:px-4`
              : `fixed inset-0 ${resolvedZIndex} flex items-end justify-center sm:items-center sm:p-4`
          }
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45"
          />

          <motion.div
            initial={{ y: '24%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '20%', opacity: 0 }}
            transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.45 }}
            onDragEnd={handleDragEnd}
            className={`relative z-10 w-full sm:max-w-lg ${resolvedMaxHeight} bg-white ${
              aboveDock ? 'rounded-t-[28px]' : 'rounded-t-[28px] sm:rounded-[28px]'
            } shadow-[0_-12px_48px_rgba(20,17,24,0.16)] flex flex-col overflow-hidden will-change-transform`}
          >
            {/* Drag handle affordance */}
            <div className="pt-3 pb-1.5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1.5 rounded-full bg-zinc-200" />
            </div>

            {(title || subtitle) && (
              <div className="px-5 pb-3 pt-1 flex items-center justify-between border-b border-zinc-100 shrink-0">
                <div className="min-w-0 pr-3">
                  {title && (
                    <h2 className="font-display text-lg font-bold text-[#141118] truncate">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="min-w-[40px] min-h-[40px] rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-600 flex items-center justify-center transition-colors active:scale-95 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div
              className={`flex-1 overflow-y-auto overscroll-contain px-5 py-4 ${
                aboveDock ? 'pb-6' : 'pb-safe'
              }`}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
