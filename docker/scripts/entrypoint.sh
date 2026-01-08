#!/bin/bash
# =============================================================================
# TeamSync Editor - Container Entrypoint Script
# =============================================================================
#
# This script configures coolwsd at runtime based on environment variables
# and starts the service.
#
# Environment Variables:
#   WOPI_HOST_URL       - URL of your WOPI host (e.g., http://localhost:3000)
#   COOL_ADMIN_USER     - Admin console username (optional)
#   COOL_ADMIN_PASSWORD - Admin console password (optional)
#   DICTIONARIES        - Space-separated list of dictionaries (e.g., "en_US en_GB")
#   EXTRA_PARAMS        - Additional coolwsd parameters
#   SSL_ENABLE          - Enable SSL (true/false, default: false for dev)
#   SSL_TERMINATION     - SSL termination (true = handled by reverse proxy)
#   TEAMSYNC_PRODUCT    - Product variant (document, sheets, presentation, or all)
#
# =============================================================================

set -e

CONFIG_FILE="/etc/coolwsd/coolwsd.xml"
DISCOVERY_FILE="/opt/cool/share/coolwsd/discovery.xml"
COOL_USER="cool"

# Determine product name based on variant
TEAMSYNC_PRODUCT="${TEAMSYNC_PRODUCT:-all}"
case "$TEAMSYNC_PRODUCT" in
    document)
        PRODUCT_NAME="TeamSync Document"
        ;;
    sheets)
        PRODUCT_NAME="TeamSync Sheets"
        ;;
    presentation)
        PRODUCT_NAME="TeamSync Presentation"
        ;;
    *)
        PRODUCT_NAME="TeamSync Editor"
        ;;
esac

echo "==========================================="
echo "$PRODUCT_NAME - Starting..."
echo "==========================================="

# =============================================================================
# Function: Update XML configuration value
# =============================================================================
update_config() {
    local xpath="$1"
    local value="$2"
    local attr="${3:-}"

    if [ -n "$attr" ]; then
        # Update attribute
        sed -i "s|<${xpath} ${attr}=\"[^\"]*\"|<${xpath} ${attr}=\"${value}\"|g" "$CONFIG_FILE"
    else
        # Update element text
        sed -i "s|<${xpath}>[^<]*</${xpath}>|<${xpath}>${value}</${xpath}>|g" "$CONFIG_FILE"
    fi
}

# =============================================================================
# Function: Add WOPI host alias
# =============================================================================
add_wopi_host() {
    local host_url="$1"

    # Extract hostname from URL
    local hostname=$(echo "$host_url" | sed -E 's|https?://||' | sed -E 's|:[0-9]+.*||' | sed -E 's|/.*||')

    echo "  Adding WOPI host: $hostname"

    # Check if host already exists
    if grep -q "desc=\"${hostname}\"" "$CONFIG_FILE" 2>/dev/null; then
        echo "    (already configured)"
        return
    fi

    # Add host entry before </storage>
    sed -i "/<\/storage>/i\\
        <host desc=\"${hostname}\" allow=\"true\">${hostname}</host>" "$CONFIG_FILE"
}

# =============================================================================
# Configure WOPI Host - Set alias_groups mode and add hosts
# =============================================================================
echo "[1/8] Configuring WOPI hosts..."

# Change alias_groups mode from 'first' to 'groups' to allow multiple hosts
sed -i 's|mode="first"|mode="groups"|g' "$CONFIG_FILE"

# Only add WOPI host group if not already configured (prevents duplicate groups on restart)
if ! grep -q 'desc="teamsync-hosts"' "$CONFIG_FILE" 2>/dev/null; then
    # Add a group with all common development and production hosts
    sed -i 's|</alias_groups>|<group desc="teamsync-hosts">\
                <host desc="localhost" allow="true">localhost</host>\
                <host desc="127.0.0.1" allow="true">127\\.0\\.0\\.1</host>\
                <host desc="host.docker.internal" allow="true">host\\.docker\\.internal</host>\
                <host desc="sample-app" allow="true">sample-app</host>\
                <host desc="teamsync-sample-app" allow="true">teamsync-sample-app</host>\
                <host desc="railway" allow="true">.*\\.up\\.railway\\.app</host>\
                <host desc="render" allow="true">.*\\.onrender\\.com</host>\
            </group>\
            </alias_groups>|g' "$CONFIG_FILE"
    echo "  Added WOPI host group: localhost, 127.0.0.1, host.docker.internal, *.railway.app, *.onrender.com"
else
    echo "  WOPI hosts already configured (skipping)"
fi

# Add custom WOPI host if specified
if [ -n "$WOPI_HOST_URL" ]; then
    add_wopi_host "$WOPI_HOST_URL"
fi

# =============================================================================
# Configure SSL
# =============================================================================
echo "[2/6] Configuring SSL..."

SSL_ENABLE="${SSL_ENABLE:-false}"
SSL_TERMINATION="${SSL_TERMINATION:-true}"

if [ "$SSL_ENABLE" = "true" ]; then
    echo "  SSL enabled"
    sed -i 's|<ssl desc="[^"]*" default="[^"]*">[^<]*</ssl>|<ssl desc="SSL settings" default="true">true</ssl>|g' "$CONFIG_FILE" || true
else
    echo "  SSL disabled (use reverse proxy for production)"
    # Disable SSL in config
    sed -i 's|<enable type="bool" desc="[^"]*" default="[^"]*">[^<]*</enable>|<enable type="bool" desc="Controls whether SSL is used" default="true">false</enable>|g' "$CONFIG_FILE" || true
fi

if [ "$SSL_TERMINATION" = "true" ]; then
    echo "  SSL termination: reverse proxy"
    sed -i 's|<termination desc="[^"]*" default="[^"]*">[^<]*</termination>|<termination desc="SSL termination" default="true">true</termination>|g' "$CONFIG_FILE" || true
fi

# =============================================================================
# Configure Admin Console
# =============================================================================
echo "[3/6] Configuring admin console..."

if [ -n "$COOL_ADMIN_USER" ] && [ -n "$COOL_ADMIN_PASSWORD" ]; then
    echo "  Admin console enabled for user: $COOL_ADMIN_USER"

    # Hash the password
    ADMIN_HASH=$(echo -n "$COOL_ADMIN_PASSWORD" | sha256sum | awk '{print $1}')

    # Update admin config
    sed -i "s|<username desc=\"[^\"]*\">[^<]*</username>|<username desc=\"Admin username\">$COOL_ADMIN_USER</username>|g" "$CONFIG_FILE" || true
    sed -i "s|<password desc=\"[^\"]*\">[^<]*</password>|<password desc=\"Admin password hash\">$ADMIN_HASH</password>|g" "$CONFIG_FILE" || true
else
    echo "  Admin console disabled (set COOL_ADMIN_USER and COOL_ADMIN_PASSWORD to enable)"
fi

# =============================================================================
# Configure Dictionaries
# =============================================================================
echo "[4/6] Configuring dictionaries..."

DICTIONARIES="${DICTIONARIES:-en_US}"
echo "  Dictionaries: $DICTIONARIES"

# Build dictionary list
DICT_LIST=""
for dict in $DICTIONARIES; do
    DICT_LIST="${DICT_LIST}<spelling>${dict}</spelling>"
done

# Note: Dictionary configuration may vary by Collabora version
# This is a placeholder for the specific configuration method

# =============================================================================
# Configure Logging
# =============================================================================
echo "[5/7] Configuring logging..."

LOG_LEVEL="${LOG_LEVEL:-warning}"
echo "  Log level: $LOG_LEVEL"

sed -i "s|<level desc=\"[^\"]*\" default=\"[^\"]*\">[^<]*</level>|<level desc=\"Log level\" default=\"warning\">$LOG_LEVEL</level>|g" "$CONFIG_FILE" || true

# =============================================================================
# Configure File Type Filtering (for product variants)
# =============================================================================
echo "[6/7] Configuring file type filtering..."

# NOTE: Discovery file filtering has been disabled because sed-based XML
# manipulation was corrupting the discovery.xml file structure, causing
# SAXParseException errors. The sample-app already routes documents to the
# correct container based on file type, so filtering in discovery.xml is
# not strictly necessary.
#
# For a production deployment, consider:
# 1. Using an XML-aware tool (xmlstarlet) for proper XML manipulation
# 2. Building separate discovery.xml files during Docker image build
# 3. Or simply rely on the application-level routing (current approach)

case "$TEAMSYNC_PRODUCT" in
    document)
        echo "  Product: TeamSync Document (handles all file types, routes to Writer)"
        ;;
    sheets)
        echo "  Product: TeamSync Sheets (handles all file types, routes to Calc)"
        ;;
    presentation)
        echo "  Product: TeamSync Presentation (handles all file types, routes to Impress)"
        ;;
    *)
        echo "  Product: TeamSync Editor (all file types enabled)"
        ;;
esac

# =============================================================================
# Patch Security Settings for Container Environment
# =============================================================================
# CRITICAL: These must be set in the XML config file BEFORE coolwsd starts
# because coolwsd reads the config and attempts namespace setup before
# processing command-line arguments.
echo "[7/8] Patching security settings for container environment..."

# Disable mount namespaces (requires SYS_ADMIN capability which containers don't have)
if grep -q "<mount_namespaces>" "$CONFIG_FILE" 2>/dev/null; then
    sed -i 's|<mount_namespaces>[^<]*</mount_namespaces>|<mount_namespaces>false</mount_namespaces>|g' "$CONFIG_FILE" 2>/dev/null || true
else
    # Add mount_namespaces setting before </config>
    sed -i 's|</config>|    <mount_namespaces>false</mount_namespaces>\n</config>|' "$CONFIG_FILE" 2>/dev/null || true
fi

# Disable mount_jail_tree (requires SYS_ADMIN for bind mounts)
if grep -q "<mount_jail_tree>" "$CONFIG_FILE" 2>/dev/null; then
    sed -i 's|<mount_jail_tree>[^<]*</mount_jail_tree>|<mount_jail_tree>false</mount_jail_tree>|g' "$CONFIG_FILE" 2>/dev/null || true
else
    sed -i 's|</config>|    <mount_jail_tree>false</mount_jail_tree>\n</config>|' "$CONFIG_FILE" 2>/dev/null || true
fi

# Disable seccomp filtering (may not be available in container)
if grep -q "<seccomp>" "$CONFIG_FILE" 2>/dev/null; then
    sed -i 's|<seccomp>[^<]*</seccomp>|<seccomp>false</seccomp>|g' "$CONFIG_FILE" 2>/dev/null || true
else
    # Add under security section or create it
    if grep -q "<security>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<security>|<security>\n        <seccomp>false</seccomp>|' "$CONFIG_FILE" 2>/dev/null || true
    fi
fi

echo "  Patched: mount_namespaces=false, mount_jail_tree=false, seccomp=false"

# =============================================================================
# Set Permissions
# =============================================================================
echo "[8/8] Setting permissions..."

# Ensure cool user owns necessary directories
chown -R ${COOL_USER}:${COOL_USER} /var/log/coolwsd 2>/dev/null || true
chown -R ${COOL_USER}:${COOL_USER} /var/cache/coolwsd 2>/dev/null || true
chown -R ${COOL_USER}:${COOL_USER} /tmp/coolwsd 2>/dev/null || true
chown -R ${COOL_USER}:${COOL_USER} /opt/cool/child-roots 2>/dev/null || true

echo ""
echo "==========================================="
echo "$PRODUCT_NAME - Configuration complete"
echo "==========================================="
echo ""
echo "Starting coolwsd..."
echo ""

# =============================================================================
# Build command line arguments
# =============================================================================
# Use PORT env var if set (Railway, Render, etc.), otherwise default to 9980
LISTEN_PORT="${PORT:-9980}"
echo "  Listening on port: $LISTEN_PORT"

# Railway/cloud deployment configuration:
# - security.capabilities=true: Forces use of coolforkit-caps (capability-based isolation)
#   which has graceful fallback when capabilities aren't available
# - security.seccomp=false: Disable seccomp filtering (not available on Railway)
# - mount_jail_tree=false: Disable mount namespaces (requires SYS_ADMIN)
# - mount_namespaces=false: Explicitly disable mount namespaces to use coolforkit-caps
#
# The coolforkit-caps binary will detect missing capabilities and fall back to
# a slower but functional copy-based jail setup instead of bind mounts.
COOLWSD_ARGS=(
    "--config-file=${CONFIG_FILE}"
    "--port=${LISTEN_PORT}"
    "--disable-cool-user-checking"
    "--lo-template-path=/opt/lokit"
    "--o:child_root_path=/opt/cool/child-roots"
    "--o:sys_template_path=/opt/cool/systemplate"
    "--o:file_server_root_path=/opt/cool/share/coolwsd"
    "--o:security.seccomp=false"
    "--o:security.capabilities=true"
    "--o:mount_jail_tree=false"
    "--o:mount_namespaces=false"
    "--o:net.proto=IPv4"
    "--o:net.listen=any"
)

# Add extra parameters if specified
if [ -n "$EXTRA_PARAMS" ]; then
    COOLWSD_ARGS+=($EXTRA_PARAMS)
fi

# =============================================================================
# Start coolwsd
# =============================================================================
exec /opt/cool/bin/coolwsd "${COOLWSD_ARGS[@]}"
