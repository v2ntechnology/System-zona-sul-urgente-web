package br.com.zonasulurgente.api.media;

import java.nio.file.Path;
import java.time.Duration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Escolhe o armazenamento das fotos e, no modo local, serve a pasta em /media/**. */
@Configuration(proxyBeanMethods = false)
class MediaConfig {

	@Bean
	@ConditionalOnProperty(name = "zsu.media.storage", havingValue = "s3")
	MediaStorage s3MediaStorage(MediaProperties props) {
		return new S3MediaStorage(props.s3());
	}

	@Bean
	@ConditionalOnProperty(name = "zsu.media.storage", havingValue = "local", matchIfMissing = true)
	LocalMediaStorage localMediaStorage(MediaProperties props) {
		return new LocalMediaStorage(Path.of(props.localDir()));
	}

	@Bean
	@ConditionalOnProperty(name = "zsu.media.storage", havingValue = "local", matchIfMissing = true)
	WebMvcConfigurer localMediaFiles(LocalMediaStorage storage) {
		return new WebMvcConfigurer() {
			@Override
			public void addResourceHandlers(ResourceHandlerRegistry registry) {
				registry.addResourceHandler("/media/**")
					.addResourceLocations(storage.root().resolve("media").toUri().toString() + "/")
					.setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
			}
		};
	}

}
