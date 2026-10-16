package br.com.zonasulurgente.api.team;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;

/**
 * Equipe (users.manage), autores (authors.manage) e aceite do convite (público, pelo token)
 * — FE-159. Cada escrita devolve a lista inteira atualizada.
 */
@RestController
@RequestMapping("/api/v1/admin")
class AdminTeamController {

	record Role(String role) {
	}

	record Active(boolean active) {
	}

	record Token(String token) {
	}

	record Accept(String token, String password) {
	}

	private final TeamService team;
	private final AuthorService authors;
	private final InvitationService invitations;

	AdminTeamController(TeamService team, AuthorService authors, InvitationService invitations) {
		this.team = team;
		this.authors = authors;
		this.invitations = invitations;
	}

	@GetMapping("/users")
	@PreAuthorize("hasAuthority('users.manage')")
	List<TeamMember> team() {
		return team.list();
	}

	@PostMapping("/users/invite")
	@PreAuthorize("hasAuthority('users.manage')")
	TeamService.Invited invite(@RequestBody TeamService.InviteInput body,
			@AuthenticationPrincipal AuthenticatedUser actor) {
		return team.invite(body, actor);
	}

	@PostMapping("/users/{id}/invite")
	@PreAuthorize("hasAuthority('users.manage')")
	TeamService.Invited reinvite(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser actor) {
		return team.reinvite(id, actor);
	}

	@PostMapping("/users/{id}/role")
	@PreAuthorize("hasAuthority('users.manage')")
	List<TeamMember> role(@PathVariable UUID id, @RequestBody Role body,
			@AuthenticationPrincipal AuthenticatedUser actor) {
		return team.changeRole(id, body.role(), actor);
	}

	@PostMapping("/users/{id}/active")
	@PreAuthorize("hasAuthority('users.manage')")
	List<TeamMember> active(@PathVariable UUID id, @RequestBody Active body,
			@AuthenticationPrincipal AuthenticatedUser actor) {
		return team.setActive(id, body.active(), actor);
	}

	@PostMapping("/users/{id}/reset-2fa")
	@PreAuthorize("hasAuthority('users.manage')")
	List<TeamMember> resetTwoFactor(@PathVariable UUID id) {
		return team.resetTwoFactor(id);
	}

	@GetMapping("/authors")
	@PreAuthorize("hasAuthority('authors.manage')")
	List<AuthorProfile> authors() {
		return authors.list();
	}

	@PostMapping("/authors")
	@PreAuthorize("hasAuthority('authors.manage')")
	List<AuthorProfile> createAuthor(@RequestBody AuthorProfile.Input body) {
		return authors.create(body);
	}

	@PutMapping("/authors/{id}")
	@PreAuthorize("hasAuthority('authors.manage')")
	List<AuthorProfile> updateAuthor(@PathVariable UUID id, @RequestBody AuthorProfile.Input body) {
		return authors.update(id, body);
	}

	@PostMapping("/authors/{id}/active")
	@PreAuthorize("hasAuthority('authors.manage')")
	List<AuthorProfile> authorActive(@PathVariable UUID id, @RequestBody Active body) {
		return authors.setActive(id, body.active());
	}

	// Público (sem sessão): o token do convite é a credencial. POST para o token não ir para logs de URL.

	@PostMapping("/auth/invite/check")
	InvitationService.Invitation checkInvite(@RequestBody Token body) {
		return invitations.check(body.token());
	}

	@PostMapping("/auth/invite/accept")
	InvitationService.Invitation acceptInvite(@RequestBody Accept body) {
		return invitations.accept(body.token(), body.password());
	}

}
