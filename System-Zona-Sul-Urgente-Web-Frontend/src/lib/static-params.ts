/**
 * Com Cache Components, todo `generateStaticParams` precisa devolver ao menos um item, senão o `next build`
 * falha. Num banco de produção ainda vazio (sem notícias, stories ou editorias) a lista vem vazia: devolvemos
 * um endereço reservado que nunca existe e responde 404, e as páginas reais continuam sendo geradas na hora
 * do primeiro acesso.
 */
export const PLACEHOLDER_SLUG = "_vazio";

export function atLeastOne<T>(params: T[], placeholder: T): T[] {
  return params.length > 0 ? params : [placeholder];
}
