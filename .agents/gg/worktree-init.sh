#!/usr/bin/env bash
set -euo pipefail

if [[ -f ../.env.local && ! -f .env.local ]]; then
  cp ../.env.local .env.local
fi

if [[ ! -d node_modules ]]; then
  bun install
fi
