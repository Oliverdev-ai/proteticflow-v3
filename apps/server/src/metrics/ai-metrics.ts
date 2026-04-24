type LabelValue = string | number | boolean | null | undefined;
type LabelSet = Record<string, LabelValue>;

type CounterLikeOptions = {
  name: string;
  help: string;
  labelNames?: string[];
};

const TENANT_LABEL_LIMIT = Number.parseInt(
  process.env.AI_METRICS_TENANT_CARDINALITY_LIMIT ?? '500',
  10,
);

const tenantLabelById = new Map<number, string>();

function toFiniteNumber(value: LabelValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeTenantLabel(value: LabelValue): string {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return 'unknown';
  const tenantId = Math.trunc(numeric);
  if (tenantLabelById.has(tenantId)) return tenantLabelById.get(tenantId)!;

  if (tenantLabelById.size >= TENANT_LABEL_LIMIT) {
    return 'other';
  }

  const next = String(tenantId);
  tenantLabelById.set(tenantId, next);
  return next;
}

function normalizeLabel(labelName: string, value: LabelValue): string {
  if (labelName === 'tenantId' || labelName === 'tenant_id') {
    return normalizeTenantLabel(value);
  }

  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return 'unknown';
}

function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(',')}}`;
}

function normalizeLabelSet(labelNames: string[], labels: LabelSet): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const labelName of labelNames) {
    normalized[labelName] = normalizeLabel(labelName, labels[labelName]);
  }
  return normalized;
}

function buildLabelKey(labelNames: string[], labels: Record<string, string>): string {
  return labelNames.map((name) => `${name}=${labels[name] ?? ''}`).join('|');
}

class CounterMetric {
  private readonly labelNames: string[];

  private readonly samples = new Map<string, { labels: Record<string, string>; value: number }>();

  constructor(private readonly options: CounterLikeOptions) {
    this.labelNames = options.labelNames ?? [];
  }

  inc(labels: LabelSet = {}, value = 1): void {
    if (!Number.isFinite(value) || value <= 0) return;
    const normalized = normalizeLabelSet(this.labelNames, labels);
    const key = buildLabelKey(this.labelNames, normalized);
    const previous = this.samples.get(key);
    this.samples.set(key, {
      labels: normalized,
      value: (previous?.value ?? 0) + value,
    });
  }

  render(): string {
    const lines = [
      `# HELP ${this.options.name} ${this.options.help}`,
      `# TYPE ${this.options.name} counter`,
    ];

    if (this.samples.size === 0) {
      lines.push(`${this.options.name} 0`);
      return lines.join('\n');
    }

    for (const sample of this.samples.values()) {
      lines.push(`${this.options.name}${formatLabels(sample.labels)} ${sample.value}`);
    }

    return lines.join('\n');
  }
}

class GaugeMetric {
  private readonly labelNames: string[];

  private readonly samples = new Map<string, { labels: Record<string, string>; value: number }>();

  constructor(private readonly options: CounterLikeOptions) {
    this.labelNames = options.labelNames ?? [];
  }

  set(labels: LabelSet = {}, value: number): void {
    if (!Number.isFinite(value)) return;
    const normalized = normalizeLabelSet(this.labelNames, labels);
    const key = buildLabelKey(this.labelNames, normalized);
    this.samples.set(key, { labels: normalized, value });
  }

  render(): string {
    const lines = [
      `# HELP ${this.options.name} ${this.options.help}`,
      `# TYPE ${this.options.name} gauge`,
    ];

    if (this.samples.size === 0) {
      lines.push(`${this.options.name} 0`);
      return lines.join('\n');
    }

    for (const sample of this.samples.values()) {
      lines.push(`${this.options.name}${formatLabels(sample.labels)} ${sample.value}`);
    }

    return lines.join('\n');
  }
}

class HistogramMetric {
  private readonly labelNames: string[];

  private readonly buckets: number[];

  private readonly samples = new Map<string, {
    labels: Record<string, string>;
    bucketCounts: number[];
    sum: number;
    count: number;
  }>();

  constructor(
    private readonly options: CounterLikeOptions & { buckets: number[] },
  ) {
    this.labelNames = options.labelNames ?? [];
    this.buckets = [...options.buckets].sort((a, b) => a - b);
  }

  observe(labels: LabelSet = {}, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    const normalized = normalizeLabelSet(this.labelNames, labels);
    const key = buildLabelKey(this.labelNames, normalized);
    const current = this.samples.get(key) ?? {
      labels: normalized,
      bucketCounts: this.buckets.map(() => 0),
      sum: 0,
      count: 0,
    };

    for (let idx = 0; idx < this.buckets.length; idx += 1) {
      if (value <= this.buckets[idx]!) {
        current.bucketCounts[idx]! += 1;
      }
    }

    current.sum += value;
    current.count += 1;
    this.samples.set(key, current);
  }

  render(): string {
    const lines = [
      `# HELP ${this.options.name} ${this.options.help}`,
      `# TYPE ${this.options.name} histogram`,
    ];

    if (this.samples.size === 0) {
      lines.push(`${this.options.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.options.name}_sum 0`);
      lines.push(`${this.options.name}_count 0`);
      return lines.join('\n');
    }

    for (const sample of this.samples.values()) {
      let cumulative = 0;
      for (let idx = 0; idx < this.buckets.length; idx += 1) {
        cumulative = sample.bucketCounts[idx] ?? cumulative;
        const labels = {
          ...sample.labels,
          le: String(this.buckets[idx]!),
        };
        lines.push(`${this.options.name}_bucket${formatLabels(labels)} ${cumulative}`);
      }

      const infLabels = {
        ...sample.labels,
        le: '+Inf',
      };
      lines.push(`${this.options.name}_bucket${formatLabels(infLabels)} ${sample.count}`);
      lines.push(`${this.options.name}_sum${formatLabels(sample.labels)} ${sample.sum}`);
      lines.push(`${this.options.name}_count${formatLabels(sample.labels)} ${sample.count}`);
    }

    return lines.join('\n');
  }
}

export const metricsContentType = 'text/plain; version=0.0.4; charset=utf-8';

export const aiToolCallTotal = new CounterMetric({
  name: 'ai_tool_call_total',
  help: 'Total AI tool calls executed',
  labelNames: ['tenantId', 'tool', 'status', 'source', 'provider'],
});

export const aiCostUsdTotal = new CounterMetric({
  name: 'ai_cost_usd_total',
  help: 'Total cost in USD',
  labelNames: ['tenantId', 'provider', 'model'],
});

export const aiLatencyMs = new HistogramMetric({
  name: 'ai_latency_ms',
  help: 'End-to-end latency of AI request',
  labelNames: ['provider', 'source'],
  buckets: [100, 300, 500, 800, 1500, 3000, 5000, 10000],
});

export const aiProviderFailoverTotal = new CounterMetric({
  name: 'ai_provider_failover_total',
  help: 'Circuit breaker failovers',
  labelNames: ['from', 'to'],
});

export const aiCacheHitRate = new GaugeMetric({
  name: 'ai_cache_hit_rate',
  help: 'Context cache hit ratio',
  labelNames: ['provider'],
});

export const aiRateLimitHitTotal = new CounterMetric({
  name: 'ai_rate_limit_hit_total',
  help: 'Rate limit rejections',
  labelNames: ['tenantId', 'plan'],
});

export const aiInjectionAttemptTotal = new CounterMetric({
  name: 'ai_injection_attempt_total',
  help: 'Prompt injection attempts detected',
  labelNames: ['tenantId', 'pattern'],
});

export const ttsCharactersBilled = new CounterMetric({
  name: 'tts_characters_billed_total',
  help: 'TTS characters synthesized',
  labelNames: ['tenantId', 'voice'],
});

export const aiIdempotencyCleanupTotal = new CounterMetric({
  name: 'ai_idempotency_cleanup_total',
  help: 'Total idempotency rows deleted by scheduled cleanup',
});

export const flowBriefingSentTotal = new CounterMetric({
  name: 'flow_briefing_sent_total',
  help: 'Total de briefings proativos enviados',
  labelNames: ['tenant_id', 'status'],
});

export const flowAlertTriggeredTotal = new CounterMetric({
  name: 'flow_alert_triggered_total',
  help: 'Total de alertas proativos disparados',
  labelNames: ['tenant_id', 'alert_type', 'dedup_hit'],
});

export const flowChannelSendTotal = new CounterMetric({
  name: 'flow_channel_send_total',
  help: 'Total de envios por canal',
  labelNames: ['channel', 'status'],
});

export const flowChannelLatencyMs = new HistogramMetric({
  name: 'flow_channel_latency_ms',
  help: 'Latencia de envio por canal',
  labelNames: ['channel'],
  buckets: [25, 50, 100, 250, 500, 1000, 2000, 5000],
});

export const flowQueueDepth = new GaugeMetric({
  name: 'flow_queue_depth',
  help: 'Profundidade atual da fila',
  labelNames: ['queue'],
});

export const flowQueueJobDurationMs = new HistogramMetric({
  name: 'flow_queue_job_duration_ms',
  help: 'Duracao dos jobs por fila e tipo',
  labelNames: ['queue', 'job_type'],
  buckets: [10, 50, 100, 250, 500, 1000, 3000, 10000, 30000],
});

export const flowQueueStalledTotal = new CounterMetric({
  name: 'flow_queue_stalled_total',
  help: 'Total de jobs stalled por fila',
  labelNames: ['queue'],
});

export function recordAiToolCall(input: {
  tenantId: number;
  tool: string;
  status: string;
  source: string;
  provider?: string | null;
}): void {
  aiToolCallTotal.inc({
    tenantId: input.tenantId,
    tool: input.tool,
    status: input.status,
    source: input.source,
    provider: input.provider ?? 'internal',
  });
}

export function addAiCostUsd(input: {
  tenantId: number;
  provider: string;
  model: string;
  costCents: number;
}): void {
  if (!Number.isFinite(input.costCents) || input.costCents <= 0) return;
  aiCostUsdTotal.inc({
    tenantId: input.tenantId,
    provider: input.provider,
    model: input.model,
  }, input.costCents / 100);
}

export function observeAiLatency(input: {
  provider: string;
  source: string;
  latencyMs: number;
}): void {
  aiLatencyMs.observe({
    provider: input.provider,
    source: input.source,
  }, input.latencyMs);
}

export function recordAiProviderFailover(fromProvider: string, toProvider: string): void {
  aiProviderFailoverTotal.inc({
    from: fromProvider,
    to: toProvider,
  });
}

export function setAiCacheHitRate(provider: string, hit: boolean): void {
  aiCacheHitRate.set({ provider }, hit ? 1 : 0);
}

export function recordAiRateLimitHit(tenantId: number, plan: string): void {
  aiRateLimitHitTotal.inc({ tenantId, plan });
}

export function recordAiInjectionAttempt(tenantId: number, pattern: string): void {
  aiInjectionAttemptTotal.inc({ tenantId, pattern });
}

export function addTtsCharactersBilled(tenantId: number, voice: string, charactersBilled: number): void {
  if (!Number.isFinite(charactersBilled) || charactersBilled <= 0) return;
  ttsCharactersBilled.inc({ tenantId, voice }, charactersBilled);
}

export function addAiIdempotencyCleanup(deletedRows: number): void {
  if (!Number.isFinite(deletedRows) || deletedRows <= 0) return;
  aiIdempotencyCleanupTotal.inc({}, deletedRows);
}

export function recordFlowBriefingSent(tenantId: number, status: 'sent' | 'skipped'): void {
  flowBriefingSentTotal.inc({
    tenant_id: tenantId,
    status,
  });
}

export function recordFlowAlertTriggered(
  tenantId: number,
  alertType: string,
  dedupHit: boolean,
): void {
  flowAlertTriggeredTotal.inc({
    tenant_id: tenantId,
    alert_type: alertType,
    dedup_hit: dedupHit,
  });
}

export function recordFlowChannelSend(channel: string, status: 'sent' | 'failed'): void {
  flowChannelSendTotal.inc({
    channel,
    status,
  });
}

export function observeFlowChannelLatency(channel: string, latencyMs: number): void {
  flowChannelLatencyMs.observe({ channel }, latencyMs);
}

export function setFlowQueueDepth(queue: string, depth: number): void {
  flowQueueDepth.set({ queue }, depth);
}

export function observeFlowQueueJobDuration(queue: string, jobType: string, durationMs: number): void {
  flowQueueJobDurationMs.observe({
    queue,
    job_type: jobType,
  }, durationMs);
}

export function recordFlowQueueStalled(queue: string): void {
  flowQueueStalledTotal.inc({ queue });
}

export function renderMetrics(): string {
  const sections = [
    aiToolCallTotal.render(),
    aiCostUsdTotal.render(),
    aiLatencyMs.render(),
    aiProviderFailoverTotal.render(),
    aiCacheHitRate.render(),
    aiRateLimitHitTotal.render(),
    aiInjectionAttemptTotal.render(),
    ttsCharactersBilled.render(),
    aiIdempotencyCleanupTotal.render(),
    flowBriefingSentTotal.render(),
    flowAlertTriggeredTotal.render(),
    flowChannelSendTotal.render(),
    flowChannelLatencyMs.render(),
    flowQueueDepth.render(),
    flowQueueJobDurationMs.render(),
    flowQueueStalledTotal.render(),
  ];

  return `${sections.join('\n\n')}\n`;
}
