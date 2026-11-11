package br.com.zonasulurgente.api.instagram;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Pattern;

/** Fila do Instagram no painel (FE-155, BE-013). Quem revisa: instagram.review. */
@RestController
@RequestMapping("/api/v1/admin/instagram")
@Tag(name = "Instagram (admin)")
public class AdminInstagramController {

	/** Post colado no painel enquanto a conta não está conectada pela API da Meta. */
	public record ImportRequest(String url, String caption, OffsetDateTime postedAt) {
	}

	private final InstagramQueueService service;

	public AdminInstagramController(InstagramQueueService service) {
		this.service = service;
	}

	@GetMapping("/posts")
	@PreAuthorize("hasAuthority('instagram.review')")
	@Operation(summary = "Fila de posts (mais recentes primeiro)")
	public List<InstagramPostView> list(@RequestParam(required = false)
	@Pattern(regexp = "NEW|IMPORTED|CHANGED_AT_SOURCE|ERROR|IGNORED|REMOVED_AT_SOURCE") String status) {
		return service.list(status);
	}

	@GetMapping("/posts/counts")
	@PreAuthorize("hasAuthority('instagram.review')")
	public Map<String, Long> counts() {
		return service.counts();
	}

	@PostMapping("/posts")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasAuthority('instagram.review')")
	@Operation(summary = "Adiciona um post à fila (link + legenda)")
	public InstagramPostView importManual(@RequestBody ImportRequest body, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.importManual(body.url(), body.caption(), body.postedAt(), user);
	}

	@PostMapping("/posts/{id}/generate")
	@PreAuthorize("hasAuthority('instagram.review')")
	@Operation(summary = "Gera o rascunho com a IA (também serve para reprocessar após erro)")
	public InstagramPostView generate(@PathVariable String id, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.generate(id, user);
	}

	@PostMapping("/posts/{id}/ignore")
	@PreAuthorize("hasAuthority('instagram.review')")
	public InstagramPostView ignore(@PathVariable String id, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.ignore(id, user);
	}

	@PostMapping("/posts/{id}/restore")
	@PreAuthorize("hasAuthority('instagram.review')")
	public InstagramPostView restore(@PathVariable String id) {
		return service.restore(id);
	}

	@PostMapping("/posts/{id}/acknowledge")
	@PreAuthorize("hasAuthority('instagram.review')")
	@Operation(summary = "Marca a mudança na origem como vista")
	public InstagramPostView acknowledge(@PathVariable String id) {
		return service.acknowledge(id);
	}

	/** Conexão com a conta pela API da Meta: ainda não existe (BE-013). A tela mostra "não conectado". */
	@GetMapping("/connection")
	@PreAuthorize("hasAuthority('instagram.review')")
	public Map<String, Object> connection() {
		throw new NotFoundException("Conta do Instagram ainda não conectada.");
	}

}
