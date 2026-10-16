-- Convite para a equipe (FE-159). Sem serviço de e-mail ainda: o painel mostra o link para o
-- administrador mandar à pessoa (WhatsApp etc.). Guardamos só o hash do token; vale 7 dias e
-- serve uma vez. Gerar um link novo invalida o anterior.
CREATE TABLE user_invitations (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	token_hash bytea NOT NULL UNIQUE,
	expires_at timestamptz NOT NULL,
	used_at    timestamptz,
	created_by uuid REFERENCES users (id),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_invitations_user_idx ON user_invitations (user_id);
