export type DiffPart = { type: "same" | "added" | "removed"; text: string };

/**
 * Diferença palavra a palavra entre dois textos (LCS), para mostrar o que mudou numa
 * legenda. Pensado para textos curtos (legendas têm até 2.200 caracteres).
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  // lcs[i][j] = tamanho da maior subsequência comum de a[i..] e b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], word: string) => {
    const last = parts.at(-1);
    if (last?.type === type) last.text += ` ${word}`;
    else parts.push({ type, text: word });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("removed", a[i++]);
    else push("added", b[j++]);
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return parts;
}
