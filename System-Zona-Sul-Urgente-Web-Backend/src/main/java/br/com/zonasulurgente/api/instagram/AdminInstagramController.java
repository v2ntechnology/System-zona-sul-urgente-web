package br.com.zonasulurgente.api.instagram;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.shared.web.ApiException;
import br.com.zonasulurgente.api.shared.web.NotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Pattern;

/** Fila do Instagram no painel (FE-155, BE-013). Quem revisa: instagram.review. */
@RestController
@RequestMapping("/api/v1/admin/instagram")
@Tag(name = "Instagram (admin)")
public class AdminInstagramController {

	/** Post colado no painel (com ou sem conta ligada). */
	public record ImportRequest(String url, String caption, OffsetDateTime postedAt) {
	}

	/** Ligar ou trocar a conta: ID da conta e acesso gerados no painel da Meta (spec 001, FR-019). */
	public record ConnectRequest(String igUserId, String accessToken) {
	}

	private final InstagramQueueService service;
	private final InstagramConnectionService connections;
	private final InstagramSyncService sync;

	public AdminInstagramController(InstagramQueueService service, InstagramConnectionService connections,
			InstagramSyncService sync) {
		this.service = service;
		this.connections = connections;
		this.sync = sync;
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

	/** Situação da conexão com a conta (spec 001). 404 = nenhuma conta ligada ("Não conectada" na tela). */
	@GetMapping("/connection")
	@PreAuthorize("hasAuthority('instagram.review')")
	@Operation(summary = "Situação da conta do Instagram ligada ao painel")
	public InstagramConnectionService.ConnectionView connection() {
		return connections.view().orElseThrow(() -> new NotFoundException("Conta do Instagram ainda não conectada."));
	}

	@PutMapping("/connection")
	@PreAuthorize("hasAuthority('instagram.settings')")
	@Operation(summary = "Liga ou troca a conta (confere na Meta antes de gravar; o acesso nunca volta)")
	public InstagramConnectionService.ConnectionView connect(@RequestBody ConnectRequest body,
			@AuthenticationPrincipal AuthenticatedUser user) {
		InstagramConnectionService.ConnectionView connected = connections.connect(body.igUserId(), body.accessToken(),
				user);
		// Primeira varredura logo após ligar: os posts dos últimos 7 dias entram na fila (FR-006).
		sync.sync();
		return connections.view().orElse(connected);
	}

	@PostMapping("/connection/sync")
	@ResponseStatus(HttpStatus.ACCEPTED)
	@PreAuthorize("hasAuthority('instagram.settings')")
	@Operation(summary = "Sincroniza agora (fora do ciclo de 15 min)")
	public InstagramConnectionService.ConnectionView syncNow() {
		InstagramConnectionService.ConnectionView current = connections.view()
			.filter(c -> "ACTIVE".equals(c.status()))
			.orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Nenhuma conta ativa",
					"Ligue a conta do Instagram antes de sincronizar."));
		sync.sync();
		return connections.view().orElse(current);
	}

	@DeleteMapping("/connection")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@PreAuthorize("hasAuthority('instagram.settings')")
	@Operation(summary = "Desliga a conta (posts e notícias continuam)")
	public void disconnect(@AuthenticationPrincipal AuthenticatedUser user) {
		connections.disconnect(user);
	}

}
