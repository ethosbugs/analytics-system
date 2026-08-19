"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function DashboardPage() {
  const [authed, setAuthed] = useState(null); // null = comprobando
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- Comprobar sesión al cargar ----
  useEffect(() => {
    fetch("/api/sites")
      .then((r) => {
        if (r.status === 401) {
          setAuthed(false);
          return null;
        }
        setAuthed(true);
        return r.json();
      })
      .then((data) => {
        if (data?.sites) {
          setSites(data.sites);
          if (data.sites.length) setSiteId(data.sites[0].site_id);
        }
      });
  }, []);

  // ---- Cargar eventos cuando cambia el sitio/filtros ----
  useEffect(() => {
    if (!authed || !siteId) return;
    setLoading(true);
    const params = new URLSearchParams({ site_id: siteId, q: query, event_type: eventType });
    fetch(`/api/sites?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []))
      .finally(() => setLoading(false));
  }, [authed, siteId, query, eventType]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      setLoginError("Contraseña incorrecta");
    }
  }

  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.event_type))),
    [events]
  );

  const chartData = useMemo(() => {
    const byDay = {};
    events.forEach((e) => {
      const day = e.created_at.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([day, count]) => ({ day, count }));
  }, [events]);

  if (authed === null) return <Centered>Cargando…</Centered>;

  if (authed === false) {
    return (
      <Centered>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Panel de analítica</h1>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoFocus
          />
          {loginError && <span style={{ color: "#dc2626", fontSize: 13 }}>{loginError}</span>}
          <button type="submit" style={buttonStyle}>Entrar</button>
        </form>
      </Centered>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Panel de analítica</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={inputStyle}>
          {sites.map((s) => (
            <option key={s.site_id} value={s.site_id}>
              {s.name || s.site_id}
            </option>
          ))}
        </select>

        <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={inputStyle}>
          <option value="">Todos los tipos de evento</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Buscar por palabra clave…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
      </div>

      <div style={{ height: 220, marginBottom: 24, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left" }}>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Sesión</Th>
              <Th>Detalle</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>Cargando…</td></tr>
            )}
            {!loading && events.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>Sin eventos todavía</td></tr>
            )}
            {events.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                <Td>{new Date(e.created_at).toLocaleString()}</Td>
                <Td><code>{e.event_type}</code></Td>
                <Td style={{ fontFamily: "monospace", fontSize: 11 }}>{e.session_id?.slice(0, 10)}</Td>
                <Td>
                  <details>
                    <summary style={{ cursor: "pointer", color: "#4f46e5" }}>ver payload</summary>
                    <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
                      {JSON.stringify({ payload: e.payload, context: e.context }, null, 2)}
                    </pre>
                  </details>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      {children}
    </div>
  );
}
function Th({ children }) {
  return <th style={{ padding: "8px 12px", fontWeight: 600, color: "#374151" }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding: "8px 12px", verticalAlign: "top", ...style }}>{children}</td>;
}
const inputStyle = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 14,
};
const buttonStyle = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "none",
  background: "#4f46e5",
  color: "white",
  fontSize: 14,
  cursor: "pointer",
};
