const UNITS = [
  'zero',
  'um',
  'dois',
  'tres',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
];

const TEENS = [
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];

const TENS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];

const HUNDREDS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function joinWithE(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(' e ');
}

function toWordsBelowOneThousand(value: number): string {
  if (value === 0) return '';
  if (value < 10) return UNITS[value]!;
  if (value < 20) return TEENS[value - 10]!;

  if (value < 100) {
    const ten = Math.floor(value / 10);
    const unit = value % 10;
    if (unit === 0) return TENS[ten]!;
    return `${TENS[ten]} e ${UNITS[unit]}`;
  }

  if (value === 100) {
    return 'cem';
  }

  const hundred = Math.floor(value / 100);
  const remainder = value % 100;
  if (remainder === 0) return HUNDREDS[hundred]!;
  return `${HUNDREDS[hundred]} e ${toWordsBelowOneThousand(remainder)}`;
}

function toPortugueseCardinal(value: number): string {
  const normalized = Math.floor(Math.abs(value));
  if (normalized === 0) return UNITS[0]!;

  const millions = Math.floor(normalized / 1_000_000);
  const thousands = Math.floor((normalized % 1_000_000) / 1_000);
  const hundreds = normalized % 1_000;
  const parts: string[] = [];

  if (millions > 0) {
    if (millions === 1) {
      parts.push('um milhao');
    } else {
      parts.push(`${toWordsBelowOneThousand(millions)} milhoes`);
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mil');
    } else {
      parts.push(`${toWordsBelowOneThousand(thousands)} mil`);
    }
  }

  if (hundreds > 0) {
    parts.push(toWordsBelowOneThousand(hundreds));
  }

  if (parts.length === 1) {
    return parts[0]!;
  }

  return joinWithE(parts);
}

function parseCurrencyToken(raw: string): { integer: number; cents: number } | null {
  const normalized = raw.replaceAll('.', '').replaceAll(',', '.').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const value = Math.max(0, parsed);
  const integer = Math.floor(value);
  const cents = Math.round((value - integer) * 100);
  return { integer, cents };
}

function toCurrencyWords(raw: string): string | null {
  const parsed = parseCurrencyToken(raw);
  if (!parsed) return null;

  const reaisWord = parsed.integer === 1 ? 'real' : 'reais';
  const centavosWord = parsed.cents === 1 ? 'centavo' : 'centavos';
  const moneyParts: string[] = [];

  if (parsed.integer > 0) {
    moneyParts.push(`${toPortugueseCardinal(parsed.integer)} ${reaisWord}`);
  }

  if (parsed.cents > 0) {
    moneyParts.push(`${toPortugueseCardinal(parsed.cents)} ${centavosWord}`);
  }

  if (moneyParts.length === 0) {
    return 'zero real';
  }

  return joinWithE(moneyParts);
}

function normalizeShadeCode(letter: string, digit: string): string {
  const parsedDigit = Number(digit);
  if (!Number.isInteger(parsedDigit) || parsedDigit < 0 || parsedDigit > 9) {
    return `${letter} ${digit}`;
  }
  return `${letter} ${UNITS[parsedDigit]}`;
}

function applyVoiceTemplates(text: string): string {
  let output = escapeXml(text);

  output = output.replace(
    /\bOS\s+(\d{1,8})\b/gi,
    (_, rawCode: string) =>
      `<say-as interpret-as="characters">OS</say-as> <say-as interpret-as="cardinal">${rawCode}</say-as>`,
  );

  output = output.replace(
    /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)/g,
    (fullMatch: string, amount: string) => toCurrencyWords(amount) ?? fullMatch,
  );

  output = output.replace(/\b([ABCDEF])\s?([0-9])\b/g, (_, letter: string, digit: string) =>
    normalizeShadeCode(letter, digit));

  return output;
}

export function toTtsSsml(text: string): string {
  const normalized = applyVoiceTemplates(text.trim());
  return `<speak>${normalized}</speak>`;
}
