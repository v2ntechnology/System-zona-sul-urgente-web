package br.com.zonasulurgente.api.usage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import com.sun.net.httpserver.HttpServer;

/**
 * API de métricas da Cloudflare (GraphQL) falsa para os testes do monitor (spec 004): devolve o espaço de dois buckets
 * (o mais novo primeiro, como a real com orderBy datetime_DESC) e operações por actionType. Pode falhar sob comando.
 */
class FakeCloudflareGraphql {

	static final String ACCOUNT = "conta-de-teste";
	static final String TOKEN = "token-so-leitura-de-teste";

	private final HttpServer server;

	volatile long storageBytes;
	volatile long otherBucketBytes;
	volatile long putObjects;
	volatile long getObjects;
	volatile boolean fail;
	volatile String lastAuthorization;
	volatile int calls;

	FakeCloudflareGraphql() {
		try {
			server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
		server.createContext("/graphql", exchange -> {
			calls++;
			lastAuthorization = exchange.getRequestHeaders().getFirst("Authorization");
			exchange.getRequestBody().readAllBytes();
			byte[] body;
			int status = 200;
			if (fail) {
				status = 503;
				body = "{\"errors\":[{\"message\":\"fora do ar\"}]}".getBytes(StandardCharsets.UTF_8);
			}
			else {
				body = """
						{"data":{"viewer":{"accounts":[{
						  "storage":[
						    {"max":{"payloadSize":%d,"metadataSize":0,"objectCount":3},
						     "dimensions":{"bucketName":"zsu-media","datetime":"2026-11-18T16:00:00Z"}},
						    {"max":{"payloadSize":%d,"metadataSize":0,"objectCount":1},
						     "dimensions":{"bucketName":"outro","datetime":"2026-11-18T16:00:00Z"}},
						    {"max":{"payloadSize":1,"metadataSize":0,"objectCount":1},
						     "dimensions":{"bucketName":"zsu-media","datetime":"2026-11-18T15:00:00Z"}}],
						  "operations":[
						    {"sum":{"requests":%d},"dimensions":{"actionType":"PutObject"}},
						    {"sum":{"requests":%d},"dimensions":{"actionType":"GetObject"}},
						    {"sum":{"requests":7},"dimensions":{"actionType":"DeleteObject"}}]
						}]}},"errors":null}"""
					.formatted(storageBytes, otherBucketBytes, putObjects, getObjects)
					.getBytes(StandardCharsets.UTF_8);
			}
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(status, body.length);
			try (var out = exchange.getResponseBody()) {
				out.write(body);
			}
		});
		server.start();
	}

	String url() {
		return "http://127.0.0.1:" + server.getAddress().getPort() + "/graphql";
	}

	void reset() {
		storageBytes = 0;
		otherBucketBytes = 0;
		putObjects = 0;
		getObjects = 0;
		fail = false;
		calls = 0;
	}

}
