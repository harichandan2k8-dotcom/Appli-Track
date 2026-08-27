/**
 * AppliTrack Main Application Logic
 */
import { db } from './db.js';
import { AnalyticsEngine } from './recommendation.js';
import { Views } from './views.js';
import { applianceTypes, brands, extractApplianceDetails, readDocument, supportUrlFor } from './smart-import.js';

// Global state
const state = {
    currentView: 'home',
    selectedApplianceId: null,
    activeRoom: 'All',
    searchQuery: '',
    charts: {
        category: null,
        timeline: null
    }
};

// HTML5 QR Code Scanner Instance
let html5QrCode = null;

// DOM mounts
const contentMount = document.getElementById('content-mount');
const headerTitle = document.getElementById('header-view-title');
const navItems = document.querySelectorAll('.nav-item');
const themeToggle = document.getElementById('theme-toggle');

// Modal Elements
const applianceModal = document.getElementById('appliance-modal');
const serviceModal = document.getElementById('service-modal');
const scanModal = document.getElementById('scan-modal');
const scannerModal = document.getElementById('scanner-modal');
const inviteModal = document.getElementById('invite-modal');
const phoneFrameMount = document.getElementById('phone-frame-mount');

// Form elements
const applianceForm = document.getElementById('appliance-form');
const serviceForm = document.getElementById('service-form');

/**
 * Initialize application
 */
async function init() {
    const splashStarted = performance.now();
    await db.init();
    initTheme();
    initImageUpload();
    initSmartImport();
    setupGlobalEventListeners();
    if (!db.isAuthenticated()) {
        showAuthScreen();
        window.setTimeout(hideWelcomeSplash, Math.max(0, 1000 - (performance.now() - splashStarted)));
        return;
    }
    updateGlobalRoleHeader();

    // Check hash for initial route, default to home
    const initialView = window.location.hash.replace('#', '') || 'home';

    // Support direct route queries like #appliance-detail?id=app-1
    if (initialView.startsWith('appliance-detail?id=')) {
        const id = initialView.split('?id=')[1];
        navigateTo('appliance-detail', id);
    } else if (initialView.startsWith('qr-portal?id=')) {
        const id = initialView.split('?id=')[1];
        navigateTo('qr-portal', id);
    } else if (['home', 'appliances', 'reminders', 'analytics', 'market', 'profile'].includes(initialView)) {
        navigateTo(initialView);
    } else {
        navigateTo('home');
    }
    const remaining = Math.max(0, 1000 - (performance.now() - splashStarted));
    window.setTimeout(hideWelcomeSplash, remaining);
}

function hideWelcomeSplash() {
    const splash = document.getElementById('welcome-splash');
    if (!splash) return;
    splash.classList.add('is-leaving');
    window.setTimeout(() => splash.remove(), 400);
}

function showAuthScreen() {
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.top-header').style.display = 'none';
    contentMount.innerHTML = Views.renderAuth();
    const message = document.getElementById('auth-message');
    if (!db.isConfigured()) message.textContent = 'This deployment is awaiting its Supabase connection.';
    document.getElementById('auth-signin-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await db.signIn({ email: document.getElementById('signin-email').value, password: document.getElementById('signin-password').value });
            window.location.hash = '#home'; window.location.reload();
        } catch (error) { message.textContent = error.message; }
    });
    document.getElementById('auth-signup-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await db.signUp({ name: document.getElementById('signup-name').value.trim(), email: document.getElementById('signup-email').value, password: document.getElementById('signup-password').value });
            message.style.color = 'var(--success)';
            message.textContent = 'Account created. Check your email to confirm it, then sign in.';
        } catch (error) { message.textContent = error.message; }
    });
}

/**
 * Theme setup (Light / Dark)
 */
function initTheme() {
    const savedTheme = localStorage.getItem('applitrack_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('applitrack_theme', newTheme);
        updateThemeIcon(newTheme);

        // Re-render charts to apply theme styling if on analytics
        if (state.currentView === 'analytics') {
            renderAnalyticsCharts();
        }
    });
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

/**
 * Image Upload & Preview Reader Setup
 */
function initImageUpload() {
    const fileInput = document.getElementById('app-image-file');
    const uploadBtn = document.getElementById('app-image-upload-btn');
    const filenameSpan = document.getElementById('app-image-filename');
    const base64Input = document.getElementById('app-image-base64');
    const previewContainer = document.getElementById('app-image-preview-container');
    const previewImg = document.getElementById('app-image-preview');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Ensure it is an image
                if (!file.type.startsWith('image/')) {
                    alert('Please select a valid image file.');
                    return;
                }

                filenameSpan.textContent = file.name;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Str = event.target.result;
                    base64Input.value = base64Str;
                    previewImg.src = base64Str;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                filenameSpan.textContent = 'No photo uploaded';
                base64Input.value = '';
                previewContainer.style.display = 'none';
                previewImg.src = '';
            }
        });
    }
}

/** Populate the guided selectors and scan manuals, warranty cards, invoices, and labels. */
function initSmartImport() {
    const typeSelect = document.getElementById('app-type');
    const brandOptions = document.getElementById('brand-options');
    const brandInput = document.getElementById('app-brand');
    const fileInput = document.getElementById('app-document-file');
    const uploadButton = document.getElementById('app-document-upload-btn');
    const status = document.getElementById('app-document-status');
    const supportLink = document.getElementById('app-support-link');
    typeSelect.insertAdjacentHTML('beforeend', applianceTypes.map(type => `<option value="${type}">${type}</option>`).join(''));
    brandOptions.innerHTML = brands.map(brand => `<option value="${brand}">`).join('');
    const updateSupportLink = () => {
        const brand = brandInput.value.trim();
        supportLink.hidden = !brand;
        if (brand) supportLink.href = supportUrlFor(brand);
    };
    brandInput.addEventListener('input', updateSupportLink);
    typeSelect.addEventListener('change', () => {
        const name = document.getElementById('app-name');
        if (typeSelect.value && !name.value.trim()) name.value = typeSelect.value;
    });
    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        const buttonLabel = uploadButton.innerHTML;
        uploadButton.disabled = true;
        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning…';
        status.textContent = 'Starting scan…';
        try {
            const text = await readDocument(file, message => { status.textContent = message; });
            const details = extractApplianceDetails(text);
            const fields = [
                ['Brand', brandInput, details.brand],
                ['Appliance type', typeSelect, details.applianceType],
                ['Model number', document.getElementById('app-model'), details.model],
                ['Serial number', document.getElementById('app-serial'), details.serialNumber],
                ['Warranty', document.getElementById('app-warranty'), details.warrantyMonths],
                ['Purchase date', document.getElementById('app-purchase-date'), details.purchaseDate]
            ];
            const added = [];
            fields.forEach(([label, input, value]) => {
                input.classList.remove('scan-filled');
                if (value && !String(input.value).trim()) {
                    input.value = value;
                    input.classList.add('scan-filled');
                    added.push(label);
                }
            });
            const name = document.getElementById('app-name');
            if (!name.value.trim() && details.applianceType) {
                name.value = details.applianceType;
                name.classList.add('scan-filled');
                added.unshift('Appliance name');
            }
            updateSupportLink();
            const found = ['brand', 'applianceType', 'model', 'serialNumber', 'warrantyMonths', 'purchaseDate'].filter(key => details[key]).length;
            status.textContent = found ? (added.length ? `Scan complete — added ${added.join(', ')}. Please review the highlighted fields before saving.` : 'Scan complete — details were found, but your existing entries were kept unchanged.') : 'Scan complete, but no appliance details were recognised. Try a closer, well-lit photo of the brand and model label.';
        } catch (error) {
            status.textContent = `Could not scan this file: ${error.message}`;
        } finally {
            uploadButton.disabled = false;
            uploadButton.innerHTML = buttonLabel;
            fileInput.value = '';
        }
    });
}

/**
 * Update the global header simulated access role indicator
 */
function updateGlobalRoleHeader() {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;
    const roleNameEl = document.getElementById('global-role-name');
    const roleIndicatorEl = document.getElementById('global-role-indicator');
    const avatarEl = document.getElementById('header-user-avatar');

    if (roleNameEl && roleIndicatorEl) {
        roleNameEl.textContent = currentUser.role;
        roleIndicatorEl.className = 'badge';

        // Dynamic badge style matching current simulated user role
        if (currentUser.role === 'Owner') {
            roleIndicatorEl.classList.add('status-success');
            roleIndicatorEl.style.background = '';
        } else if (currentUser.role === 'Editor') {
            roleIndicatorEl.classList.add('status-warning');
            roleIndicatorEl.style.background = '';
        } else {
            roleIndicatorEl.classList.add('status-success');
            roleIndicatorEl.style.background = 'rgba(255, 255, 255, 0.05)';
        }
    }

    if (avatarEl) {
        avatarEl.innerHTML = currentUser.profilePic
            ? `<img src="${currentUser.profilePic}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<i class="fas fa-user" style="color: white;"></i>`;
    }
}

/**
 * Setup general event listeners (Modal closers, hash routers)
 */
function setupGlobalEventListeners() {
    // Nav bar routing
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetView = item.getAttribute('data-view');
            navigateTo(targetView);
        });
    });

    // Close modals on clicking X or cancel
    document.getElementById('appliance-modal-close').addEventListener('click', () => closeModal(applianceModal));
    document.getElementById('appliance-form-cancel').addEventListener('click', () => closeModal(applianceModal));

    document.getElementById('service-modal-close').addEventListener('click', () => closeModal(serviceModal));
    document.getElementById('service-form-cancel').addEventListener('click', () => closeModal(serviceModal));

    document.getElementById('scan-modal-close').addEventListener('click', () => closeModal(scanModal));

    // Invite modal close
    document.getElementById('invite-modal-close').addEventListener('click', () => closeModal(inviteModal));
    document.getElementById('invite-form-cancel').addEventListener('click', () => closeModal(inviteModal));

    // Invite form submission
    document.getElementById('invite-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('invite-name').value.trim();
        const email = document.getElementById('invite-email').value.trim();
        const btn = document.getElementById('invite-form-submit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        try {
            await db.inviteHouseholdMember(name, email);
            closeModal(inviteModal);
            e.target.reset();
            renderActiveView();
            alert('Invitation added. It will appear as Pending until that person signs up with this exact email address.');
        } catch (err) {
            alert('Could not send invite: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Send Invitation';
        }
    });

    // Scanner Modal listeners
    document.getElementById('scanner-modal-close').addEventListener('click', () => closeScannerModal());
    document.getElementById('scanner-tab-camera').addEventListener('click', () => switchScannerTab('camera'));
    document.getElementById('scanner-tab-simulate').addEventListener('click', () => switchScannerTab('simulate'));

    document.getElementById('scanner-simulate-submit').addEventListener('click', () => {
        const selectedId = document.getElementById('scanner-simulate-select').value;
        if (selectedId) {
            closeScannerModal();
            navigateTo('qr-portal', selectedId);
        }
    });

    // Handle Forms Submission
    applianceForm.addEventListener('submit', handleApplianceFormSubmit);
    serviceForm.addEventListener('submit', handleServiceFormSubmit);
}

/**
 * Page Navigation Controller
 */
function navigateTo(view, id = null) {
    state.currentView = view;
    state.selectedApplianceId = id;

    // Set URL Hash without triggering separate render loop
    if (view === 'appliance-detail') {
        window.location.hash = `#appliance-detail?id=${id}`;
    } else if (view === 'qr-portal') {
        window.location.hash = `#qr-portal?id=${id}`;
    } else {
        window.location.hash = `#${view}`;
    }

    // Update active nav class
    navItems.forEach(item => {
        if (item.getAttribute('data-view') === view) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Set page header title
    const formattedTitle = view.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    headerTitle.textContent = formattedTitle;

    renderActiveView();
}

/**
 * Main View Renderer (orchestrates HTML painting & dynamic attachment)
 */
function renderActiveView() {
    // Clear previous charts references
    if (state.charts.category) { state.charts.category.destroy(); state.charts.category = null; }
    if (state.charts.timeline) { state.charts.timeline.destroy(); state.charts.timeline = null; }

    switch (state.currentView) {
        case 'home':
            contentMount.innerHTML = Views.renderHome(state);
            setupHomeEvents();
            break;

        case 'appliances':
            contentMount.innerHTML = Views.renderAppliances(state);
            setupAppliancesEvents();
            break;

        case 'appliance-detail':
            const app = db.getApplianceById(state.selectedApplianceId);
            if (app) {
                contentMount.innerHTML = Views.renderApplianceDetail(state.selectedApplianceId, state);
                renderApplianceQRCode(app);
                setupDetailEvents();
            } else {
                navigateTo('appliances');
            }
            break;

        case 'reminders':
            contentMount.innerHTML = Views.renderReminders(state);
            setupRemindersEvents();
            break;

        case 'analytics':
            contentMount.innerHTML = Views.renderAnalytics(state);
            renderAnalyticsCharts();
            setupAnalyticsViewEvents();
            break;

        case 'profile':
            contentMount.innerHTML = Views.renderProfile(state);
            setupProfileEvents();
            break;

        case 'qr-portal':
            contentMount.innerHTML = Views.renderQRPortal(state.selectedApplianceId, state);
            setupQRPortalEvents();
            break;

        default:
            contentMount.innerHTML = `<p>Page Not Found</p>`;
    }
}

/**
 * Render Chart.js dynamic analytics components
 */
function renderAnalyticsCharts() {
    const categoryCtx = document.getElementById('categoryChart');
    const timelineCtx = document.getElementById('timelineChart');

    if (!categoryCtx || !timelineCtx) return;

    const appliances = db.getAppliances();
    const services = db.getServices();
    const stats = AnalyticsEngine.getFinancialAggregates(appliances, services);

    // Dynamic color configs matching active dark/light variables
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#b6d6de' : '#315667';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    // 1. Category/Room Spent Chart
    const roomLabels = Object.keys(stats.spendByRoom);
    const roomData = Object.values(stats.spendByRoom);

    if (roomLabels.length === 0) {
        roomLabels.push('No Maintenance Recorded');
        roomData.push(1);
    }

    state.charts.category = new Chart(categoryCtx, {
        type: 'bar',
        data: {
            labels: roomLabels,
            datasets: [{
                data: roomData,
                label: 'Service spend (₹)',
                backgroundColor: '#1bc4c7',
                borderRadius: 8,
                borderWidth: 0,
                maxBarThickness: 34
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: context => ` ₹${Number(context.raw).toLocaleString('en-IN')}` } }
            },
            scales: {
                y: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: 600 } } },
                x: { grid: { color: gridColor }, ticks: { color: textColor, callback: value => `₹${Number(value).toLocaleString('en-IN')}` } }
            }
        }
    });

    // 2. Yearly Spend Line/Bar Chart
    const years = Object.keys(stats.spendByYear).sort();
    const yearSpend = years.map(y => stats.spendByYear[y]);

    state.charts.timeline = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: years.length > 0 ? years : ['2023', '2024', '2025', '2026'],
            datasets: [{
                label: 'Maintenance spend (₹)',
                data: years.length > 0 ? yearSpend : [0, 0, 0, 0],
                backgroundColor: 'rgba(125, 92, 255, 0.16)',
                borderColor: '#9d7cff',
                borderWidth: 3,
                pointBackgroundColor: '#ffb86b',
                pointBorderColor: '#ffffff',
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' }, callback: value => `₹${Number(value).toLocaleString('en-IN')}` }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/**
 * Generate Physical QR code labels
 */
function renderApplianceQRCode(appliance) {
    const target = document.getElementById('appliance-qr-target');
    if (!target) return;

    target.innerHTML = '';

    // Create local simulated scanner link
    const qrLink = `${window.location.origin}${window.location.pathname}#qr-portal?id=${appliance.id}`;

    // Instantiate QRCode.js
    new QRCode(target, {
        text: qrLink,
        width: 140,
        height: 140,
        colorDark: "#111827",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

/**
 * Event bindings for Home View (previously Dashboard)
 */
function setupHomeEvents() {
    const addBtn = document.getElementById('home-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openApplianceModal());
    }

    const scanBtn = document.getElementById('home-scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            openScannerModal();
        });
    }

    // Attach click triggers to details buttons inside alerts
    const viewDetailBtns = contentMount.querySelectorAll('.nav-action-btn');
    viewDetailBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            const id = btn.getAttribute('data-id');
            navigateTo(view, id);
        });
    });
}

/**
 * Live QR Camera Scanner Controls
 */
function openScannerModal() {
    openModal(scannerModal);

    // Fill the simulated select dropdown with current database registry
    const simulateSelect = document.getElementById('scanner-simulate-select');
    const appliances = db.getAppliances();
    if (simulateSelect) {
        simulateSelect.innerHTML = appliances.map(app => `
            <option value="${app.id}">${app.name} (${app.brand})</option>
        `).join('');
    }

    // Open Live Camera Tab by default
    switchScannerTab('camera');
}

function closeScannerModal() {
    closeModal(scannerModal);
    stopCameraScanner();
}

function switchScannerTab(tab) {
    const camTab = document.getElementById('scanner-tab-camera');
    const simTab = document.getElementById('scanner-tab-simulate');
    const camContainer = document.getElementById('scanner-camera-container');
    const simContainer = document.getElementById('scanner-simulate-container');

    if (tab === 'camera') {
        camTab.classList.add('active');
        simTab.classList.remove('active');
        camContainer.style.display = 'block';
        simContainer.style.display = 'none';
        startCameraScanner();
    } else {
        simTab.classList.add('active');
        camTab.classList.remove('active');
        simContainer.style.display = 'block';
        camContainer.style.display = 'none';
        stopCameraScanner();
    }
}

function startCameraScanner() {
    stopCameraScanner();
    document.getElementById('scanner-camera-error').style.display = 'none';

    try {
        // Instantiate html5-qrcode library
        html5QrCode = new Html5Qrcode("scanner-reader");
        const config = { fps: 15, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // Scanned QR code successfully!
                stopCameraScanner();
                closeModal(scannerModal);

                // Parse standard URL query hashes
                if (decodedText.includes('#qr-portal?id=')) {
                    const id = decodedText.split('#qr-portal?id=')[1];
                    navigateTo('qr-portal', id);
                } else if (decodedText.includes('#appliance-detail?id=')) {
                    const id = decodedText.split('#appliance-detail?id=')[1];
                    navigateTo('appliance-detail', id);
                } else {
                    alert(`QR Content Scanned: ${decodedText}`);
                }
            },
            () => {
                // Verbose scanner search frames - suppressed to avoid noise
            }
        ).catch(err => {
            console.warn("Camera start blocked / failed:", err);
            document.getElementById('scanner-camera-error').style.display = 'block';
        });
    } catch (e) {
        console.error("Camera init crash:", e);
        document.getElementById('scanner-camera-error').style.display = 'block';
    }
}

function stopCameraScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode = null;
        }).catch(err => {
            console.error("Error closing camera stream:", err);
        });
    }
}

/**
 * Event bindings for Appliances View (previously Inventory)
 */
function setupAppliancesEvents() {
    const addBtn = document.getElementById('appliances-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openApplianceModal());
    }

    // Filter room tabs
    const tabs = contentMount.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            state.activeRoom = tab.getAttribute('data-room');
            renderActiveView();
        });
    });

    // Search query listeners
    const searchInput = document.getElementById('appliances-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            clearTimeout(state.searchDebounce);
            state.searchDebounce = setTimeout(() => {
                renderActiveView();
                const freshSearch = document.getElementById('appliances-search');
                if (freshSearch) {
                    freshSearch.focus();
                    freshSearch.setSelectionRange(freshSearch.value.length, freshSearch.value.length);
                }
            }, 250);
        });
    }

    // Card click navigate to detail
    const cards = contentMount.querySelectorAll('.appliance-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            navigateTo('appliance-detail', id);
        });
    });
}

/**
 * Event bindings for Details View
 */
function setupDetailEvents() {
    // Return navigation link
    const backBtn = contentMount.querySelector('.back-link');
    if (backBtn) {
        backBtn.addEventListener('click', () => navigateTo('appliances'));
    }

    // Edit Appliance Details
    const editBtn = document.getElementById('detail-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const id = editBtn.getAttribute('data-id');
            const app = db.getApplianceById(id);
            if (app) openApplianceModal(app);
        });
    }

    // Delete Appliance Node
    const deleteBtn = document.getElementById('detail-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const id = deleteBtn.getAttribute('data-id');
            if (confirm('Warning! Deleting this appliance will permanently purge all specification files and associated service log histories. Continue?')) {
                db.deleteAppliance(id);
                navigateTo('appliances');
            }
        });
    }

    // Log Maintenance Service
    const addServiceBtn = document.getElementById('detail-add-service-btn');
    if (addServiceBtn) {
        addServiceBtn.addEventListener('click', () => {
            const id = addServiceBtn.getAttribute('data-id');
            openServiceModal(id);
        });
    }

    // Open the manufacturer's official booking page and put the device details on the clipboard.
    // Provider portals choose their own date/time UI, so those choices stay with the customer.
    const bookServiceBtn = document.getElementById('detail-book-service-btn');
    if (bookServiceBtn) {
        bookServiceBtn.addEventListener('click', async () => {
            const appliance = db.getApplianceById(bookServiceBtn.getAttribute('data-id'));
            if (!appliance) return;
            const user = db.getCurrentUser();
            const summary = [
                'AppliTrack service request',
                `Customer: ${user?.name || ''}`,
                `Email: ${user?.email || ''}`,
                `Appliance: ${appliance.name}`,
                `Brand: ${appliance.brand}`,
                `Model: ${appliance.model}`,
                `Serial number: ${appliance.serialNumber || 'Not available'}`,
                `Purchase date: ${appliance.purchaseDate}`,
                `Warranty: ${appliance.warrantyMonths} months`,
                `Location: ${appliance.room}`,
                appliance.notes ? `Notes: ${appliance.notes}` : ''
            ].filter(Boolean).join('\n');
            window.open(supportUrlFor(appliance.brand), '_blank', 'noopener');
            try {
                await navigator.clipboard.writeText(summary);
                alert('The official support website has opened. Your appliance details were copied—paste them into the booking form, then choose your preferred date and time.');
            } catch (error) {
                alert('The official support website has opened. Enter the appliance details there, then choose your preferred date and time.');
            }
        });
    }

    // Individual log delete button
    const deleteLogBtns = contentMount.querySelectorAll('.log-delete-btn');
    deleteLogBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const logId = btn.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this maintenance record?')) {
                db.deleteService(logId);
                renderActiveView();
            }
        });
    });

    // QR Simulated scan popup
    const scanSimulateBtn = document.getElementById('qr-simulate-btn');
    if (scanSimulateBtn) {
        scanSimulateBtn.addEventListener('click', () => {
            phoneFrameMount.innerHTML = Views.renderQRPortal(state.selectedApplianceId, state);
            openModal(scanModal);

            document.getElementById('portal-exit-btn').addEventListener('click', () => {
                closeModal(scanModal);
            });
        });
    }

    // QR Print capability
    const printBtn = document.getElementById('qr-print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            const printWindow = window.open('', '_blank');
            const qrCanvas = document.querySelector('#appliance-qr-target canvas');
            const app = db.getApplianceById(state.selectedApplianceId);

            if (qrCanvas && app) {
                const qrImageURL = qrCanvas.toDataURL("image/png");
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>AppliTrack QR Label - ${app.name}</title>
                        <style>
                            body { font-family: sans-serif; text-align: center; padding: 40px; }
                            .label-container { border: 2px dashed #000; padding: 24px; display: inline-block; border-radius: 12px; }
                            h2 { margin: 0 0 4px; font-size: 20px; }
                            p { margin: 0 0 16px; font-size: 13px; color: #555; }
                            img { width: 150px; height: 150px; }
                        </style>
                    </head>
                    <body onload="window.print(); window.close();">
                        <div class="label-container">
                            <h2>${app.name}</h2>
                            <p>${app.brand} | Model: ${app.model}</p>
                            <img src="${qrImageURL}" />
                            <div style="margin-top: 10px; font-size: 11px; font-weight: bold; color: #888;">SCAN FOR MAINTENANCE HISTORY</div>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }
        });
    }
}

/**
 * Event bindings for Reminders View (previously Service logs View)
 */
function setupRemindersEvents() {
    const addBtn = document.getElementById('reminders-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openServiceModal());
    }

    // Appliance links in table
    const links = contentMount.querySelectorAll('.table-appliance-link');
    links.forEach(link => {
        link.addEventListener('click', () => {
            const id = link.getAttribute('data-id');
            navigateTo('appliance-detail', id);
        });
    });

    // Delete buttons in table
    const deleteBtns = contentMount.querySelectorAll('.table-delete-srv-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const srvId = btn.getAttribute('data-id');
            if (confirm('Delete this maintenance record?')) {
                db.deleteService(srvId);
                renderActiveView();
            }
        });
    });

    // General navigation action buttons within cards
    const viewDetailBtns = contentMount.querySelectorAll('.nav-action-btn');
    viewDetailBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            const id = btn.getAttribute('data-id');
            navigateTo(view, id);
        });
    });
}

/**
 * Event bindings for Analytics View
 */
function setupAnalyticsViewEvents() {
    const viewDetailBtns = contentMount.querySelectorAll('.nav-action-btn');
    viewDetailBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            const id = btn.getAttribute('data-id');
            navigateTo(view, id);
        });
    });
}

/**
 * Event bindings for Profile View (previously Sharing Access View)
 */
function setupProfileEvents() {
    const signoutBtn = document.getElementById('profile-signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async () => {
            await db.signOut();
            window.location.hash = '';
            window.location.reload();
        });

    }
    // 1. Role switcher dropdown inside Profile card
    const profileSelect = document.getElementById('profile-user-select');
    if (profileSelect) {
        profileSelect.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            const members = db.getFamilyMembers();
            const targetMember = members.find(m => m.id === selectedId);
            if (targetMember) {
                db.setCurrentUser(targetMember);
                updateGlobalRoleHeader();
                renderActiveView(); // Refresh page to apply permission filters
            }
        });
    }

    // 2. Database wipe button
    const resetBtn = document.getElementById('profile-reset-db-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the database to default seed files? All custom added appliances and logs will be deleted.')) {
                db.resetDatabase();
                updateGlobalRoleHeader();
                renderActiveView();
            }
        });
    }

    // 3. Open Invite Modal button
    const openInviteBtn = document.getElementById('open-invite-btn');
    if (openInviteBtn) {
        openInviteBtn.addEventListener('click', () => {
            if (!db.isAdmin()) {
                alert('Access Denied. Only the household Owner can invite members.');
                return;
            }
            openModal(inviteModal);
        });
    }

    // 4. Remove household member buttons
    const deleteBtns = contentMount.querySelectorAll('.family-delete-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!db.isAdmin()) {
                alert('Access Denied. Only Owner roles can remove members.');
                return;
            }
            const id = btn.getAttribute('data-id');
            if (confirm('Remove this family member from the household? They will lose access to all shared appliances.')) {
                try {
                    await db.removeFamilyMember(id);
                    renderActiveView();
                } catch(err) {
                    alert('Could not remove member: ' + err.message);
                }
            }
        });
    });

    // 5. Cancel pending invite buttons
    const cancelInviteBtns = contentMount.querySelectorAll('.cancel-invite-btn');
    cancelInviteBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const email = btn.getAttribute('data-email');
            if (confirm(`Cancel the invitation sent to ${email}?`)) {
                try {
                    await db.cancelInvite(email);
                    renderActiveView();
                } catch(err) {
                    alert('Could not cancel invite: ' + err.message);
                }
            }
        });
    });

    // 5. User Profile Photo uploading controls
    const uploadBtn = document.getElementById('profile-pic-upload-btn');
    const fileInput = document.getElementById('profile-pic-file');
    const picContainer = document.getElementById('profile-pic-container');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
    }
    if (picContainer && fileInput) {
        picContainer.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    alert('Please select a valid image file.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Str = event.target.result;
                    const currentUser = db.getCurrentUser();

                    // Save to DB profiles and update sharing logs
                    currentUser.profilePic = base64Str;
                    db.setCurrentUser(currentUser);
                    db.saveFamilyMember(currentUser);

                    // Refresh view components
                    updateGlobalRoleHeader();
                    renderActiveView();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 6. Supabase Credentials Settings Form
    const supabaseForm = document.getElementById('supabase-config-form');
    if (supabaseForm) {
        supabaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('sb-url').value.trim();
            const key = document.getElementById('sb-key').value.trim();

            dbConfig.setCredentials(url, key);

            try {
                await db.sync();
                alert('Database credentials updated! Connection established successfully.');
            } catch (err) {
                alert('Sync connection error: ' + err.message);
            }

            updateGlobalRoleHeader();
            renderActiveView();
        });
    }
}

/**
 * Public Scan Sim routing exit
 */
function setupQRPortalEvents() {
    const exitBtn = document.getElementById('portal-exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            navigateTo('home');
        });
    }
}

/**
 * Modal Visibility Controls
 */
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

/**
 * Open Modal to Add or Edit Appliance Specs
 */
function openApplianceModal(appliance = null) {
    if (!db.canModify()) {
        alert('Access Denied. Your active role does not permit modifying appliance registry.');
        return;
    }

    const title = document.getElementById('appliance-modal-title');
    const formBtn = document.getElementById('appliance-form-submit');

    // Clear forms
    applianceForm.reset();
    document.getElementById('app-id').value = '';

    // Reset image inputs & preview
    document.getElementById('app-image-filename').textContent = 'No photo uploaded';
    document.getElementById('app-image-base64').value = '';
    document.getElementById('app-image-preview-container').style.display = 'none';
    document.getElementById('app-image-preview').src = '';
    document.getElementById('app-type').value = '';
    document.getElementById('app-document-status').textContent = '';
    document.getElementById('app-support-link').hidden = true;

    if (appliance) {
        title.textContent = 'Modify Appliance Specs';
        formBtn.textContent = 'Save Changes';

        // Fill form fields
        document.getElementById('app-id').value = appliance.id;
        document.getElementById('app-name').value = appliance.name;
        document.getElementById('app-brand').value = appliance.brand;
        document.getElementById('app-type').value = appliance.type || '';
        document.getElementById('app-model').value = appliance.model;
        document.getElementById('app-serial').value = appliance.serialNumber || '';
        document.getElementById('app-purchase-date').value = appliance.purchaseDate;
        document.getElementById('app-purchase-price').value = appliance.purchasePrice;
        document.getElementById('app-warranty').value = appliance.warrantyMonths;
        document.getElementById('app-lifespan').value = appliance.lifespanYears;
        document.getElementById('app-room').value = appliance.room;
        document.getElementById('app-status').value = appliance.status;
        document.getElementById('app-notes').value = appliance.notes || '';
        const supportLink = document.getElementById('app-support-link');
        supportLink.href = supportUrlFor(appliance.brand);
        supportLink.hidden = !appliance.brand;

        // Load photo preview if existing imageUrl is present
        if (appliance.imageUrl) {
            document.getElementById('app-image-base64').value = appliance.imageUrl;
            document.getElementById('app-image-filename').textContent = 'Saved Photo';
            document.getElementById('app-image-preview').src = appliance.imageUrl;
            document.getElementById('app-image-preview-container').style.display = 'block';
        }
    } else {
        title.textContent = 'Register New Appliance';
        formBtn.textContent = 'Register Device';
        document.getElementById('app-purchase-date').value = new Date().toISOString().split('T')[0];
    }

    openModal(applianceModal);
}

/**
 * Open Modal to Record Service Event
 */
function openServiceModal(applianceId = null) {
    if (!db.canModify()) {
        alert('Access Denied. Your active role does not permit logging maintenance.');
        return;
    }

    serviceForm.reset();
    document.getElementById('srv-id').value = '';
    document.getElementById('srv-date').value = new Date().toISOString().split('T')[0];

    // Populate appliance select dropdown
    const appliances = db.getAppliances();
    const appSelect = document.getElementById('srv-appliance-id');

    appSelect.innerHTML = appliances.map(app => `
        <option value="${app.id}" ${applianceId === app.id ? 'selected' : ''}>
            ${app.name} (${app.brand})
        </option>
    `).join('');

    openModal(serviceModal);
}

/**
 * Handle new / modify appliance form submissions
 */
async function handleApplianceFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('app-id').value || 'app-' + Math.random().toString(36).substr(2, 9);

    const appliance = {
        id: id,
        name: document.getElementById('app-name').value,
        brand: document.getElementById('app-brand').value,
        model: document.getElementById('app-model').value,
        serialNumber: document.getElementById('app-serial').value,
        purchaseDate: document.getElementById('app-purchase-date').value,
        purchasePrice: parseFloat(document.getElementById('app-purchase-price').value),
        warrantyMonths: parseInt(document.getElementById('app-warranty').value),
        lifespanYears: parseInt(document.getElementById('app-lifespan').value),
        room: document.getElementById('app-room').value,
        status: document.getElementById('app-status').value,
        imageUrl: document.getElementById('app-image-base64').value, // Save image data
        notes: document.getElementById('app-notes').value
    };

    try { await db.saveAppliance(appliance); } catch (error) { alert(`Could not save appliance: ${error.message}`); return; }
    closeModal(applianceModal);

    // Refresh current view (e.g. details page or appliances list)
    if (state.currentView === 'appliance-detail') {
        renderActiveView();
    } else {
        navigateTo('appliances');
    }
}

/**
 * Handle maintenance log form submissions
 */
async function handleServiceFormSubmit(e) {
    e.preventDefault();

    const id = 'srv-' + Math.random().toString(36).substr(2, 9);
    const targetApplianceId = document.getElementById('srv-appliance-id').value;

    const service = {
        id: id,
        applianceId: targetApplianceId,
        date: document.getElementById('srv-date').value,
        type: document.getElementById('srv-type').value,
        cost: parseFloat(document.getElementById('srv-cost').value),
        technician: document.getElementById('srv-tech').value,
        phone: document.getElementById('srv-phone').value,
        description: document.getElementById('srv-desc').value
    };

    try { await db.saveService(service); } catch (error) { alert(`Could not save service record: ${error.message}`); return; }

    // Check if service suggests repair update on the appliance itself
    if (service.type === 'Repair' || service.type === 'Maintenance') {
        const app = db.getApplianceById(targetApplianceId);
        if (app && app.status === 'Needs Service') {
            app.status = 'Operational'; // Automatically restore status
            await db.saveAppliance(app);
        }
    }

    closeModal(serviceModal);

    // Refresh view
    if (state.currentView === 'appliance-detail') {
        renderActiveView();
    } else {
        navigateTo('reminders');
    }
}

// Global router logic for back button hash modifications
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    if (hash.startsWith('appliance-detail?id=')) {
        const id = hash.split('?id=')[1];
        if (id && id !== state.selectedApplianceId) {
            navigateTo('appliance-detail', id);
        }
    } else if (hash.startsWith('qr-portal?id=')) {
        const id = hash.split('?id=')[1];
        if (id) {
            navigateTo('qr-portal', id);
        }
    } else {
        // Safe check for primary routes
        const primaryViews = ['home', 'appliances', 'reminders', 'analytics', 'profile'];
        const matchingView = primaryViews.find(v => hash.startsWith(v));
        if (matchingView && matchingView !== state.currentView) {
            navigateTo(matchingView);
        }
    }
});

// Fire init when window mounts
window.addEventListener('DOMContentLoaded', init);
