package br.com.zonasulurgente.api.instagram;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import javax.imageio.ImageIO;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import tools.jackson.databind.json.JsonMapper;

/**
 * Servidor HTTP local que imita a API da Meta (login unificado) para os testes da spec 001 — sem rede nem conta
 * real. Responde a conta, a lista de posts (com paginação por cursor), um post pelo ID e serve imagens JPEG reais.
 * Permite simular post apagado, legenda alterada e erros da Graph API.
 */
final class FakeGraphServer {

	static final String ACCOUNT_ID = "17841400000000001";
	static final String USERNAME = "zonasulurgentereserva";
	static final String TOKEN = "EAAtokendetesteparaafakegraph1234";

	private static final JsonMapper JSON = JsonMapper.builder().build();
	private static final DateTimeFormatter META_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");
	private static final byte[] JPEG = jpeg();

	/** Post na conta falsa. {@code children}: mídias do carrossel ({@code VIDEO} usa só a capa). */
	record Post(String id, String caption, String mediaType, String productType, boolean withMediaUrl,
			boolean withThumbnail, OffsetDateTime timestamp, String altText, List<String> children) {
	}

	private final HttpServer server;
	private final List<Post> posts = new CopyOnWriteArrayList<>();
	private final Set<String> deleted = new HashSet<>();
	private final List<String> authorizations = new CopyOnWriteArrayList<>();
	private final List<String> paths = new CopyOnWriteArrayList<>();
	/** Quantas chamadas ainda falham: -1 = todas. */
	private final AtomicInteger failRemaining = new AtomicInteger();
	private volatile int errorCode;
	/** Só falham as páginas seguintes da lista de posts (query com "after="). */
	private volatile boolean onlyNextPages;
	private volatile int errorStatus;

	FakeGraphServer() {
		try {
			server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
		server.createContext("/", this::handle);
		server.start();
	}

	String baseUrl() {
		return "http://127.0.0.1:" + server.getAddress().getPort();
	}

	/** Volta ao estado inicial (sem posts, sem erros). */
	synchronized void reset() {
		posts.clear();
		deleted.clear();
		authorizations.clear();
		paths.clear();
		failRemaining.set(0);
		onlyNextPages = false;
		errorCode = 0;
		errorStatus = 0;
	}

	Post photo(String id, String caption, OffsetDateTime when) {
		return add(new Post(id, caption, "IMAGE", "FEED", true, false, when, "Descrição da foto " + id, List.of()));
	}

	Post reel(String id, String caption, OffsetDateTime when, boolean withMediaUrl, boolean withThumbnail) {
		return add(new Post(id, caption, "VIDEO", "REELS", withMediaUrl, withThumbnail, when, null, List.of()));
	}

	/** Carrossel; cada item de {@code children} é "IMAGE" ou "VIDEO". */
	Post carousel(String id, String caption, OffsetDateTime when, List<String> children) {
		return add(new Post(id, caption, "CAROUSEL_ALBUM", "FEED", false, false, when, null, children));
	}

	private Post add(Post post) {
		posts.add(post);
		return post;
	}

	void editCaption(String id, String caption) {
		posts.replaceAll(p -> p.id().equals(id) ? new Post(p.id(), caption, p.mediaType(), p.productType(),
				p.withMediaUrl(), p.withThumbnail(), p.timestamp(), p.altText(), p.children()) : p);
	}

	synchronized void delete(String id) {
		posts.removeIf(p -> p.id().equals(id));
		deleted.add(id);
	}

	/** Todas as chamadas à Graph respondem este erro ({@code status} 0 = desliga). */
	void failWith(int status, int code) {
		errorStatus = status;
		errorCode = code;
		failRemaining.set(status == 0 ? 0 : -1);
	}

	/** Só as próximas {@code n} chamadas falham com o erro configurado. */
	void failNextCalls(int n, int status, int code) {
		errorStatus = status;
		errorCode = code;
		failRemaining.set(n);
	}

	/** A primeira página da lista responde; as seguintes falham (leitura cortada no meio). */
	void failNextPages(int status, int code) {
		errorStatus = status;
		errorCode = code;
		onlyNextPages = true;
		failRemaining.set(-1);
	}

	List<String> authorizations() {
		return authorizations;
	}

	List<String> paths() {
		return paths;
	}

	int mediaListCalls() {
		return (int) paths.stream().filter(p -> p.endsWith("/media")).count();
	}

	static String permalink(String id) {
		return "https://www.instagram.com/p/C" + id + "/";
	}

	void stop() {
		server.stop(0);
	}

	// ------------------------------------------------------------------ HTTP

	private void handle(HttpExchange exchange) throws IOException {
		String path = exchange.getRequestURI().getPath();
		paths.add(path);
		if (path.startsWith("/img/")) {
			send(exchange, 200, "image/jpeg", JPEG);
			return;
		}
		authorizations.add(String.valueOf(exchange.getRequestHeaders().getFirst("Authorization")));
		String rawQuery = exchange.getRequestURI().getRawQuery();
		boolean nextPage = rawQuery != null && rawQuery.contains("after=");
		if ((!onlyNextPages || nextPage) && shouldFail()) {
			json(exchange, errorStatus, errorCode == 0 ? Map.of("error", Map.of("message", "Erro simulado"))
					: Map.of("error", Map.of("message", "Erro simulado", "code", errorCode)));
			return;
		}
		String[] parts = path.replaceFirst("^/", "").split("/");
		if (!("Bearer " + TOKEN).equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
			json(exchange, 400, Map.of("error", Map.of("message", "Invalid OAuth access token", "code", 190)));
			return;
		}
		Map<String, String> query = query(exchange.getRequestURI().getRawQuery());
		if (parts.length == 1 && parts[0].equals(ACCOUNT_ID)) {
			json(exchange, 200, Map.of("id", ACCOUNT_ID, "username", USERNAME, "name", "Zona Sul Urgente Reserva",
					"media_count", posts.size()));
		}
		else if (parts.length == 2 && parts[0].equals(ACCOUNT_ID) && parts[1].equals("media")) {
			int limit = Integer.parseInt(query.getOrDefault("limit", "25"));
			int start = Integer.parseInt(query.getOrDefault("after", "0"));
			List<Post> sorted = posts.stream().sorted(Comparator.comparing(Post::timestamp).reversed()).toList();
			List<Object> data = new ArrayList<>();
			for (int i = start; i < Math.min(sorted.size(), start + limit); i++) {
				data.add(toJson(sorted.get(i)));
			}
			Map<String, Object> body = new LinkedHashMap<>();
			body.put("data", data);
			if (start + limit < sorted.size()) {
				body.put("paging", Map.of("cursors", Map.of("after", String.valueOf(start + limit)), "next",
						baseUrl() + "/" + ACCOUNT_ID + "/media?after=" + (start + limit)));
			}
			json(exchange, 200, body);
		}
		else if (parts.length == 1) {
			Post post = posts.stream().filter(p -> p.id().equals(parts[0])).findFirst().orElse(null);
			if (post == null) {
				json(exchange, 400, Map.of("error", Map.of("message",
						"Object does not exist, cannot be loaded due to missing permissions", "code", 100,
						"error_subcode", 33)));
			}
			else {
				json(exchange, 200, toJson(post));
			}
		}
		else {
			json(exchange, 404, Map.of("error", Map.of("message", "Unknown path", "code", 100)));
		}
	}

	private boolean shouldFail() {
		if (errorStatus == 0) {
			return false;
		}
		int remaining = failRemaining.get();
		return remaining == -1 || (remaining > 0 && failRemaining.compareAndSet(remaining, remaining - 1));
	}

	private Map<String, Object> toJson(Post p) {
		Map<String, Object> item = new LinkedHashMap<>();
		item.put("id", p.id());
		if (p.caption() != null) {
			item.put("caption", p.caption());
		}
		item.put("media_type", p.mediaType());
		item.put("media_product_type", p.productType());
		if (p.withMediaUrl()) {
			item.put("media_url", baseUrl() + "/img/" + p.id() + (p.mediaType().equals("VIDEO") ? ".mp4" : ".jpg"));
		}
		if (p.withThumbnail()) {
			item.put("thumbnail_url", baseUrl() + "/img/" + p.id() + "-capa.jpg");
		}
		item.put("permalink", permalink(p.id()));
		item.put("timestamp", META_TIME.format(p.timestamp().withOffsetSameInstant(ZoneOffset.UTC)));
		if (p.altText() != null) {
			item.put("alt_text", p.altText());
		}
		if (!p.children().isEmpty()) {
			List<Object> children = new ArrayList<>();
			for (int i = 0; i < p.children().size(); i++) {
				boolean video = p.children().get(i).equals("VIDEO");
				Map<String, Object> child = new LinkedHashMap<>();
				child.put("id", p.id() + "-" + i);
				child.put("media_type", video ? "VIDEO" : "IMAGE");
				child.put("media_url", baseUrl() + "/img/" + p.id() + "-" + i + (video ? ".mp4" : ".jpg"));
				if (video) {
					child.put("thumbnail_url", baseUrl() + "/img/" + p.id() + "-" + i + "-capa.jpg");
				}
				children.add(child);
			}
			item.put("children", Map.of("data", children));
		}
		return item;
	}

	private static Map<String, String> query(String raw) {
		Map<String, String> out = new LinkedHashMap<>();
		if (raw == null) {
			return out;
		}
		for (String pair : raw.split("&")) {
			int eq = pair.indexOf('=');
			if (eq > 0) {
				out.put(URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8),
						URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
			}
		}
		return out;
	}

	private static void json(HttpExchange exchange, int status, Object body) throws IOException {
		send(exchange, status, "application/json", JSON.writeValueAsBytes(body));
	}

	private static void send(HttpExchange exchange, int status, String type, byte[] bytes) throws IOException {
		exchange.getResponseHeaders().add("Content-Type", type);
		exchange.sendResponseHeaders(status, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	}

	/** JPEG 800×600 de verdade (o processamento de fotos usa libvips). */
	private static byte[] jpeg() {
		BufferedImage image = new BufferedImage(800, 600, BufferedImage.TYPE_INT_RGB);
		var g = image.createGraphics();
		g.setColor(new Color(2, 75, 170));
		g.fillRect(0, 0, 800, 600);
		g.setColor(Color.WHITE);
		g.fillOval(300, 200, 200, 200);
		g.dispose();
		try {
			ByteArrayOutputStream out = new ByteArrayOutputStream();
			ImageIO.write(image, "jpg", out);
			return out.toByteArray();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

}
