package br.com.zonasulurgente.api.news.api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.news.application.NewsReadService;
import br.com.zonasulurgente.api.news.application.NewsReadService.ColumnLatest;
import br.com.zonasulurgente.api.news.application.NewsReadService.Featured;
import br.com.zonasulurgente.api.news.application.NewsReadService.MostReadPeriod;
import br.com.zonasulurgente.api.news.application.NewsReadService.Resolved;
import br.com.zonasulurgente.api.shared.contract.BreakingNews;
import br.com.zonasulurgente.api.shared.contract.News;
import br.com.zonasulurgente.api.shared.contract.NewsSummary;
import br.com.zonasulurgente.api.shared.contract.Page;
import br.com.zonasulurgente.api.shared.web.PublicCache;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** API pública de leitura de notícias (BE-004/BE-005). Só GET; respostas cacheáveis. */
@RestController
@RequestMapping("/api/v1/public")
@Tag(name = "Notícias (público)")
public class PublicNewsController {

	private static final String LIMIT_MSG = "Use um limite entre 1 e 50.";

	private final NewsReadService service;

	public PublicNewsController(NewsReadService service) {
		this.service = service;
	}

	@GetMapping("/news")
	@Operation(summary = "Últimas notícias (paginação por cursor)")
	public ResponseEntity<Page<NewsSummary>> latest(@RequestParam(required = false) String cursor,
			@RequestParam(defaultValue = "12") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(service.latest(cursor, limit));
	}

	@GetMapping("/news/breaking")
	@Operation(summary = "Urgentes das últimas 6 horas (faixa do topo)")
	public ResponseEntity<List<BreakingNews>> breaking() {
		return PublicCache.ok(service.breaking());
	}

	@GetMapping("/news/featured")
	@Operation(summary = "Destaque editorial da home (204 quando não há)")
	public ResponseEntity<Featured> featured() {
		return service.featured().map(PublicCache::ok).orElseGet(() -> ResponseEntity.noContent().build());
	}

	@GetMapping("/news/videos")
	@Operation(summary = "Notícias com vídeo, das mais recentes")
	public ResponseEntity<List<NewsSummary>> videos(
			@RequestParam(defaultValue = "4") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(service.videos(limit));
	}

	@GetMapping("/news/most-read")
	@Operation(summary = "Mais lidas (24h, 7d ou all), sem patrocinadas")
	public ResponseEntity<List<NewsSummary>> mostRead(
			@RequestParam(defaultValue = "24h") @Pattern(regexp = "24h|7d|all", message = "Use 24h, 7d ou all.") String period,
			@RequestParam(defaultValue = "5") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(service.mostRead(MostReadPeriod.parse(period), limit));
	}

	@GetMapping("/news/feed")
	@Operation(summary = "Matérias completas para RSS (sem patrocinadas)")
	public ResponseEntity<List<News>> feed(@RequestParam(required = false) String category,
			@RequestParam(defaultValue = "30") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(service.feed(category, limit));
	}

	@GetMapping("/news/sitemap")
	@Operation(summary = "Notícias para o sitemap (recentHours=48 para o Google Notícias)")
	public ResponseEntity<List<NewsSummary>> sitemap(
			@RequestParam(required = false) @Min(value = 1, message = "Use de 1 a 72 horas.") @Max(value = 72, message = "Use de 1 a 72 horas.") Integer recentHours,
			@RequestParam(defaultValue = "1000") @Min(1) @Max(5000) int limit) {
		return PublicCache.ok(service.forSitemap(recentHours, limit));
	}

	@GetMapping("/news/{slug}")
	@Operation(summary = "Matéria completa, com autores, tópicos e relacionadas")
	public ResponseEntity<News> bySlug(@PathVariable String slug) {
		return PublicCache.ok(service.bySlug(slug));
	}

	@GetMapping("/columns/latest")
	@Operation(summary = "Blogs e colunas: o post mais recente de cada coluna")
	public ResponseEntity<List<ColumnLatest>> latestColumns(
			@RequestParam(defaultValue = "10") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(service.latestColumns(limit));
	}

	@GetMapping("/search")
	@Operation(summary = "Busca em português (sem acento), com filtros de editoria e bairro")
	public ResponseEntity<Page<NewsSummary>> search(
			@RequestParam @Size(max = 120, message = "Use até 120 caracteres.") String q,
			@RequestParam(required = false) String category,
			@RequestParam(required = false) String neighborhood,
			@RequestParam(required = false) String cursor,
			@RequestParam(defaultValue = "10") @Min(value = 1, message = LIMIT_MSG) @Max(value = 50, message = LIMIT_MSG) int limit) {
		return PublicCache.ok(service.search(q, category, neighborhood, cursor, limit));
	}

	@GetMapping("/resolve")
	@Operation(summary = "Traduz um caminho na raiz em editoria, matéria ou redirecionamento")
	public ResponseEntity<Resolved> resolve(
			@RequestParam @Pattern(regexp = "[a-z0-9-]+(/[a-z0-9-]+){0,2}", message = "Caminho inválido.") String path) {
		return PublicCache.ok(service.resolve(List.of(path.split("/"))));
	}

}
