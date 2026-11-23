(function () {
    var STORAGE_KEY = 'crm-sidebar-width';
    var DEFAULT_WIDTH = 250;
    var MIN_WIDTH = 180;
    var MAX_WIDTH = 450;

    var sidebar = document.querySelector('.main-sidebar');
    if (!sidebar) {
        return;
    }

    var layoutSelectors = [
        '.main-sidebar',
        '.content-wrapper',
        '.main-header',
        '.main-footer',
        '.layout-fixed .brand-link',
        '.main-sidebar .brand-link'
    ];

    var handle = document.createElement('div');
    handle.className = 'sidebar-resize-handle';
    handle.setAttribute('title', 'Drag to resize sidebar');
    handle.setAttribute('aria-hidden', 'true');
    sidebar.appendChild(handle);

    function getCurrentWidth() {
        var value = getComputedStyle(document.documentElement)
            .getPropertyValue('--crm-sidebar-width')
            .trim();
        var parsed = parseInt(value, 10);
        return isNaN(parsed) ? DEFAULT_WIDTH : parsed;
    }

    function clearInlineLayoutStyles() {
        layoutSelectors.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                el.style.removeProperty('width');
                el.style.removeProperty('margin-left');
            });
        });
    }

    function syncLayoutElements(px) {
        var collapsed = document.body.classList.contains('sidebar-collapse');
        var mobile = window.innerWidth < 768;
        var width = px + 'px';

        document.documentElement.style.setProperty('--crm-sidebar-width', width);

        if (collapsed || mobile) {
            clearInlineLayoutStyles();
            return;
        }

        document.querySelectorAll('.main-sidebar').forEach(function (el) {
            el.style.width = width;
        });
        document.querySelectorAll('.content-wrapper, .main-header, .main-footer').forEach(function (el) {
            el.style.marginLeft = width;
        });
        document.querySelectorAll('.layout-fixed .brand-link, .main-sidebar .brand-link').forEach(function (el) {
            el.style.width = width;
        });
    }

    function updateHandleVisibility() {
        var collapsed = document.body.classList.contains('sidebar-collapse');
        var mobile = window.innerWidth < 768;
        handle.style.display = (collapsed || mobile) ? 'none' : 'block';
        syncLayoutElements(getCurrentWidth());
    }

    var dragging = false;
    var startX = 0;
    var startWidth = DEFAULT_WIDTH;

    function onMouseMove(e) {
        if (!dragging) {
            return;
        }
        var newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (e.clientX - startX)));
        syncLayoutElements(newWidth);
    }

    function stopDragging() {
        if (!dragging) {
            return;
        }
        dragging = false;
        document.body.classList.remove('sidebar-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stopDragging);
        try {
            localStorage.setItem(STORAGE_KEY, String(getCurrentWidth()));
        } catch (err) {
            /* ignore storage errors */
        }
    }

    handle.addEventListener('mousedown', function (e) {
        if (document.body.classList.contains('sidebar-collapse') || window.innerWidth < 768) {
            return;
        }
        dragging = true;
        startX = e.clientX;
        startWidth = getCurrentWidth();
        document.body.classList.add('sidebar-resizing');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDragging);
        e.preventDefault();
    });

    var observer = new MutationObserver(updateHandleVisibility);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', updateHandleVisibility);
    updateHandleVisibility();
})();
