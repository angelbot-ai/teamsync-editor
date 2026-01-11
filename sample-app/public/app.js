/**
 * TeamSync Editor - Sample Application
 *
 * This demonstrates how to integrate the TeamSync Editor suite into a web application
 * to enable collaborative document, spreadsheet, and presentation editing.
 *
 * Products:
 * - TeamSync Document (port 9980): Word processing
 * - TeamSync Sheets (port 9981): Spreadsheets
 * - TeamSync Presentation (port 9982): Presentations
 */

class TeamSyncApp {
    constructor() {
        // Configuration
        this.config = {
            apiBaseUrl: '/api',
            healthCheckInterval: 30000,
        };

        // State
        this.documents = [];
        this.filteredDocuments = [];
        this.currentDocument = null;
        this.currentToken = null;
        this.isConnected = false;
        this.currentFilter = 'all';
        // Editor modes: 'teamsync-unified' | 'multi-editor' | 'collabora' | 'document-source'
        this.editorMode = localStorage.getItem('editorMode') || 'teamsync-unified';
        this.serviceStatus = {
            'teamsync-document': 'checking',
            'teamsync-sheets': 'checking',
            'teamsync-presentation': 'checking',
            'teamsync-editor': 'checking',
            'collabora': 'checking',
            'document-source': 'checking'
        };

        // File type mappings
        this.fileTypeMap = {
            document: ['docx', 'doc', 'odt', 'rtf', 'txt'],
            spreadsheet: ['xlsx', 'xls', 'ods', 'csv'],
            presentation: ['pptx', 'ppt', 'odp']
        };

        this.supportedFormats = {
            document: '.docx, .doc, .odt, .rtf, .txt',
            spreadsheet: '.xlsx, .xls, .ods, .csv',
            presentation: '.pptx, .ppt, .odp'
        };

        // DOM Elements
        this.elements = {
            documentList: document.getElementById('document-list'),
            loadingDocs: document.getElementById('loading-docs'),
            editorFrame: document.getElementById('editor-frame'),
            editorPlaceholder: document.getElementById('editor-placeholder'),
            editorHeader: document.getElementById('editor-header'),
            editorProductBadge: document.getElementById('editor-product-badge'),
            editorDocName: document.getElementById('editor-doc-name'),
            closeEditor: document.getElementById('close-editor'),
            connectionStatus: document.getElementById('connection-status'),
            currentDoc: document.getElementById('current-doc'),
            uploadBtn: document.getElementById('upload-btn'),
            fileInput: document.getElementById('file-input'),
            uploadModal: document.getElementById('upload-modal'),
            uploadArea: document.getElementById('upload-area'),
            cancelUpload: document.getElementById('cancel-upload'),
            supportedFormats: document.getElementById('supported-formats'),
            errorToast: document.getElementById('error-toast'),
            errorMessage: document.getElementById('error-message'),
            closeToast: document.getElementById('close-toast'),
            successToast: document.getElementById('success-toast'),
            successMessage: document.getElementById('success-message'),
            closeSuccessToast: document.getElementById('close-success-toast'),
            filterTabs: document.getElementById('filter-tabs'),
            serviceIndicators: document.getElementById('service-indicators'),
            statusDocument: document.getElementById('status-document'),
            statusSheets: document.getElementById('status-sheets'),
            statusPresentation: document.getElementById('status-presentation'),
            editorModeSelector: document.querySelector('.editor-mode-selector'),
            editorModeOptions: document.querySelectorAll('input[name="editor-mode"]'),
        };

        this.selectedUploadType = 'document';

        this.init();
    }

    async init() {
        this.bindEvents();
        this.initEditorModeToggle();
        await this.checkConnection();
        await this.loadDocuments();

        // Start health check polling
        setInterval(() => this.checkConnection(), this.config.healthCheckInterval);
    }

    /**
     * Initialize the editor mode selector
     */
    initEditorModeToggle() {
        // Set initial state from localStorage
        if (this.elements.editorModeOptions) {
            this.elements.editorModeOptions.forEach(option => {
                option.checked = option.value === this.editorMode;
            });
            this.updateEditorModeUI();
        }
    }

    /**
     * Update the UI to reflect current editor mode
     */
    updateEditorModeUI() {
        // Update the mode selector visual state
        document.querySelectorAll('.mode-option').forEach(option => {
            const input = option.querySelector('input');
            if (input && input.value === this.editorMode) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    /**
     * Change editor mode (teamsync-unified, multi-editor, or collabora)
     */
    async setEditorMode(mode) {
        if (mode === this.editorMode) return;

        this.editorMode = mode;
        localStorage.setItem('editorMode', mode);
        this.updateEditorModeUI();

        // Close any open document when switching modes
        if (this.currentDocument) {
            this.closeDocument();
        }

        // Update the server configuration
        try {
            await fetch(`${this.config.apiBaseUrl}/config/editor-mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ editorMode: mode })
            });
        } catch (error) {
            console.warn('Could not update server editor mode:', error);
        }

        // Re-check health to update service indicators
        await this.checkConnection();

        // Show feedback
        const modeNames = {
            'teamsync-unified': 'TeamSync Editor',
            'multi-editor': 'Multi-Editor',
            'collabora': 'Collabora',
            'document-source': 'Doc Source'
        };
        this.showSuccess(`Switched to ${modeNames[mode]} mode`);
    }

    bindEvents() {
        // Upload button
        this.elements.uploadBtn.addEventListener('click', () => this.showUploadModal());
        this.elements.cancelUpload.addEventListener('click', () => this.hideUploadModal());

        // File input
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Upload area
        this.elements.uploadArea.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('dragover');
        });
        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.classList.remove('dragover');
        });
        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadFile(files[0]);
            }
        });

        // Upload type selector
        document.querySelectorAll('.upload-type').forEach(btn => {
            btn.addEventListener('click', () => this.selectUploadType(btn.dataset.type));
        });

        // Modal close on backdrop click
        this.elements.uploadModal.addEventListener('click', (e) => {
            if (e.target === this.elements.uploadModal) {
                this.hideUploadModal();
            }
        });

        // Toast close
        this.elements.closeToast.addEventListener('click', () => this.hideError());
        if (this.elements.closeSuccessToast) {
            this.elements.closeSuccessToast.addEventListener('click', () => this.hideSuccess());
        }

        // Close editor button
        if (this.elements.closeEditor) {
            this.elements.closeEditor.addEventListener('click', () => this.closeDocument());
        }

        // Filter tabs
        this.elements.filterTabs.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => this.setFilter(tab.dataset.filter));
        });

        // Editor mode selector (3-way toggle)
        if (this.elements.editorModeOptions) {
            this.elements.editorModeOptions.forEach(option => {
                option.addEventListener('change', (e) => this.setEditorMode(e.target.value));
            });
        }

        // Listen for messages from the editor iframe
        window.addEventListener('message', (e) => this.handleEditorMessage(e));
    }

    selectUploadType(type) {
        this.selectedUploadType = type;

        // Update UI
        document.querySelectorAll('.upload-type').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Update supported formats text
        this.elements.supportedFormats.textContent = `Supported: ${this.supportedFormats[type]}`;

        // Update file input accept attribute
        const acceptMap = {
            document: '.docx,.doc,.odt,.rtf,.txt',
            spreadsheet: '.xlsx,.xls,.ods,.csv',
            presentation: '.pptx,.ppt,.odp'
        };
        this.elements.fileInput.accept = acceptMap[type];
    }

    setFilter(filter) {
        this.currentFilter = filter;

        // Update tab UI
        this.elements.filterTabs.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });

        // Filter and render documents
        this.filterDocuments();
        this.renderDocumentList();
    }

    filterDocuments() {
        if (this.currentFilter === 'all') {
            this.filteredDocuments = [...this.documents];
        } else {
            this.filteredDocuments = this.documents.filter(doc => {
                const docType = this.getDocumentType(doc.name);
                return docType === this.currentFilter;
            });
        }
    }

    /**
     * Check connection to the TeamSync Editor backend
     */
    async checkConnection() {
        this.updateConnectionStatus('connecting');

        try {
            const response = await fetch(`${this.config.apiBaseUrl}/health`);
            const health = await response.json();

            // Store service statuses
            this.serviceStatus = health.services || {};

            // Update product status cards
            this.updateProductStatusCards();

            // Update service indicators in sidebar
            this.updateServiceIndicators();

            if (health.status === 'healthy') {
                this.isConnected = true;
                this.updateConnectionStatus('connected', health);
            } else if (health.status === 'partial') {
                this.isConnected = true;
                this.updateConnectionStatus('partial', health);
            } else {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', health);
            }
        } catch (error) {
            console.error('Health check failed:', error);
            this.isConnected = false;
            this.serviceStatus = {
                'teamsync-document': 'not reachable',
                'teamsync-sheets': 'not reachable',
                'teamsync-presentation': 'not reachable'
            };
            this.updateProductStatusCards();
            this.updateServiceIndicators();
            this.updateConnectionStatus('disconnected');
        }
    }

    updateProductStatusCards() {
        const statusMap = {
            'teamsync-document': this.elements.statusDocument,
            'teamsync-sheets': this.elements.statusSheets,
            'teamsync-presentation': this.elements.statusPresentation
        };

        Object.entries(statusMap).forEach(([service, element]) => {
            if (!element) return;

            const status = this.serviceStatus[service];
            element.className = 'product-status';

            if (status === 'healthy') {
                element.classList.add('healthy');
                element.textContent = 'Ready';
            } else if (status === 'checking' || !status) {
                element.classList.add('checking');
                element.textContent = 'Checking...';
            } else {
                element.classList.add('unhealthy');
                element.textContent = 'Offline';
            }
        });
    }

    updateServiceIndicators() {
        const container = this.elements.serviceIndicators;
        if (!container) return;

        if (this.editorMode === 'teamsync-unified') {
            // Show single TeamSync Editor indicator
            const status = this.serviceStatus['teamsync-editor'];
            const healthClass = status === 'healthy' ? 'healthy' : 'unhealthy';
            container.innerHTML = `<span class="service-indicator unified ${healthClass}" title="teamsync-editor: ${status}">TeamSync</span>`;
        } else if (this.editorMode === 'collabora') {
            // Show Collabora indicator
            const status = this.serviceStatus['collabora'];
            const healthClass = status === 'healthy' ? 'healthy' : 'unhealthy';
            container.innerHTML = `<span class="service-indicator collabora ${healthClass}" title="collabora: ${status}">Collabora</span>`;
        } else if (this.editorMode === 'document-source') {
            // Show Document Source indicator
            const status = this.serviceStatus['document-source'];
            const healthClass = status === 'healthy' ? 'healthy' : 'unhealthy';
            container.innerHTML = `<span class="service-indicator document-source ${healthClass}" title="document-source: ${status}">Doc Source</span>`;
        } else {
            // Show multi-app indicators
            const services = [
                { key: 'teamsync-document', label: 'Doc', class: 'document' },
                { key: 'teamsync-sheets', label: 'Sheet', class: 'sheets' },
                { key: 'teamsync-presentation', label: 'Slide', class: 'presentation' }
            ];

            container.innerHTML = services.map(service => {
                const status = this.serviceStatus[service.key];
                const healthClass = status === 'healthy' ? 'healthy' : 'unhealthy';
                return `<span class="service-indicator ${service.class} ${healthClass}" title="${service.key}: ${status}">${service.label}</span>`;
            }).join('');
        }
    }

    updateConnectionStatus(status, health = null) {
        const el = this.elements.connectionStatus;
        el.className = 'status-badge';

        // Build tooltip with service details
        let tooltip = '';
        if (health?.services) {
            tooltip = Object.entries(health.services)
                .map(([name, status]) => `${name}: ${status}`)
                .join('\n');
        }

        switch (status) {
            case 'connected':
                el.classList.add('status-connected');
                el.textContent = 'All Services Connected';
                el.title = tooltip;
                break;
            case 'partial':
                el.classList.add('status-partial');
                el.textContent = 'Partial Connection';
                el.title = tooltip;
                break;
            case 'connecting':
                el.classList.add('status-connecting');
                el.textContent = 'Connecting...';
                break;
            default:
                el.classList.add('status-disconnected');
                el.textContent = 'Disconnected';
                el.title = tooltip;
        }
    }

    /**
     * Load the list of available documents
     */
    async loadDocuments() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/documents`);

            if (!response.ok) {
                throw new Error('Failed to load documents');
            }

            this.documents = await response.json();
            this.filterDocuments();
            this.renderDocumentList();
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.elements.loadingDocs.textContent = 'Failed to load documents';
            this.showError('Failed to load document list. Please check your connection.');
        }
    }

    renderDocumentList() {
        this.elements.loadingDocs.classList.add('hidden');

        if (this.filteredDocuments.length === 0) {
            const filterText = this.currentFilter === 'all' ? '' : ` (${this.getFilterLabel(this.currentFilter)})`;
            this.elements.documentList.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="8" y="4" width="32" height="40" rx="4" stroke="currentColor" stroke-width="2"/>
                        <path d="M16 16h16M16 24h12M16 32h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h4>No documents${filterText}</h4>
                    <p>Upload a document to get started</p>
                </div>
            `;
            return;
        }

        this.elements.documentList.innerHTML = this.filteredDocuments.map(doc => {
            const docType = this.getDocumentType(doc.name);
            const productInfo = this.getProductInfo(docType);
            const isAvailable = this.isServiceAvailable(docType);
            const disabledClass = isAvailable ? '' : 'disabled';
            const activeClass = this.currentDocument?.id === doc.id ? 'active' : '';

            return `
                <div class="document-item ${activeClass} ${disabledClass}"
                     data-id="${doc.id}"
                     title="${isAvailable ? 'Click to open' : 'Service unavailable'}">
                    <div class="document-icon ${docType}">
                        ${this.getDocumentIcon(doc.name)}
                    </div>
                    <div class="document-info">
                        <div class="document-name" title="${doc.name}">${doc.name}</div>
                        <div class="document-meta">
                            <span class="product-label ${productInfo.class}">${productInfo.label}</span>
                            <span>${this.formatFileSize(doc.size)}</span>
                            ${!isAvailable ? '<span class="document-status unavailable">Offline</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        this.elements.documentList.querySelectorAll('.document-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', () => {
                const docId = item.dataset.id;
                const doc = this.documents.find(d => d.id === docId);
                if (doc) {
                    this.openDocument(doc);
                }
            });
        });
    }

    getFilterLabel(filter) {
        const labels = {
            docx: 'Documents',
            xlsx: 'Spreadsheets',
            pptx: 'Presentations'
        };
        return labels[filter] || filter;
    }

    getDocumentType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (this.fileTypeMap.document.includes(ext)) return 'docx';
        if (this.fileTypeMap.spreadsheet.includes(ext)) return 'xlsx';
        if (this.fileTypeMap.presentation.includes(ext)) return 'pptx';
        return 'docx';
    }

    getProductInfo(docType) {
        const info = {
            docx: { label: 'Document', class: 'document', service: 'teamsync-document' },
            xlsx: { label: 'Sheets', class: 'sheets', service: 'teamsync-sheets' },
            pptx: { label: 'Presentation', class: 'presentation', service: 'teamsync-presentation' }
        };
        return info[docType] || info.docx;
    }

    isServiceAvailable(docType) {
        if (this.editorMode === 'teamsync-unified') {
            // In TeamSync unified mode, all file types use the same editor service
            return this.serviceStatus['teamsync-editor'] === 'healthy';
        } else if (this.editorMode === 'collabora') {
            // In Collabora mode, use the official Collabora service
            return this.serviceStatus['collabora'] === 'healthy';
        } else if (this.editorMode === 'document-source') {
            // In Document Source mode, use the teamsync-document-source service
            return this.serviceStatus['document-source'] === 'healthy';
        }
        // In multi-editor mode, check the specific service for this document type
        const productInfo = this.getProductInfo(docType);
        return this.serviceStatus[productInfo.service] === 'healthy';
    }

    getDocumentIcon(filename) {
        const type = this.getDocumentType(filename);
        switch (type) {
            case 'docx':
                return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 2h8l4 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                </svg>`;
            case 'xlsx':
                return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <rect x="2" y="3" width="16" height="14" rx="1"/>
                    <path d="M2 8h16M8 8v9" stroke="white" stroke-width="1"/>
                </svg>`;
            case 'pptx':
                return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <rect x="2" y="4" width="16" height="11" rx="1"/>
                    <path d="M8 18h4M10 15v3" stroke="currentColor" stroke-width="1" fill="none"/>
                </svg>`;
            default:
                return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 2h8l4 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                </svg>`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Open a document in the editor
     */
    async openDocument(doc) {
        const openStartTime = performance.now();
        const docType = this.getDocumentType(doc.name);
        console.log(`[DEBUG] Opening document: ${doc.name} (${docType})`);

        if (!this.isServiceAvailable(docType)) {
            const productInfo = this.getProductInfo(docType);
            this.showError(`${productInfo.label} service is currently unavailable. Please try again later.`);
            return;
        }

        try {
            // Update UI to show loading state
            this.currentDocument = doc;
            this.filterDocuments();
            this.renderDocumentList();
            this.elements.currentDoc.textContent = `Editing: ${doc.name}`;

            // Get WOPI access token and iframe URL from the backend
            // Always request fresh token with cache-busting
            console.log(`[DEBUG] Requesting fresh token for ${doc.id} (mode=${this.editorMode})...`);
            const tokenStartTime = performance.now();
            const response = await fetch(`${this.config.apiBaseUrl}/documents/${doc.id}/token?_t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                },
                body: JSON.stringify({
                    permissions: 'edit',
                    editorMode: this.editorMode
                }),
                cache: 'no-store'
            });
            const tokenElapsed = (performance.now() - tokenStartTime).toFixed(0);
            console.log(`[DEBUG] Token request completed in ${tokenElapsed}ms`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to get editor token');
            }

            const { iframeSrc, accessToken, accessTokenTtl, documentType } = await response.json();
            console.log(`[DEBUG] Token received, documentType: ${documentType}`);

            this.currentToken = {
                token: accessToken,
                expiresAt: Date.now() + accessTokenTtl
            };

            // Update editor header
            const productInfo = this.getProductInfo(docType);
            this.elements.editorProductBadge.textContent = productInfo.label;
            this.elements.editorProductBadge.className = `editor-product-badge ${productInfo.class}`;
            this.elements.editorDocName.textContent = doc.name;

            // Show editor UI
            this.elements.editorPlaceholder.classList.add('hidden');
            this.elements.editorHeader.classList.remove('hidden');
            this.elements.editorFrame.classList.remove('hidden');

            console.log(`[DEBUG] Setting iframe src...`);
            const iframeStartTime = performance.now();

            // Set up onload handler to send PostMessage ready notification
            this.elements.editorFrame.onload = () => {
                const iframeLoadTime = (performance.now() - iframeStartTime).toFixed(0);
                console.log(`[DEBUG] Iframe loaded in ${iframeLoadTime}ms, sending Host_PostmessageReady`);

                // Notify the editor that we're ready to receive PostMessage calls
                // This resolves the "Integrator is not ready for PostMessage calls" audit warning
                try {
                    this.elements.editorFrame.contentWindow.postMessage(
                        JSON.stringify({
                            MessageId: 'Host_PostmessageReady'
                        }),
                        '*'
                    );
                    console.log(`[DEBUG] Host_PostmessageReady sent to editor`);
                } catch (e) {
                    console.warn(`[DEBUG] Could not send PostMessage to iframe:`, e.message);
                }
            };

            this.elements.editorFrame.src = iframeSrc;

            const totalElapsed = (performance.now() - openStartTime).toFixed(0);
            console.log(`[DEBUG] Document open initiated in ${totalElapsed}ms (iframe loading now...)`);
            console.log(`[DEBUG] Iframe URL: ${iframeSrc.substring(0, 100)}...`);

            console.log(`Document opened: ${doc.name} (${documentType})`);

        } catch (error) {
            console.error('Failed to open document:', error);
            this.showError(`Failed to open document: ${error.message}`);
            this.currentDocument = null;
            this.filterDocuments();
            this.renderDocumentList();
        }
    }

    /**
     * Handle messages from the Collabora Online editor iframe
     */
    handleEditorMessage(event) {
        const data = event.data;

        if (typeof data === 'string') {
            try {
                const message = JSON.parse(data);
                this.processEditorMessage(message);
            } catch (e) {
                // Not a JSON message, ignore
            }
        } else if (typeof data === 'object') {
            this.processEditorMessage(data);
        }
    }

    processEditorMessage(message) {
        const timestamp = new Date().toISOString().substr(11, 12);
        switch (message.MessageId) {
            case 'App_LoadingStatus':
                console.log(`[DEBUG ${timestamp}] Editor loading status: ${message.Values?.Status}`);
                if (message.Values?.Status === 'Document_Loaded') {
                    console.log(`[DEBUG ${timestamp}] ✓ DOCUMENT FULLY LOADED`);
                }
                break;
            case 'Doc_ModifiedStatus':
                console.log(`[DEBUG ${timestamp}] Document modified: ${message.Values?.Modified}`);
                break;
            case 'UI_Close':
                console.log(`[DEBUG ${timestamp}] Editor closed`);
                this.closeDocument();
                break;
            case 'Action_Save':
                console.log(`[DEBUG ${timestamp}] Document saved`);
                this.showSuccess('Document saved successfully');
                break;
            case 'UI_Ready':
                console.log(`[DEBUG ${timestamp}] ✓ UI Ready`);
                break;
            default:
                if (message.MessageId) {
                    console.log(`[DEBUG ${timestamp}] Editor message: ${message.MessageId}`, message.Values);
                }
        }
    }

    /**
     * Close the current document
     */
    closeDocument() {
        this.currentDocument = null;
        this.currentToken = null;
        this.elements.editorFrame.src = '';
        this.elements.editorFrame.classList.add('hidden');
        this.elements.editorHeader.classList.add('hidden');
        this.elements.editorPlaceholder.classList.remove('hidden');
        this.elements.currentDoc.textContent = '';
        this.filterDocuments();
        this.renderDocumentList();
    }

    /**
     * Show the upload modal
     */
    showUploadModal() {
        this.elements.uploadModal.classList.remove('hidden');
        // Reset to document type
        this.selectUploadType('document');
    }

    hideUploadModal() {
        this.elements.uploadModal.classList.add('hidden');
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.uploadFile(file);
        }
        // Reset input
        event.target.value = '';
    }

    /**
     * Upload a document to the server
     */
    async uploadFile(file) {
        // Validate file type
        const allValidExtensions = [
            ...this.fileTypeMap.document,
            ...this.fileTypeMap.spreadsheet,
            ...this.fileTypeMap.presentation
        ];
        const ext = file.name.split('.').pop().toLowerCase();

        if (!allValidExtensions.includes(ext)) {
            this.showError(`Unsupported file type. Please upload a supported file format.`);
            return;
        }

        // Determine file type and check service availability
        const docType = this.getDocumentType(file.name);
        if (!this.isServiceAvailable(docType)) {
            const productInfo = this.getProductInfo(docType);
            this.showError(`Cannot upload: ${productInfo.label} service is currently unavailable.`);
            return;
        }

        this.hideUploadModal();

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.config.apiBaseUrl}/documents/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Upload failed');
            }

            const newDoc = await response.json();
            console.log('Document uploaded:', newDoc);

            this.showSuccess(`${file.name} uploaded successfully!`);

            // Refresh document list and open the new document
            await this.loadDocuments();
            this.openDocument(newDoc);

        } catch (error) {
            console.error('Upload failed:', error);
            this.showError(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Show an error toast
     */
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorToast.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        this.elements.errorToast.classList.add('hidden');
    }

    /**
     * Show a success toast
     */
    showSuccess(message) {
        if (!this.elements.successToast) return;

        this.elements.successMessage.textContent = message;
        this.elements.successToast.classList.remove('hidden');

        // Auto-hide after 3 seconds
        setTimeout(() => this.hideSuccess(), 3000);
    }

    hideSuccess() {
        if (this.elements.successToast) {
            this.elements.successToast.classList.add('hidden');
        }
    }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TeamSyncApp();
});
