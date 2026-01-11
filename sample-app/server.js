/**
 * TeamSync Editor - Sample Application Server
 *
 * This is a sample Express server demonstrating how to integrate with
 * TeamSync Editor using JWT authentication for the WOPI protocol.
 *
 * Authentication Flow:
 * 1. Your app authenticates users (OAuth2, session, etc.)
 * 2. Your app generates a JWT signed with the shared JWT_SECRET
 * 3. The JWT is used as the WOPI access_token
 * 4. Collabora Online passes this token back to WOPI endpoints
 * 5. WOPI endpoints validate the JWT and serve the document
 */

const express = require('express');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const dns = require('dns');

// Configure DNS to prefer IPv6 for Railway private networking
// Railway's .internal domains only resolve to IPv6 addresses
dns.setDefaultResultOrder('verbatim');

const app = express();
const PORT = process.env.PORT || 8080;

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    console.error('ERROR: JWT_SECRET environment variable is required.');
    console.error('Generate one with: openssl rand -base64 32');
    process.exit(1);
}

// ============================================================================
// Configuration
// ============================================================================

const config = {
    // WOPI Host URL - for proxy mode
    wopiHostUrl: process.env.WOPI_HOST_URL || 'http://localhost:3000',

    // Collabora Online URLs (the actual editor servers) - INTERNAL URLs for server-to-server communication
    // These are used for health checks and discovery fetching from within Docker network
    // Single server mode (backward compatible)
    collaboraUrl: process.env.COLLABORA_URL || 'http://localhost:9980',

    // Multi-variant mode - separate servers for each document type (internal Docker network URLs)
    collaboraDocumentUrl: process.env.COLLABORA_DOCUMENT_URL || process.env.COLLABORA_URL || 'http://localhost:9980',
    collaboraSheetsUrl: process.env.COLLABORA_SHEETS_URL || process.env.COLLABORA_URL || 'http://localhost:9981',
    collaboraPresentationUrl: process.env.COLLABORA_PRESENTATION_URL || process.env.COLLABORA_URL || 'http://localhost:9982',

    // TeamSync Editor - unified editor handling ALL document types (internal Docker network URL)
    collaboraEditorUrl: process.env.COLLABORA_EDITOR_URL || 'http://localhost:9983',

    // Official Collabora CODE Docker instance (Railway deployed or local)
    collaboraOfficialUrl: process.env.COLLABORA_OFFICIAL_URL || 'http://localhost:9984',

    // TeamSync Document Source - built from Collabora source (Railway deployed)
    documentSourceUrl: process.env.DOCUMENT_SOURCE_URL || 'http://localhost:9985',

    // PUBLIC URLs for browser access - these are what the browser iframe will use
    // When running in Docker, the browser needs localhost URLs to access the exposed ports
    collaboraDocumentPublicUrl: process.env.COLLABORA_DOCUMENT_PUBLIC_URL || 'http://localhost:9980',
    collaboraSheetsPublicUrl: process.env.COLLABORA_SHEETS_PUBLIC_URL || 'http://localhost:9981',
    collaboraPresentationPublicUrl: process.env.COLLABORA_PRESENTATION_PUBLIC_URL || 'http://localhost:9982',
    collaboraEditorPublicUrl: process.env.COLLABORA_EDITOR_PUBLIC_URL || 'http://localhost:9983',
    collaboraOfficialPublicUrl: process.env.COLLABORA_OFFICIAL_PUBLIC_URL || 'http://localhost:9984',
    documentSourcePublicUrl: process.env.DOCUMENT_SOURCE_PUBLIC_URL || 'http://localhost:9985',

    // Editor mode: 'teamsync-unified' | 'multi-editor' | 'collabora' | 'document-source'
    // - teamsync-unified: Use single TeamSync Editor for all documents
    // - multi-editor: Use specialized TeamSync editors (Document/Sheets/Presentation)
    // - collabora: Use official Collabora CODE Docker image
    // - document-source: Use TeamSync Document Source (built from Collabora source)
    editorMode: process.env.EDITOR_MODE || 'teamsync-unified',

    // This sample app's public URL (for browser access)
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:8080',

    // WOPI callback URL - what Collabora (inside Docker) uses to reach this app
    // When running in Docker, Collabora needs host.docker.internal to reach the host
    wopiCallbackUrl: process.env.WOPI_CALLBACK_URL || 'http://host.docker.internal:8080',

    // JWT secret - MUST match the secret used by wopi-host
    // REQUIRED: Set JWT_SECRET environment variable (32+ characters recommended)
    // Generate with: openssl rand -base64 32
    jwtSecret: process.env.JWT_SECRET,

    // Token TTL in seconds (8 hours default for better UX)
    tokenTtlSeconds: parseInt(process.env.TOKEN_TTL || '28800'),

    // Demo user info (in production, this comes from your auth system)
    demoUser: {
        id: 'demo-user-001',
        name: 'Demo User',
        email: 'demo@example.com'
    },

    // Standalone mode - serve as own WOPI host
    standaloneMode: process.env.STANDALONE_MODE !== 'false'
};

// ============================================================================
// JWT Token Service
// ============================================================================

const tokenService = {
    /**
     * Generate a WOPI access token (JWT)
     * This token is passed to Collabora and returned to WOPI endpoints
     */
    generateWopiToken(fileId, user, permissions = 'edit') {
        const payload = {
            // WOPI-specific claims
            fileId,
            permissions,

            // User claims
            userId: user.id,
            userName: user.name,
            userEmail: user.email,

            // Standard JWT claims
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + config.tokenTtlSeconds,

            // Token type identifier
            type: 'wopi_access'
        };

        return jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' });
    },

    /**
     * Validate a WOPI access token
     * Returns the decoded payload or null if invalid
     */
    validateWopiToken(token) {
        try {
            const decoded = jwt.verify(token, config.jwtSecret, {
                algorithms: ['HS256']
            });

            // Verify it's a WOPI token
            if (decoded.type !== 'wopi_access') {
                console.warn('[Token] Invalid token type:', decoded.type);
                return null;
            }

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                console.warn('[Token] Token expired');
            } else if (error.name === 'JsonWebTokenError') {
                console.warn('[Token] Invalid token:', error.message);
            } else {
                console.error('[Token] Validation error:', error);
            }
            return null;
        }
    },

    /**
     * Generate an application JWT for API authentication
     * This is what your frontend would use to authenticate API calls
     */
    generateAppToken(user) {
        const payload = {
            sub: user.id,
            name: user.name,
            email: user.email,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + config.tokenTtlSeconds,
            type: 'app_auth'
        };

        return jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' });
    },

    /**
     * Validate an application JWT
     */
    validateAppToken(token) {
        try {
            const decoded = jwt.verify(token, config.jwtSecret, {
                algorithms: ['HS256']
            });

            if (decoded.type !== 'app_auth') {
                return null;
            }

            return {
                id: decoded.sub,
                name: decoded.name,
                email: decoded.email
            };
        } catch (error) {
            return null;
        }
    },

    /**
     * Get token TTL in milliseconds
     */
    getTokenTtlMs() {
        return config.tokenTtlSeconds * 1000;
    }
};

// ============================================================================
// WOPI Token Validation Middleware
// ============================================================================

/**
 * Middleware to validate WOPI access tokens
 * Extracts token from query param or Authorization header
 */
function validateWopiToken(req, res, next) {
    // WOPI tokens come as query parameter 'access_token'
    const token = req.query.access_token ||
                  req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const payload = tokenService.validateWopiToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Verify the token is for the requested file
    const fileId = req.params.fileId;
    if (payload.fileId !== fileId) {
        return res.status(403).json({ error: 'Token not valid for this file' });
    }

    // Attach user info to request
    req.wopiUser = {
        id: payload.userId,
        name: payload.userName,
        email: payload.userEmail,
        permissions: payload.permissions
    };
    req.wopiToken = payload;

    next();
}

/**
 * Middleware to validate app authentication tokens
 */
function validateAppAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // For demo purposes, use demo user if no auth provided
        req.user = config.demoUser;
        return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const user = tokenService.validateAppToken(token);

    if (!user) {
        return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.user = user;
    next();
}

// ============================================================================
// File Type Detection & Collabora URL Routing
// ============================================================================

/**
 * Determine the document type based on file extension
 */
function getDocumentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();

    const documentTypes = ['docx', 'doc', 'odt', 'rtf', 'txt'];
    const spreadsheetTypes = ['xlsx', 'xls', 'ods', 'csv'];
    const presentationTypes = ['pptx', 'ppt', 'odp'];

    if (documentTypes.includes(ext)) return 'document';
    if (spreadsheetTypes.includes(ext)) return 'spreadsheet';
    if (presentationTypes.includes(ext)) return 'presentation';

    return 'document'; // Default to document
}

/**
 * Get the appropriate Collabora URL for a document type (internal Docker network)
 * Used for server-to-server communication (health checks, discovery)
 * @param {string} docType - The document type (document, spreadsheet, presentation)
 * @param {string} editorMode - The editor mode (teamsync-unified, multi-editor, collabora)
 */
function getCollaboraUrlForType(docType, editorMode = config.editorMode) {
    // Route based on editor mode
    if (editorMode === 'teamsync-unified') {
        return config.collaboraEditorUrl;
    } else if (editorMode === 'collabora') {
        return config.collaboraOfficialUrl;
    } else if (editorMode === 'document-source') {
        return config.documentSourceUrl;
    }

    // Multi-editor mode: use specialized editors
    switch (docType) {
        case 'spreadsheet':
            return config.collaboraSheetsUrl;
        case 'presentation':
            return config.collaboraPresentationUrl;
        case 'document':
        default:
            return config.collaboraDocumentUrl;
    }
}

/**
 * Get the PUBLIC Collabora URL for a document type (for browser iframe)
 * Used for building the iframe src that the browser will load
 * @param {string} docType - The document type (document, spreadsheet, presentation)
 * @param {string} editorMode - The editor mode (teamsync-unified, multi-editor, collabora, document-source)
 */
function getCollaboraPublicUrlForType(docType, editorMode = config.editorMode) {
    // Route based on editor mode
    if (editorMode === 'teamsync-unified') {
        return config.collaboraEditorPublicUrl;
    } else if (editorMode === 'collabora') {
        return config.collaboraOfficialPublicUrl;
    } else if (editorMode === 'document-source') {
        return config.documentSourcePublicUrl;
    }

    // Multi-editor mode: use specialized editors
    switch (docType) {
        case 'spreadsheet':
            return config.collaboraSheetsPublicUrl;
        case 'presentation':
            return config.collaboraPresentationPublicUrl;
        case 'document':
        default:
            return config.collaboraDocumentPublicUrl;
    }
}

// ============================================================================
// Collabora Discovery Service
// ============================================================================

// Cache discovery per Collabora instance
const discoveryCache = new Map(); // url -> { urlPath, timestamp }
const DISCOVERY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchDiscovery(collaboraUrl) {
    const startTime = Date.now();
    try {
        console.log(`[Discovery] Fetching from ${collaboraUrl}/hosting/discovery`);
        const response = await fetch(`${collaboraUrl}/hosting/discovery`);
        const elapsed = Date.now() - startTime;
        if (!response.ok) {
            throw new Error(`Discovery fetch failed: ${response.status}`);
        }
        const xml = await response.text();
        console.log(`[Discovery] Fetched from ${collaboraUrl} in ${elapsed}ms`);

        // Parse the discovery XML to extract URL patterns
        const urlMatch = xml.match(/urlsrc="([^"]+cool\.html[^"]*)"/);
        if (urlMatch) {
            const fullUrl = urlMatch[1];
            const urlPath = new URL(fullUrl).pathname;
            const cache = { urlPath, timestamp: Date.now() };
            discoveryCache.set(collaboraUrl, cache);
            console.log(`[Discovery] Found Collabora URL path for ${collaboraUrl}:`, urlPath);
            return cache;
        }

        // Fallback
        const fallbackMatch = xml.match(/urlsrc="([^"]+)"/);
        if (fallbackMatch) {
            const fullUrl = fallbackMatch[1];
            const urlPath = new URL(fullUrl).pathname;
            const cache = { urlPath, timestamp: Date.now() };
            discoveryCache.set(collaboraUrl, cache);
            return cache;
        }

        throw new Error('Could not parse discovery XML');
    } catch (error) {
        console.error(`[Discovery] Error for ${collaboraUrl}:`, error.message);
        return { urlPath: '/browser/dist/cool.html', timestamp: Date.now() };
    }
}

async function getCollaboraUrlPath(collaboraUrl) {
    const cached = discoveryCache.get(collaboraUrl);
    if (cached && (Date.now() - cached.timestamp) < DISCOVERY_CACHE_TTL) {
        return cached.urlPath;
    }
    const discovery = await fetchDiscovery(collaboraUrl);
    return discovery.urlPath;
}

async function buildIframeSrc(fileId, accessToken, filename, editorMode = config.editorMode) {
    const startTime = Date.now();
    // Determine which Collabora instance to use based on file type and editor mode
    const docType = getDocumentType(filename);

    const collaboraInternalUrl = getCollaboraUrlForType(docType, editorMode);
    const collaboraPublicUrl = getCollaboraPublicUrlForType(docType, editorMode);

    const modeLabels = {
        'teamsync-unified': 'TEAMSYNC UNIFIED',
        'multi-editor': 'MULTI-EDITOR',
        'collabora': 'COLLABORA OFFICIAL'
    };
    console.log(`[Router] Building iframe for "${filename}" (${docType}) - ${modeLabels[editorMode] || editorMode} MODE`);

    console.log(`[Router]   Internal URL: ${collaboraInternalUrl}`);
    console.log(`[Router]   Public URL:   ${collaboraPublicUrl}`);

    const urlPath = await getCollaboraUrlPath(collaboraInternalUrl);
    const discoveryElapsed = Date.now() - startTime;
    console.log(`[Router]   Discovery lookup: ${discoveryElapsed}ms`);

    // Use wopiCallbackUrl for the WOPISrc - this is what Collabora (inside Docker) calls back to
    const wopiSrc = encodeURIComponent(`${config.wopiCallbackUrl}/wopi/files/${fileId}`);

    console.log(`[Router] File "${filename}" (${docType})`);
    console.log(`  Internal URL: ${collaboraInternalUrl}`);
    console.log(`  Public URL:   ${collaboraPublicUrl}`);

    // Add cache-busting timestamp to ensure fresh tokens are used
    const cacheBuster = Date.now();

    // Return the PUBLIC URL for the browser iframe
    return `${collaboraPublicUrl}${urlPath}?WOPISrc=${wopiSrc}&access_token=${accessToken}&lang=en&_t=${cacheBuster}`;
}

// ============================================================================
// Document Storage (In-memory for demo)
// ============================================================================

const localDocuments = new Map();
const documentLocks = new Map(); // fileId -> { lockId, userId, timestamp }

// Initialize with sample documents for each type
const sampleFiles = [
    { path: 'sample-document.docx', id: 'sample-doc-001', name: 'Sample Document.docx' },
    { path: 'sample-spreadsheet.xlsx', id: 'sample-sheet-001', name: 'Sample Spreadsheet.xlsx' },
    { path: 'sample-presentation.pptx', id: 'sample-pres-001', name: 'Sample Presentation.pptx' }
];

sampleFiles.forEach(({ path: filePath, id, name }) => {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        localDocuments.set(id, {
            id,
            name,
            content,
            size: content.length,
            lastModified: new Date().toISOString(),
            ownerId: config.demoUser.id
        });
        console.log(`[Storage] Loaded sample ${getDocumentType(name)}:`, id);
    }
});

// Create placeholder documents if no sample files exist
if (localDocuments.size === 0) {
    console.log('[Storage] No sample files found. Upload documents to test.');
}

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

// ============================================================================
// Middleware Setup
// ============================================================================

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp'];
        const ext = getFileExtension(file.originalname);
        cb(null, allowedExtensions.includes(ext));
    }
});

// ============================================================================
// Public API Routes
// ============================================================================

/**
 * Health check - checks all Collabora instances
 */
app.get('/api/health', async (req, res) => {
    try {
        if (config.standaloneMode) {
            // Check all three Collabora instances
            const checkInstance = async (name, url) => {
                const startTime = Date.now();
                try {
                    console.log(`[Health] Checking ${name} at ${url}/hosting/discovery`);
                    const response = await fetch(`${url}/hosting/discovery`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    const elapsed = Date.now() - startTime;
                    const status = response.ok ? 'healthy' : 'not reachable';
                    console.log(`[Health] ${name}: ${status} (HTTP ${response.status}) - ${elapsed}ms`);
                    return status;
                } catch (e) {
                    const elapsed = Date.now() - startTime;
                    console.log(`[Health] ${name}: not reachable (${e.message}) - ${elapsed}ms`);
                    return 'not reachable';
                }
            };

            const [docStatus, sheetsStatus, presentationStatus, editorStatus, collaboraStatus, documentSourceStatus] = await Promise.all([
                checkInstance('document', config.collaboraDocumentUrl),
                checkInstance('sheets', config.collaboraSheetsUrl),
                checkInstance('presentation', config.collaboraPresentationUrl),
                checkInstance('editor', config.collaboraEditorUrl),
                checkInstance('collabora', config.collaboraOfficialUrl),
                checkInstance('document-source', config.documentSourceUrl)
            ]);

            // Determine health based on current editor mode
            let allHealthy;
            if (config.editorMode === 'teamsync-unified') {
                allHealthy = editorStatus === 'healthy';
            } else if (config.editorMode === 'collabora') {
                allHealthy = collaboraStatus === 'healthy';
            } else if (config.editorMode === 'document-source') {
                allHealthy = documentSourceStatus === 'healthy';
            } else {
                // multi-editor mode
                allHealthy = docStatus === 'healthy' && sheetsStatus === 'healthy' && presentationStatus === 'healthy';
            }

            const anyHealthy = docStatus === 'healthy' ||
                               sheetsStatus === 'healthy' ||
                               presentationStatus === 'healthy' ||
                               editorStatus === 'healthy' ||
                               collaboraStatus === 'healthy' ||
                               documentSourceStatus === 'healthy';

            return res.json({
                status: allHealthy ? 'healthy' : (anyHealthy ? 'partial' : 'degraded'),
                mode: config.editorMode,
                timestamp: new Date().toISOString(),
                services: {
                    sampleApp: 'healthy',
                    'teamsync-document': docStatus,
                    'teamsync-sheets': sheetsStatus,
                    'teamsync-presentation': presentationStatus,
                    'teamsync-editor': editorStatus,
                    'collabora': collaboraStatus,
                    'document-source': documentSourceStatus
                }
            });
        }

        const response = await fetch(`${config.wopiHostUrl}/api/health`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Health] Error:', error);
        res.json({ status: 'degraded', message: 'Service unavailable' });
    }
});

/**
 * Get/Set editor mode configuration
 * Editor modes: 'teamsync-unified' | 'multi-editor' | 'collabora'
 */
app.get('/api/config/editor-mode', (req, res) => {
    res.json({
        editorMode: config.editorMode,
        mode: config.editorMode
    });
});

app.post('/api/config/editor-mode', (req, res) => {
    const { editorMode } = req.body;
    const validModes = ['teamsync-unified', 'multi-editor', 'collabora', 'document-source'];

    if (editorMode && validModes.includes(editorMode)) {
        config.editorMode = editorMode;
        console.log(`[Config] Editor mode changed to: ${editorMode}`);
    }
    res.json({
        editorMode: config.editorMode,
        mode: config.editorMode
    });
});

/**
 * List documents
 */
app.get('/api/documents', validateAppAuth, (req, res) => {
    const docs = Array.from(localDocuments.values()).map(doc => ({
        id: doc.id,
        name: doc.name,
        size: doc.size,
        lastModified: doc.lastModified
    }));
    res.json(docs);
});

/**
 * Upload a document
 */
app.post('/api/documents/upload', validateAppAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const docId = `doc-${crypto.randomBytes(8).toString('hex')}`;
        const doc = {
            id: docId,
            name: req.file.originalname,
            content: req.file.buffer,
            size: req.file.size,
            lastModified: new Date().toISOString(),
            ownerId: req.user.id
        };

        localDocuments.set(docId, doc);
        console.log(`[Storage] Document uploaded: ${doc.name} (${doc.size} bytes)`);

        res.json({
            id: doc.id,
            name: doc.name,
            size: doc.size,
            lastModified: doc.lastModified
        });
    } catch (error) {
        console.error('[Upload] Error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

/**
 * Get WOPI access token for a document
 * This is the main integration point - your app calls this to get editor access
 */
app.post('/api/documents/:fileId/token', validateAppAuth, async (req, res) => {
    const startTime = Date.now();
    try {
        const { fileId } = req.params;
        const { permissions = 'edit', editorMode } = req.body;

        // Use client preference if provided, otherwise fall back to server config
        const effectiveEditorMode = editorMode || config.editorMode;
        console.log(`[API] Token request: fileId=${fileId} permissions=${permissions} editorMode=${effectiveEditorMode}`);

        // Verify document exists
        if (!localDocuments.has(fileId)) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = localDocuments.get(fileId);

        // Generate WOPI access token (JWT)
        const accessToken = tokenService.generateWopiToken(fileId, req.user, permissions);

        // Build iframe URL for Collabora (routes to correct server based on file type and editor mode)
        const iframeSrc = await buildIframeSrc(fileId, accessToken, doc.name, effectiveEditorMode);

        // Determine document type for client info
        const docType = getDocumentType(doc.name);

        const elapsed = Date.now() - startTime;
        console.log(`[API] Token issued: file=${fileId} (${docType}) user=${req.user.id} permissions=${permissions} editorMode=${effectiveEditorMode} - ${elapsed}ms`);

        res.json({
            accessToken,
            accessTokenTtl: tokenService.getTokenTtlMs(),
            iframeSrc,
            documentType: docType,
            editorMode: effectiveEditorMode
        });
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[Token] Error after ${elapsed}ms:`, error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

/**
 * Get an app authentication token (for demo/testing)
 * In production, this would be handled by your OAuth2/OIDC provider
 */
app.post('/api/auth/token', (req, res) => {
    const { userId, userName, userEmail } = req.body;

    const user = {
        id: userId || config.demoUser.id,
        name: userName || config.demoUser.name,
        email: userEmail || config.demoUser.email
    };

    const token = tokenService.generateAppToken(user);

    res.json({
        token,
        expiresIn: config.tokenTtlSeconds,
        user
    });
});

// ============================================================================
// WOPI Protocol Endpoints
// These endpoints are called by Collabora Online to access documents
// ============================================================================

/**
 * WOPI CheckFileInfo - Get file metadata
 * Called when Collabora opens a document
 */
app.get('/wopi/files/:fileId', validateWopiToken, (req, res) => {
    const startTime = Date.now();
    const { fileId } = req.params;
    console.log(`[WOPI] CheckFileInfo request: fileId=${fileId}`);

    const doc = localDocuments.get(fileId);

    if (!doc) {
        console.log(`[WOPI] CheckFileInfo: file not found - ${fileId}`);
        return res.status(404).json({ error: 'File not found' });
    }

    const user = req.wopiUser;
    const canWrite = req.wopiToken.permissions === 'edit';

    // Return WOPI CheckFileInfo response
    // See: https://docs.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/checkfileinfo
    const elapsed = Date.now() - startTime;
    console.log(`[WOPI] CheckFileInfo: ${doc.name} (${doc.size} bytes) - ${elapsed}ms`);
    res.json({
        // Required properties
        BaseFileName: doc.name,
        OwnerId: doc.ownerId,
        Size: doc.size,
        UserId: user.id,
        Version: doc.lastModified,

        // User info
        UserFriendlyName: user.name,
        UserCanWrite: canWrite,
        UserCanNotWriteRelative: true,

        // Capabilities
        SupportsUpdate: true,
        SupportsLocks: true,
        SupportsGetLock: true,
        SupportsExtendedLockLength: true,
        SupportsRename: true,
        SupportsDeleteFile: false,
        SupportsCobalt: false,
        SupportsFolders: false,
        SupportsUserInfo: true,

        // Status
        IsAnonymousUser: false,
        IsAdminUser: true,  // Set to true to enable admin features in Collabora
        ReadOnly: !canWrite,
        RestrictedWebViewOnly: false,
        LastModifiedTime: doc.lastModified,

        // URLs for navigation
        CloseUrl: config.publicUrl,
        HostEditUrl: `${config.publicUrl}/?doc=${fileId}`,
        HostViewUrl: `${config.publicUrl}/?doc=${fileId}&mode=view`,

        // PostMessage settings for iframe communication
        PostMessageOrigin: config.publicUrl,
        EnableOwnerTermination: true,  // Allow host to terminate sessions
        EnableInsertRemoteImage: false,
        DisableExport: false,
        DisablePrint: false,
        DisableCopy: false,

        // Additional WOPI properties for better integration
        UserCanRename: canWrite,
        FileNameMaxLength: 255,
        EditModePostMessage: true,  // Enable PostMessage for edit mode changes
        FileSharingPostMessage: true,  // Enable PostMessage for file sharing
        ClosePostMessage: true,  // Enable PostMessage when document closes
    });
});

/**
 * WOPI GetFile - Download file content
 */
app.get('/wopi/files/:fileId/contents', validateWopiToken, (req, res) => {
    const startTime = Date.now();
    const { fileId } = req.params;
    console.log(`[WOPI] GetFile request: fileId=${fileId}`);

    const doc = localDocuments.get(fileId);

    if (!doc) {
        console.log(`[WOPI] GetFile: file not found - ${fileId}`);
        return res.status(404).json({ error: 'File not found' });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[WOPI] GetFile: ${doc.name} (${doc.size} bytes) - ${elapsed}ms`);

    res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': doc.content.length,
        'X-WOPI-ItemVersion': doc.lastModified
    });
    res.send(doc.content);
});

/**
 * WOPI PutFile - Save file content
 */
app.post('/wopi/files/:fileId/contents', validateWopiToken, express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
    const { fileId } = req.params;
    const doc = localDocuments.get(fileId);

    if (!doc) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Check write permission
    if (req.wopiToken.permissions !== 'edit') {
        return res.status(403).json({ error: 'Write permission required' });
    }

    // Check lock (if document is locked by another user)
    const lock = documentLocks.get(fileId);
    const requestLock = req.headers['x-wopi-lock'];

    if (lock && requestLock !== lock.lockId) {
        res.set('X-WOPI-Lock', lock.lockId);
        return res.status(409).json({ error: 'Lock mismatch' });
    }

    // Update document
    doc.content = req.body;
    doc.size = req.body.length;
    doc.lastModified = new Date().toISOString();
    localDocuments.set(fileId, doc);

    console.log(`[WOPI] PutFile: ${doc.name} (${doc.size} bytes) by ${req.wopiUser.name}`);

    res.set('X-WOPI-ItemVersion', doc.lastModified);
    res.json({
        LastModifiedTime: doc.lastModified,
        ItemVersion: doc.lastModified
    });
});

/**
 * WOPI Lock/Unlock operations
 */
app.post('/wopi/files/:fileId', validateWopiToken, (req, res) => {
    const { fileId } = req.params;
    const wopiOverride = req.headers['x-wopi-override'];
    const requestLock = req.headers['x-wopi-lock'];
    const oldLock = req.headers['x-wopi-oldlock'];

    const doc = localDocuments.get(fileId);
    if (!doc) {
        return res.status(404).json({ error: 'File not found' });
    }

    const currentLock = documentLocks.get(fileId);

    switch (wopiOverride) {
        case 'LOCK':
            if (currentLock) {
                if (currentLock.lockId === requestLock) {
                    // Refresh lock
                    currentLock.timestamp = Date.now();
                    res.set('X-WOPI-Lock', currentLock.lockId);
                    return res.status(200).send();
                } else {
                    // Conflict
                    res.set('X-WOPI-Lock', currentLock.lockId);
                    return res.status(409).json({ error: 'Lock conflict' });
                }
            }
            // Create new lock
            documentLocks.set(fileId, {
                lockId: requestLock,
                userId: req.wopiUser.id,
                timestamp: Date.now()
            });
            console.log(`[WOPI] Lock acquired: ${fileId} by ${req.wopiUser.name}`);
            res.set('X-WOPI-Lock', requestLock);
            return res.status(200).send();

        case 'GET_LOCK':
            res.set('X-WOPI-Lock', currentLock?.lockId || '');
            return res.status(200).send();

        case 'REFRESH_LOCK':
            if (!currentLock || currentLock.lockId !== requestLock) {
                res.set('X-WOPI-Lock', currentLock?.lockId || '');
                return res.status(409).json({ error: 'Lock mismatch' });
            }
            currentLock.timestamp = Date.now();
            res.set('X-WOPI-Lock', currentLock.lockId);
            return res.status(200).send();

        case 'UNLOCK':
            if (!currentLock || currentLock.lockId !== requestLock) {
                res.set('X-WOPI-Lock', currentLock?.lockId || '');
                return res.status(409).json({ error: 'Lock mismatch' });
            }
            documentLocks.delete(fileId);
            console.log(`[WOPI] Lock released: ${fileId}`);
            res.set('X-WOPI-Lock', '');
            return res.status(200).send();

        case 'UNLOCK_AND_RELOCK':
            if (!currentLock || currentLock.lockId !== oldLock) {
                res.set('X-WOPI-Lock', currentLock?.lockId || '');
                return res.status(409).json({ error: 'Lock mismatch' });
            }
            documentLocks.set(fileId, {
                lockId: requestLock,
                userId: req.wopiUser.id,
                timestamp: Date.now()
            });
            res.set('X-WOPI-Lock', requestLock);
            return res.status(200).send();

        case 'PUT_RELATIVE':
            return res.status(501).json({ error: 'Not implemented' });

        case 'RENAME_FILE':
            const newName = req.headers['x-wopi-requestedname'];
            if (newName) {
                doc.name = decodeURIComponent(newName);
                doc.lastModified = new Date().toISOString();
                console.log(`[WOPI] Renamed: ${fileId} -> ${doc.name}`);
            }
            res.json({ Name: doc.name });
            return;

        default:
            return res.status(400).json({ error: 'Unknown WOPI operation' });
    }
});

// ============================================================================
// SPA Fallback
// ============================================================================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   TeamSync Editor - Sample Application                         ║
║                                                                ║
║   Server running at: http://localhost:${PORT}                    ║
║   Mode: ${(config.standaloneMode ? 'Standalone (JWT WOPI)' : 'Proxy').padEnd(52)}║
║                                                                ║
║   Open your browser and navigate to http://localhost:${PORT}     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

Collabora Instances:
  - Document:     ${config.collaboraDocumentUrl}
  - Sheets:       ${config.collaboraSheetsUrl}
  - Presentation: ${config.collaboraPresentationUrl}
  - Editor:       ${config.collaboraEditorUrl}
  - Collabora:    ${config.collaboraOfficialUrl}
  - Doc Source:   ${config.documentSourceUrl}

Editor Mode: ${config.editorMode}

Authentication:
  - JWT Secret: ${config.jwtSecret.slice(0, 10)}... (${config.jwtSecret.length} chars)
  - Token TTL: ${config.tokenTtlSeconds} seconds
  - Demo User: ${config.demoUser.name} (${config.demoUser.id})

Documents loaded: ${Array.from(localDocuments.keys()).join(', ') || 'none'}
`);

    if (config.standaloneMode) {
        const modeInfo = {
            'teamsync-unified': {
                label: 'TeamSync Unified Editor',
                routing: '  All documents -> TeamSync Editor (port 9983)',
                setup: '  docker-compose -f docker-compose.editor.yml up -d'
            },
            'multi-editor': {
                label: 'Multi-Editor Mode',
                routing: `  .docx/.doc/.odt -> TeamSync Document (port 9980)
  .xlsx/.xls/.ods -> TeamSync Sheets (port 9981)
  .pptx/.ppt/.odp -> TeamSync Presentation (port 9982)`,
                setup: '  docker-compose -f docker-compose.multi.yml up -d'
            },
            'collabora': {
                label: 'Collabora Official',
                routing: '  All documents -> Official Collabora CODE (port 9984)',
                setup: '  docker run -e "domain=host.docker.internal" -p 9984:9980 collabora/code'
            },
            'document-source': {
                label: 'Document Source (Forked)',
                routing: '  All documents -> TeamSync Document Source (port 9985)',
                setup: '  Built from editor-source repo with custom branding'
            }
        };

        const mode = modeInfo[config.editorMode] || modeInfo['teamsync-unified'];
        console.log(`[${mode.label}] Document routing:`);
        console.log(mode.routing);
        console.log('\nMake sure the editor is running:');
        console.log(mode.setup + '\n');
    }
});

module.exports = app;
