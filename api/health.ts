import { readMercadoPagoToken, readSupabaseAdminClient, type AnyRequest, type AnyResponse } from './_lib/runtime';

export default function handler(_req: AnyRequest, res: AnyResponse) {
  return res.status(200).json({
    ok: true,
    supabaseConfigured: Boolean(readSupabaseAdminClient()),
    mercadoPagoConfigured: Boolean(readMercadoPagoToken()),
  });
}
