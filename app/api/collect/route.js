export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { site_id, event_name, session_id, url, path, referrer, user_agent } = body;

    if (!site_id || !event_name || !session_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data, error } = await supabase.from("events").insert([
      {
        site_id,
        event_name,
        session_id,
        url,
        path,
        referrer,
        user_agent,
      },
    ]);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}