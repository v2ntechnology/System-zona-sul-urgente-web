import { describe, expect, it } from "vitest";

import { atLeastOne, PLACEHOLDER_SLUG } from "./static-params";

describe("atLeastOne", () => {
  it("mantém a lista quando há itens", () => {
    expect(atLeastOne([{ slug: "copacabana" }], { slug: PLACEHOLDER_SLUG })).toEqual([
      { slug: "copacabana" },
    ]);
  });

  it("devolve o endereço reservado quando a lista está vazia (banco de produção novo)", () => {
    expect(atLeastOne([], { slug: PLACEHOLDER_SLUG })).toEqual([{ slug: PLACEHOLDER_SLUG }]);
  });
});
