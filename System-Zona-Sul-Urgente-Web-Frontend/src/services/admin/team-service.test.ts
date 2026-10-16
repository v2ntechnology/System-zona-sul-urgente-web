import { describe, expect, it } from "vitest";

import { listAuthorProfiles, listTeam } from "@/services/admin/team-service";

describe("team-service", () => {
  it("equipe: ativos primeiro, desativados por último", async () => {
    const team = await listTeam();
    expect(team[0].status).toBe("ACTIVE");
    expect(team.at(-1)?.status).toBe("DISABLED");
  });

  it("autores ligados à equipe e sem login; desativado vai para o fim", async () => {
    const authors = await listAuthorProfiles();
    expect(authors.find((a) => a.slug === "juliana-prado")?.member).toBeDefined();
    expect(authors.find((a) => a.slug === "redacao")?.member).toBeUndefined();
    expect(authors.at(-1)?.active).toBe(false);
  });
});
