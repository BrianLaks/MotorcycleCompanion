# Deploying to GCP (Docker)

The app is a zero-dependency Node server that serves the static site **and**
persists all user data to a single JSON file (`db.json`). Two things matter for
a cloud deploy:

1. **Persistence** — a container's filesystem is ephemeral. `db.json` must live
   on a **mounted volume**, or every restart wipes your garage.
2. **Auth** — the API has no auth of its own. Set `BASIC_AUTH_USER` /
   `BASIC_AUTH_PASS` (built in) or put Google IAP in front before exposing it.

The container reads three env vars: `PORT` (Cloud Run injects it), `DATA_DIR`
(where `db.json` goes — point at the volume), and the two `BASIC_AUTH_*`.

Two paths below. **Cloud Run is recommended** (serverless, scales to zero, ~free
when idle). Compute Engine is the always-on-VM alternative.

---

## Option A — Cloud Run + a GCS bucket for the data (recommended)

Data lives in a Cloud Storage bucket mounted at `/data`. Pin `--max-instances=1`
so the single JSON file only ever has one writer.

### 1. One-time setup
```bash
# --- your project (pre-filled); pick a region if you don't like this one ---
export PROJECT_ID=motorcyclecompanion-502718
export REGION=us-central1
export BUCKET=${PROJECT_ID}-data                # must be globally unique
export SERVICE=motorcycle-companion

gcloud config set project "$PROJECT_ID"

# Enable the APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com storage.googleapis.com

# Create the data bucket (versioning on = free undo history for the db)
gcloud storage buckets create "gs://$BUCKET" --location="$REGION"
gcloud storage buckets update "gs://$BUCKET" --versioning
```

### 2. Deploy (build + release in one command)
`--source .` makes Cloud Build build the Dockerfile for you — no local Docker
needed.
```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --port 8080 \
  --max-instances 1 \
  --cpu-boost \
  --allow-unauthenticated \
  --set-env-vars DATA_DIR=/data \
  --update-secrets BASIC_AUTH_PASS=moto-companion-pass:latest \
  --set-env-vars BASIC_AUTH_USER=brian \
  --add-volume name=data,type=cloud-storage,bucket=$BUCKET \
  --add-volume-mount volume=data,mount-path=/data
```

For the password, create the secret once (keeps it out of the deploy config):
```bash
printf 'choose-a-strong-password' | gcloud secrets create moto-companion-pass --data-file=-
# let Cloud Run's runtime service account read it:
PROJNUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding moto-companion-pass \
  --member="serviceAccount:${PROJNUM}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```
(If you'd rather skip Secret Manager for now, drop the `--update-secrets` line
and add `BASIC_AUTH_PASS=...` to `--set-env-vars` — fine for a personal app,
just visible in the service config.)

### 3. Give the service access to the bucket
The runtime service account needs read/write on the bucket:
```bash
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:${PROJNUM}-compute@developer.gserviceaccount.com" \
  --role=roles/storage.objectAdmin
```

The deploy prints a `https://…run.app` URL. Open it, log in with your
BASIC_AUTH user/pass, and you're live. Redeploy anytime by re-running step 2.

**Notes / caveats**
- `--max-instances 1` is deliberate: the app writes the whole `db.json` at once,
  so multiple instances could clobber each other. Single-user personal use only.
- The db writes via temp-file + rename; on the GCS FUSE mount that's emulated
  but fine for a tiny file. Bucket **versioning** (enabled above) gives you a
  rollback if a write ever goes wrong.
- Stronger auth instead of Basic: deploy with `--no-allow-unauthenticated` and
  put **Identity-Aware Proxy** in front (Google-login gate). More setup; Basic
  Auth is the quick path.

---

## Option B — Compute Engine VM + Docker (always-on)

A small VM (e2-micro is free-tier eligible in some US regions) running the
container with the data bind-mounted to the host disk.

```bash
export PROJECT_ID=motorcyclecompanion-502718
export ZONE=us-central1-a
gcloud config set project "$PROJECT_ID"

# 1. VM with Docker + firewall for HTTP
gcloud compute instances create moto-companion \
  --zone "$ZONE" --machine-type e2-micro \
  --image-family debian-12 --image-project debian-cloud \
  --tags http-server
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 --target-tags http-server

# 2. SSH in
gcloud compute ssh moto-companion --zone "$ZONE"
```
Then on the VM:
```bash
sudo apt-get update && sudo apt-get install -y docker.io git
sudo git clone https://github.com/BrianLaks/MotorcycleCompanion.git /opt/moto-companion
sudo docker build -t moto-companion /opt/moto-companion
sudo mkdir -p /var/moto-data
sudo docker run -d --restart unless-stopped --name moto \
  -p 80:8080 \
  -e DATA_DIR=/data \
  -e BASIC_AUTH_USER=brian -e BASIC_AUTH_PASS='choose-a-strong-password' \
  -v /var/moto-data:/data \
  moto-companion
```
Visit `http://<VM-external-IP>/`. Data persists in `/var/moto-data` on the VM.
Put a TLS proxy (Caddy/nginx) or a load balancer in front for HTTPS.

---

## Test the image locally first (optional)
```bash
docker build -t moto-companion .
docker run --rm -p 8080:8080 -e DATA_DIR=/data \
  -e BASIC_AUTH_USER=brian -e BASIC_AUTH_PASS=secret \
  -v "$PWD/userdata:/data" moto-companion
# open http://localhost:8080  (login brian / secret)
```

## Backups
- In-app **Export** (app bar) downloads the whole db as JSON anytime.
- Cloud Run path: GCS **object versioning** keeps prior `db.json` versions.
- VM path: snapshot the disk, or copy `/var/moto-data/db.json`.
