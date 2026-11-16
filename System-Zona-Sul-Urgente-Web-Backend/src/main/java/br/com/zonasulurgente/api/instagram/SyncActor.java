package br.com.zonasulurgente.api.instagram;

import java.util.List;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;

/**
 * Quem age quando a sincronização do Instagram cria mídia e rascunho sem pessoa logada (spec 001, research.md R5).
 * Sem conta no banco ({@code id} nulo → {@code created_by} nulo; fora de requisição a auditoria sai como SYSTEM) e
 * com as permissões de Repórter para notícias: cria rascunho, marca urgente e usa tópicos. Nunca publica.
 */
final class SyncActor {

	static final String NAME = "Sincronização do Instagram";

	static final AuthenticatedUser USER = new AuthenticatedUser(null, NAME, null, "SYSTEM",
			List.of("news.create", "news.edit.own", "news.mark_urgent", "tags.manage"), null, null);

	private SyncActor() {
	}

	static boolean is(AuthenticatedUser user) {
		return user == USER;
	}

}
