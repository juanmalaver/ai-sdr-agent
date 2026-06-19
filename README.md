# ai-sdr-agent

NestJS backend for an SDR workflow engine with AI services only where they add value:
email personalization and reply understanding.

## Getting Started

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run start:dev
```

The API starts on `http://localhost:3000` by default.
The app loads local values from `.env`; set production values in the deployment environment.
Before running migrations locally, set `DATABASE_URL=postgres://ai_sdr_agent:ai_sdr_agent@127.0.0.1:5433/ai_sdr_agent` in `.env`.

## Current Flow

- `POST /leads/import` validates, deduplicates, and stores JSON or CSV leads in PostgreSQL.
- `GET /outreach/due` returns leads that are due for outreach.
- `POST /outreach/run-daily` personalizes an email, sends through the configured provider, and schedules the next touch.
- `POST /replies/classify` turns reply text into an intent.
- `POST /replies/triage` applies deterministic status transitions from the classified reply.

## Lead Persistence

Imported leads are persisted in PostgreSQL. Configure the database with:

```bash
DATABASE_URL=postgres://ai_sdr_agent:ai_sdr_agent@127.0.0.1:5433/ai_sdr_agent
```

Run migrations before starting the API:

```bash
npm run db:migrate
```

For production, use a managed PostgreSQL instance, set `DATABASE_URL` in the deployment
environment, and run `npm run db:migrate` during the release/deploy step. Set
`DATABASE_SSL=true` when your provider requires TLS. `DATABASE_AUTO_MIGRATE=true` is available
for simple deployments, but explicit release migrations are easier to reason about.

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

## AI Provider

By default, AI calls use the local mock heuristics so the app can run without cloud credentials:

```bash
AI_PROVIDER=MOCK
```

Set `AI_PROVIDER=VERTEX` to use Claude through Google Vertex AI. Local Vertex auth uses Google application default credentials, not an Anthropic API key:

```bash
gcloud config set project keep-calm-database
gcloud auth application-default login
gcloud services enable aiplatform.googleapis.com
```

Then set:

```bash
AI_PROVIDER=VERTEX
ANTHROPIC_VERTEX_PROJECT_ID=keep-calm-database
CLOUD_ML_REGION=global
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_MAX_OUTPUT_TOKENS=700
OUTREACH_CONCURRENCY=3
```

Make sure the Claude model is enabled for the project in Vertex AI Model Garden.
For Cloud Run, set the same env vars on the service and grant the runtime service account permission to call Vertex AI, commonly `roles/aiplatform.user`:

```bash
gcloud run services update ai-sdr-agent \
  --region=us-east1 \
  --update-env-vars="AI_PROVIDER=VERTEX,ANTHROPIC_VERTEX_PROJECT_ID=keep-calm-database,CLOUD_ML_REGION=global,CLAUDE_MODEL=claude-sonnet-4-6,OUTREACH_CONCURRENCY=3"

gcloud projects add-iam-policy-binding keep-calm-database \
  --member="serviceAccount:YOUR_CLOUD_RUN_SERVICE_ACCOUNT" \
  --role="roles/aiplatform.user"
```

`OUTREACH_CONCURRENCY` limits how many due leads are personalized and sent at the same time during `POST /outreach/run-daily`, which helps avoid sudden Vertex AI and SendGrid spikes.

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
