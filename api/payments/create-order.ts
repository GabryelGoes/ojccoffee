import { onlyPost, readBaseUrl, readMercadoPagoToken, readSupabaseAdminClient, toCents, type AnyRequest, type AnyResponse } from '../_lib/runtime';

type CheckoutItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: 'BRL';
};

type OrderBody = {
  userId: string;
  payerEmail: string;
  items: CheckoutItem[];
};

export default async function handler(req: AnyRequest, res: AnyResponse) {
  if (!onlyPost(req, res)) return;

  try {
    const mpToken = readMercadoPagoToken();
    if (!mpToken) {
      return res.status(500).json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' });
    }

    const body = req.body as OrderBody;
    if (!body?.userId || !body?.payerEmail || !Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'Payload inválido para criar pedido.' });
    }

    const supabase = readSupabaseAdminClient();
    const baseUrl = readBaseUrl(req);
    const subtotal = body.items.reduce((acc, i) => acc + toCents(i.unit_price) * i.quantity, 0);
    let orderId: string | null = null;

    if (supabase) {
      const { data: order } = await supabase
        .from('orders')
        .insert({
          user_id: body.userId,
          status: 'pending_payment',
          currency: 'BRL',
          subtotal_cents: subtotal,
          total_cents: subtotal,
          metadata: { payerEmail: body.payerEmail },
        })
        .select('id')
        .single();

      orderId = order?.id ?? null;

      if (orderId) {
        const mappedItems = body.items.map((item) => ({
          order_id: orderId,
          name: item.title,
          quantity: item.quantity,
          unit_price_cents: toCents(item.unit_price),
          total_price_cents: toCents(item.unit_price) * item.quantity,
        }));
        await supabase.from('order_items').insert(mappedItems);

        await supabase.from('payments').insert({
          user_id: body.userId,
          order_id: orderId,
          provider: 'mercado_pago',
          method: 'credit_card',
          status: 'pending',
          amount_cents: subtotal,
          currency: 'BRL',
        });
      }
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpToken}`,
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
          success: `${baseUrl}/pagamento/sucesso`,
          failure: `${baseUrl}/pagamento/falha`,
          pending: `${baseUrl}/pagamento/pendente`,
        },
        auto_return: 'approved',
      }),
    });

    if (!mpResponse.ok) {
      const details = await mpResponse.text();
      return res.status(400).json({
        error: 'Falha ao criar checkout no Mercado Pago',
        details,
      });
    }

    const mpData = await mpResponse.json();

    if (supabase && orderId) {
      await supabase
        .from('payments')
        .update({ provider_charge_id: mpData.id })
        .eq('order_id', orderId)
        .eq('provider', 'mercado_pago');
    }

    return res.status(200).json({
      checkoutUrl: mpData.init_point ?? mpData.sandbox_init_point,
      preferenceId: mpData.id,
      orderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    return res.status(500).json({ error: message });
  }
}
