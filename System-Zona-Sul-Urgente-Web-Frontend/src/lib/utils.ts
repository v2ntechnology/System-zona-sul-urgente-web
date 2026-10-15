import { createCn } from "cn/config";

// Registra a escala tipográfica do projeto (globals.css). Sem isso o merge trata
// `text-label` como cor e o descarta quando há outra cor, como `text-kicker`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "headline", "title", "teaser", "label", "article"] }],
    },
  },
});
