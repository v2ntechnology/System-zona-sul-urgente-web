package br.com.zonasulurgente.api.shared.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.TestcontainersConfiguration;

/** BE-003/BE-020/BE-021: schema editorial, regras no banco e busca em português. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@ActiveProfiles("local")
@Transactional
class EditorialSchemaTests {

	@Autowired
	JdbcClient jdbc;

	@Test
	void localSeedLoadsTheFrontendSampleData() {
		long published = jdbc.sql("SELECT count(*) FROM news WHERE status = 'PUBLISHED'")
			.query(Long.class).single();
		assertThat(published).isGreaterThan(30);
		String zone = jdbc.sql("""
				SELECT z.name FROM neighborhoods n JOIN zones z ON z.id = n.zone_id
				WHERE n.slug = 'copacabana'""").query(String.class).single();
		assertThat(zone).isEqualTo("Zona Sul");
	}

	@Test
	void searchIgnoresAccentsAndCase() {
		List<String> slugs = jdbc.sql("""
				SELECT slug FROM news
				WHERE search_vector @@ websearch_to_tsquery('portuguese', f_unaccent(:q))""")
			.param("q", "TUNEL reboucas")
			.query(String.class).list();
		assertThat(slugs).isNotEmpty();
	}

	@Test
	void subcategoryCannotHaveASubcategoryParent() {
		assertThatThrownBy(() -> jdbc.sql("""
				INSERT INTO categories (slug, name, parent_id)
				SELECT 'sub-de-sub', 'Sub de sub', id FROM categories WHERE slug = 'gastronomia'""")
			.update())
			.isInstanceOf(DataIntegrityViolationException.class)
			.hasMessageContaining("editoria mãe precisa ser uma editoria principal");
	}

	@Test
	void slugsMustBeLowercaseWithHyphens() {
		assertThatThrownBy(() -> jdbc.sql("INSERT INTO categories (slug, name) VALUES ('Meio Ambiente', 'x')")
			.update()).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void publishedNewsNeedsPublishDate() {
		assertThatThrownBy(() -> jdbc.sql("""
				INSERT INTO news (slug, title, summary, category_id, status)
				SELECT 'sem-data', 'Sem data', 'Resumo', id, 'PUBLISHED' FROM categories LIMIT 1""")
			.update()).isInstanceOf(DataIntegrityViolationException.class);
	}

}
