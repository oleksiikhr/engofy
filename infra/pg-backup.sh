#!/usr/bin/env bash
# Postgres -> Cloudflare R2 backup. Runs on the swarm manager node from cron:
#
#   5 3 * * *  /opt/engofy/infra/pg-backup.sh >> /var/log/engofy-pg-backup.log 2>&1
#
# It `pg_dump -Fc` (custom format: compressed, `pg_restore`-able, selective)
# straight out of the running postgres task, then streams the file to R2 via a
# throwaway aws-cli container (no host aws-cli dependency).
#
# Required env (put them in an EnvironmentFile the cron entry sources — NOT in
# this file):
#   R2_BUCKET               e.g. engofy-backups
#   R2_ENDPOINT             https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID       R2 API token, "Object Read & Write" on the bucket
#   AWS_SECRET_ACCESS_KEY
# Optional:
#   PG_SERVICE       swarm service name          (default: engofy_postgres)
#   PGDATABASE                                    (default: engofy)
#   PGUSER                                        (default: engofy)
#   KEEP_LOCAL_DAYS  local .dump retention        (default: 7)
#   LOCAL_DIR                                     (default: /var/backups/engofy-pg)
#   AWSCLI_IMAGE                                  (default: amazon/aws-cli:2.17.0)
#   R2_PREFIX        key prefix inside the bucket (default: pg)
#
# Remote retention: set an R2 lifecycle rule on the bucket (e.g. expire after
# 30 days) rather than pruning here.
#
# Restore (see docs/deploy.md):
#   cid=$(docker ps -q -f label=com.docker.swarm.service.name=engofy_postgres)
#   docker exec -i "$cid" pg_restore --clean --if-exists --no-owner \
#       -U engofy -d engofy < engofy-engofy-YYYYMMDDTHHMMSSZ.dump
set -euo pipefail

PG_SERVICE="${PG_SERVICE:-engofy_postgres}"
PGDATABASE="${PGDATABASE:-engofy}"
PGUSER="${PGUSER:-engofy}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"
LOCAL_DIR="${LOCAL_DIR:-/var/backups/engofy-pg}"
AWSCLI_IMAGE="${AWSCLI_IMAGE:-amazon/aws-cli:2.17.0}"
R2_PREFIX="${R2_PREFIX:-pg}"

: "${R2_BUCKET:?set R2_BUCKET}"
: "${R2_ENDPOINT:?set R2_ENDPOINT}"
: "${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY}"
# R2 ignores the region but the SDK/CLI still require one.
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

log() { echo "[$(date -u +%FT%TZ)] $*"; }

ts="$(date -u +%Y%m%dT%H%M%SZ)"
name="engofy-${PGDATABASE}-${ts}.dump"
mkdir -p "$LOCAL_DIR"
dest="${LOCAL_DIR}/${name}"

# One running task container of the postgres service on THIS node.
cid="$(docker ps -q -f "label=com.docker.swarm.service.name=${PG_SERVICE}" | head -n1)"
if [ -z "$cid" ]; then
  echo "no running task for ${PG_SERVICE} on this node" >&2
  exit 1
fi

log "pg_dump ${PGDATABASE} -> ${dest}"
docker exec -i "$cid" pg_dump -Fc --no-owner -U "$PGUSER" "$PGDATABASE" > "$dest"

size="$(wc -c < "$dest")"
if [ "$size" -lt 1000 ]; then
  echo "dump suspiciously small (${size} bytes) — aborting, keeping the file" >&2
  exit 1
fi

log "upload -> s3://${R2_BUCKET}/${R2_PREFIX}/${name} (${size} bytes)"
docker run --rm \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
  -v "${dest}:/tmp/${name}:ro" \
  "$AWSCLI_IMAGE" \
  --endpoint-url "$R2_ENDPOINT" \
  s3 cp "/tmp/${name}" "s3://${R2_BUCKET}/${R2_PREFIX}/${name}"

log "prune local dumps older than ${KEEP_LOCAL_DAYS}d"
find "$LOCAL_DIR" -type f -name 'engofy-*.dump' -mtime "+${KEEP_LOCAL_DAYS}" -print -delete

log "done"
