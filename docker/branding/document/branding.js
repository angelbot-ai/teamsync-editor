/* =============================================================================
 * TeamSync Document - Runtime Branding JavaScript
 * Word processing variant
 *
 * License Compliance:
 * - This software is based on Collabora Online, licensed under MPL 2.0
 * - Per Collabora's Trademark Policy, their trademarks have been removed from UI
 * - Source code available at: https://github.com/angelbot-ai-pvt-ltd/teamsync-editor
 * ============================================================================= */

(function() {
    'use strict';

    // Brand configuration
    var BRAND_NAME = 'TeamSync Document';
    var BRAND_SHORT = 'TeamSync';
    var BRAND_URL = 'https://teamsync.dev';
    var BRAND_COLOR = '#2563eb';
    var TEAMSYNC_VERSION = '1.0.0';
    var SOURCE_URL = 'https://github.com/angelbot-ai-pvt-ltd/teamsync-editor';

    // Override product info when available
    if (typeof window !== 'undefined') {
        // Set brand name in window for components to use
        window.brandProductName = BRAND_NAME;
        window.brandProductShort = BRAND_SHORT;
        window.brandProductURL = BRAND_URL;
        window.brandProductColor = BRAND_COLOR;

        // Update document title when it contains old branding
        if (document.title && document.title.indexOf('Collabora') !== -1) {
            document.title = document.title.replace(/Collabora\s*(Online|Office)?/gi, BRAND_NAME);
        }

        // Override the about dialog content when it opens
        document.addEventListener('DOMContentLoaded', function() {
            // Watch for about dialog
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            // Check for about dialog - look for the cloned dialog content
                            if (node.querySelector) {
                                var aboutDialog = node.querySelector('#about-dialog, .about-dialog');
                                if (aboutDialog) {
                                    updateAboutDialog(aboutDialog);
                                }
                            }
                            // Also check if the node itself is the about dialog container
                            if (node.id && node.id.indexOf('about-dialog') !== -1) {
                                updateAboutDialog(node);
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    function updateAboutDialog(dialog) {
        // Update product name header
        var productName = dialog.querySelector('#product-name');
        if (productName) {
            productName.textContent = BRAND_NAME;
        }

        // Add TeamSync version section if not present
        var teamsyncVersion = dialog.querySelector('#teamsync-version');
        var coolwsdVersionLabel = dialog.querySelector('#coolwsd-version-label');

        if (!teamsyncVersion && coolwsdVersionLabel) {
            // Create TeamSync version elements
            var tsLabel = document.createElement('div');
            tsLabel.id = 'teamsync-version-label';
            tsLabel.textContent = BRAND_NAME + ' version:';

            var tsVersionDiv = document.createElement('div');
            tsVersionDiv.className = 'about-dialog-info-div';
            var tsVersion = document.createElement('div');
            tsVersion.id = 'teamsync-version';
            tsVersion.dir = 'ltr';
            tsVersion.innerHTML = TEAMSYNC_VERSION + ' (<a href="' + SOURCE_URL + '" target="_blank">source</a>)';
            tsVersionDiv.appendChild(tsVersion);

            var spacer = document.createElement('div');
            spacer.className = 'spacer';

            // Insert before COOLWSD version
            coolwsdVersionLabel.parentNode.insertBefore(tsLabel, coolwsdVersionLabel);
            coolwsdVersionLabel.parentNode.insertBefore(tsVersionDiv, coolwsdVersionLabel);
            coolwsdVersionLabel.parentNode.insertBefore(spacer, coolwsdVersionLabel);
        }

        // Update COOLWSD version label (remove Collabora branding)
        if (coolwsdVersionLabel) {
            coolwsdVersionLabel.textContent = 'COOLWSD version:';
        }

        // Update LOKit version label and content (remove Collabora branding)
        var lokitVersionLabel = dialog.querySelector('#lokit-version-label');
        if (lokitVersionLabel) {
            lokitVersionLabel.textContent = 'LOKit version:';
        }

        // Remove "Collabora Office" from LOKit version text
        var lokitVersion = dialog.querySelector('#lokit-version');
        if (lokitVersion) {
            var lokitText = lokitVersion.innerHTML || lokitVersion.textContent;
            // Replace "Collabora Office X.Y.Z" with "LibreOffice Online Kit X.Y.Z"
            lokitText = lokitText.replace(/Collabora\s*Office\s*/gi, 'LibreOffice Online Kit ');
            lokitVersion.innerHTML = lokitText;
        }

        // Update copyright text
        var copyrightElements = dialog.querySelectorAll('.about-dialog-info-div');
        copyrightElements.forEach(function(el) {
            if (el.textContent && el.textContent.indexOf('Copyright') !== -1) {
                var year = new Date().getFullYear();
                el.innerHTML = '<span dir="ltr">Copyright © ' + year + ', TeamSync.</span>';
            }
        });

        // Add license info if not present
        var licenseInfo = dialog.querySelector('#about-license-info');
        var infoContainer = dialog.querySelector('#about-dialog-info');
        if (!licenseInfo && infoContainer) {
            var licenseP = document.createElement('p');
            licenseP.className = 'about-dialog-info-div';
            licenseP.id = 'about-license-info';
            licenseP.innerHTML = '<span dir="ltr">Based on open-source technology licensed under <a href="https://www.mozilla.org/en-US/MPL/2.0/" target="_blank">MPL 2.0</a></span>';

            // Find the copyright line and insert before it
            var paragraphs = infoContainer.querySelectorAll('p.about-dialog-info-div');
            var lastP = paragraphs[paragraphs.length - 1];
            if (lastP) {
                lastP.parentNode.insertBefore(licenseP, lastP);
            }
        }

        // Hide Collabora logo if present
        var collaboraLogo = dialog.querySelector('.collabora-logo, .logo-collabora');
        if (collaboraLogo) {
            collaboraLogo.style.display = 'none';
        }
    }

    // Log branding loaded
    console.log('[TeamSync] Document branding loaded - v' + TEAMSYNC_VERSION);
})();
