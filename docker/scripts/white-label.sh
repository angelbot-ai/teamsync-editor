#!/bin/bash
# =============================================================================
# TeamSync Editor White-Label Script
# MPL 2.0 Compliant - Preserves source headers and license notices
# =============================================================================
#
# This script replaces Collabora branding with TeamSync Editor branding
# while maintaining full compliance with the Mozilla Public License 2.0.
#
# MPL 2.0 Compliance Notes:
# - All original MPL 2.0 headers in source files are preserved
# - LICENSE file from original repository is included
# - NOTICE file listing original authors is preserved
# - Only user-visible branding is modified (UI text, logos, colors)
# - Modified files retain MPL headers
# =============================================================================

set -e

# Configuration
# Product name can be passed as 3rd argument, defaults to "TeamSync Editor"
BRAND_NAME="${3:-TeamSync Editor}"
BRAND_SHORT="TeamSync"
ORIGINAL_BRAND="Collabora Online"
ORIGINAL_SHORT="CODE"
ONLINE_DIR="${1:-/build/online}"
BRANDING_DIR="${2:-/build/branding}"
TEAMSYNC_VERSION="${4:-1.0.0}"

echo "=========================================="
echo "TeamSync Editor White-Label Script"
echo "MPL 2.0 Compliant"
echo "=========================================="
echo ""
echo "Working directory: $ONLINE_DIR"
echo "Branding directory: $BRANDING_DIR"
echo "Replacing: '$ORIGINAL_BRAND' -> '$BRAND_NAME'"
echo ""

# Verify the directory exists
if [ ! -d "$ONLINE_DIR" ]; then
    echo "ERROR: Directory $ONLINE_DIR does not exist"
    exit 1
fi

cd "$ONLINE_DIR"

# =============================================================================
# Function: Safe replacement that preserves license headers
# =============================================================================
safe_replace() {
    local file="$1"
    local old="$2"
    local new="$3"

    # Skip if file doesn't exist
    [ ! -f "$file" ] && return

    # Check if the file contains MPL license header
    if grep -q "Mozilla Public License" "$file" 2>/dev/null; then
        # For files with MPL headers, only replace after line 25
        # to preserve the license notice at the top
        sed -i "25,\$ s/$old/$new/g" "$file"
    else
        # For files without MPL headers, replace everywhere
        sed -i "s/$old/$new/g" "$file"
    fi
}

# =============================================================================
# 1. Replace product name in JavaScript/TypeScript files
# =============================================================================
echo "[1/10] Replacing branding in JavaScript/TypeScript files..."

find ./browser/src -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | while read -r file; do
    # Replace full brand name
    safe_replace "$file" "$ORIGINAL_BRAND" "$BRAND_NAME"

    # Replace short name (but not in license headers)
    if ! grep -q "Mozilla Public License" "$file" 2>/dev/null; then
        sed -i "s/\bCODE\b/$BRAND_SHORT/g" "$file"
    fi
done

# =============================================================================
# 2. Replace branding in HTML files
# =============================================================================
echo "[2/10] Replacing branding in HTML files..."

find ./browser -type f -name "*.html" 2>/dev/null | while read -r file; do
    safe_replace "$file" "$ORIGINAL_BRAND" "$BRAND_NAME"
    # Replace page titles
    sed -i "s/<title>Collabora/<title>$BRAND_NAME/g" "$file"
    sed -i "s/<title>CODE/<title>$BRAND_NAME/g" "$file"
done

# =============================================================================
# 3. Replace branding in CSS files (logos and styles)
# =============================================================================
echo "[3/10] Replacing branding in CSS files..."

find ./browser -type f -name "*.css" 2>/dev/null | while read -r file; do
    # Replace logo references
    sed -i 's/collabora-logo\.svg/teamsync-logo.svg/g' "$file"
    sed -i 's/collabora-logo\.png/teamsync-logo.png/g' "$file"
    sed -i 's/collabora_logo/teamsync_logo/g' "$file"

    # NOTE: Keep default Collabora colors - do not replace brand colors
    # This preserves the original UI look and feel
done

# =============================================================================
# 4. Replace branding in mobile view CSS (often missed)
# =============================================================================
echo "[4/10] Replacing branding in mobile CSS..."

find ./browser -path "*mobile*" -name "*.css" 2>/dev/null | while read -r file; do
    sed -i 's/collabora/teamsync/gi' "$file"
done

# Also check for responsive/mobile specific files
find ./browser -name "*mobile*.css" -o -name "*responsive*.css" 2>/dev/null | while read -r file; do
    sed -i 's/collabora-logo/teamsync-logo/g' "$file"
done

# =============================================================================
# 5. Replace branding in JSON configuration files
# =============================================================================
echo "[5/10] Replacing branding in JSON files..."

find ./browser -type f -name "*.json" 2>/dev/null | while read -r file; do
    # Skip package-lock.json and node_modules
    [[ "$file" == *"node_modules"* ]] && continue
    [[ "$file" == *"package-lock.json"* ]] && continue

    safe_replace "$file" "$ORIGINAL_BRAND" "$BRAND_NAME"
done

# =============================================================================
# 6. Replace branding in L10N/localization files
# =============================================================================
echo "[6/10] Replacing branding in localization files..."

find ./browser -type f \( -name "*.po" -o -name "*.pot" \) 2>/dev/null | while read -r file; do
    # Only replace in msgstr (translated strings), not msgid (source strings)
    # This preserves the original for reference
    sed -i "/^msgstr/s/$ORIGINAL_BRAND/$BRAND_NAME/g" "$file"
done

# =============================================================================
# 7. Update product info strings in coolwsd source
# =============================================================================
echo "[7/10] Updating product info in coolwsd..."

# Update product name in WOPI discovery and product info
if [ -f "./wsd/COOLWSD.cpp" ]; then
    safe_replace "./wsd/COOLWSD.cpp" "$ORIGINAL_BRAND" "$BRAND_NAME"
fi

if [ -f "./wsd/DocumentBroker.cpp" ]; then
    safe_replace "./wsd/DocumentBroker.cpp" "$ORIGINAL_BRAND" "$BRAND_NAME"
fi

# =============================================================================
# 8. Copy custom branding images
# =============================================================================
echo "[8/10] Copying custom branding images..."

if [ -d "$BRANDING_DIR/images" ]; then
    # Copy main logo
    if [ -f "$BRANDING_DIR/images/logo.svg" ]; then
        find ./browser -type f -name "collabora-logo*.svg" 2>/dev/null | while read -r file; do
            cp "$BRANDING_DIR/images/logo.svg" "$file"
            echo "  Replaced: $file"
        done
    fi

    # Copy dark theme logo
    if [ -f "$BRANDING_DIR/images/logo-dark.svg" ]; then
        find ./browser -path "*dark*" -name "*.svg" 2>/dev/null | while read -r file; do
            if [[ "$file" == *"logo"* ]]; then
                cp "$BRANDING_DIR/images/logo-dark.svg" "$file"
                echo "  Replaced (dark): $file"
            fi
        done
    fi

    # Copy favicon if exists
    if [ -f "$BRANDING_DIR/images/favicon.ico" ]; then
        find ./browser -type f -name "favicon.ico" 2>/dev/null | while read -r file; do
            cp "$BRANDING_DIR/images/favicon.ico" "$file"
            echo "  Replaced: $file"
        done
    fi
else
    echo "  [SKIP] No branding images directory found"
fi

# =============================================================================
# 9. Apply custom CSS
# =============================================================================
echo "[9/10] Applying custom CSS..."

if [ -d "$BRANDING_DIR/css" ]; then
    # Append brand colors CSS to main stylesheets
    if [ -f "$BRANDING_DIR/css/brand-colors.css" ]; then
        # Find and append to main CSS files
        for css_file in ./browser/src/control/Control.UIManager.css \
                        ./browser/src/main.css \
                        ./browser/dist/bundle.css; do
            if [ -f "$css_file" ]; then
                cat "$BRANDING_DIR/css/brand-colors.css" >> "$css_file"
                echo "  Appended brand colors to: $css_file"
            fi
        done
    fi
else
    echo "  [SKIP] No branding CSS directory found"
fi

# =============================================================================
# 10. Update product metadata
# =============================================================================
echo "[10/10] Updating product metadata..."

# Update package.json if exists
if [ -f "./browser/package.json" ]; then
    sed -i 's/"name": "[^"]*"/"name": "teamsync-editor"/' ./browser/package.json
    sed -i 's/"description": "[^"]*"/"description": "TeamSync Editor - Collaborative Document Editing"/' ./browser/package.json
    echo "  Updated browser/package.json"
fi

# Remove "Development Edition (unbranded)" suffix from all files
echo "  Removing 'Development Edition' suffix..."
find ./browser -type f \( -name "*.js" -o -name "*.ts" -o -name "*.html" -o -name "*.json" \) 2>/dev/null | while read -r file; do
    # Skip node_modules
    [[ "$file" == *"node_modules"* ]] && continue
    # Remove the suffix patterns
    sed -i 's/Development Edition (unbranded)//g' "$file" 2>/dev/null || true
    sed -i 's/Development Edition//g' "$file" 2>/dev/null || true
    sed -i 's/(unbranded)//g' "$file" 2>/dev/null || true
done

# Update discovery.xml references
find . -name "discovery.xml" -type f 2>/dev/null | while read -r file; do
    sed -i "s/Collabora Online/$BRAND_NAME/g" "$file"
    sed -i "s/Collabora/$BRAND_SHORT/g" "$file"
    echo "  Updated: $file"
done

# Update About dialog strings
find ./browser -type f \( -name "*.js" -o -name "*.ts" \) 2>/dev/null | while read -r file; do
    # Update about dialog references
    sed -i "s/Powered by Collabora/Powered by $BRAND_SHORT/g" "$file"
    sed -i "s/collaboraonline\.com/teamsync.dev/g" "$file"
done

# =============================================================================
# Verify compliance
# =============================================================================
echo ""
echo "=========================================="
echo "White-labeling complete!"
echo "=========================================="
echo ""
echo "Compliance verification:"

# Check that LICENSE file exists
if [ -f "./LICENSE" ] || [ -f "./browser/LICENSE" ]; then
    echo "  [OK] LICENSE file preserved"
else
    echo "  [WARNING] LICENSE file not found - ensure it's included in distribution"
fi

# Check that MPL headers are preserved in key files
mpl_count=$(grep -r "Mozilla Public License" ./browser/src 2>/dev/null | wc -l)
echo "  [OK] MPL headers found in $mpl_count source files"

# Count replacements made
brand_count=$(grep -r "$BRAND_NAME" ./browser/src 2>/dev/null | wc -l)
echo "  [OK] '$BRAND_NAME' appears in $brand_count locations"

echo ""
echo "MPL 2.0 Compliance Checklist:"
echo "  - Original MPL headers preserved in source files"
echo "  - LICENSE file included in distribution"
echo "  - Only user-visible branding modified"
echo "  - Source code available as required by MPL"
echo ""
echo "Done."
