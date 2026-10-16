-- Núcleo editorial (BE-003), editorias com hierarquia (BE-020) e zonas (BE-021).
-- Convenções: IDs uuid com DEFAULT uuidv7() (PostgreSQL 18); slugs únicos; exclusão lógica
-- (deleted_at / deleted_by) nas notícias; datas sempre timestamptz.

-- unaccent() não é IMMUTABLE (depende do dicionário configurado). Este invólucro fixa o
-- dicionário e pode ser usado em coluna gerada e índice.
CREATE FUNCTION f_unaccent(text) RETURNS text
	LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
	RETURN public.unaccent('public.unaccent'::regdictionary, $1);

-- ------------------------------------------------------------------ localização

CREATE TABLE cities (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	slug       varchar(80) NOT NULL UNIQUE,
	name       varchar(120) NOT NULL,
	state      char(2) NOT NULL
);

-- Cidade → zona → bairro. O portal começa só na Zona Sul (BE-021).
CREATE TABLE zones (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	city_id    uuid NOT NULL REFERENCES cities (id),
	slug       varchar(80) NOT NULL,
	name       varchar(120) NOT NULL,
	UNIQUE (city_id, slug)
);

CREATE TABLE neighborhoods (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	zone_id    uuid NOT NULL REFERENCES zones (id),
	slug       varchar(80) NOT NULL UNIQUE,
	name       varchar(120) NOT NULL
);

-- ------------------------------------------------------------------ mídia

CREATE TABLE media_assets (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	url        varchar(1000) NOT NULL,
	width      integer NOT NULL CHECK (width > 0),
	height     integer NOT NULL CHECK (height > 0),
	alt        varchar(300) NOT NULL,
	caption    varchar(500),
	credit     varchar(200),
	created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ autores e taxonomia

CREATE TABLE authors (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	slug       varchar(80) NOT NULL UNIQUE,
	name       varchar(120) NOT NULL,
	role       varchar(60) NOT NULL,
	bio        varchar(300),
	avatar_id  uuid REFERENCES media_assets (id),
	instagram  varchar(60),
	-- Desativado: some do editor, mas segue assinando as matérias antigas.
	active     boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
	id           uuid PRIMARY KEY DEFAULT uuidv7(),
	slug         varchar(40) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	name         varchar(40) NOT NULL,
	description  varchar(160),
	parent_id    uuid REFERENCES categories (id),
	-- Paleta fixa (tokens --section-* do frontend); subeditoria herda da mãe.
	color        varchar(20) CHECK (color IN ('seguranca', 'transito', 'cidade', 'politica', 'economia',
		'esportes', 'entretenimento', 'comunidade', 'classificados')),
	in_bar       boolean NOT NULL DEFAULT false,
	sort_order   integer NOT NULL DEFAULT 0,
	active       boolean NOT NULL DEFAULT true,
	whatsapp_url varchar(300),
	-- Coluna (Blogs e colunas): subeditoria assinada por um autor.
	columnist_id uuid REFERENCES authors (id),
	created_at   timestamptz NOT NULL DEFAULT now(),
	updated_at   timestamptz NOT NULL DEFAULT now(),
	CHECK (parent_id IS NULL OR in_bar = false)
);

-- Um nível de hierarquia só (BE-020): a mãe não pode ter mãe, e quem tem filhas não vira filha.
CREATE FUNCTION categories_one_level() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.parent_id IS NOT NULL THEN
		IF EXISTS (SELECT 1 FROM categories WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
			RAISE EXCEPTION 'A editoria mãe precisa ser uma editoria principal' USING ERRCODE = 'check_violation';
		END IF;
		IF EXISTS (SELECT 1 FROM categories WHERE parent_id = NEW.id) THEN
			RAISE EXCEPTION 'Editoria com subeditorias não pode virar subeditoria' USING ERRCODE = 'check_violation';
		END IF;
	END IF;
	RETURN NEW;
END $$;

CREATE TRIGGER categories_one_level BEFORE INSERT OR UPDATE OF parent_id ON categories
	FOR EACH ROW EXECUTE FUNCTION categories_one_level();

CREATE INDEX categories_parent_idx ON categories (parent_id);

CREATE TABLE tags (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	slug       varchar(60) NOT NULL UNIQUE,
	name       varchar(40) NOT NULL,
	active     boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ notícias

CREATE TABLE news (
	id                   uuid PRIMARY KEY DEFAULT uuidv7(),
	-- Slug único globalmente (a URL /{editoria}/{slug} redireciona se a editoria mudar).
	slug                 varchar(160) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	title                varchar(160) NOT NULL,
	subtitle             varchar(250),
	summary              varchar(400) NOT NULL,
	-- Corpo em blocos (contrato ArticleBlock do frontend); HTML dos parágrafos já sanitizado.
	body                 jsonb NOT NULL DEFAULT '[]'::jsonb,
	-- Texto puro do corpo, mantido pela aplicação, só para a busca.
	body_text            text NOT NULL DEFAULT '',
	category_id          uuid NOT NULL REFERENCES categories (id),
	city_id              uuid REFERENCES cities (id),
	neighborhood_id      uuid REFERENCES neighborhoods (id),
	image_id             uuid REFERENCES media_assets (id),
	video                jsonb,
	status               varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW',
		'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED')),
	origin               varchar(20) NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'INSTAGRAM')),
	is_urgent            boolean NOT NULL DEFAULT false,
	is_sponsored         boolean NOT NULL DEFAULT false,
	sponsor_name         varchar(120),
	sponsor_url          varchar(500),
	seo_title            varchar(70),
	seo_description      varchar(170),
	canonical_url        varchar(500),
	reading_time_minutes smallint NOT NULL DEFAULT 1 CHECK (reading_time_minutes > 0),
	-- Posição no destaque editorial da home (1 = manchete); nulo = fora do destaque.
	featured_rank        smallint CHECK (featured_rank > 0),
	published_at         timestamptz,
	scheduled_for        timestamptz,
	created_at           timestamptz NOT NULL DEFAULT now(),
	updated_at           timestamptz NOT NULL DEFAULT now(),
	deleted_at           timestamptz,
	deleted_by           uuid,
	-- Bloqueio otimista contra edição concorrente (BE-009).
	version              integer NOT NULL DEFAULT 0,
	search_vector        tsvector GENERATED ALWAYS AS (
		setweight(to_tsvector('portuguese', f_unaccent(title)), 'A')
		|| setweight(to_tsvector('portuguese', f_unaccent(coalesce(subtitle, ''))), 'B')
		|| setweight(to_tsvector('portuguese', f_unaccent(summary)), 'B')
		|| setweight(to_tsvector('portuguese', f_unaccent(body_text)), 'C')
	) STORED,
	CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
	CHECK (status <> 'SCHEDULED' OR scheduled_for IS NOT NULL),
	CHECK (NOT is_sponsored OR sponsor_name IS NOT NULL)
);

-- Leitura pública: só publicadas e não excluídas, das mais novas para as mais antigas.
CREATE INDEX news_public_idx ON news (published_at DESC, id DESC)
	WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX news_category_idx ON news (category_id, published_at DESC);
CREATE INDEX news_neighborhood_idx ON news (neighborhood_id, published_at DESC);
CREATE INDEX news_search_idx ON news USING gin (search_vector);
-- Tolerância a erro de digitação na busca (BE-005).
CREATE INDEX news_title_trgm_idx ON news USING gin (f_unaccent(title) gin_trgm_ops);

CREATE TABLE news_authors (
	news_id   uuid NOT NULL REFERENCES news (id) ON DELETE CASCADE,
	author_id uuid NOT NULL REFERENCES authors (id),
	position  smallint NOT NULL DEFAULT 0,
	PRIMARY KEY (news_id, author_id)
);
CREATE INDEX news_authors_author_idx ON news_authors (author_id);

CREATE TABLE news_tags (
	news_id uuid NOT NULL REFERENCES news (id) ON DELETE CASCADE,
	tag_id  uuid NOT NULL REFERENCES tags (id),
	PRIMARY KEY (news_id, tag_id)
);
CREATE INDEX news_tags_tag_idx ON news_tags (tag_id);

-- Cada salvamento guarda a versão completa (BE-009).
CREATE TABLE news_versions (
	id         uuid PRIMARY KEY DEFAULT uuidv7(),
	news_id    uuid NOT NULL REFERENCES news (id) ON DELETE CASCADE,
	version    integer NOT NULL,
	snapshot   jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	created_by uuid,
	UNIQUE (news_id, version)
);

-- Contadores para "Mais lidas"; alimentados pela agregação de analytics (BE-015).
CREATE TABLE news_stats (
	news_id     uuid PRIMARY KEY REFERENCES news (id) ON DELETE CASCADE,
	views_day   integer NOT NULL DEFAULT 0,
	views_week  integer NOT NULL DEFAULT 0,
	views_total bigint NOT NULL DEFAULT 0,
	updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Endereços antigos (slug de editoria ou notícia mudou): respondem 301/308 para o novo (BE-020).
CREATE TABLE path_redirects (
	old_path   varchar(300) PRIMARY KEY,
	new_path   varchar(300) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	CHECK (old_path <> new_path)
);
