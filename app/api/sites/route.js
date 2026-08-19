import { createClient } from "@supabase/supabase-js";
import { requireDashboardAuth } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/sites            -> lista de sitios registrados
// GET /api/sites?site_id=x&q=texto&event_type=click&limit=100
//                            -> eventos de un sitio, con filtro por texto y tipo
export async function GET(req) {
  const authError = requireDashboardAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("site_id");

  if (!siteId) {
    const { data, error } = await supabase
      .from("sites")
      .select("site_id, name, allowed_domains, created_at")
      .order("created_at", { ascending: false });
    if (error) return json({ error: "server_error" }, 500);
    return json({ sites: data });
  }

  const q = searchParams.get("q") || "";
  const eventType = searchParams.get("event_type") || "";
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  let query = supabase
    .from("events")
    .select("id, event_type, payload, context, session_id, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventType) query = query.eq("event_type", eventType);

  // Búsqueda por palabra clave: filtra en el payload/contexto serializado.
  // Para volumenes bajos (~cientos/miles de filas) esto es suficiente sin
  // necesidad de un índice full-text dedicado.
  const { data, error } = await query;
  if (error) return json({ error: "server_error" }, 500);

  const filtered = q
    ? data.filter((row) => {
        const haystack = JSON.stringify(row.payload) + JSON.stringify(row.context);
        return haystack.toLowerCase().includes(q.toLowerCase());
      })
    : data;

  return json({ events: filtered });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
