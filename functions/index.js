const { google } = require('googleapis');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();

const spreadsheetId = '1pVUGlyoAqBV2OqW6JqF522mqFKwtEYUAjsWlAdwJ9iU';
const sheetRange = "'ชีต1'!A:H";
const authEmailDomain = 'auth.carofgot.invalid';

function normalizeEmployeeId(value) {
  return String(value || '').trim();
}

function employeeAuthEmail(employeeId) {
  return `emp.${employeeId.toLowerCase()}@${authEmailDomain}`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (!digits || /^0+$/.test(digits)) return '';
  if (digits.startsWith('66')) return `+${digits}`;
  if (digits.startsWith('0')) return `+66${digits.slice(1)}`;
  return `+${digits}`;
}

async function getEmployeeRows() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const [headers = [], ...rows] = response.data.values || [];
  const headerIndex = label => headers.findIndex(value => String(value || '').trim() === label);
  const columns = {
    department: headerIndex('สังกัด'),
    position: headerIndex('ตำแหน่ง'),
    employeeId: headerIndex('รหัสพนักงาน'),
    fullName: headerIndex('ชื่อ-สกุล'),
    mobilePhone: headerIndex('เบอร์โทรศัพท์'),
    status: headerIndex('สถานะบัญชี'),
  };

  if (Object.values(columns).some(index => index < 0)) {
    throw new HttpsError('failed-precondition', 'The employee sheet is missing a required column.');
  }

  return rows.map(row => ({
    employeeId: normalizeEmployeeId(row[columns.employeeId]),
    department: String(row[columns.department] || '').trim(),
    position: String(row[columns.position] || '').trim(),
    fullName: String(row[columns.fullName] || '').trim(),
    phone: normalizePhone(row[columns.mobilePhone]),
    status: columns.status < 0 ? '' : String(row[columns.status] || '').trim().toLowerCase(),
  })).filter(row => row.employeeId);
}

exports.completeEmployeeRegistration = onCall({ region: 'asia-southeast1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Verify the employee mobile number first.');
  }

  const employeeId = normalizeEmployeeId(request.data?.employeeId);
  const password = String(request.data?.password || '');
  if (!/^[a-zA-Z0-9._-]{1,40}$/.test(employeeId)) {
    throw new HttpsError('invalid-argument', 'Enter a valid employee ID.');
  }
  if (password.length < 8 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'Password must be between 8 and 128 characters.');
  }

  const verifiedPhone = normalizePhone(request.auth.token.phone_number);
  if (!verifiedPhone) {
    throw new HttpsError('failed-precondition', 'Verify the employee mobile number first.');
  }

  let rows;
  try {
    rows = await getEmployeeRows();
  } catch (error) {
    console.error('Unable to read employee roster:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'Employee roster is temporarily unavailable.');
  }

  const matches = rows.filter(row => row.employeeId.toLowerCase() === employeeId.toLowerCase());
  if (matches.length !== 1) {
    throw new HttpsError('failed-precondition', 'Employee record is missing or duplicated. Contact HR.');
  }

  const employee = matches[0];
  if (!['active', 'ใช้งาน'].includes(employee.status)) {
    throw new HttpsError('permission-denied', 'This employee account is not active.');
  }
  const phoneMatches = rows.filter(row => row.phone === employee.phone && ['active', 'ใช้งาน'].includes(row.status));
  if (phoneMatches.length !== 1) {
    throw new HttpsError('failed-precondition', 'The employee mobile number is duplicated. Contact HR.');
  }
  if (!employee.fullName || !employee.department || !employee.phone || employee.phone !== verifiedPhone) {
    throw new HttpsError('permission-denied', 'The verified phone does not match the employee roster.');
  }

  const auth = getAuth();
  const uid = request.auth.uid;
  const email = employeeAuthEmail(employee.employeeId);
  try {
    const existingAccount = await auth.getUserByEmail(email);
    if (existingAccount.uid !== uid) {
      throw new HttpsError('already-exists', 'This employee ID already has an account.');
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code !== 'auth/user-not-found') throw error;
  }

  const profile = {
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    department: employee.department,
    position: employee.position,
    phone: employee.phone,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const authenticatedUser = await auth.getUser(uid);
  await auth.updateUser(uid, {
    email,
    password,
    displayName: employee.fullName,
  });
  await auth.setCustomUserClaims(uid, {
    role: authenticatedUser.customClaims?.role === 'admin' ? 'admin' : 'user',
    employeeId: employee.employeeId,
  });
  await getFirestore().collection('employeeProfiles').doc(uid).set(profile, { merge: true });

  return { ok: true, profile: { ...profile, updatedAt: null } };
});