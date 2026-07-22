import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const deleteAuthUser = functions.firestore
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
    } catch (error: any) {
      console.error(`Error deleting auth user ${uid}:`, error);
      await snap.ref.update({
        status: 'failed',
        error: error.message || 'Unknown authentication deletion error',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return null;
  });
