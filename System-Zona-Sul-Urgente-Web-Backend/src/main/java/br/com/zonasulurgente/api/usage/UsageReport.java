package br.com.zonasulurgente.api.usage;

import java.time.OffsetDateTime;
import java.util.List;

/** Resposta de {@code GET /api/v1/admin/usage} (contracts/admin-usage.md). */
public record UsageReport(List<Item> resources, int warnAt, int criticalAt, OffsetDateTime refreshedAt) {

	/**
	 * Um recurso: uso efetivo, limite e situação. {@code source}: "cloud" (número da Cloudflare) ou "system" (conta do
	 * próprio sistema). {@code limit} nulo = "Sem limite configurado". {@code note}: aviso curto para a tela.
	 */
	public record Item(String key, String label, String unit, long used, Long limit, Double percent, String level,
			boolean locked, Integer lockAt, String source, OffsetDateTime readAt, boolean stale,
			OffsetDateTime resetsAt, String note) {
	}

	/** Linha do banner do painel ({@code GET /api/v1/admin/usage/alerts}). */
	public record Alert(String key, String label, Double percent, String level, boolean locked) {
	}

}
