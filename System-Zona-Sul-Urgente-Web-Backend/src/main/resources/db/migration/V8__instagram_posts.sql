-- Fila de importação do Instagram (BE-013, FE-155, ARCHITECTURE §6). A legenda importada é imutável
-- (auditoria); a IA gera a notícia em rascunho e a versão gerada fica guardada em ai_output (BE-014).
-- Enquanto o app da Meta não existe, os posts entram pela importação manual (link + legenda).
CREATE TABLE instagram_posts (
	-- ID do post no Instagram; na importação manual, o código do link (instagram.com/p/{codigo}).
	id                varchar(64) PRIMARY KEY,
	caption           text NOT NULL,
	-- Legenda atual na origem, quando mudou depois da importação (CHANGED_AT_SOURCE).
	current_caption   text,
	permalink         varchar(300) NOT NULL UNIQUE,
	media_type        varchar(20) NOT NULL DEFAULT 'IMAGE' CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
	media_count       integer NOT NULL DEFAULT 1 CHECK (media_count >= 1),
	thumbnail_url     varchar(1000),
	posted_at         timestamptz NOT NULL,
	status            varchar(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IMPORTED', 'CHANGED_AT_SOURCE',
		'ERROR', 'IGNORED', 'REMOVED_AT_SOURCE')),
	source            varchar(10) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'API')),
	news_id           uuid REFERENCES news (id),
	error             varchar(500),
	attempts          integer NOT NULL DEFAULT 0,
	ignored_reason    varchar(200),
	source_changed_at timestamptz,
	-- Fornecedor/modelo e rascunho como a IA entregou, antes de qualquer edição humana.
	ai_provider       varchar(80),
	ai_output         jsonb,
	created_by        uuid REFERENCES users (id),
	created_at        timestamptz NOT NULL DEFAULT now(),
	updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX instagram_posts_status_posted ON instagram_posts (status, posted_at DESC);
-- Um post gera no máximo uma notícia (clique duplo em "Gerar" não duplica).
CREATE UNIQUE INDEX instagram_posts_news ON instagram_posts (news_id) WHERE news_id IS NOT NULL;
