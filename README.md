# ai-sdr-agent

NestJS backend for an SDR workflow engine with AI services only where they add value:
email personalization and reply understanding.

## Getting Started

```bash
npm install
cp .env.example .env
npm run start:dev
```

The API starts on `http://localhost:3000` by default.
The app loads local values from `.env`; set production values in the deployment environment.

## Current Flow

- `POST /leads/import` validates, deduplicates, and stores JSON or CSV leads in memory.
- `GET /outreach/due` returns leads that are due for outreach.
- `POST /outreach/run-daily` personalizes an email, sends through the configured provider, and schedules the next touch.
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

## Email Delivery

By default, email sends are mocked locally. Set `EMAIL_DRIVER=SMTP` to send real emails using the same SendGrid SMTP config shape as `crm-server`:

```bash
EMAIL_DRIVER=SMTP
EMAIL_SMTP_HOST=smtp.sendgrid.net
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=apikey
EMAIL_SMTP_PASSWORD=replace-with-sendgrid-api-key
EMAIL_FROM_ADDRESS=operations@example.com
EMAIL_FROM_NAME=MedHub
```

`EMAIL_SMTP_PASSWORD` is the SendGrid API key. Do not commit real keys; set them in your deployment environment.

## Scheduled Outreach

Cloud Scheduler should own the 9 AM Miami trigger when the app runs on GCP.
The app exposes `POST /outreach/run-daily` as the scheduled endpoint.

Set `SCHEDULER_SECRET` in production to require the `X-Scheduler-Secret` header on that endpoint:

```bash
gcloud run services update ai-sdr-agent \
  --region=us-east1 \
  --update-env-vars="SCHEDULER_SECRET=replace-with-a-long-random-secret"
```

Create a Cloud Scheduler job for 9 AM Miami time:

```bash
gcloud scheduler jobs create http daily-outreach-9am-miami \
  --location=us-east1 \
  --schedule="0 9 * * *" \
  --time-zone="America/New_York" \
  --uri="https://YOUR_CLOUD_RUN_URL/outreach/run-daily" \
  --http-method=POST \
  --headers="Content-Type=application/json,X-Scheduler-Secret=replace-with-a-long-random-secret" \
  --message-body="{}"
```

If `SCHEDULER_SECRET` is not set, the endpoint remains open for local development.
