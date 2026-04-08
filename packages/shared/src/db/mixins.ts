import { timestamp, integer } from 'drizzle-orm/pg-core';

// PAD-03: soft delete obrigatório em todos os módulos
// FK para users.id será adicionada na Fase 2 após tabela users existir
export const softDeleteColumns = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: integer('deleted_by'), // FK → users.id adicionada na Fase 2
};
