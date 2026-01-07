#!/bin/bash
# =============================================================================
# TeamSync Editor - 25.04 Container Entrypoint Script
# =============================================================================
#
# This script configures and starts coolwsd for 25.04 builds with source-built
# coolwsd binaries and Collabora LibreOffice component packages.
#
# Environment Variables:
#   WOPI_HOST_URL       - URL of your WOPI host (e.g., http://localhost:3000)
#   COOL_ADMIN_USER     - Admin console username (optional)
#   COOL_ADMIN_PASSWORD - Admin console password (optional)
#   EXTRA_PARAMS        - Additional coolwsd parameters
#   SSL_ENABLE          - Enable SSL (true/false, default: false for dev)
#   SSL_TERMINATION     - SSL termination (true = handled by reverse proxy)
#   LOG_LEVEL           - Log level (trace, debug, information, warning, error)
#   TEAMSYNC_PRODUCT    - Product variant (document, sheets, presentation)
#
# =============================================================================

set -e

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
echo "$PRODUCT_NAME (25.04) - Starting..."
echo "==========================================="

# =============================================================================
# Configuration
# =============================================================================
# Use /opt/cool/etc for config (writable by cool user) or fall back to /etc/coolwsd
if [ -w "/opt/cool/etc" ] || mkdir -p /opt/cool/etc 2>/dev/null; then
    CONFIG_DIR="/opt/cool/etc/coolwsd"
else
    CONFIG_DIR="/etc/coolwsd"
fi
CONFIG_FILE="${CONFIG_DIR}/coolwsd.xml"
LISTEN_PORT="${PORT:-9980}"

echo "[1/4] Checking configuration..."

# Create config file if it doesn't exist (source build may not have it)
if [ ! -f "$CONFIG_FILE" ]; then
    echo "  Creating default configuration..."
    mkdir -p "$CONFIG_DIR" 2>/dev/null || true

    # Check if template exists from coolwsd-deprecated package
    if [ -f "/usr/share/coolwsd/coolwsd.xml" ]; then
        cp /usr/share/coolwsd/coolwsd.xml "$CONFIG_FILE" 2>/dev/null || echo "  Note: Using command-line config only"
    elif [ -f "/opt/cool/etc/coolwsd/coolwsd.xml" ]; then
        cp /opt/cool/etc/coolwsd/coolwsd.xml "$CONFIG_FILE" 2>/dev/null || echo "  Note: Using command-line config only"
    elif [ -f "/etc/coolwsd/coolwsd.xml" ]; then
        # Config already exists in system location
        CONFIG_FILE="/etc/coolwsd/coolwsd.xml"
    else
        echo "  Note: No config template found, using command-line config only"
        CONFIG_FILE=""
    fi
fi

# =============================================================================
# CRITICAL: Patch coolwsd.xml config file for Railway/cloud compatibility
# =============================================================================
# These settings MUST be in the XML config file, not just command-line,
# because coolwsd reads the config and tries to initialize mount namespaces
# BEFORE command-line overrides take effect.

if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    echo "  Patching config for cloud platform compatibility..."

    # Create a writable copy if needed
    if [ ! -w "$CONFIG_FILE" ]; then
        cp "$CONFIG_FILE" /tmp/coolwsd.xml 2>/dev/null || true
        if [ -f "/tmp/coolwsd.xml" ]; then
            CONFIG_FILE="/tmp/coolwsd.xml"
        fi
    fi

    # Patch mount_jail_tree to false (disable bind-mount based jail)
    if grep -q "<mount_jail_tree>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<mount_jail_tree>[^<]*</mount_jail_tree>|<mount_jail_tree>false</mount_jail_tree>|g' "$CONFIG_FILE" 2>/dev/null || true
    fi

    # Patch mount_namespaces to false (disable mount namespaces)
    if grep -q "<mount_namespaces>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<mount_namespaces>[^<]*</mount_namespaces>|<mount_namespaces>false</mount_namespaces>|g' "$CONFIG_FILE" 2>/dev/null || true
    fi

    # Patch security.seccomp to false
    if grep -q "<seccomp>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<seccomp>[^<]*</seccomp>|<seccomp>false</seccomp>|g' "$CONFIG_FILE" 2>/dev/null || true
    fi

    # Patch security.capabilities to false (Railway doesn't support Linux capabilities)
    if grep -q "<capabilities>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<capabilities>[^<]*</capabilities>|<capabilities>false</capabilities>|g' "$CONFIG_FILE" 2>/dev/null || true
    fi

    echo "  Config patched successfully"
fi

# =============================================================================
# Configure SSL
# =============================================================================
echo "[2/4] Configuring SSL..."

SSL_ENABLE="${SSL_ENABLE:-false}"
SSL_TERMINATION="${SSL_TERMINATION:-true}"

if [ "$SSL_ENABLE" = "true" ]; then
    echo "  SSL enabled"
else
    echo "  SSL disabled (use reverse proxy for production)"
fi

if [ "$SSL_TERMINATION" = "true" ]; then
    echo "  SSL termination: reverse proxy"
fi

# =============================================================================
# Configure Admin Console
# =============================================================================
echo "[3/4] Configuring admin console..."

if [ -n "$COOL_ADMIN_USER" ] && [ -n "$COOL_ADMIN_PASSWORD" ]; then
    echo "  Admin console enabled for user: $COOL_ADMIN_USER"
else
    echo "  Admin console disabled (set COOL_ADMIN_USER and COOL_ADMIN_PASSWORD to enable)"
fi

# =============================================================================
# Build command line arguments
# =============================================================================
echo "[4/4] Starting coolwsd..."
echo "  Listening on port: $LISTEN_PORT"

# Railway/cloud deployment configuration:
# - security.capabilities=false: Disable capability-based isolation (Railway doesn't support caps)
# - security.seccomp=false: Disable seccomp filtering (not available on Railway)
# - mount_jail_tree=false: Disable mount namespaces (requires SYS_ADMIN)
# - mount_namespaces=false: Explicitly disable mount namespaces
#
# With capabilities disabled, coolwsd will use coolforkit without capability checks,
# falling back to a simpler jail setup that works on restricted platforms.

COOLWSD_ARGS=(
    "--port=${LISTEN_PORT}"
    "--version"
    "--use-env-vars"
    "--disable-cool-user-checking"
    "--o:sys_template_path=/opt/cool/systemplate"
    "--o:child_root_path=/opt/cool/child-roots"
    "--o:file_server_root_path=/opt/cool/share/coolwsd"
    "--o:lo_template_path=/opt/collaboraoffice"
    "--o:security.seccomp=false"
    "--o:security.capabilities=false"
    "--o:mount_jail_tree=false"
    "--o:mount_namespaces=false"
    "--o:net.proto=IPv4"
    "--o:net.listen=any"
    # Performance tuning (matching official Collabora defaults)
    "--o:num_prespawn_children=4"
    "--o:per_document.max_concurrency=4"
    "--o:per_document.limit_load_secs=100"
    "--o:per_document.idle_timeout_secs=3600"
    "--o:per_document.limit_store_failures=5"
    "--o:per_document.cleanup.cleanup_interval_ms=10000"
    "--o:per_document.cleanup.bad_behavior_period_secs=60"
    "--o:per_document.cleanup.idle_time_secs=300"
)

# Add config file if it exists and is set
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    COOLWSD_ARGS+=("--config-file=${CONFIG_FILE}")
fi

# SSL configuration
if [ "$SSL_ENABLE" = "false" ]; then
    COOLWSD_ARGS+=("--o:ssl.enable=false")
fi

if [ "$SSL_TERMINATION" = "true" ]; then
    COOLWSD_ARGS+=("--o:ssl.termination=true")
fi

# Admin credentials
if [ -n "$COOL_ADMIN_USER" ]; then
    COOLWSD_ARGS+=("--o:admin_console.username=${COOL_ADMIN_USER}")
fi

if [ -n "$COOL_ADMIN_PASSWORD" ]; then
    COOLWSD_ARGS+=("--o:admin_console.password=${COOL_ADMIN_PASSWORD}")
fi

# Log level - default to debug for performance diagnostics
LOG_LEVEL="${LOG_LEVEL:-debug}"
COOLWSD_ARGS+=("--o:logging.level=${LOG_LEVEL}")

# Enable file logging for debug analysis
COOLWSD_ARGS+=("--o:logging.file.enable=true")
COOLWSD_ARGS+=("--o:logging.file.path=/var/log/coolwsd/coolwsd.log")

# Memory proportion tuning (percentage of system memory to use)
if [ -n "$MEMPROPORTION" ]; then
    COOLWSD_ARGS+=("--o:memproportion=${MEMPROPORTION}")
fi

# WOPI host configuration
if [ -n "$WOPI_HOST_URL" ]; then
    # Extract hostname from URL
    WOPI_HOSTNAME=$(echo "$WOPI_HOST_URL" | sed -E 's|https?://||' | sed -E 's|:[0-9]+.*||' | sed -E 's|/.*||')
    COOLWSD_ARGS+=("--o:storage.wopi.host=${WOPI_HOSTNAME}")
fi

# Add extra parameters if specified
if [ -n "$EXTRA_PARAMS" ]; then
    COOLWSD_ARGS+=($EXTRA_PARAMS)
fi

echo ""
echo "==========================================="
echo "$PRODUCT_NAME - Configuration complete"
echo "==========================================="
echo ""

# =============================================================================
# Start coolwsd
# =============================================================================
# Try source-built binary first, fall back to package binary
if [ -x "/opt/cool/bin/coolwsd" ]; then
    exec /opt/cool/bin/coolwsd "${COOLWSD_ARGS[@]}"
elif [ -x "/usr/bin/coolwsd" ]; then
    exec /usr/bin/coolwsd "${COOLWSD_ARGS[@]}"
else
    echo "ERROR: coolwsd binary not found!"
    exit 1
fi
