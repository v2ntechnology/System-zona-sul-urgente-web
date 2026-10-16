import { describe, expect, it } from "vitest";

import {
  type CategoryDraft,
  duplicateGroups,
  renameTagError,
  validateCategory,
} from "@/lib/taxonomy/validate";

const existing = [
  { id: "1", slug: "seguranca", inBar: true },
  { id: "2", slug: "entretenimento", inBar: true },
  { id: "3", slug: "eventos", parentSlug: "entretenimento" },
];
const draft: CategoryDraft = {
  name: "Meio ambiente",
  slug: "meio-ambiente",
  parentSlug: "",
  color: "economia",
  inBar: false,
  whatsappUrl: "",
  description: "",
};

describe("validação de editoria", () => {
  it("editoria nova válida passa", () => {
    expect(validateCategory(draft, existing)).toEqual({});
  });

  it("recusa endereço reservado, repetido ou mal formado", () => {
    expect(validateCategory({ ...draft, slug: "busca" }, existing).slug).toMatch(/página fixa/);
    expect(validateCategory({ ...draft, slug: "seguranca" }, existing).slug).toMatch(/Já existe/);
    expect(validateCategory({ ...draft, slug: "Meio Ambiente" }, existing).slug).toMatch(
      /minúsculas/,
    );
  });

  it("um nível só: mãe precisa ser principal; quem tem filhas não vira filha", () => {
    expect(validateCategory({ ...draft, parentSlug: "eventos" }, existing).parentSlug).toBeTruthy();
    const editing = { ...draft, id: "2", slug: "entretenimento", parentSlug: "seguranca" };
    expect(validateCategory(editing, existing).parentSlug).toMatch(/subeditorias/);
    expect(validateCategory({ ...draft, parentSlug: "seguranca", color: "" }, existing)).toEqual(
      {},
    );
  });

  it("limite da barra, cor e link do WhatsApp", () => {
    const full = Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, slug: `s${i}`, inBar: true }));
    expect(validateCategory({ ...draft, inBar: true }, full).inBar).toMatch(/até 8/);
    expect(validateCategory({ ...draft, color: "" }, existing).color).toBeTruthy();
    expect(
      validateCategory({ ...draft, whatsappUrl: "https://wa.me/123" }, existing).whatsappUrl,
    ).toBeTruthy();
    expect(
      validateCategory({ ...draft, whatsappUrl: "https://whatsapp.com/channel/0029Va" }, existing),
    ).toEqual({});
  });
});

describe("tópicos", () => {
  const tags = [
    { id: "a", name: "Chuva" },
    { id: "b", name: "Chuvas" },
    { id: "c", name: "Ônibus" },
    { id: "d", name: "onibus" },
    { id: "e", name: "Praia" },
  ];

  it("acha duplicados por nome normalizado", () => {
    expect(duplicateGroups(tags).map((g) => g.map((t) => t.id))).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("renomear não pode colidir com outro tópico", () => {
    expect(renameTagError("Praias", "a", tags)).toMatch(/Já existe “Praia”/);
    expect(renameTagError("Chuva forte", "a", tags)).toBeNull();
    expect(renameTagError("x", "a", tags)).toBeTruthy();
  });
});
