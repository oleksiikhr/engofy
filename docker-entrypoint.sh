#!/bin/sh
# Swarm secret -> env shim. Each `docker secret` attached to a service is
# mounted read-only at /run/secrets/<name>; this exports it as an env var so
# the app's config layer (src/core/config/*) sees a plain variable and nothing
# sensitive is baked into the image or the stack file.
#
# Mapping: file name -> UPPER_SNAKE. `engofy_db_password` -> ENGOFY_DB_PASSWORD,
# `resend-api-key` -> RESEND_API_KEY. So name each secret after its variable.
# A value already present in the environment is left untouched (lets a one-off
# `docker run -e VAR=...` or a compose `environment:` override win); otherwise
# the secret file is the source of truth. Trailing newlines are stripped.
#
# Chained after tini:  ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
# then `exec "$@"` runs the service command (node main | worker | cron | cli)
# as the same PID, so tini stays PID 1.
set -eu

if [ -d /run/secrets ]; then
  for secret_file in /run/secrets/*; do
    [ -f "$secret_file" ] || continue

    var_name=$(basename "$secret_file" | tr '[:lower:].-' '[:upper:]__')

    # Skip if the caller already set it (explicit override wins).
    eval "current=\${${var_name}:-}"
    [ -n "$current" ] && continue

    export "$var_name=$(cat "$secret_file")"
  done
fi

exec "$@"
