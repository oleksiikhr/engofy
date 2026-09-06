#!/usr/bin/env bash
# Roll out engofy: apply pending migrations (one-shot swarm service), then
# update the stack. Idempotent — safe to re-run. Run ON THE SWARM MANAGER:
#
#   IMAGE_TAG=<sha|vX.Y.Z> infra/deploy.sh
#
# Assumes (see docs/deploy.md): swarm initialised, the `engofy_*` secrets +
# `engofy_cloudflared_config` config created, infra/.env.production present,
# `docker login ghcr.io` done. The CI deploy job calls this same script.
set -euo pipefail
cd "$(dirname "$0")"

: "${IMAGE_TAG:?set IMAGE_TAG (image tag to roll out)}"
STACK="${STACK:-engofy}"
NET="${NET:-${STACK}_engofy}"
NEST_IMAGE="${NEST_IMAGE:-ghcr.io/oleksiikhr/engofy}:${IMAGE_TAG}"
ENV_FILE="${ENV_FILE:-./.env.production}"

[ -f "$ENV_FILE" ] || { echo "missing ${ENV_FILE}" >&2; exit 1; }

echo ">> pull ${NEST_IMAGE}"
docker pull "$NEST_IMAGE"

echo ">> migrate (one-shot service on ${NET})"
docker service rm "${STACK}_migrate" >/dev/null 2>&1 || true
docker service create \
  --name "${STACK}_migrate" \
  --network "$NET" \
  --restart-condition none \
  --env-file "$ENV_FILE" \
  --env NODE_ENV=production \
  --env MIKRO_ORM_HOST=postgres \
  --env MIKRO_ORM_PORT=5432 \
  --env MIKRO_ORM_USER=engofy \
  --env MIKRO_ORM_DB_NAME=engofy \
  --secret source=engofy_db_password,target=mikro_orm_password \
  --detach \
  "$NEST_IMAGE" node migrate >/dev/null

state=""
ok=0
for _ in $(seq 1 150); do
  state="$(docker service ps "${STACK}_migrate" --no-trunc --format '{{.CurrentState}}' 2>/dev/null | head -n1)"
  case "$state" in
    Complete*) ok=1; break ;;
    Failed*|Rejected*|"Shutdown"*) ok=0; break ;;
  esac
  sleep 2
done

docker service logs "${STACK}_migrate" 2>&1 | sed 's/^/   migrate | /' || true
docker service rm "${STACK}_migrate" >/dev/null 2>&1 || true

if [ "$ok" != "1" ]; then
  echo "!! migration did not complete (last state: ${state:-unknown})" >&2
  exit 1
fi

echo ">> docker stack deploy ${STACK}"
export IMAGE_TAG
docker stack deploy -c stack.prod.yaml --with-registry-auth --prune "$STACK"

echo ">> rollout started — watch: docker stack services ${STACK}"
