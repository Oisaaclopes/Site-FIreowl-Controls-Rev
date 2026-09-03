import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'unauthorized' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const requester = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: identity } = await requester.auth.getUser();
  if (!identity.user) return json(401, { error: 'unauthorized' });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const punchId = String(body.punchId || '');

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: actor } = await admin.from('profiles').select('role,status').eq('id', identity.user.id).maybeSingle();
  if (!actor || actor.status !== 'ATIVO') return json(403, { error: 'forbidden' });
  let punch: { id: string; user_id: string; lat: number; lng: number; location_address?: string } | null = null;
  if (punchId) {
    const result = await admin.from('time_punches').select('id,user_id,lat,lng,location_address').eq('id', punchId).maybeSingle();
    punch = result.data;
    if (!punch) return json(404, { error: 'not_found' });
    const manager = actor.role === 'ADMINISTRATIVO' || actor.role === 'GESTOR';
    if (punch.user_id !== identity.user.id && !manager) return json(403, { error: 'forbidden' });
    if (punch.location_address) return json(200, { address: punch.location_address, cached: true });
  }
  // Compatibilidade com fotos de campo: coordenadas diretas são resolvidas,
  // mas somente batidas com punchId recebem persistência/cache nesta função.
  const lat = Number(punch?.lat ?? body.latitude), lng = Number(punch?.lng ?? body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (!lat && !lng)) return json(422, { error: 'location_unavailable' });

  const apiKey = Deno.env.get('GOOGLE_MAPS_GEOCODING_API_KEY');
  if (!apiKey) return json(503, { error: 'provider_not_configured' });
  try {
    const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&language=pt-BR&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint);
    if (!response.ok) return json(502, { error: 'provider_failed' });
    const payload = await response.json();
    const address = String(payload?.results?.[0]?.formatted_address || '').trim();
    if (!address) return json(404, { error: 'address_not_found' });
    if (punch) {
      const { error } = await admin.from('time_punches').update({ location_address: address }).eq('id', punch.id).is('location_address', null);
      if (error) return json(500, { error: 'persist_failed' });
    }
    return json(200, { address, cached: false });
  } catch { return json(502, { error: 'provider_failed' }); }
});
