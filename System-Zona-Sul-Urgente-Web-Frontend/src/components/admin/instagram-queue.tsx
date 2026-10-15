"use client";

import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  BanIcon,
  CheckIcon,
  FileTextIcon,
  GalleryHorizontalIcon,
  GitCompareIcon,
  PlayIcon,
  RotateCwIcon,
  SparklesIcon,
  XIcon,
  Trash2Icon,
} from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  InstagramStatusBadge,
  instagramStatusLabel,
} from "@/components/admin/instagram-status-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { RelativeTime } from "@/components/news/relative-time";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { adminRoutes } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";
import { diffWords } from "@/lib/word-diff";
import type { InstagramImportStatus, InstagramPost } from "@/types/admin";

type Action = "generate" | "ignore" | "reprocess" | "acknowledge" | "restore";

const actionResult: Record<Action, { status: InstagramImportStatus; message: string }> = {
  generate: { status: "IMPORTED", message: "enviado para a IA gerar o rascunho" },
  ignore: { status: "IGNORED", message: "ignorado" },
  reprocess: { status: "NEW", message: "enviado para reprocessar" },
  acknowledge: { status: "IMPORTED", message: "marcado como revisado" },
  restore: { status: "NEW", message: "voltou para a fila" },
};

const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-semibold transition hover:border-brand-blue hover:text-brand-blue";
const primaryButton =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-brand-blue-dark";

// Fila de importação (FE-155). Sem backend, as ações só atualizam a tela (simulação); com a
// API: POST /api/v1/admin/instagram/posts/{id}/{generate|ignore|reprocess|acknowledge}.
export function InstagramQueue({
  posts: initialPosts,
  userName,
  view = "grid",
}: {
  posts: InstagramPost[];
  userName: string;
  /** "grid": grade do perfil (como no Instagram); "list": fila detalhada. */
  view?: "grid" | "list";
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [message, setMessage] = useState("");
  const [comparing, setComparing] = useState<InstagramPost | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = posts.find((p) => p.id === openId) ?? null;

  function apply(post: InstagramPost, action: Action) {
    const result = actionResult[action];
    setPosts((current) =>
      current.map((p) =>
        p.id === post.id
          ? {
              ...p,
              status: result.status,
              error: undefined,
              ignoredReason: action === "ignore" ? `Ignorado por ${userName}.` : undefined,
            }
          : p,
      ),
    );
    setComparing(null);
    setMessage(`Post ${result.message} (simulação — sem backend conectado).`);
  }

  if (posts.length === 0) {
    return (
      <p className="rounded-lg border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
        Nenhum post neste filtro.
      </p>
    );
  }

  return (
    <>
      <p
        aria-live="polite"
        className={
          message ? "rounded-md bg-brand-sky-light px-3 py-2 text-sm text-brand-blue" : "sr-only"
        }
      >
        {message}
      </p>

      {view === "grid" ? (
        <ul className="grid grid-cols-3 gap-1 sm:gap-1.5">
          {posts.map((post) => (
            <li key={post.id}>
              <GridTile post={post} onOpen={() => setOpenId(post.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onAction={apply} onCompare={() => setComparing(post)} />
            </li>
          ))}
        </ul>
      )}

      <Dialog.Root open={opened !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/70 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-2xl transition duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 md:h-[min(85vh,38rem)] md:w-auto md:flex-row">
            {opened && (
              <PostDetail
                post={opened}
                onAction={apply}
                onCompare={() => {
                  setOpenId(null);
                  setComparing(opened);
                }}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Sheet open={comparing !== null} onOpenChange={(open) => !open && setComparing(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
        >
          {comparing && <Comparison post={comparing} onAction={apply} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function PostCard({
  post,
  onAction,
  onCompare,
}: {
  post: InstagramPost;
  onAction: (post: InstagramPost, action: Action) => void;
  onCompare: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = post.caption.length > 160;

  return (
    <article className="flex gap-3 rounded-lg border bg-background p-3 shadow-xs sm:gap-4 sm:p-4">
      <Thumbnail post={post} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <InstagramStatusBadge status={post.status} />
          <span>{mediaLabel(post)}</span>
          <span aria-hidden>·</span>
          <span>
            postado <RelativeTime iso={post.postedAt} />
          </span>
        </div>

        <div>
          <p className={cn("text-sm whitespace-pre-line", !expanded && "line-clamp-3")}>
            {post.caption}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-xs font-semibold text-brand-blue hover:underline"
            >
              {expanded ? "Mostrar menos" : "Ver legenda completa"}
            </button>
          )}
        </div>

        <StatusNote post={post} />

        {post.news && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
            <FileTextIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <Link
              href={adminRoutes.editNews(post.news.id)}
              className="line-clamp-2 min-w-0 flex-1 font-semibold hover:text-brand-blue hover:underline"
            >
              {post.news.title}
            </Link>
            <StatusBadge status={post.news.status} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Actions post={post} onAction={onAction} onCompare={onCompare} />
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(button, "ml-auto")}
          >
            Ver no Instagram
            <ArrowUpRightIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </div>
      </div>
    </article>
  );
}

function Actions({
  post,
  onAction,
  onCompare,
}: {
  post: InstagramPost;
  onAction: (post: InstagramPost, action: Action) => void;
  onCompare: () => void;
}) {
  const ignore = (
    <button type="button" className={button} onClick={() => onAction(post, "ignore")}>
      <BanIcon aria-hidden className="size-3.5" /> Ignorar
    </button>
  );
  const compare = (label = "Comparar") => (
    <button type="button" className={button} onClick={onCompare}>
      <GitCompareIcon aria-hidden className="size-3.5" /> {label}
    </button>
  );

  switch (post.status) {
    case "NEW":
      return (
        <>
          <button
            type="button"
            className={primaryButton}
            onClick={() => onAction(post, "generate")}
          >
            <SparklesIcon aria-hidden className="size-3.5" /> Gerar agora
          </button>
          {ignore}
        </>
      );
    case "ERROR":
      return (
        <>
          <button
            type="button"
            className={primaryButton}
            onClick={() => onAction(post, "reprocess")}
          >
            <RotateCwIcon aria-hidden className="size-3.5" /> Reprocessar
          </button>
          <Link href={adminRoutes.newNews} className={button}>
            <FileTextIcon aria-hidden className="size-3.5" /> Criar manualmente
          </Link>
          {ignore}
        </>
      );
    case "CHANGED_AT_SOURCE":
      return (
        <>
          <button type="button" className={primaryButton} onClick={onCompare}>
            <GitCompareIcon aria-hidden className="size-3.5" /> Ver o que mudou
          </button>
          <button type="button" className={button} onClick={() => onAction(post, "acknowledge")}>
            <CheckIcon aria-hidden className="size-3.5" /> Marcar como revisado
          </button>
        </>
      );
    case "IGNORED":
      return (
        <button type="button" className={button} onClick={() => onAction(post, "restore")}>
          <RotateCwIcon aria-hidden className="size-3.5" /> Importar mesmo assim
        </button>
      );
    default:
      return post.news ? compare("Comparar com a notícia") : null;
  }
}

function StatusNote({ post }: { post: InstagramPost }) {
  const note = (
    tone: "danger" | "warning" | "muted",
    icon: React.ReactNode,
    text: React.ReactNode,
  ) => (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-md px-3 py-2 text-xs",
        tone === "danger" && "bg-red-50 text-red-800",
        tone === "warning" && "bg-amber-50 text-amber-900",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <span>{text}</span>
    </p>
  );
  const icon = "size-3.5";

  if (post.status === "ERROR" && post.error)
    return note(
      "danger",
      <AlertTriangleIcon aria-hidden className={icon} />,
      <>
        {post.error}
        {post.attempts ? ` (${post.attempts} tentativas)` : ""}
      </>,
    );
  if (post.status === "CHANGED_AT_SOURCE")
    return note(
      "warning",
      <AlertTriangleIcon aria-hidden className={icon} />,
      <>
        A legenda foi editada no Instagram
        {post.sourceChangedAt && (
          <>
            {" "}
            (<RelativeTime iso={post.sourceChangedAt} />)
          </>
        )}
        . A notícia não muda sozinha: compare e decida se atualiza.
      </>,
    );
  if (post.status === "REMOVED_AT_SOURCE")
    return note(
      "muted",
      <Trash2Icon aria-hidden className={icon} />,
      <>
        Post apagado do Instagram
        {post.sourceChangedAt && (
          <>
            {" "}
            (<RelativeTime iso={post.sourceChangedAt} />)
          </>
        )}
        . A notícia continua no ar; despublique pelo editor se for o caso.
      </>,
    );
  if (post.status === "IGNORED" && post.ignoredReason)
    return note("muted", <BanIcon aria-hidden className={icon} />, post.ignoredReason);
  if (post.status === "NEW")
    return note(
      "muted",
      <SparklesIcon aria-hidden className={icon} />,
      "Na fila: a IA gera o rascunho automaticamente em instantes.",
    );
  if (post.status === "IMPORTED" && !post.news)
    return note(
      "muted",
      <SparklesIcon aria-hidden className={icon} />,
      "Gerando o rascunho com IA… ele aparece em Notícias quando ficar pronto.",
    );
  return null;
}

function Thumbnail({ post }: { post: InstagramPost }) {
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted sm:size-24">
      {post.thumbnailUrl && (
        <Image
          src={post.thumbnailUrl}
          alt=""
          fill
          sizes="(min-width: 640px) 96px, 56px"
          className="object-cover"
        />
      )}
      {post.mediaType !== "IMAGE" && (
        <span className="absolute top-1 right-1 rounded-full bg-foreground/70 p-1 text-background">
          {post.mediaType === "VIDEO" ? (
            <PlayIcon aria-hidden className="size-3 fill-current" />
          ) : (
            <GalleryHorizontalIcon aria-hidden className="size-3" />
          )}
        </span>
      )}
    </div>
  );
}

function mediaLabel(post: InstagramPost) {
  if (post.mediaType === "VIDEO") return "Vídeo";
  if (post.mediaType === "CAROUSEL_ALBUM") return `Carrossel · ${post.mediaCount} mídias`;
  return "Foto";
}

// Comparação lado a lado: legenda original (imutável) × notícia gerada. Quando a legenda
// mudou na origem, mostra também o que foi trocado, palavra a palavra.
function Comparison({
  post,
  onAction,
}: {
  post: InstagramPost;
  onAction: (post: InstagramPost, action: Action) => void;
}) {
  const changed = post.status === "CHANGED_AT_SOURCE" && post.currentCaption;
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="font-heading text-lg font-bold">
          {changed ? "O que mudou no Instagram" : "Original × notícia"}
        </SheetTitle>
        <SheetDescription>
          A legenda importada fica guardada sem alteração, para auditoria.
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-4 pb-6">
        {changed && post.currentCaption && (
          <section aria-labelledby="diff-titulo" className="flex flex-col gap-2">
            <h3 id="diff-titulo" className="text-sm font-semibold">
              Legenda: importada → atual
            </h3>
            <p className="rounded-md border bg-background p-3 text-sm leading-relaxed">
              {diffWords(post.caption, post.currentCaption).map((part, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  {part.type === "same" ? (
                    part.text
                  ) : part.type === "removed" ? (
                    <del className="bg-red-50 text-red-800 decoration-red-800/60">
                      <span className="sr-only">[removido: </span>
                      {part.text}
                      <span className="sr-only">]</span>
                    </del>
                  ) : (
                    <ins className="bg-emerald-50 text-emerald-800 no-underline">
                      <span className="sr-only">[incluído: </span>
                      {part.text}
                      <span className="sr-only">]</span>
                    </ins>
                  )}
                </span>
              ))}
            </p>
            <p className="text-xs text-muted-foreground">
              <del className="bg-red-50 text-red-800">Riscado</del> saiu;{" "}
              <ins className="bg-emerald-50 text-emerald-800 no-underline">verde</ins> entrou.
            </p>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="original-titulo" className="flex flex-col gap-2">
            <h3 id="original-titulo" className="text-sm font-semibold">
              Legenda original (importada)
            </h3>
            <p className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-line">
              {post.caption}
            </p>
          </section>
          <section aria-labelledby="noticia-titulo" className="flex flex-col gap-2">
            <h3 id="noticia-titulo" className="flex items-center gap-2 text-sm font-semibold">
              Notícia {post.news && <StatusBadge status={post.news.status} />}
            </h3>
            {post.news ? (
              <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
                <p className="font-heading text-base font-bold">{post.news.title}</p>
                {post.news.summary && <p className="text-muted-foreground">{post.news.summary}</p>}
                {post.news.paragraphs.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ainda sem notícia gerada.</p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {post.news && (
            <Link href={adminRoutes.editNews(post.news.id)} className={primaryButton}>
              <FileTextIcon aria-hidden className="size-3.5" />
              {changed ? "Atualizar a notícia no editor" : "Abrir no editor"}
            </Link>
          )}
          {changed && (
            <button type="button" className={button} onClick={() => onAction(post, "acknowledge")}>
              <CheckIcon aria-hidden className="size-3.5" /> Manter como está (revisado)
            </button>
          )}
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(button, "ml-auto")}
          >
            Ver no Instagram <ArrowUpRightIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- grade do perfil

/** Quadrado da grade: foto, ícone de vídeo/carrossel (como no Instagram) e o status. */
function GridTile({ post, onOpen }: { post: InstagramPost; onOpen: () => void }) {
  const attention =
    post.status === "NEW" || post.status === "ERROR" || post.status === "CHANGED_AT_SOURCE";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${instagramStatusLabel(post.status)}: ${post.caption.slice(0, 80)}`}
      className="group relative block aspect-square w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {post.thumbnailUrl && (
        <Image
          src={post.thumbnailUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 310px, 33vw"
          className={cn(
            "object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none",
            (post.status === "IGNORED" || post.status === "REMOVED_AT_SOURCE") && "grayscale",
          )}
        />
      )}
      <span className="absolute top-2 right-2 text-white drop-shadow">
        {post.mediaType === "VIDEO" ? (
          <PlayIcon aria-hidden className="size-5 fill-current" />
        ) : post.mediaType === "CAROUSEL_ALBUM" ? (
          <GalleryHorizontalIcon aria-hidden className="size-5" />
        ) : null}
      </span>
      <span className="absolute bottom-2 left-2">
        <InstagramStatusBadge
          status={post.status}
          className={cn("shadow-sm", !attention && "max-sm:hidden")}
        />
      </span>
      {/* Ao passar o mouse: começo da legenda (no Instagram seriam as curtidas). */}
      <span className="absolute inset-0 hidden items-center justify-center bg-foreground/60 p-4 text-center text-sm font-medium text-white opacity-0 transition group-hover:opacity-100 sm:flex">
        <span className="line-clamp-4">{post.caption}</span>
      </span>
    </button>
  );
}

/** Post aberto, como no Instagram: mídia à esquerda, legenda e ações à direita. */
function PostDetail({
  post,
  onAction,
  onCompare,
}: {
  post: InstagramPost;
  onAction: (post: InstagramPost, action: Action) => void;
  onCompare: () => void;
}) {
  return (
    <>
      <div className="relative aspect-square w-full shrink-0 bg-foreground md:h-full md:w-auto">
        {post.thumbnailUrl && (
          <Image
            src={post.thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 560px, 100vw"
            className="object-contain"
          />
        )}
        {post.mediaType !== "IMAGE" && (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold">
            {mediaLabel(post)}
          </span>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:w-96 md:flex-none">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-brand-blue text-[0.6rem] font-extrabold text-white ring-2 ring-brand-red ring-offset-2 ring-offset-background"
          >
            ZSU
          </span>
          <Dialog.Title className="flex-1 text-sm font-semibold">zonasulurgente</Dialog.Title>
          <InstagramStatusBadge status={post.status} />
          <Dialog.Close
            aria-label="Fechar"
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <XIcon aria-hidden className="size-5" />
          </Dialog.Close>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Dialog.Description className="text-sm whitespace-pre-line">
            <strong className="mr-1 font-semibold">zonasulurgente</strong>
            {post.caption}
          </Dialog.Description>
          <p className="text-xs text-muted-foreground">
            Postado <RelativeTime iso={post.postedAt} />
          </p>
          <StatusNote post={post} />
          {post.news && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
              <FileTextIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <Link
                href={adminRoutes.editNews(post.news.id)}
                className="line-clamp-2 min-w-0 flex-1 font-semibold hover:text-brand-blue hover:underline"
              >
                {post.news.title}
              </Link>
              <StatusBadge status={post.news.status} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t p-4">
          <Actions post={post} onAction={onAction} onCompare={onCompare} />
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(button, "ml-auto")}
          >
            Ver no Instagram
            <ArrowUpRightIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </div>
      </div>
    </>
  );
}
