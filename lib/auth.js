// Autenticación mínima para uso personal: una contraseña compartida en una
// cookie firmada. Suficiente para "solo yo la uso"; si en el futuro quieres
// varios usuarios, sustituye esto por Supabase Auth (ver README).

export function requireDashboardAuth(req) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/dashboard_token=([^;]+)/);
  const token = match ? match[1] : null;

  if (token !== process.env.DASHBOARD_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
