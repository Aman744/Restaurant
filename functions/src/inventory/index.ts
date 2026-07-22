import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const deductInventoryOnOrderCreate = functions.firestore
  .document('tenants/{tenantId}/orders/{orderId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tenantId } = context.params;

    if (!data) return null;

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
