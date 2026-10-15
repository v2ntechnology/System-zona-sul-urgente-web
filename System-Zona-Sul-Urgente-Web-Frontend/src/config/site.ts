// Configuração central do site. Valores de ambiente vêm de NEXT_PUBLIC_*;
// nada de URL, nome ou link social deve ser hardcoded em componentes.

export const siteConfig = {
  name: "Zona Sul Urgente",
  description: "Notícias da Zona Sul do Rio de Janeiro, com rapidez e responsabilidade.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "pt_BR",
  social: {
    instagram: "https://www.instagram.com/zonasulurgente/",
  },
  // Canal/grupo de WhatsApp (FE-111). Vazio = CTA some sem quebrar o layout.
  whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL || null,
} as const;
