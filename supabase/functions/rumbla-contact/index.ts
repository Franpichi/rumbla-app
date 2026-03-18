// Supabase Edge Function: rumbla-contact
// Deploy: Supabase Dashboard → Edge Functions → New Function → paste this
// Secrets needed (same as waitlist, already configured):
//   RESEND_API_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_URL

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, message, lang } = await req.json()

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Save to Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: dbError } = await supabase
      .from('contacts')
      .insert({ name, email, message, lang: lang || 'en' })

    if (dbError) {
      console.error('DB error:', dbError)
      // Don't fail — still send the email
    }

    // 2. Send notification email to info@rumbla.app
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rumbla Contact <info@rumbla.app>',
        to: ['info@rumbla.app'],
        reply_to: email,
        subject: `New contact from ${name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0D0F14; color: #F0F2F8; padding: 32px; border-radius: 12px;">
            <h2 style="color: #FF5C35; margin-bottom: 24px;">New contact message</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #8B93A8; width: 80px; vertical-align: top;">Name</td>
                <td style="padding: 8px 0; color: #F0F2F8;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8B93A8; vertical-align: top;">Email</td>
                <td style="padding: 8px 0; color: #F0F2F8;"><a href="mailto:${email}" style="color: #FF5C35;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8B93A8; vertical-align: top;">Language</td>
                <td style="padding: 8px 0; color: #F0F2F8;">${lang || 'en'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8B93A8; vertical-align: top;">Message</td>
                <td style="padding: 8px 0; color: #F0F2F8; white-space: pre-wrap;">${message}</td>
              </tr>
            </table>
            <p style="margin-top: 24px; color: #4A5168; font-size: 12px;">Sent from rumbla.app/contact.html · ${new Date().toISOString()}</p>
          </div>
        `,
      }),
    })

    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text())
    }

    // 3. Send confirmation to user
    const confirmMessages: Record<string, { subject: string; body: string }> = {
      en: {
        subject: "We got your message — Rumbla",
        body: `Hi ${name},<br><br>Thanks for reaching out. We'll get back to you as soon as possible.<br><br>— The Rumbla Team`
      },
      es: {
        subject: "Recibimos tu mensaje — Rumbla",
        body: `Hola ${name},<br><br>Gracias por escribirnos. Te responderemos lo antes posible.<br><br>— El equipo de Rumbla`
      },
      da: {
        subject: "Vi har modtaget din besked — Rumbla",
        body: `Hej ${name},<br><br>Tak for din henvendelse. Vi vender tilbage til dig hurtigst muligt.<br><br>— Rumbla-teamet`
      }
    }

    const confirm = confirmMessages[lang] || confirmMessages['en']

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rumbla <info@rumbla.app>',
        to: [email],
        subject: confirm.subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; color: #0D0F14; padding: 32px; border-radius: 12px;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">rumbla<span style="color: #FF5C35;">.</span></span>
            </div>
            <p style="font-size: 16px; line-height: 1.6; color: #4A5168;">${confirm.body}</p>
          </div>
        `,
      }),
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
