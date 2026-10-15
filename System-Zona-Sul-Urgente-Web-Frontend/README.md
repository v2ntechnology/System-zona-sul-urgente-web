# System-Zona-Sul-Urgente-Web-Frontend

Portal público e painel administrativo do Zona Sul Urgente.

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui.

## Scripts

| Comando                | O que faz                                    |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento (porta 3000)     |
| `npm run build`        | Build de produção (`output: "standalone"`)   |
| `npm run lint`         | ESLint                                       |
| `npm run typecheck`    | `next typegen` + `tsc --noEmit`              |
| `npm run format`       | Prettier (com ordenação de classes Tailwind) |
| `npm run format:check` | Verifica formatação (usado no CI)            |

Copie `.env.example` para `.env.local` antes de rodar.

## Organização

```
src/
├── app/
│   ├── (public)/        # portal: layout com header/footer
│   ├── admin/           # painel: layout próprio, sempre noindex
│   └── api/health/      # liveness para Docker/Uptime Kuma
├── components/
│   ├── ui/              # componentes shadcn (não editar à mão sem necessidade)
│   └── layout/          # header, footer, sidebar
├── config/site.ts       # nome, URL e dados do site num lugar só
└── lib/
```

Previstos pelo backlog: `types/` (contrato do domínio, FE-008), `mocks/` (FE-009) e
`services/` (FE-010, os componentes nunca leem mocks direto).

> O Next.js 16 difere do que costuma aparecer em tutoriais. Consulte
> `node_modules/next/dist/docs/` antes de usar uma API nova.
