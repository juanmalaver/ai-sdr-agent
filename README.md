# ai-sdr-agent

NestJS backend for an SDR workflow engine with AI services only where they add value:
email personalization and reply understanding.

## Getting Started

```bash
npm install
npm run start:dev
```

The API starts on `http://localhost:3000` by default.

## Current Flow

- `POST /leads/import` validates, deduplicates, and stores leads in memory.
- `GET /outreach/due` returns leads that are due for outreach.
- `POST /outreach/run-daily` personalizes a mock email, sends through a mock provider, and schedules the next touch.
- `POST /replies/classify` turns reply text into an intent.
- `POST /replies/triage` applies deterministic status transitions from the classified reply.

## Example

```bash
curl -X POST http://localhost:3000/leads/import \
  -H "content-type: application/json" \
  -d '{
    "leads": [
      {
        "email": "john@example.com",
        "firstName": "John",
        "practiceName": "Dallas Dental Studio",
        "city": "Dallas",
        "state": "TX"
      }
    ]
  }'
```

```bash
curl -X POST http://localhost:3000/outreach/run-daily
```

```bash
curl -X POST http://localhost:3000/replies/classify \
  -H "content-type: application/json" \
  -d '{ "text": "Can you send pricing?" }'
```

The root route returns a compact endpoint overview:

```bash
curl http://localhost:3000/
```
