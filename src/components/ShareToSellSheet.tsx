import React, { useEffect, useState } from 'react';
import { Check, Clock, Copy, HeartHandshake, MessageCircle, Share2 } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface ShareToSellSheetProps {
  open: boolean;
  onClose: () => void;
  unlockAtMs: number;
  onUnlocked: () => void;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ShareToSellSheet({
  open,
  onClose,
  unlockAtMs,
  onUnlocked,
}: ShareToSellSheetProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [sharingSuccess, setSharingSuccess] = useState(false);

  const rawOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isNativeOrLocalOrigin =
    !rawOrigin ||
    rawOrigin.includes('localhost') ||
    rawOrigin.startsWith('capacitor://') ||
    rawOrigin.startsWith('file://');
  const shareUrl = isNativeOrLocalOrigin
    ? import.meta.env.VITE_PUBLIC_WEB_URL || 'https://quemarket.app'
    : rawOrigin;
  const shareMessage = `¡Estoy usando Quemarket para comprar y vender directo en Venezuela! Publica gratis en segundos aquí: ${shareUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const remainingMs = Math.max(0, unlockAtMs - nowMs);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (unlockAtMs - current <= 0) {
        window.clearInterval(id);
        onUnlocked();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, unlockAtMs, onUnlocked]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback ignored if clipboard permissions are blocked
    }
  };

  const handleWhatsAppShareClick = () => {
    setSharingSuccess(true);
    window.setTimeout(() => {
      setSharingSuccess(false);
      onUnlocked();
    }, 750);
  };

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    try {
      await navigator.share({
        title: 'Quemarket — Compra y vende en Venezuela',
        text: '¡Publica en segundos y coordina tu negocio por chat al instante en Quemarket!',
        url: shareUrl,
      });
      setSharingSuccess(true);
      window.setTimeout(() => {
        setSharingSuccess(false);
        onUnlocked();
      }, 450);
    } catch {
      // User dismissed native share sheet
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} aboveDock>
      <div className="space-y-4 text-center pt-1 pb-2">
        {/* Friendly visual emblem */}
        <div className="mx-auto w-14 h-14 rounded-[20px] bg-gradient-to-br from-[#F1E8FC] to-[#E2D2F7] border border-[#362B3D]/10 flex items-center justify-center shadow-xs">
          <HeartHandshake className="w-7 h-7 text-[#362B3D]" />
        </div>

        <div className="space-y-1.5 px-1">
          <h2 className="font-display text-xl font-bold text-[#141118] text-balance">
            Ya falta poco para comenzar a vender
          </h2>
          <p className="text-sm text-[#584B63] leading-relaxed">
            Necesitamos tu ayuda para crecer. Por favor, comparte{' '}
            <strong className="text-[#141118]">Quemarket</strong> en tu{' '}
            <strong className="text-[#141118]">WhatsApp</strong> y publica al instante.
          </p>
        </div>

        {/* Ready-to-share link card */}
        <div className="rounded-2xl bg-[#FAFAFC] border border-zinc-200/80 p-3 text-left space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Enlace listo para compartir
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#2A2130] truncate select-all">
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-9 px-3 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-[#141118] inline-flex items-center gap-1.5 shrink-0 transition-colors active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#6B4E8E]" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>

        {/* WhatsApp Status CTA */}
        <div className="space-y-2 pt-0.5">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppShareClick}
            className="w-full h-13 px-5 rounded-2xl bg-[#16A34A] hover:bg-[#15803D] text-white font-display font-semibold text-[15px] flex items-center justify-center gap-2.5 shadow-[0_8px_22px_rgba(22,163,74,0.26)] active:scale-[0.98] transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            {sharingSuccess
              ? '¡Gracias por compartir! Abriendo...'
              : 'Compartir en WhatsApp'}
          </a>

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full h-11 rounded-2xl bg-[#F4EFFA] hover:bg-[#ECE2FA] text-[#362B3D] text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" />
              Compartir en otras apps
            </button>
          )}
        </div>

        {/* 30-minute fallback countdown */}
        <div className="pt-1">
          <div className="rounded-2xl bg-zinc-100/90 border border-zinc-200/70 px-4 py-3 space-y-1.5">
            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-white border border-zinc-200/80 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#6B4E8E] shrink-0" />
              <strong className="font-display text-sm font-bold text-[#141118] tabular-nums">
                {formatCountdown(remainingMs)}
              </strong>
            </div>
            <p className="text-xs text-[#584B63] leading-snug">
              Descuida, si no quieres compartir, en 30 minutos tu cuenta ya estará configurada para
              vender.
            </p>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
