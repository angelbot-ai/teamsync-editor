# Docker Hub Setup for GitHub Actions

This guide explains how to set up Docker Hub credentials for automated image builds.

## Prerequisites

1. A Docker Hub account
2. A GitHub repository with admin access

## Step 1: Create Docker Hub Access Token

1. Log in to [Docker Hub](https://hub.docker.com)
2. Go to **Account Settings** → **Security** → **Access Tokens**
3. Click **New Access Token**
4. Give it a description (e.g., "GitHub Actions - TeamSync")
5. Set permissions to **Read & Write**
6. Click **Generate** and **copy the token** (you won't see it again!)

## Step 2: Add Secrets to GitHub Repository

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following **Repository secrets**:

| Secret Name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | The access token from Step 1 |

4. (Optional) Add a **Repository variable**:

| Variable Name | Value |
|---------------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username or organization |

## Step 3: Create Docker Hub Repositories

Create these repositories on Docker Hub (they'll be created automatically on first push, but pre-creating ensures correct visibility):

1. `yourusername/teamsync-document`
2. `yourusername/teamsync-sheets`
3. `yourusername/teamsync-presentation`

## Workflow Triggers

### Automatic Builds
- **On push to `main`**: Builds all three images when `docker/**` files change
- **Weekly (Sunday 2 AM UTC)**: Rebuilds all images for security updates

### Manual Builds
1. Go to **Actions** → **Build and Push Docker Images**
2. Click **Run workflow**
3. Select which image to build (or "all")

## Image Tags

Each build produces multiple tags:

| Tag | Description |
|-----|-------------|
| `latest` | Most recent build from `main` branch |
| `<sha>` | Git commit SHA for traceability |
| `<branch>` | Branch name (for non-main branches) |
| `<date>` | Date stamp for scheduled builds (YYYYMMDD) |
| `minimal` | Optimized/minimal variant |

## Build Times

> ⚠️ **Note**: Building LibreOffice from source takes **2-4 hours** per image.

The workflow has a 6-hour timeout. If builds consistently timeout:
1. Consider using a self-hosted runner with more resources
2. Use Docker layer caching (already configured)
3. Build images sequentially instead of in parallel

## Troubleshooting

### Build fails with "disk space" error
The workflow already cleans up unnecessary tools. If still failing:
- Use a self-hosted runner with more disk space
- Build one image at a time via workflow_dispatch

### Authentication errors
- Verify `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets are set correctly
- Ensure the access token has Read & Write permissions
- Check if the token has expired

### Image not pushing
- Confirm you're pushing to `main` branch (PRs only build, don't push)
- Check Docker Hub repository exists and you have write access
