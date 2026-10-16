package br.com.zonasulurgente.api.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;

import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

/** BE-012: gravação no bucket S3 (R2 em produção) contra um S3 de teste (Adobe S3Mock). */
@Testcontainers
class S3MediaStorageTests {

	@Container
	static final GenericContainer<?> s3mock = new GenericContainer<>("adobe/s3mock:5.2.3")
		.withEnv("COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS", "zsu-media")
		.withExposedPorts(9090);

	@Test
	void storesWithImmutableCacheAndContentType() {
		String endpoint = "http://" + s3mock.getHost() + ":" + s3mock.getMappedPort(9090);
		var config = new MediaProperties.S3(endpoint, "zsu-media", "auto", "teste", "teste", true);
		try (S3MediaStorage storage = new S3MediaStorage(config);
				S3Client client = S3Client.builder()
					.endpointOverride(URI.create(endpoint))
					.region(Region.of("auto"))
					.forcePathStyle(true)
					.credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("teste", "teste")))
					.httpClient(UrlConnectionHttpClient.create())
					.build()) {
			storage.put("media/2026/10/abc/800.webp", new byte[] { 1, 2, 3 }, "image/webp");

			var object = client.getObjectAsBytes(b -> b.bucket("zsu-media").key("media/2026/10/abc/800.webp"));
			assertThat(object.asByteArray()).containsExactly(1, 2, 3);
			assertThat(object.response().contentType()).isEqualTo("image/webp");
			assertThat(object.response().cacheControl()).isEqualTo(MediaStorage.CACHE_CONTROL);
		}
	}

	@Test
	void refusesToStartWithoutCredentials() {
		var config = new MediaProperties.S3("", "", "auto", "", "", false);
		org.assertj.core.api.Assertions.assertThatThrownBy(() -> new S3MediaStorage(config))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("MEDIA_S3_ENDPOINT");
	}

}
