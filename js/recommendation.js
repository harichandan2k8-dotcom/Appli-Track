/**
 * AppliKeep Analytical & Recommendation Engine
 */

export const AnalyticsEngine = {
    /**
     * Calculates the age of an appliance in years
     */
    getAge(purchaseDateStr) {
        const purchase = new Date(purchaseDateStr);
        const today = new Date();
        const diffTime = Math.abs(today - purchase);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return parseFloat((diffDays / 365.25).toFixed(1));
    },

    /**
     * Checks if the appliance is currently under warranty
     */
    isUnderWarranty(purchaseDateStr, warrantyMonths) {
        if (!warrantyMonths) return false;
        const purchase = new Date(purchaseDateStr);
        const warrantyEndDate = new Date(purchase.setMonth(purchase.getMonth() + warrantyMonths));
        return new Date() < warrantyEndDate;
    },

    /**
     * Returns the warranty expiry date string
     */
    getWarrantyExpiryDate(purchaseDateStr, warrantyMonths) {
        if (!warrantyMonths) return 'N/A';
        const purchase = new Date(purchaseDateStr);
        purchase.setMonth(purchase.getMonth() + warrantyMonths);
        return purchase.toISOString().split('T')[0];
    },

    /**
     * Calculates the overall health score of an appliance (0 to 100)
     */
    calculateHealthScore(appliance, services) {
        const age = this.getAge(appliance.purchaseDate);
        const lifespan = appliance.lifespanYears || 10;
        const price = appliance.purchasePrice || 1;
        
        const totalRepairCost = services
            .filter(srv => srv.applianceId === appliance.id)
            .reduce((sum, srv) => sum + srv.cost, 0);

        let score = 100;

        // 1. Age depreciation (up to 40% drop at typical lifespan end)
        const ageRatio = Math.min(age / lifespan, 1.2); // cap age ratio at 1.2
        score -= ageRatio * 35;

        // 2. Repair cost density (up to 50% drop if repairs equal purchase price)
        const repairRatio = Math.min(totalRepairCost / price, 1.0);
        score -= repairRatio * 45;

        // 3. Current active issues status penalty
        if (appliance.status === 'Needs Service') {
            score -= 15;
        } else if (appliance.status === 'Replace Suggested') {
            score -= 30;
        }

        // Ensure score stays within 5 - 100
        return Math.max(5, Math.min(Math.round(score), 100));
    },

    /**
     * Detailed algorithm suggesting whether to keep, repair, or replace
     */
    getRecommendation(appliance, services) {
        const age = this.getAge(appliance.purchaseDate);
        const lifespan = appliance.lifespanYears || 10;
        const price = appliance.purchasePrice || 1;
        const isUnderWarranty = this.isUnderWarranty(appliance.purchaseDate, appliance.warrantyMonths);

        const applianceServices = services.filter(srv => srv.applianceId === appliance.id);
        const totalRepairCost = applianceServices.reduce((sum, srv) => sum + srv.cost, 0);
        const repairRatio = totalRepairCost / price;
        const healthScore = this.calculateHealthScore(appliance, services);

        // Algorithmic Rules:
        // Rule A: Under Warranty -> Always repair unless complete catastrophic replacement covered
        if (isUnderWarranty) {
            return {
                action: 'Keep & Maintain',
                badgeClass: 'status-success',
                reason: 'Appliance is under manufacturer warranty. Any issues should be serviced for free or low cost.',
                metrics: { age, totalRepairCost, repairRatio, healthScore, isUnderWarranty }
            };
        }

        // Rule B: Age exceeds 100% of standard lifespan AND has ongoing maintenance costs
        if (age >= lifespan) {
            return {
                action: 'Replace Suggested',
                badgeClass: 'status-danger',
                reason: `Appliance is ${age} years old, exceeding its expected lifespan of ${lifespan} years. Future breakdowns are likely and parts may be scarce.`,
                metrics: { age, totalRepairCost, repairRatio, healthScore, isUnderWarranty }
            };
        }

        // Rule C: The "50% rule" - cumulative repairs exceed half the cost of a new appliance
        if (repairRatio >= 0.5) {
            return {
                action: 'Replace Suggested',
                badgeClass: 'status-danger',
                reason: `Cumulative repair costs (₹${totalRepairCost}) have reached ${(repairRatio * 100).toFixed(0)}% of the original purchase price (₹${price}). Replacing is more cost-effective.`,
                metrics: { age, totalRepairCost, repairRatio, healthScore, isUnderWarranty }
            };
        }

        // Rule D: Health score is very low
        if (healthScore < 40) {
            return {
                action: 'Replace Suggested',
                badgeClass: 'status-danger',
                reason: `Overall appliance health is critical (${healthScore}%). Frequent component failures suggest it is nearing end-of-life.`,
                metrics: { age, totalRepairCost, repairRatio, healthScore, isUnderWarranty }
            };
        }

        // Rule E: Active maintenance request
        if (appliance.status === 'Needs Service') {
            return {
                action: 'Schedule Service',
                badgeClass: 'status-warning',
                reason: 'Active maintenance flags are open. Schedule a diagnostic run with a technician to restore full operation.',
                metrics: { age, totalRepairCost, repairRatio, healthScore, isUnderWarranty }
            };
        }

        // Rule F: Safe
        if (healthScore >= 75) {
            return {
                action: 'Keep (Operational)',
                badgeClass: 'status-success',
                reason: `Appliance is running smoothly. Health score is high (${healthScore}%) and depreciation is nominal.`,
                metrics: { age, totalRepairCost, repairRatio, healthScore, isUnderWarranty }
            };
        }

        // Default: Keep but watch
        return {
            action: 'Monitor Health',
            badgeClass: 'status-warning',
            reason: `Appliance is in fair condition. Monitor behavior, perform routine filter swaps, and avoid expensive one-off repairs.`,
            metrics: { age, totalRepairCost, repairRatio, healthScore, isUnderWarranty }
        };
    },

    /**
     * Generates general dashboard statistics and aggregates
     */
    getFinancialAggregates(appliances, services) {
        const totalInvestment = appliances.reduce((sum, app) => sum + app.purchasePrice, 0);
        const totalRepairSpend = services.reduce((sum, srv) => sum + srv.cost, 0);
        
        // Group repair costs by year
        const spendByYear = {};
        services.forEach(srv => {
            const year = new Date(srv.date).getFullYear();
            if (year) {
                spendByYear[year] = (spendByYear[year] || 0) + srv.cost;
            }
        });

        // Group appliances by room
        const appliancesByRoom = {};
        appliances.forEach(app => {
            appliancesByRoom[app.room] = (appliancesByRoom[app.room] || 0) + 1;
        });

        // Group repair costs by category (room)
        const spendByRoom = {};
        services.forEach(srv => {
            const app = appliances.find(a => a.id === srv.applianceId);
            if (app) {
                spendByRoom[app.room] = (spendByRoom[app.room] || 0) + srv.cost;
            }
        });

        // Calculate average health
        let avgHealth = 0;
        if (appliances.length > 0) {
            const totalHealth = appliances.reduce((sum, app) => {
                return sum + this.calculateHealthScore(app, services);
            }, 0);
            avgHealth = Math.round(totalHealth / appliances.length);
        }

        return {
            totalInvestment,
            totalRepairSpend,
            spendByYear,
            appliancesByRoom,
            spendByRoom,
            avgHealth
        };
    }
};
