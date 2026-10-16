-- Envio de fotos (BE-012, ARCHITECTURE §18). Fotos enviadas pelo painel ficam no R2 em
-- media/{aaaa}/{mm}/{uuid}/: original sem metadados + derivados {largura}.{avif|webp} + og.jpg.
-- Endereços externos colados no editor continuam sem storage_key.
ALTER TABLE media_assets
	ADD COLUMN storage_key varchar(200) UNIQUE,
	ADD COLUMN mime_type   varchar(50),
	ADD COLUMN bytes       bigint CHECK (bytes > 0),
	-- {"widths":[400,800,1200],"formats":["avif","webp"],"og":"og.jpg","original":"original.jpg"}
	ADD COLUMN variants    jsonb,
	ADD COLUMN created_by  uuid REFERENCES users (id);

-- O editor manda o endereço da foto enviada; o salvamento reaproveita o registro pelo endereço.
CREATE INDEX media_assets_url_idx ON media_assets (url) WHERE storage_key IS NOT NULL;
