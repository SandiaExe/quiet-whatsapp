#!/bin/sh
# Empaqueta solo lo que necesita la extensión, listo para subir a la Chrome Web Store.
set -e
cd "$(dirname "$0")"
version=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)
mkdir -p dist
rm -f "dist/quiet-whatsapp-$version.zip"
zip -qr "dist/quiet-whatsapp-$version.zip" manifest.json themes.js content.js content.css popup.html popup.css popup.js icons _locales
echo "dist/quiet-whatsapp-$version.zip"
