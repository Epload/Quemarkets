import React, { useEffect, useRef, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LocateFixed,
  Lock,
  Mail,
  MapPin,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import { DEFAULT_CITY, findNearestVenezuelanCity } from '../data/venezuela';
import { isNativeCapacitorApp } from '../lib/capacitorApp';
import { normalizeUsernameHandle } from '../lib/marketplaceService';
import {
  AppPermissionKey,
  AppPermissionsMap,
  areAllAppPermissionsGranted,
  DEFAULT_PERMISSIONS_STATE,
  probeAppPermissions,
  requestAllAppPermissions,
  requestAppPermission,
  subscribePermissionChanges,
} from '../lib/nativePermissions';
import { CityLocation, EmailRegistrationPayload } from '../types/marketplace';
import { BackgroundItemFlow } from './BackgroundItemFlow';
import { CityPickerSheet } from './CityPickerSheet';
import { QuemarketLogo } from './QuemarketLogo';
import { TermsModalSheet } from './TermsModalSheet';

interface OnboardingLocationProps {
  firebaseUser: FirebaseUser | null;
  needsProfileCompletion: boolean;
  hasConfirmedLocation?: boolean;
  initialStep?: 'welcome' | 'complete-profile' | 'location' | 'permissions';
  initialCity?: CityLocation;
  onSignInGoogle: () => Promise<{ needsProfileCompletion: boolean }>;
  onCompleteGoogleProfile: (data: {
    username: string;
    age: number;
    termsAccepted: boolean;
  }) => Promise<void>;
  onSignInEmail: (
    email: string,
    password: string,
    mode: 'login' | 'register',
    registration?: EmailRegistrationPayload
  ) => Promise<{ isAdmin?: boolean } | void>;
  onSignOut: () => Promise<void>;
  onLocationConfirmed?: (city: CityLocation) => void;
  onConfirm: (city: CityLocation) => void;
  initialShowEmailForm?: boolean;
}

function mapAuthErrorToSpanish(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'auth/username-already-in-use') {
      return 'Este nombre como vendedor ya está ocupado. Elige otro.';
    }
    if (err.message === 'auth/admin-email-reserved') {
      return 'Este correo está reservado para administración. Cambia a "Iniciar sesión".';
    }
    if (err.message === 'auth/admin-invalid-credentials') {
      return 'Correo o contraseña incorrectos.';
    }
    if (err.message === 'auth/admin-rate-limited') {
      return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    }
  }

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
      return 'No se pudo completar el acceso.';
  }
}

export function OnboardingLocation({
  firebaseUser,
  needsProfileCompletion,
  hasConfirmedLocation = false,
  initialStep,
  initialCity,
  onSignInGoogle,
  onCompleteGoogleProfile,
  onSignInEmail,
  onSignOut,
  onLocationConfirmed,
  onConfirm,
  initialShowEmailForm = false,
}: OnboardingLocationProps) {
  const [step, setStep] = useState<'welcome' | 'complete-profile' | 'location' | 'permissions'>(() => {
    if (initialStep) return initialStep;
    if (!firebaseUser) return 'welcome';
    if (needsProfileCompletion) return 'complete-profile';
    return hasConfirmedLocation ? 'permissions' : 'location';
  });
  const [detected, setDetected] = useState<CityLocation>(initialCity || DEFAULT_CITY);
  const [detecting, setDetecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(initialShowEmailForm);
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<AppPermissionsMap>(DEFAULT_PERMISSIONS_STATE);
  const [requestingPerm, setRequestingPerm] = useState<AppPermissionKey | 'all' | null>(null);
  const [permissionFeedback, setPermissionFeedback] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const maxViewportHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  const cleanHandle = normalizeUsernameHandle(usernameInput);

  // Track visual viewport so modals stay centered and scrollable when the mobile keyboard opens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const syncViewport = () => {
      const currentH = Math.round(vv ? vv.height : window.innerHeight);
      if (currentH > maxViewportHeightRef.current) {
        maxViewportHeightRef.current = currentH;
      }
      setViewportHeight(currentH);
      const shrinkFromMax = maxViewportHeightRef.current - currentH;
      const shrinkFromWindow = window.innerHeight - currentH;
      setKeyboardOpen(shrinkFromMax > 130 || shrinkFromWindow > 110);
    };
    const handleOrientationReset = () => {
      maxViewportHeightRef.current = window.innerHeight;
      syncViewport();
    };
    syncViewport();
    vv?.addEventListener('resize', syncViewport);
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', handleOrientationReset);
    return () => {
      vv?.removeEventListener('resize', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', handleOrientationReset);
    };
  }, []);

  const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  };

  const firebaseUserRef = useRef<FirebaseUser | null>(firebaseUser);
  firebaseUserRef.current = firebaseUser;

  useEffect(() => {
    if (!firebaseUser) {
      setStep('welcome');
      setSigningIn(false);
      setAuthError(null);
      return;
    }
    if (needsProfileCompletion) {
      setStep('complete-profile');
    } else if (initialStep) {
      setStep(initialStep);
    }
  }, [firebaseUser, needsProfileCompletion, initialStep]);

  useEffect(() => {
    let active = true;
    probeAppPermissions()
      .then((status) => {
        if (!active) return;
        setPermissions(status);
        if (
          hasConfirmedLocation &&
          !needsProfileCompletion &&
          Boolean(firebaseUserRef.current) &&
          areAllAppPermissionsGranted(status)
        ) {
          onConfirm(initialCity || DEFAULT_CITY);
          return;
        }
        if (!hasConfirmedLocation && status.location === 'granted' && 'geolocation' in navigator) {
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

    const unsub = subscribePermissionChanges((nextPerms) => {
      if (!active) return;
      setPermissions(nextPerms);
      if (areAllAppPermissionsGranted(nextPerms)) {
        setPermissionFeedback(null);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const handleManualDetect = async () => {
    setDetecting(true);
    setPermissionFeedback(null);
    try {
      const res = await requestAppPermission('location');
      setPermissions((prev) => ({ ...prev, location: res.state }));
      if (res.coords) {
        setDetected(findNearestVenezuelanCity(res.coords.lat, res.coords.lng));
      } else if (res.state !== 'granted') {
        if (res.message) setPermissionFeedback(res.message);
        setPickerOpen(true);
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleRequestSinglePermission = async (key: AppPermissionKey) => {
    if (requestingPerm) return;
    setRequestingPerm(key);
    setPermissionFeedback(null);
    try {
      const res = await requestAppPermission(key);
      setPermissions((prev) => ({ ...prev, [key]: res.state }));
      if (key === 'location' && !hasConfirmedLocation && res.coords) {
        setDetected(findNearestVenezuelanCity(res.coords.lat, res.coords.lng));
      }
      if (res.state !== 'granted' && res.message) {
        setPermissionFeedback(res.message);
      }
    } finally {
      setRequestingPerm(null);
    }
  };

  const handleRequestAllPermissions = async () => {
    if (requestingPerm) return;
    setRequestingPerm('all');
    setPermissionFeedback(null);
    try {
      const res = await requestAllAppPermissions(permissions);
      setPermissions(res.permissions);
      if (!hasConfirmedLocation && res.coords) {
        setDetected(findNearestVenezuelanCity(res.coords.lat, res.coords.lng));
      }
      if (res.feedbackMessage) {
        setPermissionFeedback(res.feedbackMessage);
      }
    } finally {
      setRequestingPerm(null);
    }
  };

  const proceedAfterAuth = async () => {
    const freshPerms = await probeAppPermissions().catch(() => permissions);
    setPermissions(freshPerms);
    if (!hasConfirmedLocation) {
      setStep('location');
      return;
    }
    if (areAllAppPermissionsGranted(freshPerms)) {
      onConfirm(detected);
      return;
    }
    setStep('permissions');
  };

  const handleConfirmLocationStep = async (loc: CityLocation) => {
    setDetected(loc);
    onLocationConfirmed?.(loc);
    const freshPerms = await probeAppPermissions().catch(() => permissions);
    setPermissions(freshPerms);
    if (areAllAppPermissionsGranted(freshPerms)) {
      onConfirm(loc);
    } else {
      setStep('permissions');
    }
  };

  const handleGoogleContinue = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await onSignInGoogle();
      if (result.needsProfileCompletion) {
        setHasReadTerms(false);
        setTermsAccepted(false);
        setAuthError(null);
        setStep('complete-profile');
      } else {
        await proceedAfterAuth();
      }
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Tu navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta de nuevo.');
      } else {
        setAuthError(
          isNativeCapacitorApp()
            ? 'En la app APK te recomendamos continuar con tu correo electrónico.'
            : 'No se pudo conectar con Google. Prueba iniciar con tu correo.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleCompleteProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
      setAuthError(
        'El nombre como vendedor debe tener entre 3 y 24 caracteres (letras, números o "_").'
      );
      return;
    }
    const parsedAge = Number(ageInput);
    if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 120) {
      setAuthError('Debes ser mayor de 18 años para usar Quemarket.');
      return;
    }
    if (!hasReadTerms || !termsAccepted) {
      setAuthError('Debes leer hasta el final y aceptar los Términos y Condiciones legales.');
      return;
    }

    setSigningIn(true);
    setAuthError(null);
    try {
      await onCompleteGoogleProfile({
        username: `@${cleanHandle}`,
        age: parsedAge,
        termsAccepted: true,
      });
      await proceedAfterAuth();
    } catch (err) {
      setAuthError(mapAuthErrorToSpanish(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (emailMode === 'register') {
      if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
        setAuthError(
          'El nombre como vendedor debe tener entre 3 y 24 caracteres (letras, números o "_").'
        );
        return;
      }
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setAuthError('Ingresa un correo electrónico válido.');
        return;
      }
      const parsedAge = Number(ageInput);
      if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 120) {
        setAuthError('Debes tener al menos 18 años para crear una cuenta en Quemarket.');
        return;
      }
      if (password.length < 6) {
        setAuthError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('Las contraseñas no coinciden.');
        return;
      }
      if (!hasReadTerms || !termsAccepted) {
        setAuthError('Debes leer hasta el final y aceptar los Términos y Condiciones legales.');
        return;
      }

      setSigningIn(true);
      setAuthError(null);
      try {
        await onSignInEmail(trimmedEmail, password, 'register', {
          username: `@${cleanHandle}`,
          email: trimmedEmail,
          age: parsedAge,
          password,
          confirmPassword,
          termsAccepted: true,
        });
        await proceedAfterAuth();
      } catch (err) {
        setAuthError(mapAuthErrorToSpanish(err));
      } finally {
        setSigningIn(false);
      }
      return;
    }

    if (!trimmedEmail || password.length < 6) {
      setAuthError('Ingresa tu correo y una contraseña de al menos 6 caracteres.');
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await onSignInEmail(trimmedEmail, password, 'login');
      if (result && result.isAdmin) {
        setPassword('');
        return;
      }
      await proceedAfterAuth();
    } catch (err) {
      setAuthError(mapAuthErrorToSpanish(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleToggleTermsCheckbox = () => {
    if (!hasReadTerms) {
      setTermsSheetOpen(true);
      return;
    }
    setTermsAccepted((prev) => !prev);
  };

  const handleBackFromCompleteProfile = async () => {
    setAuthError(null);
    setHasReadTerms(false);
    setTermsAccepted(false);
    await onSignOut();
    setStep('welcome');
  };

  const pillInputClass =
    'w-full h-12 rounded-2xl bg-white/90 border border-[#362B3D]/14 text-[16px] text-[#2A2130] placeholder:text-[#584B63]/65 shadow-[0_4px_14px_rgba(54,43,61,0.05)] focus:outline-none focus:bg-white focus:border-[#362B3D]/40 transition-all';

  const permissionItems: {
    key: AppPermissionKey;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: 'location',
      label: 'Ubicación GPS',
      description: 'Detecta tu ciudad y artículos cercanos',
      icon: MapPin,
    },
    {
      key: 'camera',
      label: 'Cámara y Fotos',
      description: 'Publica productos, avatar y fotos en chat',
      icon: Camera,
    },
    {
      key: 'microphone',
      label: 'Micrófono',
      description: 'Envía notas de voz en tus chats',
      icon: Mic,
    },
    {
      key: 'notifications',
      label: 'Notificaciones',
      description: 'Entérate de mensajes y ofertas nuevas',
      icon: Bell,
    },
  ];

  const grantedCount = permissionItems.filter((item) => permissions[item.key] === 'granted').length;
  const allGranted = grantedCount === permissionItems.length;

  const isAuthFormActive = (step === 'welcome' && showEmailForm) || step === 'complete-profile';
  const showTopHeader = step === 'location' || (step === 'permissions' && !hasConfirmedLocation);

  return (
    <div
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
      className="h-[100dvh] w-full flex flex-col relative overflow-hidden bg-[#F6F1FC]"
    >
      {/* Continuous live product-flow reel backdrop */}
      <BackgroundItemFlow />

      {/* Top header (only shown for location & permissions, without logo) */}
      {showTopHeader && (
        <header
          className={`w-full max-w-md mx-auto grid grid-cols-[40px_1fr_40px] items-center px-5 sm:px-6 z-10 shrink-0 transition-[padding] duration-150 ${
            keyboardOpen
              ? 'pt-[max(env(safe-area-inset-top,0px),8px)] pb-1'
              : 'pt-[max(env(safe-area-inset-top,0px),14px)] pb-2'
          }`}
        >
          <div className="flex justify-start">
            {step === 'permissions' ? (
              <button
                type="button"
                onClick={() => setStep('location')}
                aria-label="Volver a selección de ubicación"
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#2A2130] bg-white/60 hover:bg-white/85 backdrop-blur-sm transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(needsProfileCompletion ? 'complete-profile' : 'welcome')}
                aria-label="Volver al paso anterior"
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#2A2130] bg-white/60 hover:bg-white/85 backdrop-blur-sm transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex justify-center" aria-hidden="true" />

          <div className="flex justify-end">
            {step === 'location' ? (
              <button
                type="button"
                onClick={handleManualDetect}
                aria-label="Detectar ubicación GPS"
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#2A2130] bg-white/60 hover:bg-white/85 backdrop-blur-sm transition-colors"
              >
                <LocateFixed className={`w-5 h-5 ${detecting ? 'animate-spin' : ''}`} />
              </button>
            ) : (
              <div className="w-10 h-10" aria-hidden="true" />
            )}
          </div>
        </header>
      )}

      {/* Scroll-safe centered main zone: my-auto centers when space allows and scrolls cleanly when keyboard opens */}
      <main
        className={`flex-1 min-h-0 w-full overflow-y-auto overscroll-contain flex flex-col items-center px-5 sm:px-6 z-10 ${
          keyboardOpen
            ? 'py-2 pb-5'
            : 'py-4 pb-[max(env(safe-area-inset-bottom,0px),24px)]'
        }`}
      >
        <div
          className={`w-full max-w-md mx-auto my-auto flex flex-col items-center rounded-[28px] bg-white/82 backdrop-blur-md border border-white/90 shadow-[0_20px_50px_rgba(54,43,61,0.12)] transition-[padding] duration-150 ${
            keyboardOpen && isAuthFormActive
              ? 'gap-3.5 px-4 py-4 sm:px-6 sm:py-6'
              : 'gap-5 px-5 py-6 sm:px-7 sm:py-7'
          }`}
        >
          {(step === 'location' || step === 'permissions') && (
            <div className="flex items-center justify-center">
              <AnimatePresence mode="wait">
                {step === 'location' ? (
                  <motion.div
                    key="globe-visual"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center"
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
                    key="permissions-visual"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-[28px] bg-white/80 backdrop-blur-md border border-[#362B3D]/12 shadow-[0_14px_34px_rgba(54,43,61,0.1)] flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <ShieldCheck className="w-10 h-10 sm:w-11 sm:h-11 text-[#362B3D]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Centered Foreground Action Block */}
          <div className="w-full">
            <AnimatePresence mode="wait">
          {step === 'welcome' ? (
            !showEmailForm ? (
              <motion.div
                key="welcome-panel"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <div className="space-y-3 text-center">
                  <div className="flex justify-center pb-1">
                    <QuemarketLogo size="md" />
                  </div>
                  <h1 className="font-display text-[17px] sm:text-[18px] leading-[1.3] font-semibold tracking-tight text-[#2A2130] text-balance max-w-[280px] mx-auto">
                    La forma más rápida y fácil de comprar y vender en Venezuela
                  </h1>
                </div>

                <div className="space-y-3 pt-1">
                  {firebaseUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (needsProfileCompletion) {
                          setStep('complete-profile');
                        } else {
                          void proceedAfterAuth();
                        }
                      }}
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
                        <span>{signingIn ? 'Conectando...' : 'Continuar con Google'}</span>
                        <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                          <ArrowRight className="w-4 h-4 text-white" />
                        </span>
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmailForm(true);
                            setAuthError(null);
                          }}
                          className="text-sm font-medium text-[#584B63] hover:text-[#2A2130] underline underline-offset-4 py-2 px-4 transition-colors"
                        >
                          Inicio de sesión normal
                        </button>
                      </div>

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
              <motion.form
                key={`email-panel-${emailMode}`}
                onSubmit={handleEmailSubmit}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-3.5"
              >
                <div className="space-y-1 text-center">
                  <h1 className="font-display text-[22px] sm:text-[25px] leading-[1.15] font-bold tracking-tight text-[#2A2130] text-balance">
                    {emailMode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
                  </h1>
                  <p className="text-[13px] text-[#584B63] leading-snug">
                    {emailMode === 'login'
                      ? 'Ingresa tu correo y contraseña para entrar.'
                      : 'Completa tus datos reales (mayores de 18 años).'}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {emailMode === 'register' && (
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                          <span
                            aria-hidden="true"
                            className="font-display font-bold text-[#6B4E8E] text-[15px] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          >
                            @
                          </span>
                          <input
                            type="text"
                            required
                            enterKeyHint="next"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            maxLength={25}
                            value={usernameInput}
                            onFocus={handleFieldFocus}
                            onChange={(e) => setUsernameInput(normalizeUsernameHandle(e.target.value))}
                            placeholder="Usuario vendedor"
                            aria-label="Nombre como vendedor"
                            className={`${pillInputClass} pl-8 pr-3`}
                          />
                        </div>

                        <div className="relative w-[94px] shrink-0">
                          <input
                            type="number"
                            required
                            min={18}
                            max={120}
                            enterKeyHint="next"
                            inputMode="numeric"
                            value={ageInput}
                            onFocus={handleFieldFocus}
                            onChange={(e) => setAgeInput(e.target.value.slice(0, 3))}
                            placeholder="Edad"
                            aria-label="Edad (mayor de 18 años)"
                            className={`${pillInputClass} px-3 text-center tabular-nums`}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-[#584B63] px-1 flex items-center justify-center gap-1 leading-snug text-center">
                        <Lock className="w-3 h-3 text-[#6B4E8E] shrink-0" />
                        <span className="truncate">
                          Venderás como{' '}
                          <strong className="text-[#2A2130]">
                            @{cleanHandle || 'tumarca'}
                          </strong>{' '}
                          (no modificable)
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#6B4E8E] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      enterKeyHint="next"
                      autoComplete="email"
                      value={email}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      aria-label="Correo electrónico"
                      className={`${pillInputClass} pl-11 pr-4`}
                    />
                  </div>

                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#6B4E8E] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      enterKeyHint={emailMode === 'login' ? 'done' : 'next'}
                      autoComplete={emailMode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña (mín. 6 caracteres)"
                      aria-label="Contraseña"
                      className={`${pillInputClass} pl-11 pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-[#584B63]/75 hover:text-[#2A2130] absolute right-1.5 top-1/2 -translate-y-1/2 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {emailMode === 'register' && (
                    <>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#6B4E8E] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          enterKeyHint="done"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onFocus={handleFieldFocus}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirmar contraseña"
                          aria-label="Confirmar contraseña"
                          className={`${pillInputClass} pl-11 pr-12 ${
                            confirmPassword && confirmPassword !== password
                              ? 'border-rose-400 focus:border-rose-500'
                              : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={
                            showConfirmPassword
                              ? 'Ocultar confirmación'
                              : 'Ver confirmación de contraseña'
                          }
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#584B63]/75 hover:text-[#2A2130] absolute right-1.5 top-1/2 -translate-y-1/2 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="rounded-2xl bg-[#F4EFFA]/80 border border-[#362B3D]/10 px-3 py-2 flex items-center gap-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={termsAccepted}
                          aria-label="Aceptar Términos y Condiciones legales"
                          onClick={handleToggleTermsCheckbox}
                          className="w-10 h-10 -ml-1.5 rounded-xl flex items-center justify-center shrink-0"
                        >
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              termsAccepted && hasReadTerms
                                ? 'bg-[#362B3D] border-[#362B3D] text-white'
                                : 'bg-white border-[#362B3D]/30 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </span>
                        </button>
                        <p className="text-[12px] text-[#584B63] leading-snug">
                          Acepto los{' '}
                          <button
                            type="button"
                            onClick={() => setTermsSheetOpen(true)}
                            className="font-semibold text-[#2A2130] underline underline-offset-3 hover:text-[#6B4E8E] transition-colors"
                          >
                            Términos y Condiciones
                          </button>
                          {!hasReadTerms && (
                            <span className="block text-[11px] text-[#6B4E8E] font-medium">
                              Ábrelos y lee hasta el final para habilitar el registro.
                            </span>
                          )}
                        </p>
                      </div>
                    </>
                  )}

                  {authError && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-xl text-center font-medium px-3 py-2">
                      {authError}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <button
                    type="submit"
                    disabled={
                      signingIn || (emailMode === 'register' && (!hasReadTerms || !termsAccepted))
                    }
                    className="w-full h-13 pl-6 pr-2.5 rounded-full bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-between shadow-[0_10px_24px_rgba(54,43,61,0.22)] active:scale-[0.98] transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    <span>
                      {signingIn
                        ? 'Procesando...'
                        : emailMode === 'login'
                          ? 'Entrar'
                          : 'Crear cuenta'}
                    </span>
                    <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </span>
                  </button>

                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode((prev) => (prev === 'login' ? 'register' : 'login'));
                        setAuthError(null);
                      }}
                      className="text-sm font-medium text-[#584B63] hover:text-[#2A2130] py-1.5 px-3 transition-colors"
                    >
                      {emailMode === 'login' ? (
                        <>
                          ¿Aún no tienes cuenta?{' '}
                          <span className="font-semibold text-[#2A2130] underline underline-offset-4">
                            Crea una
                          </span>
                        </>
                      ) : (
                        <>
                          ¿Ya tienes cuenta?{' '}
                          <span className="font-semibold text-[#2A2130] underline underline-offset-4">
                            Inicia sesión
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowEmailForm(false);
                        setAuthError(null);
                      }}
                      className="text-xs font-medium text-[#584B63]/80 hover:text-[#2A2130] py-1 px-3 transition-colors"
                    >
                      Volver a opciones de ingreso
                    </button>
                  </div>
                </div>
              </motion.form>
            )
          ) : step === 'complete-profile' ? (
            <motion.form
              key="complete-profile-panel"
              onSubmit={handleCompleteProfileSubmit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3.5"
            >
              <div className="space-y-1 text-center">
                <h1 className="font-display text-[22px] sm:text-[25px] leading-[1.15] font-bold tracking-tight text-[#2A2130] text-balance">
                  Completa tu registro
                </h1>
                <p className="text-[13px] text-[#584B63] leading-snug">
                  Elige tu nombre como vendedor, confirma tu edad y acepta los términos.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                      <span
                        aria-hidden="true"
                        className="font-display font-bold text-[#6B4E8E] text-[15px] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      >
                        @
                      </span>
                      <input
                        type="text"
                        required
                        enterKeyHint="next"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={25}
                        value={usernameInput}
                        onFocus={handleFieldFocus}
                        onChange={(e) => setUsernameInput(normalizeUsernameHandle(e.target.value))}
                        placeholder="Usuario vendedor"
                        aria-label="Nombre como vendedor"
                        className={`${pillInputClass} pl-8 pr-3`}
                      />
                    </div>

                    <div className="relative w-[94px] shrink-0">
                      <input
                        type="number"
                        required
                        min={18}
                        max={120}
                        enterKeyHint="done"
                        inputMode="numeric"
                        value={ageInput}
                        onFocus={handleFieldFocus}
                        onChange={(e) => setAgeInput(e.target.value.slice(0, 3))}
                        placeholder="Edad"
                        aria-label="Edad (mayor de 18 años)"
                        className={`${pillInputClass} px-3 text-center tabular-nums`}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#584B63] px-1 flex items-center justify-center gap-1 leading-snug text-center">
                    <Lock className="w-3 h-3 text-[#6B4E8E] shrink-0" />
                    <span className="truncate">
                      Venderás como{' '}
                      <strong className="text-[#2A2130]">@{cleanHandle || 'tumarca'}</strong> (no
                      modificable)
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F4EFFA]/80 border border-[#362B3D]/10 px-3 py-2 flex items-center gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={termsAccepted}
                    aria-label="Aceptar Términos y Condiciones legales"
                    onClick={handleToggleTermsCheckbox}
                    className="w-10 h-10 -ml-1.5 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        termsAccepted && hasReadTerms
                          ? 'bg-[#362B3D] border-[#362B3D] text-white'
                          : 'bg-white border-[#362B3D]/30 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </span>
                  </button>
                  <p className="text-[12px] text-[#584B63] leading-snug">
                    Acepto los{' '}
                    <button
                      type="button"
                      onClick={() => setTermsSheetOpen(true)}
                      className="font-semibold text-[#2A2130] underline underline-offset-3 hover:text-[#6B4E8E] transition-colors"
                    >
                      Términos y Condiciones
                    </button>
                    {!hasReadTerms && (
                      <span className="block text-[11px] text-[#6B4E8E] font-medium">
                        Ábrelos y lee hasta el final para habilitar el botón.
                      </span>
                    )}
                  </p>
                </div>

                {authError && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-xl text-center font-medium px-3 py-2">
                    {authError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 pt-0.5">
                <button
                  type="submit"
                  disabled={signingIn || !hasReadTerms || !termsAccepted}
                  className="w-full h-13 pl-6 pr-2.5 rounded-full bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-between shadow-[0_10px_24px_rgba(54,43,61,0.22)] active:scale-[0.98] transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  <span>{signingIn ? 'Guardando...' : 'Crear cuenta'}</span>
                  <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleBackFromCompleteProfile}
                    className="text-xs font-medium text-[#584B63] hover:text-[#2A2130] py-1.5 px-3 transition-colors"
                  >
                    Cancelar y volver al inicio
                  </button>
                </div>
              </div>
            </motion.form>
          ) : step === 'location' ? (
            <motion.div
              key="location-panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div className="space-y-2 text-center">
                <h1 className="font-display text-[32px] sm:text-[36px] leading-[1.12] font-bold tracking-tight text-[#2A2130] text-balance">
                  ¿Estás en {detected.city}?
                </h1>
                <div className="flex items-center justify-center gap-2 text-sm text-[#584B63]">
                  <MapPin className="w-4 h-4 text-[#6B4E8E] shrink-0" />
                  <span className="truncate">
                    {detected.city} · {detected.state} · Venezuela
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleConfirmLocationStep(detected)}
                  className="w-full h-14 pl-6 pr-2.5 rounded-full bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-between shadow-[0_10px_24px_rgba(54,43,61,0.22)] active:scale-[0.98] transition-all"
                >
                  <span>Sí, estoy aquí</span>
                  <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="text-sm font-medium text-[#584B63] hover:text-[#2A2130] underline underline-offset-4 py-2 px-4 transition-colors"
                  >
                    No, estoy en otro lugar
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="permissions-panel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="space-y-1.5 text-center">
                <h1 className="font-display text-[26px] sm:text-[30px] leading-[1.12] font-bold tracking-tight text-[#2A2130] text-balance">
                  {hasConfirmedLocation && grantedCount > 0 && !allGranted
                    ? 'Permisos pendientes'
                    : 'Permisos de la app'}
                </h1>
                <p className="text-sm text-[#584B63] leading-relaxed">
                  {hasConfirmedLocation && grantedCount > 0 && !allGranted
                    ? 'Aún faltan permisos por activar para aprovechar todas las funciones de Quemarket.'
                    : (
                        <>
                          Actívalos para publicar fotos, enviar audios, recibir alertas y ubicar entregas en{' '}
                          <span className="font-semibold text-[#2A2130]">{detected.city}</span>.
                        </>
                      )}
                </p>
              </div>

              {/* Dedicated App Permissions Area (WebView & Android APK) */}
              <div className="border-y border-[#362B3D]/10 py-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-[#F1E8FC] text-[#362B3D] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-xs font-bold text-[#2A2130] leading-tight">
                        Permisos necesarios de la app
                      </p>
                      <p className="text-[11px] text-[#584B63] tabular-nums">
                        {grantedCount} de {permissionItems.length} activados
                      </p>
                    </div>
                  </div>

                  {!allGranted ? (
                    <button
                      type="button"
                      onClick={handleRequestAllPermissions}
                      disabled={requestingPerm !== null}
                      className="h-8 px-3 rounded-xl bg-[#362B3D] hover:bg-[#2A2130] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors active:scale-95 disabled:opacity-60"
                    >
                      {requestingPerm === 'all' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {grantedCount > 0 ? 'Permitir faltantes' : 'Permitir todos'}
                    </button>
                  ) : (
                    <span className="h-7 px-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      Listos
                    </span>
                  )}
                </div>

                <div className="divide-y divide-[#362B3D]/8">
                  {permissionItems.map((item) => {
                    const Icon = item.icon;
                    const state = permissions[item.key];
                    const isGranted = state === 'granted';
                    const isDenied = state === 'denied';
                    const isLoading = requestingPerm === item.key || (requestingPerm === 'all' && !isGranted);

                    return (
                      <div
                        key={item.key}
                        className="min-h-[46px] py-2 flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isGranted
                                ? 'bg-emerald-50 text-emerald-700'
                                : isDenied
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-[#F4EFFA] text-[#362B3D]'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#2A2130] leading-tight truncate">
                              {item.label}
                            </p>
                            <p className="text-[11px] text-[#584B63] leading-tight truncate">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {isGranted ? (
                          <span className="h-7 px-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            Activo
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestSinglePermission(item.key)}
                            disabled={requestingPerm !== null}
                            className={`h-8 px-3 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors active:scale-95 disabled:opacity-60 ${
                              isDenied
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-[#F4EFFA] hover:bg-[#E7DBF7] text-[#362B3D]'
                            }`}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isDenied ? (
                              'Reintentar'
                            ) : (
                              'Activar'
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {permissionFeedback && (
                  <p className="text-[11px] leading-snug text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
                    {permissionFeedback}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onConfirm(detected)}
                  className="w-full h-14 pl-6 pr-2.5 rounded-full bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-[15px] flex items-center justify-between shadow-[0_10px_24px_rgba(54,43,61,0.22)] active:scale-[0.98] transition-all"
                >
                  <span>{allGranted ? 'Entrar a Quemarket' : 'Continuar a Quemarket'}</span>
                  <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </span>
                </button>
              </div>
            </motion.div>
          )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Bottom spacer matching header height only when top header is visible and keyboard is closed */}
      {showTopHeader && !keyboardOpen && <div className="h-10 shrink-0" aria-hidden="true" />}

      <CityPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentCity={detected}
        onSelectCity={(loc) => {
          setPickerOpen(false);
          void handleConfirmLocationStep(loc);
        }}
      />

      <TermsModalSheet
        open={termsSheetOpen}
        onClose={() => setTermsSheetOpen(false)}
        onAccept={() => {
          setHasReadTerms(true);
          setTermsAccepted(true);
          setAuthError(null);
        }}
      />
    </div>
  );
}
