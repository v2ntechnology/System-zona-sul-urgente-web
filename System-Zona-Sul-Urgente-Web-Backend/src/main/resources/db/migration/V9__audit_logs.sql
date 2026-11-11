-- Auditoria de ações críticas (BE-008, ARCHITECTURE §15). Gravada na MESMA transação da ação:
-- se a ação for desfeita, o registro também some. Retenção de 5 anos (§16); nunca guarda segredos.

CREATE TABLE audit_logs (
	id           uuid PRIMARY KEY DEFAULT uuidv7(),
	-- clock_timestamp: várias ações na mesma transação ficam em ordem (now() seria o início dela).
	occurred_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
	-- Nulo = ação do sistema (agendamento, job) ou de quem ainda não entrou (login com falha, convite).
	actor_id     uuid REFERENCES users (id) ON DELETE SET NULL,
	-- Nome na hora da ação (continua legível se a pessoa mudar de nome ou for anonimizada).
	actor_name   varchar(120),
	-- PANEL = requisição do painel; SYSTEM = agendamento/job (sem IP).
	origin       varchar(20) NOT NULL CHECK (origin IN ('PANEL', 'SYSTEM')),
	action       varchar(30) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'PUBLISH', 'UNPUBLISH', 'DELETE',
		'RESTORE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'MFA_SETUP', 'MFA_RESET', 'ROLE_CHANGE', 'INVITE',
		'INVITE_ACCEPT', 'ACTIVATE', 'DEACTIVATE', 'MERGE', 'INSTAGRAM_IMPORT', 'AI_GENERATION', 'IGNORE')),
	-- news, user, author, category, tag, instagram_post, media.
	entity_type  varchar(30) NOT NULL,
	entity_id    varchar(64),
	-- Título/nome da entidade na hora (a lista do painel não precisa buscar a entidade).
	entity_label varchar(200),
	-- Campos alterados: {"campo": {"from": ..., "to": ...}} (texto longo truncado, segredos ocultos).
	diff         jsonb NOT NULL DEFAULT '{}',
	-- Contexto extra: modelo da IA, motivo da falha de login, editoria de destino etc.
	details      jsonb NOT NULL DEFAULT '{}',
	ip           varchar(64),
	request_id   varchar(64)
);

CREATE INDEX audit_logs_occurred_idx ON audit_logs (occurred_at DESC, id DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, occurred_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX audit_logs_action_idx ON audit_logs (action, occurred_at DESC);
