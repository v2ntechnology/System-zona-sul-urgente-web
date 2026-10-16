package br.com.zonasulurgente.api.shared.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Sponsor(String name, String url) {
}
