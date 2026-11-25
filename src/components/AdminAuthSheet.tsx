import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import {
  AdminServerStatus,
  AdminSessionResult,
  fetchAdminServerStatus,
  loginAdminServer,
  PRIMARY_ADMIN_EMAIL,
  setupAdminPassword,
} from '../lib/adminService';
import { BottomSheet } from './BottomSheet';

interface AdminAuthSheetProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (session: AdminSessionResult) => void;
}

export function AdminAuthSheet({ open, onClose, onAuthenticated }: AdminAuthSheetProps) {
  const [status, setStatus] = useState<AdminServerStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [email, setEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setLoadingStatus(true);

    fetchAdminServerStatus()
      .then((res) => {
        if (!active) return;
        setStatus(res);
        setEmail(res.adminEmail || PRIMARY_ADMIN_EMAIL);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo conectar con el servidor de administración.'
        );
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const isSetupMode = status !== null && !status.configured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Ingresa el correo de administrador.');
      return;
    }

    if (isSetupMode) {
      if (password.length < 8) {
        setError('La clave de administrador debe tener al menos 8 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las claves no coinciden.');
        return;
      }
      setSubmitting(true);
      try {
        const session = await setupAdminPassword({
          email: cleanEmail,
          password,
          confirmPassword,
        });
        setPassword('');
        setConfirmPassword('');
        onAuthenticated(session);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo activar el acceso.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Ingresa tu clave de administrador.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await loginAdminServer({ email: cleanEmail, password });
      setPassword('');
      onAuthenticated(session);
    } catch (err) {
      const typedErr = err as Error & { needsSetup?: boolean };
      if (typedErr.needsSetup) {
        setStatus((prev) =>
          prev
            ? { ...prev, configured: false, mode: 'unconfigured' }
            : { adminEmail: PRIMARY_ADMIN_EMAIL, configured: false, mode: 'unconfigured' }
        );
      }
      setError(typedErr.message || 'Credenciales incorrectas.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isSetupMode ? 'Activar cuenta administradora' : 'Acceso de Administración'}
      subtitle={
        isSetupMode
          ? 'Configuración inicial única protegida en el servidor'
          : 'Panel de control y moderación de Quemarket'
      }
      zIndexClass="z-[70]"
    >
      {loadingStatus ? (
        <div className="py-10 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#362B3D]" />
          <p className="text-xs font-medium">Verificando estado del servidor...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl bg-[#F4EFFA] border border-[#362B3D]/12 p-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#362B3D] text-white flex items-center justify-center shrink-0">
              {isSetupMode ? <KeyRound className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="font-display text-xs font-bold text-[#2A2130]">
                {isSetupMode
                  ? 'Define la clave inicial del administrador'
                  : 'Autenticación verificada en servidor'}
              </p>
              <p className="text-[11px] text-[#584B63] leading-relaxed">
                {isSetupMode
                  ? `Registra la clave para ${status?.adminEmail || PRIMARY_ADMIN_EMAIL}. Se almacena con cifrado scrypt y bloquea este formulario tras completarse.`
                  : 'Tu sesión de administración se firma en el servidor y permanece únicamente en memoria.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="admin-email-input"
                className="text-xs font-semibold text-[#141118] block px-0.5"
              >
                Correo administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B4E8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-email-input"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@quemarket.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-zinc-100 border border-zinc-200/80 text-[16px] sm:text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-[#362B3D]/40 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="admin-password-input"
                className="text-xs font-semibold text-[#141118] block px-0.5"
              >
                {isSetupMode ? 'Nueva clave de administrador' : 'Clave de administrador'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B4E8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={isSetupMode ? 8 : 1}
                  autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu clave"
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-zinc-100 border border-zinc-200/80 text-[16px] sm:text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-[#362B3D]/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar clave' : 'Ver clave'}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-[#141118] absolute right-1 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSetupMode && (
              <div className="space-y-1">
                <label
                  htmlFor="admin-confirm-password-input"
                  className="text-xs font-semibold text-[#141118] block px-0.5"
                >
                  Confirmar clave
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6B4E8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-confirm-password-input"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la clave"
                    className="w-full h-11 pl-10 pr-11 rounded-xl bg-zinc-100 border border-zinc-200/80 text-[16px] sm:text-sm text-[#141118] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-[#362B3D]/40 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? 'Ocultar confirmación' : 'Ver confirmación'}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-[#141118] absolute right-1 top-1/2 -translate-y-1/2"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200/80 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 pl-5 pr-2.5 rounded-2xl bg-[#362B3D] hover:bg-[#2A2130] text-white font-display font-semibold text-sm flex items-center justify-between shadow-sm active:scale-[0.98] transition-all disabled:opacity-55"
          >
            <span>
              {submitting
                ? 'Verificando...'
                : isSetupMode
                  ? 'Activar y entrar al panel'
                  : 'Entrar a Administración'}
            </span>
            <span className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </span>
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
