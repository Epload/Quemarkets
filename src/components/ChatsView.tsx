import React, { useEffect, useRef, useState } from 'react';
import { motion, PanInfo } from 'motion/react';
import { ArrowLeft, CheckCheck, MessageCircle, Send } from 'lucide-react';
import { ChatMessage, ChatThread } from '../types/marketplace';

interface ChatsViewProps {
  currentUserId: string;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
  messagesByThread: Record<string, ChatMessage[]>;
  onSendMessage: (thread: ChatThread, text: string) => Promise<void>;
}

const QUICK_REPLIES = [
  '¿Sigue disponible?',
  '¿Aceptas Pago Móvil o Zelle?',
  '¿Dónde entregas hoy?',
];

function formatChatTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

export function ChatsView({
  currentUserId,
  threads,
  activeThreadId,
  onSelectThread,
  messagesByThread,
  onSendMessage,
}: ChatsViewProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const activeMessages = activeThread ? messagesByThread[activeThread.id] || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeThreadId]);

  const handleSend = async (textToSend: string) => {
    if (!activeThread || !textToSend.trim() || sending) return;
    setSending(true);
    setDraft('');
    try {
      await onSendMessage(activeThread, textToSend.trim());
    } finally {
      setSending(false);
    }
  };

  const handleSwipeBack = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 85 || info.velocity.x > 400) {
      onSelectThread(null);
    }
  };

  if (activeThread) {
    const otherName =
      activeThread.buyerId === currentUserId
        ? activeThread.sellerName
        : activeThread.buyerName;

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

            <img
              src={activeThread.listingImage}
              alt={activeThread.listingTitle}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover bg-zinc-100 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <h3 className="font-display text-sm font-bold text-[#141118] truncate">
                {otherName}
              </h3>
              <p className="text-xs text-zinc-500 truncate tabular-nums">
                {activeThread.listingTitle} · ${activeThread.listingPrice.toLocaleString('es-VE')}
              </p>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-2.5 bg-[#F4F2F6]">
            {activeMessages.map((msg) => {
              const isMine = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-snug shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                      isMine
                        ? 'bg-[#DCFCE7] text-[#111B21] rounded-br-md'
                        : 'bg-white text-[#141118] rounded-bl-md border border-zinc-200/60'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-500 tabular-nums">
                      <span>{formatChatTime(msg.createdAtMs)}</span>
                      {isMine && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 bg-white border-t border-zinc-100 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                type="button"
                onClick={() => handleSend(qr)}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-xs font-medium text-[#141118] whitespace-nowrap shrink-0 transition-colors"
              >
                {qr}
              </button>
            ))}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(draft);
            }}
            className="px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom,0px),12px)] bg-white border-t border-zinc-100 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="Escribe un mensaje..."
              className="flex-1 h-11 px-4 rounded-full bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/20"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Enviar mensaje"
              className="w-11 h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] disabled:bg-zinc-200 disabled:text-zinc-400 text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl font-bold text-[#141118]">Chats</h2>
        <span className="text-xs text-zinc-500 tabular-nums">
          {threads.length} {threads.length === 1 ? 'conversación' : 'conversaciones'}
        </span>
      </div>

      {threads.length === 0 ? (
        <div className="bg-white rounded-[26px] border border-zinc-200/75 p-8 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-[#F4EFFA] text-[#362B3D] mx-auto flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-[#141118]">
            Sin conversaciones aún
          </h3>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto">
            Abre cualquier publicación y toca Chatear para hablar directo con el vendedor.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[26px] border border-zinc-200/75 divide-y divide-zinc-100 overflow-hidden">
          {threads.map((thread) => {
            const otherName =
              thread.buyerId === currentUserId ? thread.sellerName : thread.buyerName;
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread.id)}
                className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-zinc-50 transition-colors active:bg-zinc-100/70"
              >
                <img
                  src={thread.listingImage}
                  alt={thread.listingTitle}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover bg-zinc-100 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-sm font-bold text-[#141118] truncate">
                      {otherName}
                    </p>
                    <span className="text-[11px] text-zinc-400 tabular-nums shrink-0">
                      {formatChatTime(thread.lastMessageAtMs)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#362B3D] truncate">
                    {thread.listingTitle} · ${thread.listingPrice.toLocaleString('es-VE')}
                  </p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{thread.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
