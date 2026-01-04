# TeamSync Editor

## Features

- **WOPI Protocol Implementation** - Full WOPI host in Node.js/TypeScript
- **S3/MinIO Storage** - Scalable document storage with S3 API
- **OAuth2/OIDC Authentication** - Enterprise-ready authentication
- **Production-ready Docker** - Multi-stage builds, security hardening
- **Nginx Reverse Proxy** - SSL termination, rate limiting, security headers

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Domain with SSL certificate (Let's Encrypt recommended)

### Installation

1. **Clone and configure:**
   ```bash
   git clone <repository-url> teamsync-editor
   cd teamsync-editor
   cp .env.example .env
   ```

2. **Edit `.env` with your settings:**
   ```bash
   nano .env
   ```

3. **Update Nginx configuration:**
   ```bash
   nano docker/nginx/nginx.conf
   # Replace 'yourdomain.com' with your actual domain
   ```

4. **Build and start:**
   ```bash
   docker compose up -d --build
   ```

5. **Verify services:**
   ```bash
   docker compose ps
   curl https://office.yourdomain.com/api/health
   ```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Proxy (:443)                        │
│                   SSL Termination                            │
│                   Rate Limiting                              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │  TeamSync    │ │  WOPI Host   │ │    MinIO     │
      │   Editor     │ │  (Node.js)   │ │  (Storage)   │
      │   (:9980)    │ │   (:3000)    │ │   (:9000)    │
      └──────────────┘ └──────────────┘ └──────────────┘
             │                │                │
             └────────────────┼────────────────┘
                              │
                    Internal Docker Network
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `APP_DOMAIN` | Your main application domain | Yes |
| `OFFICE_DOMAIN` | Office editor subdomain | Yes |
| `JWT_SECRET` | Secret for WOPI tokens (32+ chars) | Yes |
| `OIDC_ISSUER` | OAuth2/OIDC provider URL | Yes |
| `OIDC_CLIENT_ID` | OAuth2 client ID | Yes |
| `MINIO_ROOT_USER` | MinIO admin username | Yes |
| `MINIO_ROOT_PASSWORD` | MinIO admin password | Yes |

### WOPI Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wopi/files/:fileId` | GET | CheckFileInfo |
| `/wopi/files/:fileId/contents` | GET | GetFile |
| `/wopi/files/:fileId/contents` | POST | PutFile |
| `/api/documents/:fileId/token` | POST | Get access token |

### Integrating with Your App

```typescript
// 1. Get WOPI access token from your backend
const response = await fetch('/api/documents/file-id/token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userOAuthToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ permissions: 'edit' })
});

const { iframeSrc, accessToken, accessTokenTtl } = await response.json();

// 2. Embed the editor
document.getElementById('editor').src = iframeSrc;
```

## Production Deployment

### Using systemd

```bash
# Install the service
sudo ./systemd/install.sh

# Start the service
sudo systemctl start coolwsd.service

# Check status
sudo systemctl status coolwsd.service

# View logs
sudo journalctl -u coolwsd.service -f
```

### SSL Certificates with Let's Encrypt

```bash
# Initial certificate
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d office.yourdomain.com

# Auto-renewal (add to crontab)
0 0 * * * docker compose run --rm certbot renew --quiet
```

## MPL 2.0 Compliance

This project uses Collabora Online under the Mozilla Public License 2.0:

- ✅ Original MPL headers preserved in all source files
- ✅ LICENSE file included
- ✅ Only user-visible branding modified
- ✅ Source code available as required

## Troubleshooting

### Collabora not starting
```bash
docker compose logs office-server
```

### WOPI token errors
```bash
docker compose logs wopi-host
```

### MinIO connection issues
```bash
docker compose exec minio mc admin info local
```

## License

- **TeamSync Editor Code**: MIT License
- **Collabora Online**: Mozilla Public License 2.0
- **LibreOffice Core**: Mozilla Public License 2.0
