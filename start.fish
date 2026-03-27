#!/usr/bin/env fish

set -x N8N_HOST 0.0.0.0
set -x WEBHOOK_URL http://192.0.0.2:5678/
set -x N8N_COMMUNITY_PACKAGES_ENABLED false
set -x NODE_TLS_REJECT_UNAUTHORIZED 0
set -x N8N_DIAGNOSTICS_ENABLED false

cd (status dirname)
pnpm start
