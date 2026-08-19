export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireDashboardAuth } from "@/lib/auth";

export async function GET(req) {
  const authError = requireDashboardAuth(req);
  if (authError) return authError;

  try {
    const { data, error } = await supabase.from("sites").select("*");
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req) {
  const authError = requireDashboardAuth(req);
  if (authError) return authError;

  try {
    const { name, domain } = await req.json();

    if (!name || !domain) {
      return new Response(JSON.stringify({ error: "Name and domain are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("sites")
      .insert([{ name, domain }])
      .select();

    if (error) throw error;

    return new Response(JSON.stringify(data[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}