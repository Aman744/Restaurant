"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAnalyticsOnOrderComplete = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.updateAnalyticsOnOrderComplete = functions.firestore
    .document('tenants/{tenantId}/orders/{orderId}')
    .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const { tenantId } = context.params;
    if (!beforeData || !afterData)
        return null;
    if (beforeData.status !== 'completed' && afterData.status === 'completed') {
        const grandTotalMinor = afterData.totalsMinor?.grandTotal || Math.round((afterData.totals?.grandTotal || 0) * 100);
        const items = afterData.items || [];
        const db = admin.firestore();
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}_${month}_${day}`;
        const monthKey = `${year}_${month}`;
        const dailyRef = db.doc(`tenants/${tenantId}/analytics/daily/daily_${dateKey}`);
        const monthlyRef = db.doc(`tenants/${tenantId}/analytics/monthly/monthly_${monthKey}`);
        const incrementMap = {};
        for (const item of items) {
            if (item.menuItemId) {
                incrementMap[`topSellingItems.${item.menuItemId}`] = admin.firestore.FieldValue.increment(item.quantity || 1);
            }
        }
        const updatePayload = {
            revenueMinor: admin.firestore.FieldValue.increment(grandTotalMinor),
            ordersCount: admin.firestore.FieldValue.increment(1),
            ...incrementMap,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const batch = db.batch();
        batch.set(dailyRef, updatePayload, { merge: true });
        batch.set(monthlyRef, updatePayload, { merge: true });
        await batch.commit();
        console.log(`Successfully compiled analytics rollups for Completed Order: ${change.after.id}`);
    }
    return null;
});
//# sourceMappingURL=index.js.map