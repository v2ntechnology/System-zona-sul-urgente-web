package br.com.zonasulurgente.api.usage;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.shared.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Uso dos planos gratuitos (spec 004, contracts/admin-usage.md). Só Administrador ({@code settings.manage}). */
@RestController
@RequestMapping("/api/v1/admin/usage")
@Tag(name = "Painel — uso dos planos")
class AdminUsageController {

	private final QuotaService quota;
	private final UsageProperties props;
	private final AtomicReference<Instant> lastManualRefresh = new AtomicReference<>(Instant.EPOCH);

	AdminUsageController(QuotaService quota, UsageProperties props) {
		this.quota = quota;
		this.props = props;
	}

	@GetMapping
	@PreAuthorize("hasAuthority('settings.manage')")
	@Operation(summary = "Uso atual de cada recurso em relação ao limite grátis")
	UsageReport usage() {
		return quota.report();
	}

	@PostMapping("/refresh")
	@PreAuthorize("hasAuthority('settings.manage')")
	@Operation(summary = "Lê a nuvem agora (no máximo 1 vez por minuto)")
	UsageReport refresh() {
		Instant now = Instant.now();
		Instant last = lastManualRefresh.get();
		Duration wait = Duration.between(now, last.plus(props.manualRefreshInterval()));
		if (!wait.isNegative() && !wait.isZero() || !lastManualRefresh.compareAndSet(last, now)) {
			long seconds = Math.max(1, wait.toSeconds());
			throw new TooSoon(seconds);
		}
		quota.refresh();
		return quota.report();
	}

	@GetMapping("/alerts")
	@PreAuthorize("hasAuthority('settings.manage')")
	@Operation(summary = "Recursos em atenção, críticos ou travados (faixa do painel)")
	List<UsageReport.Alert> alerts() {
		return quota.alerts();
	}

	static class TooSoon extends ApiException {

		private final long seconds;

		TooSoon(long seconds) {
			super(HttpStatus.TOO_MANY_REQUESTS, "Aguarde um pouco",
					"Os números acabaram de ser atualizados. Tente de novo em " + seconds + " s.");
			this.seconds = seconds;
		}

		@Override
		public Map<String, Object> properties() {
			return Map.of("retryAfterSeconds", seconds);
		}

	}

}
