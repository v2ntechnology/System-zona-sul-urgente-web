-- Destaques da home (spec 003): news.featured_rank = posição no topo da home (1 = manchete, 2–3 ao lado, 4–7 faixa,
-- 8–10 reserva). Só notícia publicada fica no destaque; uma notícia por posição.

-- 1) Fora do ar não fica no destaque.
UPDATE news SET featured_rank = NULL
WHERE featured_rank IS NOT NULL AND (status <> 'PUBLISHED' OR deleted_at IS NOT NULL);

-- 2) Renumera as restantes em sequência (1, 2, 3...) pela ordem atual, sem passar de 10.
WITH ordered AS (
	SELECT id, row_number() OVER (ORDER BY featured_rank, published_at DESC, id) AS rank
	FROM news WHERE featured_rank IS NOT NULL
)
UPDATE news n SET featured_rank = CASE WHEN o.rank <= 10 THEN o.rank ELSE NULL END
FROM ordered o WHERE o.id = n.id;

-- 3) Posições de 1 a 10.
ALTER TABLE news DROP CONSTRAINT news_featured_rank_check;
ALTER TABLE news ADD CONSTRAINT news_featured_rank_range CHECK (featured_rank BETWEEN 1 AND 10);

-- 4) Uma notícia por posição. Índice comum (não adiado): toda mudança de ordem zera e regrava as posições uma a uma
--    (HomeFeaturedService), sem UPDATE em massa ±1; e restrição adiada não é aceita pelo ON CONFLICT sem alvo do seed.
CREATE UNIQUE INDEX news_featured_rank_unique ON news (featured_rank) WHERE featured_rank IS NOT NULL;

-- 5) Ação nova da auditoria (BE-008): mudanças no topo da home.
ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN ('CREATE', 'UPDATE', 'PUBLISH',
	'UNPUBLISH', 'DELETE', 'RESTORE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'MFA_SETUP', 'MFA_RESET', 'ROLE_CHANGE',
	'INVITE', 'INVITE_ACCEPT', 'ACTIVATE', 'DEACTIVATE', 'MERGE', 'INSTAGRAM_IMPORT', 'AI_GENERATION', 'IGNORE',
	'INSTAGRAM_CONNECT', 'INSTAGRAM_DISCONNECT', 'INSTAGRAM_ACCESS_LOST', 'HOME_FEATURE'));
