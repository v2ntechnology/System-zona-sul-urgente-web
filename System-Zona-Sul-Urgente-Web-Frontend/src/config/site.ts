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
  // WhatsApp da redação para o leitor enviar notícia/denúncia (número do site atual).
  reportUrl:
    process.env.NEXT_PUBLIC_REPORT_WHATSAPP_URL ||
    `https://wa.me/5521972805020?text=${encodeURIComponent("Olá! Quero enviar uma notícia para o Zona Sul Urgente:")}`,
} as const;
