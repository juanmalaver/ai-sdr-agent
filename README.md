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

- `POST /leads/import` validates, deduplicates, and stores JSON or CSV leads in memory.
- `GET /outreach/due` returns leads that are due for outreach.
- `POST /outreach/run-daily` personalizes a mock email, sends through a mock provider, and schedules the next touch.
- `POST /replies/classify` turns reply text into an intent.
- `POST /replies/triage` applies deterministic status transitions from the classified reply.

## Import Leads

For programmatic imports, send JSON:

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

For CSV imports, upload a `.csv` file using multipart field `file`:

```bash
curl -X POST http://localhost:3000/leads/import \
  -F "file=@examples/leads.example.csv"
```

The only required CSV column is `email`.

The included CSV example follows a D7-style export shape:

```csv
name,phone,website,email,category,address1,address2,region,zip,country
```

Extra CSV columns are preserved on the lead as `metadata`.
For D7 exports, `name` maps to `practiceName`, `address2` maps to `city`, and `region` maps to `state`.
Common aliases like `Email Address`, `First Name`, `Practice Name`, `Company`, and `URL` are also accepted.

## Example Flow

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
