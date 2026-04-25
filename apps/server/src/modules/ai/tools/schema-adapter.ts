import type { Role } from '@proteticflow/shared';
import { z } from 'zod';
import { FLOW_COMMANDS, type FlowCommandName } from '../command-parser.js';
import { TOOL_REGISTRY, type ToolHandler } from '../tool-executor.js';
import type { LlmToolDefinition } from '../providers/ILlmProvider.js';

type CommandRiskLevel = (typeof FLOW_COMMANDS)[FlowCommandName]['risk'];

type RegistryToolDescriptor = {
  name: FlowCommandName;
  inputSchema: z.ZodType<unknown>;
  handler: (ctx: unknown, input: unknown) => Promise<unknown>;
  previewBuilder?: (
    ctx: unknown,
    input: unknown,
    riskLevel: CommandRiskLevel,
  ) => Promise<unknown>;
};

function toJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { reused: 'inline' });
  return typeof json === 'object' && json !== null
    ? json as Record<string, unknown>
    : { type: 'object', properties: {} };
}

function toLlmToolName(command: FlowCommandName): string {
  return command.replace(/\./g, '__');
}

export function fromLlmToolName(name: string): FlowCommandName | null {
  const key = name.replace(/__/g, '.') as FlowCommandName;
  return key in TOOL_REGISTRY ? key : null;
}

function describeTool(command: FlowCommandName): string {
  const config = FLOW_COMMANDS[command];
  const requiredFields = 'requiredFields' in config && Array.isArray(config.requiredFields)
    ? config.requiredFields
    : [];
  const required = requiredFields.length
    ? `Campos obrigatorios: ${requiredFields.join(', ')}.`
    : 'Sem campos obrigatorios.';

  return `Comando ${command} (${config.risk}). ${required}`;
}

function toDescriptor(
  entry: [FlowCommandName, ToolHandler<unknown, unknown>],
): RegistryToolDescriptor {
  const [name, tool] = entry;
  const descriptor: RegistryToolDescriptor = {
    name,
    inputSchema: tool.inputSchema as z.ZodType<unknown>,
    handler: tool.execute as (ctx: unknown, input: unknown) => Promise<unknown>,
  };

  if (tool.buildPreviewStep) {
    descriptor.previewBuilder = tool.buildPreviewStep as (
      ctx: unknown,
      input: unknown,
      riskLevel: CommandRiskLevel,
    ) => Promise<unknown>;
  }

  return descriptor;
}

export function getRegistryToolsByRole(role: Role): RegistryToolDescriptor[] {
  const entries = Object.entries(TOOL_REGISTRY) as Array<[FlowCommandName, ToolHandler<unknown, unknown>]>;
  return entries
    .filter(([command]) => (FLOW_COMMANDS[command].roles as readonly Role[]).includes(role))
    .map(toDescriptor);
}

export function buildLlmTools(role: Role): LlmToolDefinition[] {
  return getRegistryToolsByRole(role).map((tool) => ({
    name: toLlmToolName(tool.name),
    description: describeTool(tool.name),
    inputSchema: toJsonSchema(tool.inputSchema),
  }));
}
