-- Autenticação do painel (BE-006) e RBAC (BE-007). ARCHITECTURE §8.
-- A API checa PERMISSÕES (não nomes de perfil): a matriz abaixo pode mudar sem mexer em código.

-- ------------------------------------------------------------------ RBAC

CREATE TABLE roles (
	code          varchar(20) PRIMARY KEY,
	name          varchar(60) NOT NULL,
	-- Perfis que exigem verificação em duas etapas (TOTP).
	requires_totp boolean NOT NULL DEFAULT false
);

CREATE TABLE permissions (
	code        varchar(40) PRIMARY KEY,
	description varchar(200) NOT NULL
);

CREATE TABLE role_permissions (
	role_code       varchar(20) NOT NULL REFERENCES roles (code) ON DELETE CASCADE,
	permission_code varchar(40) NOT NULL REFERENCES permissions (code) ON DELETE CASCADE,
	PRIMARY KEY (role_code, permission_code)
);

INSERT INTO roles (code, name, requires_totp) VALUES
	('ADMIN', 'Administrador', true),
	('EDITOR', 'Editor', true),
	('REPORTER', 'Repórter', false),
	('COMERCIAL', 'Comercial', true),
	('AUTOR', 'Autor/Colunista', false);

INSERT INTO permissions (code, description) VALUES
	('news.create', 'Criar notícia (rascunho)'),
	('news.edit.own', 'Editar as próprias notícias'),
	('news.edit.any', 'Editar qualquer notícia'),
	('news.publish', 'Publicar, despublicar e agendar'),
	('news.delete', 'Excluir e restaurar (lógico)'),
	('news.mark_urgent', 'Marcar urgente'),
	('news.mark_sponsored', 'Marcar patrocinada'),
	('news.versions.view', 'Ver versões'),
	('instagram.review', 'Revisar a fila do Instagram'),
	('instagram.settings', 'Configurar a conta do Instagram'),
	('taxonomy.manage', 'Gerenciar editorias, cidades e bairros'),
	('tags.manage', 'Gerenciar tópicos'),
	('authors.manage', 'Gerenciar autores'),
	('ads.manage', 'Gerenciar publicidade'),
	('analytics.view', 'Ver analytics editorial'),
	('analytics.ads.view', 'Ver analytics de publicidade'),
	('users.manage', 'Gerenciar equipe e perfis'),
	('settings.manage', 'Configurações do sistema'),
	('audit.view', 'Ver auditoria');

-- Matriz da ARCHITECTURE §8 (espelhada em src/config/permissions.ts do frontend).
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'ADMIN', code FROM permissions;

INSERT INTO role_permissions (role_code, permission_code) VALUES
	('EDITOR', 'news.create'), ('EDITOR', 'news.edit.own'), ('EDITOR', 'news.edit.any'),
	('EDITOR', 'news.publish'), ('EDITOR', 'news.delete'), ('EDITOR', 'news.mark_urgent'),
	('EDITOR', 'news.mark_sponsored'), ('EDITOR', 'news.versions.view'), ('EDITOR', 'instagram.review'),
	('EDITOR', 'taxonomy.manage'), ('EDITOR', 'tags.manage'), ('EDITOR', 'authors.manage'),
	('EDITOR', 'analytics.view'),
	('REPORTER', 'news.create'), ('REPORTER', 'news.edit.own'), ('REPORTER', 'news.mark_urgent'),
	('REPORTER', 'news.versions.view'), ('REPORTER', 'instagram.review'), ('REPORTER', 'tags.manage'),
	('REPORTER', 'analytics.view'),
	('COMERCIAL', 'news.create'), ('COMERCIAL', 'news.edit.own'), ('COMERCIAL', 'news.mark_sponsored'),
	('COMERCIAL', 'news.versions.view'), ('COMERCIAL', 'ads.manage'), ('COMERCIAL', 'analytics.ads.view'),
	('AUTOR', 'news.create'), ('AUTOR', 'news.edit.own'), ('AUTOR', 'news.versions.view'),
	('AUTOR', 'analytics.view');

-- ------------------------------------------------------------------ usuários e sessões

CREATE TABLE users (
	id                  uuid PRIMARY KEY DEFAULT uuidv7(),
	name                varchar(120) NOT NULL,
	email               varchar(200) NOT NULL,
	-- Nulo = convite ainda não aceito (sem senha, não entra).
	password_hash       varchar(200),
	-- Um perfil por pessoa (o painel trabalha assim); as permissões vêm de role_permissions.
	role_code           varchar(20) NOT NULL REFERENCES roles (code),
	status              varchar(20) NOT NULL DEFAULT 'INVITED' CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED')),
	-- Autor vinculado (assinatura e regra das "próprias").
	author_id           uuid UNIQUE REFERENCES authors (id),
	password_changed_at timestamptz,
	last_login_at       timestamptz,
	created_at          timestamptz NOT NULL DEFAULT now(),
	updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_idx ON users (lower(email));

-- Segredo TOTP criptografado (AES-GCM com chave fora do banco). last_step evita reuso do código.
CREATE TABLE user_totp (
	user_id          uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	secret_encrypted varchar(300) NOT NULL,
	confirmed_at     timestamptz,
	last_step        bigint NOT NULL DEFAULT 0,
	created_at       timestamptz NOT NULL DEFAULT now()
);

-- Sessão opaca: só o hash (SHA-256) do token fica no banco.
CREATE TABLE sessions (
	id           uuid PRIMARY KEY DEFAULT uuidv7(),
	token_hash   bytea NOT NULL UNIQUE,
	user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	created_at   timestamptz NOT NULL DEFAULT now(),
	last_seen_at timestamptz NOT NULL DEFAULT now(),
	expires_at   timestamptz NOT NULL,
	ip           varchar(64),
	user_agent   varchar(300),
	revoked_at   timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

-- Segunda etapa do login (TOTP): desafio curto (5 min), também guardado só como hash.
CREATE TABLE login_challenges (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	token_hash bytea NOT NULL UNIQUE,
	user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	-- Primeiro acesso de perfil que exige 2FA: o desafio também cadastra o app autenticador.
	setup      boolean NOT NULL DEFAULT false,
	attempts   smallint NOT NULL DEFAULT 0,
	expires_at timestamptz NOT NULL,
	used_at    timestamptz,
	ip         varchar(64)
);

-- Tentativas de login, para rate limit e bloqueio progressivo (5 falhas → 15 min).
CREATE TABLE login_attempts (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	email      varchar(200) NOT NULL,
	ip         varchar(64),
	success    boolean NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts (lower(email), created_at DESC);
CREATE INDEX login_attempts_ip_idx ON login_attempts (ip, created_at DESC);
