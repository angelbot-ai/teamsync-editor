#!/bin/bash
# =============================================================================
# TeamSync Editor - Build Script
# =============================================================================
#
# This script builds the TeamSync Docker images from source.
#
# Usage:
#   ./docker/scripts/build.sh                    # Build all variants
#   ./docker/scripts/build.sh document           # Build TeamSync Document only
#   ./docker/scripts/build.sh sheets             # Build TeamSync Sheets only
#   ./docker/scripts/build.sh presentation       # Build TeamSync Presentation only
#   ./docker/scripts/build.sh all                # Build the combined editor
#   ./docker/scripts/build.sh --no-cache         # Build without cache
#   ./docker/scripts/build.sh --push             # Build and push to registry
#   ./docker/scripts/build.sh minimal document   # Build minimal document image
#   ./docker/scripts/build.sh minimal all        # Build all minimal images
#
# Environment Variables:
#   LO_CORE_VERSION  - LibreOffice core version (default: 24.04)
#   COOL_VERSION     - Collabora Online version (default: co-24.04)
#   IMAGE_TAG        - Docker image tag (default: latest)
#   REGISTRY         - Docker registry (default: none)
#
# =============================================================================

set -e

# Change to project root
cd "$(dirname "$0")/../.."

# =============================================================================
# Configuration
# =============================================================================

LO_CORE_VERSION="${LO_CORE_VERSION:-24.04}"
COOL_VERSION="${COOL_VERSION:-distro/collabora/co-24.04}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-}"

# Parse arguments
NO_CACHE=""
PUSH=""
MINIMAL=""
VARIANTS=()

for arg in "$@"; do
    case $arg in
        --no-cache)
            NO_CACHE="--no-cache"
            ;;
        --push)
            PUSH="true"
            ;;
        minimal)
            MINIMAL="true"
            ;;
        --help|-h)
            echo "Usage: $0 [minimal] [variant...] [--no-cache] [--push]"
            echo ""
            echo "Variants:"
            echo "  document         Build TeamSync Document (Word processor)"
            echo "  sheets           Build TeamSync Sheets (Spreadsheet)"
            echo "  presentation     Build TeamSync Presentation"
            echo "  all              Build combined TeamSync Editor"
            echo "  writer-optimized Build Writer-only from source (4-6 hours)"
            echo "  (no variant)     Build all standard variants"
            echo ""
            echo "Options:"
            echo "  minimal       Build minimal extraction images (requires source images)"
            echo "  --no-cache    Build without Docker cache"
            echo "  --push        Push images to registry after build"
            echo ""
            echo "Environment Variables:"
            echo "  LO_CORE_VERSION  LibreOffice core version (default: 24.04)"
            echo "  COOL_VERSION     Collabora Online version (default: co-24.04)"
            echo "  IMAGE_TAG        Docker image tag (default: latest)"
            echo "  REGISTRY         Docker registry URL"
            echo ""
            echo "Examples:"
            echo "  $0                          # Build all variants"
            echo "  $0 document sheets          # Build Document and Sheets"
            echo "  $0 document --no-cache      # Build Document without cache"
            echo "  $0 minimal document         # Build minimal document from existing image"
            echo "  $0 minimal                  # Build all minimal images"
            echo "  REGISTRY=ghcr.io/org $0 --push  # Build and push"
            exit 0
            ;;
        document|sheets|presentation|all|writer-optimized)
            VARIANTS+=("$arg")
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Use --help for usage"
            exit 1
            ;;
    esac
done

# Default to all variants if none specified
if [ ${#VARIANTS[@]} -eq 0 ]; then
    VARIANTS=("document" "sheets" "presentation" "all")
fi

# =============================================================================
# Pre-flight checks
# =============================================================================

echo "==========================================="
echo "TeamSync Editor - Build Script"
echo "==========================================="
echo ""
echo "Configuration:"
echo "  LibreOffice Core: ${LO_CORE_VERSION}"
echo "  Collabora Online: ${COOL_VERSION}"
echo "  Variants to build: ${VARIANTS[*]}"
echo "  Image tag: ${IMAGE_TAG}"
if [ -n "$REGISTRY" ]; then
    echo "  Registry: ${REGISTRY}"
fi
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker daemon is not running"
    exit 1
fi

# Enable BuildKit for better caching
export DOCKER_BUILDKIT=1

# =============================================================================
# Build function
# =============================================================================

build_variant() {
    local variant="$1"
    local dockerfile=""
    local image_name=""
    local brand_name=""
    local brand_short="TeamSync"

    case "$variant" in
        document)
            dockerfile="docker/Dockerfile.document"
            image_name="teamsync-document"
            brand_name="TeamSync Document"
            ;;
        sheets)
            dockerfile="docker/Dockerfile.sheets"
            image_name="teamsync-sheets"
            brand_name="TeamSync Sheets"
            ;;
        presentation)
            dockerfile="docker/Dockerfile.presentation"
            image_name="teamsync-presentation"
            brand_name="TeamSync Presentation"
            ;;
        all)
            dockerfile="docker/Dockerfile"
            image_name="teamsync-editor"
            brand_name="TeamSync Editor"
            ;;
        writer-optimized)
            dockerfile="docker/Dockerfile.writer-optimized"
            image_name="teamsync-document"
            brand_name="TeamSync Document (Optimized)"
            # Override tag for optimized builds
            if [ "${IMAGE_TAG}" = "latest" ]; then
                IMAGE_TAG="optimized"
            fi
            ;;
        *)
            echo "ERROR: Unknown variant: $variant"
            return 1
            ;;
    esac

    echo "==========================================="
    echo "Building: ${brand_name}"
    echo "==========================================="
    echo ""

    BUILD_START=$(date +%s)

    # Construct full image name
    if [ -n "$REGISTRY" ]; then
        FULL_IMAGE="${REGISTRY}/${image_name}:${IMAGE_TAG}"
    else
        FULL_IMAGE="${image_name}:${IMAGE_TAG}"
    fi

    # Build the image
    docker build \
        $NO_CACHE \
        --platform linux/amd64 \
        --build-arg LO_CORE_VERSION="${LO_CORE_VERSION}" \
        --build-arg COOL_VERSION="${COOL_VERSION}" \
        --build-arg BRAND_NAME="${brand_name}" \
        --build-arg BRAND_SHORT="${brand_short}" \
        --tag "${FULL_IMAGE}" \
        --file "${dockerfile}" \
        .

    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))

    # Show image size
    IMAGE_SIZE=$(docker image inspect "${FULL_IMAGE}" --format='{{.Size}}' | awk '{printf "%.2f MB", $1/1024/1024}')

    echo ""
    echo "  Image: ${FULL_IMAGE}"
    echo "  Size: ${IMAGE_SIZE}"
    echo "  Build time: ${BUILD_TIME} seconds"
    echo ""

    # Push if requested
    if [ "$PUSH" = "true" ]; then
        if [ -z "$REGISTRY" ]; then
            echo "  WARNING: --push specified but REGISTRY is not set"
        else
            echo "  Pushing to registry..."
            docker push "${FULL_IMAGE}"
            echo "  Push complete!"
        fi
    fi
}

# =============================================================================
# Build minimal extraction image
# =============================================================================

build_minimal() {
    local variant="$1"
    local source_image=""
    local minimal_image=""
    local dockerfile=""

    case "$variant" in
        document)
            source_image="teamsync-document:${IMAGE_TAG}"
            minimal_image="teamsync-document:minimal"
            dockerfile="docker/Dockerfile.minimal.document"
            ;;
        sheets)
            source_image="teamsync-sheets:${IMAGE_TAG}"
            minimal_image="teamsync-sheets:minimal"
            dockerfile="docker/Dockerfile.minimal.sheets"
            ;;
        presentation)
            source_image="teamsync-presentation:${IMAGE_TAG}"
            minimal_image="teamsync-presentation:minimal"
            dockerfile="docker/Dockerfile.minimal.presentation"
            ;;
        all)
            echo "Building all minimal images..."
            build_minimal "document"
            build_minimal "sheets"
            build_minimal "presentation"
            return 0
            ;;
        *)
            echo "ERROR: Minimal build not supported for: $variant"
            return 1
            ;;
    esac

    echo "==========================================="
    echo "Building minimal image: ${minimal_image}"
    echo "From source: ${source_image}"
    echo "==========================================="
    echo ""

    # Check source image exists
    if ! docker image inspect "$source_image" &>/dev/null; then
        echo "ERROR: Source image $source_image not found."
        echo "Build it first with: $0 $variant"
        return 1
    fi

    BUILD_START=$(date +%s)

    # Build minimal image
    docker build \
        $NO_CACHE \
        --platform linux/amd64 \
        --build-arg SOURCE_IMAGE="${source_image}" \
        --tag "${minimal_image}" \
        --file "${dockerfile}" \
        .

    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))

    # Show size comparison
    ORIGINAL_SIZE=$(docker image inspect "${source_image}" --format='{{.Size}}')
    MINIMAL_SIZE=$(docker image inspect "${minimal_image}" --format='{{.Size}}')

    echo ""
    echo "Size comparison:"
    echo "  Original: $(echo $ORIGINAL_SIZE | awk '{printf "%.2f MB", $1/1024/1024}')"
    echo "  Minimal:  $(echo $MINIMAL_SIZE | awk '{printf "%.2f MB", $1/1024/1024}')"
    echo "  Reduction: $(echo "$ORIGINAL_SIZE $MINIMAL_SIZE" | awk '{printf "%.1f%%", (1-$2/$1)*100}')"
    echo "  Build time: ${BUILD_TIME} seconds"
    echo ""

    # Push if requested
    if [ "$PUSH" = "true" ]; then
        if [ -n "$REGISTRY" ]; then
            FULL_MINIMAL="${REGISTRY}/${minimal_image}"
            docker tag "${minimal_image}" "${FULL_MINIMAL}"
            echo "  Pushing ${FULL_MINIMAL}..."
            docker push "${FULL_MINIMAL}"
            echo "  Push complete!"
        fi
    fi
}

# =============================================================================
# Build all requested variants
# =============================================================================

TOTAL_START=$(date +%s)

# Handle minimal builds
if [ "$MINIMAL" = "true" ]; then
    # Default to all variants for minimal if none specified
    if [ ${#VARIANTS[@]} -eq 0 ]; then
        VARIANTS=("document" "sheets" "presentation")
    fi

    for variant in "${VARIANTS[@]}"; do
        if [ "$variant" = "all" ]; then
            build_minimal "document"
            build_minimal "sheets"
            build_minimal "presentation"
        else
            build_minimal "$variant"
        fi
    done
else
    # Regular builds
    for variant in "${VARIANTS[@]}"; do
        build_variant "$variant"
    done
fi

TOTAL_END=$(date +%s)
TOTAL_TIME=$((TOTAL_END - TOTAL_START))

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "==========================================="
echo "Build Summary"
echo "==========================================="
echo ""
echo "Built variants: ${VARIANTS[*]}"
echo "Total build time: ${TOTAL_TIME} seconds"
echo ""
echo "Images created:"

for variant in "${VARIANTS[@]}"; do
    case "$variant" in
        document)
            image_name="teamsync-document"
            ;;
        sheets)
            image_name="teamsync-sheets"
            ;;
        presentation)
            image_name="teamsync-presentation"
            ;;
        all)
            image_name="teamsync-editor"
            ;;
        writer-optimized)
            image_name="teamsync-document"
            ;;
    esac

    if [ -n "$REGISTRY" ]; then
        echo "  - ${REGISTRY}/${image_name}:${IMAGE_TAG}"
    else
        echo "  - ${image_name}:${IMAGE_TAG}"
    fi
done

echo ""
echo "Next steps:"
echo "  1. Run a specific variant:"
echo "     docker run -p 9980:9980 teamsync-document:latest"
echo ""
echo "  2. Or use docker-compose:"
echo "     docker compose up -d"
echo ""
echo "  3. Verify branding:"
echo "     curl http://localhost:9980/hosting/discovery | grep -i teamsync"
echo ""
