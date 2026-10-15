// Contrato de notícias (FE-008). Começa só com o necessário para a faixa de urgente;
// cresce com o modelo completo (autores, categoria, cidade, mídia...).

export type BreakingNews = {
  id: string;
  slug: string;
  title: string;
  /** ISO 8601 com fuso. */
  publishedAt: string;
};
