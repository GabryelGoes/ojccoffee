import { onlyPost, readBaseUrl, readMercadoPagoToken, readSupabaseAdminClient, toCents, type AnyRequest, type AnyResponse } from '../_lib/runtime';

type SubscriptionBody = {
  planId: string;
  planName: string;
  amount: number;
  payerEmail: string;
  userId?: string;
};

export default async function handler(req: AnyRequest, res: AnyResponse) {
  if (!onlyPost(req, res)) return;

  try {
    const mpToken = readMercadoPagoToken();
    if (!mpToken) {
      return res.status(500).json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' });
    }

    const body = req.body as SubscriptionBody;
    if (!body?.payerEmail || !body?.planId || !body?.planName || !body?.amount) {
      return res.status(400).json({ error: 'Payload inválido para assinatura.' });
    }
    const userId = body.userId || `guest-${crypto.randomUUID()}`;

    const baseUrl = readBaseUrl(req);
    const supabase = readSupabaseAdminClient();
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
        console.error('Supabase insert subscription falhou:', error);
      }
    }

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: `Assinatura ${body.planName}`,
        external_reference: subscriptionId || `sub-${crypto.randomUUID()}`,
        payer_email: body.payerEmail,
        back_url: `${baseUrl}/assinatura/retorno`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: body.amount,
          currency_id: 'BRL',
        },
        status: 'pending',
      }),
    });

    if (!mpResponse.ok) {
      const details = await mpResponse.text();
      return res.status(400).json({
        error: 'Falha ao criar assinatura no Mercado Pago',
        details,
      });
    }

    const mpData = await mpResponse.json();

    if (supabase && subscriptionId) {
      await supabase
        .from('subscriptions')
        .update({
          provider_subscription_id: mpData.id,
          init_point: mpData.init_point ?? mpData.sandbox_init_point,
        })
        .eq('id', subscriptionId);
    }

    return res.status(200).json({
      checkoutUrl: mpData.init_point ?? mpData.sandbox_init_point,
      preapprovalId: mpData.id,
      subscriptionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    return res.status(500).json({ error: message });
  }
}
