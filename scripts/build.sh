#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/.openai" "$dist_root/server"
cp -R "$project_root/public/." "$dist_root/"
if [ -f "$project_root/.openai/hosting.json" ]; then
  cp "$project_root/.openai/hosting.json" "$dist_root/.openai/hosting.json"
fi
if [ -f "$project_root/worker/index.js" ]; then
  cp "$project_root/worker/index.js" "$dist_root/server/index.js"
fi

echo "Built static app into $dist_root"
