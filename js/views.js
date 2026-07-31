/**
 * AppliTrack View Rendering Templates
 */
import { AnalyticsEngine } from './recommendation.js';
import { db, dbConfig } from './db.js';

export const Views = {
    /**
     * Helper to format currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    },

    /**
     * Renders the Home page (previously Dashboard)
     */
    renderHome(state) {
        const appliances = db.getAppliances();
        const services = db.getServices();
        const stats = AnalyticsEngine.getFinancialAggregates(appliances, services);
        
        // Count warranties
        const activeWarranties = appliances.filter(app => 
            AnalyticsEngine.isUnderWarranty(app.purchaseDate, app.warrantyMonths)
        ).length;

        // Alerts/issues
        const criticalAppliances = appliances.filter(app => {
            const rec = AnalyticsEngine.getRecommendation(app, services);
            return rec.action === 'Replace Suggested' || rec.action === 'Schedule Service';
        });

        let emptyStateHTML = '';
        if (appliances.length === 0) {
            emptyStateHTML = `
                <div style="text-align: center; padding: 60px 20px; background: var(--card-bg); border-radius: var(--border-radius-lg); border: 1px solid var(--card-border); margin-top: 24px; grid-column: 1 / -1;">
                    <i class="fas fa-tools" style="font-size: 48px; color: var(--text-muted); margin-bottom: 20px;"></i>
                    <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 600; margin-bottom: 8px;">No Appliances Registered</h3>
                    <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 24px; line-height: 1.6; font-size: 13px;">
                        Your household registry is empty. Add your home appliances to start tracking warranties, scheduling checklist alerts, and generating financial analytics reports.
                    </p>
                    <button class="btn-primary" id="home-empty-add-btn" style="margin: 0 auto;" ${!db.canModify() ? 'disabled' : ''}><i class="fas fa-plus"></i> Register First Appliance</button>
                </div>
            `;
        }

        let criticalSectionHTML = '';
        if (criticalAppliances.length > 0) {
            criticalSectionHTML = `
                <div class="chart-card" style="grid-column: span 2; min-height: auto; margin-bottom: 24px;">
                    <div class="chart-card-header">
                        <h3 class="chart-title" style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Critical Status Alerts</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${criticalAppliances.map(app => {
                            const rec = AnalyticsEngine.getRecommendation(app, services);
                            const health = AnalyticsEngine.calculateHealthScore(app, services);
                            const isReplace = rec.action === 'Replace Suggested';
                            return `
                                <div class="rec-box" style="background: ${isReplace ? 'var(--danger-bg)' : 'var(--warning-bg)'}; border: 1px solid ${isReplace ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.2)'};">
                                    <i class="fas ${isReplace ? 'fa-sync-alt' : 'fa-wrench'}" style="color: ${isReplace ? 'var(--danger)' : 'var(--warning)'};"></i>
                                    <div style="flex-grow: 1;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                            <h4 class="rec-title">${app.name} (${app.brand})</h4>
                                            <span class="badge ${isReplace ? 'status-danger' : 'status-warning'}">${rec.action}</span>
                                        </div>
                                        <p class="rec-text">${rec.reason}</p>
                                        <div style="margin-top: 10px; font-size: 11px; display: flex; gap: 16px; color: var(--text-secondary);">
                                            <span><strong>Current Health:</strong> ${health}%</span>
                                            <span><strong>Room:</strong> ${app.room}</span>
                                            <span><strong>Service Cost:</strong> ${this.formatCurrency(services.filter(s => s.applianceId === app.id).reduce((sum, s) => sum + s.cost, 0))}</span>
                                        </div>
                                    </div>
                                    <button class="btn-secondary nav-action-btn" data-view="appliance-detail" data-id="${app.id}" style="padding: 6px 12px; font-size: 12px; align-self: center;">View Details</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        return `
            <div class="page-view">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <h2 style="font-family: var(--font-heading); font-size: 28px; font-weight: 800;">Home Overview</h2>
                        <p style="color: var(--text-secondary); font-size: 14px;">Welcome back, ${db.getCurrentUser().name}. Here is your active appliance status summary.</p>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn-secondary" id="home-scan-btn"><i class="fas fa-qrcode"></i> Scan QR Label</button>
                        <button class="btn-primary" id="home-add-btn" ${!db.canModify() ? 'disabled' : ''}><i class="fas fa-plus"></i> Register Appliance</button>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon primary">
                            <i class="fas fa-plug"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">${appliances.length}</span>
                            <span class="stat-label">Total Appliances</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon secondary">
                            <i class="fas fa-heartbeat"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">${stats.avgHealth}%</span>
                            <span class="stat-label">Average Health</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">${activeWarranties}</span>
                            <span class="stat-label">Active Warranties</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon danger">
                            <i class="fas fa-file-invoice-dollar"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">${this.formatCurrency(stats.totalRepairSpend)}</span>
                            <span class="stat-label">Maintenance Spent</span>
                        </div>
                    </div>
                </div>

                <!-- Alerts Grid / Empty State -->
                <div class="charts-grid" style="grid-template-columns: 1fr; margin-bottom: 0;">
                    ${criticalSectionHTML}
                    ${emptyStateHTML}
                </div>
            </div>
        `;
    },

    /**
     * Renders inventory of appliances (previously Inventory)
     */
    renderAppliances(state) {
        const appliances = db.getAppliances();
        const services = db.getServices();
        const activeRoom = state.activeRoom || 'All';
        const searchQuery = state.searchQuery || '';

        // Rooms list for filters
        const rooms = ['All', ...new Set(appliances.map(app => app.room))];

        // Filter calculation
        let filteredAppliances = appliances.filter(app => {
            const matchesRoom = activeRoom === 'All' || app.room === activeRoom;
            const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.model.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesRoom && matchesSearch;
        });

        return `
            <div class="page-view">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <h2 style="font-family: var(--font-heading); font-size: 28px; font-weight: 800;">My Appliances</h2>
                        <p style="color: var(--text-secondary); font-size: 14px;">Monitor and search all appliances in your home registry.</p>
                    </div>
                    <button class="btn-primary" id="appliances-add-btn" ${!db.canModify() ? 'disabled' : ''}><i class="fas fa-plus"></i> Add Appliance</button>
                </div>

                <div class="inventory-filters">
                    <div class="filter-tabs">
                        ${rooms.map(room => `
                            <button class="filter-tab ${activeRoom === room ? 'active' : ''}" data-room="${room}">
                                ${room}
                            </button>
                        `).join('')}
                    </div>
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="appliances-search" placeholder="Search brand, model, or name..." value="${searchQuery}">
                    </div>
                </div>

                ${filteredAppliances.length === 0 ? `
                    <div style="text-align: center; padding: 60px 20px; background: var(--card-bg); border-radius: var(--border-radius-lg); border: 1px solid var(--card-border);">
                        <i class="fas fa-box-open" style="font-size: 48px; color: var(--text-muted); margin-bottom: 16px;"></i>
                        <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 600; margin-bottom: 8px;">No Appliances Found</h3>
                        <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">Try adjusting your filters or search query, or register a new home device.</p>
                    </div>
                ` : `
                    <div class="appliances-grid">
                        ${filteredAppliances.map(app => {
                            const appServices = services.filter(s => s.applianceId === app.id);
                            const health = AnalyticsEngine.calculateHealthScore(app, services);
                            const rec = AnalyticsEngine.getRecommendation(app, services);
                            
                            // Health color mapping
                            let healthColor = 'var(--success)';
                            if (health < 40) healthColor = 'var(--danger)';
                            else if (health < 75) healthColor = 'var(--warning)';

                            return `
                                <div class="appliance-card" data-id="${app.id}" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
                                    <div style="height: 140px; background: url('${app.imageUrl || 'https://images.unsplash.com/photo-1581092918056-0c4c3acd37bd?w=500'}') center/cover no-repeat; border-bottom: 1px solid var(--card-border);"></div>
                                    <div style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                        <div>
                                            <div class="card-top" style="margin-bottom: 8px;">
                                                <span class="card-room-badge">${app.room}</span>
                                                <span class="badge ${rec.badgeClass}">${rec.action}</span>
                                            </div>
                                            <h3 class="appliance-card-title">${app.name}</h3>
                                            <div class="appliance-card-brand" style="margin-bottom: 0;">${app.brand} | Model: ${app.model}</div>
                                        </div>
                                        <div class="card-bottom" style="margin-top: 16px; border-top: 1px solid var(--card-border); padding-top: 16px;">
                                            <div class="health-mini-display">
                                                <span class="health-mini-label">HEALTH SCORE</span>
                                                <span class="health-mini-val" style="color: ${healthColor};">${health}%</span>
                                            </div>
                                            <div style="width: 100px; background: rgba(255,255,255,0.05); height: 6px; border-radius: 10px; overflow: hidden;">
                                                <div style="width: ${health}%; height: 100%; background: ${healthColor}; border-radius: 10px;"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Renders detailed appliance page with service logs and QR code
     */
    renderApplianceDetail(applianceId, state) {
        const appliance = db.getApplianceById(applianceId);
        if (!appliance) {
            return `<div class="page-view"><p>Appliance not found.</p><a class="back-link" data-view="appliances"><i class="fas fa-arrow-left"></i> Back to Appliances</a></div>`;
        }

        const services = db.getServicesForAppliance(applianceId);
        const allServices = db.getServices();
        const health = AnalyticsEngine.calculateHealthScore(appliance, allServices);
        const recommendation = AnalyticsEngine.getRecommendation(appliance, allServices);
        const age = AnalyticsEngine.getAge(appliance.purchaseDate);

        // Calculate warranty details
        const isUnderWarranty = AnalyticsEngine.isUnderWarranty(appliance.purchaseDate, appliance.warrantyMonths);
        const warrantyExpiry = AnalyticsEngine.getWarrantyExpiryDate(appliance.purchaseDate, appliance.warrantyMonths);

        // Warranty remaining calculation for layout bar
        let warrantyProgress = 0;
        if (appliance.warrantyMonths > 0) {
            const totalWarrantyDays = appliance.warrantyMonths * 30.4375;
            const daysUsed = age * 365.25;
            warrantyProgress = Math.max(0, Math.min(100, ((totalWarrantyDays - daysUsed) / totalWarrantyDays) * 100));
        }

        // SVG stroke-dashoffset calculation (Circumference of 60 radius circle is 377)
        const strokeDashOffset = 377 - (377 * health) / 100;
        
        let healthColor = 'var(--success)';
        if (health < 40) healthColor = 'var(--danger)';
        else if (health < 75) healthColor = 'var(--warning)';

        return `
            <div class="page-view">
                <a class="back-link" data-view="appliances"><i class="fas fa-arrow-left"></i> Back to Appliances</a>

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 32px;">
                    <div class="detail-title-block">
                        <h2>${appliance.name}</h2>
                        <div class="detail-subtitle-block">
                            <span><strong>Brand:</strong> ${appliance.brand}</span>
                            <span><strong>Model:</strong> ${appliance.model}</span>
                            <span><strong>Room:</strong> ${appliance.room}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn-danger" id="detail-delete-btn" data-id="${appliance.id}" ${!db.isAdmin() ? 'disabled' : ''}><i class="fas fa-trash"></i> Delete Device</button>
                        <button class="btn-secondary" id="detail-edit-btn" data-id="${appliance.id}" ${!db.canModify() ? 'disabled' : ''}><i class="fas fa-edit"></i> Edit Details</button>
                        <button class="btn-primary" id="detail-add-service-btn" data-id="${appliance.id}" ${!db.canModify() ? 'disabled' : ''}><i class="fas fa-wrench"></i> Log Service</button>
                    </div>
                </div>

                <div class="detail-layout">
                    <!-- Main Specs & Service History -->
                    <div style="display: flex; flex-direction: column; gap: 24px;">
                        <div class="detail-main-card" style="position: relative; overflow: hidden; padding-top: 180px;">
                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 150px; background: url('${appliance.imageUrl || 'https://images.unsplash.com/photo-1581092918056-0c4c3acd37bd?w=500'}') center/cover no-repeat; border-bottom: 1px solid var(--card-border);"></div>
                            <h3 class="detail-section-title" style="margin-bottom: 24px;"><i class="fas fa-info-circle"></i> Appliance Specification</h3>
                            <div class="detail-grid">
                                <div class="detail-info-item">
                                    <span class="detail-info-label">SERIAL NUMBER</span>
                                    <span class="detail-info-value">${appliance.serialNumber || 'N/A'}</span>
                                </div>
                                <div class="detail-info-item">
                                    <span class="detail-info-label">ROOM / LOCATION</span>
                                    <span class="detail-info-value">${appliance.room}</span>
                                </div>
                                <div class="detail-info-item">
                                    <span class="detail-info-label">PURCHASE DATE</span>
                                    <span class="detail-info-value">${appliance.purchaseDate}</span>
                                </div>
                                <div class="detail-info-item">
                                    <span class="detail-info-label">PURCHASE PRICE</span>
                                    <span class="detail-info-value">${this.formatCurrency(appliance.purchasePrice)}</span>
                                </div>
                                <div class="detail-info-item">
                                    <span class="detail-info-label">DEVICE AGE</span>
                                    <span class="detail-info-value">${age} years</span>
                                </div>
                                <div class="detail-info-item">
                                    <span class="detail-info-label">ESTIMATED LIFESPAN</span>
                                    <span class="detail-info-value">${appliance.lifespanYears} years</span>
                                </div>
                            </div>

                            <!-- Warranty Panel -->
                            <div class="warranty-timeline">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 700; font-size: 14px;"><i class="fas fa-shield-alt"></i> Warranty Health</span>
                                    <span class="badge ${isUnderWarranty ? 'status-success' : 'status-danger'}">
                                        ${isUnderWarranty ? 'Active Warranty' : 'Expired'}
                                    </span>
                                </div>
                                <div class="timeline-bar-bg">
                                    <div class="timeline-bar-fill" style="width: ${warrantyProgress}%; background: ${isUnderWarranty ? 'var(--success)' : 'var(--danger)'}"></div>
                                </div>
                                <div class="timeline-dates">
                                    <span>Purchased: ${appliance.purchaseDate}</span>
                                    <span>Warranty Duration: ${appliance.warrantyMonths} months</span>
                                    <span>Expiry: ${warrantyExpiry}</span>
                                </div>
                            </div>

                            <!-- Notes section -->
                            <div style="background: rgba(255,255,255,0.01); border-left: 3px solid var(--primary); padding: 16px; border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0;">
                                <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; color: var(--primary);">Notes / Documents Link</h4>
                                <p style="font-size: 13px; color: var(--text-secondary);">${appliance.notes || 'No user notes added for this device.'}</p>
                            </div>
                        </div>

                        <!-- Service Logs Card -->
                        <div class="detail-main-card">
                            <div class="section-title-container">
                                <h3 class="detail-section-title"><i class="fas fa-history"></i> Service Logs (${services.length})</h3>
                            </div>
                            
                            ${services.length === 0 ? `
                                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                                    <i class="fas fa-tools" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>
                                    <p>No maintenance operations have been logged for this appliance yet.</p>
                                </div>
                            ` : `
                                <div class="logs-list">
                                    ${services.map(log => `
                                        <div class="log-item" style="border-color: ${log.type === 'Repair' ? 'var(--danger)' : 'var(--primary)'}">
                                            <div class="log-item-header">
                                                <div style="display: flex; gap: 12px; align-items: center;">
                                                    <span class="log-item-title">${log.type} Service</span>
                                                    <span class="badge ${log.type === 'Repair' ? 'status-danger' : 'status-success'}" style="padding: 1px 8px; font-size: 10px;">${this.formatCurrency(log.cost)}</span>
                                                </div>
                                                <div style="display: flex; gap: 12px; align-items: center;">
                                                    <span class="log-item-date">${log.date}</span>
                                                    ${db.canModify() ? `<button class="btn-danger log-delete-btn" data-id="${log.id}" style="padding: 2px 6px; font-size: 10px; height: auto;"><i class="fas fa-trash-alt"></i></button>` : ''}
                                                </div>
                                            </div>
                                            <p class="log-item-desc">${log.description}</p>
                                            <div class="log-item-technician">
                                                <span><i class="fas fa-user-cog"></i> Technician: ${log.technician || 'Self'}</span>
                                                ${log.phone ? `<span><i class="fas fa-phone"></i> Support: ${log.phone}</span>` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Right Side: Health & QR Code Generator -->
                    <div style="display: flex; flex-direction: column; gap: 24px;">
                        <!-- Health Ring Score Card -->
                        <div class="qr-card">
                            <h3 class="detail-section-title" style="margin-bottom: 20px; font-size: 18px;">Appliance Health Score</h3>
                            <div class="health-ring-container" style="background: transparent; border: none; padding: 0;">
                                <div class="health-radial-chart">
                                    <svg class="health-circle-svg" width="130" height="130">
                                        <defs>
                                            <linearGradient id="health-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stop-color="var(--primary)" />
                                                <stop offset="100%" stop-color="var(--secondary)" />
                                            </linearGradient>
                                        </defs>
                                        <circle class="health-circle-bg" cx="65" cy="65" r="60" />
                                        <circle class="health-circle-stroke" cx="65" cy="65" r="60" 
                                            style="stroke-dashoffset: ${strokeDashOffset}; stroke: ${healthColor};" />
                                    </svg>
                                    <div class="health-center-value" style="color: ${healthColor};">${health}%</div>
                                </div>
                            </div>

                            <div class="rec-box" style="background: ${recommendation.badgeClass === 'status-danger' ? 'var(--danger-bg)' : recommendation.badgeClass === 'status-warning' ? 'var(--warning-bg)' : 'var(--success-bg)'}; text-align: left;">
                                <div>
                                    <div class="rec-title">${recommendation.action}</div>
                                    <p class="rec-text" style="margin-bottom: 0;">${recommendation.reason}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Device QR Code label card -->
                        <div class="qr-card">
                            <h3 class="detail-section-title" style="font-size: 18px;"><i class="fas fa-qrcode"></i> Physical Appliance QR Label</h3>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Print this label and stick it to the physical appliance. Anyone scanning it can view service numbers and log history.</p>
                            
                            <div class="qr-box" id="appliance-qr-target"></div>
                            
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <button class="btn-secondary" id="qr-print-btn" style="flex: 1; justify-content: center;"><i class="fas fa-print"></i> Print</button>
                                <button class="btn-primary" id="qr-simulate-btn" style="flex: 1; justify-content: center;"><i class="fas fa-mobile-alt"></i> Scan</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renders the Reminders view (previously Service Tracking)
     * Features: Automated reminders based on device health, warranty status, and elapsed service interval, 
     * alongside the chronological service history registry.
     */
    renderReminders(state) {
        const appliances = db.getAppliances();
        const services = db.getServices();

        // Heuristic Reminder Generation:
        const reminders = [];
        appliances.forEach(app => {
            const appServices = services.filter(s => s.applianceId === app.id);
            const age = AnalyticsEngine.getAge(app.purchaseDate);
            const isWarranty = AnalyticsEngine.isUnderWarranty(app.purchaseDate, app.warrantyMonths);
            
            // 1. Critical Needs Service Flag
            if (app.status === 'Needs Service') {
                reminders.push({
                    id: `rem-needs-${app.id}`,
                    appliance: app,
                    title: 'Schedule Repair Diagnostic',
                    description: 'Device is flagged as non-operational or has pending issues.',
                    type: 'Overdue',
                    icon: 'fa-wrench',
                    badgeClass: 'status-danger'
                });
            }
            
            // 2. High Repair Expense Monitor
            const totalRepairs = appServices.reduce((sum, s) => sum + s.cost, 0);
            if (totalRepairs / app.purchasePrice >= 0.4 && app.status !== 'Replace Suggested') {
                reminders.push({
                    id: `rem-math-${app.id}`,
                    appliance: app,
                    title: 'Evaluate Cost/Benefit Analytics',
                    description: `Cumulative repairs (₹${totalRepairs}) have reached ${(totalRepairs / app.purchasePrice * 100).toFixed(0)}% of device acquisition cost.`,
                    type: 'Monitor',
                    icon: 'fa-calculator',
                    badgeClass: 'status-warning'
                });
            }

            // 3. Warranty Expiring Soon
            if (isWarranty && app.warrantyMonths > 0) {
                const totalWarrantyDays = app.warrantyMonths * 30.4375;
                const daysUsed = age * 365.25;
                const daysRemaining = totalWarrantyDays - daysUsed;
                if (daysRemaining <= 90) { // under 3 months left
                    reminders.push({
                        id: `rem-warn-${app.id}`,
                        appliance: app,
                        title: 'Warranty Expiration Checkup',
                        description: `Manufacturer coverage expires in ${Math.round(daysRemaining)} days. Log service now if there are pending adjustments.`,
                        type: 'Due Soon',
                        icon: 'fa-shield-alt',
                        badgeClass: 'status-warning'
                    });
                }
            }

            // 4. Elapsed Service Interval (e.g. HVAC needs service every 12 months)
            if (app.name.toLowerCase().includes('hvac') || app.room === 'Utility Room') {
                const sortedSrv = [...appServices].sort((a,b) => new Date(b.date) - new Date(a.date));
                const lastSrv = sortedSrv[0];
                let monthsSinceLast = 999;
                if (lastSrv) {
                    const diffTime = Math.abs(new Date() - new Date(lastSrv.date));
                    monthsSinceLast = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.4375));
                }
                if (monthsSinceLast >= 12) {
                    reminders.push({
                        id: `rem-time-${app.id}`,
                        appliance: app,
                        title: 'Annual Professional Service Tuneup',
                        description: lastSrv 
                            ? `Last routine service was ${monthsSinceLast} months ago (${lastSrv.date}).`
                            : 'No baseline service history registered for this central climate controller.',
                        type: 'Recommended',
                        icon: 'fa-calendar-alt',
                        badgeClass: 'status-success'
                    });
                }
            }
        });

        // Chronological sort
        const sortedServices = [...services].sort((a, b) => new Date(b.date) - new Date(a.date));

        return `
            <div class="page-view">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
                    <div>
                        <h2 style="font-family: var(--font-heading); font-size: 28px; font-weight: 800;">Reminders & Tracking</h2>
                        <p style="color: var(--text-secondary); font-size: 14px;">Schedule maintenance, view automated service checklists, and log repair items.</p>
                    </div>
                    <button class="btn-primary" id="reminders-add-btn" ${!db.canModify() ? 'disabled' : ''}><i class="fas fa-plus"></i> Record Service Log</button>
                </div>

                <!-- Reminders Checklist Card -->
                <div class="detail-main-card" style="margin-bottom: 32px;">
                    <h3 class="detail-section-title" style="margin-bottom: 20px;"><i class="fas fa-bell"></i> System Reminders (${reminders.length})</h3>
                    
                    ${reminders.length === 0 ? `
                        <div style="text-align: center; padding: 24px; color: var(--text-secondary);">
                            <i class="fas fa-check-double" style="font-size: 28px; color: var(--success); margin-bottom: 8px;"></i>
                            <p>No active maintenance tasks or warranty checkup reminders found. All systems operational.</p>
                        </div>
                    ` : `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                            ${reminders.map(rem => `
                                <div class="rec-box" style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); flex-direction: column; align-items: flex-start; gap: 8px;">
                                    <div style="display: flex; justify-content: space-between; width: 100%; align-items: flex-start;">
                                        <span class="badge ${rem.badgeClass}" style="text-transform: uppercase;">${rem.type}</span>
                                        <i class="fas ${rem.icon}" style="color: var(--primary);"></i>
                                    </div>
                                    <div style="flex-grow: 1;">
                                        <h4 class="rec-title" style="font-size: 14px; margin-bottom: 4px;">${rem.title}</h4>
                                        <span style="font-size: 11px; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 6px;">${rem.appliance.name}</span>
                                        <p class="rec-text" style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${rem.description}</p>
                                    </div>
                                    <button class="btn-secondary nav-action-btn" data-view="appliance-detail" data-id="${rem.appliance.id}" style="padding: 4px 10px; font-size: 11px; margin-top: 8px; width: 100%; justify-content: center;">Inspect Details</button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <!-- History Table Card -->
                <div class="detail-main-card">
                    <h3 class="detail-section-title" style="margin-bottom: 20px;"><i class="fas fa-history"></i> Logged Service Registry</h3>
                    ${sortedServices.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                            <i class="fas fa-clipboard-list" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>
                            <p>No historical service entries registered yet.</p>
                        </div>
                    ` : `
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--card-border); color: var(--text-secondary);">
                                        <th style="padding: 16px 12px; font-weight: 600;">DATE</th>
                                        <th style="padding: 16px 12px; font-weight: 600;">APPLIANCE</th>
                                        <th style="padding: 16px 12px; font-weight: 600;">ROOM</th>
                                        <th style="padding: 16px 12px; font-weight: 600;">TYPE</th>
                                        <th style="padding: 16px 12px; font-weight: 600;">DESCRIPTION</th>
                                        <th style="padding: 16px 12px; font-weight: 600;">COST</th>
                                        <th style="padding: 16px 12px; font-weight: 600; text-align: right;">ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sortedServices.map(srv => {
                                        const app = appliances.find(a => a.id === srv.applianceId) || { name: 'Deleted Appliance', room: 'N/A' };
                                        return `
                                            <tr style="border-bottom: 1px solid var(--card-border); transition: background var(--transition-fast);" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='transparent'">
                                                <td style="padding: 16px 12px; font-weight: 600;">${srv.date}</td>
                                                <td style="padding: 16px 12px; font-weight: 600; color: var(--primary); cursor: pointer;" class="table-appliance-link" data-id="${srv.applianceId}">${app.name}</td>
                                                <td style="padding: 16px 12px; color: var(--text-secondary);">${app.room}</td>
                                                <td style="padding: 16px 12px;">
                                                    <span class="badge ${srv.type === 'Repair' ? 'status-danger' : 'status-success'}">${srv.type}</span>
                                                </td>
                                                <td style="padding: 16px 12px; color: var(--text-secondary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${srv.description}</td>
                                                <td style="padding: 16px 12px; font-weight: 700;">${this.formatCurrency(srv.cost)}</td>
                                                <td style="padding: 16px 12px; text-align: right;">
                                                    <button class="btn-secondary nav-action-btn" data-view="appliance-detail" data-id="${srv.applianceId}" style="padding: 6px 12px; font-size: 12px; display: inline-flex; margin-right: 8px;">View Detail</button>
                                                    ${db.canModify() ? `<button class="btn-danger table-delete-srv-btn" data-id="${srv.id}" style="padding: 6px 10px; font-size: 12px; display: inline-flex;"><i class="fas fa-trash-alt"></i></button>` : ''}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    /**
     * Renders analytics report & repair/replace advice
     */
    renderAnalytics(state) {
        const appliances = db.getAppliances();
        const services = db.getServices();
        const stats = AnalyticsEngine.getFinancialAggregates(appliances, services);

        const replacementCategories = {
            replace: [],
            monitor: [],
            keep: []
        };

        appliances.forEach(app => {
            const rec = AnalyticsEngine.getRecommendation(app, services);
            if (rec.action === 'Replace Suggested') {
                replacementCategories.replace.push({ app, rec });
            } else if (rec.action === 'Schedule Service' || rec.action === 'Monitor Health') {
                replacementCategories.monitor.push({ app, rec });
            } else {
                replacementCategories.keep.push({ app, rec });
            }
        });

        return `
            <div class="page-view">
                <div style="margin-bottom: 32px;">
                    <h2 style="font-family: var(--font-heading); font-size: 28px; font-weight: 800;">Analytics Report</h2>
                    <p style="color: var(--text-secondary); font-size: 14px;">In-depth repair-vs-replace calculations, spending projections, and efficiency ratings.</p>
                </div>

                <!-- Replace or Keep Analysis Card -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; align-items: start;">
                    
                    <!-- Left: Decision Breakdown -->
                    <div class="detail-main-card" style="height: 100%;">
                        <h3 class="detail-section-title" style="margin-bottom: 20px;"><i class="fas fa-balance-scale"></i> Replacement Recommendation Status</h3>
                        
                        <!-- Replace list -->
                        <div style="margin-bottom: 24px;">
                            <h4 style="font-size: 14px; font-weight: 700; color: var(--danger); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-exclamation-circle"></i> REPLACE SUGGESTED (${replacementCategories.replace.length})
                            </h4>
                            ${replacementCategories.replace.length === 0 ? `
                                <p style="font-size: 13px; color: var(--text-muted); padding-left: 20px;">All systems operational. No immediate replacements recommended.</p>
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    ${replacementCategories.replace.map(item => `
                                        <div class="member-item" style="border-left: 3px solid var(--danger);">
                                            <div>
                                                <div style="font-weight: 700;">${item.app.name}</div>
                                                <div style="font-size: 12px; color: var(--text-secondary);">${item.rec.reason}</div>
                                            </div>
                                            <button class="btn-secondary nav-action-btn" data-view="appliance-detail" data-id="${item.app.id}" style="padding: 4px 10px; font-size: 11px;">Inspect</button>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>

                        <!-- Monitor list -->
                        <div style="margin-bottom: 24px;">
                            <h4 style="font-size: 14px; font-weight: 700; color: var(--warning); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-tools"></i> MONITOR HEALTH / SCHEDULE SERVICE (${replacementCategories.monitor.length})
                            </h4>
                            ${replacementCategories.monitor.length === 0 ? `
                                <p style="font-size: 13px; color: var(--text-muted); padding-left: 20px;">No appliances require watchlists or service scheduling.</p>
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    ${replacementCategories.monitor.map(item => `
                                        <div class="member-item" style="border-left: 3px solid var(--warning);">
                                            <div>
                                                <div style="font-weight: 700;">${item.app.name}</div>
                                                <div style="font-size: 12px; color: var(--text-secondary);">${item.rec.reason}</div>
                                            </div>
                                            <button class="btn-secondary nav-action-btn" data-view="appliance-detail" data-id="${item.app.id}" style="padding: 4px 10px; font-size: 11px;">Inspect</button>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>

                        <!-- Keep list -->
                        <div>
                            <h4 style="font-size: 14px; font-weight: 700; color: var(--success); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-check-circle"></i> KEEP (HEALTHY) (${replacementCategories.keep.length})
                            </h4>
                            ${replacementCategories.keep.length === 0 ? `
                                <p style="font-size: 13px; color: var(--text-muted); padding-left: 20px;">No appliances scored in the standard operational range.</p>
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    ${replacementCategories.keep.map(item => `
                                        <div class="member-item" style="border-left: 3px solid var(--success);">
                                            <div>
                                                <div style="font-weight: 700;">${item.app.name}</div>
                                                <div style="font-size: 12px; color: var(--text-secondary);">Running efficiently, minimal maintenance spend compared to acquisition value.</div>
                                            </div>
                                            <button class="btn-secondary nav-action-btn" data-view="appliance-detail" data-id="${item.app.id}" style="padding: 4px 10px; font-size: 11px;">Inspect</button>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Right: Decision Factors / Math -->
                    <div style="display: flex; flex-direction: column; gap: 24px; height: 100%;">
                        <div class="chart-card" style="min-height: auto; padding: 20px;">
                            <div class="chart-card-header" style="margin-bottom: 12px;">
                                <h3 class="chart-title">Spending by Room/Category</h3>
                            </div>
                            <div class="chart-canvas-container" style="height: 240px;">
                                <canvas id="categoryChart"></canvas>
                            </div>
                        </div>
                        <div class="chart-card" style="min-height: auto; padding: 20px;">
                            <div class="chart-card-header" style="margin-bottom: 12px;">
                                <h3 class="chart-title">Maintenance Spending History</h3>
                            </div>
                            <div class="chart-canvas-container" style="height: 240px;">
                                <canvas id="timelineChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Annual Cost Projections & Tips -->
                <div class="detail-main-card">
                    <h3 class="detail-section-title" style="margin-bottom: 16px;"><i class="fas fa-chart-line"></i> Annual Maintenance Cost Breakdown</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                        <div>
                            <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">TOTAL ACQUISITION SPENT</span>
                            <div style="font-size: 32px; font-weight: 800; font-family: var(--font-heading); color: var(--primary); margin-top: 4px;">
                                ${this.formatCurrency(stats.totalInvestment)}
                            </div>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">Capital allocated to asset buying across all rooms.</p>
                        </div>
                        <div>
                            <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">TOTAL REPAIR & SERVICE BILLS</span>
                            <div style="font-size: 32px; font-weight: 800; font-family: var(--font-heading); color: var(--secondary); margin-top: 4px;">
                                ${this.formatCurrency(stats.totalRepairSpend)}
                            </div>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">Out-of-pocket costs to keep appliances operational.</p>
                        </div>
                        <div>
                            <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">REPAIR SPEND TO ASSET RATIO</span>
                            <div style="font-size: 32px; font-weight: 800; font-family: var(--font-heading); color: ${stats.totalInvestment > 0 ? (stats.totalRepairSpend / stats.totalInvestment > 0.25 ? 'var(--danger)' : 'var(--success)') : 'var(--text-primary)'}; margin-top: 4px;">
                                ${stats.totalInvestment > 0 ? ((stats.totalRepairSpend / stats.totalInvestment) * 100).toFixed(1) : 0}%
                            </div>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">Total service costs divided by total purchase cost. Healthy benchmark is &lt;20%.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renders the Profile & Household page
     */
    renderProfile(state) {
        const family = db.getFamilyMembers();
        const pendingInvites = db.getPendingInvites ? db.getPendingInvites() : [];
        const currentUser = db.getCurrentUser();
        const isOwner = db.isAdmin();

        // Avatar initials helper
        const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?';
        const getAvatarColor = (name) => {
            const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444'];
            let h = 0; for(let i=0;i<(name||'').length;i++) h=(h*31+name.charCodeAt(i))%colors.length;
            return colors[h];
        };

        const memberAvatarHTML = (member) => {
            if(member.profilePic) return `<img src="${member.profilePic}" style="width:100%;height:100%;object-fit:cover;">`;
            const color = getAvatarColor(member.name);
            return `<span style="color:white;font-size:14px;font-weight:700;">${getInitials(member.name)}</span>`;
        };

        const roleBadge = (role) => {
            if(role==='Owner') return `<span class="badge status-success" style="font-size:10px;padding:2px 8px;font-weight:700;">${role.toUpperCase()}</span>`;
            if(role==='Editor') return `<span class="badge status-warning" style="font-size:10px;padding:2px 8px;font-weight:700;">${role.toUpperCase()}</span>`;
            return `<span class="badge" style="font-size:10px;padding:2px 8px;font-weight:700;background:rgba(255,255,255,0.08);color:var(--text-primary);border:1px solid var(--card-border);">${role.toUpperCase()}</span>`;
        };

        const membersHTML = family.map(member => {
            const isCurrentUser = member.id === currentUser.id;
            const avatarBg = member.profilePic ? 'transparent' : getAvatarColor(member.name);
            return `
                <div class="member-item" style="transition: background 0.2s;">
                    <div style="display:flex;align-items:center;gap:14px;">
                        <div style="width:44px;height:44px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:2px solid var(--card-border);">
                            ${memberAvatarHTML(member)}
                        </div>
                        <div class="member-info">
                            <span class="member-name" style="font-weight:700;font-size:14px;">
                                ${member.name}${isCurrentUser ? ' <span style="color:var(--primary);font-size:11px;font-weight:500;">(You)</span>' : ''}
                            </span>
                            <span class="member-email" style="font-size:12px;color:var(--text-secondary);">
                                <i class="fas fa-envelope" style="font-size:10px;margin-right:4px;"></i>${member.email}
                            </span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${roleBadge(member.role)}
                        ${isOwner && !isCurrentUser ? `
                            <button class="family-delete-btn btn-danger" data-id="${member.id}" title="Remove member"
                                style="padding:5px 8px;font-size:12px;border-radius:6px;">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>`;
        }).join('');

        const pendingHTML = pendingInvites.length ? pendingInvites.map(inv => `
            <div class="member-item" style="opacity:0.7;">
                <div style="display:flex;align-items:center;gap:14px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:2px dashed var(--warning);">
                        <i class="fas fa-clock" style="color:var(--warning);font-size:16px;"></i>
                    </div>
                    <div class="member-info">
                        <span class="member-name" style="font-weight:700;font-size:14px;">${inv.name || 'Invited Member'}</span>
                        <span class="member-email" style="font-size:12px;color:var(--text-secondary);">
                            <i class="fas fa-envelope" style="font-size:10px;margin-right:4px;"></i>${inv.email}
                        </span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="badge status-warning" style="font-size:10px;padding:2px 8px;">PENDING</span>
                    ${isOwner ? `<button class="cancel-invite-btn btn-danger" data-email="${inv.email}" title="Cancel invite" style="padding:5px 8px;font-size:12px;border-radius:6px;"><i class="fas fa-times"></i></button>` : ''}
                </div>
            </div>`).join('') : '';

        const totalMembers = family.length + pendingInvites.length;

        const optionsHTML = family.map(m => `
            <option value="${m.id}" ${m.id === currentUser.id ? 'selected' : ''}>${m.name} (${m.role})</option>
        `).join('');

        return `
            <div class="page-view">
                <!-- Page Header -->
                <div style="margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
                    <div>
                        <h2 style="font-family:var(--font-heading);font-size:26px;font-weight:800;margin-bottom:6px;">Profile &amp; Household</h2>
                        <p style="color:var(--text-secondary);font-size:14px;">Manage your account and control who can access your home appliance records.</p>
                    </div>
                    <button class="btn-secondary" id="profile-signout-btn" style="gap:8px;">
                        <i class="fas fa-right-from-bracket"></i> Sign Out
                    </button>
                </div>

                <div class="family-layout">
                    <!-- LEFT COLUMN -->
                    <div style="display:flex;flex-direction:column;gap:24px;">

                        <!-- My Profile Card -->
                        <div class="sharing-members-card" style="background:linear-gradient(135deg,rgba(99,102,241,0.07),rgba(168,85,247,0.07));border-color:rgba(99,102,241,0.2);">
                            <h3 class="detail-section-title" style="margin-bottom:18px;"><i class="fas fa-user-circle"></i> My Profile</h3>
                            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
                                <div id="profile-pic-container" style="width:60px;height:60px;border-radius:50%;background:${currentUser.profilePic ? 'transparent' : getAvatarColor(currentUser.name)};display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;border:3px solid var(--primary);flex-shrink:0;" title="Click to change photo">
                                    ${currentUser.profilePic ? `<img src="${currentUser.profilePic}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:white;font-size:20px;font-weight:700;">${getInitials(currentUser.name)}</span>`}
                                </div>
                                <div style="flex:1;">
                                    <h4 style="font-size:17px;font-weight:700;margin:0 0 4px;">${currentUser.name}</h4>
                                    <span style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:8px;">${currentUser.email}</span>
                                    <input type="file" id="profile-pic-file" accept="image/*" style="display:none;">
                                    <button type="button" class="btn-secondary" id="profile-pic-upload-btn" style="padding:4px 10px;font-size:11px;height:auto;display:inline-flex;align-items:center;gap:5px;">
                                        <i class="fas fa-camera"></i> Change Photo
                                    </button>
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label for="profile-user-select" style="font-size:10px;font-weight:700;letter-spacing:0.05em;">SIMULATE ROLE VIEW:</label>
                                <select id="profile-user-select" class="user-dropdown" style="font-weight:600;">
                                    ${optionsHTML}
                                </select>
                            </div>
                        </div>

                        <!-- Role Permissions Matrix Card -->
                        <div class="sharing-members-card">
                            <h3 class="detail-section-title" style="margin-bottom:16px;"><i class="fas fa-shield-alt"></i> Role Permissions</h3>
                            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                                <thead>
                                    <tr style="border-bottom:1px solid var(--card-border);">
                                        <th style="text-align:left;padding:8px 4px;color:var(--text-secondary);font-weight:600;font-size:11px;">Permission</th>
                                        <th style="text-align:center;padding:8px 6px;color:var(--success);font-size:11px;">Owner</th>
                                        <th style="text-align:center;padding:8px 6px;color:var(--warning);font-size:11px;">Member</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                        <td style="padding:10px 4px;color:var(--text-secondary);">View &amp; add appliances</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                        <td style="padding:10px 4px;color:var(--text-secondary);">Delete appliances</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                        <td style="text-align:center;color:var(--text-secondary);font-size:14px;">✗</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                        <td style="padding:10px 4px;color:var(--text-secondary);">Log service records</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                        <td style="padding:10px 4px;color:var(--text-secondary);">Manage reminders</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                    </tr>
                                    <tr>
                                        <td style="padding:10px 4px;color:var(--text-secondary);">Generate reports</td>
                                        <td style="text-align:center;color:var(--success);font-weight:700;font-size:16px;">✓</td>
                                        <td style="text-align:center;color:var(--text-secondary);font-size:14px;">✗</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN -->
                    <div style="display:flex;flex-direction:column;gap:24px;">

                        <!-- Household Section -->
                        <div class="sharing-members-card" style="background:linear-gradient(135deg,rgba(16,185,129,0.04),rgba(99,102,241,0.04));border-color:rgba(16,185,129,0.15);">
                            <!-- Header row -->
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                                <h3 class="detail-section-title" style="margin-bottom:0;"><i class="fas fa-home"></i> Household</h3>
                                ${isOwner ? `
                                    <button class="btn-primary" id="open-invite-btn" style="padding:7px 14px;font-size:12px;gap:7px;">
                                        <i class="fas fa-user-plus"></i> Invite
                                    </button>
                                ` : ''}
                            </div>
                            <p style="font-size:12px;color:var(--text-secondary);margin:4px 0 18px;">
                                <span style="font-weight:700;color:var(--text-primary);">${totalMembers} MEMBER${totalMembers!==1?'S':''}</span>
                                &nbsp;·&nbsp; Family members can view and manage your home appliances.
                            </p>

                            <!-- Member List -->
                            <div class="members-list" style="margin-top:0;gap:10px;">
                                ${membersHTML}
                                ${pendingHTML}
                                ${family.length===0 && pendingInvites.length===0 ? `
                                    <div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;">
                                        <i class="fas fa-users" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px;"></i>
                                        No family members yet. Invite someone to get started.
                                    </div>
                                ` : ''}
                            </div>

                            ${!isOwner ? `
                                <div style="margin-top:16px;padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--card-border);font-size:12px;color:var(--text-secondary);">
                                    <i class="fas fa-info-circle" style="color:var(--primary);margin-right:6px;"></i>
                                    Only the household Owner can invite or remove members.
                                </div>
                            ` : ''}
                        </div>

                        <!-- Supabase configuration is fixed in js/config.js; this legacy form is intentionally hidden. -->
                        <div class="sharing-members-card" style="display:none;">
                            <h3 class="detail-section-title" style="margin-bottom:12px;"><i class="fas fa-database"></i> Cloud Sync</h3>
                            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
                                Connect your Supabase project to enable real-time household sync across devices.
                            </p>
                            <form id="supabase-config-form" style="display:flex;flex-direction:column;gap:16px;">
                                <div class="form-group" style="margin-bottom:0;">
                                    <label for="sb-url" style="font-size:11px;">SUPABASE URL</label>
                                    <input type="text" id="sb-url" placeholder="https://your-project.supabase.co" value="${dbConfig.getSupabaseUrl() || ''}">
                                </div>
                                <div class="form-group" style="margin-bottom:0;">
                                    <label for="sb-key" style="font-size:11px;">SUPABASE ANON KEY</label>
                                    <input type="password" id="sb-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." value="${dbConfig.getSupabaseKey() || ''}">
                                </div>
                                <button type="submit" class="btn-primary" style="justify-content:center;width:100%;margin-top:4px;">
                                    <i class="fas fa-plug"></i> Connect Database
                                </button>
                            </form>
                            ${dbConfig.isConnected() ? `
                                <div style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:var(--success);font-weight:600;">
                                    <i class="fas fa-circle" style="font-size:7px;"></i> Cloud Sync Connected
                                </div>
                            ` : `
                                <div style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:var(--warning);font-weight:600;">
                                    <i class="fas fa-circle" style="font-size:7px;"></i> Running in Local Simulation Mode
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renders Simulated Public QR Portal (what is shown when scan simulation is clicked)
     */
    renderQRPortal(applianceId, state) {
        const appliance = db.getApplianceById(applianceId);
        if (!appliance) {
            return `<div class="page-view"><p>Appliance info is unavailable.</p></div>`;
        }

        const services = db.getServicesForAppliance(applianceId);
        const allServices = db.getServices();
        const health = AnalyticsEngine.calculateHealthScore(appliance, allServices);
        const warrantyExpiry = AnalyticsEngine.getWarrantyExpiryDate(appliance.purchaseDate, appliance.warrantyMonths);
        const isUnderWarranty = AnalyticsEngine.isUnderWarranty(appliance.purchaseDate, appliance.warrantyMonths);

        return `
            <div class="page-view" style="max-width: 600px; margin: 0 auto; padding-top: 20px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 28px; margin-bottom: 12px; box-shadow: 0 4px 12px var(--primary-glow);">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <h2 style="font-family: var(--font-heading); font-size: 24px; font-weight: 800;">AppliTrack QR Portal</h2>
                    <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); margin-top: 4px;">Public Appliance Node</span>
                </div>

                <div class="detail-main-card" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid var(--card-border); padding-bottom: 16px;">
                        <div>
                            <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 700;">${appliance.name}</h3>
                            <div style="font-size: 13px; color: var(--text-secondary);">${appliance.brand} | Model ${appliance.model}</div>
                        </div>
                        <span class="badge ${isUnderWarranty ? 'status-success' : 'status-danger'}">${isUnderWarranty ? 'Under Warranty' : 'Out of Warranty'}</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; margin-bottom: 24px; text-align: left;">
                        <div>
                            <span style="color: var(--text-muted);">SERIAL NUMBER</span>
                            <div style="font-weight: 600; margin-top: 2px;">${appliance.serialNumber || 'N/A'}</div>
                        </div>
                        <div>
                            <span style="color: var(--text-muted);">LOCATION</span>
                            <div style="font-weight: 600; margin-top: 2px;">${appliance.room}</div>
                        </div>
                        <div>
                            <span style="color: var(--text-muted);">WARRANTY EXPIRES</span>
                            <div style="font-weight: 600; margin-top: 2px;">${warrantyExpiry}</div>
                        </div>
                        <div>
                            <span style="color: var(--text-muted);">HEALTH SCORE</span>
                            <div style="font-weight: 700; margin-top: 2px; color: ${health >= 75 ? 'var(--success)' : health >= 40 ? 'var(--warning)' : 'var(--danger)'}">${health}%</div>
                        </div>
                    </div>

                    <div class="qr-portal-contacts">
                        <h4 style="font-size: 14px; font-weight: 700; color: var(--primary); margin-bottom: 12px;"><i class="fas fa-phone-alt"></i> Service Support Contacts</h4>
                        <div class="contact-row">
                            <span>Primary Tech Care</span>
                            <a href="tel:+15551234567" style="color: var(--primary); text-decoration: none; font-weight: 600;">+1 (555) 123-4567</a>
                        </div>
                        <div class="contact-row">
                            <span>Emergency Brand Helpline</span>
                            <a href="tel:+18005559999" style="color: var(--primary); text-decoration: none; font-weight: 600;">1 (800) 555-9999</a>
                        </div>
                        <div class="contact-row" style="border: none;">
                            <span>Active Technician Assigned</span>
                            <span style="font-weight: 600;">David (CoolCare Repairs)</span>
                        </div>
                    </div>
                </div>

                <div class="detail-main-card">
                    <h3 class="detail-section-title" style="font-size: 16px; margin-bottom: 16px;"><i class="fas fa-history"></i> Recent Service Log</h3>
                    ${services.length === 0 ? `
                        <p style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 12px 0;">No active service logs registered.</p>
                    ` : `
                        <div class="log-item" style="padding: 12px; margin-bottom: 0; text-align: left; border-color: var(--secondary)">
                            <div class="log-item-header" style="margin-bottom: 4px;">
                                <span class="log-item-title" style="font-size: 14px;">${services[0].type}</span>
                                <span class="log-item-date">${services[0].date}</span>
                            </div>
                            <p class="log-item-desc" style="font-size: 12px; margin-bottom: 0;">${services[0].description}</p>
                        </div>
                    `}
                </div>

                <button class="btn-secondary" id="portal-exit-btn" style="margin: 24px auto 0; width: 100%; justify-content: center;">
                    <i class="fas fa-arrow-left"></i> Exit Simulated Scan
                </button>
            </div>
        `;
    },

    /**
     * Renders Onboarding Welcome form if database has no users
     */
    renderOnboarding() {
        return `
            <div style="max-width: 500px; margin: 80px auto; padding: 40px; background: var(--card-bg); border-radius: var(--border-radius-lg); border: 1px solid var(--card-border); text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.3); animation: fadeIn 0.35s ease-out;">
                <div class="brand-logo" style="width: 60px; height: 60px; margin: 0 auto 24px; font-size: 30px;">
                    <i class="fas fa-microchip"></i>
                </div>
                <h2 style="font-family: var(--font-heading); font-size: 26px; font-weight: 800; margin-bottom: 12px; background: linear-gradient(135deg, var(--text-primary), var(--text-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Welcome to AppliKeep</h2>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 32px; line-height: 1.6;">
                    Set up your secure household registry to monitor home appliances, log service histories, and analyze maintenance expenditures.
                </p>
                <form id="onboarding-form" style="display: flex; flex-direction: column; gap: 16px; text-align: left;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="owner-name" style="font-size: 11px;">OWNER FULL NAME</label>
                        <input type="text" id="owner-name" placeholder="E.g., Alex Johnson" required style="width: 100%;">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="owner-email" style="font-size: 11px;">EMAIL ADDRESS</label>
                        <input type="email" id="owner-email" placeholder="E.g., alex@applikeep.com" required style="width: 100%;">
                    </div>
                    <button type="submit" class="btn-primary" style="justify-content: center; width: 100%; margin-top: 12px; padding: 12px 24px;">
                        Create Household <i class="fas fa-arrow-right" style="margin-left: 6px;"></i>
                    </button>
                </form>
            </div>
        `;
    },

    renderAuth() {
        return `<div style="max-width:460px;margin:64px auto;padding:40px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--border-radius-lg);box-shadow:0 20px 50px rgba(0,0,0,.3);"><div class="brand-logo" style="margin-bottom:20px;"><i class="fas fa-shield-alt"></i></div><h1 style="font-family:var(--font-heading);font-size:28px;">AppliTrack</h1><p style="color:var(--text-secondary);margin:8px 0 24px;">A secure home for your appliance records.</p><div id="auth-message" style="min-height:20px;color:var(--warning);font-size:13px;margin-bottom:12px;"></div><form id="auth-signin-form" style="display:flex;flex-direction:column;gap:14px;"><div class="form-group" style="margin:0;"><label>Email</label><input id="signin-email" type="email" required autocomplete="email"></div><div class="form-group" style="margin:0;"><label>Password</label><input id="signin-password" type="password" required autocomplete="current-password"></div><button class="btn-primary" style="justify-content:center;">Sign in</button></form><details style="margin-top:24px;"><summary style="cursor:pointer;color:var(--primary);font-weight:600;">Create an account</summary><form id="auth-signup-form" style="display:flex;flex-direction:column;gap:14px;margin-top:16px;"><div class="form-group" style="margin:0;"><label>Name</label><input id="signup-name" required autocomplete="name"></div><div class="form-group" style="margin:0;"><label>Email</label><input id="signup-email" type="email" required autocomplete="email"></div><div class="form-group" style="margin:0;"><label>Password</label><input id="signup-password" type="password" minlength="8" required autocomplete="new-password"></div><button class="btn-secondary" style="justify-content:center;">Create account</button></form></details></div>`;
    }
};
