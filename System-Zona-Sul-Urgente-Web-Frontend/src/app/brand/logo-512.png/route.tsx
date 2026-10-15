import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Logo quadrado 512×512 em PNG, gerado a partir da versão redonda do logo do Instagram.
// Usado como publisher-logo dos Web Stories e, depois, como ícone do PWA (FE-115).
// Trocar pelo arquivo oficial quando houver o vetor do logo.

const montserrat = await readFile(
  join(process.cwd(), "assets/fonts/montserrat-latin-800-normal.woff"),
);

// Cores da marca (mesmos valores de globals.css; o ImageResponse não lê variáveis CSS).
const BLUE = "#024baa";
const RED = "#fd3132";
const SKY = "#38b8ff";

export function GET() {
  return new ImageResponse(
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
          width: 480,
          height: 480,
          borderRadius: 240,
          background: SKY,
          border: `18px solid ${BLUE}`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
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
              fontSize: 54,
              padding: "8px 18px 4px",
            }}
          >
            ZONA SUL
          </div>
          <div
            style={{
              display: "flex",
              background: RED,
              color: "white",
              fontSize: 70,
              padding: "6px 16px 2px",
            }}
          >
            URGENTE
          </div>
        </div>
      </div>
    </div>,
    {
      width: 512,
      height: 512,
      fonts: [{ name: "Montserrat", data: montserrat, weight: 800, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
