package br.com.zonasulurgente.api.news.admin;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Resultado de um salvamento: id, slug, novo status, versão e quando. */
public record SaveResult(UUID id, String slug, String status, int version, OffsetDateTime savedAt) {
}
