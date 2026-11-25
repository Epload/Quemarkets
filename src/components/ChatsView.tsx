import React, { useEffect, useRef, useState } from 'react';
import { motion, PanInfo } from 'motion/react';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCheck,
  ExternalLink,
  ImagePlus,
  Loader2,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Send,
  ShieldAlert,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { compressImageToDataUrl } from '../lib/marketplaceService';
import { ChatMessage, ChatMessagePayload, ChatThread } from '../types/marketplace';

interface ChatsViewProps {
  currentUserId: string;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
  messagesByThread: Record<string, ChatMessage[]>;
  onSendMessage: (thread: ChatThread, payload: ChatMessagePayload) => Promise<void>;
  unreadThreadIds?: Set<string>;
  verifiedUserIds?: Set<string>;
  onDeleteThread?: (thread: ChatThread) => Promise<void> | void;
  onOpenListing?: (thread: ChatThread) => void;
}

const BUYER_QUICK_REPLIES = [
  '¿Sigue disponible?',
  '¿Aceptas Pago Móvil o Zelle?',
  '¿Dónde entregas hoy?',
];

const SELLER_QUICK_REPLIES = [
  '¡Sí, sigue disponible!',
  'Acepto Pago Móvil, Zelle y efectivo',
  '¿En qué zona puedes retirar?',
];

type ChatRoleFilter = 'buying' | 'selling';

function isSellerThread(thread: ChatThread, currentUserId: string): boolean {
  return Boolean(currentUserId) && thread.sellerId === currentUserId && thread.buyerId !== currentUserId;
}

function isBuyerThread(thread: ChatThread, currentUserId: string): boolean {
  return Boolean(currentUserId) && thread.buyerId === currentUserId && thread.sellerId !== currentUserId;
}

const WAVEFORM_BARS = [35, 68, 48, 86, 54, 92, 42, 74, 62, 95, 50, 78, 44, 88, 60, 72, 46, 82, 55, 64];

function formatChatTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

function formatAudioSeconds(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function VoiceNotePlayer({
  audioUrl,
  durationSec,
  isMine,
}: {
  audioUrl: string;
  durationSec?: number;
  isMine: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(durationSec || 0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setTotalDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setTotalDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const handlePause = () => {
      setPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      audio.playbackRate = speed;
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const progressRatio =
    totalDuration > 0 ? Math.min(1, Math.max(0, currentTime / totalDuration)) : 0;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="flex items-center gap-2.5 min-w-[210px] sm:min-w-[240px] py-0.5"
    >
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
          isMine
            ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
            : 'bg-[#362B3D] text-white hover:bg-[#2A2130]'
        }`}
      >
        {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-[3px] h-6">
          {WAVEFORM_BARS.map((heightPct, idx) => {
            const active = progressRatio > 0 && idx / WAVEFORM_BARS.length <= progressRatio;
            return (
              <span
                key={idx}
                style={{ height: `${Math.max(24, heightPct)}%` }}
                className={`w-[3px] rounded-full transition-colors ${
                  active
                    ? isMine
                      ? 'bg-[#15803D]'
                      : 'bg-[#362B3D]'
                    : isMine
                      ? 'bg-emerald-900/25'
                      : 'bg-zinc-300'
                }`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] font-medium text-zinc-600 tabular-nums">
          <span>{formatAudioSeconds(playing ? currentTime : totalDuration)}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="px-1.5 py-0.5 rounded-md bg-black/6 hover:bg-black/10 text-[10px] font-semibold text-[#141118] transition-colors"
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatsView({
  currentUserId,
  threads,
  activeThreadId,
  onSelectThread,
  messagesByThread,
  onSendMessage,
  unreadThreadIds,
  verifiedUserIds,
  onDeleteThread,
  onOpenListing,
}: ChatsViewProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [compressingImg, setCompressingImg] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [confirmDeleteThread, setConfirmDeleteThread] = useState<ChatThread | null>(null);
  const [deletingThread, setDeletingThread] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [roleFilter, setRoleFilter] = useState<ChatRoleFilter>('buying');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartMsRef = useRef<number>(0);
  const recordingCancelledRef = useRef<boolean>(false);
  const recordingIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scopedThreads = threads.filter(
    (t) => isBuyerThread(t, currentUserId) || isSellerThread(t, currentUserId)
  );
  const activeThread = scopedThreads.find((t) => t.id === activeThreadId) || null;
  const activeMessages = activeThread ? messagesByThread[activeThread.id] || [] : [];

  useEffect(() => {
    if (!activeThread) return;
    setRoleFilter(isSellerThread(activeThread, currentUserId) ? 'selling' : 'buying');
  }, [activeThread?.id, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeThreadId]);

  const stopRecordingResources = (cancel: boolean) => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    recordingCancelledRef.current = cancel;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    if (cancel && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (cancel) {
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  useEffect(() => {
    setPendingImageUrl(null);
    setMediaError('');
    stopRecordingResources(true);
    return () => {
      stopRecordingResources(true);
    };
  }, [activeThreadId]);

  const handleSendPayload = async (payload: ChatMessagePayload) => {
    if (!activeThread || sending) return;
    const cleanText = (payload.text || '').trim();
    if (!cleanText && !payload.imageUrl && !payload.audioUrl) return;
    setSending(true);
    setMediaError('');
    try {
      await onSendMessage(activeThread, {
        ...payload,
        text: cleanText,
      });
    } catch (err) {
      setMediaError(
        err instanceof Error ? err.message : 'No se pudo enviar el mensaje. Intenta nuevamente.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || sending) return;
    const textToSend = draft.trim();
    const imgToSend = pendingImageUrl;
    if (!textToSend && !imgToSend) return;

    setDraft('');
    setPendingImageUrl(null);
    await handleSendPayload({
      type: imgToSend ? 'image' : 'text',
      text: textToSend,
      ...(imgToSend ? { imageUrl: imgToSend } : {}),
    });
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMediaError('');
    setCompressingImg(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      setPendingImageUrl(compressed);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'No se pudo adjuntar la imagen.');
    } finally {
      setCompressingImg(false);
    }
  };

  const handleStartRecording = async () => {
    if (!activeThread || isRecording || sending) return;
    setMediaError('');

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMediaError('Tu navegador no permite grabar notas de voz en este entorno.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedType = preferredTypes.find(
        (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)
      );

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          ...(supportedType ? { mimeType: supportedType } : {}),
          audioBitsPerSecond: 24000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      recordingStartMsRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (recordingIntervalRef.current !== null) {
          window.clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);

        if (recordingCancelledRef.current) {
          audioChunksRef.current = [];
          setRecordingSeconds(0);
          return;
        }

        const elapsedSec = Math.max(
          1,
          Math.min(120, Math.round((Date.now() - recordingStartMsRef.current) / 1000))
        );
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || supportedType || 'audio/webm',
        });
        audioChunksRef.current = [];
        setRecordingSeconds(0);

        if (blob.size === 0) return;

        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = String(reader.result || '');
          if (!dataUrl || dataUrl.length > 348000) {
            setMediaError('Nota de voz demasiado larga; graba un audio más corto (máx. ~45s).');
            return;
          }
          await handleSendPayload({
            type: 'audio',
            audioUrl: dataUrl,
            audioDurationSec: elapsedSec,
            text: '',
          });
        };
        reader.onerror = () => {
          setMediaError('No se pudo procesar la nota de voz.');
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(250);
      recordingIntervalRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - recordingStartMsRef.current) / 1000);
        setRecordingSeconds(secs);
        if (secs >= 55) {
          stopRecordingResources(false);
        }
      }, 250);
    } catch {
      setMediaError('Activa el permiso del micrófono en tu navegador para enviar notas de voz.');
      setIsRecording(false);
    }
  };

  const handleSwipeBack = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 85 || info.velocity.x > 400) {
      onSelectThread(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteThread || !onDeleteThread || deletingThread) return;
    setDeletingThread(true);
    setDeleteError('');
    try {
      await onDeleteThread(confirmDeleteThread);
      setConfirmDeleteThread(null);
    } catch {
      setDeleteError('No se pudo eliminar este chat. Intenta nuevamente.');
    } finally {
      setDeletingThread(false);
    }
  };

  const renderDeleteModal = () => {
    if (!confirmDeleteThread) return null;
    const otherName =
      confirmDeleteThread.buyerId === currentUserId
        ? confirmDeleteThread.sellerName
        : confirmDeleteThread.buyerName;

    return (
      <div
        onClick={() => !deletingThread && setConfirmDeleteThread(null)}
        className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-white rounded-[26px] border border-zinc-200/80 shadow-2xl p-5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-[#141118]">
                ¿Eliminar conversación?
              </h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Se borrará el chat con <span className="font-semibold text-[#141118]">{otherName}</span> sobre{' '}
                <span className="font-medium text-[#141118]">{confirmDeleteThread.listingTitle}</span>.
              </p>
            </div>
          </div>

          {deleteError && (
            <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{deleteError}</p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={deletingThread}
              onClick={() => setConfirmDeleteThread(null)}
              className="flex-1 h-11 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 text-xs font-semibold text-[#141118] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={deletingThread}
              onClick={handleConfirmDelete}
              className="flex-1 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {deletingThread ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar chat'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (activeThread) {
    const selling = isSellerThread(activeThread, currentUserId);
    const otherName = selling ? activeThread.buyerName : activeThread.sellerName;
    const otherUserId = selling ? activeThread.buyerId : activeThread.sellerId;
    const isOtherVerified = Boolean(verifiedUserIds?.has(otherUserId));
    const quickReplies = selling ? SELLER_QUICK_REPLIES : BUYER_QUICK_REPLIES;
    const canSubmitTextOrImg = Boolean(draft.trim() || pendingImageUrl);

    return (
      <motion.div
        key={activeThread.id}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.35 }}
        onDragEnd={handleSwipeBack}
        className="fixed inset-0 z-50 bg-[#FAFAFC] flex flex-col"
      >
        <div className="w-full max-w-3xl mx-auto flex-1 min-h-0 flex flex-col bg-white md:border-x md:border-zinc-200/75 overflow-hidden">
          {/* WhatsApp-clean Chat Header */}
          <div className="px-3.5 py-2.5 pt-[max(env(safe-area-inset-top,0px),10px)] bg-white border-b border-zinc-100 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onSelectThread(null)}
              aria-label="Volver a conversaciones"
              className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center text-[#141118] transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenListing?.(activeThread)}
              disabled={!onOpenListing}
              aria-label={`Ver publicación: ${activeThread.listingTitle}`}
              className="relative shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#362B3D] disabled:cursor-default"
            >
              <img
                src={activeThread.listingImage}
                alt={activeThread.listingTitle}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover bg-zinc-100"
              />
              <span
                aria-hidden="true"
                className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full ring-2 ring-white flex items-center justify-center text-white ${
                  selling ? 'bg-emerald-600' : 'bg-[#6B4E8E]'
                }`}
              >
                {selling ? <Tag className="w-2.5 h-2.5" /> : <ShoppingBag className="w-2.5 h-2.5" />}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-display text-sm font-bold text-[#141118] truncate">
                  {otherName}
                </h3>
                {isOtherVerified ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <BadgeCheck className="w-3 h-3 shrink-0" />
                    Verificado
                  </span>
                ) : (
                  <span
                    title="No verificado"
                    aria-label="No verificado"
                    className="inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 bg-zinc-100 text-zinc-500 border border-zinc-200/80"
                  >
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 truncate tabular-nums">
                {activeThread.listingTitle} · ${activeThread.listingPrice.toLocaleString('es-VE')}
              </p>
            </div>

            {onOpenListing && (
              <button
                type="button"
                onClick={() => onOpenListing(activeThread)}
                title="Ver publicación"
                aria-label="Ver publicación"
                className="w-9 h-9 rounded-full bg-[#F4EFFA] hover:bg-[#EAE1F6] text-[#362B3D] border border-[#DFD2F2]/80 flex items-center justify-center transition-colors shrink-0 active:scale-95"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
              </button>
            )}

            {onDeleteThread && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setConfirmDeleteThread(activeThread);
                }}
                aria-label="Eliminar conversación"
                className="w-9 h-9 rounded-full hover:bg-rose-50 text-zinc-400 hover:text-rose-600 flex items-center justify-center transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-2.5 bg-[#F4F2F6]">
            {/* Safety Notice at top of chat background */}
            <div className="mx-auto max-w-md rounded-2xl bg-amber-50/95 border border-amber-200/80 px-3.5 py-2.5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="text-[11px] font-bold text-amber-950 flex items-center justify-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                Por tu seguridad
              </p>
              <p className="text-[11px] text-amber-900/90 leading-snug mt-0.5">
                Recuerda reunirte en lugares seguros y avisarle a algún amigo o familiar donde estarás.
              </p>
            </div>
            {activeMessages.map((msg) => {
              const isMine = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3 py-2.5 rounded-2xl text-[14px] leading-snug shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-1.5 ${
                      isMine
                        ? 'bg-[#DCFCE7] text-[#111B21] rounded-br-md'
                        : 'bg-white text-[#141118] rounded-bl-md border border-zinc-200/60'
                    }`}
                  >
                    {msg.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxImage(msg.imageUrl!)}
                        className="block w-full overflow-hidden rounded-xl bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#362B3D]"
                      >
                        <img
                          src={msg.imageUrl}
                          alt={msg.text || 'Imagen enviada en el chat'}
                          referrerPolicy="no-referrer"
                          className="max-h-[260px] w-full object-cover rounded-xl"
                        />
                      </button>
                    )}

                    {msg.audioUrl && (
                      <VoiceNotePlayer
                        audioUrl={msg.audioUrl}
                        durationSec={msg.audioDurationSec}
                        isMine={isMine}
                      />
                    )}

                    {msg.text && (
                      <p className="whitespace-pre-wrap break-words px-0.5">{msg.text}</p>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-500 tabular-nums px-0.5">
                      <span>{formatChatTime(msg.createdAtMs)}</span>
                      {isMine && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Media error banner */}
          {mediaError && (
            <div className="px-3.5 py-2 bg-rose-50 border-t border-rose-200/70 flex items-center justify-between gap-2 text-xs text-rose-700 shrink-0">
              <span>{mediaError}</span>
              <button
                type="button"
                onClick={() => setMediaError('')}
                aria-label="Cerrar aviso"
                className="p-1 rounded-lg hover:bg-rose-100 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pending Image Attachment Preview */}
          {pendingImageUrl && (
            <div className="px-3.5 py-2.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={pendingImageUrl}
                  alt="Vista previa adjunto"
                  className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#141118]">Imagen lista para enviar</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    Puedes escribir un comentario opcional o enviar directo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingImageUrl(null)}
                aria-label="Quitar imagen adjunta"
                className="w-9 h-9 rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-600 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick replies */}
          {!isRecording && !pendingImageUrl && (
            <div className="px-3 py-2 bg-white border-t border-zinc-100 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {quickReplies.map((qr) => (
                <button
                  key={qr}
                  type="button"
                  onClick={() => handleSendPayload({ type: 'text', text: qr })}
                  className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-xs font-medium text-[#141118] whitespace-nowrap shrink-0 transition-colors"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            className="hidden"
          />

          {isRecording ? (
            <div className="px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom,0px),12px)] bg-white border-t border-zinc-100 flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => stopRecordingResources(true)}
                aria-label="Cancelar nota de voz"
                className="w-11 h-11 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shrink-0 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="flex-1 h-11 px-4 rounded-full bg-rose-50/70 border border-rose-200/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <span className="text-xs font-semibold text-rose-700 truncate">
                    Grabando nota de voz...
                  </span>
                </div>
                <span className="text-xs font-bold text-rose-700 tabular-nums shrink-0">
                  {formatAudioSeconds(recordingSeconds)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => stopRecordingResources(false)}
                aria-label="Enviar nota de voz"
                className="w-11 h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmitForm}
              className="px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom,0px),12px)] bg-white border-t border-zinc-100 flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressingImg || sending}
                aria-label="Enviar imagen"
                className="w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-[#362B3D] flex items-center justify-center transition-colors active:scale-95 shrink-0 disabled:opacity-50"
              >
                {compressingImg ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-5 h-5" />
                )}
              </button>

              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={500}
                placeholder={
                  pendingImageUrl ? 'Añade un comentario (opcional)...' : 'Escribe un mensaje...'
                }
                className="flex-1 h-11 px-4 rounded-full bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
              />

              {canSubmitTextOrImg ? (
                <button
                  type="submit"
                  disabled={sending}
                  aria-label="Enviar mensaje"
                  className="w-11 h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] disabled:bg-zinc-200 disabled:text-zinc-400 text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={sending}
                  aria-label="Grabar nota de voz"
                  className="w-11 h-11 rounded-full bg-[#362B3D] hover:bg-[#2A2130] disabled:opacity-50 text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </form>
          )}
        </div>

        {/* Fullscreen Image Lightbox */}
        {lightboxImage && (
          <div
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[70] bg-black/92 flex items-center justify-center p-4"
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Cerrar imagen"
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Imagen ampliada del chat"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[85dvh] rounded-2xl object-contain"
            />
          </div>
        )}

        {renderDeleteModal()}
      </motion.div>
    );
  }

  const sellingThreads = scopedThreads.filter((t) => isSellerThread(t, currentUserId));
  const buyingThreads = scopedThreads.filter((t) => isBuyerThread(t, currentUserId));
  const sellingCount = sellingThreads.length;
  const buyingCount = buyingThreads.length;
  const hasUnreadBuying = buyingThreads.some((t) => unreadThreadIds?.has(t.id));
  const hasUnreadSelling = sellingThreads.some((t) => unreadThreadIds?.has(t.id));

  const visibleThreads = roleFilter === 'selling' ? sellingThreads : buyingThreads;

  return (
    <div className="space-y-3">

      <div
        role="tablist"
        aria-label="Filtrar conversaciones"
        className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-zinc-100/90 border border-zinc-200/60"
      >
        <button
          type="button"
          role="tab"
          aria-selected={roleFilter === 'buying'}
          onClick={() => setRoleFilter('buying')}
          className={`h-10 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            roleFilter === 'buying'
              ? 'bg-[#362B3D] text-white shadow-sm'
              : 'text-zinc-600 hover:text-[#141118]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Mis compras</span>
          <span className="text-[11px] opacity-75 tabular-nums">{buyingCount}</span>
          {hasUnreadBuying && roleFilter !== 'buying' && (
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={roleFilter === 'selling'}
          onClick={() => setRoleFilter('selling')}
          className={`h-10 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            roleFilter === 'selling'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-600 hover:text-[#141118]'
          }`}
        >
          <Tag className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Mis ventas</span>
          <span className="text-[11px] opacity-75 tabular-nums">{sellingCount}</span>
          {hasUnreadSelling && roleFilter !== 'selling' && (
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          )}
        </button>
      </div>

      {scopedThreads.length === 0 ? (
        <div className="bg-white rounded-[26px] border border-zinc-200/75 p-8 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-[#F4EFFA] text-[#362B3D] mx-auto flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-[#141118]">
            Sin conversaciones aún
          </h3>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto">
            Abre cualquier publicación y envíale un mensaje directo al vendedor.
          </p>
        </div>
      ) : visibleThreads.length === 0 ? (
        <div className="bg-white rounded-[26px] border border-zinc-200/75 p-7 text-center space-y-2">
          <div
            className={`w-11 h-11 rounded-2xl mx-auto flex items-center justify-center ${
              roleFilter === 'selling'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-[#F4EFFA] text-[#583E76]'
            }`}
          >
            {roleFilter === 'selling' ? (
              <Tag className="w-5 h-5" />
            ) : (
              <ShoppingBag className="w-5 h-5" />
            )}
          </div>
          <p className="font-display text-sm font-bold text-[#141118]">
            {roleFilter === 'selling'
              ? 'Sin mensajes en tus publicaciones'
              : 'No has consultado productos aún'}
          </p>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            {roleFilter === 'selling'
              ? 'Cuando alguien te escriba por un artículo que publicaste aparecerá aquí.'
              : 'Cuando escribas a un vendedor desde una publicación aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[26px] border border-zinc-200/75 divide-y divide-zinc-100 overflow-hidden">
          {visibleThreads.map((thread) => {
            const selling = isSellerThread(thread, currentUserId);
            const otherName = selling ? thread.buyerName : thread.sellerName;
            const otherUserId = selling ? thread.buyerId : thread.sellerId;
            const isOtherVerified = Boolean(verifiedUserIds?.has(otherUserId));
            const isUnread = Boolean(unreadThreadIds?.has(thread.id));
            return (
              <div
                key={thread.id}
                className={`flex items-center hover:bg-zinc-50 transition-colors border-l-[3.5px] ${
                  selling ? 'border-l-emerald-500' : 'border-l-[#6B4E8E]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className="flex-1 min-w-0 pl-3.5 pr-2 py-3.5 flex items-center gap-3.5 text-left active:bg-zinc-100/70"
                >
                  <div className="relative shrink-0">
                    <img
                      src={thread.listingImage}
                      alt={thread.listingTitle}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-cover bg-zinc-100"
                    />
                    <span
                      title={selling ? 'Te escriben por tu publicación' : 'Escribiste por este producto'}
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ring-2 ring-white flex items-center justify-center text-white shadow-xs ${
                        selling ? 'bg-emerald-600' : 'bg-[#6B4E8E]'
                      }`}
                    >
                      {selling ? (
                        <Tag className="w-2.5 h-2.5" />
                      ) : (
                        <ShoppingBag className="w-2.5 h-2.5" />
                      )}
                    </span>
                    {isUnread && (
                      <span
                        aria-label="Mensaje sin leer"
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-display text-sm font-bold text-[#141118] truncate">
                          {otherName}
                        </p>
                        {isOtherVerified ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <BadgeCheck className="w-3 h-3 shrink-0" />
                            Verificado
                          </span>
                        ) : (
                          <span
                            title="No verificado"
                            aria-label="No verificado"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 bg-zinc-100 text-zinc-500 border border-zinc-200/80"
                          >
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] tabular-nums shrink-0 ${
                          isUnread ? 'text-red-600 font-semibold' : 'text-zinc-400'
                        }`}
                      >
                        {formatChatTime(thread.lastMessageAtMs)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#362B3D] truncate mt-0.5">
                      {thread.listingTitle} · ${thread.listingPrice.toLocaleString('es-VE')}
                    </p>
                    <p
                      className={`text-xs truncate mt-0.5 ${
                        isUnread ? 'text-[#141118] font-semibold' : 'text-zinc-500'
                      }`}
                    >
                      {thread.lastMessage}
                    </p>
                  </div>
                </button>

                {onDeleteThread && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteError('');
                      setConfirmDeleteThread(thread);
                    }}
                    aria-label={`Eliminar chat con ${otherName}`}
                    className="mr-2.5 w-9 h-9 rounded-full text-zinc-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {renderDeleteModal()}
    </div>
  );
}
