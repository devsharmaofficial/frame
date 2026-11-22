# Framer

Framer is a sandbox control plane for agent-initiated payments. It evaluates
each payment against a versioned policy, routes exceptions for approval, and
records an audit trail.

## Run locally

```bash
npm install
npm start
```

In another terminal:

```bash
npm --prefix apps/web run dev
```

The API runs on `http://127.0.0.1:3000` and the dashboard on the Vite URL.
State is stored in `apps/api/data/framer.json` by default. Set `DATA_FILE` to
change the location.

## Run with Docker

```bash
docker compose up --build
```

The dashboard is available at `http://127.0.0.1:8080`; the API is available at
`http://127.0.0.1:3000`.

## Checks

```bash
npm test
npm run build
npm --prefix packages/domain test
npm --prefix packages/sdk run typecheck
npm --prefix apps/web run build
```

Payment execution is simulated. An authorized intent can be moved through
`POST /api/v1/payment-intents/:id/execute`, followed by a simulated provider
callback using `POST /api/v1/payment-intents/:id/webhook` with
`{"status":"SUCCEEDED"}` or `{"status":"FAILED"}`.
