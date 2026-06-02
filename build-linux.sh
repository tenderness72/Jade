#!/bin/bash
# Jade release build script (Linux / Xubuntu)
# Output: src-tauri/target/release/bundle/
#   deb/      -> .deb package (apt install)
#   appimage/ -> .AppImage  (portable, no install needed)

set -e

echo "[>>] Checking dependencies..."

# Tauri on Linux requires these packages
PKGS="libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf"
MISSING=""
for pkg in $PKGS; do
    dpkg -s "$pkg" &>/dev/null || MISSING="$MISSING $pkg"
done

if [ -n "$MISSING" ]; then
    echo "[!!] Missing packages:$MISSING"
    echo "     Run: sudo apt install$MISSING"
    exit 1
fi

echo "[OK] Dependencies OK"
echo "[>>] Building Jade release package..."

cd "$(dirname "$0")"
npm run tauri build

echo ""
echo "[OK] Build complete!"
echo "     Installers -> src-tauri/target/release/bundle/"
ls src-tauri/target/release/bundle/**/*.{deb,AppImage} 2>/dev/null || true
