#!/bin/sh
# =============================================================================
# TeamSync Editor - Container Entrypoint Script (Package-based)
# =============================================================================
#
# Based on the official Collabora Online start-collabora-online.sh script.
# This script is designed for package-based installations that include
# coolforkit-caps which gracefully handles missing Linux capabilities.
#
# Environment Variables:
#   PORT                - Listen port (default: 9980, Railway sets this)
#   aliasgroup1         - WOPI host alias (e.g., https://your-app.railway.app)
#   username            - Admin console username
#   password            - Admin console password
#   dictionaries        - Space-separated list of dictionaries
#   extra_params        - Additional coolwsd parameters
#   DONT_GEN_SSL_CERT   - Set to skip SSL cert generation (default: set)
#
# =============================================================================

# Generate SSL certificates if not disabled
if test "${DONT_GEN_SSL_CERT-set}" = set; then
    # Generate new SSL certificate instead of using the default
    mkdir -p /tmp/ssl/
    cd /tmp/ssl/
    mkdir -p certs/ca
    openssl genrsa -out certs/ca/root.key.pem 2048 2>/dev/null
    openssl req -x509 -new -nodes -key certs/ca/root.key.pem -days 9131 -out certs/ca/root.crt.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=Dummy Authority" 2>/dev/null
    mkdir -p certs/servers
    mkdir -p certs/tmp
    mkdir -p certs/servers/localhost
    openssl genrsa -out certs/servers/localhost/privkey.pem 2048 2>/dev/null
    if test "${cert_domain-set}" = set; then
        openssl req -key certs/servers/localhost/privkey.pem -new -sha256 -out certs/tmp/localhost.csr.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=localhost" 2>/dev/null
    else
        openssl req -key certs/servers/localhost/privkey.pem -new -sha256 -out certs/tmp/localhost.csr.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=${cert_domain}" 2>/dev/null
    fi
    openssl x509 -req -in certs/tmp/localhost.csr.pem -CA certs/ca/root.crt.pem -CAkey certs/ca/root.key.pem -CAcreateserial -out certs/servers/localhost/cert.pem -days 9131 2>/dev/null
    cert_params=" --o:ssl.cert_file_path=/tmp/ssl/certs/servers/localhost/cert.pem --o:ssl.key_file_path=/tmp/ssl/certs/servers/localhost/privkey.pem --o:ssl.ca_file_path=/tmp/ssl/certs/ca/root.crt.pem"
fi

# OpenShift compatibility: Map random UID to cool user
# Build a tiny passwd file mapping this random assigned UID to "cool" if userId is not "1001"
user_id=$(id -u)
group_id=$(id -g)
if [ "$user_id" -ne 1001 ]; then
    echo "cool:x:${user_id}:${group_id}::/opt/cool:/usr/sbin/nologin" >/tmp/passwd

    # Tell libc to use our files, via LD_PRELOAD
    export NSS_WRAPPER_PASSWD=/tmp/passwd
    export NSS_WRAPPER_GROUP=/etc/group
    export LD_PRELOAD=libnss_wrapper.so
fi

# =============================================================================
# Patch coolwsd.xml config file for Railway/cloud compatibility
# =============================================================================
# CRITICAL: These settings MUST be in the XML config file, not just command-line,
# because coolwsd reads the config and tries to initialize mount namespaces
# BEFORE command-line overrides take effect.

CONFIG_FILE="/etc/coolwsd/coolwsd.xml"
if [ -f "$CONFIG_FILE" ]; then
    echo "  Patching config for cloud platform compatibility..."

    # Create a writable copy if needed
    if [ ! -w "$CONFIG_FILE" ]; then
        cp "$CONFIG_FILE" /tmp/coolwsd.xml
        CONFIG_FILE="/tmp/coolwsd.xml"
    fi

    # Patch mount_jail_tree to false (disable bind-mount based jail)
    if grep -q "<mount_jail_tree>" "$CONFIG_FILE"; then
        sed -i 's|<mount_jail_tree>[^<]*</mount_jail_tree>|<mount_jail_tree>false</mount_jail_tree>|g' "$CONFIG_FILE"
    else
        # Add mount_jail_tree setting if not present (add before </config>)
        sed -i 's|</config>|    <mount_jail_tree>false</mount_jail_tree>\n</config>|' "$CONFIG_FILE"
    fi

    # Patch mount_namespaces to false (disable mount namespaces)
    if grep -q "<mount_namespaces>" "$CONFIG_FILE"; then
        sed -i 's|<mount_namespaces>[^<]*</mount_namespaces>|<mount_namespaces>false</mount_namespaces>|g' "$CONFIG_FILE"
    else
        sed -i 's|</config>|    <mount_namespaces>false</mount_namespaces>\n</config>|' "$CONFIG_FILE"
    fi

    # Patch security.seccomp to false
    if grep -q "<seccomp>" "$CONFIG_FILE"; then
        sed -i 's|<seccomp>[^<]*</seccomp>|<seccomp>false</seccomp>|g' "$CONFIG_FILE"
    fi

    # If we created a temp copy, we need to use it via --config-file
    if [ "$CONFIG_FILE" = "/tmp/coolwsd.xml" ]; then
        config_param="--config-file=/tmp/coolwsd.xml"
    fi
fi

# =============================================================================
# TeamSync-specific configuration
# =============================================================================

# Determine product name from environment (default: Editor)
PRODUCT_DISPLAY_NAME="TeamSync ${TEAMSYNC_PRODUCT:-Editor}"
# Capitalize first letter of product name
PRODUCT_DISPLAY_NAME=$(echo "$PRODUCT_DISPLAY_NAME" | sed 's/\b\(.\)/\u\1/g')

echo "==========================================="
echo "${PRODUCT_DISPLAY_NAME} - Starting..."
echo "==========================================="

# Use PORT env var if set (Railway, Render, etc.), otherwise default to 9980
LISTEN_PORT="${PORT:-9980}"
echo "  Listening on port: $LISTEN_PORT"

# Build extra params for Railway/cloud deployment
teamsync_params=""

# =============================================================================
# Railway/Cloud Platform Compatibility Settings
# =============================================================================
# These settings are CRITICAL for running on platforms like Railway, Render,
# Cloud Run, etc. that don't provide full Linux capabilities.
#
# - mount_jail_tree=false: Disable bind-mount based jail (requires SYS_ADMIN)
# - mount_namespaces=false: Disable mount namespaces (requires SYS_ADMIN)
# - security.seccomp=false: Disable seccomp filtering (not available)
# - security.capabilities=true: Use coolforkit-caps with graceful fallback
#
# The coolforkit-caps binary will detect missing capabilities and use a
# copy-based jail setup instead of bind mounts - slower but functional.
# =============================================================================
teamsync_params="${teamsync_params} --o:mount_jail_tree=false"
teamsync_params="${teamsync_params} --o:mount_namespaces=false"
teamsync_params="${teamsync_params} --o:security.seccomp=false"
teamsync_params="${teamsync_params} --o:security.capabilities=true"

# Disable SSL for reverse proxy deployments (Railway handles SSL termination)
teamsync_params="${teamsync_params} --o:ssl.enable=false --o:ssl.termination=true"

# Set the port
teamsync_params="${teamsync_params} --port=${LISTEN_PORT}"

# Add WOPI host aliases for common development and deployment hosts
teamsync_params="${teamsync_params} --o:storage.wopi.alias_groups[@mode]=groups"

# If aliasgroup1 is not set, add sensible defaults for development
if [ -z "${aliasgroup1}" ]; then
    teamsync_params="${teamsync_params} --o:storage.wopi.alias_groups.group[0].host[0]=localhost"
    teamsync_params="${teamsync_params} --o:storage.wopi.alias_groups.group[0].host[1]=127\\.0\\.0\\.1"
    teamsync_params="${teamsync_params} --o:storage.wopi.alias_groups.group[0].host[2]=host\\.docker\\.internal"
    teamsync_params="${teamsync_params} --o:storage.wopi.alias_groups.group[0].host[3]=.*\\.up\\.railway\\.app"
    teamsync_params="${teamsync_params} --o:storage.wopi.alias_groups.group[0].host[4]=.*\\.onrender\\.com"
    teamsync_params="${teamsync_params} --o:storage.wopi.alias_groups.group[0].host[5]=.*\\.railway\\.internal"
fi

# Set logging level (default to warning for production)
teamsync_params="${teamsync_params} --o:logging.level=${LOG_LEVEL:-warning}"

# Combine with user-provided extra_params
extra_params="${teamsync_params} ${extra_params}"

echo "  Configuration complete"
echo "==========================================="
echo ""

# =============================================================================
# Ensure proper ownership for cool user
# =============================================================================
if [ "$(id -u)" = "0" ]; then
    # Running as root - fix permissions and switch to cool user
    chown -R cool:cool /opt/cool 2>/dev/null || true
    chown -R cool:cool /var/log/coolwsd 2>/dev/null || true
    chown -R cool:cool /tmp/ssl 2>/dev/null || true

    # Export environment variables for the cool user
    export cert_params
    export extra_params
    export config_param

    # Re-exec as cool user using gosu or su
    # gosu is preferred for containers as it doesn't create a new session
    if command -v gosu >/dev/null 2>&1; then
        exec gosu cool /usr/bin/coolwsd \
            --version \
            --use-env-vars \
            --disable-cool-user-checking \
            ${config_param} \
            ${cert_params} \
            --o:sys_template_path=/opt/cool/systemplate \
            --o:child_root_path=/opt/cool/child-roots \
            --o:file_server_root_path=/usr/share/coolwsd \
            --o:cache_files.path=/opt/cool/cache \
            --o:logging.color=false \
            --o:stop_on_config_change=true \
            ${extra_params} \
            "$@"
    else
        # Use runuser which handles environment better than su in containers
        exec runuser -u cool -- /usr/bin/coolwsd \
            --version \
            --use-env-vars \
            --disable-cool-user-checking \
            ${config_param} \
            ${cert_params} \
            --o:sys_template_path=/opt/cool/systemplate \
            --o:child_root_path=/opt/cool/child-roots \
            --o:file_server_root_path=/usr/share/coolwsd \
            --o:cache_files.path=/opt/cool/cache \
            --o:logging.color=false \
            --o:stop_on_config_change=true \
            ${extra_params} \
            "$@"
    fi
fi

# =============================================================================
# Start coolwsd (official startup command)
# =============================================================================
exec /usr/bin/coolwsd \
    --version \
    --use-env-vars \
    --disable-cool-user-checking \
    ${config_param} \
    ${cert_params} \
    --o:sys_template_path=/opt/cool/systemplate \
    --o:child_root_path=/opt/cool/child-roots \
    --o:file_server_root_path=/usr/share/coolwsd \
    --o:cache_files.path=/opt/cool/cache \
    --o:logging.color=false \
    --o:stop_on_config_change=true \
    ${extra_params} \
    "$@"