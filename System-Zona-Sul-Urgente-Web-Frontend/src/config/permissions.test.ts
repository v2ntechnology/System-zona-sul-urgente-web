import { describe, expect, it } from "vitest";

import { can } from "@/config/permissions";

// Células críticas da matriz da ARCHITECTURE §8.
describe("matriz de permissões", () => {
  it("só ADMIN e EDITOR publicam", () => {
    expect(can("ADMIN", "news.publish")).toBe(true);
    expect(can("EDITOR", "news.publish")).toBe(true);
    expect(can("REPORTER", "news.publish")).toBe(false);
    expect(can("COMERCIAL", "news.publish")).toBe(false);
    expect(can("AUTOR", "news.publish")).toBe(false);
  });

  it("publicidade é só de ADMIN e COMERCIAL", () => {
    expect(can("COMERCIAL", "ads.manage")).toBe(true);
    expect(can("EDITOR", "ads.manage")).toBe(false);
  });

  it("gestão de usuários e configurações do Instagram é só do ADMIN", () => {
    for (const role of ["EDITOR", "REPORTER", "COMERCIAL", "AUTOR"] as const) {
      expect(can(role, "users.manage")).toBe(false);
      expect(can(role, "instagram.settings")).toBe(false);
    }
  });

  it("criar tópicos: ADMIN, EDITOR e REPÓRTER", () => {
    expect(can("REPORTER", "tags.manage")).toBe(true);
    expect(can("EDITOR", "tags.manage")).toBe(true);
    expect(can("AUTOR", "tags.manage")).toBe(false);
    expect(can("COMERCIAL", "tags.manage")).toBe(false);
  });

  it("autores: ADMIN e EDITOR; equipe: só ADMIN", () => {
    expect(can("EDITOR", "authors.manage")).toBe(true);
    expect(can("REPORTER", "authors.manage")).toBe(false);
    expect(can("EDITOR", "users.manage")).toBe(false);
  });
});

describe("matriz igual à do backend", () => {
  it("cada perfil tem as mesmas permissões que a migration V3 da API", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const path =
      "../System-Zona-Sul-Urgente-Web-Backend/src/main/resources/db/migration/V3__auth_rbac.sql";
    if (!existsSync(path)) return; // checkout só do frontend
    const sql = readFileSync(path, "utf8");
    const { rolePermissions } = await import("@/config/permissions");
    const known = new Set(Object.values(rolePermissions).flat());
    const fromSql: Record<string, Set<string>> = {};
    for (const [, role, permission] of sql.matchAll(/\('([A-Z]+)', '([a-z._]+)'\)/g)) {
      (fromSql[role] ??= new Set()).add(permission);
    }
    fromSql.ADMIN = new Set(known); // ADMIN recebe todas (SELECT 'ADMIN', code FROM permissions)
    for (const [role, permissions] of Object.entries(rolePermissions)) {
      const backend = [...(fromSql[role] ?? [])].filter((p) => known.has(p as never)).sort();
      expect([...permissions].sort(), role).toEqual(backend);
    }
  });
});
