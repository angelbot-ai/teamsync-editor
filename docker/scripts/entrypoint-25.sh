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

# Version information
TEAMSYNC_VERSION="${TEAMSYNC_VERSION:-1.0.0}"
BUILD_VERSION="25.04"

# Determine product name based on variant
TEAMSYNC_PRODUCT="${TEAMSYNC_PRODUCT:-all}"
case "$TEAMSYNC_PRODUCT" in
    document)
        PRODUCT_NAME="TeamSync Document Editor"
        ;;
    sheets)
        PRODUCT_NAME="TeamSync Sheets Editor"
        ;;
    presentation)
        PRODUCT_NAME="TeamSync Presentation Editor"
        ;;
    *)
        PRODUCT_NAME="TeamSync Editor"
        ;;
esac

echo "==========================================="
echo "$PRODUCT_NAME v${TEAMSYNC_VERSION} (${BUILD_VERSION})"
echo "==========================================="

# =============================================================================
# Configuration
# =============================================================================
# Find the config file from package installation
if [ -f "/etc/coolwsd/coolwsd.xml" ]; then
    SOURCE_CONFIG="/etc/coolwsd/coolwsd.xml"
elif [ -f "/usr/share/coolwsd/coolwsd.xml" ]; then
    SOURCE_CONFIG="/usr/share/coolwsd/coolwsd.xml"
elif [ -f "/opt/cool/etc/coolwsd/coolwsd.xml" ]; then
    SOURCE_CONFIG="/opt/cool/etc/coolwsd/coolwsd.xml"
else
    SOURCE_CONFIG=""
fi

# Always copy config to /tmp for modification (cool user can write there)
if [ -n "$SOURCE_CONFIG" ]; then
    cp "$SOURCE_CONFIG" /tmp/coolwsd.xml 2>/dev/null || true
    CONFIG_FILE="/tmp/coolwsd.xml"
else
    CONFIG_FILE=""
fi

LISTEN_PORT="${PORT:-9980}"

echo "[1/4] Checking configuration..."

# Create minimal config if no template found
if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
    echo "  Note: No config template found, using command-line config only"
    CONFIG_FILE=""
fi

# =============================================================================
# CRITICAL: Patch coolwsd.xml config file for Railway/cloud compatibility
# =============================================================================
# These settings MUST be in the XML config file, not just command-line,
# because coolwsd reads the config and tries to initialize mount namespaces
# BEFORE command-line overrides take effect.

if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    echo "  Patching config for cloud platform compatibility..."

    # Patch or add mount_jail_tree to false (disable bind-mount based jail)
    if grep -q "<mount_jail_tree>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<mount_jail_tree>[^<]*</mount_jail_tree>|<mount_jail_tree>false</mount_jail_tree>|g' "$CONFIG_FILE" 2>/dev/null || true
    else
        sed -i 's|</config>|    <mount_jail_tree>false</mount_jail_tree>\n</config>|' "$CONFIG_FILE" 2>/dev/null || true
    fi

    # Patch or add mount_namespaces to false (disable mount namespaces)
    if grep -q "<mount_namespaces>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<mount_namespaces>[^<]*</mount_namespaces>|<mount_namespaces>false</mount_namespaces>|g' "$CONFIG_FILE" 2>/dev/null || true
    else
        sed -i 's|</config>|    <mount_namespaces>false</mount_namespaces>\n</config>|' "$CONFIG_FILE" 2>/dev/null || true
    fi

    # Patch or add security.seccomp to false
    if grep -q "<seccomp>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<seccomp>[^<]*</seccomp>|<seccomp>false</seccomp>|g' "$CONFIG_FILE" 2>/dev/null || true
    else
        sed -i 's|</config>|    <seccomp>false</seccomp>\n</config>|' "$CONFIG_FILE" 2>/dev/null || true
    fi

    # Patch or add security.capabilities to false (Railway doesn't support Linux capabilities)
    if grep -q "<capabilities>" "$CONFIG_FILE" 2>/dev/null; then
        sed -i 's|<capabilities>[^<]*</capabilities>|<capabilities>false</capabilities>|g' "$CONFIG_FILE" 2>/dev/null || true
    else
        sed -i 's|</config>|    <capabilities>false</capabilities>\n</config>|' "$CONFIG_FILE" 2>/dev/null || true
    fi

    echo "  Config patched: mount_jail_tree=false, mount_namespaces=false, seccomp=false, capabilities=false"
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
    # Cache configuration for performance
    "--o:cache_files.path=/var/cache/coolwsd"
    "--o:cache_files.expiry_min=1000"
    # Performance tuning (matching official Collabora defaults)
    "--o:num_prespawn_children=4"
    "--o:per_document.limit_load_secs=100"
    "--o:per_document.idle_timeout_secs=3600"
    "--o:per_document.limit_store_failures=5"
    "--o:per_document.cleanup.cleanup_interval_ms=10000"
    "--o:per_document.cleanup.bad_behavior_period_secs=60"
    "--o:per_document.cleanup.idle_time_secs=300"
    # ===== TYPING RESPONSIVENESS OPTIMIZATIONS =====
    # Increase parallel processing for faster tile updates
    "--o:per_document.max_concurrency=8"
    # Reduce save interruptions during typing
    "--o:per_document.min_time_between_saves_ms=1000"
    "--o:per_document.min_time_between_uploads_ms=10000"
    "--o:per_document.idlesave_duration_secs=60"
    "--o:per_document.autosave_duration_secs=300"
    # Use background save to avoid blocking UI
    "--o:per_document.background_autosave=true"
    "--o:per_document.background_manualsave=true"
    # Keep views active longer to avoid re-rendering overhead
    "--o:per_view.out_of_focus_timeout_secs=600"
    "--o:per_view.idle_timeout_secs=1800"
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

# Log level - default to warning for production (reduces Railway log rate limit issues)
LOG_LEVEL="${LOG_LEVEL:-warning}"
COOLWSD_ARGS+=("--o:logging.level=${LOG_LEVEL}")

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
# Determine which installation type: source-built vs package
if [ -x "/opt/cool/bin/coolwsd" ]; then
    COOLWSD_BIN="/opt/cool/bin/coolwsd"
    # file_server_root_path already set to /opt/cool/share/coolwsd
elif [ -x "/usr/bin/coolwsd" ]; then
    COOLWSD_BIN="/usr/bin/coolwsd"
    # Package install uses /usr/share/coolwsd for browser files
    # Override file_server_root_path for package installations
    COOLWSD_ARGS+=("--o:file_server_root_path=/usr/share/coolwsd")
else
    echo "ERROR: coolwsd binary not found!"
    exit 1
fi

echo "  Binary: $COOLWSD_BIN"
exec "$COOLWSD_BIN" "${COOLWSD_ARGS[@]}"
