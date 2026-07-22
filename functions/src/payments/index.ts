import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const reconcilePayment = functions.firestore
  .document('tenants/{tenantId}/payments/{paymentId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tenantId, paymentId } = context.params;

    if (!data || data.status !== 'paid') return null;

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
    } catch (error) {
      console.error(`Error reconciling payment ${paymentId}:`, error);
    }
    return null;
  });
