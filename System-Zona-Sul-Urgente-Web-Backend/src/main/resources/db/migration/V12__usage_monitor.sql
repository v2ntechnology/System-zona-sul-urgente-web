-- Monitor de uso dos planos gratuitos (spec 004): estado de cada recurso, contagem do próprio sistema por janela,
-- tamanho real das fotos gravadas e a espera dos posts do Instagram quando uma trava está ligada.

-- 1) Estado de cada recurso configurado (zsu.usage.resources): última leitura da nuvem, nível do último aviso e trava.
CREATE TABLE usage_state (
	resource varchar(80) PRIMARY KEY,
	cloud_value bigint,
	cloud_read_at timestamptz,
	cloud_error varchar(300),
	level varchar(10) NOT NULL DEFAULT 'NORMAL' CHECK (level IN ('NORMAL', 'WARN', 'CRITICAL')),
	locked boolean NOT NULL DEFAULT false,
	changed_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Contagem do próprio sistema por janela (minuto, dia, mês), pelo relógio do banco.
CREATE TABLE usage_counters (
	resource varchar(80) NOT NULL,
	window_start timestamptz NOT NULL,
	count bigint NOT NULL,
	PRIMARY KEY (resource, window_start)
);

-- 3) Tamanho real de cada foto no armazenamento (original + versões WebP/AVIF + og). Nulo nas antigas = estimado.
ALTER TABLE media_assets ADD COLUMN stored_bytes bigint;
ALTER TABLE media_assets ADD COLUMN stored_objects integer;

-- Ponto de partida da conta do sistema para o espaço das fotos: as fotos que já existem (sem o tamanho real das
-- versões, estimado em 3 × o original). Daqui em diante o MediaService soma o tamanho real de cada gravação.
INSERT INTO usage_counters (resource, window_start, count)
SELECT 'fotos.espaco', 'epoch'::timestamptz, coalesce(sum(3 * bytes), 0) FROM media_assets WHERE bytes IS NOT NULL;

-- 4) Post do Instagram esperando uma trava desligar: SPACE = foto (espaço das fotos), AI = rascunho (cota da IA).
ALTER TABLE instagram_posts ADD COLUMN waiting varchar(10) CHECK (waiting IN ('SPACE', 'AI'));
ALTER TABLE instagram_posts ADD COLUMN waiting_until timestamptz;

-- 5) Ações novas da auditoria: mudança de nível do aviso e trava ligando/desligando.
ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN ('CREATE', 'UPDATE', 'PUBLISH',
	'UNPUBLISH', 'DELETE', 'RESTORE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'MFA_SETUP', 'MFA_RESET', 'ROLE_CHANGE',
	'INVITE', 'INVITE_ACCEPT', 'ACTIVATE', 'DEACTIVATE', 'MERGE', 'INSTAGRAM_IMPORT', 'AI_GENERATION', 'IGNORE',
	'INSTAGRAM_CONNECT', 'INSTAGRAM_DISCONNECT', 'INSTAGRAM_ACCESS_LOST', 'HOME_FEATURE', 'USAGE_LEVEL', 'USAGE_LOCK',
	'USAGE_UNLOCK'));
