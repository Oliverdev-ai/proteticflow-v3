# ADR-002 - Embeddings da Memoria Persistente Flow IA

## Status
Aceito para Fase 7.

## Contexto
Flow IA precisa recuperar memorias persistentes por similaridade sem permitir vazamento entre tenants. O brief canonico define pgvector `vector(768)` e Gemini `text-embedding-004` como provider primario.

## Decisao
- Usar `pgvector` com coluna `embedding vector(768)` em `ai_memory`.
- Usar Gemini `text-embedding-004` como provider primario quando `GEMINI_API_KEY` existir.
- Fixar dimensao em `AI_MEMORY_EMBEDDING_DIMENSIONS = 768`.
- Manter fallback deterministico apenas para dev/test quando a chave externa nao estiver configurada.
- Encapsular provider em `apps/server/src/modules/ai/embeddings.provider.ts`.

## Consequencias
- Trocar provider ou dimensao exige migration e reindexacao/reembedding das memorias existentes.
- Tests nao dependem de rede externa.
- Busca vetorial permanece filtrada por `tenant_id`, escopo e usuario antes de ordenar por distancia.

## Alternativas consideradas
- Armazenar apenas chave/valor sem embedding: simples, mas nao atende recall semantico.
- Usar dimensao variavel por provider: reduz acoplamento, mas aumenta risco operacional e complica indice.
- Adicionar dependencia SDK agora: desnecessario para uma chamada HTTP pequena e aumenta superficie de build.
