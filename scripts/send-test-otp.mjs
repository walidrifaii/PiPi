/**
 * Send OTP exactly like WhatsAppNodeService.sendOtpViaNodeCampaign().
 * Usage: node scripts/send-test-otp.mjs +96181281216
 */
import 'dotenv/config';
import { randomInt, randomUUID } from 'crypto';

const REQUEST_TIMEOUT_MS = 20_000;
const phoneArg = process.argv[2];

if (!phoneArg) {
  console.error('Usage: node scripts/send-test-otp.mjs +96181281216');
  process.exit(1);
}

const baseUrl = (process.env.WHATSAPP_NODE_URL ?? '').replace(/\/+$/, '');
const token = process.env.WHATSAPP_NODE_TOKEN ?? '';
const clientId = process.env.WHATSAPP_NODE_CLIENT_ID ?? '';

if (!baseUrl || !token || !clientId) {
  console.error('Missing WHATSAPP_NODE_URL, WHATSAPP_NODE_TOKEN, or WHATSAPP_NODE_CLIENT_ID in .env');
  process.exit(1);
}

/** Same as athar/src/common/phone-e164.ts toE164Phone */
function toE164Phone(phone) {
  const raw = phone.trim().replace(/[\s\-()]/g, '');
  const digits = raw.startsWith('+') ? raw.slice(1).replace(/\D/g, '') : raw.replace(/\D/g, '');
  let e164 = `+${digits}`;
  while (e164.startsWith('+9610') && e164.length > '+9610'.length) {
    e164 = `+961${e164.slice('+9610'.length)}`;
  }
  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    throw new Error(`Invalid E.164 phone: ${phone}`);
  }
  return e164;
}

/** Same as WhatsAppNodeService.phoneForNode */
function phoneForNode(phoneE164) {
  let e164 = phoneE164.trim();
  while (e164.startsWith('+9610') && e164.length > '+9610'.length) {
    e164 = `+961${e164.slice('+9610'.length)}`;
  }
  return e164.replace(/\D/g, '');
}

function readNestedId(body, path) {
  const parts = path.split('.');
  let current = body;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  if (typeof current === 'string' || typeof current === 'number') return current;
  return undefined;
}

async function postJson(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let body = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw */
    }
    return { ok: res.ok, http: res.status, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = err instanceof Error && (err.name === 'AbortError' || message.includes('aborted'));
    return { ok: false, timedOut, details: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw */
  }
  return { ok: res.ok, http: res.status, body };
}

/** Same as WhatsAppNodeService.uploadContactCsv */
async function uploadContactCsv(campaignId, phoneE164) {
  const phone = phoneForNode(phoneE164);
  const csv = `phone,name\n${phone},User\n`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append('contacts', new Blob([csv], { type: 'text/csv' }), 'contacts.csv');
    const res = await fetch(`${baseUrl}/api/contacts/${campaignId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    let body = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw */
    }
    return { ok: res.ok, http: res.status, body, phoneDigits: phone };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = err instanceof Error && (err.name === 'AbortError' || message.includes('aborted'));
    return { ok: false, timedOut, details: message };
  } finally {
    clearTimeout(timeout);
  }
}

/** Mirrors WhatsAppNodeService.sendOtpViaNodeCampaign */
async function sendOtpViaNodeCampaign(phoneE164, code) {
  const campaignName = `otp_${randomUUID().replace(/-/g, '')}`;
  const message = `Your verification code is ${code}. It expires in 5 minutes. Do not share it with anyone.`;

  const create = await postJson(`${baseUrl}/api/campaigns`, {
    name: campaignName,
    message,
    clientId,
  });
  if (!create.ok) {
    throw new Error(`campaign_create failed (${create.http}): ${JSON.stringify(create.body)}`);
  }

  const campaignId =
    readNestedId(create.body, 'campaign._id') ?? readNestedId(create.body, 'campaign.id');
  if (!campaignId) {
    throw new Error(`no_campaign_id: ${JSON.stringify(create.body)}`);
  }

  const add = await uploadContactCsv(String(campaignId), phoneE164);
  if (!add.ok) {
    throw new Error(`contact_add failed (${add.http}): ${JSON.stringify(add.body)}`);
  }

  const start = await postJson(`${baseUrl}/api/campaigns/${campaignId}/start`, {});
  if (!start.ok) {
    throw new Error(`campaign_start failed (${start.http}): ${JSON.stringify(start.body)}`);
  }

  return { campaignName, campaignId: String(campaignId), message, phoneDigits: add.phoneDigits };
}

async function waitForDelivery(campaignId, maxWaitMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const campaign = await getJson(`${baseUrl}/api/campaigns/${campaignId}`);
    const contacts = await getJson(`${baseUrl}/api/contacts/${campaignId}`);
    const c = campaign.body?.campaign;
    const contact = contacts.body?.contacts?.[0];

    if (c?.status === 'completed' || c?.status === 'failed') {
      return { campaign: c, contact };
    }
    if (contact && contact.status !== 'pending') {
      return { campaign: c, contact };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { campaign: null, contact: null, timedOut: true };
}

const phoneE164 = toE164Phone(phoneArg);
const code = randomInt(100_000, 1_000_000);

console.log('Backend OTP flow (same as WhatsAppNodeService):');
console.log(`  1. Normalize phone → ${phoneE164} → Node digits ${phoneForNode(phoneE164)}`);
console.log(`  2. Generate code → ${code}`);
console.log(`  3. POST /api/campaigns`);
console.log(`  4. POST /api/contacts/{id}/upload  (CSV: phone,name)`);
console.log(`  5. POST /api/campaigns/{id}/start`);
console.log('');

try {
  const result = await sendOtpViaNodeCampaign(phoneE164, code);
  console.log(`Campaign started: ${result.campaignName} (${result.campaignId})`);
  console.log('Waiting for WhatsApp delivery status...');

  const delivery = await waitForDelivery(result.campaignId);
  const senderPhone = delivery.campaign?.clientId?.phone ?? 'unknown';

  console.log('');
  console.log('Result:');
  console.log(`  Phone (E.164):     ${phoneE164}`);
  console.log(`  Phone (Node CSV):  ${result.phoneDigits}`);
  console.log(`  OTP code:          ${code}`);
  console.log(`  Sender WhatsApp:   +${senderPhone}`);
  console.log(`  Campaign status:   ${delivery.campaign?.status ?? 'unknown'}`);
  console.log(`  Contact status:    ${delivery.contact?.status ?? 'unknown'}`);
  console.log(`  Contact error:     ${delivery.contact?.error ?? 'none'}`);
  console.log(`  sent/failed:       ${delivery.campaign?.sentCount ?? 0}/${delivery.campaign?.failedCount ?? 0}`);

  if (delivery.contact?.status === 'sent') {
    console.log('');
    console.log('Server says SENT. Check WhatsApp on the phone for a message from +' + senderPhone);
    console.log('Also check Message requests / spam if the chat is new.');
  } else if (delivery.contact?.status === 'failed') {
    console.error('');
    console.error('Delivery FAILED on WhatsApp Node:', delivery.contact.error);
    process.exit(1);
  }
} catch (err) {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
