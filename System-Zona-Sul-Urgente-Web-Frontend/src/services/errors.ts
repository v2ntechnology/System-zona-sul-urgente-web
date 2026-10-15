// Erros da camada de dados. "Não encontrado" NÃO é erro: os services devolvem null
// e a página chama notFound(). ServiceError cobre falhas reais (API fora, resposta inválida)
// e é tratado pelos error.tsx das rotas.
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code: "UNAVAILABLE" | "BAD_REQUEST" | "UNEXPECTED",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
