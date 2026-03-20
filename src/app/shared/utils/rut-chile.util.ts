export function normalizeRut(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^0-9K]/g, '');
}

export function formatRutChile(input: string | null | undefined): string {
  const normalized = normalizeRut(input);
  if (!normalized) return '';

  if (normalized.length === 1) {
    return normalized;
  }

  const dv = normalized.slice(-1);
  let body = normalized.slice(0, -1);
  const parts: string[] = [];

  while (body.length > 3) {
    parts.unshift(body.slice(-3));
    body = body.slice(0, -3);
  }

  if (body) {
    parts.unshift(body);
  }

  return `${parts.join('.')}-${dv}`;
}

export function isRutChileValidFormat(input: string | null | undefined): boolean {
  if (!input) return false;
  const normalized = normalizeRut(input);
  return /^\d{7,8}[0-9K]$/.test(normalized);
}
