#!/usr/bin/env sh
# Regenerates the committed raster icons and share image in public/ from the
# SVG sources in brand/. Needs rsvg-convert and ImageMagick (magick).
set -eu
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cp brand/icon.svg public/favicon.svg
rsvg-convert -w 48 -h 48 brand/icon.svg -o public/favicon-48.png
rsvg-convert -w 32 -h 32 brand/icon.svg -o "$tmp/favicon-32.png"
magick "$tmp/favicon-32.png" public/favicon-48.png public/favicon.ico
rsvg-convert -w 180 -h 180 brand/icon.svg -o public/apple-touch-icon.png
rsvg-convert -w 192 -h 192 brand/icon.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 brand/icon.svg -o public/icon-512.png
rsvg-convert -w 512 -h 512 brand/icon-maskable.svg -o public/icon-maskable-512.png
rsvg-convert -w 1200 -h 630 brand/og.svg -o public/og-default.png
