import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const updateAnalyticsOnOrderComplete = functions.firestore
  .document('tenants/{tenantId}/orders/{orderId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const { tenantId } = context.params;

    if (!beforeData || !afterData) return null;

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

      const incrementMap: Record<string, any> = {};
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
