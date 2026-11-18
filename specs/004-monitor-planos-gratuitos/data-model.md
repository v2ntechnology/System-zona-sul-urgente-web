# Modelo de dados: Monitor de uso dos planos gratuitos

Migração `V12__usage_monitor.sql`.

## `usage_state` (nova) — um registro por recurso configurado

| Coluna | Tipo | Regra |
|---|---|---|
| `resource` | `varchar(80)` PK | chave da configuração (`fotos.espaco`, `ia.gemini-3.7-flash.dia`…) |
| `cloud_value` | `bigint` | último número lido da nuvem (nulo = nunca leu) |
| `cloud_read_at` | `timestamptz` | hora dessa leitura |
| `cloud_error` | `varchar(300)` | motivo da última falha de leitura (nulo = ok) |
| `level` | `varchar(10) NOT NULL DEFAULT 'NORMAL'` | `CHECK IN ('NORMAL','WARN','CRITICAL')` — último aviso emitido |
| `locked` | `boolean NOT NULL DEFAULT false` | trava ligada |
| `changed_at` | `timestamptz NOT NULL DEFAULT now()` | quando o nível ou a trava mudou |

## `usage_counters` (nova) — contagem do próprio sistema por janela

| Coluna | Tipo | Regra |
|---|---|---|
| `resource` | `varchar(80)` | |
| `window_start` | `timestamptz` | início do minuto/dia/mês (pelo relógio do banco) |
| `count` | `bigint NOT NULL` | |
| | | PK `(resource, window_start)`; incremento com `INSERT … ON CONFLICT DO UPDATE SET count = count + :n` |

Limpeza: janelas de minuto com mais de 1 dia e de dia com mais de 90 dias, pelo job de leitura.

## `media_assets` (alterada)

| Coluna | Tipo | Regra |
|---|---|---|
| `stored_bytes` | `bigint` | soma dos arquivos gravados (original + versões); nulo nas fotos antigas = estimado (3 × `bytes`) |
| `stored_objects` | `integer` | nº de arquivos gravados |

## `instagram_posts` (alterada)

| Coluna | Tipo | Regra |
|---|---|---|
| `waiting` | `varchar(10)` | `CHECK IN ('SPACE','AI')`; nulo = não espera |
| `waiting_until` | `timestamptz` | previsão de volta (IA) |

## `job_queue` (sem mudança de schema)

`JobQueue.defer(job, runAt, motivo)`: volta para `PENDING` com `run_at = :runAt` **sem** incrementar `attempts` e
grava o motivo em `last_error` prefixado com `Aguardando:`.

## Auditoria

`audit_logs_action_check` recriado com os valores da V11 mais `USAGE_LEVEL`, `USAGE_LOCK`, `USAGE_UNLOCK`. Entidade
`usage`, rótulo = nome do recurso; detalhe: `used`, `limit`, `percent`, `from`, `to`, `source` (`cloud`/`system`).

## Uso efetivo de um recurso

```
nuvem   = cloud_value (se houver)
sistema = soma do que o sistema registrou na janela (contadores, ou stored_bytes para o espaço)
depois  = o que o sistema gravou depois de cloud_read_at
uso     = max(nuvem + depois, sistema)          -- na dúvida, o maior (FR-010)
percent = uso / limite × 100
nível   = CRITICAL (≥ critical-at) | WARN (≥ warn-at) | NORMAL
travado = lock-at definido e percent ≥ lock-at
```
