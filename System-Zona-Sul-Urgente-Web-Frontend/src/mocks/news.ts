import type { News, NewsOrigin, NewsSummary, Sponsor, VideoEmbed } from "@/types/news";

import {
  city,
  findAuthor,
  findCategory,
  findNeighborhood,
  findTag,
  mockId,
} from "@/mocks/taxonomy";

// Dados de exemplo (FE-009): 29 notícias fictícias, coerentes entre si.
// Nunca importar em componentes: use os services.
// Fotos: picsum.photos com semente fixa (sempre a mesma foto por notícia, mas genérica).

/** "Agora" fixo dos mocks, para os dados não mudarem a cada build. */
export const MOCK_NOW = new Date("2026-10-15T15:00:00-03:00");

type Seed = {
  slug: string;
  title: string;
  subtitle?: string;
  summary: string;
  category: string;
  neighborhood?: string;
  authors: string[];
  tags: string[];
  /** Horas antes de MOCK_NOW. */
  hoursAgo: number;
  updatedHoursAgo?: number;
  paragraphs: string[];
  quote?: { text: string; source: string };
  imageAlt: string;
  urgent?: boolean;
  sponsor?: Sponsor;
  video?: boolean;
  origin?: NewsOrigin;
  /** Posição no destaque editorial da home (1 = manchete). */
  featured?: number;
  /** Visualizações simuladas (alimentam "Mais lidas"). */
  views: { day: number; week: number; total: number };
};

const seeds: Seed[] = [
  {
    slug: "remadores-da-lagoa-conquistam-ouro-no-estadual",
    title: "Remadores da Lagoa conquistam três ouros no Campeonato Estadual",
    summary:
      "Equipe de clube da Lagoa Rodrigo de Freitas venceu as provas de skiff, double e quatro sem.",
    category: "esportes",
    neighborhood: "lagoa",
    authors: ["rafael-duarte"],
    tags: ["cultura"],
    hoursAgo: 4,
    video: true,
    imageAlt: "Barco de remo deslizando na lagoa ao amanhecer",
    paragraphs: [
      "Atletas de um clube de remo da Lagoa Rodrigo de Freitas conquistaram três medalhas de ouro no Campeonato Estadual disputado no fim de semana.",
      "Os títulos vieram nas provas de skiff, double e quatro sem. Parte da equipe treina na lagoa desde a categoria de base.",
    ],
    views: { day: 5200, week: 5200, total: 5200 },
  },
  {
    slug: "torneio-de-futevolei-reune-300-atletas-em-copacabana",
    title: "Torneio de futevôlei reúne 300 atletas nas areias de Copacabana",
    summary: "Competição gratuita para o público vai até domingo, na altura do Posto 5.",
    category: "esportes",
    neighborhood: "copacabana",
    authors: ["ana-ribeiro"],
    tags: ["praia", "orla"],
    hoursAgo: 20,
    imageAlt: "Jogadores de futevôlei disputando bola na areia",
    paragraphs: [
      "Cerca de 300 atletas participam até domingo de um torneio de futevôlei na praia de Copacabana, na altura do Posto 5.",
      "A entrada é gratuita. As finais estão marcadas para domingo à tarde.",
    ],
    views: { day: 2100, week: 4600, total: 4600 },
  },
  {
    slug: "comercio-de-copacabana-espera-vendas-maiores-no-fim-de-ano",
    title: "Comércio de Copacabana espera alta de 12% nas vendas de fim de ano",
    subtitle:
      "Lojistas apostam no turismo e no décimo terceiro; contratações temporárias já começaram",
    summary:
      "Associação de lojistas projeta o melhor dezembro desde 2019 e abre 600 vagas temporárias.",
    category: "economia",
    neighborhood: "copacabana",
    authors: ["carlos-menezes", "juliana-prado"],
    tags: [],
    hoursAgo: 8,
    imageAlt: "Rua comercial movimentada com lojas e pedestres",
    paragraphs: [
      "A associação de lojistas de Copacabana projeta alta de 12% nas vendas de fim de ano em relação a 2025, puxada pelo turismo e pelo décimo terceiro salário.",
      "Para dar conta do movimento, o comércio do bairro deve abrir cerca de 600 vagas temporárias, principalmente para vendedores e estoquistas.",
    ],
    views: { day: 3900, week: 3900, total: 3900 },
  },
  {
    slug: "feirao-de-empregos-em-botafogo-oferece-800-vagas",
    title: "Feirão de empregos em Botafogo oferece 800 vagas nesta sexta",
    summary:
      "Há oportunidades no comércio, em serviços e em hotelaria; leve currículo e documento.",
    category: "economia",
    neighborhood: "botafogo",
    authors: ["redacao"],
    tags: [],
    hoursAgo: 44,
    imageAlt: "Pessoas em fila com currículos na mão",
    paragraphs: [
      "Um feirão de empregos vai oferecer cerca de 800 vagas nesta sexta-feira, das 9h às 16h, em Botafogo.",
      "As oportunidades são para comércio, serviços e hotelaria, com vagas para primeiro emprego. É preciso levar currículo e documento com foto.",
    ],
    views: { day: 800, week: 6300, total: 6300 },
  },
  {
    slug: "temporal-alaga-ruas-de-copacabana-e-botafogo",
    title: "Temporal alaga ruas de Copacabana e Botafogo; Defesa Civil emite alerta",
    subtitle:
      "Sirenes foram acionadas em áreas de risco e motoristas devem evitar a orla até a noite",
    summary:
      "Chuva forte no início da tarde deixou pontos de alagamento na Avenida Atlântica e na Rua São Clemente.",
    category: "cidade",
    neighborhood: "copacabana",
    authors: ["ana-ribeiro", "rafael-duarte"],
    tags: ["chuva", "defesa-civil", "orla"],
    hoursAgo: 0.5,
    updatedHoursAgo: 0.2,
    urgent: true,
    video: true,
    featured: 1,
    imageAlt: "Rua alagada com carros parados e pedestres atravessando a água",
    paragraphs: [
      "Uma chuva forte que começou por volta das 14h desta quarta-feira provocou alagamentos em vários pontos de <strong>Copacabana</strong> e <strong>Botafogo</strong>. A Defesa Civil municipal elevou o alerta e acionou as sirenes em comunidades próximas.",
      "Na Avenida Atlântica, a água chegou à altura do meio-fio nas proximidades do Posto 4. Em Botafogo, a Rua São Clemente teve trânsito lento por mais de uma hora.",
      "A orientação é que moradores evitem deslocamentos desnecessários e não atravessem áreas alagadas. Em emergências, o telefone da Defesa Civil é o 199.",
    ],
    quote: {
      text: "A previsão indica chuva moderada a forte até a madrugada. Pedimos atenção redobrada.",
      source: "Defesa Civil do Rio",
    },
    views: { day: 18400, week: 18400, total: 18400 },
  },
  {
    slug: "tunel-reboucas-tem-faixa-fechada-apos-acidente",
    title: "Túnel Rebouças tem faixa fechada após acidente no sentido Lagoa",
    summary:
      "Colisão entre dois carros e uma moto deixou uma pessoa ferida; trânsito chega ao Rio Comprido.",
    category: "transito",
    neighborhood: "lagoa",
    authors: ["rafael-duarte"],
    tags: ["obras"],
    hoursAgo: 1,
    urgent: true,
    featured: 2,
    imageAlt: "Trânsito congestionado na entrada de um túnel",
    paragraphs: [
      "Um acidente envolvendo dois carros e uma motocicleta fechou a faixa da esquerda do Túnel Rebouças, no sentido Lagoa, no início da tarde.",
      "O motociclista foi atendido pelo Corpo de Bombeiros e levado consciente para o Hospital Miguel Couto. A CET-Rio orienta o uso da Rua Jardim Botânico como alternativa.",
    ],
    views: { day: 9100, week: 9100, total: 9100 },
  },
  {
    slug: "falta-de-luz-atinge-parte-do-leblon",
    title: "Falta de luz atinge parte do Leblon; concessionária promete religar até 18h",
    summary:
      "Cerca de 3 mil imóveis estão sem energia desde o fim da manhã por causa de um defeito em cabo subterrâneo.",
    category: "cidade",
    neighborhood: "leblon",
    authors: ["carlos-menezes"],
    tags: ["energia"],
    hoursAgo: 1.5,
    urgent: true,
    imageAlt: "Semáforo apagado em cruzamento movimentado",
    paragraphs: [
      "Moradores de ruas próximas à Avenida Ataulfo de Paiva estão sem luz desde as 11h. Semáforos apagados complicam o trânsito na região.",
      "A concessionária informou que equipes trabalham na troca de um trecho de cabo subterrâneo e que o fornecimento deve ser restabelecido até as 18h.",
    ],
    views: { day: 7300, week: 7300, total: 7300 },
  },
  {
    slug: "policia-prende-suspeito-de-assaltos-na-orla-de-copacabana",
    title: "Polícia prende suspeito de assaltos em série na orla de Copacabana",
    summary:
      "Homem de 24 anos foi identificado por câmeras e reconhecido por pelo menos cinco vítimas.",
    category: "seguranca",
    neighborhood: "copacabana",
    authors: ["ana-ribeiro"],
    tags: ["policia-militar", "orla"],
    hoursAgo: 3,
    featured: 3,
    origin: "INSTAGRAM",
    imageAlt: "Viatura da polícia estacionada no calçadão da praia",
    paragraphs: [
      "Policiais militares prenderam na manhã desta quarta-feira um homem suspeito de praticar ao menos cinco roubos na orla de Copacabana nas últimas duas semanas.",
      "Segundo a PM, o suspeito abordava pedestres no calçadão no início da manhã e fugia de bicicleta. Ele foi levado para a 12ª DP.",
    ],
    views: { day: 12800, week: 15200, total: 15200 },
  },
  {
    slug: "ciclista-e-assaltado-na-orla-de-ipanema",
    title: "Ciclista é assaltado na orla de Ipanema; PM reforça patrulhamento",
    summary:
      "Vídeo enviado por leitor mostra a abordagem na altura do Posto 9, no começo da manhã.",
    category: "seguranca",
    neighborhood: "ipanema",
    authors: ["redacao"],
    tags: ["policia-militar", "orla", "ciclovia"],
    hoursAgo: 5,
    video: true,
    origin: "INSTAGRAM",
    imageAlt: "Ciclovia à beira-mar com prédios ao fundo",
    paragraphs: [
      "Um ciclista foi rendido por dois homens na ciclovia da orla de Ipanema, perto do Posto 9, por volta das 6h. Os criminosos levaram a bicicleta e o celular da vítima.",
      "A Polícia Militar informou que vai reforçar o patrulhamento na orla nas primeiras horas do dia. O caso foi registrado na 14ª DP.",
    ],
    views: { day: 10400, week: 12900, total: 12900 },
  },
  {
    slug: "camara-aprova-ampliacao-de-ciclovias-na-zona-sul",
    title: "Câmara aprova projeto que amplia ciclovias na Zona Sul",
    subtitle: "Plano prevê 18 km de novas faixas ligando Botafogo, Humaitá e Jardim Botânico",
    summary:
      "Texto segue para sanção do prefeito e prevê obras a partir do primeiro semestre de 2027.",
    category: "politica",
    authors: ["juliana-prado", "carlos-menezes"],
    tags: ["ciclovia", "obras"],
    hoursAgo: 7,
    featured: 4,
    imageAlt: "Ciclistas pedalando em ciclovia arborizada",
    paragraphs: [
      "A Câmara Municipal aprovou em segunda votação o projeto que cria 18 quilômetros de novas ciclovias na Zona Sul, com ligação entre Botafogo, Humaitá e Jardim Botânico.",
      "O texto segue para sanção. A previsão da Secretaria de Transportes é iniciar as obras no primeiro semestre de 2027.",
      "Associações de moradores pedem que o traçado seja apresentado em audiência pública antes do início das intervenções.",
    ],
    views: { day: 4200, week: 6100, total: 6100 },
  },
  {
    slug: "restaurante-em-botafogo-aposta-em-comida-nordestina",
    title: "Novo restaurante em Botafogo aposta em comida nordestina",
    summary:
      "Casa abre na Rua Voluntários da Pátria com cardápio de baião de dois, carne de sol e cuscuz.",
    category: "gastronomia",
    neighborhood: "botafogo",
    authors: ["redacao"],
    tags: ["cultura"],
    hoursAgo: 9,
    sponsor: { name: "Casa do Sertão", url: "https://example.com/casa-do-sertao" },
    imageAlt: "Mesa com pratos típicos nordestinos",
    paragraphs: [
      "O restaurante Casa do Sertão abre as portas nesta semana em Botafogo com um cardápio dedicado à culinária nordestina.",
      "Entre os destaques estão o baião de dois, a carne de sol com macaxeira e o cuscuz recheado. A casa funciona de terça a domingo, a partir do meio-dia.",
    ],
    views: { day: 1500, week: 3900, total: 3900 },
  },
  {
    slug: "lagoa-recebe-festival-de-musica-gratuito",
    video: true,
    title: "Lagoa recebe festival de música gratuito no fim de semana",
    summary: "Programação reúne 12 atrações no Parque dos Patins, de sábado a domingo.",
    category: "eventos",
    neighborhood: "lagoa",
    authors: ["juliana-prado"],
    tags: ["cultura"],
    hoursAgo: 11,
    imageAlt: "Palco ao ar livre com público ao entardecer",
    paragraphs: [
      "O Parque dos Patins, na Lagoa Rodrigo de Freitas, recebe neste fim de semana um festival de música com entrada gratuita.",
      "Serão 12 apresentações entre samba, MPB e música instrumental, das 14h às 22h. A organização recomenda chegar de transporte público.",
    ],
    views: { day: 3100, week: 5400, total: 5400 },
  },
  {
    slug: "aterro-do-flamengo-tera-interdicao-para-corrida",
    title: "Aterro do Flamengo terá interdição no domingo para corrida de rua",
    summary: "Pistas sentido Centro ficam fechadas das 5h às 11h; veja os desvios.",
    category: "transito",
    neighborhood: "flamengo",
    authors: ["rafael-duarte"],
    tags: ["onibus"],
    hoursAgo: 14,
    imageAlt: "Avenida arborizada vazia em manhã de domingo",
    paragraphs: [
      "As pistas do Aterro do Flamengo no sentido Centro serão interditadas das 5h às 11h de domingo para uma corrida de rua com 8 mil inscritos.",
      "Os ônibus que passam pelo Aterro serão desviados pela Praia do Flamengo. A CET-Rio terá agentes nos principais cruzamentos.",
    ],
    views: { day: 2600, week: 4800, total: 4800 },
  },
  {
    slug: "feira-da-gloria-muda-de-endereco",
    title: "Feira da Glória muda de endereço a partir de novembro",
    summary: "Barracas passam a ocupar a Rua do Russel para liberar a calçada da praça em obras.",
    category: "cidade",
    neighborhood: "gloria",
    authors: ["carlos-menezes"],
    tags: ["feira", "obras"],
    hoursAgo: 18,
    imageAlt: "Barracas de feira livre com frutas e verduras",
    paragraphs: [
      "A tradicional feira de domingo da Glória vai mudar de lugar a partir de novembro. As barracas passam a ocupar a Rua do Russel enquanto a praça passa por reforma.",
      "A mudança deve durar cerca de seis meses, segundo a subprefeitura da Zona Sul.",
    ],
    views: { day: 1900, week: 6600, total: 6600 },
  },
  {
    slug: "projeto-social-do-vidigal-leva-aulas-de-surfe",
    video: true,
    title: "Projeto social do Vidigal leva aulas de surfe para crianças",
    summary: "Iniciativa de moradores atende 60 crianças e busca doações de pranchas.",
    category: "comunidade",
    neighborhood: "vidigal",
    authors: ["ana-ribeiro"],
    tags: ["praia"],
    hoursAgo: 22,
    imageAlt: "Crianças com pranchas de surfe na areia",
    paragraphs: [
      "Um grupo de moradores do Vidigal criou um projeto que oferece aulas gratuitas de surfe para crianças da comunidade, nas manhãs de sábado.",
      "Hoje são 60 alunos. O projeto aceita doações de pranchas e roupas de neoprene para ampliar o número de vagas.",
    ],
    views: { day: 1200, week: 7400, total: 7400 },
  },
  {
    slug: "mutirao-de-saude-na-rocinha",
    title: "Mutirão de saúde na Rocinha oferece exames gratuitos neste sábado",
    summary: "Atendimento inclui vacinação, testes rápidos e consultas de clínica geral.",
    category: "comunidade",
    neighborhood: "rocinha",
    authors: ["juliana-prado"],
    tags: ["saude"],
    hoursAgo: 26,
    imageAlt: "Profissional de saúde atendendo morador em tenda",
    paragraphs: [
      "Um mutirão de saúde vai funcionar neste sábado, das 8h às 16h, na quadra principal da Rocinha.",
      "Serão oferecidos vacinação, testes rápidos de glicemia e pressão e consultas de clínica geral. Basta levar documento com foto.",
    ],
    views: { day: 900, week: 5200, total: 5200 },
  },
  {
    slug: "procura-por-aluguel-em-laranjeiras-cresce",
    title: "Procura por aluguel em Laranjeiras cresce 15% em um ano",
    summary: "Bairro atrai famílias pela oferta de apartamentos maiores e preço abaixo da orla.",
    category: "economia",
    neighborhood: "laranjeiras",
    authors: ["carlos-menezes"],
    tags: [],
    hoursAgo: 30,
    imageAlt: "Fachada de prédio residencial antigo",
    paragraphs: [
      "A procura por imóveis para alugar em Laranjeiras cresceu 15% nos últimos 12 meses, segundo levantamento de imobiliárias da região.",
      "O preço médio do metro quadrado ainda fica abaixo do praticado em Copacabana e Ipanema, o que tem atraído famílias.",
    ],
    views: { day: 600, week: 3300, total: 3300 },
  },
  {
    slug: "bares-do-leblon-lancam-circuito-de-petiscos",
    title: "Bares do Leblon lançam circuito de petiscos com preços populares",
    summary: "Até o fim do mês, 20 bares oferecem um petisco especial por R$ 25.",
    category: "gastronomia",
    neighborhood: "leblon",
    authors: ["juliana-prado"],
    tags: ["cultura"],
    hoursAgo: 34,
    imageAlt: "Petiscos e copos de chope sobre mesa de bar",
    paragraphs: [
      "Vinte bares do Leblon participam até o fim do mês de um circuito gastronômico com petiscos a R$ 25.",
      "O público pode votar no melhor petisco por QR Code disponível nas mesas.",
    ],
    views: { day: 800, week: 4100, total: 4100 },
  },
  {
    slug: "pao-de-acucar-tera-horario-estendido-no-feriado",
    video: true,
    title: "Pão de Açúcar terá horário estendido no feriado",
    summary: "Bondinho funciona até meia-noite e terá programação musical no Morro da Urca.",
    category: "eventos",
    neighborhood: "urca",
    authors: ["redacao"],
    tags: ["cultura"],
    hoursAgo: 40,
    imageAlt: "Bondinho do Pão de Açúcar ao entardecer",
    paragraphs: [
      "O Parque Bondinho Pão de Açúcar vai funcionar em horário estendido, até a meia-noite, durante o feriado.",
      "Haverá apresentações musicais no Morro da Urca a partir das 19h.",
    ],
    views: { day: 500, week: 3600, total: 3600 },
  },
  {
    slug: "praca-do-humaita-ganha-nova-iluminacao",
    title: "Praça do Humaitá ganha nova iluminação e academia ao ar livre",
    summary: "Obra entregue nesta semana também recuperou bancos e o parquinho infantil.",
    category: "cidade",
    neighborhood: "humaita",
    authors: ["carlos-menezes"],
    tags: ["obras"],
    hoursAgo: 46,
    imageAlt: "Praça arborizada com aparelhos de ginástica",
    paragraphs: [
      "A prefeitura entregou nesta semana a reforma de uma praça no Humaitá, com nova iluminação em LED, academia ao ar livre e parquinho recuperado.",
      "Moradores pedem agora a instalação de bebedouros e mais lixeiras.",
    ],
    views: { day: 300, week: 2200, total: 2200 },
  },
  {
    slug: "operacao-fecha-deposito-de-fogos-em-botafogo",
    title: "Operação fecha depósito clandestino de fogos em Botafogo",
    summary: "Bombeiros apreenderam cerca de 200 kg de material em um galpão residencial.",
    category: "seguranca",
    neighborhood: "botafogo",
    authors: ["ana-ribeiro", "redacao"],
    tags: ["policia-militar"],
    hoursAgo: 52,
    imageAlt: "Caixas apreendidas em galpão sendo retiradas por agentes",
    paragraphs: [
      "Uma operação conjunta da polícia e do Corpo de Bombeiros fechou um depósito clandestino de fogos de artifício em Botafogo.",
      "Cerca de 200 kg de material foram apreendidos. O responsável pelo imóvel vai responder por armazenamento irregular de explosivos.",
    ],
    views: { day: 400, week: 6900, total: 6900 },
  },
  {
    slug: "linhas-de-onibus-da-zona-sul-mudam-itinerario",
    title: "Linhas de ônibus da Zona Sul mudam itinerário a partir de segunda",
    summary: "Seis linhas passam a circular pela Rua Barata Ribeiro; veja a lista.",
    category: "transito",
    neighborhood: "copacabana",
    authors: ["rafael-duarte"],
    tags: ["onibus"],
    hoursAgo: 60,
    imageAlt: "Ônibus urbano parado em ponto de embarque",
    paragraphs: [
      "Seis linhas de ônibus que atendem Copacabana vão mudar de itinerário a partir de segunda-feira e passam a circular pela Rua Barata Ribeiro.",
      "A Secretaria de Transportes afirma que a mudança reduz o tempo de viagem em horários de pico.",
    ],
    views: { day: 350, week: 5800, total: 5800 },
  },
  {
    slug: "audiencia-publica-discute-comercio-na-orla",
    title: "Audiência pública discute ordenamento do comércio na orla",
    summary: "Ambulantes e quiosqueiros pedem regras claras antes do verão.",
    category: "politica",
    neighborhood: "copacabana",
    authors: ["juliana-prado"],
    tags: ["orla", "praia"],
    hoursAgo: 70,
    imageAlt: "Quiosques na calçada da praia",
    paragraphs: [
      "Uma audiência pública na Câmara reuniu ambulantes, quiosqueiros e moradores para discutir o ordenamento do comércio na orla da Zona Sul.",
      "O principal pedido é que as regras de licenciamento sejam definidas antes do início da temporada de verão.",
    ],
    views: { day: 200, week: 2700, total: 2700 },
  },
  {
    slug: "moradores-da-gavea-cobram-poda-de-arvores",
    title: "Moradores da Gávea cobram poda de árvores após queda de galho",
    summary: "Galho atingiu um carro estacionado; ninguém se feriu.",
    category: "cidade",
    neighborhood: "gavea",
    authors: ["carlos-menezes"],
    tags: ["chuva"],
    hoursAgo: 80,
    imageAlt: "Galho de árvore caído sobre carro estacionado",
    paragraphs: [
      "A queda de um galho sobre um carro estacionado reacendeu a cobrança de moradores da Gávea por poda preventiva das árvores do bairro.",
      "A Comlurb informou que a vistoria na rua está agendada para a próxima semana.",
    ],
    views: { day: 150, week: 2400, total: 2400 },
  },
  {
    slug: "biblioteca-comunitaria-do-catete-completa-10-anos",
    title: "Biblioteca comunitária do Catete completa 10 anos com programação especial",
    summary: "Espaço mantido por voluntários tem 8 mil livros e oferece oficinas de leitura.",
    category: "comunidade",
    neighborhood: "catete",
    authors: ["ana-ribeiro"],
    tags: ["cultura"],
    hoursAgo: 96,
    imageAlt: "Estantes de livros em sala iluminada",
    paragraphs: [
      "A biblioteca comunitária do Catete completa dez anos neste mês com uma semana de oficinas, contação de histórias e troca de livros.",
      "O acervo de 8 mil títulos foi formado inteiramente por doações.",
    ],
    views: { day: 100, week: 1800, total: 1800 },
  },
  {
    slug: "jardim-botanico-abre-exposicao-de-orquideas",
    title: "Jardim Botânico abre exposição de orquídeas raras",
    summary: "Mostra reúne 300 espécies e fica aberta até o fim de novembro.",
    category: "eventos",
    neighborhood: "jardim-botanico",
    authors: ["juliana-prado"],
    tags: ["cultura"],
    hoursAgo: 110,
    imageAlt: "Orquídeas coloridas em exposição",
    paragraphs: [
      "O Jardim Botânico do Rio abriu uma exposição com 300 espécies de orquídeas, incluindo exemplares raros da Mata Atlântica.",
      "A visitação está incluída no ingresso do parque e segue até o fim de novembro.",
    ],
    views: { day: 90, week: 3000, total: 3000 },
  },
  {
    slug: "praia-de-sao-conrado-liberada-para-banho",
    title: "Praia de São Conrado é liberada para banho após três semanas",
    summary: "Boletim de balneabilidade aponta água própria em todos os pontos medidos.",
    category: "cidade",
    neighborhood: "sao-conrado",
    authors: ["redacao"],
    tags: ["praia"],
    hoursAgo: 130,
    imageAlt: "Praia com mar calmo e montanhas ao fundo",
    paragraphs: [
      "O boletim de balneabilidade mais recente classificou como própria para banho a água de todos os pontos de São Conrado, após três semanas de restrição.",
      "Banhistas devem evitar o mar nas 24 horas seguintes a chuvas fortes.",
    ],
    views: { day: 60, week: 2900, total: 2900 },
  },
  {
    slug: "quiosques-do-leme-ganham-cardapio-de-verao",
    title: "Quiosques do Leme lançam cardápio de verão com frutos do mar",
    summary: "Novidade inclui pastel de camarão, moqueca no pote e drinques sem álcool.",
    category: "gastronomia",
    neighborhood: "leme",
    authors: ["redacao"],
    tags: ["orla", "praia"],
    hoursAgo: 150,
    sponsor: { name: "Associação dos Quiosques do Leme" },
    imageAlt: "Quiosque de praia com mesas e guarda-sóis",
    paragraphs: [
      "Os quiosques do Leme apresentam o cardápio de verão com opções de frutos do mar e drinques sem álcool.",
      "Os pratos estarão disponíveis a partir de dezembro em todos os quiosques associados.",
    ],
    views: { day: 40, week: 1500, total: 1500 },
  },
  {
    slug: "cameras-de-monitoramento-no-cosme-velho",
    title: "Cosme Velho recebe 20 câmeras de monitoramento ligadas ao COR",
    summary: "Equipamentos cobrem acessos ao bairro e a área do Largo do Boticário.",
    category: "seguranca",
    neighborhood: "cosme-velho",
    authors: ["rafael-duarte"],
    tags: ["policia-militar"],
    hoursAgo: 170,
    imageAlt: "Câmera de segurança instalada em poste",
    paragraphs: [
      "A prefeitura instalou 20 câmeras de monitoramento no Cosme Velho, ligadas ao Centro de Operações Rio (COR).",
      "As imagens podem ser usadas pelas polícias mediante solicitação formal.",
    ],
    views: { day: 30, week: 1300, total: 21000 },
  },
];

function hoursBefore(hours: number): string {
  return new Date(MOCK_NOW.getTime() - hours * 3_600_000).toISOString();
}

function readingTime(paragraphs: string[]): number {
  const words = paragraphs
    .join(" ")
    .replace(/<[^>]+>/g, "")
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function buildVideo(seed: Seed): VideoEmbed | undefined {
  if (!seed.video) return undefined;
  return seed.origin === "INSTAGRAM"
    ? { provider: "instagram", url: `https://www.instagram.com/reel/mock-${seed.slug}/` }
    : {
        provider: "r2",
        url: `https://media.example.com/video/${seed.slug}.mp4`,
        durationSeconds: 48,
      };
}

function buildNews(seed: Seed, index: number): Omit<News, "related"> {
  const neighborhood = seed.neighborhood ? findNeighborhood(seed.neighborhood) : undefined;
  return {
    id: mockId(10, index + 1),
    slug: seed.slug,
    title: seed.title,
    subtitle: seed.subtitle,
    summary: seed.summary,
    category: findCategory(seed.category),
    location: { city, neighborhood },
    image: {
      id: mockId(11, index + 1),
      url: `https://picsum.photos/seed/${seed.slug}/1200/675`,
      width: 1200,
      height: 675,
      alt: seed.imageAlt,
      credit: seed.origin === "INSTAGRAM" ? "Reprodução/Instagram" : "Foto: Divulgação",
    },
    hasVideo: Boolean(seed.video),
    isUrgent: Boolean(seed.urgent),
    isSponsored: Boolean(seed.sponsor),
    publishedAt: hoursBefore(seed.hoursAgo),
    updatedAt: seed.updatedHoursAgo !== undefined ? hoursBefore(seed.updatedHoursAgo) : undefined,
    authors: seed.authors.map(findAuthor),
    tags: seed.tags.map(findTag),
    body: [
      { type: "paragraph", html: seed.paragraphs[0] },
      ...(seed.quote
        ? [{ type: "quote" as const, text: seed.quote.text, source: seed.quote.source }]
        : []),
      ...seed.paragraphs.slice(1).map((html) => ({ type: "paragraph" as const, html })),
    ],
    video: buildVideo(seed),
    sponsor: seed.sponsor,
    readingTimeMinutes: readingTime(seed.paragraphs),
    origin: seed.origin ?? "MANUAL",
  };
}

export function toSummary(news: Omit<News, "related"> | News): NewsSummary {
  return {
    id: news.id,
    slug: news.slug,
    title: news.title,
    subtitle: news.subtitle,
    summary: news.summary,
    category: news.category,
    location: news.location,
    image: news.image,
    hasVideo: news.hasVideo,
    isUrgent: news.isUrgent,
    isSponsored: news.isSponsored,
    publishedAt: news.publishedAt,
    updatedAt: news.updatedAt,
  };
}

const built = seeds.map(buildNews);

/** Notícias completas, da mais recente para a mais antiga. */
export const newsMock: News[] = built
  .map((news) => ({
    ...news,
    // Relacionadas: mesma editoria primeiro, depois as mais recentes.
    related: [
      ...built.filter((n) => n.id !== news.id && n.category.id === news.category.id),
      ...built.filter((n) => n.id !== news.id && n.category.id !== news.category.id),
    ]
      .slice(0, 4)
      .map(toSummary),
  }))
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

/** Posição no destaque editorial da home, por slug. */
export const featuredRank = new Map(
  seeds.filter((s) => s.featured).map((s) => [s.slug, s.featured as number]),
);

/** Visualizações simuladas por slug. */
export const viewsBySlug = new Map(seeds.map((s) => [s.slug, s.views]));
