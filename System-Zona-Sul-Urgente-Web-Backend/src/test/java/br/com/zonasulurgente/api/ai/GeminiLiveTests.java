package br.com.zonasulurgente.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import tools.jackson.databind.json.JsonMapper;

/**
 * Chamada REAL ao Gemini (gasta cota): só roda com GEMINI_LIVE_TEST=true e GEMINI_API_KEY no ambiente.
 * Uso: docker run ... --env-file .env -e GEMINI_LIVE_TEST=true zsu-jdk-vips ./mvnw test -Dtest=GeminiLiveTests
 */
@EnabledIfEnvironmentVariable(named = "GEMINI_LIVE_TEST", matches = "true")
class GeminiLiveTests {

	@Test
	void draftsARealPost() {
		var config = new AiProperties.Gemini(System.getenv("GEMINI_API_KEY"),
				System.getenv().getOrDefault("GEMINI_MODEL", "gemini-3.7-flash"),
				System.getenv().getOrDefault("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite"),
				"https://generativelanguage.googleapis.com", "2026-05-20", Duration.ofSeconds(90));
		var ai = new GeminiEditorialAi(config, JsonMapper.builder().build());
		var context = new EditorialContext(
				List.of(new EditorialContext.Option("seguranca", "Segurança"),
						new EditorialContext.Option("transito", "Trânsito"),
						new EditorialContext.Option("cidade", "Cidade"),
						new EditorialContext.Option("eventos", "Eventos")),
				List.of(new EditorialContext.Option("copacabana", "Copacabana"),
						new EditorialContext.Option("botafogo", "Botafogo"),
						new EditorialContext.Option("lagoa", "Lagoa")));
		var post = new SourcePost("""
				⚠️ ATENÇÃO MORADORES! Árvore de grande porte caiu agora há pouco na Rua Voluntários da Pátria, \
				altura do número 300, em Botafogo 🌳🚨 A via está totalmente interditada no sentido Centro. \
				Equipes da Comlurb e da CET-Rio já estão no local. Evitem a região!! \
				Vídeo enviado por seguidor 🙏 #botafogo #transito #riodejaneiro @cetrio
				""", "https://www.instagram.com/p/exemplo/", null);

		AiDraft draft = ai.draftFromPost(post, context);

		System.out.println("== " + draft.generatedBy());
		System.out.println("titulo: " + draft.title());
		System.out.println("subtitulo: " + draft.subtitle());
		System.out.println("resumo: " + draft.summary());
		draft.paragraphs().forEach(p -> System.out.println("§ " + p));
		System.out.println("editoria: " + draft.categorySlug() + " | bairro: " + draft.neighborhoodSlug()
				+ " | topicos: " + draft.tags() + " | urgente: " + draft.urgent() + " | publicidade: "
				+ draft.advertising());
		assertThat(draft.title()).isNotBlank();
		assertThat(draft.paragraphs()).isNotEmpty();
	}

}
