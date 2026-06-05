#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -d "node_modules" ]; then
  echo "A instalar dependencias..."
  npm install
fi
echo "A iniciar dashboard em http://localhost:3000"
npm start
