import { describe, expect, it } from "vitest";

import { accessChangeBlock, authorSlugFor, inviteErrors } from "@/lib/team/validate";
import type { TeamMember } from "@/types/admin";

const member = (id: string, role: TeamMember["role"], status: TeamMember["status"] = "ACTIVE") =>
  ({ id, name: id, email: `${id}@x.com`, role, status, twoFactor: true }) as TeamMember;

describe("equipe", () => {
  const team = [
    member("eu", "ADMIN"),
    member("ana", "REPORTER"),
    member("bia", "ADMIN", "DISABLED"),
  ];

  it("ninguém altera o próprio acesso", () => {
    expect(accessChangeBlock("eu", team[0], { role: "EDITOR" }, team)).toMatch(/próprio/);
  });

  it("sempre resta um ADMIN ativo", () => {
    const outro = member("outro", "ADMIN");
    expect(accessChangeBlock("ana", outro, { disable: true }, [outro, team[1]])).toMatch(
      /pelo menos um Administrador/,
    );
    expect(accessChangeBlock("eu", outro, { role: "EDITOR" }, [...team, outro])).toBeNull();
    expect(accessChangeBlock("eu", team[1], { role: "EDITOR" }, team)).toBeNull();
  });

  it("convite valida nome, e-mail repetido e perfil", () => {
    expect(inviteErrors({ name: "Ana", email: "ana@x.com", role: "" }, team)).toEqual({
      name: expect.any(String),
      email: expect.stringMatching(/já está/),
      role: expect.any(String),
    });
    expect(inviteErrors({ name: "Lia Souza", email: "lia@x.com", role: "REPORTER" }, team)).toEqual(
      {},
    );
  });

  it("endereço do autor não repete", () => {
    expect(authorSlugFor("Ana Ribeiro", ["ana-ribeiro"])).toBe("ana-ribeiro-2");
    expect(authorSlugFor("João Ávila", [])).toBe("joao-avila");
  });
});
