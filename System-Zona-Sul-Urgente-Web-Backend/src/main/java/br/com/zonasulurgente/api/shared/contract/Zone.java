package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

public record Zone(UUID id, String slug, String name) {
}
