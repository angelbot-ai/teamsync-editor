#!/bin/bash
# =============================================================================
# TeamSync Editor - Apply Branding Script
# =============================================================================
#
# This script applies TeamSync branding to pre-installed Collabora Online
# browser assets. It modifies the installed files in-place, which is simpler
# and faster than rebuilding from source.
#
# MPL 2.0 Compliance:
# - Only modifies user-visible branding (text, logos, colors)
# - Preserves all license headers and notices
# - Does not modify core functionality
#
# Usage: apply-branding.sh <coolwsd_path> <branding_dir> <product_name>
#   coolwsd_path: Path to coolwsd installation (e.g., /usr/share/coolwsd)
#   branding_dir: Path to branding assets directory
#   product_name: Product name to display (e.g., "TeamSync Document")
#
# =============================================================================

set -e

COOLWSD_PATH="${1:-/usr/share/coolwsd}"
BRANDING_DIR="${2:-/tmp/branding}"
PRODUCT_NAME="${3:-TeamSync Editor}"
PRODUCT_SHORT="TeamSync"

ORIGINAL_BRAND="Collabora Online"
ORIGINAL_SHORT="CODE"

echo "=========================================="
echo "TeamSync Branding Application"
echo "=========================================="
echo ""
echo "Target: $COOLWSD_PATH"
echo "Branding: $BRANDING_DIR"
echo "Product: $PRODUCT_NAME"
echo ""

# Verify paths exist
if [ ! -d "$COOLWSD_PATH" ]; then
    echo "ERROR: coolwsd path not found: $COOLWSD_PATH"
    exit 1
fi

BROWSER_DIR="$COOLWSD_PATH/browser"
if [ ! -d "$BROWSER_DIR" ]; then
    echo "ERROR: browser directory not found: $BROWSER_DIR"
    exit 1
fi

# =============================================================================
# 1. Replace product name in HTML files
# =============================================================================
echo "[1/7] Updating HTML files..."

find "$BROWSER_DIR" -type f -name "*.html" 2>/dev/null | while read -r file; do
    # Replace brand names
    sed -i "s/$ORIGINAL_BRAND/$PRODUCT_NAME/g" "$file" 2>/dev/null || true
    sed -i "s/Collabora Online/$PRODUCT_NAME/g" "$file" 2>/dev/null || true

    # Update page titles
    sed -i "s/<title>Collabora/<title>$PRODUCT_NAME/g" "$file" 2>/dev/null || true
    sed -i "s/<title>CODE/<title>$PRODUCT_NAME/g" "$file" 2>/dev/null || true
done

# =============================================================================
# 2. Replace branding in JavaScript bundles
# =============================================================================
echo "[2/7] Updating JavaScript bundles..."

# Update bundle.js if it exists
if [ -f "$BROWSER_DIR/dist/bundle.js" ]; then
    sed -i "s/$ORIGINAL_BRAND/$PRODUCT_NAME/g" "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i "s/Collabora Online/$PRODUCT_NAME/g" "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    # Update about dialog and UI strings
    sed -i "s/Powered by Collabora/Powered by $PRODUCT_SHORT/g" "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    # Remove "Development Edition (unbranded)" suffix
    sed -i 's/Development Edition (unbranded)//g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i 's/Development Edition//g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
    sed -i 's/(unbranded)//g' "$BROWSER_DIR/dist/bundle.js" 2>/dev/null || true
fi

# Update admin bundle if it exists
if [ -f "$BROWSER_DIR/dist/admin-bundle.js" ]; then
    sed -i "s/$ORIGINAL_BRAND/$PRODUCT_NAME/g" "$BROWSER_DIR/dist/admin-bundle.js" 2>/dev/null || true
    # Remove "Development Edition" suffix from admin bundle too
    sed -i 's/Development Edition (unbranded)//g' "$BROWSER_DIR/dist/admin-bundle.js" 2>/dev/null || true
    sed -i 's/Development Edition//g' "$BROWSER_DIR/dist/admin-bundle.js" 2>/dev/null || true
fi

# =============================================================================
# 3. Replace branding in CSS files
# =============================================================================
echo "[3/7] Updating CSS files..."

find "$BROWSER_DIR" -type f -name "*.css" 2>/dev/null | while read -r file; do
    # Replace logo references
    sed -i 's/collabora-logo\.svg/teamsync-logo.svg/g' "$file" 2>/dev/null || true
    sed -i 's/collabora-logo\.png/teamsync-logo.png/g' "$file" 2>/dev/null || true
    sed -i 's/collabora_logo/teamsync_logo/g' "$file" 2>/dev/null || true

    # NOTE: Keep default Collabora colors - do not replace brand colors
    # This preserves the original UI look and feel
done

# =============================================================================
# 4. Replace logo images
# =============================================================================
echo "[4/7] Replacing logo images..."

if [ -d "$BRANDING_DIR/images" ]; then
    # Replace SVG logos
    if [ -f "$BRANDING_DIR/images/logo.svg" ]; then
        find "$BROWSER_DIR" -type f -name "collabora-logo*.svg" 2>/dev/null | while read -r file; do
            cp "$BRANDING_DIR/images/logo.svg" "$file"
            echo "  Replaced: $file"
        done

        find "$BROWSER_DIR" -type f -name "loleaflet-logo*.svg" 2>/dev/null | while read -r file; do
            cp "$BRANDING_DIR/images/logo.svg" "$file"
            echo "  Replaced: $file"
        done
    fi

    # Replace dark theme logo
    if [ -f "$BRANDING_DIR/images/logo-dark.svg" ]; then
        find "$BROWSER_DIR" -path "*dark*" -name "*logo*.svg" 2>/dev/null | while read -r file; do
            cp "$BRANDING_DIR/images/logo-dark.svg" "$file"
            echo "  Replaced (dark): $file"
        done
    fi

    # Replace favicon
    if [ -f "$BRANDING_DIR/images/favicon.ico" ]; then
        find "$BROWSER_DIR" -type f -name "favicon.ico" 2>/dev/null | while read -r file; do
            cp "$BRANDING_DIR/images/favicon.ico" "$file"
            echo "  Replaced: $file"
        done
    fi
else
    echo "  [SKIP] No branding images directory found"
fi

# =============================================================================
# 5. Apply custom CSS if provided
# =============================================================================
echo "[5/7] Applying custom CSS..."

if [ -f "$BRANDING_DIR/css/brand-colors.css" ]; then
    # Append to bundle.css
    if [ -f "$BROWSER_DIR/dist/bundle.css" ]; then
        cat "$BRANDING_DIR/css/brand-colors.css" >> "$BROWSER_DIR/dist/bundle.css"
        echo "  Appended brand colors to bundle.css"
    fi
fi

# =============================================================================
# 6. Update discovery.xml
# =============================================================================
echo "[6/7] Updating discovery.xml..."

DISCOVERY_FILE="$COOLWSD_PATH/discovery.xml"
if [ -f "$DISCOVERY_FILE" ]; then
    sed -i "s/Collabora Online/$PRODUCT_NAME/g" "$DISCOVERY_FILE" 2>/dev/null || true
    sed -i "s/Collabora/$PRODUCT_SHORT/g" "$DISCOVERY_FILE" 2>/dev/null || true
    echo "  Updated: $DISCOVERY_FILE"
fi

# Also check in browser/dist
if [ -f "$BROWSER_DIR/dist/discovery.xml" ]; then
    sed -i "s/Collabora Online/$PRODUCT_NAME/g" "$BROWSER_DIR/dist/discovery.xml" 2>/dev/null || true
    echo "  Updated: $BROWSER_DIR/dist/discovery.xml"
fi

# =============================================================================
# 7. Update localization strings
# =============================================================================
echo "[7/7] Updating localization files..."

find "$BROWSER_DIR" -type f -name "*.json" 2>/dev/null | while read -r file; do
    # Skip node_modules
    [[ "$file" == *"node_modules"* ]] && continue

    sed -i "s/$ORIGINAL_BRAND/$PRODUCT_NAME/g" "$file" 2>/dev/null || true
done

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=========================================="
echo "Branding complete!"
echo "=========================================="
echo ""
echo "Product: $PRODUCT_NAME"
echo "Target:  $COOLWSD_PATH"
echo ""
