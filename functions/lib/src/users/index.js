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
exports.deleteAuthUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.deleteAuthUser = functions.firestore
    .document('auth_deletion_queue/{uid}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    const uid = context.params.uid;
    if (!data || data.status !== 'pending') {
        return null;
    }
    try {
        console.log(`Starting authentication deletion task for UID: ${uid}`);
        await snap.ref.update({ status: 'processing', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        // Call Admin SDK to delete user account
        await admin.auth().deleteUser(uid);
        console.log(`Successfully deleted auth credentials for UID: ${uid}`);
        await snap.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    catch (error) {
        console.error(`Error deleting auth user ${uid}:`, error);
        await snap.ref.update({
            status: 'failed',
            error: error.message || 'Unknown authentication deletion error',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    return null;
});
//# sourceMappingURL=index.js.map