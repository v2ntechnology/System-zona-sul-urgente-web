// Gera a carga de exemplo do backend (db/seed/R__seed_local.sql) a partir dos mocks do
// frontend, para a API local mostrar o mesmo conteúdo. Uso: npm run seed:export
import { writeFileSync } from "node:fs";
import { newsMock, MOCK_NOW, viewsBySlug, featuredRank } from "@/mocks/news";
import { categories, neighborhoods, authors, tags, city, zones } from "@/mocks/taxonomy";
import { teamMock } from "@/mocks/admin";

const q = (v: unknown) =>
  v === undefined || v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const b = (v: boolean | undefined) => (v ? "true" : "false");
const ago = (iso: string) => {
  const h = (MOCK_NOW.getTime() - Date.parse(iso)) / 3_600_000;
  return `now() - interval '${Math.round(h * 60)} minutes'`;
};
const out: string[] = [];
const L = (s: string) => out.push(s);

L(`-- Dados de exemplo para desenvolvimento local (perfil "local"). GERADO a partir dos mocks do`);
L(`-- frontend (src/mocks): mesmos IDs, slugs e textos que o site mostra sem a API.`);
L(`-- Repeatable: o Flyway roda de novo quando o arquivo muda; tudo é idempotente.`);
L(`-- NUNCA entra em produção (a pasta db/seed só é lida no perfil local).`);
L(``);
L(
  `INSERT INTO cities (id, slug, name, state) VALUES (${q(city.id)}, ${q(city.slug)}, ${q(city.name)}, ${q(city.state)}) ON CONFLICT DO NOTHING;`,
);
for (const z of zones)
  L(
    `INSERT INTO zones (id, city_id, slug, name) VALUES (${q(z.id)}, ${q(city.id)}, ${q(z.slug)}, ${q(z.name)}) ON CONFLICT DO NOTHING;`,
  );
for (const n of neighborhoods)
  L(
    `INSERT INTO neighborhoods (id, zone_id, slug, name) VALUES (${q(n.id)}, ${q(n.zone.id)}, ${q(n.slug)}, ${q(n.name)}) ON CONFLICT DO NOTHING;`,
  );
L(``);
for (const a of authors)
  L(
    `INSERT INTO authors (id, slug, name, role, bio, instagram, active) VALUES (${q(a.id)}, ${q(a.slug)}, ${q(a.name)}, ${q(a.role)}, ${q(a.bio)}, ${q(a.instagram)}, ${b(a.active !== false)}) ON CONFLICT DO NOTHING;`,
  );
L(``);
const authorId = (slug: string) => authors.find((a) => a.slug === slug)!.id;
// Mães antes das filhas (FK e regra de um nível).
for (const c of [...categories.filter((c) => !c.parent), ...categories.filter((c) => c.parent)]) {
  L(
    `INSERT INTO categories (id, slug, name, description, parent_id, color, in_bar, sort_order, active, whatsapp_url, columnist_id) VALUES (${q(c.id)}, ${q(c.slug)}, ${q(c.name)}, ${q(c.description)}, ${q(c.parent?.id)}, ${q(c.color)}, ${b(c.inBar)}, ${c.order ?? 0}, ${b(c.active !== false)}, ${q(c.whatsappUrl)}, ${q(c.columnist ? authorId(c.columnist.authorSlug) : undefined)}) ON CONFLICT DO NOTHING;`,
  );
}
L(``);
for (const t of tags)
  L(
    `INSERT INTO tags (id, slug, name) VALUES (${q(t.id)}, ${q(t.slug)}, ${q(t.name)}) ON CONFLICT DO NOTHING;`,
  );
L(``);
const strip = (h: string) => h.replace(/<[^>]+>/g, "");
for (const n of newsMock) {
  if (n.image)
    L(
      `INSERT INTO media_assets (id, url, width, height, alt, caption, credit) VALUES (${q(n.image.id)}, ${q(n.image.url)}, ${n.image.width}, ${n.image.height}, ${q(n.image.alt)}, ${q(n.image.caption)}, ${q(n.image.credit)}) ON CONFLICT DO NOTHING;`,
    );
  const bodyText = n.body
    .map((x) =>
      x.type === "paragraph"
        ? strip(x.html)
        : "text" in x
          ? x.text
          : x.type === "list"
            ? x.items.join(" ")
            : "",
    )
    .join("\n");
  L(
    `INSERT INTO news (id, slug, title, subtitle, summary, body, body_text, category_id, city_id, neighborhood_id, image_id, video, status, origin, is_urgent, is_sponsored, sponsor_name, sponsor_url, seo_title, seo_description, reading_time_minutes, featured_rank, published_at, updated_at) VALUES (${q(n.id)}, ${q(n.slug)}, ${q(n.title)}, ${q(n.subtitle)}, ${q(n.summary)}, ${q(JSON.stringify(n.body))}::jsonb, ${q(bodyText)}, ${q(n.category.id)}, ${q(n.location?.city.id)}, ${q(n.location?.neighborhood?.id)}, ${q(n.image?.id)}, ${n.video ? `${q(JSON.stringify(n.video))}::jsonb` : "NULL"}, 'PUBLISHED', ${q(n.origin)}, ${b(n.isUrgent)}, ${b(n.isSponsored)}, ${q(n.sponsor?.name)}, ${q(n.sponsor?.url)}, ${q(n.seo?.title)}, ${q(n.seo?.description)}, ${n.readingTimeMinutes}, ${featuredRank.get(n.slug) ?? "NULL"}, ${ago(n.publishedAt)}, ${ago(n.updatedAt ?? n.publishedAt)}) ON CONFLICT DO NOTHING;`,
  );
  n.authors.forEach((a, i) =>
    L(
      `INSERT INTO news_authors (news_id, author_id, position) VALUES (${q(n.id)}, ${q(a.id)}, ${i}) ON CONFLICT DO NOTHING;`,
    ),
  );
  for (const t of n.tags)
    L(
      `INSERT INTO news_tags (news_id, tag_id) VALUES (${q(n.id)}, ${q(t.id)}) ON CONFLICT DO NOTHING;`,
    );
  const v = viewsBySlug.get(n.slug);
  if (v)
    L(
      `INSERT INTO news_stats (news_id, views_day, views_week, views_total) VALUES (${q(n.id)}, ${v.day}, ${v.week}, ${v.total}) ON CONFLICT DO NOTHING;`,
    );
}
L(``);
L(`-- Equipe (FE-159). Sem senha aqui: no perfil local, a API define a senha de desenvolvimento`);
L(
  `-- das contas ativas ao subir (LocalDevUsers). Convidados ficam sem senha; desativados não entram.`,
);
for (const m of teamMock) {
  const author = m.authorSlug ? authors.find((a) => a.slug === m.authorSlug)?.id : undefined;
  L(
    `INSERT INTO users (id, name, email, role_code, status, author_id) VALUES (${q(m.id)}, ${q(m.name)}, ${q(m.email)}, ${q(m.role)}, ${q(m.status)}, ${q(author)}) ON CONFLICT DO NOTHING;`,
  );
}
writeFileSync(process.argv[2], out.join("\n") + "\n");
console.log(
  `${newsMock.length} notícias, ${categories.length} editorias, ${authors.length} autores`,
);
