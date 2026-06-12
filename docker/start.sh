#!/bin/bash
set -e

echo "Starting DocMind API..."
uvicorn src.main:app --host 0.0.0.0 --port 8000 &
API_PID=$!

# Wait for API to be ready
for i in $(seq 1 30); do
  if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done
echo "API ready."

echo "Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:8000 --no-autoupdate &
TUNNEL_PID=$!

wait -n $API_PID $TUNNEL_PID
exit $?
