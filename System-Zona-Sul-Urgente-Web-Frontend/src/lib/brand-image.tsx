import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Imagens da marca geradas por código (logo, ícones do PWA, favicon), todas do mesmo
// desenho do logo do Instagram. Trocar pelo arquivo oficial quando houver o vetor.

const montserrat = await readFile(
  join(process.cwd(), "assets/fonts/montserrat-latin-800-normal.woff"),
);
const fonts = [
  { name: "Montserrat", data: montserrat, weight: 800 as const, style: "normal" as const },
];

// Mesmos valores de globals.css (o ImageResponse não lê variáveis CSS).
const BLUE = "#024baa";
const RED = "#fd3132";
const SKY = "#38b8ff";

const headers = { "Cache-Control": "public, max-age=86400, immutable" };

function Wordmark({ scale }: { scale: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        fontFamily: "Montserrat",
      }}
    >
      <div
        style={{
          display: "flex",
          background: BLUE,
          color: "white",
          fontSize: 54 * scale,
          padding: `${8 * scale}px ${18 * scale}px ${4 * scale}px`,
        }}
      >
        ZONA SUL
      </div>
      <div
        style={{
          display: "flex",
          background: RED,
          color: "white",
          fontSize: 70 * scale,
          padding: `${6 * scale}px ${16 * scale}px ${2 * scale}px`,
        }}
      >
        URGENTE
      </div>
    </div>
  );
}

/**
 * Selo redondo (azul-claro com anel azul), como o avatar do Instagram.
 * `maskable`: fundo azul-claro de ponta a ponta e logo dentro da "zona segura" (80%),
 * para o Android recortar em círculo/gota sem cortar o texto.
 */
export function brandBadge(size: number, { maskable = false } = {}) {
  const scale = size / 512;
  return new ImageResponse(
    maskable ? (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: SKY,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Wordmark scale={scale * 0.78} />
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 480 * scale,
            height: 480 * scale,
            borderRadius: 240 * scale,
            background: SKY,
            border: `${18 * scale}px solid ${BLUE}`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Wordmark scale={scale} />
        </div>
      </div>
    ),
    { width: size, height: size, fonts, headers },
  );
}

/** Monograma "ZS" para favicon (o logo completo fica ilegível em 32 px). */
export function brandMonogram(size: number) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: BLUE,
        borderRadius: size * 0.18,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Montserrat",
      }}
    >
      <div style={{ display: "flex", color: "white", fontSize: size * 0.5, lineHeight: 1 }}>ZS</div>
      <div
        style={{
          display: "flex",
          width: size * 0.56,
          height: size * 0.11,
          marginTop: size * 0.04,
          background: RED,
        }}
      />
    </div>,
    { width: size, height: size, fonts, headers },
  );
}
