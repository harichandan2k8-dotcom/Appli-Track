const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are AppliTrack's Appliance Care Assistant. Answer ONLY questions about home appliances: maintenance, cleaning schedules, care instructions, common troubleshooting, energy-saving ideas, and general precautions. Keep replies concise and practical.

When a user gives an appliance and problem, tailor the answer to that exact appliance and problem; do not give a generic troubleshooting answer. Use this exact response structure:
Possible causes:
- List 2–3 likely, non-alarmist causes that fit the reported appliance and issue. Call them possible causes, never a confirmed diagnosis.

Basic checks:
- List 2–3 safe, simple checks that directly relate to the reported issue. Never tell the user to open panels, handle wiring, gas, refrigerant, or internal components.

Suggestion:
- Give one brief next step. If the issue persists, advise contacting the brand service provider or a certified technician.

For example, for an AC that is not cooling, mention the air filter, temperature setting, and that the outdoor unit may need professional inspection. For a washing machine that is not draining, mention the drain hose, accessible filter, and calling a technician if it continues.

If the question is unrelated to home appliances, politely say that you can only help with appliance care and invite an appliance-related question.

Critical safety rule: Never provide DIY instructions for gas lines, electrical-panel work, refrigerant handling, sparking, smoke, burning smells, exposed live wires, or a gas smell. For these situations, tell the user to stop using the appliance, move to safety if appropriate, and contact a certified technician or local emergency service immediately. Do not provide repair steps for these hazards.

Appliance context is supplied by the user application and is reference-only. Do not claim to inspect an appliance remotely. Do not request passwords, payment details, or unrelated personal information.`;

const HAZARD_PATTERN = /\b(gas\s+(?:smell|leak|line)|smell\s+gas|refrigerant|sparking|sparks|smoke|burning\s+smell|electrical\s+panel|breaker\s+panel|live\s+wire|exposed\s+wire)\b/i;
const MAX_MESSAGE_LENGTH = 1200;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function emergencyResponse() {
  return 'Stop using the appliance immediately. Do not attempt a DIY repair or handle gas, refrigerant, wiring, sparks, smoke, or an electrical panel. If there is smoke, fire risk, or a gas smell, move to safety and contact local emergency services. Otherwise, contact a certified appliance technician as soon as possible.';
}

function safeHistory(history: unknown) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const role = (item as { role?: unknown }).role === 'model' ? 'model' : (item as { role?: unknown }).role === 'user' ? 'user' : null;
    const content = (item as { content?: unknown }).content;
    if (!role || typeof content !== 'string' || !content.trim()) return [];
    return [{ role, parts: [{ text: content.trim().slice(0, MAX_MESSAGE_LENGTH) }] }];
  });
}

function safeContext(context: unknown) {
  if (!Array.isArray(context)) return [];
  return context.slice(0, 20).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const appliance = item as { brand?: unknown; model?: unknown; category?: unknown };
    return [{
      brand: typeof appliance.brand === 'string' ? appliance.brand.slice(0, 80) : 'Unknown brand',
      model: typeof appliance.model === 'string' ? appliance.model.slice(0, 80) : 'Unknown model',
      category: typeof appliance.category === 'string' ? appliance.category.slice(0, 80) : 'Appliance',
    }];
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'The assistant has not been configured yet.' }, 503);

  try {
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
    if (!message) return json({ error: 'Enter an appliance-related question.' }, 400);
    if (HAZARD_PATTERN.test(message)) return json({ response: emergencyResponse() });

    const applianceContext = safeContext(body.applianceContext);
    const history = safeHistory(body.conversationHistory);
    const contextText = applianceContext.length
      ? `Known appliances (reference only): ${applianceContext.map(item => `${item.category}: ${item.brand} ${item.model}`).join('; ')}`
      : 'No appliance list is available.';
    const contents = [...history, { role: 'user', parts: [{ text: `${contextText}\n\nCurrent user question: ${message}` }] }];

    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 350 } }),
    });
    if (!geminiResponse.ok) return json({ error: 'The assistant is unavailable right now. Please try again shortly.' }, 502);

    const geminiData = await geminiResponse.json();
    const response = geminiData?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
    if (!response) return json({ error: 'The assistant could not generate a response. Please try again.' }, 502);
    return json({ response });
  } catch (_) {
    return json({ error: 'The assistant is unavailable right now. Please try again shortly.' }, 500);
  }
});
