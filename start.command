#!/bin/bash
# SpaceScript Bridge launcher (macOS)
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo " [SpaceScript] Node.js was not found."
  echo " [SpaceScript] Install Node.js 18+ from https://nodejs.org then re-run start.command."
  echo ""
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

echo ""
echo " Starting SpaceScript Bridge..."
echo " Dashboard: http://127.0.0.1:6471"
echo ""
node bridge/index.js
