import { createHash } from 'node:crypto';
import { logger } from '../../../logger.js';
import { recordAiInjectionAttempt } from '../../../metrics/ai-metrics.js';
import type { FlowCommandName } from '../command-parser.js';

const MAX_SANITIZED_TEXT_LENGTH = 2000;

const CONFUSABLE_FOLD_MAP: Record<string, string> = {
  'і': 'i', // Cyrillic small byelorussian-ukrainian i
  'І': 'I', // Cyrillic capital byelorussian-ukrainian i
};

const SYSTEM_PROMPT_HIJACK_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'ignore_instructions', regex: /ignore\s+(previous|all|prior)\s+(instructions?|prompts?)/gi },
  { name: 'system_prefix', regex: /system\s*:\s*/gi },
  { name: 'inst_tokens', regex: /\[INST\]|\[\/INST\]/g },
  { name: 'special_tokens', regex: /<\|.*?\|>/g },
  { name: 'fenced_system', regex: /```system/gi },
];

const COMMAND_FREE_TEXT_FIELDS: Partial<Record<FlowCommandName, string[]>> = {
  'jobs.createDraft': ['notes', 'patientName'],
  'jobs.finalize': ['notes'],
  'jobs.statusUpdate': ['note', 'cancelReason'],
  'messages.draftToClient': ['messageContext'],
  'purchases.create': ['notes'],
};

export type SanitizeUserTextResult = {
  clean: string;
  suspicious: boolean;
  matchedPatterns: string[];
  originalHash: string;
};

export type SanitizeToolInputContext = {
  tenantId: number;
  userId: number;
};

function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function foldConfusables(value: string): string {
  return Array.from(value, (char) => CONFUSABLE_FOLD_MAP[char] ?? char).join('');
}

export function sanitizeUserText(input: string): SanitizeUserTextResult {
  const normalizedInput = foldConfusables(input.normalize('NFKC'));
  const originalHash = hashText(normalizedInput);

  let clean = normalizedInput;
  const matchedPatterns = new Set<string>();

  for (const pattern of SYSTEM_PROMPT_HIJACK_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    if (regex.test(clean)) {
      matchedPatterns.add(pattern.name);
      clean = clean.replace(regex, '[filtered]');
    }
  }

  clean = clean
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length > MAX_SANITIZED_TEXT_LENGTH) {
    clean = clean.slice(0, MAX_SANITIZED_TEXT_LENGTH);
  }

  return {
    clean,
    suspicious: matchedPatterns.size > 0,
    matchedPatterns: [...matchedPatterns],
    originalHash,
  };
}

export function sanitizeToolInput(
  command: FlowCommandName,
  rawInput: unknown,
  context: SanitizeToolInputContext,
): {
  input: unknown;
  suspicious: boolean;
} {
  const fields = COMMAND_FREE_TEXT_FIELDS[command];
  if (!fields || fields.length === 0) {
    return { input: rawInput, suspicious: false };
  }

  if (!rawInput || typeof rawInput !== 'object') {
    return { input: rawInput, suspicious: false };
  }

  const sanitizedInput = { ...(rawInput as Record<string, unknown>) };
  let suspicious = false;

  for (const field of fields) {
    const value = sanitizedInput[field];
    if (typeof value !== 'string') continue;

    const result = sanitizeUserText(value);
    sanitizedInput[field] = result.clean;

    if (!result.suspicious) continue;
    suspicious = true;

    for (const pattern of result.matchedPatterns) {
      recordAiInjectionAttempt(context.tenantId, pattern);
      logger.warn(
        {
          action: 'ai.injection.attempt',
          tenantId: context.tenantId,
          userId: context.userId,
          command,
          field,
          pattern,
          originalHash: result.originalHash,
        },
        'Tentativa de prompt injection filtrada',
      );
    }
  }

  return {
    input: sanitizedInput,
    suspicious,
  };
}
