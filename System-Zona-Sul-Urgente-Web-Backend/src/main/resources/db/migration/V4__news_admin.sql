-- CRUD administrativo de notícias (BE-009): quem criou e quem alterou por último.
-- "Próprias" (news.edit.own) = notícias em que a pessoa é autora OU que ela criou.
ALTER TABLE news
	ADD COLUMN created_by uuid REFERENCES users (id),
	ADD COLUMN updated_by uuid REFERENCES users (id);

CREATE INDEX news_created_by_idx ON news (created_by);
-- Listagem do painel (inclui rascunhos e a lixeira), da alteração mais recente para a mais antiga.
CREATE INDEX news_admin_list_idx ON news (updated_at DESC, id DESC);
