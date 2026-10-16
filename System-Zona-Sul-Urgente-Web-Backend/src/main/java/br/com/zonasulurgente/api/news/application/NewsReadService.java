package br.com.zonasulurgente.api.news.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.news.infrastructure.NewsReadRepository;
import br.com.zonasulurgente.api.news.infrastructure.NewsReadRepository.Detail;
import br.com.zonasulurgente.api.shared.contract.BreakingNews;
import br.com.zonasulurgente.api.shared.contract.Category;
import br.com.zonasulurgente.api.shared.contract.News;
import br.com.zonasulurgente.api.shared.contract.NewsSummary;
import br.com.zonasulurgente.api.shared.contract.Page;
import br.com.zonasulurgente.api.shared.web.Cursor;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import br.com.zonasulurgente.api.taxonomy.infrastructure.TaxonomyReadRepository;

/**
 * Regras da leitura pública (BE-004), espelhando os services do frontend
 * (src/services/news-service.ts): mesmos filtros, ordens e janelas de tempo.
 */
@Service
@Transactional(readOnly = true)
public class NewsReadService {

	/** Urgentes saem da faixa depois deste tempo. */
	static final int BREAKING_WINDOW_HOURS = 6;
	static final int RELATED_LIMIT = 4;

	public enum MostReadPeriod {
		DAY("ns.views_day"), WEEK("ns.views_week"), ALL("ns.views_total");

		final String column;

		MostReadPeriod(String column) {
			this.column = column;
		}

		public static MostReadPeriod parse(String value) {
			return switch (value) {
				case "7d" -> WEEK;
				case "all" -> ALL;
				default -> DAY;
			};
		}
	}

	public record Featured(NewsSummary main, List<NewsSummary> secondary) {
	}

	public record CategoryPage(Category category, Page<NewsSummary> page) {
	}

	public record ColumnLatest(Category column, NewsSummary latest) {
	}

	/** Resultado de um caminho na raiz: editoria, matéria ou redirecionamento. */
	public sealed interface Resolved {
	}

	public record ResolvedCategory(String type, Category category) implements Resolved {
	}

	public record ResolvedNews(String type, News news, String canonicalPath) implements Resolved {
	}

	public record ResolvedRedirect(String type, String location) implements Resolved {
	}

	private final NewsReadRepository news;
	private final TaxonomyReadRepository taxonomy;

	public NewsReadService(NewsReadRepository news, TaxonomyReadRepository taxonomy) {
		this.news = news;
		this.taxonomy = taxonomy;
	}

	public Page<NewsSummary> latest(String cursor, int limit) {
		return page(null, Map.of(), cursor, limit);
	}

	public List<BreakingNews> breaking() {
		return news.list("n.is_urgent AND n.published_at > now() - make_interval(hours => :hours)",
				"n.published_at DESC", Map.of("hours", BREAKING_WINDOW_HOURS), 10, null)
			.stream()
			.map(s -> new BreakingNews(s.id(), s.slug(), s.title(), s.category(), s.publishedAt()))
			.toList();
	}

	public Optional<Featured> featured() {
		List<NewsSummary> ranked = news.list("n.featured_rank IS NOT NULL", "n.featured_rank", Map.of(), 10,
				null);
		if (ranked.isEmpty()) {
			return Optional.empty();
		}
		return Optional.of(new Featured(ranked.getFirst(), ranked.subList(1, ranked.size())));
	}

	public List<NewsSummary> videos(int limit) {
		return news.list("n.video IS NOT NULL", "n.published_at DESC", Map.of(), limit, null);
	}

	/** Patrocinadas não entram no ranking editorial. */
	public List<NewsSummary> mostRead(MostReadPeriod period, int limit) {
		return news.list("NOT n.is_sponsored", period.column + " DESC NULLS LAST, n.published_at DESC",
				Map.of(), limit, " LEFT JOIN news_stats ns ON ns.news_id = n.id");
	}

	public News bySlug(String slug) {
		return findBySlug(slug).orElseThrow(() -> new NotFoundException("Notícia não encontrada."));
	}

	public Optional<News> findBySlug(String slug) {
		return news.detail(slug).map(this::full);
	}

	public CategoryPage byCategory(String slug, String cursor, int limit) {
		Category category = taxonomy.category(slug)
			.orElseThrow(() -> new NotFoundException("Editoria não encontrada."));
		// Editoria mãe inclui as subeditorias (Entretenimento traz Gastronomia e Eventos).
		return new CategoryPage(category,
				page("c.id = :cat OR c.parent_id = :cat", Map.of("cat", category.id()), cursor, limit));
	}

	public List<ColumnLatest> latestColumns(int limit) {
		List<ColumnLatest> result = new ArrayList<>();
		for (Category column : taxonomy.categories()) {
			if (column.columnist() == null || Boolean.FALSE.equals(column.active())) {
				continue;
			}
			news.page("c.id = :cat", Map.of("cat", column.id()), null, 1)
				.stream()
				.findFirst()
				.ifPresent(latest -> result.add(new ColumnLatest(column, latest)));
		}
		result.sort((a, b) -> b.latest().publishedAt().compareTo(a.latest().publishedAt()));
		return result.subList(0, Math.min(limit, result.size()));
	}

	public Page<NewsSummary> byNeighborhood(UUID neighborhoodId, String cursor, int limit) {
		return page("n.neighborhood_id = :nb", Map.of("nb", neighborhoodId), cursor, limit);
	}

	public Page<NewsSummary> byCity(UUID cityId, String cursor, int limit) {
		return page("n.city_id = :city", Map.of("city", cityId), cursor, limit);
	}

	/**
	 * Busca (BE-005): texto completo em português sem acento; sem resultado, tenta por
	 * semelhança do título (erro de digitação: "copacbana").
	 */
	public Page<NewsSummary> search(String query, String categorySlug, String neighborhoodSlug,
			String cursor, int limit) {
		String q = query.strip();
		if (q.isEmpty()) {
			return new Page<>(List.of(), null, 0L);
		}
		var params = new java.util.HashMap<String, Object>(Map.of("q", q));
		var filters = new StringBuilder();
		if (categorySlug != null) {
			Optional<Category> category = taxonomy.category(categorySlug);
			if (category.isEmpty()) {
				return new Page<>(List.of(), null, 0L);
			}
			filters.append(" AND (c.id = :cat OR c.parent_id = :cat)");
			params.put("cat", category.get().id());
		}
		if (neighborhoodSlug != null) {
			filters.append(" AND n.neighborhood_id = (SELECT id FROM neighborhoods WHERE slug = :nb)");
			params.put("nb", neighborhoodSlug);
		}
		String fullText = "n.search_vector @@ websearch_to_tsquery('portuguese', f_unaccent(:q))" + filters;
		long total = news.count(fullText, params);
		String where = fullText;
		if (total == 0) {
			where = "word_similarity(f_unaccent(:q), f_unaccent(n.title)) > 0.45" + filters;
			total = news.count(where, params);
		}
		int offset = cursor == null ? 0 : Cursor.parseOffset(cursor);
		List<NewsSummary> items = news.search(where, params, offset, limit);
		String next = offset + items.size() < total ? Cursor.offset(offset + items.size()) : null;
		return new Page<>(items, next, total);
	}

	/** Matérias completas para RSS (sem patrocinadas: agregadores republicam sem o selo). */
	public List<News> feed(String categorySlug, int limit) {
		String where = "NOT n.is_sponsored";
		Map<String, Object> params = Map.of();
		if (categorySlug != null) {
			Category category = taxonomy.category(categorySlug)
				.orElseThrow(() -> new NotFoundException("Editoria não encontrada."));
			where += " AND (c.id = :cat OR c.parent_id = :cat)";
			params = Map.of("cat", category.id());
		}
		return news.page(where, params, null, limit).stream().map(s -> bySlug(s.slug())).toList();
	}

	/** Para o sitemap: todas, ou só as das últimas horas (Google Notícias: 48 h, sem patrocinadas). */
	public List<NewsSummary> forSitemap(Integer recentHours, int limit) {
		if (recentHours == null) {
			return news.page(null, Map.of(), null, limit);
		}
		return news.page("NOT n.is_sponsored AND n.published_at > now() - make_interval(hours => :h)",
				Map.of("h", recentHours), null, limit);
	}

	/**
	 * Traduz um caminho na raiz (/{editoria}, /{editoria}/{sub}, /{editoria}/{slug},
	 * /{editoria}/{sub}/{slug}) — mesma regra do resolveSectionPath do frontend. Endereço
	 * antigo registrado em path_redirects vira redirecionamento (BE-020), inclusive o que fica
	 * abaixo dele.
	 */
	public Resolved resolve(List<String> segments) {
		if (segments.isEmpty() || segments.size() > 3) {
			throw new NotFoundException("Endereço não encontrado.");
		}
		String path = "/" + String.join("/", segments);
		Optional<String> redirect = news.redirectFor(path);
		if (redirect.isPresent()) {
			return new ResolvedRedirect("redirect", redirect.get());
		}
		try {
			return resolveCurrent(segments);
		}
		catch (NotFoundException notFound) {
			// Editoria que mudou de endereço: o que ficava abaixo do antigo também redireciona
			// (/esportes/materia → /esporte/materia). Só consulta quando o endereço atual não existe.
			for (int size = segments.size() - 1; size >= 1; size--) {
				String prefix = "/" + String.join("/", segments.subList(0, size));
				Optional<String> moved = news.redirectFor(prefix);
				if (moved.isPresent()) {
					return new ResolvedRedirect("redirect", moved.get() + path.substring(prefix.length()));
				}
			}
			throw notFound;
		}
	}

	private Resolved resolveCurrent(List<String> segments) {
		List<Category> categories = taxonomy.categories();
		Category root = categories.stream()
			.filter(c -> c.slug().equals(segments.get(0)) && c.parent() == null)
			.findFirst()
			.orElseThrow(() -> new NotFoundException("Endereço não encontrado."));
		if (segments.size() == 1) {
			return new ResolvedCategory("category", root);
		}
		Optional<Category> sub = categories.stream()
			.filter(c -> c.slug().equals(segments.get(1)) && c.parent() != null
					&& c.parent().slug().equals(root.slug()))
			.findFirst();
		if (segments.size() == 2 && sub.isPresent()) {
			return new ResolvedCategory("category", sub.get());
		}
		String newsSlug = segments.size() == 2 ? segments.get(1) : sub.isPresent() ? segments.get(2) : null;
		if (newsSlug == null) {
			throw new NotFoundException("Endereço não encontrado.");
		}
		News found = bySlug(newsSlug);
		return new ResolvedNews("news", found, pathOf(found.category(), found.slug()));
	}

	public static String pathOf(Category category, String newsSlug) {
		return category.parent() == null ? "/" + category.slug() + "/" + newsSlug
				: "/" + category.parent().slug() + "/" + category.slug() + "/" + newsSlug;
	}

	// ---------------------------------------------------------------- internos

	private Page<NewsSummary> page(String where, Map<String, ?> params, String cursor, int limit) {
		Cursor.Keyset after = cursor == null ? null : Cursor.parseKeyset(cursor);
		// Busca um a mais para saber se existe próxima página.
		List<NewsSummary> rows = news.page(where, params, after, limit + 1);
		boolean hasMore = rows.size() > limit;
		List<NewsSummary> items = hasMore ? rows.subList(0, limit) : rows;
		String next = hasMore ? Cursor.keyset(items.getLast().publishedAt(), items.getLast().id()) : null;
		return new Page<>(items, next, news.count(where, params));
	}

	private News full(Detail d) {
		UUID id = d.summary().id();
		var ids = List.of(id);
		// Relacionadas: mesma editoria primeiro; completa com as mais recentes.
		List<NewsSummary> related = new ArrayList<>(news.list("n.category_id = :cat AND n.id <> :id",
				"n.published_at DESC", Map.of("cat", d.categoryId(), "id", id), RELATED_LIMIT, null));
		if (related.size() < RELATED_LIMIT) {
			List<UUID> skip = new ArrayList<>(related.stream().map(NewsSummary::id).toList());
			skip.add(id);
			related.addAll(news.list("n.id NOT IN (:skip)", "n.published_at DESC", Map.of("skip", skip),
					RELATED_LIMIT - related.size(), null));
		}
		return News.of(d.summary(), news.authorsOf(ids).getOrDefault(id, List.of()),
				news.tagsOf(ids).getOrDefault(id, List.of()), d.body(), d.video(), d.sponsor(),
				d.readingTimeMinutes(), d.origin(), d.seo(), related);
	}

}
