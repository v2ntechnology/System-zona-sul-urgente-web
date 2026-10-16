package br.com.zonasulurgente.api.news.admin;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** CRUD de notícias do painel (BE-009). Permissões por ação (BE-007). */
@RestController
@RequestMapping("/api/v1/admin/news")
@Tag(name = "Notícias (admin)")
public class AdminNewsController {

	private final AdminNewsService service;

	public AdminNewsController(AdminNewsService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('news.create')")
	@Operation(summary = "Listagem do painel (inclui rascunhos; status=DELETED = lixeira)")
	public AdminPage<AdminNewsRow> list(@RequestParam(required = false) @Size(max = 120) String q,
			@RequestParam(required = false) @Pattern(regexp = "DRAFT|IN_REVIEW|SCHEDULED|PUBLISHED|UNPUBLISHED|ARCHIVED|DELETED") String status,
			@RequestParam(required = false) String category,
			@RequestParam(required = false) @Pattern(regexp = "MANUAL|INSTAGRAM") String origin,
			@RequestParam(defaultValue = "1") @Min(1) int page,
			@RequestParam(defaultValue = "15") @Min(1) @Max(100) int pageSize) {
		return service.list(q, status, category, origin, page, pageSize);
	}

	@GetMapping("/counts")
	@PreAuthorize("hasAuthority('news.create')")
	@Operation(summary = "Quantidade por status (abas da listagem)")
	public Map<String, Long> counts() {
		return service.counts();
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasAuthority('news.create')")
	@Operation(summary = "Notícia no formato do editor (com a versão para o bloqueio otimista)")
	public NewsDraft.Out get(@PathVariable UUID id) {
		return service.draft(id);
	}

	@GetMapping("/{id}/versions")
	@PreAuthorize("hasAuthority('news.versions.view')")
	public List<AdminNewsRepository.VersionRow> versions(@PathVariable UUID id,
			@AuthenticationPrincipal AuthenticatedUser user) {
		return service.versions(id, user);
	}

	@PostMapping
	@PreAuthorize("hasAuthority('news.create')")
	@Operation(summary = "Cria a notícia (intent: draft, review, publish ou schedule)")
	public SaveResult create(@Valid @RequestBody SaveRequest body, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.save(null, body.draft(), body.intent(), user);
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasAnyAuthority('news.edit.own', 'news.edit.any')")
	@Operation(summary = "Salva a edição (409 se outra pessoa salvou antes)")
	public SaveResult update(@PathVariable UUID id, @Valid @RequestBody SaveRequest body,
			@AuthenticationPrincipal AuthenticatedUser user) {
		return service.save(id, body.draft(), body.intent(), user);
	}

	@PostMapping("/{id}/publish")
	@PreAuthorize("hasAuthority('news.publish')")
	public SaveResult publish(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.publish(id, user);
	}

	@PostMapping("/{id}/unpublish")
	@PreAuthorize("hasAuthority('news.publish')")
	public SaveResult unpublish(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.unpublish(id, user);
	}

	@DeleteMapping("/{id}")
	@PreAuthorize("hasAuthority('news.delete')")
	@Operation(summary = "Move para a lixeira (exclusão lógica)")
	public SaveResult delete(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.delete(id, user);
	}

	@PostMapping("/{id}/restore")
	@PreAuthorize("hasAuthority('news.delete')")
	public SaveResult restore(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.restore(id, user);
	}

}
