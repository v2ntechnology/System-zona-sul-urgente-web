-- Conexão com a conta do Instagram pela API da Meta (BE-013, spec 001). Uma conta por vez; o acesso (token do
-- "login unificado", sem vencimento) fica cifrado com a mesma chave do 2FA e nunca sai da API.
CREATE TABLE instagram_connection (
	id               smallint PRIMARY KEY CHECK (id = 1),
	ig_user_id       varchar(64) NOT NULL,
	username         varchar(100) NOT NULL,
	token_cipher     text NOT NULL,
	-- Últimos 4 caracteres, para a tela reconhecer qual acesso está em uso.
	token_last4      varchar(4) NOT NULL,
	-- Nulo = não vence (login unificado).
	token_expires_at timestamptz,
	status           varchar(10) NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
	connected_by     uuid REFERENCES users (id),
	connected_at     timestamptz NOT NULL,
	-- Posts publicados a partir daqui entram na fila (conexão menos 7 dias).
	backfill_since   timestamptz NOT NULL,
	last_sync_at     timestamptz,
	last_success_at  timestamptz,
	last_error       varchar(500),
	-- Falhas seguidas; o painel avisa a partir de zsu.instagram.failures-before-alert.
	failures         integer NOT NULL DEFAULT 0
);

-- Posts trazidos pela sincronização. Os manuais (V8) usam o código do link como id; a API usa o ID da Meta. O link
-- (permalink, já UNIQUE) é o que liga os dois; ig_media_id fica nulo no manual até a varredura encontrá-lo.
ALTER TABLE instagram_posts
	ADD COLUMN ig_media_id        varchar(64) UNIQUE,
	ADD COLUMN ig_user_id         varchar(64),
	ADD COLUMN media_product_type varchar(20),
	-- A Meta não entregou nenhuma imagem (vídeo sem arquivo nem capa): a foto é escolhida à mão.
	ADD COLUMN needs_photo        boolean NOT NULL DEFAULT false,
	ADD COLUMN main_media_id      uuid REFERENCES media_assets (id);

-- Imagens guardadas de cada post, na ordem do carrossel (0 = primeira, candidata a foto principal).
CREATE TABLE instagram_post_media (
	post_id        varchar(64) REFERENCES instagram_posts (id) ON DELETE CASCADE,
	position       smallint,
	media_asset_id uuid NOT NULL REFERENCES media_assets (id),
	kind           varchar(12) NOT NULL CHECK (kind IN ('IMAGE', 'VIDEO_COVER')),
	PRIMARY KEY (post_id, position)
);

-- Ações novas da auditoria (BE-008): ligar, desligar e perda de acesso à conta.
ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN ('CREATE', 'UPDATE', 'PUBLISH',
	'UNPUBLISH', 'DELETE', 'RESTORE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'MFA_SETUP', 'MFA_RESET', 'ROLE_CHANGE',
	'INVITE', 'INVITE_ACCEPT', 'ACTIVATE', 'DEACTIVATE', 'MERGE', 'INSTAGRAM_IMPORT', 'AI_GENERATION', 'IGNORE',
	'INSTAGRAM_CONNECT', 'INSTAGRAM_DISCONNECT', 'INSTAGRAM_ACCESS_LOST'));
