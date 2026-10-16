package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

public record Tag(UUID id, String slug, String name) {
}
