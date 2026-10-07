const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const projectId = 'carforrent-d4b1e';
const employeeId = String(process.argv[2] || '').trim();

if (!/^[a-zA-Z0-9._-]{1,40}$/.test(employeeId)) {
  console.error('Usage: node set-admin-role.js <employeeId>');
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const email = `emp.${employeeId.toLowerCase()}@auth.carofgot.invalid`;

getAuth().getUserByEmail(email)
  .then(user => getAuth().setCustomUserClaims(user.uid, { role: 'admin', employeeId }))
  .then(() => console.log(`Admin role assigned to employee ${employeeId}. Sign out and sign in again to refresh claims.`))
  .catch(error => {
    console.error('Unable to assign admin role:', error.message);
    process.exitCode = 1;
  });