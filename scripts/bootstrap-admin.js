#!/usr/bin/env node
/**
 * Creates the FIRST administrator of a new CSHARE Firebase project.
 * Run this once, from your own computer, with a service-account key. It is the only way to
 * become an administrator without another administrator: there is deliberately no
 * "make me admin" button in the app, and the security rules forbid it.
 *
 *   cd scripts && npm install
 *   node bootstrap-admin.js ./serviceAccount.json you@example.com "Your Name" "+15550100"
 *
 * The person must already have created an account in the app (or pass --create-password to
 * create the sign-in here). After that, administrators add more administrators inside the app.
 * Refuses to run if an administrator already exists (use --force to override).
 */
const admin = require('firebase-admin');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const [keyPath, email, name = 'Administrator', phone = ''] = args;
const force = flags.includes('--force');
const pwFlag = flags.find(f => f.startsWith('--create-password='));
const password = pwFlag ? pwFlag.split('=')[1] : undefined;

if (!keyPath || !email) {
  console.error('Usage: node bootstrap-admin.js <serviceAccount.json> <email> ["Full Name"] ["+phone"] [--create-password=SECRET] [--force]');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(require('path').resolve(keyPath))) });

(async () => {
  const db = admin.firestore();
  const existing = await db.collection('users').where('role', '==', 'admin').limit(1).get();
  if (!existing.empty && !force) {
    console.error('An administrator already exists. Ask them to make you an administrator inside the app (or use --force).');
    process.exit(2);
  }

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    if (!password) {
      console.error(`No account for ${email} yet. Create it in the app first, or add --create-password=SECRET (min 6 characters).`);
      process.exit(3);
    }
    user = await admin.auth().createUser({ email, password });
    console.log('Created sign-in for', email);
  }

  await db.collection('users').doc(user.uid).set(
    {
      name,
      email,
      phone,
      role: 'admin',
      active: true,
      qualifications: {},
      notificationPreferences: { reminders: true, callStyle: true },
      fcmTokens: [],
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`Done: ${email} is now an active administrator (uid ${user.uid}).`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
