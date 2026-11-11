import { useId } from "react";

import { cn } from "@/lib/utils";

export type MascotMood = "lost" | "building" | "error" | "sleepy";

const labels: Record<MascotMood, string> = {
  lost: "Microfone do Zona Sul Urgente, perdido, coçando a cabeça",
  building: "Microfone do Zona Sul Urgente de capacete, consertando algo",
  error: "Microfone do Zona Sul Urgente, assustado",
  sleepy: "Microfone do Zona Sul Urgente, cochilando",
};

// Mascote: o microfone da logo do Instagram do jornal (cabeça metálica, cabo vermelho com faixa
// branca), com rostinho. SVG próprio, cores só de tokens (--mascot-*, --brand-*); animações em
// globals.css (.mascot-*), paradas com "reduzir movimento". viewBox 220×280.
export function MicMascot({
  mood = "lost",
  className,
  title,
}: {
  mood?: MascotMood;
  className?: string;
  /** Texto para leitores de tela; padrão por humor. */
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const grille = `mascot-grille-${id}`;
  const headClip = `mascot-head-${id}`;
  const asleep = mood === "sleepy";

  return (
    <svg
      viewBox="0 0 220 280"
      role="img"
      aria-label={title ?? labels[mood]}
      className={cn("mascot overflow-visible", className)}
    >
      <defs>
        <pattern id={grille} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.7" fill="var(--mascot-grille)" />
        </pattern>
        <clipPath id={headClip}>
          <circle cx="110" cy="84" r="56" />
        </clipPath>
      </defs>

      {/* Sombra no chão (encolhe quando ele sobe). */}
      <ellipse
        className="mascot-shadow"
        cx="110"
        cy="266"
        rx="48"
        ry="8"
        fill="var(--mascot-shadow)"
      />

      <g className="mascot-float">
        {/* Ondas de som (é um microfone!). */}
        {!asleep && (
          <g fill="none" stroke="var(--brand-sky)" strokeWidth="5" strokeLinecap="round">
            <path className="mascot-wave" d="M40 60 Q28 84 40 108" />
            <path className="mascot-wave" d="M180 60 Q192 84 180 108" />
            <path className="mascot-wave mascot-wave-late" d="M24 48 Q8 84 24 120" />
            <path className="mascot-wave mascot-wave-late" d="M196 48 Q212 84 196 120" />
          </g>
        )}

        {/* Pés. */}
        <ellipse cx="90" cy="246" rx="17" ry="9" fill="var(--brand-blue-dark)" />
        <ellipse cx="130" cy="246" rx="17" ry="9" fill="var(--brand-blue-dark)" />

        {/* Cabo: vermelho com faixa branca, como na logo. */}
        <path d="M82 150 H138 L127 236 Q110 244 93 236 Z" fill="var(--brand-red)" />
        <path d="M124 150 H138 L127 236 Q122 239 116 240 Z" fill="var(--brand-red-dark)" />
        <path d="M84.5 172 H135.5 L134 184 H86 Z" fill="var(--background)" />

        {/* Braço esquerdo (no "em construção", segura a chave inglesa). */}
        <path
          d="M86 176 Q64 186 58 206"
          fill="none"
          stroke="var(--mascot-metal-shade)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <circle cx="57" cy="208" r="9" fill="var(--mascot-metal)" />
        {mood === "building" && (
          <g className="mascot-bob">
            {/* Chave inglesa: cabo + cabeça aberta. */}
            <path
              d="M57 208 L32 240"
              stroke="var(--mascot-grille)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path d="M22 236 a13 13 0 1 0 20 14 l-7 -4 -3 -9 6 -6 z" fill="var(--mascot-grille)" />
          </g>
        )}

        {/* Braço direito: perdido coça a cabeça; os outros deixam o braço para baixo. */}
        {mood === "lost" ? (
          <g className="mascot-scratch">
            <path
              d="M136 168 Q170 150 168 112"
              fill="none"
              stroke="var(--mascot-metal-shade)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <circle cx="167" cy="108" r="9" fill="var(--mascot-metal)" />
          </g>
        ) : (
          <>
            <path
              d="M134 176 Q156 186 162 206"
              fill="none"
              stroke="var(--mascot-metal-shade)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <circle cx="163" cy="208" r="9" fill="var(--mascot-metal)" />
          </>
        )}

        {/* Anel entre a cabeça e o cabo. */}
        <rect x="76" y="134" width="68" height="22" rx="9" fill="var(--mascot-metal-shade)" />

        {/* Cabeça: grade metálica com brilho. */}
        <circle cx="110" cy="84" r="56" fill="var(--mascot-metal)" />
        <rect
          x="50"
          y="24"
          width="120"
          height="120"
          fill={`url(#${grille})`}
          clipPath={`url(#${headClip})`}
          opacity="0.55"
        />
        <ellipse
          cx="88"
          cy="52"
          rx="20"
          ry="10"
          fill="var(--background)"
          opacity="0.7"
          transform="rotate(-25 88 52)"
        />

        {mood === "building" && (
          // Capacete (azul-claro da marca; sem amarelo).
          <g>
            <path d="M58 70 Q60 22 110 20 Q160 22 162 70 Z" fill="var(--brand-sky)" />
            <rect x="50" y="64" width="120" height="12" rx="6" fill="var(--brand-blue)" />
            <rect
              x="104"
              y="22"
              width="12"
              height="44"
              rx="5"
              fill="var(--brand-blue)"
              opacity="0.35"
            />
          </g>
        )}

        {/* Rosto. */}
        {asleep ? (
          <g fill="none" stroke="var(--mascot-ink)" strokeWidth="4" strokeLinecap="round">
            <path d="M80 92 Q90 99 100 92" />
            <path d="M120 92 Q130 99 140 92" />
          </g>
        ) : (
          <g className="mascot-blink">
            <ellipse cx="90" cy="90" rx="13" ry="15" fill="var(--background)" />
            <ellipse cx="130" cy="90" rx="13" ry="15" fill="var(--background)" />
            {/* Perdido olha para cima e para o lado; assustado arregala. */}
            <circle
              cx={mood === "lost" ? 93 : 90}
              cy={mood === "lost" ? 84 : 91}
              r={mood === "error" ? 5 : 7}
              fill="var(--mascot-ink)"
            />
            <circle
              cx={mood === "lost" ? 133 : 130}
              cy={mood === "lost" ? 84 : 91}
              r={mood === "error" ? 5 : 7}
              fill="var(--mascot-ink)"
            />
            <circle
              cx={mood === "lost" ? 95 : 92}
              cy={mood === "lost" ? 81 : 88}
              r="2.5"
              fill="var(--background)"
            />
            <circle
              cx={mood === "lost" ? 135 : 132}
              cy={mood === "lost" ? 81 : 88}
              r="2.5"
              fill="var(--background)"
            />
          </g>
        )}

        {/* Sobrancelhas: preocupadas (perdido/erro). */}
        {(mood === "lost" || mood === "error") && (
          <g fill="none" stroke="var(--mascot-ink)" strokeWidth="3.5" strokeLinecap="round">
            <path d="M78 68 Q88 62 100 68" />
            <path d="M120 66 Q132 60 142 68" />
          </g>
        )}

        {/* Bochechas. */}
        <ellipse cx="76" cy="110" rx="8" ry="4.5" fill="var(--mascot-blush)" opacity="0.75" />
        <ellipse cx="144" cy="110" rx="8" ry="4.5" fill="var(--mascot-blush)" opacity="0.75" />

        {/* Boca por humor. */}
        {mood === "lost" && <ellipse cx="110" cy="116" rx="6" ry="7" fill="var(--mascot-ink)" />}
        {mood === "building" && (
          <path
            d="M98 110 Q110 124 122 110"
            fill="none"
            stroke="var(--mascot-ink)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
        {mood === "error" && (
          <path
            d="M96 118 q4 -5 7 0 t7 0 t7 0 t7 0"
            fill="none"
            stroke="var(--mascot-ink)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}
        {asleep && <ellipse cx="110" cy="114" rx="5" ry="3.5" fill="var(--mascot-ink)" />}

        {/* Extras. */}
        {mood === "lost" && (
          <text
            className="mascot-bob"
            x="176"
            y="40"
            fontSize="38"
            fontWeight="800"
            fill="var(--brand-blue)"
            fontFamily="var(--font-heading)"
          >
            ?
          </text>
        )}
        {mood === "error" && (
          <path
            className="mascot-bob"
            d="M160 44 q8 12 0 18 q-8 -6 0 -18 z"
            fill="var(--brand-sky)"
          />
        )}
        {asleep && (
          <g fill="var(--brand-blue)" fontFamily="var(--font-heading)" fontWeight="800">
            <text className="mascot-bob" x="160" y="44" fontSize="22">
              z
            </text>
            <text className="mascot-bob mascot-wave-late" x="178" y="24" fontSize="16">
              z
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
