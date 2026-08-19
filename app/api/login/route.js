export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { password } = await req.json();

    if (password === process.env.DASHBOARD_SECRET) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `dashboard_token=${process.env.DASHBOARD_SECRET}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}