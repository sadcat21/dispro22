import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getNextKey(keys: string[]): string {
  const idx = Math.floor(Math.random() * keys.length);
  return keys[idx];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const keysStr = Deno.env.get('GEMINI_API_KEYS');
    if (!keysStr) {
      throw new Error('GEMINI_API_KEYS not configured');
    }

    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      throw new Error('No valid API keys found');
    }

    const { image_base64, payment_method } = await req.json();
    if (!image_base64) {
      throw new Error('image_base64 is required');
    }

    const prompt = `أنت محلل فواتير ووثائق مالية. قم بتحليل هذه الصورة واستخراج البيانات التالية بدقة:

1. المبلغ الإجمالي (amount) - الرقم فقط بدون عملة
2. رقم الفاتورة (invoice_number) 
3. اسم العميل (customer_name)
${payment_method === 'check' ? '4. رقم الشيك (check_number)\n5. اسم البنك (check_bank)' : ''}
${payment_method === 'bank_receipt' ? '4. رقم الوصل (receipt_number)' : ''}
${payment_method === 'bank_transfer' ? '4. مرجع التحويل (transfer_reference)' : ''}

أجب بتنسيق JSON فقط بدون أي نص إضافي. مثال:
{"amount": "15000", "invoice_number": "FC-2024-001", "customer_name": "محل الأمانة"}

إذا لم تجد قيمة معينة، اتركها فارغة "".`;

    // Try up to 3 different keys
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < Math.min(3, keys.length); attempt++) {
      const apiKey = getNextKey(keys);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: image_base64
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024,
              }
            })
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Gemini API error (key attempt ${attempt + 1}):`, response.status, errText);
          if (response.status === 429 || response.status === 403) {
            lastError = new Error(`API key rate limited or forbidden`);
            continue;
          }
          throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Extract JSON from response
        const jsonMatch = textContent.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const extracted = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify({ success: true, data: extracted }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: false, raw_text: textContent }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < 2) continue;
      }
    }

    throw lastError || new Error('All API keys failed');

  } catch (error) {
    console.error('analyze-invoice error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
