# TeamSync Editor - Sample Application

A sample web application demonstrating how to integrate TeamSync Editor for collaborative document editing.

## Overview

This sample app shows how to:
- Embed the TeamSync Editor in an iframe
- List and manage documents
- Upload new documents
- Open documents for editing
- Handle editor events (save, close, etc.)

## Prerequisites

1. **TeamSync Editor running** - Make sure the main TeamSync Editor stack is running:
   ```bash
   cd /path/to/TeamSync\ Editor
   docker-compose up -d
   ```

2. **Node.js 18+** installed on your system

## Quick Start

### 1. Install dependencies

```bash
cd sample-app
npm install
```

### 2. Create a sample Word document

```bash
npm install docx
node create-sample-doc.js
```

This creates a `sample-document.docx` file for testing.

### 3. Start the sample app

```bash
npm start
```

The app will be available at http://localhost:8080

## Project Structure

```
sample-app/
├── public/
│   ├── index.html      # Main HTML page
│   ├── styles.css      # Application styles
│   └── app.js          # Frontend JavaScript
├── server.js           # Express server with WOPI endpoints
├── package.json        # Dependencies
├── create-sample-doc.js # Script to create sample document
└── README.md           # This file
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Sample Application                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Browser    │───▶│ Sample Server│───▶│  WOPI Host   │  │
│  │  (Frontend)  │    │  (Express)   │    │  (TeamSync)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                       │           │
│         │         ┌──────────────────┐         │           │
│         └────────▶│ TeamSync Editor  │◀────────┘           │
│                   │   (Editor UI)    │                      │
│                   └──────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Integration Flow

1. **User selects a document** in the sidebar
2. **Frontend requests a WOPI token** from the sample server
3. **Sample server generates auth token** and requests WOPI token from TeamSync WOPI Host
4. **WOPI Host returns iframe URL** with embedded access token
5. **Frontend loads the editor** in an iframe
6. **TeamSync Editor connects** to WOPI Host for file operations
7. **User edits the document** in real-time
8. **Changes are saved** back to storage via WOPI protocol

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Sample app server port |
| `WOPI_HOST_URL` | `http://localhost:3000` | TeamSync WOPI Host URL |
| `JWT_SECRET` | (dev default) | JWT secret for auth tokens |

### Example .env file

```env
PORT=8080
WOPI_HOST_URL=http://localhost:3000
JWT_SECRET=your-secret-key-here
```

## API Endpoints

### Sample App API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (proxied to WOPI host) |
| `/api/documents` | GET | List all documents |
| `/api/documents/upload` | POST | Upload a new document |
| `/api/documents/:id/token` | POST | Get WOPI access token |

### WOPI Endpoints (served by sample app for demo)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wopi/files/:id` | GET | CheckFileInfo - Get file metadata |
| `/wopi/files/:id/contents` | GET | GetFile - Download file content |
| `/wopi/files/:id/contents` | POST | PutFile - Save file content |
| `/wopi/files/:id` | POST | Lock operations |

## Production Considerations

This sample app is for **demonstration purposes only**. For production:

1. **Authentication**: Replace demo auth with real OAuth2/OIDC
2. **Storage**: Use the WOPI Host's S3/MinIO storage instead of local Map
3. **Security**: Enable HTTPS, validate origins, add CSRF protection
4. **Scaling**: Move session state to Redis, use load balancers

## Troubleshooting

### "Disconnected" status in header

- Ensure the TeamSync Editor Docker stack is running
- Check that WOPI Host is accessible at the configured URL
- Verify network connectivity between services

### Document won't open

- Check browser console for errors
- Verify the document exists and is a supported format
- Check WOPI Host logs: `docker logs teamsync_wopi`

### Changes not saving

- Check that UserCanWrite is true in CheckFileInfo response
- Verify the WOPI token hasn't expired
- Check for lock conflicts in WOPI Host logs

## License

Mozilla Public License 2.0 - See the main project [LICENSE](../LICENSE) file.
