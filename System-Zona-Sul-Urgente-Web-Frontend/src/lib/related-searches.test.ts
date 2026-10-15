import { describe, expect, it } from "vitest";

import { relatedSearches } from "@/lib/related-searches";

const base = {
  category: { id: "1", slug: "cidade", name: "Cidade" },
  tags: [
    { id: "a", slug: "chuva", name: "Chuva" },
    { id: "b", slug: "defesa-civil", name: "Defesa Civil" },
  ],
};

describe("relatedSearches", () => {
  it("combina tópicos com o bairro e não repete termos", () => {
    const terms = relatedSearches({
      ...base,
      location: {
        city: { id: "c", slug: "rio", name: "Rio", state: "RJ" },
        neighborhood: {
          id: "n",
          slug: "copacabana",
          name: "Copacabana",
          citySlug: "rio",
          zone: { id: "z", slug: "zona-sul", name: "Zona Sul" },
        },
      },
    });
    expect(terms).toEqual([
      "Chuva Copacabana",
      "Defesa Civil Copacabana",
      "Cidade Copacabana",
      "Chuva",
      "Defesa Civil",
    ]);
  });

  it("funciona sem bairro e sem tópicos", () => {
    expect(relatedSearches({ ...base, tags: [], location: undefined })).toEqual(["Cidade"]);
  });
});
