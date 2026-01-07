#!/bin/bash
# =============================================================================
# TeamSync Editor - Remove CODE "Development Edition" Nag Screens
# =============================================================================
#
# This script removes Collabora Online Development Edition nag screens,
# watermarks, and popups from installed browser assets.
#
# Usage: remove-nags.sh [browser_dir]
#   browser_dir: Path to coolwsd browser directory (default: /usr/share/coolwsd/browser)
#
# Targets:
#   1. "Unsupported version" overlay (isAnyCode check)
#   2. Welcome/Release notes popup
#   3. "Development Edition" watermark text
#   4. Home mode restrictions
#
# =============================================================================

set -e

BROWSER_DIR="${1:-/usr/share/coolwsd/browser}"

echo "=========================================="
echo "TeamSync - Removing CODE Nag Screens"
echo "=========================================="
echo ""
echo "Target: $BROWSER_DIR"
echo ""

# Verify path exists
if [ ! -d "$BROWSER_DIR" ]; then
    echo "ERROR: Browser directory not found: $BROWSER_DIR"
    exit 1
fi

# =============================================================================
# 1. Disable "Unsupported" overlay (isAnyCode check)
# =============================================================================
echo "[1/5] Disabling 'Unsupported' overlay..."

if [ -f "$BROWSER_DIR/dist/bundle.js" ]; then
    # Disable the isAnyCode conditional that triggers the overlay
    sed -i 's/if\s*(isAnyCode)/if (false \&\& isAnyCode)/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i 's/if(isAnyCode)/if(false\&\&isAnyCode)/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true

    # Also disable any isAnyCodeOrDevelopment checks
    sed -i 's/isAnyCodeOrDevelopment/false/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true

    echo "  Modified: $BROWSER_DIR/dist/bundle.js"
else
    echo "  [SKIP] bundle.js not found"
fi

# =============================================================================
# 2. Neutralize welcome screen
# =============================================================================
echo "[2/5] Neutralizing welcome screen..."

WELCOME_FILE="$BROWSER_DIR/dist/welcome/welcome.html"
if [ -f "$WELCOME_FILE" ]; then
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>' > "$WELCOME_FILE"
    echo "  Emptied: $WELCOME_FILE"
elif [ -d "$BROWSER_DIR/dist/welcome" ]; then
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>' > "$BROWSER_DIR/dist/welcome/welcome.html"
    echo "  Created empty: $BROWSER_DIR/dist/welcome/welcome.html"
else
    mkdir -p "$BROWSER_DIR/dist/welcome"
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>' > "$BROWSER_DIR/dist/welcome/welcome.html"
    echo "  Created: $BROWSER_DIR/dist/welcome/welcome.html"
fi

# =============================================================================
# 3. Remove watermark text strings
# =============================================================================
echo "[3/5] Removing watermark text strings..."

if [ -f "$BROWSER_DIR/dist/bundle.js" ]; then
    # Remove "Development Edition" branding strings
    sed -i 's/"Collabora Online Development Edition"/"TeamSync Editor"/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i 's/"This is an unsupported version"/""/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i 's/"unsupported version"/""/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true

    # Remove CODE-specific warning messages
    sed -i 's/"This build is not supported."/""/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i 's/"Please use a supported version."/""/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true

    echo "  Removed watermark strings from bundle.js"
else
    echo "  [SKIP] bundle.js not found"
fi

# =============================================================================
# 4. Disable home mode restrictions in any embedded configs
# =============================================================================
echo "[4/5] Checking for embedded home mode configs..."

# Search for any JSON configs that might have home_mode enabled
find "$BROWSER_DIR" -type f -name "*.json" 2>/dev/null | while read -r file; do
    if grep -q "home_mode" "$file" 2>/dev/null; then
        sed -i 's/"home_mode":\s*true/"home_mode": false/g' "$file" 2>/dev/null || true
        echo "  Updated: $file"
    fi
done

echo "  Home mode check complete"

# =============================================================================
# 5. Remove any hard-coded connection/document limits in JS
# =============================================================================
echo "[5/5] Checking for hard-coded limits..."

if [ -f "$BROWSER_DIR/dist/bundle.js" ]; then
    # Some CODE builds have hard-coded limits - remove them
    # Look for patterns like maxDocuments: 20 or maxConnections: 20
    sed -i 's/maxDocuments:\s*20/maxDocuments: 100000/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i 's/maxConnections:\s*20/maxConnections: 100000/g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true

    echo "  Checked for hard-coded limits"
else
    echo "  [SKIP] bundle.js not found"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=========================================="
echo "Nag removal complete!"
echo "=========================================="
echo ""
echo "Removed:"
echo "  - 'Unsupported version' overlay"
echo "  - Welcome/Release notes popup"
echo "  - 'Development Edition' watermark"
echo "  - Home mode restrictions"
echo "  - Hard-coded document/connection limits"
echo ""
