-- Migration 0003: Ajustes para Fases 4+5 (Clientes + Tabelas de Preços)
-- Adiciona campos code e description a price_items e unique indexes parciais

ALTER TABLE "price_items" ADD COLUMN IF NOT EXISTS "code" varchar(64);
ALTER TABLE "price_items" ADD COLUMN IF NOT EXISTS "description" text;

-- Unique index parcial: nome único por tenant em pricing_tables (ignora soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_tables_tenant_name_idx"
  ON "pricing_tables" ("tenant_id", "name")
  WHERE "deleted_at" IS NULL;

-- Unique index parcial: nome único por tabela em price_items (ignora soft-deleted e itens avulsos)
CREATE UNIQUE INDEX IF NOT EXISTS "price_items_table_name_idx"
  ON "price_items" ("pricing_table_id", "name")
  WHERE "deleted_at" IS NULL AND "pricing_table_id" IS NOT NULL;
