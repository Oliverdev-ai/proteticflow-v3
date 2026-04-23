import { logger } from '../../../logger.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import type { ILlmProvider, LlmContext, LlmGenerateResult, LlmToolDefinition } from './ILlmProvider.js';

type ProviderHealthState = {
  failures: number;
  firstFailureAt: number;
  unhealthyUntil: number;
};

const FAILURE_WINDOW_MS = 60_000;
const UNHEALTHY_WINDOW_MS = 30_000;
const FAILURE_THRESHOLD = 3;

let aiProviderFailoverTotal = 0;

function defaultState(): ProviderHealthState {
  return {
    failures: 0,
    firstFailureAt: 0,
    unhealthyUntil: 0,
  };
}

export function getAiProviderFailoverTotal(): number {
  return aiProviderFailoverTotal;
}

export class ProviderResolver {
  private readonly healthByProvider = new Map<string, ProviderHealthState>();

  constructor(
    private readonly providers: ILlmProvider[] = [new GeminiProvider(), new AnthropicProvider()],
  ) {}

  private getState(providerId: string): ProviderHealthState {
    const state = this.healthByProvider.get(providerId) ?? defaultState();
    this.healthByProvider.set(providerId, state);
    return state;
  }

  private isHealthy(providerId: string): boolean {
    const state = this.getState(providerId);
    return state.unhealthyUntil <= Date.now();
  }

  private markFailure(providerId: string, error: unknown) {
    const state = this.getState(providerId);
    const now = Date.now();

    if (now - state.firstFailureAt > FAILURE_WINDOW_MS) {
      state.failures = 1;
      state.firstFailureAt = now;
    } else {
      state.failures += 1;
      if (state.firstFailureAt === 0) {
        state.firstFailureAt = now;
      }
    }

    if (state.failures >= FAILURE_THRESHOLD) {
      state.unhealthyUntil = now + UNHEALTHY_WINDOW_MS;
      state.failures = 0;
      state.firstFailureAt = 0;
    }

    logger.warn(
      {
        providerId,
        unhealthyUntil: state.unhealthyUntil,
        failures: state.failures,
        err: error,
      },
      'ai.provider.failure',
    );
  }

  private markSuccess(providerId: string) {
    const state = this.getState(providerId);
    state.failures = 0;
    state.firstFailureAt = 0;
    state.unhealthyUntil = 0;
  }

  private buildAttemptOrder(): ILlmProvider[] {
    return this.providers
      .filter((provider) => provider.isConfigured())
      .filter((provider) => this.isHealthy(provider.id));
  }

  async generate(
    context: LlmContext,
    tools: LlmToolDefinition[],
  ): Promise<LlmGenerateResult> {
    const availableProviders = this.providers.filter((provider) => provider.isConfigured());
    if (availableProviders.length === 0) {
      throw new Error('Nenhum provider LLM configurado');
    }

    const orderedProviders = this.buildAttemptOrder();
    if (orderedProviders.length === 0) {
      throw new Error('Todos os providers LLM estao temporariamente indisponiveis');
    }

    let lastError: unknown;
    for (const [index, provider] of orderedProviders.entries()) {
      try {
        const result = await provider.generate(context, tools);
        this.markSuccess(provider.id);
        return result;
      } catch (error) {
        lastError = error;
        this.markFailure(provider.id, error);

        const fallback = orderedProviders[index + 1];
        if (fallback) {
          aiProviderFailoverTotal += 1;
          logger.warn(
            {
              fromProvider: provider.id,
              toProvider: fallback.id,
              ai_provider_failover_total: aiProviderFailoverTotal,
            },
            'ai.provider.failover',
          );
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Falha ao executar providers LLM');
  }
}
