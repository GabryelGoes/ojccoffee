import { readMercadoPagoToken, readSupabaseAdminClient, type AnyRequest, type AnyResponse } from '../_lib/runtime';

function mapPaymentStatus(raw: string | undefined): string {
  switch (raw) {
    case 'approved':
      return 'approved';
    case 'authorized':
      return 'authorized';
    case 'refunded':
      return 'refunded';
    case 'cancelled':
      return 'cancelled';
    case 'in_process':
    case 'pending':
      return 'pending';
    case 'charged_back':
      return 'chargeback';
    default:
      return 'failed';
  }
}

export default async function handler(req: AnyRequest, res: AnyResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = readSupabaseAdminClient();
    const mpToken = readMercadoPagoToken();

    if (!supabase) {
      return res.status(200).json({ ok: true, message: 'Sem Supabase configurado.' });
    }

    const topic = (req.body?.type || req.body?.topic) as string | undefined;
    const dataId = req.body?.data?.id ? String(req.body.data.id) : undefined;
    const eventId = dataId || String(req.body?.id || crypto.randomUUID());

    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('provider', 'mercado_pago')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing?.processed) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    if (!existing) {
      await supabase.from('webhook_events').insert({
        provider: 'mercado_pago',
        event_id: eventId,
        event_type: topic || 'unknown',
        payload: req.body,
        processed: false,
      });
    }

    if (topic === 'payment' && dataId && mpToken) {
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });

      if (paymentRes.ok) {
        const payment = await paymentRes.json();
        const mapped = mapPaymentStatus(payment.status);
        const orderId = payment.external_reference ? String(payment.external_reference) : null;
        const chargeId = payment.order?.id ? String(payment.order.id) : null;

        const payload = {
          provider_payment_id: String(payment.id),
          status: mapped,
          paid_at: payment.date_approved || null,
          metadata: payment,
        };

        if (chargeId && orderId) {
          await supabase
            .from('payments')
            .update(payload)
            .eq('provider', 'mercado_pago')
            .or(`provider_charge_id.eq.${chargeId},order_id.eq.${orderId}`);
        } else if (chargeId) {
          await supabase
            .from('payments')
            .update(payload)
            .eq('provider', 'mercado_pago')
            .eq('provider_charge_id', chargeId);
        } else if (orderId) {
          await supabase
            .from('payments')
            .update(payload)
            .eq('provider', 'mercado_pago')
            .eq('order_id', orderId);
        }

        if (orderId && (mapped === 'approved' || mapped === 'authorized')) {
          await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
        }
      }
    }

    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'mercado_pago')
      .eq('event_id', eventId);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook Mercado Pago error:', error);
    return res.status(200).json({ ok: true, warning: 'Erro tratado para evitar retry infinito.' });
  }
}
