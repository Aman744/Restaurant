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
exports.deductInventoryOnOrderCreate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.deductInventoryOnOrderCreate = functions.firestore
    .document('tenants/{tenantId}/orders/{orderId}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tenantId } = context.params;
    if (!data)
        return null;
    const items = data.items || [];
    const db = admin.firestore();
    for (const item of items) {
        const menuItemId = item.menuItemId;
        const quantity = item.quantity || 1;
        // Find recipe document
        const recipeRef = db.doc(`tenants/${tenantId}/recipes/${menuItemId}`);
        const recipeSnap = await recipeRef.get();
        if (recipeSnap.exists) {
            const recipeData = recipeSnap.data();
            const ingredients = recipeData?.ingredients || [];
            // Deduct inventory items in batch
            const batch = db.batch();
            for (const ing of ingredients) {
                const invRef = db.doc(`tenants/${tenantId}/inventory/${ing.inventoryItemId}`);
                const qtyRequired = ing.quantityRequired * quantity;
                batch.update(invRef, {
                    availableQty: admin.firestore.FieldValue.increment(-qtyRequired),
                    reservedQty: admin.firestore.FieldValue.increment(qtyRequired),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            await batch.commit();
            console.log(`Reserved inventory for order: ${snap.id}, menuItem: ${menuItemId}`);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map