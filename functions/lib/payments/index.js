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
exports.reconcilePayment = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.reconcilePayment = functions.firestore
    .document('tenants/{tenantId}/payments/{paymentId}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tenantId, paymentId } = context.params;
    if (!data || data.status !== 'paid')
        return null;
    const db = admin.firestore();
    const orderId = data.orderId;
    const amountMinor = data.amountMinor || 0;
    try {
        console.log(`Reconciling payment: ${paymentId} for Order: ${orderId}`);
        const orderRef = db.doc(`tenants/${tenantId}/orders/${orderId}`);
        const orderSnap = await orderRef.get();
        if (orderSnap.exists) {
            const orderData = orderSnap.data();
            if (orderData && orderData.status !== 'completed') {
                const batch = db.batch();
                batch.update(orderRef, {
                    status: 'completed',
                    'payment.status': 'paid',
                    'payment.transactionId': data.transactionId || null,
                    'payment.method': data.gateway || 'cash',
                    'payment.amountPaidMinor': amountMinor,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                const customerId = orderData.customerId;
                if (customerId) {
                    const pointsEarned = Math.floor(amountMinor / 1000);
                    if (pointsEarned > 0) {
                        const ledgerRef = db.collection(`tenants/${tenantId}/loyalty`).doc();
                        batch.set(ledgerRef, {
                            customerId,
                            points: pointsEarned,
                            reason: 'order_placement',
                            orderId,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        const customerRef = db.doc(`tenants/${tenantId}/customers/${customerId}`);
                        batch.update(customerRef, {
                            loyaltyPoints: admin.firestore.FieldValue.increment(pointsEarned),
                            totalOrders: admin.firestore.FieldValue.increment(1),
                            lifetimeSpendMinor: admin.firestore.FieldValue.increment(amountMinor),
                            lastVisit: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
                await batch.commit();
                console.log(`Successfully reconciled payment and loyalty points for Order: ${orderId}`);
            }
        }
    }
    catch (error) {
        console.error(`Error reconciling payment ${paymentId}:`, error);
    }
    return null;
});
//# sourceMappingURL=index.js.map