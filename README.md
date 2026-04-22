<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f3265e14-9c47-4ea3-aa5a-894e3a44eb01

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment variables in `.env.local` based on `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MERCADO_PAGO_PUBLIC_KEY`
   - `MERCADO_PAGO_ACCESS_TOKEN`
   - `APP_BASE_URL` (ex: `http://localhost:3000`)
3. Link and migrate Supabase:
   - `npx supabase link --project-ref <SEU_PROJECT_REF>`
   - `npx supabase db push`
4. Run the API server (Mercado Pago + webhook):
   `npm run dev:api`
5. Run the app:
   `npm run dev`

## Payment Endpoints

- `POST /api/payments/create-order`: inicia checkout para compra avulsa.
- `POST /api/payments/create-subscription`: inicia checkout de assinatura (preapproval).
- `POST /api/mercadopago/webhook`: recebe notificações de pagamento/assinatura.
