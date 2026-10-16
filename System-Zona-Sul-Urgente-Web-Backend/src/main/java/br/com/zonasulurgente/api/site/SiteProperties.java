package br.com.zonasulurgente.api.site;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Site Next (BE-011). {@code revalidateUrl}: endereço INTERNO do Next (ex.: http://web:3000);
 * {@code revalidateSecret}: o mesmo REVALIDATE_SECRET do Next. Vazios = revalidação desligada
 * (o site atualiza só quando o cache vence).
 */
@ConfigurationProperties("zsu.site")
public record SiteProperties(
		@DefaultValue("") String revalidateUrl,
		@DefaultValue("") String revalidateSecret,
		@DefaultValue("10s") Duration timeout) {

	public boolean revalidationEnabled() {
		return !revalidateUrl.isBlank() && !revalidateSecret.isBlank();
	}

}
