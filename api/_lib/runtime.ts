import { createClient } from '@supabase/supabase-js';

export type AnyRequest = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

export type AnyResponse = {
  status: (code: number) => AnyResponse;
  json: (body: any) => void;
  setHeader: (name: string, value: string) => void;
};

export function readBaseUrl(req: AnyRequest): string {
  const configured = process.env.APP_BASE_URL;
  if (configured) return configured;

  const host = (req.headers?.host as string | undefined) || 'localhost:3000';
  return `https://${host}`;
}

export function readMercadoPagoToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN;
}

export function readSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) return null;

  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

export function onlyPost(req: AnyRequest, res: AnyResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function toCents(amount: number) {
  return Math.round(amount * 100);
}
