/**
 * Normalize to E.164. Lebanon often arrives as +9610… (local trunk 0 kept);
 * WhatsApp rejects that form — strip the 0 after 961 → +961….
 */
export function toE164Phone(phone: string): string {
  const raw = phone.trim().replace(/[\s\-()]/g, '');
  if (!raw) {
    throw new Error('Phone is required');
  }

  const digits = raw.startsWith('+')
    ? raw.slice(1).replace(/\D/g, '')
    : raw.replace(/\D/g, '');

  if (!digits) {
    throw new Error('Phone is required');
  }

  let e164 = `+${digits}`;

  // +9610XXXXXXXX → +961XXXXXXXX (drop trunk 0 after country code)
  while (e164.startsWith('+9610') && e164.length > '+9610'.length) {
    e164 = `+961${e164.slice('+9610'.length)}`;
  }

  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    throw new Error('Phone must be in E.164 format (e.g. +96170123456)');
  }

  return e164;
}

/** Normalized form plus +9610… variant for DB rows saved before trunk-0 stripping. */
export function phoneMatchVariants(phone: string): string[] {
  const normalized = toE164Phone(phone);
  const variants = new Set<string>([normalized]);
  if (normalized.startsWith('+961') && !normalized.startsWith('+9610')) {
    variants.add(`+9610${normalized.slice('+961'.length)}`);
  }
  const trimmed = phone.trim().replace(/[\s\-()]/g, '');
  if (trimmed.startsWith('+') && /^\+[1-9]\d{6,14}$/.test(trimmed)) {
    variants.add(trimmed);
  }
  return [...variants];
}
