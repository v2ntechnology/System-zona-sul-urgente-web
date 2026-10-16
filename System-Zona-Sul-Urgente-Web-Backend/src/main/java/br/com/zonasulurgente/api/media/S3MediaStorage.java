package br.com.zonasulurgente.api.media;

import java.net.URI;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/** Produção: Cloudflare R2 pela API S3 (qualquer bucket S3 compatível serve). */
class S3MediaStorage implements MediaStorage, AutoCloseable {

	private final S3Client s3;
	private final String bucket;

	S3MediaStorage(MediaProperties.S3 config) {
		if (config.endpoint().isBlank() || config.bucket().isBlank() || config.accessKey().isBlank()
				|| config.secretKey().isBlank()) {
			throw new IllegalStateException(
					"zsu.media.storage=s3 exige MEDIA_S3_ENDPOINT, MEDIA_S3_BUCKET, MEDIA_S3_ACCESS_KEY e MEDIA_S3_SECRET_KEY");
		}
		this.bucket = config.bucket();
		this.s3 = S3Client.builder()
			.endpointOverride(URI.create(config.endpoint()))
			.region(Region.of(config.region()))
			.forcePathStyle(config.pathStyle())
			.credentialsProvider(StaticCredentialsProvider
				.create(AwsBasicCredentials.create(config.accessKey(), config.secretKey())))
			.httpClient(UrlConnectionHttpClient.create())
			.build();
	}

	@Override
	public void put(String key, byte[] content, String contentType) {
		s3.putObject(PutObjectRequest.builder()
			.bucket(bucket)
			.key(key)
			.contentType(contentType)
			.cacheControl(CACHE_CONTROL)
			.build(), RequestBody.fromBytes(content));
	}

	@Override
	public void close() {
		s3.close();
	}

}
