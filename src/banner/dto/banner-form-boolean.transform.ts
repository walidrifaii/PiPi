/** Parse boolean from JSON body or multipart form strings. */
export function parseOptionalFormBoolean(value: unknown): boolean | undefined {
  if (value === true || value === false) {
    return value;
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') {
      return true;
    }
    if (v === 'false' || v === '0') {
      return false;
    }
  }
  return undefined;
}
