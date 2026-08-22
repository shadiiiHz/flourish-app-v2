#!/usr/bin/env bash
# Idempotent deploy script — runs on the target server (via GitHub Actions SSH step).
# Safe to re-run: only installs/generates what's missing, then rebuilds and restarts.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> Deploying Flourish from $APP_DIR"

NODE_MAJOR=22
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

# 1. Swap — a 2GB RAM box can OOM during `next build`/`tsc`, a swapfile prevents that.
if [ ! -f /swapfile ]; then
  echo "==> Creating 2G swapfile"
  $SUDO fallocate -l 2G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile
  $SUDO swapon /swapfile
  echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

# 2. System packages
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/^v//;s/\..*//')" -lt "$NODE_MAJOR" ]; then
  echo "==> Installing Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO bash -
  $SUDO apt-get install -y nodejs
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker.io docker-compose-plugin
  $SUDO systemctl enable --now docker
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "==> Installing nginx"
  $SUDO apt-get update -y
  $SUDO apt-get install -y nginx
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing pm2"
  $SUDO npm install -g pm2
fi

# 3. Database
echo "==> Starting Postgres (docker compose)"
$SUDO docker compose up -d db

echo "==> Waiting for Postgres to accept connections"
for i in $(seq 1 30); do
  if $SUDO docker compose exec -T db pg_isready -U flourish >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# 4. Env files — generated once on first deploy, never overwritten afterwards.
if [ ! -f server/.env ]; then
  echo "==> Generating server/.env"
  JWT_SECRET="$(openssl rand -hex 32)"
  ADMIN_PASSWORD="$(openssl rand -hex 8)"
  HOST="${DEPLOY_HOST:-localhost}"
  cat > server/.env <<EOF
DATABASE_URL=postgresql://flourish:flourish@localhost:5432/flourish
JWT_SECRET=${JWT_SECRET}
PORT=4000
CORS_ORIGIN=http://${HOST}
API_URL=http://${HOST}/api
APP_URL=http://${HOST}
ADMIN_SEED_EMAIL=admin@flourish.local
ADMIN_SEED_PASSWORD=${ADMIN_PASSWORD}
# Fill these in to enable SMS / online payment:
# MELIPAYAMAK_API_KEY=
# MELIPAYAMAK_SENDER=
# ZARINPAL_MERCHANT_ID=
# ZARINPAL_SANDBOX=true
EOF
  echo "!! First-time setup: generated admin login admin@flourish.local / ${ADMIN_PASSWORD}"
  echo "!! Saved in server/.env on the server — change it after first login."
fi

if [ ! -f .env.production.local ]; then
  echo "==> Generating .env.production.local"
  cat > .env.production.local <<EOF
NEXT_PUBLIC_API_URL=http://${DEPLOY_HOST:-localhost}
EOF
fi

# 5. Dependencies
echo "==> Installing dependencies"
export NODE_OPTIONS="--max-old-space-size=1536"
npm ci
(cd server && npm ci)

# 6. Database schema
echo "==> Running Prisma migrate + generate"
(cd server && npx prisma generate && npx prisma migrate deploy)

echo "==> Seeding catalog / admin user (safe to re-run — upserts only)"
(cd server && npm run seed)

# 7. Build
echo "==> Building backend"
(cd server && npm run build)

echo "==> Building frontend"
npm run build

# 8. Process manager
echo "==> Starting/reloading services with pm2"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

if [ ! -f /etc/systemd/system/pm2-"$(whoami)".service ]; then
  echo "==> Enabling pm2 on boot"
  $SUDO env PATH="$PATH:$(dirname "$(command -v node)")" "$(command -v pm2)" startup systemd -u "$(whoami)" --hp "$HOME" || true
fi

# 9. Reverse proxy
echo "==> Configuring nginx"
$SUDO cp deploy/nginx.conf /etc/nginx/sites-available/flourish
$SUDO ln -sf /etc/nginx/sites-available/flourish /etc/nginx/sites-enabled/flourish
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t
$SUDO systemctl reload nginx

echo "==> Deploy finished"
