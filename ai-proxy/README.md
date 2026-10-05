# JOB AI Router Proxy

Small protected Vercel gateway for server-to-server access from the Beget app.

## Vercel project

Set the project Root Directory to `ai-proxy`.

The project is pinned to Frankfurt (`fra1`) in `vercel.json`.

## Required environment variables

- `GATEWAY_SECRET`
- `OPENROUTER_API_KEY`
- `IMAGEROUTER_API_KEY`

Optional:

- `PROXY_PUBLIC_URL`

## Routes

- `GET /api/health`
- `POST /api/openrouter/v1/chat/completions`
- `GET /api/openrouter/v1/models`
- `GET /api/openrouter/v1/key`
- `POST /api/imagerouter/v1/openai/images/generations`
- `POST /api/imagerouter/v1/openai/videos/generations`

Every request requires the `x-gateway-secret` header.
