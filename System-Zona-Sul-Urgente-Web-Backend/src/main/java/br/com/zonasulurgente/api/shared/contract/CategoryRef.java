package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

public record CategoryRef(UUID id, String slug, String name) {
}
