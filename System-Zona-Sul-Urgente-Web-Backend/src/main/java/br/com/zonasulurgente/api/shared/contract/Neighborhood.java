package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

public record Neighborhood(UUID id, String slug, String name, String citySlug, Zone zone) {
}
