package br.com.zonasulurgente.api.ai;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.databind.json.JsonMapper;

/** Escolhe o fornecedor da IA por {@code zsu.ai.provider}. Gemini sem chave impede a API de subir. */
@Configuration(proxyBeanMethods = false)
class AiConfig {

	@Bean
	@ConditionalOnProperty(name = "zsu.ai.provider", havingValue = "gemini")
	EditorialAiProvider geminiEditorialAi(AiProperties props, JsonMapper json) {
		return new GeminiEditorialAi(props.gemini(), json);
	}

	@Bean
	@ConditionalOnProperty(name = "zsu.ai.provider", havingValue = "fake", matchIfMissing = true)
	EditorialAiProvider fakeEditorialAi() {
		return new FakeEditorialAi();
	}

}
