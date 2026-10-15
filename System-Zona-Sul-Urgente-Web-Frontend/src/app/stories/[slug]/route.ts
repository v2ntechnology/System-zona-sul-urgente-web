import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { escapeHtml as esc } from "@/lib/html";
import { absoluteUrl } from "@/lib/structured-data";
import { getLatestStories, getStoryBySlug } from "@/services/story-service";
import type { WebStory } from "@/types/news";

// Web Story em AMP (FE-119), o formato que o Google Discover exibe — a CNN Brasil faz igual,
// em stories.cnnbrasil.com.br. Fica fora do layout do site porque AMP exige HTML próprio.
// O CSS "amp-boilerplate" é obrigatório e deve ser idêntico ao da especificação.

export async function generateStaticParams() {
  return (await getLatestStories(100)).map((story) => ({ slug: story.slug }));
}

export async function GET(_request: Request, { params }: RouteContext<"/stories/[slug]">) {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) return new Response("Story não encontrada", { status: 404 });
  return new Response(renderStory(story), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const BOILERPLATE =
  "<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>";

const CUSTOM_CSS = `
amp-story{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff}
.shade{background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.35) 45%,rgba(0,0,0,0) 70%)}
.text{align-content:end;padding:32px 24px 72px}
.text p{margin:0;font-size:24px;line-height:1.3;font-weight:700}
.kicker{display:inline-block;margin-bottom:12px;padding:4px 10px;background:#d91f26;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.brand{align-content:start;padding:56px 24px 20px}
.brand span{display:inline-block;padding:4px 8px;font-weight:800;font-size:14px}
.b1{background:#024baa}.b2{background:#fd3132;font-size:17px}
.title{font-size:30px;line-height:1.15;font-weight:800;margin:0}
`;

function renderStory(story: WebStory): string {
  const canonical = absoluteUrl(routes.story(story.slug));
  const logo = absoluteUrl("/brand/logo-512.png");
  const kicker = esc(story.category.name);

  const page = (id: string, image: { url: string; alt: string }, body: string) => `
  <amp-story-page id="${id}">
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(image.url)}" width="720" height="1280" layout="responsive" alt="${esc(image.alt)}"></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="fill" class="shade"></amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" class="brand"><div><span class="b1">ZONA SUL</span><br><span class="b2">URGENTE</span></div></amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" class="text">${body}</amp-story-grid-layer>${id === "fim" && story.news ? outlink(story) : ""}
  </amp-story-page>`;

  const pages = [
    page(
      "capa",
      story.cover,
      `<div><span class="kicker">${kicker}</span><h1 class="title">${esc(story.title)}</h1></div>`,
    ),
    ...story.pages.map((p, i) =>
      page(i === story.pages.length - 1 ? "fim" : `p${i + 1}`, p.image, `<p>${esc(p.text)}</p>`),
    ),
  ].join("");

  return `<!doctype html>
<html ⚡ lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(story.title)} | ${esc(siteConfig.name)}</title>
<link rel="canonical" href="${esc(canonical)}">
<meta name="viewport" content="width=device-width">
<script async src="https://cdn.ampproject.org/v0.js"></script>
<script async custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script>
${BOILERPLATE}
<style amp-custom>${CUSTOM_CSS}</style>
</head>
<body>
<amp-story standalone title="${esc(story.title)}" publisher="${esc(siteConfig.name)}" publisher-logo-src="${esc(logo)}" poster-portrait-src="${esc(story.cover.url)}">${pages}
</amp-story>
</body>
</html>`;
}

function outlink(story: WebStory): string {
  if (!story.news) return "";
  const href = absoluteUrl(routes.news(story.news));
  return `
    <amp-story-page-outlink layout="nodisplay"><a href="${esc(href)}">Leia a matéria completa</a></amp-story-page-outlink>`;
}
