package br.com.zonasulurgente.api.audit;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.shared.contract.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Auditoria (BE-008): só leitura, para quem tem audit.view (Administrador). */
@RestController
@RequestMapping("/api/v1/admin/audit")
@Tag(name = "Auditoria (admin)")
public class AdminAuditController {

	private final AuditQueryService service;

	public AdminAuditController(AuditQueryService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('audit.view')")
	@Operation(summary = "Registros de auditoria (mais recentes primeiro), com filtros e cursor")
	public Page<AuditEntry> list(
			@RequestParam(required = false) @Pattern(regexp = "[a-z_]{2,30}", message = "Entidade inválida.") String entity,
			@RequestParam(required = false) @Size(max = 64) String entityId,
			@RequestParam(required = false) UUID user,
			@RequestParam(required = false) @Pattern(regexp = "[A-Z_]{2,30}", message = "Ação inválida.") String action,
			@RequestParam(required = false) @Size(max = 200) String cursor,
			@RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit) {
		return service.list(new AuditQueryService.Filter(entity, entityId, user, action, cursor, limit));
	}

}
