package br.com.zonasulurgente.api.taxonomy.api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.news.application.NewsReadService;
import br.com.zonasulurgente.api.news.application.NewsReadService.CategoryPage;
import br.com.zonasulurgente.api.shared.contract.Author;
import br.com.zonasulurgente.api.shared.contract.Category;
import br.com.zonasulurgente.api.shared.contract.City;
import br.com.zonasulurgente.api.shared.contract.Neighborhood;
import br.com.zonasulurgente.api.shared.contract.NewsSummary;
import br.com.zonasulurgente.api.shared.contract.Page;
import br.com.zonasulurgente.api.shared.contract.Tag;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import br.com.zonasulurgente.api.shared.web.PublicCache;
import br.com.zonasulurgente.api.taxonomy.infrastructure.TaxonomyReadRepository;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Taxonomia pública: editorias, bairros, cidades, autores e tópicos (BE-004). */
@RestController
@RequestMapping("/api/v1/public")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Taxonomia (público)")
public class PublicTaxonomyController {

	private static final String LIMIT_MSG = "Use um limite entre 1 e 50.";

	private final TaxonomyReadRepository taxonomy;
	private final NewsReadService news;

	public PublicTaxonomyController(TaxonomyReadRepository taxonomy, NewsReadService news) {
		this.taxonomy = taxonomy;
		this.news = news;
	}

	@GetMapping("/categories")
	@Operation(summary = "Todas as editorias (com mãe, cor, ordem, barra e colunista)")
	public ResponseEntity<List<Category>> categories() {
		return PublicCache.ok(taxonomy.categories());
	}

	@GetMapping("/categories/{slug}/news")
	@Operation(summary = "Notícias da editoria (a mãe inclui as subeditorias)")
	public ResponseEntity<CategoryPage> categoryNews(@PathVariable String slug,
			@RequestParam(required = false) String cursor,
			@RequestParam(defaultValue = "12") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(news.byCategory(slug, cursor, limit));
	}

	@GetMapping("/neighborhoods")
	public ResponseEntity<List<Neighborhood>> neighborhoods() {
		return PublicCache.ok(taxonomy.neighborhoods());
	}

	public record NeighborhoodPage(Neighborhood neighborhood, Page<NewsSummary> page) {
	}

	@GetMapping("/neighborhoods/{slug}/news")
	public ResponseEntity<NeighborhoodPage> neighborhoodNews(@PathVariable String slug,
			@RequestParam(required = false) String cursor,
			@RequestParam(defaultValue = "12") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		Neighborhood neighborhood = taxonomy.neighborhood(slug)
			.orElseThrow(() -> new NotFoundException("Bairro não encontrado."));
		return PublicCache.ok(new NeighborhoodPage(neighborhood,
				news.byNeighborhood(neighborhood.id(), cursor, limit)));
	}

	public record CityPage(City city, Page<NewsSummary> page) {
	}

	@GetMapping("/cities/{slug}/news")
	public ResponseEntity<CityPage> cityNews(@PathVariable String slug,
			@RequestParam(required = false) String cursor,
			@RequestParam(defaultValue = "12") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		City city = taxonomy.city(slug).orElseThrow(() -> new NotFoundException("Cidade não encontrada."));
		return PublicCache.ok(new CityPage(city, news.byCity(city.id(), cursor, limit)));
	}

	@GetMapping("/authors")
	public ResponseEntity<List<Author>> authors() {
		return PublicCache.ok(taxonomy.authors());
	}

	@GetMapping("/tags")
	public ResponseEntity<List<Tag>> tags() {
		return PublicCache.ok(taxonomy.tags());
	}

	@GetMapping("/tags/popular")
	@Operation(summary = "Tópicos mais usados nos últimos 7 dias")
	public ResponseEntity<List<Tag>> popularTags(
			@RequestParam(defaultValue = "8") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(taxonomy.popularTags(limit));
	}

}
