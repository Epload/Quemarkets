import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';

interface BcvRateRecord {
  usdToVes: number;
  rawRate: string;
  valueDateLabel: string;
  valueDateIso: string;
  caracasDate: string;
  fetchedAtMs: number;
  source: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const REFRESH_MAX_AGE_MS = 4 * 60 * 60 * 1000; // Refresh at least every 4h and on every new Venezuela day

// Scoped agent strictly for bcv.org.ve due to its incomplete intermediate SSL chain in Node.js
const bcvHttpsAgent = new https.Agent({ rejectUnauthorized: false });

let cachedRate: BcvRateRecord | null = null;
let inflightFetch: Promise<BcvRateRecord> | null = null;

function getCaracasDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseVenezuelanNumber(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  const hasComma = trimmed.includes(',');
  const normalized = hasComma
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) && num > 0 ? num : NaN;
}

function fetchTextWithTimeout(url: string, insecureBcvTls = false, timeoutMs = 9000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        ...(insecureBcvTls ? { agent: bcvHttpsAgent } : {}),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Quemarket/1.0)',
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9',
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const nextUrl = new URL(res.headers.location, url).toString();
          res.resume();
          fetchTextWithTimeout(nextUrl, insecureBcvTls, timeoutMs).then(resolve, reject);
          return;
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode || 0} from ${url}`));
          return;
        }
        res.setEncoding('utf8');
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body));
      }
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

async function scrapeOfficialBcvOrgVe(): Promise<BcvRateRecord> {
  const html = await fetchTextWithTimeout('https://www.bcv.org.ve/', true, 9000);
  const dolarMatch = html.match(/id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i);
  if (!dolarMatch?.[1]) {
    throw new Error('Could not locate USD rate in bcv.org.ve HTML');
  }

  const usdToVes = parseVenezuelanNumber(dolarMatch[1]);
  if (!Number.isFinite(usdToVes)) {
    throw new Error(`Invalid BCV USD rate value: ${dolarMatch[1]}`);
  }

  const dateMatch = html.match(
    /Fecha\s*Valor:\s*<span[^>]*content=["']([^"']+)["'][^>]*>([^<]+)<\/span>/i
  );
  const valueDateIso = dateMatch?.[1]?.trim() || new Date().toISOString();
  const valueDateLabel = (dateMatch?.[2] || '').replace(/\s+/g, ' ').trim();

  return {
    usdToVes,
    rawRate: dolarMatch[1].trim(),
    valueDateLabel,
    valueDateIso,
    caracasDate: getCaracasDateKey(),
    fetchedAtMs: Date.now(),
    source: 'bcv.org.ve',
  };
}

async function fetchFallbackOfficialRate(): Promise<BcvRateRecord> {
  const jsonText = await fetchTextWithTimeout('https://ve.dolarapi.com/v1/dolares/oficial', false, 7000);
  const parsed = JSON.parse(jsonText) as {
    promedio?: number;
    fechaActualizacion?: string;
  };
  const usdToVes = Number(parsed?.promedio);
  if (!Number.isFinite(usdToVes) || usdToVes <= 0) {
    throw new Error('Invalid fallback official rate');
  }
  const caracasDate = getCaracasDateKey();
  return {
    usdToVes,
    rawRate: usdToVes.toFixed(4).replace('.', ','),
    valueDateLabel: new Intl.DateTimeFormat('es-VE', {
      timeZone: 'America/Caracas',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
    valueDateIso: parsed.fechaActualizacion || new Date().toISOString(),
    caracasDate,
    fetchedAtMs: Date.now(),
    source: 'bcv.org.ve (respaldo oficial)',
  };
}

async function refreshBcvRate(force = false): Promise<BcvRateRecord> {
  const todayCaracas = getCaracasDateKey();
  const isFresh =
    cachedRate !== null &&
    cachedRate.caracasDate === todayCaracas &&
    Date.now() - cachedRate.fetchedAtMs < REFRESH_MAX_AGE_MS;

  if (!force && isFresh && cachedRate) {
    return cachedRate;
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = (async () => {
    try {
      const fresh = await scrapeOfficialBcvOrgVe();
      cachedRate = fresh;
      return fresh;
    } catch {
      try {
        const fallback = await fetchFallbackOfficialRate();
        cachedRate = fallback;
        return fallback;
      } catch (err) {
        if (cachedRate) {
          return cachedRate;
        }
        throw err;
      }
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

interface AdminPlatformSettings {
  announcementEnabled: boolean;
  announcementText: string;
  allowNewListings: boolean;
  maintenanceMessage: string;
  updatedBy: string;
  updatedAtMs: number;
}

interface AdminTokenPayload {
  email: string;
  jti: string;
  iat: number;
  exp: number;
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@quemarket.com').trim().toLowerCase();
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

let claimedAdminCredential: { salt: string; hashHex: string } | null = null;
const revokedTokenIds = new Set<string>();
const adminAuthRateMap = new Map<string, { count: number; resetAtMs: number }>();

let serverPlatformSettings: AdminPlatformSettings = {
  announcementEnabled: false,
  announcementText: '',
  allowNewListings: true,
  maintenanceMessage: '',
  updatedBy: ADMIN_EMAIL,
  updatedAtMs: Date.now(),
};

type ListingModerationStatus = 'pending' | 'active' | 'sold' | 'rejected';

interface ServerModeratedListing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  priceUsd: number;
  category: string;
  subcategory?: string;
  condition: 'Nuevo' | 'Como nuevo' | 'Usado';
  state: string;
  city: string;
  lat: number;
  lng: number;
  imageUrl: string;
  imageUrls?: string[];
  vehicleDetails?: Record<string, unknown>;
  realEstateDetails?: Record<string, unknown>;
  status: ListingModerationStatus;
  createdAtMs: number;
  autoApproveAtMs: number;
  soldAtMs?: number;
  reviewedBy?: string;
  reviewedAtMs?: number;
  source: 'firestore';
}

const LISTING_AUTO_APPROVE_MS = 30 * 60 * 1000;
const MAX_SERVER_LISTINGS = 500;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const serverListingsMap = new Map<string, ServerModeratedListing>();
const serverRejectedListingIds = new Set<string>();
const listingSubmitRateMap = new Map<string, { count: number; resetAtMs: number }>();

type ServerVerificationStatus = 'pending' | 'approved' | 'rejected';

interface ServerIdentityVerification {
  uid: string;
  displayName: string;
  city: string;
  state: string;
  selfieUrl: string;
  idCardUrl: string;
  status: ServerVerificationStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  submittedAtMs: number;
  updatedAtMs: number;
}

const serverVerificationsMap = new Map<string, ServerIdentityVerification>();
const verificationSubmitRateMap = new Map<string, { count: number; resetAtMs: number }>();

function isSafeMediaUrl(url: unknown, maxLen: number): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return false;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/')
  );
}

function promoteExpiredPendingListings(): void {
  const now = Date.now();
  for (const item of serverListingsMap.values()) {
    if (item.status === 'pending' && now >= item.autoApproveAtMs) {
      item.status = 'active';
      item.reviewedBy = 'auto-30m';
      item.reviewedAtMs = now;
    }
  }
}

function pruneServerListingsIfNeeded(): void {
  if (serverListingsMap.size <= MAX_SERVER_LISTINGS) return;
  const entries = Array.from(serverListingsMap.values()).sort(
    (a, b) => a.createdAtMs - b.createdAtMs
  );
  for (const entry of entries) {
    if (serverListingsMap.size <= MAX_SERVER_LISTINGS) break;
    if (entry.status !== 'pending') {
      serverListingsMap.delete(entry.id);
    }
  }
}

function checkListingSubmitRateLimit(req: Request, res: Response): boolean {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = listingSubmitRateMap.get(ip);
  if (!entry || now > entry.resetAtMs) {
    listingSubmitRateMap.set(ip, { count: 1, resetAtMs: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 25) {
    res.status(429).json({
      error: 'Has enviado demasiadas publicaciones en poco tiempo. Espera unos minutos.',
    });
    return false;
  }
  entry.count += 1;
  return true;
}

function checkVerificationSubmitRateLimit(req: Request, res: Response): boolean {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = verificationSubmitRateMap.get(ip);
  if (!entry || now > entry.resetAtMs) {
    verificationSubmitRateMap.set(ip, { count: 1, resetAtMs: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) {
    res.status(429).json({
      error: 'Has enviado demasiadas solicitudes de verificación. Intenta nuevamente en unos minutos.',
    });
    return false;
  }
  entry.count += 1;
  return true;
}

function getEnvAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

function hashPasswordScrypt(password: string, saltHex: string): Buffer {
  return crypto.scryptSync(password, saltHex, 64);
}

function isAdminPasswordConfigured(): { configured: boolean; mode: 'env' | 'claimed' | 'unconfigured' } {
  if (getEnvAdminPassword().length > 0) {
    return { configured: true, mode: 'env' };
  }
  if (claimedAdminCredential !== null) {
    return { configured: true, mode: 'claimed' };
  }
  return { configured: false, mode: 'unconfigured' };
}

function verifyAdminPassword(candidate: string): boolean {
  const envPass = getEnvAdminPassword();
  if (envPass.length > 0) {
    const salt = 'quemarket_env_admin_salt';
    const expected = hashPasswordScrypt(envPass, salt);
    const actual = hashPasswordScrypt(candidate, salt);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  if (claimedAdminCredential) {
    const expected = Buffer.from(claimedAdminCredential.hashHex, 'hex');
    const actual = hashPasswordScrypt(candidate, claimedAdminCredential.salt);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  return false;
}

function signAdminToken(email: string): { token: string; expiresAtMs: number } {
  const now = Date.now();
  const expiresAtMs = now + ADMIN_SESSION_TTL_MS;
  const payload: AdminTokenPayload = {
    email,
    jti: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: expiresAtMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return { token: `${payloadB64}.${sigB64}`, expiresAtMs };
}

function verifyAdminToken(token: string): AdminTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadB64)
    .digest();
  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as AdminTokenPayload;
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      typeof parsed.jti !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > parsed.exp || revokedTokenIds.has(parsed.jti)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function checkAdminRateLimit(req: Request, res: Response): boolean {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = adminAuthRateMap.get(ip);
  if (!entry || now > entry.resetAtMs) {
    adminAuthRateMap.set(ip, { count: 1, resetAtMs: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 12) {
    res.status(429).json({
      error: 'Demasiados intentos de acceso. Espera unos minutos e intenta de nuevo.',
    });
    return false;
  }
  entry.count += 1;
  return true;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesión de administrador requerida.' });
    return;
  }
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesión de administrador inválida o expirada.' });
    return;
  }
  (req as Request & { adminPayload?: AdminTokenPayload }).adminPayload = payload;
  next();
}

function resolveApkFilePath(): string | null {
  const candidates = [
    path.resolve(__dirname, 'releases', 'Quemarket.apk'),
    path.resolve(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    path.resolve(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function startServer() {
  const app = express();
  const standardJsonParser = express.json({ limit: '64kb' });
  const mediaSubmitParser = express.json({ limit: '2mb' });

  app.use((req, res, next) => {
    if (req.path === '/api/listings/submit' || req.path === '/api/verifications/submit') {
      next();
      return;
    }
    standardJsonParser(req, res, next);
  });

  app.get('/api/platform-settings', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(serverPlatformSettings);
  });

  app.get('/api/admin/status', (_req, res) => {
    const status = isAdminPasswordConfigured();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      adminEmail: ADMIN_EMAIL,
      configured: status.configured,
      mode: status.mode,
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    if (!checkAdminRateLimit(req, res)) return;
    const status = isAdminPasswordConfigured();
    if (status.configured) {
      res.status(409).json({
        error: 'La clave de administrador ya está configurada. Inicia sesión con tus credenciales.',
      });
      return;
    }
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword =
      typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (rawEmail !== ADMIN_EMAIL) {
      res.status(400).json({
        error: `El correo administrador autorizado es ${ADMIN_EMAIL}.`,
      });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({
        error: 'La clave de administrador debe tener entre 8 y 128 caracteres.',
      });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Las claves no coinciden.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = hashPasswordScrypt(password, salt).toString('hex');
    claimedAdminCredential = { salt, hashHex };

    const { token, expiresAtMs } = signAdminToken(ADMIN_EMAIL);
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      token,
      email: ADMIN_EMAIL,
      expiresAtMs,
    });
  });

  app.post('/api/admin/login', (req, res) => {
    if (!checkAdminRateLimit(req, res)) return;
    const status = isAdminPasswordConfigured();
    if (!status.configured) {
      res.status(409).json({
        error: 'Activa primero la clave de administrador en la configuración inicial.',
        needsSetup: true,
      });
      return;
    }
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (rawEmail !== ADMIN_EMAIL || !password || !verifyAdminPassword(password)) {
      res.status(401).json({ error: 'Correo o clave de administrador incorrectos.' });
      return;
    }

    const { token, expiresAtMs } = signAdminToken(ADMIN_EMAIL);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      token,
      email: ADMIN_EMAIL,
      expiresAtMs,
    });
  });

  app.get('/api/admin/session', requireAdminAuth, (req, res) => {
    const payload = (req as Request & { adminPayload?: AdminTokenPayload }).adminPayload!;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      authenticated: true,
      email: payload.email,
      expiresAtMs: payload.exp,
    });
  });

  app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
    const payload = (req as Request & { adminPayload?: AdminTokenPayload }).adminPayload!;
    revokedTokenIds.add(payload.jti);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  app.put('/api/admin/settings', requireAdminAuth, (req, res) => {
    const payload = (req as Request & { adminPayload?: AdminTokenPayload }).adminPayload!;
    const announcementEnabled = Boolean(req.body?.announcementEnabled);
    const announcementText =
      typeof req.body?.announcementText === 'string'
        ? req.body.announcementText.trim().slice(0, 280)
        : '';
    const allowNewListings =
      typeof req.body?.allowNewListings === 'boolean' ? req.body.allowNewListings : true;
    const maintenanceMessage =
      typeof req.body?.maintenanceMessage === 'string'
        ? req.body.maintenanceMessage.trim().slice(0, 280)
        : '';

    serverPlatformSettings = {
      announcementEnabled,
      announcementText,
      allowNewListings,
      maintenanceMessage,
      updatedBy: payload.email,
      updatedAtMs: Date.now(),
    };

    res.setHeader('Cache-Control', 'no-store');
    res.json(serverPlatformSettings);
  });

  app.post('/api/admin/bcv-refresh', requireAdminAuth, async (_req, res) => {
    try {
      const data = await refreshBcvRate(true);
      res.setHeader('Cache-Control', 'no-store');
      res.json(data);
    } catch {
      res.status(503).json({
        error: 'No se pudo refrescar la tasa oficial del BCV en este momento.',
      });
    }
  });

  // --- Listing Review Queue & 30-Minute Auto-Approval Endpoints ---
  app.post('/api/listings/submit', mediaSubmitParser, (req, res) => {
    if (!checkListingSubmitRateLimit(req, res)) return;
    if (!serverPlatformSettings.allowNewListings) {
      res.status(403).json({
        error: 'Las nuevas publicaciones están pausadas temporalmente por administración.',
      });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Datos de publicación inválidos.' });
      return;
    }

    const rawId = typeof body.id === 'string' ? body.id.trim() : '';
    const id = SAFE_ID_REGEX.test(rawId)
      ? rawId
      : `lst_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    if (serverListingsMap.has(id)) {
      res.status(200).json({ listing: serverListingsMap.get(id) });
      return;
    }

    const sellerId = typeof body.sellerId === 'string' ? body.sellerId.trim() : '';
    const sellerName = typeof body.sellerName === 'string' ? body.sellerName.trim().slice(0, 80) : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
    const description =
      typeof body.description === 'string' ? body.description.trim().slice(0, 600) : '';
    const priceUsd = Number(body.priceUsd);
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 50) : '';
    const subcategory =
      typeof body.subcategory === 'string' && body.subcategory.trim()
        ? body.subcategory.trim().slice(0, 60)
        : undefined;
    const condition =
      body.condition === 'Nuevo' || body.condition === 'Como nuevo' || body.condition === 'Usado'
        ? body.condition
        : null;
    const state = typeof body.state === 'string' ? body.state.trim().slice(0, 60) : '';
    const city = typeof body.city === 'string' ? body.city.trim().slice(0, 60) : '';
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (
      !SAFE_ID_REGEX.test(sellerId) ||
      sellerName.length < 1 ||
      title.length < 2 ||
      !Number.isFinite(priceUsd) ||
      priceUsd <= 0 ||
      priceUsd > 1000000 ||
      category.length < 1 ||
      !condition ||
      state.length < 1 ||
      city.length < 1 ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !isSafeMediaUrl(body.imageUrl, 350000)
    ) {
      res.status(400).json({ error: 'Faltan campos válidos en la publicación.' });
      return;
    }

    const safeImageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls
          .filter((u): u is string => isSafeMediaUrl(u, 165000))
          .slice(0, 5)
      : [body.imageUrl];

    const now = Date.now();
    const record: ServerModeratedListing = {
      id,
      sellerId,
      sellerName,
      title,
      description,
      priceUsd: Math.min(1000000, Math.max(1, priceUsd)),
      category,
      ...(subcategory ? { subcategory } : {}),
      condition,
      state,
      city,
      lat,
      lng,
      imageUrl: body.imageUrl,
      imageUrls: safeImageUrls.length > 0 ? safeImageUrls : [body.imageUrl],
      ...(body.vehicleDetails && typeof body.vehicleDetails === 'object'
        ? { vehicleDetails: body.vehicleDetails as Record<string, unknown> }
        : {}),
      ...(body.realEstateDetails && typeof body.realEstateDetails === 'object'
        ? { realEstateDetails: body.realEstateDetails as Record<string, unknown> }
        : {}),
      status: 'pending',
      createdAtMs: now,
      autoApproveAtMs: now + LISTING_AUTO_APPROVE_MS,
      source: 'firestore',
    };

    serverListingsMap.set(id, record);
    pruneServerListingsIfNeeded();

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ listing: record });
  });

  app.get('/api/listings/public', (_req, res) => {
    promoteExpiredPendingListings();
    const SOLD_WINDOW_MS = 60 * 60 * 1000;
    const now = Date.now();
    const publicListings = Array.from(serverListingsMap.values())
      .filter((item) => {
        if (item.status === 'active') return true;
        return (
          item.status === 'sold' &&
          typeof item.soldAtMs === 'number' &&
          now - item.soldAtMs < SOLD_WINDOW_MS
        );
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      listings: publicListings,
      rejectedIds: Array.from(serverRejectedListingIds),
    });
  });

  app.get('/api/listings/status', (req, res) => {
    promoteExpiredPendingListings();
    const rawIds = typeof req.query.ids === 'string' ? req.query.ids : '';
    const ids = rawIds
      .split(',')
      .map((s) => s.trim())
      .filter((s) => SAFE_ID_REGEX.test(s))
      .slice(0, 40);

    const statuses: Record<
      string,
      { status: ListingModerationStatus; autoApproveAtMs: number; soldAtMs?: number }
    > = {};
    for (const id of ids) {
      const item = serverListingsMap.get(id);
      if (item) {
        statuses[id] = {
          status: item.status,
          autoApproveAtMs: item.autoApproveAtMs,
          ...(typeof item.soldAtMs === 'number' ? { soldAtMs: item.soldAtMs } : {}),
        };
      } else if (serverRejectedListingIds.has(id)) {
        statuses[id] = { status: 'rejected', autoApproveAtMs: 0 };
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ statuses });
  });

  app.get('/api/admin/listings', requireAdminAuth, (_req, res) => {
    promoteExpiredPendingListings();
    const all = Array.from(serverListingsMap.values()).sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      listings: all,
      autoApproveMinutes: 30,
    });
  });

  app.post('/api/admin/listings/:id/status', requireAdminAuth, (req, res) => {
    promoteExpiredPendingListings();
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'Identificador de publicación inválido.' });
      return;
    }
    const nextStatus = req.body?.status;
    if (
      nextStatus !== 'pending' &&
      nextStatus !== 'active' &&
      nextStatus !== 'sold' &&
      nextStatus !== 'rejected'
    ) {
      res.status(400).json({ error: 'Estado de moderación inválido.' });
      return;
    }

    const payload = (req as Request & { adminPayload?: AdminTokenPayload }).adminPayload!;
    const now = Date.now();
    const existing = serverListingsMap.get(id);
    if (existing) {
      existing.status = nextStatus;
      existing.reviewedBy = payload.email;
      existing.reviewedAtMs = now;
      if (nextStatus === 'sold') {
        existing.soldAtMs = now;
      } else if (nextStatus === 'active') {
        existing.soldAtMs = undefined;
      }
    }

    if (nextStatus === 'rejected') {
      serverRejectedListingIds.add(id);
    } else if (nextStatus === 'active' || nextStatus === 'pending') {
      serverRejectedListingIds.delete(id);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      id,
      status: nextStatus,
      listing: existing || null,
    });
  });

  app.delete('/api/admin/listings/:id', requireAdminAuth, (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'Identificador de publicación inválido.' });
      return;
    }
    serverListingsMap.delete(id);
    serverRejectedListingIds.add(id);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, id });
  });

  // --- Identity Verification (Selfie + Cédula) Endpoints ---
  app.post('/api/verifications/submit', mediaSubmitParser, (req, res) => {
    if (!checkVerificationSubmitRateLimit(req, res)) return;

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Datos de verificación inválidos.' });
      return;
    }

    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 80) : '';
    const city = typeof body.city === 'string' ? body.city.trim().slice(0, 60) : '';
    const state = typeof body.state === 'string' ? body.state.trim().slice(0, 60) : '';

    if (
      !SAFE_ID_REGEX.test(uid) ||
      displayName.length < 1 ||
      city.length < 1 ||
      state.length < 1 ||
      !isSafeMediaUrl(body.selfieUrl, 220000) ||
      !isSafeMediaUrl(body.idCardUrl, 220000)
    ) {
      res.status(400).json({
        error: 'Debes adjuntar una selfie y una foto clara de tu cédula para solicitar verificación.',
      });
      return;
    }

    const existing = serverVerificationsMap.get(uid);
    if (existing?.status === 'approved') {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        status: 'approved',
        submittedAtMs: existing.submittedAtMs,
        updatedAtMs: existing.updatedAtMs,
      });
      return;
    }

    const now = Date.now();
    const record: ServerIdentityVerification = {
      uid,
      displayName,
      city,
      state,
      selfieUrl: body.selfieUrl,
      idCardUrl: body.idCardUrl,
      status: 'pending',
      submittedAtMs: now,
      updatedAtMs: now,
    };

    serverVerificationsMap.set(uid, record);
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      status: record.status,
      submittedAtMs: record.submittedAtMs,
      updatedAtMs: record.updatedAtMs,
    });
  });

  app.get('/api/verifications/status', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim() : '';
    if (!SAFE_ID_REGEX.test(uid)) {
      res.status(400).json({ error: 'Identificador de usuario inválido.' });
      return;
    }

    const record = serverVerificationsMap.get(uid);
    res.setHeader('Cache-Control', 'no-store');
    if (!record) {
      res.json({ status: 'none' });
      return;
    }

    res.json({
      status: record.status,
      ...(record.rejectionReason ? { rejectionReason: record.rejectionReason } : {}),
      submittedAtMs: record.submittedAtMs,
      updatedAtMs: record.updatedAtMs,
    });
  });

  app.get('/api/verifications/public', (_req, res) => {
    const verifiedUids: string[] = [];
    for (const record of serverVerificationsMap.values()) {
      if (record.status === 'approved') {
        verifiedUids.push(record.uid);
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ verifiedUids });
  });

  app.get('/api/admin/verifications', requireAdminAuth, (_req, res) => {
    const all = Array.from(serverVerificationsMap.values()).sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return b.submittedAtMs - a.submittedAtMs;
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ verifications: all });
  });

  app.post('/api/admin/verifications/:uid/decision', requireAdminAuth, (req, res) => {
    const uid = typeof req.params.uid === 'string' ? req.params.uid.trim() : '';
    if (!SAFE_ID_REGEX.test(uid)) {
      res.status(400).json({ error: 'Identificador de usuario inválido.' });
      return;
    }

    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'Decisión de verificación inválida.' });
      return;
    }

    const rejectionReason =
      typeof req.body?.rejectionReason === 'string'
        ? req.body.rejectionReason.trim().slice(0, 240)
        : '';
    const displayNameFallback =
      typeof req.body?.displayName === 'string'
        ? req.body.displayName.trim().slice(0, 80)
        : 'Usuario Quemarket';
    const cityFallback =
      typeof req.body?.city === 'string' ? req.body.city.trim().slice(0, 60) : 'Venezuela';
    const stateFallback =
      typeof req.body?.state === 'string' ? req.body.state.trim().slice(0, 60) : '';

    const payload = (req as Request & { adminPayload?: AdminTokenPayload }).adminPayload!;
    const now = Date.now();
    const existing = serverVerificationsMap.get(uid);

    const updated: ServerIdentityVerification = existing
      ? {
          ...existing,
          status: decision,
          reviewedBy: payload.email,
          updatedAtMs: now,
          ...(decision === 'rejected' && rejectionReason
            ? { rejectionReason }
            : { rejectionReason: undefined }),
        }
      : {
          uid,
          displayName: displayNameFallback || 'Usuario Quemarket',
          city: cityFallback || 'Venezuela',
          state: stateFallback,
          selfieUrl: '',
          idCardUrl: '',
          status: decision,
          reviewedBy: payload.email,
          submittedAtMs: now,
          updatedAtMs: now,
          ...(decision === 'rejected' && rejectionReason ? { rejectionReason } : {}),
        };

    serverVerificationsMap.set(uid, updated);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, verification: updated });
  });

  app.get('/api/apk-info', (_req, res) => {
    const apkPath = resolveApkFilePath();
    res.setHeader('Cache-Control', 'no-store');
    if (!apkPath) {
      res.json({
        available: false,
        sizeBytes: 0,
        sizeLabel: '',
        versionName: '1.0',
        downloadUrl: '/downloads/Quemarket.apk',
      });
      return;
    }
    const stat = fs.statSync(apkPath);
    const sizeMb = stat.size / (1024 * 1024);
    res.json({
      available: true,
      sizeBytes: stat.size,
      sizeLabel: `${sizeMb.toFixed(1)} MB`,
      versionName: '1.0',
      downloadUrl: '/downloads/Quemarket.apk',
    });
  });

  app.get('/downloads/Quemarket.apk', (_req, res) => {
    const apkPath = resolveApkFilePath();
    if (!apkPath) {
      res.status(404).json({
        error: 'El archivo APK de Quemarket no está disponible todavía.',
      });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="Quemarket.apk"');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(apkPath);
  });

  app.get('/api/bcv-rate', async (req, res) => {
    try {
      const force = req.query.force === '1';
      const data = await refreshBcvRate(force);
      res.setHeader('Cache-Control', 'no-store');
      res.json(data);
    } catch {
      res.status(503).json({
        error: 'No se pudo obtener la tasa oficial del BCV en este momento.',
      });
    }
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) {
      next(err);
      return;
    }
    const typedErr = err as { type?: string; status?: number } | null;
    if (typedErr?.type === 'entity.too.large' || typedErr?.status === 413) {
      res.status(413).json({
        error:
          'Las imágenes enviadas son demasiado pesadas. Intenta con fotos más ligeras.',
      });
      return;
    }
    if (typedErr?.type === 'entity.parse.failed' || typedErr?.status === 400) {
      res.status(400).json({ error: 'Formato de solicitud inválido.' });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    // Warm up daily BCV rate cache and keep it refreshed automatically every day
    refreshBcvRate(true).catch(() => {});
    setInterval(() => {
      refreshBcvRate(false).catch(() => {});
    }, 60 * 60 * 1000).unref();
    // Auto-approve pending listings 30 minutes after submission unless rejected by admin
    setInterval(() => {
      promoteExpiredPendingListings();
    }, 30 * 1000).unref();
  });
}

startServer();
