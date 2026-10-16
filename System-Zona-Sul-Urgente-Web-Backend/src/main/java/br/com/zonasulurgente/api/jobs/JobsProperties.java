package br.com.zonasulurgente.api.jobs;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Worker da fila (BE-010). {@code enabled=false} desliga o consumo e a publicação automática
 * (testes chamam os métodos direto). {@code batchSize}: jobs pegos por rodada, por instância.
 */
@ConfigurationProperties("zsu.jobs")
public record JobsProperties(
		@DefaultValue("true") boolean enabled,
		@DefaultValue("10") int batchSize,
		@DefaultValue("10s") Duration firstRetry,
		@DefaultValue("30m") Duration maxRetry,
		@DefaultValue("10m") Duration stuckAfter) {
}
