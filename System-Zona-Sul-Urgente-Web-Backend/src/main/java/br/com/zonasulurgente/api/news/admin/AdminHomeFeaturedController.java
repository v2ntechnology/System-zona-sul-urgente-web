package br.com.zonasulurgente.api.news.admin;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.shared.web.RequestIdFilter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Destaques da home no painel (spec 003): só quem publica (Editor e Administrador). */
@RestController
@RequestMapping("/api/v1/admin/home/featured")
@Tag(name = "Destaques da home (admin)")
public class AdminHomeFeaturedController {

	/** Ordem inteira: {@code ids[0]} = manchete (nulo = automática); {@code signature} = a do GET que a tela carregou. */
	public record SaveRequest(List<UUID> ids, String signature) {
	}

	private final HomeFeaturedService service;

	public AdminHomeFeaturedController(HomeFeaturedService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('news.publish')")
	@Operation(summary = "Ordem atual do topo da home (10 posições)")
	public HomeFeaturedService.View view() {
		return service.view();
	}

	@PutMapping
	@PreAuthorize("hasAuthority('news.publish')")
	@Operation(summary = "Grava a ordem inteira do topo da home (409 se outra pessoa mudou antes)")
	public HomeFeaturedService.View save(@RequestBody SaveRequest body, @AuthenticationPrincipal AuthenticatedUser user) {
		return service.save(body.ids(), body.signature(), user);
	}

	/** 409 com a ordem atual, para a tela mostrar o que mudou (FR-006). */
	@ExceptionHandler(HomeFeaturedService.ConflictException.class)
	ProblemDetail conflict(HomeFeaturedService.ConflictException ex) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setType(URI.create("about:blank"));
		problem.setTitle(ex.title());
		problem.setDetail(ex.getMessage());
		problem.setProperty("current", ex.current());
		String requestId = MDC.get(RequestIdFilter.MDC_KEY);
		if (requestId != null) {
			problem.setProperty("requestId", requestId);
		}
		return problem;
	}

}
