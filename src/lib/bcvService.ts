export interface BcvRateInfo {
  usdToVes: number;
  rawRate: string;
  valueDateLabel: string;
  valueDateIso: string;
  caracasDate: string;
  fetchedAtMs: number;
  source: string;
}

const STORAGE_BCV_KEY = 'quemarket_bcv_rate_v1';
const CLIENT_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export function getCaracasTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function getCachedBcvRate(): BcvRateInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_BCV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BcvRateInfo;
    if (!parsed || typeof parsed.usdToVes !== 'number' || parsed.usdToVes <= 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isBcvRateFreshForToday(info: BcvRateInfo | null): boolean {
  if (!info) return false;
  const today = getCaracasTodayKey();
  return info.caracasDate === today && Date.now() - info.fetchedAtMs < CLIENT_MAX_AGE_MS;
}

async function fetchBcvFallbackDirect(): Promise<BcvRateInfo> {
  const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('No se pudo consultar la tasa del BCV');
  }
  const json = (await res.json()) as {
    promedio?: number;
    precio?: number;
    fechaActualizacion?: string;
  };
  const usdToVes = Number(json.promedio || json.precio || 0);
  if (!Number.isFinite(usdToVes) || usdToVes <= 0) {
    throw new Error('Tasa del BCV inválida');
  }
  const caracasDate = getCaracasTodayKey();
  const formattedRate = usdToVes.toFixed(2).replace('.', ',');
  const dateObj = json.fechaActualizacion ? new Date(json.fechaActualizacion) : new Date();
  const valueDateLabel = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dateObj);

  return {
    usdToVes: Number(usdToVes.toFixed(4)),
    rawRate: formattedRate,
    valueDateLabel,
    valueDateIso: json.fechaActualizacion || new Date().toISOString(),
    caracasDate,
    fetchedAtMs: Date.now(),
    source: 'bcv-direct',
  };
}

export async function fetchDailyBcvRate(force = false): Promise<BcvRateInfo> {
  const cached = getCachedBcvRate();
  if (!force && isBcvRateFreshForToday(cached) && cached) {
    return cached;
  }

  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/bcv-rate${force ? '?force=1' : ''}`;

  let data: BcvRateInfo | null = null;
  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const parsed = (await res.json()) as BcvRateInfo;
      if (parsed && typeof parsed.usdToVes === 'number' && parsed.usdToVes > 0) {
        data = parsed;
      }
    }
  } catch {
    // Expected inside standalone APK without local Express backend
  }

  if (!data) {
    try {
      data = await fetchBcvFallbackDirect();
    } catch (err) {
      if (cached) return cached;
      throw err instanceof Error ? err : new Error('No se pudo consultar la tasa del BCV');
    }
  }

  try {
    localStorage.setItem(STORAGE_BCV_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota errors
  }
  return data;
}

export function formatBolivares(amountVes: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountVes);
}
