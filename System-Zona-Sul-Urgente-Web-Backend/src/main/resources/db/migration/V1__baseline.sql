-- Baseline do schema. Extensões usadas pela busca textual em português:
-- unaccent (ignorar acentos) e pg_trgm (similaridade / tolerância a erros de digitação).
-- Ambas são "trusted" no PostgreSQL 13+, então o migration_user só precisa de CREATE no banco.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
