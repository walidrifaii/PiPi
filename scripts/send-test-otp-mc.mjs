/**
 * Test Message Central VerifyNow WhatsApp OTP.
 * Usage: node scripts/send-test-otp-mc.mjs +96181281216
 */
import 'dotenv/config';

const phoneArg = process.argv[2];
if (!phoneArg) {
  console.error('Usage: node scripts/send-test-otp-mc.mjs +96181281216');
  process.exit(1);
}

const baseUrl = (process.env.MESSAGE_CENTRAL_BASE_URL ?? 'https://cpaas.messagecentral.com').replace(/\/+$/, '');
const customerId = process.env.MESSAGE_CENTRAL_CUSTOMER_ID ?? '';
const key = process.env.MESSAGE_CENTRAL_KEY ?? '';
const authTokenEnv = process.env.MESSAGE_CENTRAL_AUTH_TOKEN?.trim() ?? '';
const countryCode = process.env.MESSAGE_CENTRAL_COUNTRY_CODE ?? '961';
const flowType = process.env.MESSAGE_CENTRAL_FLOW_TYPE ?? 'WHATSAPP';
const otpLength = process.env.MESSAGE_CENTRAL_OTP_LENGTH ?? '6';

if (!customerId || (!authTokenEnv && !key)) {
  console.error('Set MESSAGE_CENTRAL_CUSTOMER_ID and MESSAGE_CENTRAL_AUTH_TOKEN (or MESSAGE_CENTRAL_KEY) in .env');
  process.exit(1);
}

function toE164(phone) {
  let e164 = phone.trim().replace(/[\s\-()]/g, '');
  if (!e164.startsWith('+')) e164 = `+${e164.replace(/\D/g, '')}`;
  while (e164.startsWith('+9610') && e164.length > '+9610'.length) {
    e164 = `+961${e164.slice('+9610'.length)}`;
  }
  return e164;
}

function phoneParts(phoneE164) {
  let digits = phoneE164.replace(/\D/g, '');
  if (digits.startsWith(countryCode)) digits = digits.slice(countryCode.length);
  while (digits.startsWith('0') && digits.length > 1) digits = digits.slice(1);
  return { countryCode, mobileNumber: digits };
}

async function getAuthToken() {
  if (authTokenEnv) return authTokenEnv;

  const params = new URLSearchParams({
    customerId,
    key,
    scope: process.env.MESSAGE_CENTRAL_AUTH_SCOPE ?? 'NEW',
    country: countryCode,
  });
  const email = process.env.MESSAGE_CENTRAL_EMAIL?.trim();
  if (email) params.set('email', email);

  const res = await fetch(`${baseUrl}/auth/v1/authentication/token?${params}`, {
    headers: { accept: '*/*' },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Auth failed (${res.status}): ${JSON.stringify(body)}`);
  }
  const token = body?.data?.authToken;
  if (!token) throw new Error(`No authToken: ${JSON.stringify(body)}`);
  return token;
}

const phoneE164 = toE164(phoneArg);
const { mobileNumber } = phoneParts(phoneE164);

console.log('Message Central VerifyNow flow:');
if (authTokenEnv) {
  console.log('  1. Using MESSAGE_CENTRAL_AUTH_TOKEN from .env');
} else {
  console.log('  1. GET /auth/v1/authentication/token');
}
console.log(`  2. POST /verification/v3/send  flowType=${flowType}`);
console.log(`  Phone: ${phoneE164} → country=${countryCode} mobile=${mobileNumber}`);
console.log('');

const authToken = await getAuthToken();
console.log('Auth token OK');

const sendParams = new URLSearchParams({
  countryCode,
  flowType,
  mobileNumber,
  otpLength,
});
const sendRes = await fetch(`${baseUrl}/verification/v3/send?${sendParams}`, {
  method: 'POST',
  headers: { accept: '*/*', authToken },
});
const sendBody = await sendRes.json();

if (!sendRes.ok) {
  console.error('Send failed:', sendRes.status, sendBody);
  const msg = sendBody?.message ?? sendBody?.data?.errorMessage;
  if (msg?.toLowerCase().includes('discontinued')) {
    console.error('\nWhatsApp OTP old API is discontinued on Message Central.');
    console.error('Ask Message Central to enable the new WhatsApp platform, or set MESSAGE_CENTRAL_FLOW_TYPE=SMS and add credits.');
  }
  if (String(sendBody?.responseCode) === '508' || msg?.toLowerCase().includes('insufficient credits')) {
    console.error('\nAccount has insufficient credits. Top up at console.messagecentral.com');
  }
  process.exit(1);
}

const data = sendBody?.data ?? {};
console.log('');
console.log('OTP sent via Message Central WhatsApp:');
console.log(`  verificationId: ${data.verificationId ?? 'n/a'}`);
console.log(`  mobileNumber:   ${data.mobileNumber ?? mobileNumber}`);
console.log(`  timeout:        ${data.timeout ?? 'n/a'}s`);
console.log(`  responseCode:   ${data.responseCode ?? sendBody.responseCode}`);
console.log('');
console.log('Validate with:');
console.log(`  POST /verification/v3/validateOtp?verificationId=${data.verificationId}&code=YOUR_CODE`);
