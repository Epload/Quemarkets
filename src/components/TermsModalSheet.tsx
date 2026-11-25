import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, CheckCircle2, ShieldCheck } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface TermsModalSheetProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export function TermsModalSheet({ open, onClose, onAccept }: TermsModalSheetProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasScrolledToEnd(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollHeight <= el.clientHeight + 16) {
        setHasScrolledToEnd(true);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || hasScrolledToEnd) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 28) {
      setHasScrolledToEnd(true);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Términos, Condiciones y Descargo Legal"
      subtitle="Quemarket · Venezuela y Jurisdicción Internacional"
    >
      <div className="space-y-3">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[46dvh] sm:max-h-[50dvh] overflow-y-auto overscroll-contain pr-1.5 space-y-4 text-[13px] text-[#3B3244] leading-relaxed"
        >
          <div className="rounded-2xl bg-[#F6F1FC] border border-[#362B3D]/10 p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#6B4E8E] shrink-0 mt-0.5" />
            <p className="text-xs text-[#4A3E57] leading-snug">
              Al crear una cuenta en <strong>Quemarket</strong> declaras bajo fe de juramento ser
              mayor de 18 años y aceptas de forma irrevocable los presentes términos de exención de
              responsabilidad en Venezuela y en cualquier país del mundo.
            </p>
          </div>

          <section className="space-y-1.5">
            <h3 className="font-display text-sm font-bold text-[#2A2130]">
              1. Naturaleza estrictamente tecnológica e intermediación neutra
            </h3>
            <p>
              Quemarket es una plataforma digital gratuita de anuncios clasificados y mensajería
              directa entre usuarios independientes. Quemarket <strong>no</strong> es propietaria,
              fabricante, vendedora, compradora, depositaria, consignataria, agente de pagos,
              aseguradora, verificadora ni transportista de ninguno de los bienes publicados por
              terceros.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-display text-sm font-bold text-[#2A2130]">
              2. Mayoría de edad (+18 años) y capacidad jurídica
            </h3>
            <p>
              El registro y uso de Quemarket está estrictamente reservado a personas mayores de
              dieciocho (18) años con plena capacidad civil y legal conforme al Código Civil de la
              República Bolivariana de Venezuela y las leyes equivalentes de su lugar de residencia.
              El suministro de una edad falsa constituye causal inmediata de cancelación y
              responsabiliza exclusivamente al declarante.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-display text-sm font-bold text-[#2A2130]">
              3. Nombre como vendedor inmutable (@usuario)
            </h3>
            <p>
              El nombre como vendedor <strong>@usuario</strong> elegido en el registro será tu
              identificador público permanente dentro de Quemarket y{' '}
              <strong>no es modificable</strong> bajo ninguna circunstancia, con el fin de preservar
              la trazabilidad, reputación y transparencia frente a otros usuarios.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-display text-sm font-bold text-[#2A2130]">
              4. Exención total sobre transacciones, pagos y entregas
            </h3>
            <p>
              Toda negociación, acuerdo de precio (en bolívares, divisas u otros medios lícitos),
              método de pago (Pago Móvil, transferencias bancarias, efectivo, plataformas digitales o
              acuerdos presenciales), inspección física y entrega o envío se efectúa{' '}
              <strong>por cuenta, cargo y riesgo exclusivo del comprador y del vendedor</strong>.
              Quemarket no responde por calidad, autenticidad, garantía, vicios ocultos, entrega
              tardía, impagos, estafas, daños o perjuicios derivados del trato directo entre
              usuarios.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-display text-sm font-bold text-[#2A2130]">
              5. Cumplimiento legal en Venezuela y el extranjero y bienes prohibidos
            </h3>
            <p>
              Cada usuario es el único responsable de cumplir las leyes de la República Bolivariana
              de Venezuela (incluyendo normativa civil, mercantil, penal, tributaria/SENIAT,
              aduanera, Ley Especial contra los Delitos Informáticos y prevención de legitimación de
              capitales) así como la legislación nacional o internacional aplicable en cualquier
              jurisdicción donde acceda o contrate. Queda estrictamente prohibido publicar bienes
              robados, falsificados, armas, explosivos, estupefacientes, medicamentos sin
              autorización sanitaria, documentos oficiales, divisas o instrumentos prohibidos por la
              ley o que vulneren propiedad intelectual de terceros.
            </p>
          </section>

          <section className="space-y-1.5 pb-2">
            <h3 className="font-display text-sm font-bold text-[#2A2130]">
              6. Indemnidad total y limitación máxima de responsabilidad
            </h3>
            <p>
              En la máxima medida permitida por las leyes de Venezuela y del derecho internacional,
              el usuario libera, exonera y se obliga a mantener indemne (<em>hold harmless</em>) a
              Quemarket, sus propietarios, desarrolladores, operadores y afiliados frente a
              cualquier demanda, denuncia, multa, reclamo civil, penal, administrativo, laboral o
              tributario, daño directo, indirecto, lucro cesante o pérdida ocasionada por
              publicaciones, mensajes, actos u omisiones propios o de terceros usuarios. Quemarket
              podrá suspender o eliminar cuentas o anuncios sin previo aviso ante cualquier indicio
              de ilicitud o incumplimiento.
            </p>
          </section>
        </div>

        {onAccept && (
          <div className="pt-2 border-t border-zinc-100 space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
              {hasScrolledToEnd ? (
                <span className="text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Has leído hasta el final de los términos
                </span>
              ) : (
                <span className="text-[#584B63] inline-flex items-center gap-1">
                  <ArrowDown className="w-3.5 h-3.5 text-[#6B4E8E] animate-bounce" />
                  Baja hasta el final para habilitar el botón
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!hasScrolledToEnd}
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="w-full h-12 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Entiendo y acepto los Términos
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
