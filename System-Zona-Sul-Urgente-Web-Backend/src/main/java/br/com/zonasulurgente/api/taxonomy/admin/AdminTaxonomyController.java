package br.com.zonasulurgente.api.taxonomy.admin;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Editorias (taxonomy.manage) e tópicos (tags.manage) no painel (FE-158). Cada escrita
 * devolve a lista inteira atualizada.
 */
@RestController
@RequestMapping("/api/v1/admin")
class AdminTaxonomyController {

	record Move(int direction) {
	}

	record Active(boolean active) {
	}

	record Rename(String name) {
	}

	record Merge(UUID keepId, List<UUID> mergeIds) {
	}

	private final CategoryAdminService categories;
	private final TagAdminService tags;

	AdminTaxonomyController(CategoryAdminService categories, TagAdminService tags) {
		this.categories = categories;
		this.tags = tags;
	}

	@GetMapping("/categories")
	@PreAuthorize("hasAuthority('taxonomy.manage')")
	List<AdminCategory> categories() {
		return categories.list();
	}

	@PostMapping("/categories")
	@PreAuthorize("hasAuthority('taxonomy.manage')")
	List<AdminCategory> createCategory(@RequestBody AdminCategory.Input body) {
		return categories.create(body);
	}

	@PutMapping("/categories/{id}")
	@PreAuthorize("hasAuthority('taxonomy.manage')")
	List<AdminCategory> updateCategory(@PathVariable UUID id, @RequestBody AdminCategory.Input body) {
		return categories.update(id, body);
	}

	@PostMapping("/categories/{id}/move")
	@PreAuthorize("hasAuthority('taxonomy.manage')")
	List<AdminCategory> moveCategory(@PathVariable UUID id, @RequestBody Move body) {
		return categories.move(id, body.direction());
	}

	@PostMapping("/categories/{id}/active")
	@PreAuthorize("hasAuthority('taxonomy.manage')")
	List<AdminCategory> categoryActive(@PathVariable UUID id, @RequestBody Active body) {
		return categories.setActive(id, body.active());
	}

	@DeleteMapping("/categories/{id}")
	@PreAuthorize("hasAuthority('taxonomy.manage')")
	List<AdminCategory> deleteCategory(@PathVariable UUID id) {
		return categories.delete(id);
	}

	@GetMapping("/tags")
	@PreAuthorize("hasAuthority('tags.manage')")
	List<AdminTag> tags() {
		return tags.list();
	}

	@PutMapping("/tags/{id}")
	@PreAuthorize("hasAuthority('tags.manage')")
	List<AdminTag> renameTag(@PathVariable UUID id, @RequestBody Rename body) {
		return tags.rename(id, body.name());
	}

	@PostMapping("/tags/{id}/active")
	@PreAuthorize("hasAuthority('tags.manage')")
	List<AdminTag> tagActive(@PathVariable UUID id, @RequestBody Active body) {
		return tags.setActive(id, body.active());
	}

	@PostMapping("/tags/merge")
	@PreAuthorize("hasAuthority('tags.manage')")
	List<AdminTag> mergeTags(@RequestBody Merge body) {
		return tags.merge(body.keepId(), body.mergeIds());
	}

}
