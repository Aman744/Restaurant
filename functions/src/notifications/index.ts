import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const sendNotification = functions.firestore
  .document('tenants/{tenantId}/notifications/{notifId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tenantId, notifId } = context.params;

    if (!data || data.status !== 'pending') {
      return null;
    }

    try {
      console.log(`Processing notification dispatch: ${notifId} for Tenant: ${tenantId}`);
      await snap.ref.update({ status: 'sending', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      const channel = data.channel || 'push';
      const recipient = data.recipient || '';
      const payload = data.payload || {};

      console.log(`[Notification Sim] Channel: ${channel} | Recipient: ${recipient} | Payload: ${JSON.stringify(payload)}`);

      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error: any) {
      console.error(`Error dispatching notification ${notifId}:`, error);
      await snap.ref.update({
        status: 'failed',
        error: error.message || 'Unknown notification dispatch error',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return null;
  });
