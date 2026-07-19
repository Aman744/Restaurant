/**
 * Local Emulator Seeding Script
 * 
 * Instructions:
 * 1. Install firebase-admin: `npm i -D firebase-admin` in this package
 * 2. Set environment variables to target local emulator
 * 3. Run: `node seed-emulator.js`
 */

const admin = require('firebase-admin');

// Point admin SDK strictly to local running emulator ports
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({
  projectId: 'restaurant-qr-dev'
});

const auth = admin.auth();

const seedUsers = [
  {
    email: 'superadmin@example.com',
    role: 'super-admin',
    displayName: 'SUPER ADMIN'
  },
  {
    email: 'admin@example.com',
    role: 'restaurant-admin',
    tenantId: 'tenant_dev_123',
    displayName: 'RESTAURANT ADMIN'
  },
  {
    email: 'manager@example.com',
    role: 'manager',
    tenantId: 'tenant_dev_123',
    displayName: 'RESTAURANT MANAGER'
  },
  {
    email: 'kitchen@example.com',
    role: 'kitchen-staff',
    tenantId: 'tenant_dev_123',
    displayName: 'KITCHEN HEAD'
  },
  {
    email: 'waiter@example.com',
    role: 'waiter',
    tenantId: 'tenant_dev_123',
    displayName: 'TABLE SERVING STAFF'
  },
  {
    email: 'cashier@example.com',
    role: 'cashier',
    tenantId: 'tenant_dev_123',
    displayName: 'CASHIER BILLING'
  }
];

async function runSeed() {
  console.log('--- Initializing Emulator Auth Seeding ---');
  
  for (const user of seedUsers) {
    try {
      // 1. Create raw login profile
      const record = await auth.createUser({
        email: user.email,
        password: 'Admin@123',
        emailVerified: true,
        displayName: user.displayName
      });

      // 2. Provision Custom JWT Claims (RBAC)
      await auth.setCustomUserClaims(record.uid, {
        role: user.role,
        tenantId: user.tenantId || null
      });

      console.log(`✔ Created user: ${user.email} with Role: [${user.role}]`);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        console.log(`ℹ User ${user.email} already exists. Skipping.`);
      } else {
        console.error(`✖ Failed to provision ${user.email}:`, err.message);
      }
    }
  }
  
  console.log('--- Seeding Complete ---');
}

runSeed();
