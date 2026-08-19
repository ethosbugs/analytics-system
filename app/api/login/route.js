export async function POST(req) {
  const { password } = await req.json();

  if (password !== process.env.DASHBOARD_SECRET) {
    return new Response(JSON.stringify({ error: "invalid_password" }), { status: 401 });
  }

  const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
  res.headers.set(
    "Set-Cookie",
    `dashboard_token=${process.env.DASHBOARD_SECRET}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
  );
  return res;
}
