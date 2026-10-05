# JOB Cloudflare AI Proxy

Tiny protected Cloudflare Worker used by the Beget-hosted JOB app.

## Routes

- `GET /health`
- `POST /openrouter/v1/chat/completions`
- `GET /openrouter/v1/models`
- `GET /openrouter/v1/key`
- `POST /imagerouter/v1/openai/images/generations`
- `POST /imagerouter/v1/openai/videos/generations`

Every request requires:

```
X-Gateway-Secret: <GATEWAY_SECRET>
```

## Required secrets

- `GATEWAY_SECRET`
- `OPENROUTER_API_KEY`
- `IMAGEROUTER_API_KEY`

## Deploy

```bash
npm install
npx wrangler login
npx wrangler secret put GATEWAY_SECRET
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put IMAGEROUTER_API_KEY
npx wrangler deploy
```

Do not commit secret values.
