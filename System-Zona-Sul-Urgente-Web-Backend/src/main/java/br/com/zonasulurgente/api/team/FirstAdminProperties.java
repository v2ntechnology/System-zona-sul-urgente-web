package br.com.zonasulurgente.api.team;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Primeiro administrador de um servidor novo (sem nenhum Admin ativo). {@code email} vazio = desligado.
 * {@code siteUrl}: endereço público do site, para o log mostrar o link completo do convite.
 */
@ConfigurationProperties("zsu.bootstrap.admin")
public record FirstAdminProperties(
		@DefaultValue("") String email,
		@DefaultValue("Administrador Zona Sul") String name,
		@DefaultValue("") String siteUrl) {
}
