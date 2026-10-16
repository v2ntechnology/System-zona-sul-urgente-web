package br.com.zonasulurgente.api.auth.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Regras de sessão e login (ARCHITECTURE §8). {@code totpKey}: chave AES-256 em base64 que
 * criptografa os segredos TOTP no banco (variável TOTP_ENCRYPTION_KEY; fora do banco).
 */
@ConfigurationProperties("zsu.auth")
public record AuthProperties(
		@DefaultValue("12h") Duration sessionIdle,
		@DefaultValue("7d") Duration sessionMax,
		@DefaultValue("5m") Duration challengeTtl,
		@DefaultValue("5") int maxFailures,
		@DefaultValue("15m") Duration lockout,
		@DefaultValue("") String totpKey,
		@DefaultValue("Zona Sul Urgente") String totpIssuer) {
}
