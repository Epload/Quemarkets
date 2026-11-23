import React, { useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, LocateFixed, Lock, Mail, MapPin } from 'lucide-react';
import { DEFAULT_CITY, findNearestVenezuelanCity } from '../data/venezuela';
import { CityLocation } from '../types/marketplace';
import { BackgroundItemFlow } from './BackgroundItemFlow';
import { CityPickerSheet } from './CityPickerSheet';
import { QuemarketLogo } from './QuemarketLogo';

interface OnboardingLocationProps {
  firebaseUser: FirebaseUser | null;
  initialCity?: CityLocation;
  onSignInGoogle: () => Promise<void>;
  onSignInEmail: (email: string, password: string, mode: 'login' | 'register') => Promise<void>;
  onConfirm: (city: CityLocation) => void;
}

function mapAuthErrorToSpanish(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Ingresa un correo electrónico válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/email-already-in-use':
      return 'Este correo ya tiene una cuenta. Cambia a "Iniciar sesión".';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.';
    case 'auth/operation-not-allowed':
      return 'Activa el acceso por Correo/Contraseña en tu Firebase Console para usar este método.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos segundos e intenta de nuevo.';
    default:
      return 'No se pudo completar el acceso con correo.';
  }
}

export function OnboardingLocation({
  firebaseUser,
  initialCity,
  onSignInGoogle,
  onSignInEmail,
  onConfirm,
}: OnboardingLocationProps) {
  const [step, setStep] = useState<'welcome' | 'location'>(
    firebaseUser ? 'location' : 'welcome'
  );
  const [detected, setDetected] = useState<CityLocation>(initialCity || DEFAULT_CITY);
  const [detecting, setDetecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if ('geolocation' in navigator) {
      navigator.permissions
        ?.query({ name: 'geolocation' })
        .then((result) => {
          if (result.state === 'granted' && active) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (!active) return;
                setDetected(findNearestVenezuelanCity(pos.coords.latitude, pos.coords.longitude));
              },
              () => {}
            );
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, []);

  const handleManualDetect = () => {
    if (!('geolocation' in navigator)) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetected(findNearestVenezuelanCity(pos.coords.latitude, pos.coords.longitude));
        setDetecting(false);
      },
      () => {
        setDetecting(false);
        setPickerOpen(true);
      },
      { timeout: 6000 }
    );
  };

  const handleGoogleContinue = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await onSignInGoogle();
      setStep('location');
    } catch {
      setAuthError('No se pudo conectar con Google. Prueba iniciar con tu correo.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6) {
      setAuthError('Ingresa tu correo y una contraseña de al menos 6 caracteres.');
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      await onSignInEmail(trimmedEmail, password, emailMode);
      setStep('location');
    } catch (err) {
      setAuthError(mapAuthErrorToSpanish(err));
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between px-6 pt-5 pb-8 relative overflow-hidden bg-[#F6F1FC]">
      {/* Continuous live product-flow reel backdrop */}
      <BackgroundItemFlow />

      {/* Top header with centered Quemarket logo */}
      <header className="w-full max-w-md mx-auto grid grid-cols-[40px_1fr_40px] items-center z-10">
        <div className="flex justify-start">
          {step === 'location' ? (
            <button
              type="button"
              onClick={() => setStep('welcome')}
              aria-label="Volver al inicio"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#2A2130] hover:bg-black/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10 h-10" aria-hidden="true" />
          )}
        </div>

        <div className="flex justify-center">
          <QuemarketLogo size="md" />
        </div>

        <div className="flex justify-end">
          {step === 'location' ? (
            <button
              type="button"
              onClick={handleManualDetect}
              aria-label="Detectar ubicación GPS"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#2A2130] hover:bg-black/5 transition-colors"
            >
              <LocateFixed className={`w-5 h-5 ${detecting ? 'animate-spin' : ''}`} />
            </button>
          ) : (
            <div className="w-10 h-10" aria-hidden="true" />
          )}
        </div>
      </header>

      {/* Center visual zone */}
      <div className="flex-1 flex items-center justify-center py-4 z-10">
        <AnimatePresence mode="wait">
          {step === 'location' ? (
            <motion.div
              key="globe-visual"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-60 h-60 sm:w-68 sm:h-68 flex items-center justify-center"
            >
              <svg
                viewBox="0 0 280 280"
                className="w-full h-full"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="globeGlow" cx="45%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
                    <stop offset="70%" stopColor="#DFCFF3" stopOpacity="0.48" />
                    <stop offset="100%" stopColor="#C8B0E6" stopOpacity="0.58" />
                  </radialGradient>
                </defs>

                <ellipse
                  cx="140"
                  cy="140"
                  rx="126"
                  ry="42"
                  transform="rotate(-16 140 140)"
                  stroke="#362B3D"
                  strokeOpacity="0.22"
                  strokeWidth="1.2"
                />

                <circle
                  cx="140"
                  cy="140"
                  r="94"
                  fill="url(#globeGlow)"
                  stroke="#362B3D"
                  strokeOpacity="0.65"
                  strokeWidth="1.35"
                />

                <ellipse
                  cx="140"
                  cy="140"
                  rx="94"
                  ry="32"
                  stroke="#362B3D"
                  strokeOpacity="0.16"
                  strokeWidth="1"
                />
                <ellipse
                  cx="140"
                  cy="140"
                  rx="94"
                  ry="64"
                  stroke="#362B3D"
                  strokeOpacity="0.14"
                  strokeWidth="1"
                />
                <ellipse
                  cx="140"
                  cy="140"
                  rx="42"
                  ry="94"
                  stroke="#362B3D"
                  strokeOpacity="0.16"
                  strokeWidth="1"
                />
                <line
                  x1="140"
                  y1="46"
                  x2="140"
                  y2="234"
                  stroke="#362B3D"
                  strokeOpacity="0.16"
                  strokeWidth="1"
                />

                <path
                  d="M118 68 C132 64, 149 67, 158 76 C164 83, 159 95, 148 102 C141 107, 134 114, 141 122 C148 128, 162 125, 174 132 C188 140, 198 156, 191 178 C185 196, 169 214, 159 224 C153 220, 154 202, 152 186 C150 172, 144 162, 148 148 C151 138, 142 132, 132 126 C122 120, 114 108, 112 94 C110 82, 112 72, 118 68 Z"
                  fill="#FFFFFF"
                  fillOpacity="0.4"
                  stroke="#362B3D"
                  strokeOpacity="0.6"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />

                <circle cx="163" cy="133" r="4.5" fill="#362B3D" />
                <circle
                  cx="163"
                  cy="133"
                  r="10"
                  stroke="#362B3D"
                  strokeOpacity="0.28"
                  strokeWidth="1.2"
                />
                <circle cx="88" cy="186" r="3" fill="#362B3D" fillOpacity="0.7" />
              </svg>
            </motion.div>
          ) : (
            <motion.div
              key="welcome-spacer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={showEmailForm ? 'h-10 sm:h-16' : 'h-28 sm:h-36'}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Foreground Action Block */}
      <div className="w-full max-w-md mx-auto z-10">
        <AnimatePresence mode="wait">
          {step === 'welcome' ? (
            <motion.div
              key="welcome-panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <h1 className="font-display text-[32px] leading-[1.1] font-bold tracking-tight text-[#2A2130] text-balance">
                  Compra y vende sin complicaciones.
                </h1>
                <p className="text-[15px] text-[#584B63] leading-relaxed">
                  Tu marketplace directo en Venezuela. Publica en segundos y habla por chat al instante.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {firebaseUser ? (
                  <button
                    type="button"
                    onClick={() => setStep('location')}
                    className="w-full h-14 pl-6 pr-2.5 rounded-full bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-between shadow-[0_10px_24px_rgba(54,43,61,0.22)] active:scale-[0.98] transition-all"
                  >
                    <span className="truncate pr-2">
                      Continuar como {firebaseUser.displayName || firebaseUser.email || 'Usuario'}
                    </span>
                    <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleContinue}
                      disabled={signingIn}
                      className="w-full h-14 pl-6 pr-2.5 rounded-full bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-between shadow-[0_10px_24px_rgba(54,43,61,0.22)] active:scale-[0.98] transition-all disabled:opacity-75"
                    >
                      <span>{signingIn && !showEmailForm ? 'Conectando...' : 'Continuar con Google'}</span>
                      <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                        <ArrowRight className="w-4 h-4 text-white" />
                      </span>
                    </button>

                    {!showEmailForm ? (
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmailForm(true);
                            setAuthError(null);
                          }}
                          className="text-sm font-medium text-[#584B63] hover:text-[#2A2130] underline underline-offset-4 py-2 px-4 transition-colors"
                        >
                          Entrar con correo electrónico
                        </button>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleEmailSubmit}
                        className="bg-white/95 backdrop-blur-md rounded-[24px] border border-[#362B3D]/12 p-3.5 shadow-[0_10px_30px_rgba(54,43,61,0.08)] space-y-2.5"
                      >
                        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setEmailMode('login');
                              setAuthError(null);
                            }}
                            className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                              emailMode === 'login'
                                ? 'bg-white text-[#2A2130] shadow-xs'
                                : 'text-zinc-500 hover:text-[#2A2130]'
                            }`}
                          >
                            Iniciar sesión
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEmailMode('register');
                              setAuthError(null);
                            }}
                            className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                              emailMode === 'register'
                                ? 'bg-white text-[#2A2130] shadow-xs'
                                : 'text-zinc-500 hover:text-[#2A2130]'
                            }`}
                          >
                            Crear cuenta
                          </button>
                        </div>

                        <div className="relative">
                          <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="email"
                            required
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
                          />
                        </div>

                        <div className="relative">
                          <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña (mín. 6 caracteres)"
                            className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-zinc-100 text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#362B3D]/25"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={signingIn}
                          className="w-full h-11 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-75"
                        >
                          <span>
                            {signingIn
                              ? 'Procesando...'
                              : emailMode === 'login'
                                ? 'Entrar con correo'
                                : 'Registrarme con correo'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    )}

                    {authError && (
                      <p className="text-xs text-rose-600 text-center font-medium px-2">
                        {authError}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="location-panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <h1 className="font-display text-[32px] leading-[1.12] font-bold tracking-tight text-[#2A2130] text-balance">
                  ¿Estás en {detected.city}?
                </h1>
                <div className="flex items-center gap-2 text-sm text-[#584B63]">
                  <MapPin className="w-4 h-4 text-[#6B4E8E] shrink-0" />
                  <span className="truncate">
                    {detected.city} · {detected.state} · Venezuela
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onConfirm(detected)}
                className="w-full h-14 pl-6 pr-2.5 rounded-full bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-between shadow-[0_10px_24px_rgba(54,43,61,0.22)] active:scale-[0.98] transition-all"
              >
                <span>Sí, estoy aquí</span>
                <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-sm font-medium text-[#584B63] hover:text-[#2A2130] underline underline-offset-4 py-2 px-4 transition-colors"
                >
                  No, estoy en otro lugar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CityPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentCity={detected}
        onSelectCity={(loc) => {
          setDetected(loc);
          onConfirm(loc);
        }}
      />
    </div>
  );
}
