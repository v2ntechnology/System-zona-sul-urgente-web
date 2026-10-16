package br.com.zonasulurgente.api.shared.contract;

import java.util.UUID;

public record City(UUID id, String slug, String name, String state) {
}
