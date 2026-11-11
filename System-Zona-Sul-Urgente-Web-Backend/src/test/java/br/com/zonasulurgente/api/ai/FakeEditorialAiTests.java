package br.com.zonasulurgente.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/** BE-014: a IA falsa (dev e testes) devolve um rascunho dentro dos limites do editor. */
class FakeEditorialAiTests {

	@Test
	void reorganizesThePostWithoutNetwork() {
		var context = new EditorialContext(List.of(new EditorialContext.Option("cidade", "Cidade")), List.of());
		var post = new SourcePost("""
				URGENTE: Rua Barata Ribeiro alagada agora. Evitem a região! #chuva @defesacivilrj

				Motoristas relatam água na altura do meio-fio.
				""", null, null);

		AiDraft draft = new FakeEditorialAi().draftFromPost(post, context);

		assertThat(draft.title()).isEqualTo("URGENTE: Rua Barata Ribeiro alagada agora");
		assertThat(draft.paragraphs()).hasSize(2).noneMatch(p -> p.contains("#") || p.contains("@"));
		assertThat(draft.categorySlug()).isEqualTo("cidade");
		assertThat(draft.urgent()).isTrue();
		assertThat(draft.summary().length()).isLessThanOrEqualTo(300);
	}

}
