package br.com.zonasulurgente.api.instagram;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Chamadas à API da Meta ("login unificado", BE-013, spec 001 R1/R3/R9). O acesso vai sempre no cabeçalho
 * {@code Authorization: Bearer} — nunca na URL, em mensagem de erro ou em log. Erros da Meta viram
 * {@link AccessRevokedException} (acesso não serve mais), {@link TransientGraphException} (tentar no próximo ciclo)
 * ou {@link GraphRejectedException} (pedido recusado, ex.: conta inexistente).
 */
@Component
public class InstagramGraphClient {

	/** Campos de cada post (research.md R3). */
	static final String MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,"
			+ "timestamp,alt_text,children{id,media_type,media_url,thumbnail_url,alt_text}";

	static final int PAGE_SIZE = 25;

	/** Maior download aceito (o envio de fotos recusa acima de 10 MB). */
	static final int MAX_DOWNLOAD = 11 * 1024 * 1024;

	/** A Meta manda "2026-11-16T17:11:22+0000" (sem dois-pontos no fuso). */
	private static final DateTimeFormatter META_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");

	public record Account(String id, String username, String name, Integer mediaCount) {
	}

	public record Child(String id, String mediaType, String mediaUrl, String thumbnailUrl, String altText) {
	}

	public record Media(String id, String caption, String mediaType, String mediaProductType, String mediaUrl,
			String thumbnailUrl, String permalink, OffsetDateTime timestamp, String altText, List<Child> children) {

		public Media {
			children = children == null ? List.of() : List.copyOf(children);
		}

	}

	/** Uma página de posts; {@code after} nulo = última página. */
	public record Page(List<Media> items, String after) {
	}

	/** Falha da Meta. {@code code}/{@code subcode} vêm do corpo de erro da Graph API (0 quando não há). */
	public abstract static sealed class GraphException extends RuntimeException
			permits AccessRevokedException, TransientGraphException, GraphRejectedException {

		private final int code;

		GraphException(String message, int code) {
			super(message);
			this.code = code;
		}

		public int code() {
			return code;
		}

	}

	/** Acesso inválido, revogado ou sem permissão (190, 10, 200…): parar e pedir para religar. */
	public static final class AccessRevokedException extends GraphException {

		AccessRevokedException(String message, int code) {
			super(message, code);
		}

	}

	/** Meta fora do ar, limite de chamadas ou tempo esgotado: tentar de novo depois. */
	public static final class TransientGraphException extends GraphException {

		TransientGraphException(String message, int code) {
			super(message, code);
		}

	}

	/** Pedido recusado por outro motivo (conta inexistente, parâmetro inválido). */
	public static final class GraphRejectedException extends GraphException {

		GraphRejectedException(String message, int code) {
			super(message, code);
		}

	}

	private final InstagramProperties props;
	private final JsonMapper json;
	private final RestClient http;

	public InstagramGraphClient(InstagramProperties props, JsonMapper json) {
		this.props = props;
		this.json = json;
		var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
			.connectTimeout(props.timeout())
			.followRedirects(HttpClient.Redirect.NORMAL)
			.build());
		factory.setReadTimeout(props.timeout());
		this.http = RestClient.builder().requestFactory(factory).build();
	}

	/** Dados da conta. Serve também para validar o acesso ao ligar. */
	public Account account(String igUserId, String token) {
		JsonNode node = get(url(igUserId).queryParam("fields", "id,username,name,media_count"), token);
		return new Account(node.path("id").asString(), node.path("username").asString(),
				text(node, "name"), node.has("media_count") ? node.path("media_count").asInt() : null);
	}

	/** Posts do mais novo para o mais antigo. {@code after} = cursor da página anterior (nulo na primeira). */
	public Page media(String igUserId, String token, String after) {
		UriComponentsBuilder url = url(igUserId, "media")
			.queryParam("fields", MEDIA_FIELDS)
			.queryParam("limit", PAGE_SIZE);
		if (after != null) {
			url.queryParam("after", after);
		}
		JsonNode node = get(url, token);
		List<Media> items = new ArrayList<>();
		for (JsonNode item : node.path("data")) {
			items.add(toMedia(item));
		}
		boolean more = node.path("paging").has("next");
		String cursor = text(node.path("paging").path("cursors"), "after");
		return new Page(items, more ? cursor : null);
	}

	/** Um post. Vazio quando a Meta diz que ele não existe mais (apagado). */
	public Optional<Media> mediaById(String mediaId, String token) {
		try {
			return Optional.of(toMedia(get(url(mediaId).queryParam("fields", MEDIA_FIELDS), token)));
		}
		catch (GraphRejectedException e) {
			if (e.code() == 100) {
				return Optional.empty();
			}
			throw e;
		}
	}

	/** Baixa uma imagem do CDN da Meta (sem acesso: os endereços já são assinados). */
	public byte[] download(String url) {
		try {
			return http.get().uri(URI.create(url)).exchange((request, response) -> {
				int status = response.getStatusCode().value();
				if (status >= 500 || status == 429) {
					throw new TransientGraphException("O Instagram não entregou a imagem (HTTP " + status + ").", 0);
				}
				if (status >= 400) {
					throw new GraphRejectedException("A imagem não está mais disponível (HTTP " + status + ").", 0);
				}
				try (InputStream body = response.getBody()) {
					byte[] bytes = body.readNBytes(MAX_DOWNLOAD + 1);
					if (bytes.length > MAX_DOWNLOAD) {
						throw new GraphRejectedException("Imagem grande demais.", 0);
					}
					return bytes;
				}
			});
		}
		catch (ResourceAccessException e) {
			throw new TransientGraphException("O Instagram não respondeu ao baixar a imagem.", 0);
		}
	}

	private UriComponentsBuilder url(String... path) {
		return UriComponentsBuilder.fromUriString(props.graphBaseUrl()).pathSegment(path);
	}

	private JsonNode get(UriComponentsBuilder url, String token) {
		try {
			return http.get()
				.uri(url.build().encode().toUri())
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.exchange((request, response) -> {
					int status = response.getStatusCode().value();
					JsonNode body = read(response.getBody());
					if (status < 400 && !body.has("error")) {
						return body;
					}
					throw classify(status, body.path("error"));
				});
		}
		catch (ResourceAccessException e) {
			throw new TransientGraphException("A Meta não respondeu (tempo esgotado ou sem conexão).", 0);
		}
	}

	private JsonNode read(InputStream body) throws IOException {
		byte[] bytes = body.readAllBytes();
		return bytes.length == 0 ? json.createObjectNode() : json.readTree(bytes);
	}

	/** Códigos da Graph API: https://developers.facebook.com/docs/graph-api/guides/error-handling */
	static GraphException classify(int status, JsonNode error) {
		int code = error.path("code").asInt(0);
		return switch (code) {
			case 190, 10, 200, 102 -> new AccessRevokedException(
					"O acesso à conta do Instagram não é mais válido (código " + code + ").", code);
			case 1, 2, 4, 17, 32, 341, 613 -> new TransientGraphException(
					"A Meta está limitando ou fora do ar no momento (código " + code + ").", code);
			default -> status >= 500 || status == 429
					? new TransientGraphException("A Meta respondeu com erro (HTTP " + status + ").", code)
					: new GraphRejectedException("A Meta recusou o pedido (código " + code + ").", code);
		};
	}

	private static Media toMedia(JsonNode item) {
		List<Child> children = new ArrayList<>();
		for (JsonNode child : item.path("children").path("data")) {
			children.add(new Child(child.path("id").asString(), text(child, "media_type"), text(child, "media_url"),
					text(child, "thumbnail_url"), text(child, "alt_text")));
		}
		return new Media(item.path("id").asString(), text(item, "caption"), text(item, "media_type"),
				text(item, "media_product_type"), text(item, "media_url"), text(item, "thumbnail_url"),
				text(item, "permalink"), time(text(item, "timestamp")), text(item, "alt_text"), children);
	}

	private static String text(JsonNode node, String field) {
		JsonNode value = node.path(field);
		return value.isMissingNode() || value.isNull() || value.asString().isBlank() ? null : value.asString();
	}

	static OffsetDateTime time(String value) {
		if (value == null) {
			return null;
		}
		try {
			return OffsetDateTime.parse(value, META_TIME);
		}
		catch (DateTimeParseException e) {
			return OffsetDateTime.parse(value);
		}
	}

}
