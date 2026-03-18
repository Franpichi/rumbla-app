// Supabase Edge Function — rumbla-waitlist
// Deploy: supabase functions deploy rumbla-waitlist
// Location: supabase/functions/rumbla-waitlist/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { email, lang = "en" } = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("waitlist")
      .insert({ email, lang });

    if (dbError && !dbError.message.includes("duplicate")) {
      throw new Error(dbError.message);
    }

    const subjects: Record<string, string> = {
      en: "You're on the list 🏃 — Rumbla",
      es: "Ya estás en la lista 🏃 — Rumbla",
      da: "Du er på listen 🏃 — Rumbla",
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rumbla <info@rumbla.app>",
        to: email,
        subject: subjects[lang] ?? subjects["en"],
        html: buildEmail(email, lang),
      }),
    });

    if (!resendRes.ok) {
      console.error("Resend error:", await resendRes.text());
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

function buildEmail(email: string, lang: string): string {
  const t: Record<string, Record<string, string>> = {
    en: {
      preheader: "Welcome to Rumbla — you're on the waitlist in Copenhagen.",
      headline:  "You're on the list.",
      sub:       "We'll notify you when Rumbla launches in Copenhagen.",
      body:      "Rumbla is the first territory-based running app in the Nordics. Run, conquer hexagons, steal zones from friends.",
      badge1:    "🗺️  Territory conquest",
      badge2:    "⚔️  Zone theft",
      badge3:    "🏆  Live rankings",
      cta:       "See you on the map.",
      footer:    "You're receiving this because you signed up for the Rumbla waitlist.",
      unsub:     "Unsubscribe",
    },
    es: {
      preheader: "Bienvenido a Rumbla — ya estás en la lista de espera de Copenhague.",
      headline:  "Ya estás en la lista.",
      sub:       "Te avisaremos cuando Rumbla llegue a Copenhague.",
      body:      "Rumbla es la primera app de running territorial de los países nórdicos. Corre, conquista hexágonos, roba zonas a tus amigos.",
      badge1:    "🗺️  Conquista de territorio",
      badge2:    "⚔️  Robo de zonas",
      badge3:    "🏆  Rankings en vivo",
      cta:       "Nos vemos en el mapa.",
      footer:    "Recibes este email porque te apuntaste a la lista de espera de Rumbla.",
      unsub:     "Cancelar suscripción",
    },
    da: {
      preheader: "Velkommen til Rumbla — du er på ventelisten i København.",
      headline:  "Du er på listen.",
      sub:       "Vi giver dig besked, når Rumbla lanceres i København.",
      body:      "Rumbla er den første territoriebaserede løbeapp i Norden. Du løber, erobrer hexagoner og stjæler zoner fra venner.",
      badge1:    "🗺️  Territorieindtagelse",
      badge2:    "⚔️  Zonetyveri",
      badge3:    "🏆  Live rangliste",
      cta:       "Vi ses på kortet.",
      footer:    "Du modtager denne e-mail, fordi du tilmeldte dig Rumbla-ventelisten.",
      unsub:     "Afmeld",
    },
  };

  const s = t[lang] ?? t["en"];

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Rumbla</title></head>
<body style="margin:0;padding:0;background:#0D0F14;font-family:Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;color:#0D0F14;font-size:1px;">${s.preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D0F14;">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#141720;border-radius:20px;border:1px solid #1F2435;overflow:hidden;">
<tr><td style="height:3px;background:linear-gradient(90deg,#FF5C35,#FF8F6B);"></td></tr>
<tr><td style="padding:40px 48px 28px;">
  <table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:#FF5C35;border-radius:10px;width:38px;height:38px;text-align:center;vertical-align:middle;">
      <span style="font-weight:900;font-size:22px;color:#F0F2F8;line-height:38px;">R</span>
    </td>
    <td style="padding-left:10px;font-weight:900;font-size:26px;color:#F0F2F8;letter-spacing:-0.5px;vertical-align:middle;">rumbla</td>
  </tr></table>
</td></tr>
<tr><td style="padding:0 48px 36px;">
  <div style="display:inline-block;background:rgba(255,92,53,0.12);border:1px solid rgba(255,92,53,0.25);border-radius:999px;padding:5px 14px;font-size:11px;font-weight:500;color:#FF5C35;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:24px;">● Copenhagen</div>
  <h1 style="margin:0 0 14px;font-size:42px;font-weight:900;line-height:1.0;color:#F0F2F8;letter-spacing:-1px;">${s.headline}</h1>
  <p style="margin:0 0 28px;font-size:16px;font-weight:300;color:#8B93A8;line-height:1.6;">${s.sub}</p>
  <div style="height:1px;background:#1F2435;margin-bottom:28px;"></div>
  <p style="margin:0 0 28px;font-size:15px;font-weight:300;color:#8B93A8;line-height:1.7;">${s.body}</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding-bottom:10px;"><div style="background:#1C2030;border:1px solid #2D3350;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:500;color:#F0F2F8;">${s.badge1}</div></td></tr>
    <tr><td style="padding-bottom:10px;"><div style="background:#1C2030;border:1px solid #2D3350;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:500;color:#F0F2F8;">${s.badge2}</div></td></tr>
    <tr><td style="padding-bottom:32px;"><div style="background:#1C2030;border:1px solid #2D3350;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:500;color:#F0F2F8;">${s.badge3}</div></td></tr>
  </table>
  <p style="margin:0;font-size:18px;font-weight:500;color:#00E5CC;font-style:italic;">${s.cta}</p>
</td></tr>
<tr><td style="background:#0D0F14;padding:24px 48px;border-top:1px solid #1F2435;">
  <p style="margin:0;font-size:12px;color:#4A5168;line-height:1.6;">
    ${s.footer}<br>
    <a href="https://rumbla.app/unsubscribe?email=${encodeURIComponent(email)}" style="color:#4A5168;">${s.unsub}</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
