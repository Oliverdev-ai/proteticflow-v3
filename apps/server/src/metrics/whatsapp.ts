import { logger } from '../logger.js';

type Labels = Record<string, string | number>;

const ALERT_WINDOW_MS = 5 * 60 * 1000;
const alertState = new Map<string, { windowStart: number; count: number; alerted: boolean }>();

function toLabelString(labels: Labels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  const formatted = entries.map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`);
  return `{${formatted.join(',')}}`;
}

class CounterMetric {
  private readonly samples = new Map<string, { labels: Labels; value: number }>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  inc(labels: Labels = {}, value = 1): void {
    if (!Number.isFinite(value) || value <= 0) return;
    const key = JSON.stringify(labels);
    const previous = this.samples.get(key);
    this.samples.set(key, {
      labels,
      value: (previous?.value ?? 0) + value,
    });
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this.samples.size === 0) {
      lines.push(`${this.name} 0`);
      return lines.join('\n');
    }
    for (const sample of this.samples.values()) {
      lines.push(`${this.name}${toLabelString(sample.labels)} ${sample.value}`);
    }
    return lines.join('\n');
  }
}

class HistogramMetric {
  private readonly buckets: number[];

  private readonly samples = new Map<string, {
    labels: Labels;
    counts: number[];
    sum: number;
    count: number;
  }>();

  constructor(
    readonly name: string,
    readonly help: string,
    buckets: number[],
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(labels: Labels, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    const key = JSON.stringify(labels);
    const sample = this.samples.get(key) ?? {
      labels,
      counts: this.buckets.map(() => 0),
      sum: 0,
      count: 0,
    };
    for (let idx = 0; idx < this.buckets.length; idx += 1) {
      if (value <= this.buckets[idx]!) {
        sample.counts[idx]! += 1;
      }
    }
    sample.sum += value;
    sample.count += 1;
    this.samples.set(key, sample);
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    if (this.samples.size === 0) {
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines.join('\n');
    }

    for (const sample of this.samples.values()) {
      let cumulative = 0;
      for (let idx = 0; idx < this.buckets.length; idx += 1) {
        cumulative = sample.counts[idx] ?? cumulative;
        const bucketValue = this.buckets[idx];
        if (bucketValue === undefined) continue;
        lines.push(
          `${this.name}_bucket${toLabelString({ ...sample.labels, le: bucketValue })} ${cumulative}`,
        );
      }
      lines.push(`${this.name}_bucket${toLabelString({ ...sample.labels, le: '+Inf' })} ${sample.count}`);
      lines.push(`${this.name}_sum${toLabelString(sample.labels)} ${sample.sum}`);
      lines.push(`${this.name}_count${toLabelString(sample.labels)} ${sample.count}`);
    }

    return lines.join('\n');
  }
}

const whatsappSendTotal = new CounterMetric(
  'whatsapp_send_total',
  'Total de envios WhatsApp por tenant/provider/status',
);
const whatsappSendLatencyMs = new HistogramMetric(
  'whatsapp_send_latency_ms',
  'Latencia do envio WhatsApp por provider',
  [50, 100, 250, 500, 1000, 2000, 5000, 10000],
);
const whatsappWebhookTotal = new CounterMetric(
  'whatsapp_webhook_total',
  'Eventos de webhook WhatsApp processados',
);
const whatsappReplayBlockedTotal = new CounterMetric(
  'whatsapp_replay_blocked_total',
  'Eventos bloqueados por replay protection no WhatsApp',
);
const whatsappOptInBlockedTotal = new CounterMetric(
  'whatsapp_opt_in_blocked_total',
  'Envios bloqueados por opt-in ausente/invalido',
);

function bumpOpsAlert(kind: string, tenantId: number, threshold: number, details: Record<string, unknown>): void {
  const now = Date.now();
  const key = `${kind}:${tenantId}`;
  const state = alertState.get(key);
  if (!state || now - state.windowStart > ALERT_WINDOW_MS) {
    alertState.set(key, { windowStart: now, count: 1, alerted: false });
    return;
  }

  state.count += 1;
  if (!state.alerted && state.count >= threshold) {
    state.alerted = true;
    logger.warn(
      {
        action: 'whatsapp.ops.alert',
        kind,
        tenantId,
        threshold,
        windowMs: ALERT_WINDOW_MS,
        count: state.count,
        ...details,
      },
      'Alerta operacional de WhatsApp disparado',
    );
  }
}

export function recordWhatsappSend(
  tenantId: number,
  provider: 'mock' | 'blip' | 'meta',
  status: 'sent' | 'failed',
): void {
  whatsappSendTotal.inc({ tenant_id: tenantId, provider, status });
  if (status === 'failed') {
    bumpOpsAlert('send_failed', tenantId, 5, { provider });
  }
}

export function observeWhatsappSendLatency(
  tenantId: number,
  provider: 'mock' | 'blip' | 'meta',
  latencyMs: number,
): void {
  whatsappSendLatencyMs.observe({ tenant_id: tenantId, provider }, latencyMs);
}

export function recordWhatsappWebhookEvent(
  tenantId: number,
  eventType: string,
  status: 'processed' | 'ignored' | 'failed' | 'replay' | 'blocked',
): void {
  whatsappWebhookTotal.inc({ tenant_id: tenantId, event_type: eventType, status });
  if (status === 'failed') {
    bumpOpsAlert('webhook_failed', tenantId, 3, { eventType });
  }
}

export function recordWhatsappReplayBlocked(tenantId: number): void {
  whatsappReplayBlockedTotal.inc({ tenant_id: tenantId });
  bumpOpsAlert('replay_blocked', tenantId, 5, {});
}

export function recordWhatsappOptInBlocked(tenantId: number, reason: string): void {
  whatsappOptInBlockedTotal.inc({ tenant_id: tenantId, reason });
  bumpOpsAlert('opt_in_blocked', tenantId, 5, { reason });
}

export function renderWhatsappMetrics(): string {
  const sections = [
    whatsappSendTotal.render(),
    whatsappSendLatencyMs.render(),
    whatsappWebhookTotal.render(),
    whatsappReplayBlockedTotal.render(),
    whatsappOptInBlockedTotal.render(),
  ];
  return `${sections.join('\n\n')}\n`;
}
