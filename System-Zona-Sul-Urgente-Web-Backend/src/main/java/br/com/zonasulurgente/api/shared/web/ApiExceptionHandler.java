package br.com.zonasulurgente.api.shared.web;

import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Erros no formato RFC 9457 ({@code application/problem+json}), em português (BE-002).
 * Nunca expõe stack trace, SQL ou nome de classe: o detalhe técnico vai só para o log,
 * ligado à resposta pelo {@code requestId}.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	public record FieldProblem(String field, String message) {
	}

	@ExceptionHandler(NotFoundException.class)
	ProblemDetail notFound(NotFoundException ex) {
		return problem(HttpStatus.NOT_FOUND, "Não encontrado", ex.getMessage());
	}

	@ExceptionHandler(BadRequestException.class)
	ProblemDetail badRequest(BadRequestException ex) {
		return problem(HttpStatus.BAD_REQUEST, "Requisição inválida", ex.getMessage());
	}

	/** Campos do editor inválidos: mesmo formato dos erros de validação (field + message). */
	@ExceptionHandler(br.com.zonasulurgente.api.news.admin.DraftValidationException.class)
	ProblemDetail draftInvalid(br.com.zonasulurgente.api.news.admin.DraftValidationException ex) {
		ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "Dados inválidos", ex.getMessage());
		body.setProperty("errors", ex.errors().entrySet().stream()
			.map(e -> new FieldProblem(e.getKey(), e.getValue()))
			.toList());
		return body;
	}

	@ExceptionHandler(InvalidFieldsException.class)
	ProblemDetail invalidFields(InvalidFieldsException ex) {
		ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "Dados inválidos", ex.getMessage());
		body.setProperty("errors", ex.errors().entrySet().stream()
			.map(e -> new FieldProblem(e.getKey(), e.getValue()))
			.sorted(Comparator.comparing(FieldProblem::field))
			.toList());
		return body;
	}

	@ExceptionHandler(ApiException.class)
	ProblemDetail api(ApiException ex) {
		return problem(ex.status(), ex.title(), ex.getMessage());
	}

	/** @PreAuthorize negado dentro do MVC: mesmo 403 da política de segurança. */
	@ExceptionHandler(org.springframework.security.authorization.AuthorizationDeniedException.class)
	ProblemDetail denied() {
		return problem(HttpStatus.FORBIDDEN, "Acesso negado", "Seu perfil não tem permissão para esta ação.");
	}

	@ExceptionHandler(Exception.class)
	ProblemDetail unexpected(Exception ex) {
		log.error("Erro inesperado", ex);
		return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno",
				"Algo deu errado do nosso lado. Informe o código da requisição ao suporte.");
	}

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldProblem> errors = ex.getBindingResult().getFieldErrors().stream()
			.sorted(Comparator.comparing(FieldError::getField))
			.map(e -> new FieldProblem(e.getField(), e.getDefaultMessage()))
			.toList();
		ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "Dados inválidos",
				"Revise os campos indicados.");
		body.setProperty("errors", errors);
		return ResponseEntity.badRequest().body(body);
	}

	@Override
	protected ResponseEntity<Object> handleHandlerMethodValidationException(
			HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status,
			WebRequest request) {
		List<FieldProblem> errors = ex.getParameterValidationResults().stream()
			.flatMap(r -> r.getResolvableErrors().stream()
				.map(e -> new FieldProblem(r.getMethodParameter().getParameterName(),
						e.getDefaultMessage())))
			.toList();
		ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "Dados inválidos",
				"Revise os parâmetros indicados.");
		body.setProperty("errors", errors);
		return ResponseEntity.badRequest().body(body);
	}

	/** Foto acima do limite do multipart (spring.servlet.multipart.max-file-size). */
	@Override
	protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
			org.springframework.web.multipart.MaxUploadSizeExceededException ex, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
			.body(problem(HttpStatus.CONTENT_TOO_LARGE, "Foto grande demais", "A foto pode ter no máximo 10 MB."));
	}

	/** Erros do próprio Spring MVC (método não suportado, JSON malformado...) em português. */
	@Override
	protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body,
			HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
		HttpStatus status = HttpStatus.resolve(statusCode.value());
		String title = TITLES.getOrDefault(statusCode.value(),
				status != null ? status.getReasonPhrase() : "Erro");
		ProblemDetail problem = problem(statusCode, title, null);
		return ResponseEntity.status(statusCode).headers(headers).body(problem);
	}

	private static final Map<Integer, String> TITLES = Map.of(
			400, "Requisição inválida",
			404, "Não encontrado",
			405, "Método não permitido",
			406, "Formato não aceito",
			415, "Tipo de conteúdo não suportado");

	static ProblemDetail problem(HttpStatusCode status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatus(status);
		problem.setType(URI.create("about:blank"));
		problem.setTitle(title);
		if (detail != null) {
			problem.setDetail(detail);
		}
		String requestId = MDC.get(RequestIdFilter.MDC_KEY);
		if (requestId != null) {
			problem.setProperty("requestId", requestId);
		}
		return problem;
	}

}
