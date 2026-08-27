#!/bin/sh
# Regenerate everything in data/ and docs/generated/ from raw/maps/*.w3x.
set -e
cd "$(dirname "$0")/.."
for f in raw/maps/*.w3x; do
    python3 tools/extract_map.py "$f" data/maps assets/extracted
done
mkdir -p data/rules
for d in assets/extracted/*/; do
    [ -f "$d/war3map.j" ] || continue
    python3 tools/parse_jass.py "$d/war3map.j" > "data/rules/$(basename "$d").json"
done
mkdir -p data/scripts
for d in assets/extracted/*/; do
    [ -f "$d/war3map.j" ] || continue
    cp "$d/war3map.j" "data/scripts/$(basename "$d").j"
done
python3 tools/build_catalog.py
python3 tools/spawner_economics.py
python3 tools/asset_inventory.py
python3 tools/ip_audit.py
