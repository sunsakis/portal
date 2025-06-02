import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Generate magic code using our database function
    const { data: codeData, error: codeError } = await supabaseClient
      .rpc('generate_and_send_magic_code', {
        user_email: email
      })

    if (codeError) {
      console.error('Code generation error:', codeError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate code' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const code = codeData.code

    // Send email via Postmark
    const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': Deno.env.get('POSTMARK_API_KEY') ?? ''
      },
      body: JSON.stringify({
        From: 'noreply@yourdomain.com', // Replace with your verified sender
        To: email,
        Subject: 'Your Pinhopper verification code',
        TextBody: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this code, please ignore this email.`,
        HtmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">🌀 Pinhopper</h1>
            </div>
            <h2 style="color: #333; text-align: center;">Your verification code</h2>
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
              <h1 style="font-size: 42px; letter-spacing: 12px; margin: 0; color: #2563eb; font-family: 'Courier New', monospace;">${code}</h1>
            </div>
            <p style="color: #64748b; text-align: center; margin: 20px 0;">This code expires in 5 minutes</p>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
              <p style="color: #94a3b8; font-size: 14px; text-align: center; margin: 0;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
          </div>
        `
      })
    })

    if (!postmarkResponse.ok) {
      const errorData = await postmarkResponse.json()
      console.error('Postmark error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('OTP sent successfully to:', email)

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})