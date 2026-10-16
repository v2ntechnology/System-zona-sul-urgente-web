package br.com.zonasulurgente.api.taxonomy.admin;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Tópico no painel (FE-158): uso em matérias e quando foi usado por último. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminTag(UUID id, String slug, String name, boolean active, long newsCount, OffsetDateTime lastUsedAt) {
}
