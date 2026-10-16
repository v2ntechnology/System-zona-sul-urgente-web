-- Fila de jobs no PostgreSQL (BE-010, ARCHITECTURE §10). Consumo com FOR UPDATE SKIP LOCKED:
-- várias instâncias da API podem rodar o worker sem pegar o mesmo job.
CREATE TABLE job_queue (
	id           uuid PRIMARY KEY DEFAULT uuidv7(),
	type         varchar(60) NOT NULL,
	payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
	status       varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED',
		'FAILED', 'RETRYING', 'DEAD')),
	attempts     smallint NOT NULL DEFAULT 0,
	max_attempts smallint NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
	-- Quando pode rodar (agora, ou depois do intervalo de espera entre tentativas).
	run_at       timestamptz NOT NULL DEFAULT now(),
	locked_at    timestamptz,
	locked_by    varchar(120),
	last_error   text,
	created_at   timestamptz NOT NULL DEFAULT now(),
	updated_at   timestamptz NOT NULL DEFAULT now(),
	completed_at timestamptz
);

-- Próximos jobs a rodar.
CREATE INDEX job_queue_ready_idx ON job_queue (run_at) WHERE status IN ('PENDING', 'RETRYING');
-- Jobs travados (worker caiu no meio).
CREATE INDEX job_queue_processing_idx ON job_queue (locked_at) WHERE status = 'PROCESSING';

-- Publicação automática dos agendados (varredura a cada 30 s).
CREATE INDEX news_scheduled_idx ON news (scheduled_for) WHERE status = 'SCHEDULED' AND deleted_at IS NULL;
