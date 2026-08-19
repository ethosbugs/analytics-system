import { createClient } from "@supabase/supabase-js";

// Cliente con la Service Role Key: SOLO se usa en el servidor, nunca se expone al cliente
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cache en memoria del proceso serverless para no golpear la DB en cada request.
// Se refresca cada 60s; con 200 eventos/mes es más que suficiente.
let siteCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 60_000;

async function getSites() {
  const now = Date.now();
  if (siteCache.data && now - siteCache.fetchedAt < CACHE_TTL_MS) {
    return siteCache.data;
  }
  const { data, error } = await supabase.from("sites").select("*");
  if (error) throw error;
  siteCache = { data, fetchedAt: now };
  return data;
}

// Límite simple de tamaño/campos para evitar payloads abusivos
const MAX_STRING_LEN = 2000;
const MAX_FIELDS = 50;

function sanitizeValue(val, depth = 0) {
  if (depth > 3) return null; // evita objetos anidados maliciosos/gigantes
  if (typeof val === "string") return val.slice(0, MAX_STRING_LEN);
  if (typeof val === "number" || typeof val === "boolean" || val === null) return val;
  if (Array.isArray(val)) return val.slice(0, MAX_FIELDS).map((v) => sanitizeValue(v, depth + 1));
  if (typeof val === "object") {
    const out = {};
    let i = 0;
    for (const key of Object.keys(val)) {
      if (i++ >= MAX_FIELDS) break;
      out[String(key).slice(0, 100)] = sanitizeValue(val[key], depth + 1);
    }
    return out;
  }
  return null;
}

// Rate limit muy simple en memoria por IP (suficiente a bajo volumen; en alto
// volumen conviene mover esto a Upstash Redis, ver README).
const rateBucket = new Map();
const RATE_LIMIT = 60; // eventos por minuto por IP
function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (rateBucket.get(ip) || []).filter((t) => t > windowStart);
  hits.push(now);
  rateBucket.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

function corsHeaders(origin, allowed) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export async function OPTIONS(req) {
  const origin = req.headers.get("origin") || "";
  return new Response(null, { status: 204, headers: corsHeaders(origin, true) });
}

export async function POST(req) {
  const origin = req.headers.get("origin") || "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const { site_id, api_key, session_id, event_type, payload, context, ts } = body || {};

  if (!site_id || !event_type) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }

  // 1. Validar que el sitio existe y que la API key + el dominio de origen coinciden
  let sites;
  try {
    sites = await getSites();
  } catch {
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500 });
  }

  const site = sites.find((s) => s.site_id === site_id);
  if (!site || site.api_key !== api_key) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const originHost = (() => {
    try {
      return new URL(origin).host;
    } catch {
      return null;
    }
  })();
  const allowedDomains = site.allowed_domains || []; // array en la tabla sites
  const originAllowed =
    allowedDomains.length === 0 || allowedDomains.includes(originHost);

  if (!originAllowed) {
    return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
      status: 403,
      headers: corsHeaders(origin, false),
    });
  }

  // 2. Rate limit
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: corsHeaders(origin, true),
    });
  }

  // 3. Sanitizar
  const cleanPayload = sanitizeValue(payload || {});
  const cleanContext = sanitizeValue(context || {});
  const cleanEventType = String(event_type).slice(0, 64);

  // 4. Insertar
  const { error } = await supabase.from("events").insert({
    site_id: site.site_id,
    session_id: session_id ? String(session_id).slice(0, 64) : null,
    event_type: cleanEventType,
    payload: cleanPayload,
    context: cleanContext,
    ip_hash: hashIp(ip), // guardamos un hash, no la IP en crudo
    created_at: ts && !isNaN(Date.parse(ts)) ? ts : new Date().toISOString(),
  });

  if (error) {
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: corsHeaders(origin, true),
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: corsHeaders(origin, true),
  });
}

// Hash simple e irreversible de la IP para poder deduplicar/contar sin guardar PII en crudo
function hashIp(ip) {
  let hash = 0;
  const salt = process.env.IP_HASH_SALT || "change-me";
  const str = ip + salt;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}
