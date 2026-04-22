#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== ExtremeRisk: running backend ==="
cd "$ROOT"
python backend/run.py

echo ""
echo "=== ExtremeRisk: starting frontend ==="
cd "$ROOT/frontend"
npm run dev
