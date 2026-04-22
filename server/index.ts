import express from 'express';
import { createClient } from '@supabase/supabase-js';

type CheckoutItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: 'BRL';
};

type SubscriptionBody = {
  planId: string;
  planName: string;
  amount: number;
  payerEmail: string;
  userId?: string;
};

type OrderBody = {
  userId?: string;
  payerEmail: string;
  items: CheckoutItem[];
};

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 8787);
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceRole
  ? createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false } })
  : null;

function ensureMercadoPagoToken() {
  if (!mpToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
  }
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

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

async function maybeInsertOrderAndPayment(params: {
  userId: string;
  payerEmail: string;
  items: CheckoutItem[];
  provider: string;
  preferenceId?: string;
}) {
  if (!supabase) return null;

  const subtotal = params.items.reduce((acc, item) => acc + toCents(item.unit_price) * item.quantity, 0);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: params.userId,
      status: 'pending_payment',
      currency: 'BRL',
      subtotal_cents: subtotal,
      total_cents: subtotal,
      metadata: { payerEmail: params.payerEmail },
    })
    .select('id')
    .single();

  if (orderError || !order) {
    console.error('Erro ao inserir order no Supabase:', orderError);
    return null;
  }

  const mappedItems = params.items.map((item) => ({
    order_id: order.id,
    name: item.title,
    quantity: item.quantity,
    unit_price_cents: toCents(item.unit_price),
    total_price_cents: toCents(item.unit_price) * item.quantity,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(mappedItems);
  if (itemsError) {
    console.error('Erro ao inserir order_items no Supabase:', itemsError);
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    user_id: params.userId,
    order_id: order.id,
    provider: params.provider,
    provider_charge_id: params.preferenceId,
    method: 'credit_card',
    status: 'pending',
    amount_cents: subtotal,
    currency: 'BRL',
  });

  if (paymentError) {
    console.error('Erro ao inserir payment no Supabase:', paymentError);
  }

  return order.id;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    supabaseConfigured: Boolean(supabase),
    mercadoPagoConfigured: Boolean(mpToken),
  });
});

app.post('/api/payments/create-order', async (req, res) => {
  try {
    ensureMercadoPagoToken();
    const body = req.body as OrderBody;

    if (!body?.payerEmail || !Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'Payload inválido para criar pedido.' });
    }
    const userId = body.userId || `guest-${crypto.randomUUID()}`;

    const orderId = await maybeInsertOrderAndPayment({
      userId,
      payerEmail: body.payerEmail,
      items: body.items,
      provider: 'mercado_pago',
    });

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: body.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          currency_id: 'BRL',
        })),
        payer: { email: body.payerEmail },
        external_reference: orderId || `local-${crypto.randomUUID()}`,
        statement_descriptor: 'JCCOFFEE',
        back_urls: {
          success: `${appBaseUrl}/pagamento/sucesso`,
          failure: `${appBaseUrl}/pagamento/falha`,
          pending: `${appBaseUrl}/pagamento/pendente`,
        },
        auto_return: 'approved',
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return res.status(400).json({ error: 'Falha ao criar checkout no Mercado Pago', details });
    }

    const data = await response.json();

    if (supabase && orderId) {
      await supabase
        .from('payments')
        .update({ provider_charge_id: data.id })
        .eq('order_id', orderId)
        .eq('provider', 'mercado_pago');
    }

    return res.json({
      checkoutUrl: data.init_point ?? data.sandbox_init_point,
      preferenceId: data.id,
      orderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/payments/create-subscription', async (req, res) => {
  try {
    ensureMercadoPagoToken();
    const body = req.body as SubscriptionBody;

    if (!body?.payerEmail || !body?.planId || !body?.planName || !body?.amount) {
      return res.status(400).json({ error: 'Payload inválido para assinatura.' });
    }
    const userId = body.userId || `guest-${crypto.randomUUID()}`;

    let subscriptionId: string | null = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_code: body.planId,
          plan_name: body.planName,
          amount_cents: toCents(body.amount),
          provider: 'mercado_pago',
          status: 'pending',
          metadata: { payerEmail: body.payerEmail },
        })
        .select('id')
        .single();

      if (!error && data) {
        subscriptionId = data.id;
      } else {
        console.error('Erro ao inserir subscription no Supabase:', error);
      }
    }

    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: `Assinatura ${body.planName}`,
        external_reference: subscriptionId || `sub-${crypto.randomUUID()}`,
        payer_email: body.payerEmail,
        back_url: `${appBaseUrl}/assinatura/retorno`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: body.amount,
          currency_id: 'BRL',
        },
        status: 'pending',
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return res.status(400).json({ error: 'Falha ao criar assinatura no Mercado Pago', details });
    }

    const data = await response.json();

    if (supabase && subscriptionId) {
      await supabase
        .from('subscriptions')
        .update({
          provider_subscription_id: data.id,
          init_point: data.init_point ?? data.sandbox_init_point,
        })
        .eq('id', subscriptionId);
    }

    return res.json({
      checkoutUrl: data.init_point ?? data.sandbox_init_point,
      preapprovalId: data.id,
      subscriptionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const topic = (req.query.type || req.query.topic || req.body?.type) as string | undefined;
    const dataId = (req.query['data.id'] || req.body?.data?.id) as string | undefined;

    if (!supabase) {
      return res.status(200).json({ ok: true, message: 'Webhook recebido sem Supabase configurado.' });
    }

    const eventId = dataId || req.body?.id || crypto.randomUUID();
    const provider = 'mercado_pago';

    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id,processed')
      .eq('provider', provider)
      .eq('event_id', String(eventId))
      .maybeSingle();

    if (existing?.processed) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    if (!existing) {
      await supabase.from('webhook_events').insert({
        provider,
        event_id: String(eventId),
        event_type: topic || 'unknown',
        payload: req.body,
        processed: false,
      });
    }

    if (topic === 'payment' && dataId && mpToken) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` },
      });
      if (response.ok) {
        const payment = await response.json();
        const mappedStatus = mapPaymentStatus(payment.status);
        const orderId = payment.external_reference || null;
        const chargeId = payment.order?.id ? String(payment.order.id) : null;

        const paymentUpdate = {
          provider_payment_id: String(payment.id),
          status: mappedStatus,
          paid_at: payment.date_approved || null,
          metadata: payment,
        };

        if (chargeId && orderId) {
          await supabase
            .from('payments')
            .update(paymentUpdate)
            .eq('provider', provider)
            .or(`provider_charge_id.eq.${chargeId},order_id.eq.${orderId}`);
        } else if (chargeId) {
          await supabase
            .from('payments')
            .update(paymentUpdate)
            .eq('provider', provider)
            .eq('provider_charge_id', chargeId);
        } else if (orderId) {
          await supabase
            .from('payments')
            .update(paymentUpdate)
            .eq('provider', provider)
            .eq('order_id', orderId);
        }

        if (orderId && (mappedStatus === 'approved' || mappedStatus === 'authorized')) {
          await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', orderId);
        }
      }
    }

    if (topic === 'subscription_preapproval' && dataId && mpToken) {
      const response = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` },
      });
      if (response.ok) {
        const subscription = await response.json();
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status || 'pending',
            metadata: subscription,
            provider_subscription_id: subscription.id,
          })
          .eq('provider_subscription_id', subscription.id);
      }
    }

    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('event_id', String(eventId));

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro no webhook Mercado Pago:', error);
    return res.status(200).json({ ok: true, warning: 'Erro tratado para evitar retries infinitos.' });
  }
});

app.listen(port, () => {
  console.log(`[api] running on http://localhost:${port}`);
});
