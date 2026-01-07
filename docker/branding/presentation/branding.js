/* =============================================================================
 * TeamSync Presentation - Runtime Branding JavaScript
 * Presentation variant
 * ============================================================================= */

(function() {
    'use strict';

    // Brand configuration
    var BRAND_NAME = 'TeamSync Presentation';
    var BRAND_SHORT = 'TeamSync';
    var BRAND_URL = 'https://teamsync.dev';
    var BRAND_COLOR = '#ea580c';

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
                            // Check for about dialog
                            var aboutDialog = node.querySelector ? node.querySelector('.about-dialog, #about-dialog') : null;
                            if (aboutDialog || (node.classList && node.classList.contains('about-dialog'))) {
                                updateAboutDialog(aboutDialog || node);
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    function updateAboutDialog(dialog) {
        // Update product name
        var productName = dialog.querySelector('.product-name, .about-product-name');
        if (productName) {
            productName.textContent = BRAND_NAME;
        }

        // Update powered by text
        var poweredBy = dialog.querySelector('.powered-by');
        if (poweredBy) {
            poweredBy.innerHTML = 'Powered by <a href="' + BRAND_URL + '" target="_blank">' + BRAND_SHORT + '</a>';
        }

        // Hide Collabora logo
        var collaboraLogo = dialog.querySelector('.collabora-logo, .logo-collabora');
        if (collaboraLogo) {
            collaboraLogo.style.display = 'none';
        }
    }

    // Log branding loaded
    console.log('[TeamSync] Presentation branding loaded');
})();
