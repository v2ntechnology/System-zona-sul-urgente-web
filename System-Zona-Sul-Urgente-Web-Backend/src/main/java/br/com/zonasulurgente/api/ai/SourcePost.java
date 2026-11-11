package br.com.zonasulurgente.api.ai;

import java.time.OffsetDateTime;

/** Post de origem (legenda do Instagram). {@code permalink} e {@code postedAt} são opcionais. */
public record SourcePost(String text, String permalink, OffsetDateTime postedAt) {
}
