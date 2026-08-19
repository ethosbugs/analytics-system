/**
 * analytics.js — Script cliente de telemetría reutilizable
 * -----------------------------------------------------------
 * Uso en cualquier web:
 *
 * <script
 *   src="https://TU-DOMINIO.vercel.app/analytics.js"
 *   data-site-id="mi-blog-personal"
 *   data-api-key="pk_live_xxxxxxxx"
 *   data-collect="views,clicks,forms,scroll"
 *   data-endpoint="https://TU-DOMINIO.vercel.app/api/collect"
 *   defer
 * ></script>
 *
 * No requiere dependencias. No usa localStorage/sessionStorage.
 * Todo evento se envía al servidor de inmediato (o en el unload
 * de la página vía sendBeacon).
 */
(function () {
  "use strict";

  // ---------- 1. Leer configuración desde el propio <script> ----------
  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var cfg = {
    siteId: currentScript.getAttribute("data-site-id"),
    apiKey: currentScript.getAttribute("data-api-key") || "",
    endpoint: currentScript.getAttribute("data-endpoint"),
    collect: (currentScript.getAttribute("data-collect") || "views")
      .split(",")
      .map(function (s) {
        return s.trim().toLowerCase();
      })
      .filter(Boolean),
    // Selector CSS opcional para limitar qué clics se capturan
    clickSelector: currentScript.getAttribute("data-click-selector") || "[data-track], a, button",
    // Lista de campos de formulario que NUNCA se envían (además del filtro por tipo)
    formBlocklist: (currentScript.getAttribute("data-form-blocklist") || "password,card,cvv,cvc,ssn,token")
      .split(",")
      .map(function (s) {
        return s.trim().toLowerCase();
      }),
  };

  if (!cfg.siteId || !cfg.endpoint) {
    console.warn("[analytics.js] Falta data-site-id o data-endpoint. Script detenido.");
    return;
  }

  // ---------- 2. Contexto de página (auto-detección) ----------
  function getPageContext() {
    var meta = {};
    var descTag = document.querySelector('meta[name="description"]');
    if (descTag) meta.description = descTag.getAttribute("content");

    return {
      url: location.href,
      path: location.pathname,
      title: document.title,
      referrer: document.referrer || null,
      lang: document.documentElement.lang || navigator.language,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      meta: meta,
    };
  }

  // Identificador de sesión efímero SOLO en memoria (no persiste, no es cookie/localStorage)
  var sessionId =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

  // ---------- 3. Envío de eventos ----------
  function send(eventType, payload) {
    var body = JSON.stringify({
      site_id: cfg.siteId,
      api_key: cfg.apiKey,
      session_id: sessionId,
      event_type: eventType,
      payload: payload || {},
      context: getPageContext(),
      ts: new Date().toISOString(),
    });

    // sendBeacon es ideal: no bloquea, y funciona incluso si la página se cierra
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: "application/json" });
      var ok = navigator.sendBeacon(cfg.endpoint, blob);
      if (ok) return;
    }

    // Fallback: fetch con keepalive (por si sendBeacon falla o no existe)
    fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
      mode: "cors",
    }).catch(function () {
      /* silencioso: la analítica nunca debe romper la web del usuario */
    });
  }

  // ---------- 4. Recolectores opcionales, activados por data-collect ----------

  // 4a. Vista de página
  if (cfg.collect.indexOf("views") !== -1) {
    send("page_view", {});
  }

  // 4b. Tiempo en página (se manda al salir)
  if (cfg.collect.indexOf("time_on_page") !== -1 || cfg.collect.indexOf("views") !== -1) {
    var start = Date.now();
    window.addEventListener("pagehide", function () {
      send("time_on_page", { seconds: Math.round((Date.now() - start) / 1000) });
    });
  }

  // 4c. Clics
  if (cfg.collect.indexOf("clicks") !== -1) {
    document.addEventListener(
      "click",
      function (e) {
        var el = e.target.closest(cfg.clickSelector);
        if (!el) return;
        send("click", {
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.value || "").slice(0, 120),
          id: el.id || null,
          classes: el.className || null,
          href: el.getAttribute("href") || null,
          trackId: el.getAttribute("data-track") || null,
        });
      },
      { passive: true }
    );
  }

  // 4d. Scroll (umbrales 25/50/75/100%)
  if (cfg.collect.indexOf("scroll") !== -1) {
    var seen = {};
    var thresholds = [25, 50, 75, 100];
    window.addEventListener(
      "scroll",
      throttle(function () {
        var scrollable = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        var pct = Math.round((window.scrollY / scrollable) * 100);
        thresholds.forEach(function (t) {
          if (pct >= t && !seen[t]) {
            seen[t] = true;
            send("scroll_depth", { percent: t });
          }
        });
      }, 500),
      { passive: true }
    );
  }

  // 4e. Formularios (SOLO estructura + campos no sensibles, nunca contraseñas/tarjetas)
  if (cfg.collect.indexOf("forms") !== -1) {
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!(form instanceof HTMLFormElement)) return;

      var fields = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        var type = (el.type || "text").toLowerCase();
        var nameLower = el.name.toLowerCase();
        var isSensitive =
          type === "password" ||
          type === "hidden" ||
          cfg.formBlocklist.some(function (bad) {
            return nameLower.indexOf(bad) !== -1;
          });
        if (isSensitive) return;
        // Guardamos solo si tiene contenido, y truncado
        if (el.value) fields[el.name] = String(el.value).slice(0, 200);
      });

      send("form_submit", {
        formId: form.id || null,
        formName: form.getAttribute("name") || null,
        fieldCount: Object.keys(fields).length,
        fields: fields,
      });
    });
  }

  // ---------- 5. API pública opcional para eventos custom ----------
  // Permite: window.trackEvent('signup_completed', { plan: 'pro' })
  window.trackEvent = function (eventType, payload) {
    send(eventType, payload);
  };

  function throttle(fn, wait) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }
})();
