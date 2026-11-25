import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CreditCard,
  ImagePlus,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { compressListingPhotoToDataUrl } from '../lib/marketplaceService';
import { BottomSheet } from './BottomSheet';

interface IdentityVerificationSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { selfieUrl: string; idCardUrl: string }) => Promise<void>;
  rejectionReason?: string;
}

export function IdentityVerificationSheet({
  open,
  onClose,
  onSubmit,
  rejectionReason,
}: IdentityVerificationSheetProps) {
  const [selfieUrl, setSelfieUrl] = useState('');
  const [idCardUrl, setIdCardUrl] = useState('');
  const [processingSlot, setProcessingSlot] = useState<'selfie' | 'idCard' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selfieCameraRef = useRef<HTMLInputElement | null>(null);
  const selfieGalleryRef = useRef<HTMLInputElement | null>(null);
  const idCardCameraRef = useRef<HTMLInputElement | null>(null);
  const idCardGalleryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setError('');
      setProcessingSlot(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleFileChange = async (
    slot: 'selfie' | 'idCard',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setProcessingSlot(slot);
    try {
      const compressed = await compressListingPhotoToDataUrl(file);
      if (slot === 'selfie') {
        setSelfieUrl(compressed);
      } else {
        setIdCardUrl(compressed);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar la foto seleccionada. Intenta con otra imagen.'
      );
    } finally {
      setProcessingSlot(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfieUrl || !idCardUrl || submitting || processingSlot) return;

    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ selfieUrl, idCardUrl });
      setSelfieUrl('');
      setIdCardUrl('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar tu solicitud. Intenta nuevamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(selfieUrl && idCardUrl && !submitting && !processingSlot);

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Verificar mi identidad"
      subtitle="Envía tu selfie y foto de cédula para revisión de administración"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {rejectionReason && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200/80 px-3.5 py-2.5 text-xs text-rose-800 leading-relaxed">
            <span className="font-bold">Motivo anterior:</span> {rejectionReason}
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={selfieCameraRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={(e) => void handleFileChange('selfie', e)}
          className="hidden"
        />
        <input
          ref={selfieGalleryRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handleFileChange('selfie', e)}
          className="hidden"
        />
        <input
          ref={idCardCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void handleFileChange('idCard', e)}
          className="hidden"
        />
        <input
          ref={idCardGalleryRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handleFileChange('idCard', e)}
          className="hidden"
        />

        {/* Step 1: Selfie */}
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs font-bold text-[#141118]">
                  1. Selfie de tu rostro
                </p>
                <p className="text-[11px] text-zinc-500">
                  Con buena luz y sin lentes oscuros ni gorra
                </p>
              </div>
            </div>
            {selfieUrl && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          </div>

          {selfieUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-white">
              <img
                src={selfieUrl}
                alt="Vista previa de tu selfie"
                className="w-full h-44 object-cover"
              />
              <button
                type="button"
                onClick={() => setSelfieUrl('')}
                disabled={submitting}
                aria-label="Quitar selfie"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={processingSlot !== null || submitting}
                onClick={() => selfieCameraRef.current?.click()}
                className="h-11 px-3 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {processingSlot === 'selfie' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                Tomar selfie
              </button>
              <button
                type="button"
                disabled={processingSlot !== null || submitting}
                onClick={() => selfieGalleryRef.current?.click()}
                className="h-11 px-3 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-[#141118] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4" />
                Subir foto
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Cédula */}
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#F4EFFA] text-[#362B3D] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs font-bold text-[#141118]">
                  2. Foto de tu cédula de identidad
                </p>
                <p className="text-[11px] text-zinc-500">
                  Asegúrate de que tu foto y datos se lean claramente
                </p>
              </div>
            </div>
            {idCardUrl && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          </div>

          {idCardUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-white">
              <img
                src={idCardUrl}
                alt="Vista previa de tu cédula"
                className="w-full h-44 object-cover"
              />
              <button
                type="button"
                onClick={() => setIdCardUrl('')}
                disabled={submitting}
                aria-label="Quitar foto de cédula"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={processingSlot !== null || submitting}
                onClick={() => idCardCameraRef.current?.click()}
                className="h-11 px-3 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {processingSlot === 'idCard' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                Tomar foto
              </button>
              <button
                type="button"
                disabled={processingSlot !== null || submitting}
                onClick={() => idCardGalleryRef.current?.click()}
                className="h-11 px-3 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-[#141118] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4" />
                Subir foto
              </button>
            </div>
          )}
        </div>

        {/* Privacy notice */}
        <div className="rounded-2xl bg-[#F4EFFA]/80 border border-[#DFD2F2] px-3.5 py-2.5 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-[#6B4E8E] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#42374C] leading-relaxed">
            Tus fotos son privadas y solo podrán ser vistas por administración para validar tu
            identidad. Ningún otro usuario tendrá acceso a ellas.
          </p>
        </div>

        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-12 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-display font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando solicitud...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Enviar para verificación
            </>
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
