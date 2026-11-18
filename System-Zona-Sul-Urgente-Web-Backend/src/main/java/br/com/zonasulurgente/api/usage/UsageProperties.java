package br.com.zonasulurgente.api.usage;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Monitor de uso dos planos gratuitos (spec 004, FR-013). Os recursos são configuração, não código: cada um diz como é
 * medido ({@link Meter}), o limite grátis, a janela da cota e, se pode travar, em que porcentagem. Recurso que não
 * está aqui não aparece na tela nem trava. Chave com ponto vai entre colchetes no YAML: {@code "[fotos.espaco]"}.
 */
@ConfigurationProperties("zsu.usage")
public record UsageProperties(
		@DefaultValue("30m") Duration refresh,
		@DefaultValue("1m") Duration manualRefreshInterval,
		@DefaultValue("70") int warnAt,
		@DefaultValue("90") int criticalAt,
		@DefaultValue Cloudflare cloudflare,
		Map<String, Resource> resources) {

	public UsageProperties {
		resources = resources == null ? Map.of() : Map.copyOf(resources);
	}

	public enum Unit {
		BYTES, OPERATIONS, REQUESTS
	}

	/** Janela da cota: quando o contador zera. {@code DAY_PACIFIC} = meia-noite do horário do Pacífico (Gemini). */
	public enum Period {
		NONE, MINUTE, DAY_PACIFIC, MONTH
	}

	/** De onde vem o número. {@code COUNTER} = só a conta do próprio sistema. */
	public enum Meter {
		CLOUDFLARE_R2_STORAGE, CLOUDFLARE_R2_CLASS_A, CLOUDFLARE_R2_CLASS_B, DISK, COUNTER
	}

	/**
	 * Um recurso. {@code limit} nulo: se {@code requireLimit}, aparece como "Sem limite configurado" (crítico, e trava
	 * tudo se tiver {@code lockAt}) — usado na IA, onde sumir esconderia a falta de trava (análise G1). {@code order}
	 * só ordena a tela.
	 */
	public record Resource(String label, Unit unit, Long limit, @DefaultValue("NONE") Period period, Integer lockAt,
			@DefaultValue("COUNTER") Meter meter, @DefaultValue("false") boolean requireLimit,
			@DefaultValue("100") int order) {
	}

	/**
	 * API de métricas da Cloudflare (GraphQL). {@code apiToken} só de leitura ("Account Analytics: Read"), no
	 * {@code .env}. Classes A (gravação) e B (leitura) pela lista de preços do R2 — na configuração porque mudam.
	 */
	public record Cloudflare(
			@DefaultValue("") String accountId,
			@DefaultValue("") String apiToken,
			@DefaultValue("https://api.cloudflare.com/client/v4/graphql") String graphqlUrl,
			@DefaultValue("20s") Duration timeout,
			@DefaultValue({ "ListBuckets", "PutBucket", "ListObjects", "PutObject", "CopyObject",
					"CompleteMultipartUpload", "CreateMultipartUpload", "LifecycleStorageTierTransition",
					"ListMultipartUploads", "UploadPart", "UploadPartCopy", "ListParts", "PutBucketEncryption",
					"PutBucketCors", "PutBucketLifecycleConfiguration" }) List<String> classA,
			@DefaultValue({ "HeadBucket", "HeadObject", "GetObject", "UsageSummary", "GetBucketEncryption",
					"GetBucketLocation", "GetBucketCors", "GetBucketLifecycleConfiguration" }) List<String> classB) {

		public boolean configured() {
			return !accountId.isBlank() && !apiToken.isBlank();
		}

	}

}
