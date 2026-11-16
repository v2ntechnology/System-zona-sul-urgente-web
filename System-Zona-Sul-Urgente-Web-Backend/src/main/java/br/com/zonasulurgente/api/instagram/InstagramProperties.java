package br.com.zonasulurgente.api.instagram;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Sincronização com a conta do Instagram (BE-013, spec 001). O acesso não fica aqui: é colado no painel e guardado
 * cifrado no banco. {@code graphBaseUrl}: API da Meta ("login unificado"); os testes apontam para um servidor local.
 * {@code backfill}: posts antigos que entram na primeira conexão. {@code reconcileWindow}: janela em que legenda
 * alterada e post apagado são conferidos. {@code failuresBeforeAlert}: falhas passageiras seguidas antes de avisar.
 */
@ConfigurationProperties("zsu.instagram")
public record InstagramProperties(
		@DefaultValue("https://graph.facebook.com/v27.0") String graphBaseUrl,
		@DefaultValue("15m") Duration syncInterval,
		@DefaultValue("7d") Duration backfill,
		@DefaultValue("30d") Duration reconcileWindow,
		@DefaultValue("3") int failuresBeforeAlert,
		@DefaultValue("20s") Duration timeout) {
}
