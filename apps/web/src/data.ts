// TAXONOMIA/CONTRATO — onde cada skill se encaixa: agente (resposta|acao) · modulo · feature · integracao · regra.
// Lei do projeto em ARQUITETURA.md (raiz do motor-metrik-os). LEIA antes de adicionar tipos/agentes/upgrades aqui.
import {
  Activity,
  Bot,
  Radio,
  Blocks,
  Plug,
  Headphones,
  Columns3,
  CalendarClock,
  HeartPulse,
  ScanSearch,
  Radar,
  FileSignature,
  Sparkles,
  BookOpen,
  MessageCircleHeart,
  Volume2,
  TrendingUp,
  CalendarX,
  BellRing,
  Filter,
  Webhook,
  Clock,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Gavel,
  SquarePen,
  Scale,
  UsersRound,
  Check,
  ShieldCheck,
  X,
} from "lucide-react";

// Conversas e Follow-up NÃO são abas do app: são o KIT DO AGENTE (moram dentro
// de cada robô de resposta; o follow é MÓDULO que se ativa). Lei do mestre.
export type ViewId = "inicio" | "agentes" | "aovivo" | "modulos" | "conexoes" | "admin";

export const NAV: { id: ViewId; label: string; icon: any; hint: string }[] = [
  { id: "inicio", label: "Início", icon: Activity, hint: "Estado da operação" },
  { id: "agentes", label: "Agentes", icon: Bot, hint: "Sua frota de agentes" },
  { id: "aovivo", label: "Ao vivo", icon: Radio, hint: "O que acontece agora" },
  { id: "modulos", label: "Módulos", icon: Blocks, hint: "Novas habilidades" },
  { id: "conexoes", label: "Conexões", icon: Plug, hint: "WhatsApp, CRM e agenda" },
  { id: "admin", label: "Admin", icon: UsersRound, hint: "Conta e acessos" },
];

export type AgentState = "ativo" | "idle" | "pausado";

export type Feature = {
  name: string;
  icon: any;
  fonte: "metrik" | "mcp";
  on: boolean;
};

export type LiveRow = {
  t: string;
  acao: string;
  status: "ok" | "erro" | "run";
  detalhe?: string;
  /** o veredito honesto conferido na hora — quando o log já traz a conferência */
  conferencia?: Conferencia;
};

/**
 * O SELO honesto de cada execução — conferido na HORA, sem custo, sem juiz-LLM.
 * MVP com 4 selos; "Desviou" (encostou numa trava) entra quando houver a lista de
 * travas curada por área. A nota 0–10 de qualidade NUNCA mora aqui — só no fecho
 * do dia (1×/dia) e no ensaio do Melhorar (sob demanda).
 */
export type Selo = "seguiu" | "segurou" | "conversou" | "falhou";
export type Conferencia = {
  veredito: Selo;
  /** a regra que ele deveria seguir (do mapa), quando há uma pra conferir */
  regra?: string;
  /** o porquê em português — só quando segurou de propósito ou falhou */
  porque?: string;
  /** procedência: pego na hora (trava determinística) ou achado da análise das 8h */
  fonte?: "na-hora" | "analise";
  /** os checks determinísticos, pro bloco "Seguiu a regra?" na ConversaDrawer */
  checks?: { ok: boolean; label: string }[];
};

export const SELO_META: Record<Selo, { label: string; cor: string; icon: any }> = {
  seguiu: { label: "Seguiu a regra", cor: "#3fb950", icon: Check },
  segurou: { label: "Segurou de propósito", cor: "#58aae4", icon: ShieldCheck },
  conversou: { label: "Conversou", cor: "#8a94a4", icon: MessageCircleHeart },
  falhou: { label: "Falhou", cor: "#f85149", icon: X },
};

// Deriva o selo honesto: se o log já traz a conferência real, usa; senão só o que
// dá pra provar de graça — erro = Falhou; o resto fica "Conversou" (registrado),
// NUNCA um verde falso. Verde/azul só vêm de conferência real (travas do ramo).
export function conferir(row: { status: "ok" | "erro" | "run"; conferencia?: Conferencia }): Conferencia {
  if (row.conferencia) return row.conferencia;
  if (row.status === "erro") return { veredito: "falhou" };
  return { veredito: "conversou" };
}

export type SimStep = { label: string; ok: boolean };

export type Insight = {
  tipo: "elogio" | "critico" | "dica";
  titulo: string;
  texto: string;
  prova?: string;
  ganho?: string;
};

export type Upgrade = {
  name: string;
  icon: any;
  blurb: string;
  onde: string;
  sinergia?: string;
  config?: { pergunta: string; opcoes: string[] }[];
  resultado?: string;
  criterio?: string;
};

export type WorkKind = "agenda" | "followups" | "contratos" | "conhecimento" | "acoes" | "lista";
export type Work = {
  kind: WorkKind;
  label: string;
  agenda?: { quando: string; quem: string; canal?: string; status: "confirmado" | "aguardando" }[];
  followups?: { quem: string; toque: string; quando: string; status: "feito" | "agendado" | "agora" }[];
  contratos?: { quem: string; valor: string; status: "assinado" | "enviado" | "vencendo" | "expirado"; prazo?: string }[];
  conhecimento?: { cat: string; titulo: string }[];
  acoes?: { gatilho: string; alvo: string; feito: number; log: { quem: string; quando: string; ok: boolean }[] };
  lista?: { titulo: string; itens: { a: string; b: string }[] };
};

export type Passo = {
  label: string;
  deveria: string;
  status: "ok" | "falha" | "espera";
  porque?: string;
  sugestao?: string;
  /** o que este passo TOCA no CRM/fora — deixa claro etapa × campo × integração */
  alvo?: { tipo: "etapa" | "campo" | "integracao" | "canal" | "documento"; nome: string };
};

/**
 * O MAPA do agente — a leitura clara de "o que essa IA faz, ramo por ramo".
 * NÃO é desenhado à mão: é COMPILADO do cérebro (prompt) pela fábrica; a tela
 * se desenha sozinha a partir daqui. Cliente diferente = mapa diferente, tela igual.
 */
export type Regra = {
  /** a condição, em português de gente: "renda da casa acima de R$ 1.518" */
  se: string;
  /** o que a IA faz quando a condição bate */
  entao: string;
  /** a fala LITERAL que a IA usa (mata a dúvida "o que ela diz?") */
  diz?: string;
  /** pra onde move no funil / o que dispara */
  move?: string;
  /** chama humano / avisa o grupo */
  aviso?: boolean;
  /** marca de mudança da Escola ("ajustada há 2 dias — antes fazia X") */
  mudou?: string;
};

export type Ramo = {
  id: string;
  nome: string;
  cor: string;
  /** gatilho: quando a conversa entra neste ramo */
  quando: string;
  /** o que a IA pergunta/coleta neste ramo */
  coleta?: string[];
  regras: Regra[];
  on: boolean;
  /** vem do Flight Recorder (meta.ramo) quando real; demo enquanto não */
  execucoesHoje?: number;
  ultima?: string;
};

/**
 * Uma MUDANÇA que entrou no agente — o que o cliente adora observar.
 * Conta a história completa: o pedido (na fala dele) → antes/agora → ONDE
 * encaixou no processo → a prova do porteiro (evals) → status.
 */
export type Mudanca = {
  quando: string;
  origem: "voce" | "metrik" | "escola";
  /** o pedido, na fala do cliente */
  pedido: string;
  /** antes/agora: a Metrik preenche ao publicar (mudança recém-pedida ainda não tem) */
  antes?: string;
  agora?: string;
  /** onde encaixou: o caminho e a situação exata (casa com Regra.se) */
  ramoId?: string;
  situacao?: string;
  /** a prova do porteiro: casos que passaram + nota */
  porteiro?: { nota: string; casos: string; taxa?: number };
  status: "no ar" | "em teste" | "aguardando aprovação";
};

export type Mapa = {
  entrada: string;
  triagem: { faz: string; coleta?: string[] };
  ramos: Ramo[];
  aposRamos?: string;
  /** mudanças recentes — aparecem marcadas no processo E contadas em detalhe */
  mudancas?: Mudanca[];
};

export type Agent = {
  id: string;
  name: string;
  glyph: any;
  papel: string;
  state: AgentState;
  color: string;
  agora: string;
  metrics: { execucoes: number; acertos: number; erros: number; custo: string };
  shield: string;
  features: Feature[];
  live: LiveRow[];
  simCenario: string;
  sim: SimStep[];
  insights?: Insight[];
  upgrades?: Upgrade[];
  tipo?: "resposta" | "acao";
  work?: Work;
  expectativa?: string;
  integracoes?: string[];
  fluxo?: Passo[];
  /** true quando o agente veio do banco (Neon), não do mock de demonstração. */
  real?: boolean;
  /** versão do spec publicado (0 = sem publicação ainda). */
  version?: number;
  /** o mapa de decisão (compilado do cérebro) — quando existe, vira a 1ª aba */
  mapa?: Mapa;
};

export const AGENTS: Agent[] = [
  {
    id: "atendente",
    name: "Atendente",
    glyph: Headphones,
    papel: "Responde e vende no WhatsApp, 24 horas",
    tipo: "resposta",
    work: {
      kind: "conhecimento",
      label: "Base de conhecimento",
      conhecimento: [
        { cat: "Planos", titulo: "Plano Start — R$ 497/mês" },
        { cat: "Planos", titulo: "Plano Pro — R$ 997/mês" },
        { cat: "Objeções", titulo: "“Tá caro” → foco no ROI" },
        { cat: "Processo", titulo: "Como funciona o onboarding" },
        { cat: "Horário", titulo: "Atende seg–sex, 9h–18h" },
      ],
    },
    state: "ativo",
    color: "#58aae4",
    mapa: {
      entrada: "Lead chama no WhatsApp",
      triagem: { faz: "Entende em 1–2 perguntas o que a pessoa quer", coleta: ["o que procura", "urgência", "já é cliente?"] },
      ramos: [
        {
          id: "comprar", nome: "Quer contratar", cor: "#3fb950",
          quando: "pergunta de plano, preço ou como funciona",
          coleta: ["tamanho da operação", "prazo pra começar"],
          on: true, execucoesHoje: 9, ultima: "Há 4 min · Marina A.",
          regras: [
            { se: "demonstra interesse e responde a qualificação", entao: "apresenta o plano certo e oferece reunião", diz: "Pelo que você me contou, o Pro resolve seu caso. Quer que eu já marque 20 min com o especialista?", move: "→ etapa “Qualificada”" },
            { se: "pede preço antes de qualificar", entao: "segura o preço e faz 1 pergunta primeiro", diz: "Te passo certinho! Só me conta rapidinho: quantas pessoas atendem hoje?", mudou: "ajustada há 2 dias pela Escola — antes soltava a tabela inteira" },
          ],
        },
        {
          id: "cliente", nome: "Já é cliente", cor: "#58aae4",
          quando: "menciona problema, acesso ou suporte",
          on: true, execucoesHoje: 3, ultima: "Há 1 h · Studio Lumen",
          regras: [
            { se: "é dúvida simples que está na base", entao: "responde na hora com a base de conhecimento" },
            { se: "é problema técnico de verdade", entao: "abre o chamado e avisa o time no grupo", move: "→ funil “Suporte”", aviso: true },
          ],
        },
        {
          id: "fora", nome: "Fora do horário", cor: "#fbbf24",
          quando: "mensagem chega fora do horário comercial",
          on: true, execucoesHoje: 2,
          regras: [
            { se: "chega mensagem às 22h", entao: "avisa o horário e agenda o retorno pra manhã", diz: "A gente responde a partir das 9h — posso te chamar logo cedo?", move: "→ tarefa de retorno 9h" },
          ],
        },
      ],
      aposRamos: "Todo caminho termina em reunião marcada, dúvida resolvida ou humano avisado, sempre na etapa certa do funil.",
      mudancas: [
        {
          quando: "há 2 dias",
          origem: "voce",
          pedido: "Não solta a tabela de preço de cara — qualifica primeiro.",
          antes: "Mandava a tabela inteira assim que pediam preço.",
          agora: "Segura o preço, faz 1 pergunta de qualificação e só então apresenta o plano certo.",
          ramoId: "comprar",
          situacao: "pede preço antes de qualificar",
          porteiro: { nota: "9,4", casos: "10/10 casos passaram" },
          status: "no ar",
        },
      ],
    },
    agora: "Oferecendo quinta às 14h para a Marina",
    fluxo: [
      { label: "Recebe a mensagem", deveria: "todo lead que chama no WhatsApp", status: "ok" },
      { label: "Entende o pedido", deveria: "lê texto, áudio, imagem e PDF", status: "ok" },
      { label: "Responde e qualifica", deveria: "responde em segundos e descobre o que precisa", status: "ok" },
      { label: "Passa adiante", deveria: "entrega pro Agendador quando está pronto", status: "ok" },
    ],
    expectativa: "Responde todo lead no WhatsApp em segundos, qualifica e passa adiante. Não responde fora do horário.",
    metrics: { execucoes: 212, acertos: 206, erros: 2, custo: "R$ 6,12" },
    shield: "O jeito de qualificar e a política de desconto são blindados. Você muda o tom, não a regra.",
    insights: [
      { tipo: "elogio", titulo: "Acerto alto", texto: "O acerto foi de 99% nas últimas 200 conversas.", prova: "Houve só 2 erros, ambos fora do horário. A trava segurou os dois envios." },
      { tipo: "critico", titulo: "2 mensagens seguradas às 22h", texto: "O lead esperou até a manhã seguinte. A correção sugerida é uma resposta automática fora do horário.", ganho: "menos lead esfriando" },
    ],
    upgrades: [
      { name: "Resposta fora do horário", icon: Clock, blurb: "Avisa o horário comercial e agenda o retorno.", onde: "entra no motor de Atendimento", sinergia: "combina com a Agenda", config: [{ pergunta: "Horário comercial", opcoes: ["9h–18h", "8h–20h"] }, { pergunta: "O que fazer fora do horário", opcoes: ["Avisar e agendar retorno", "Avisar que responde amanhã"] }], resultado: "Responde que o horário comercial acabou e oferece um horário para amanhã.", criterio: "vale fora do horário comercial que você definir acima" },
      { name: "Detector de compra", icon: TrendingUp, blurb: "Destaca o lead quando ele fica quente.", onde: "muda a prioridade da fila", sinergia: "avisa o Handoff", resultado: "Põe o lead no topo da fila e avisa o Handoff para um humano entrar.", criterio: "quente = pediu preço, respondeu em menos de 10 min e falou em “fechar”, “contratar” ou “valor”" },
    ],
    features: [
      { name: "Ouve áudio e lê imagem/PDF", icon: Volume2, fonte: "metrik", on: true },
      { name: "Base de conhecimento", icon: BookOpen, fonte: "metrik", on: true },
      { name: "Tom mais próximo", icon: MessageCircleHeart, fonte: "mcp", on: true },
      { name: "Enriquecer o lead", icon: Sparkles, fonte: "metrik", on: false },
    ],
    live: [
      { t: "agora", acao: "Respondeu Marina e ofereceu horário", status: "run", detalhe: "Quinta 14h" },
      { t: "2 min", acao: "Leu um áudio de 0:38 e entendeu a dúvida", status: "ok" },
      { t: "6 min", acao: "Tentou responder fora do horário comercial", status: "erro", detalhe: "Regra segurou o envio" },
      { t: "11 min", acao: "Qualificou lead e passou pro Agendador", status: "ok" },
    ],
    simCenario: "Lead pergunta o preço antes de ser qualificado",
    sim: [
      { label: "Não solta o preço cheio de cara", ok: true },
      { label: "Faz 1 pergunta de qualificação antes", ok: true },
      { label: "Oferece o plano certo pro caso dele", ok: true },
      { label: "Fecha com convite pra reunião", ok: false },
    ],
  },
  {
    id: "qualificador",
    name: "Qualificador",
    glyph: Columns3,
    papel: "Organiza cada lead no funil certo",
    tipo: "resposta",
    work: {
      kind: "lista",
      label: "Qualificados",
      lista: {
        titulo: "Qualificados hoje",
        itens: [
          { a: "Marina Alves", b: "Quente" },
          { a: "Rodrigo Pinto", b: "Quente" },
          { a: "Júlia Bastos", b: "Morno" },
          { a: "Empresa Vega", b: "Quente" },
        ],
      },
    },
    state: "ativo",
    color: "#3b82f6",
    agora: "Movendo 3 leads para a etapa “Qualificada”",
    fluxo: [
      { label: "Lê a conversa", deveria: "Roda a cada lead novo.", status: "ok" },
      { label: "Descobre o que falta", deveria: "Só qualifica com o mínimo de informação.", status: "ok" },
      { label: "Preenche o card", deveria: "Grava campos e origem sem duplicar o card.", status: "ok" },
      { label: "Move a etapa", deveria: "O lead vai para a etapa “Qualificada”.", status: "ok" },
    ],
    metrics: { execucoes: 188, acertos: 185, erros: 0, custo: "R$ 3,04" },
    shield: "As etapas e os campos obrigatórios são blindados. Você renomeia rótulo, não quebra o funil.",
    insights: [
      { tipo: "elogio", titulo: "Funil completo", texto: "Nenhum card saiu com campo em branco hoje.", prova: "185 de 185 cards saíram preenchidos." },
      { tipo: "dica", titulo: "Qualificação por porte", texto: "Com uma pergunta sobre o tamanho da empresa, o agente separa B2B de B2C.", ganho: "+8% de reunião qualificada" },
    ],
    upgrades: [
      { name: "Score por porte", icon: TrendingUp, blurb: "Separa empresa grande de empresa pequena.", onde: "adiciona 1 campo e 1 critério", sinergia: "alimenta o Agendador", config: [{ pergunta: "Critério de porte", opcoes: ["Nº de funcionários", "Faturamento"] }] },
      { name: "Anti-duplicado", icon: Columns3, blurb: "Impede dois cards para o mesmo lead.", onde: "roda antes de criar a oportunidade" },
    ],
    features: [
      { name: "Preenche campos sozinho", icon: Sparkles, fonte: "metrik", on: true },
      { name: "Detecta origem do lead", icon: Radar, fonte: "metrik", on: true },
      { name: "Score de intenção", icon: TrendingUp, fonte: "mcp", on: true },
    ],
    live: [
      { t: "agora", acao: "Moveu Rodrigo pra “Qualificada”", status: "run" },
      { t: "4 min", acao: "Preencheu 6 campos do card sem erro", status: "ok" },
      { t: "9 min", acao: "Marcou a origem como Instagram Ads", status: "ok" },
    ],
    simCenario: "Lead sem informação suficiente pra qualificar",
    sim: [
      { label: "Não força etapa sem dado mínimo", ok: true },
      { label: "Faz a pergunta que falta", ok: true },
      { label: "Deixa o card rastreável", ok: true },
      { label: "Não duplica oportunidade", ok: true },
    ],
  },
  {
    id: "agendador",
    name: "Agendador",
    glyph: CalendarClock,
    papel: "Oferece horário e marca a reunião",
    tipo: "resposta",
    work: {
      kind: "agenda",
      label: "Agenda",
      agenda: [
        { quando: "Hoje 16:00", quem: "Marina Alves", canal: "Meet", status: "confirmado" },
        { quando: "Sex 10:00", quem: "Rodrigo Pinto", canal: "Meet", status: "confirmado" },
        { quando: "Sex 15:30", quem: "Júlia Bastos", canal: "Ligação", status: "aguardando" },
        { quando: "Seg 11:00", quem: "Empresa Vega", canal: "Presencial", status: "confirmado" },
      ],
    },
    state: "ativo",
    color: "#7c9fe0",
    agora: "Confirmando sexta às 10h com o Rodrigo",
    fluxo: [
      { label: "Vê que o lead está pronto", deveria: "Roda quando o lead demonstra interesse.", status: "ok" },
      { label: "Oferece horário livre", deveria: "Lê a agenda real e evita choque de horário.", status: "ok" },
      { label: "Confirma", deveria: "Só grava depois do “ok” do lead.", status: "ok" },
      { label: "Marca e avisa o time", deveria: "O evento entra na agenda e o responsável recebe o aviso.", status: "ok" },
    ],
    expectativa: "Quando o lead está pronto, oferece um horário livre e grava a reunião na agenda, avisando o time.",
    integracoes: ["Google Agenda"],
    metrics: { execucoes: 74, acertos: 73, erros: 0, custo: "R$ 1,89" },
    shield: "A agenda e a janela de horários são blindadas. Você ajusta a duração, não a fonte da verdade.",
    insights: [
      { tipo: "elogio", titulo: "Agenda cheia", texto: "Hoje foram marcadas 5 reuniões, sem conflito.", prova: "Todas foram confirmadas antes de gravar." },
      { tipo: "dica", titulo: "Lembrete antes da reunião", texto: "Um lembrete 1h antes costuma reduzir o no-show.", ganho: "-20% de falta" },
    ],
    upgrades: [
      { name: "Lembrete 1h antes", icon: BellRing, blurb: "Reduz a falta em reunião.", onde: "entra no motor de Agenda", sinergia: "combina com o Recuperador", config: [{ pergunta: "Agenda", opcoes: ["Google Agenda", "Outlook"] }, { pergunta: "Antecedência", opcoes: ["1h antes", "3h antes", "1 dia antes"] }, { pergunta: "Canal", opcoes: ["WhatsApp", "E-mail"] }] },
      { name: "Reagendar sozinho", icon: CalendarClock, blurb: "Remarca a reunião quando há conflito.", onde: "muda o comportamento de conflito" },
    ],
    features: [
      { name: "Lê a agenda real", icon: CalendarClock, fonte: "metrik", on: true },
      { name: "Avisa o time ao marcar", icon: BellRing, fonte: "metrik", on: true },
      { name: "Lembrete 1h antes", icon: CalendarClock, fonte: "mcp", on: false },
    ],
    live: [
      { t: "agora", acao: "Ofereceu 3 horários livres", status: "run" },
      { t: "8 min", acao: "Criou evento e avisou o time", status: "ok", detalhe: "Sexta 10h" },
      { t: "22 min", acao: "Reagendou por conflito de horário", status: "ok" },
    ],
    simCenario: "Lead pede um horário que já está ocupado",
    sim: [
      { label: "Não marca em cima de outro evento", ok: true },
      { label: "Oferece o horário livre mais perto", ok: true },
      { label: "Confirma antes de gravar na agenda", ok: true },
      { label: "Avisa o responsável certo", ok: true },
    ],
  },
  {
    id: "recuperador",
    name: "Recuperador",
    glyph: HeartPulse,
    papel: "Chama de volta quem sumiu ou faltou",
    tipo: "resposta",
    work: {
      kind: "followups",
      label: "Follow-ups",
      followups: [
        { quem: "Beatriz · Vega", toque: "2º toque", quando: "agora", status: "agora" },
        { quem: "Carlos Nunes", toque: "1º toque", quando: "em 4 h", status: "agendado" },
        { quem: "Marina Alves", toque: "3º toque", quando: "amanhã 9h", status: "agendado" },
        { quem: "João Prado", toque: "1º toque", quando: "ontem", status: "feito" },
      ],
    },
    state: "ativo",
    color: "#3fb950",
    agora: "Reabrindo 2 conversas que esfriaram",
    fluxo: [
      { label: "Percebe que sumiu", deveria: "Roda quando o lead para de responder.", status: "ok" },
      { label: "Espera o tempo certo", deveria: "Faz os toques em 6h, 24h e 72h.", status: "ok" },
      { label: "Chama de volta", deveria: "Usa tom leve e reoferece a reunião.", status: "ok" },
      { label: "Respeita o limite", deveria: "Para no 3º toque ou quando o lead responde.", status: "espera" },
    ],
    metrics: { execucoes: 46, acertos: 41, erros: 1, custo: "R$ 1,12" },
    shield: "A cadência e o limite de toques são blindados pra não virar spam. Você suaviza o texto.",
    insights: [
      { tipo: "critico", titulo: "Limite de toques atingido", texto: "A trava cortou o 4º toque para a Beatriz. A correção sugerida é deixar o 3º toque mais leve.", ganho: "menos risco de bloqueio" },
      { tipo: "elogio", titulo: "Leads de volta", texto: "9 conversas foram retomadas nesta semana.", prova: "2 no-shows foram recuperados ontem." },
    ],
    upgrades: [
      { name: "Toque por áudio", icon: Volume2, blurb: "Um dos toques vira áudio.", onde: "muda o 2º toque", sinergia: "usa a voz do Atendente" },
      { name: "Reativar 30 dias", icon: HeartPulse, blurb: "Chama de volta leads frios há 30 dias.", onde: "cria uma nova cadência" },
    ],
    features: [
      { name: "3 toques: 6h, 24h, 72h", icon: HeartPulse, fonte: "metrik", on: true },
      { name: "Recupera no-show", icon: CalendarX, fonte: "metrik", on: true },
      { name: "Para se o lead responder", icon: BellRing, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "Enviou o 2º toque para a Beatriz", status: "run" },
      { t: "31 min", acao: "Recuperou um no-show de ontem", status: "ok" },
      { t: "1 h", acao: "Insistiu além do limite", status: "erro", detalhe: "Trava cortou o 4º toque" },
    ],
    simCenario: "Lead sumiu depois de pedir o valor",
    sim: [
      { label: "Espera o intervalo certo antes de chamar", ok: true },
      { label: "Volta leve, sem cobrar", ok: true },
      { label: "Reoferece a reunião", ok: true },
      { label: "Respeita o limite de toques", ok: true },
    ],
  },
  {
    id: "auditor",
    name: "Auditor de Funil",
    glyph: ScanSearch,
    papel: "Toda segunda, acha dinheiro parado no funil",
    tipo: "acao",
    work: {
      kind: "lista",
      label: "Achados",
      lista: {
        titulo: "Leads parados",
        itens: [
          { a: "23 leads sem toque há mais de 10 dias", b: "R$ 12k" },
          { a: "5 leads no funil errado", b: "Rerotear" },
          { a: "3 leads sem origem marcada", b: "Rastrear" },
        ],
      },
    },
    state: "idle",
    color: "#fbbf24",
    agora: "Aguardando a próxima varredura, segunda às 8h",
    fluxo: [
      { label: "Varre o funil", deveria: "Roda toda segunda às 8h, em todos os funis.", status: "ok" },
      { label: "Separa parado de perdido", deveria: "Segue a regra blindada.", status: "ok" },
      { label: "Monta o relatório", deveria: "Não altera nenhum card.", status: "ok" },
      { label: "Manda no grupo", deveria: "Um relatório legível chega no seu grupo.", status: "espera" },
    ],
    metrics: { execucoes: 4, acertos: 4, erros: 0, custo: "R$ 0,40" },
    shield: "As regras do que é “parado” e “perdido” são blindadas. Você ajusta o prazo, não a definição.",
    insights: [
      { tipo: "dica", titulo: "Leads parados no funil", texto: "23 leads estão sem toque há mais de 10 dias. O Recuperador pode chamar esses leads de volta.", ganho: "R$ 12k em jogo" },
      { tipo: "elogio", titulo: "Relatório em dia", texto: "A última varredura chegou ao seu grupo sem erro.", prova: "Foram 23 achados, sem alterar nenhum card." },
    ],
    upgrades: [
      { name: "Auditoria diária", icon: ScanSearch, blurb: "Varre o funil todo dia, não só na segunda.", onde: "muda a frequência" },
      { name: "Fila de reativação", icon: HeartPulse, blurb: "Manda os leads parados para o Recuperador.", onde: "liga Auditor → Recuperador", sinergia: "precisa do Recuperador ligado", config: [{ pergunta: "Destino", opcoes: ["Recuperador"] }, { pergunta: "Dias parado", opcoes: ["10 dias", "15 dias", "30 dias"] }] },
    ],
    features: [
      { name: "Acha leads parados", icon: Filter, fonte: "metrik", on: true },
      { name: "Relatório no seu grupo", icon: BellRing, fonte: "metrik", on: true },
      { name: "Sugere quem reativar", icon: TrendingUp, fonte: "mcp", on: false },
    ],
    live: [
      { t: "seg 8h", acao: "Achou 23 leads parados na última varredura", status: "ok" },
      { t: "seg 8h", acao: "Mandou o relatório no grupo", status: "ok" },
    ],
    simCenario: "Rodar a auditoria agora, fora da segunda",
    sim: [
      { label: "Varre todos os funis conectados", ok: true },
      { label: "Separa parado de perdido", ok: true },
      { label: "Não mexe em nenhum card", ok: true },
      { label: "Entrega relatório legível", ok: true },
    ],
  },
  {
    id: "rastreador",
    name: "Rastreador",
    glyph: Radar,
    papel: "Descobre de qual anúncio veio cada lead",
    tipo: "acao",
    work: {
      kind: "lista",
      label: "Origens",
      lista: {
        titulo: "Origem dos leads hoje",
        itens: [
          { a: "Meta Ads · campanha 03", b: "58%" },
          { a: "Instagram orgânico", b: "21%" },
          { a: "Direto ou desconhecido", b: "14%" },
          { a: "Google", b: "7%" },
        ],
      },
    },
    state: "ativo",
    color: "#58aae4",
    agora: "Marcando a origem de 5 leads novos",
    fluxo: [
      { label: "Captura o clique", deveria: "Roda a cada lead novo e guarda a UTM e o click id.", status: "ok" },
      { label: "Cruza com o CRM", deveria: "Liga o lead à campanha certa.", status: "ok" },
      { label: "Marca a origem", deveria: "Não inventa origem quando ela não existe.", status: "ok" },
      { label: "Devolve para a Meta", deveria: "A conversão volta para a Meta pela CAPI.", status: "ok" },
    ],
    expectativa: "Marca a origem de cada lead novo e devolve a conversão pra Meta.",
    integracoes: ["Meta CAPI"],
    metrics: { execucoes: 132, acertos: 130, erros: 0, custo: "R$ 0,88" },
    shield: "O modelo de atribuição é blindado. Você liga e desliga canais, não reescreve a conta.",
    insights: [
      { tipo: "elogio", titulo: "Rastreio preciso", texto: "130 de 132 leads têm a origem certa.", prova: "As conversões estão voltando para o pixel." },
      { tipo: "dica", titulo: "Sinal de conversão mais forte", texto: "Enviar o e-mail junto com a conversão melhora o match com a Meta.", ganho: "sinal mais preciso" },
    ],
    upgrades: [
      { name: "E-mail na conversão", icon: Webhook, blurb: "Melhora o match na Meta.", onde: "muda o envio da CAPI" },
      { name: "Origem por campanha", icon: Radar, blurb: "Detalha a origem até a campanha.", onde: "adiciona 1 campo" },
    ],
    features: [
      { name: "Captura UTM e clique", icon: Radar, fonte: "metrik", on: true },
      { name: "Devolve conversão pra Meta", icon: Webhook, fonte: "metrik", on: true },
      { name: "Cruza com o CRM", icon: Columns3, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "Marcou a origem como Meta Ads, campanha 03", status: "run" },
      { t: "12 min", acao: "Devolveu conversão pro pixel", status: "ok" },
      { t: "40 min", acao: "Marcou origem direta em lead sem UTM", status: "ok" },
    ],
    simCenario: "Lead chega sem nenhum parâmetro de rastreio",
    sim: [
      { label: "Não inventa uma origem falsa", ok: true },
      { label: "Marca como “direto/desconhecido”", ok: true },
      { label: "Guarda o clique pra cruzar depois", ok: true },
      { label: "Mantém o histórico auditável", ok: true },
    ],
  },
  {
    id: "contratos",
    name: "Contratos",
    glyph: FileSignature,
    papel: "Gera e envia o contrato para assinatura",
    tipo: "acao",
    work: {
      kind: "contratos",
      label: "Contratos",
      contratos: [
        { quem: "Empresa Vega", valor: "R$ 12.000", status: "assinado" },
        { quem: "Studio Lumen", valor: "R$ 7.500", status: "vencendo", prazo: "Vence amanhã" },
        { quem: "Marina Alves", valor: "R$ 4.900", status: "enviado", prazo: "Expira em 2 dias" },
        { quem: "Rodrigo Pinto", valor: "R$ 3.200", status: "expirado", prazo: "Expirou ontem" },
      ],
    },
    state: "pausado",
    color: "#f85149",
    agora: "Aguardando retomada",
    fluxo: [
      { label: "Negócio é ganho", deveria: "Roda quando o negócio é marcado como ganho no funil.", status: "espera", alvo: { tipo: "etapa", nome: "Ganho" } },
      { label: "Gera pelo modelo", deveria: "Preenche os dados certos do cliente.", status: "espera", alvo: { tipo: "documento", nome: "modelo de contrato" } },
      { label: "Envia para assinatura", deveria: "Envia pelo ZapSign no WhatsApp.", status: "espera", alvo: { tipo: "integracao", nome: "ZapSign" } },
      { label: "Registra a assinatura", deveria: "A assinatura volta para o card assim que o cliente assina.", status: "espera", alvo: { tipo: "campo", nome: "status do contrato" } },
    ],
    expectativa: "Quando o negócio é ganho, gera o contrato pelo modelo, envia para assinatura e registra a assinatura de volta.",
    integracoes: ["ZapSign"],
    metrics: { execucoes: 18, acertos: 18, erros: 0, custo: "R$ 0,52" },
    shield: "O modelo do contrato e os campos obrigatórios são blindados. Você troca texto, não cláusula travada.",
    insights: [
      { tipo: "elogio", titulo: "Assinatura completa", texto: "18 de 18 contratos enviados foram assinados.", prova: "Cada assinatura foi registrada de volta no CRM." },
      { tipo: "dica", titulo: "Lembrete de assinatura", texto: "Sem assinatura em 24h, o agente pode enviar um lembrete.", ganho: "menos contrato parado" },
    ],
    upgrades: [
      { name: "Lembrete de assinatura", icon: BellRing, blurb: "Cobra quem não assinou em 24h.", onde: "entra no motor de Contratos" },
      { name: "2ª via automática", icon: FileSignature, blurb: "Reenvia o contrato se o link expirar.", onde: "muda o comportamento de expiração" },
    ],
    features: [
      { name: "Gera pelo ZapSign", icon: FileSignature, fonte: "metrik", on: true },
      { name: "Manda no WhatsApp", icon: Volume2, fonte: "metrik", on: true },
      { name: "Avisa quando assina", icon: BellRing, fonte: "mcp", on: true },
    ],
    live: [
      { t: "ontem", acao: "Enviou contrato pra Vega e foi assinado", status: "ok" },
      { t: "ontem", acao: "Registrou a assinatura no CRM", status: "ok" },
    ],
    simCenario: "Negócio marcado como ganho dispara o contrato",
    sim: [
      { label: "Preenche os dados certos do cliente", ok: true },
      { label: "Usa o modelo aprovado", ok: true },
      { label: "Só envia após confirmação", ok: true },
      { label: "Registra a assinatura de volta", ok: true },
    ],
  },
  {
    id: "peticoes",
    name: "Petições",
    glyph: Gavel,
    papel: "Gera e protocola a petição sozinho, direto no CRM",
    tipo: "acao",
    work: {
      kind: "acoes",
      label: "Ações",
      acoes: {
        gatilho: "Um caso entra na etapa “Protocolar” ou alguém clica no card.",
        alvo: "3 casos na fila agora",
        feito: 34,
        log: [
          { quem: "Proc. 0812/25 · Vega", quando: "agora", ok: true },
          { quem: "Proc. 0809/25 · Lumen", quando: "12 min", ok: true },
          { quem: "Proc. 0805/25 · Prado", quando: "1 h", ok: false },
        ],
      },
    },
    state: "ativo",
    color: "#60a5fa",
    agora: "Gerando petição para 3 casos na etapa “Protocolar”",
    fluxo: [
      { label: "Recebe o gatilho", deveria: "Roda pela etapa ou pelo clique no card.", status: "ok", alvo: { tipo: "etapa", nome: "Protocolar" } },
      { label: "Confere os documentos", deveria: "Só segue com os documentos completos no card.", status: "ok", alvo: { tipo: "documento", nome: "procuração e anexos" } },
      { label: "Monta a peça", deveria: "Usa o modelo certo para o tipo de ação.", status: "ok", alvo: { tipo: "documento", nome: "modelo da peça" } },
      { label: "Protocola no AdvBox", deveria: "Envia pela API e recebe o número do processo.", status: "falha", porque: "O AdvBox recusou 1 caso. O campo “comarca” estava vazio no card.", sugestao: "Exigir a comarca antes de protocolar", alvo: { tipo: "integracao", nome: "AdvBox" } },
      { label: "Anexa e avisa", deveria: "O número fica no card e o aviso sai pelo WhatsApp.", status: "espera", alvo: { tipo: "canal", nome: "WhatsApp" } },
    ],
    expectativa: "Quando um caso entra na etapa “Protocolar”, monta a peça pelo modelo, protocola no AdvBox e anexa o número ao card.",
    integracoes: ["AdvBox"],
    metrics: { execucoes: 41, acertos: 40, erros: 1, custo: "R$ 2,10" },
    shield: "O modelo da peça e as regras de prazo são blindados. Você troca o texto, não o rito.",
    insights: [
      { tipo: "elogio", titulo: "Fila zerada ontem", texto: "34 petições foram geradas e protocoladas sem retrabalho.", prova: "Só 1 travou por falta de documento." },
      { tipo: "dica", titulo: "Aviso de protocolo ao cliente", texto: "Depois do protocolo, o agente pode enviar o número do processo pelo WhatsApp.", ganho: "menos pergunta sobre o andamento" },
    ],
    upgrades: [
      { name: "Aviso de protocolo", icon: BellRing, blurb: "Envia o número do processo pelo WhatsApp.", onde: "conecta com o Atendente", sinergia: "usa o canal do Atendente", config: [{ pergunta: "Canal do aviso", opcoes: ["WhatsApp", "E-mail"] }, { pergunta: "Conteúdo do aviso", opcoes: ["Número do processo", "Número e link do andamento"] }] },
      { name: "Cheque de documentos", icon: FileSignature, blurb: "Segura o protocolo se faltar documento.", onde: "roda antes de protocolar" },
    ],
    features: [
      { name: "Puxa os dados do caso no CRM", icon: Columns3, fonte: "metrik", on: true },
      { name: "Monta a peça pelo modelo", icon: FileSignature, fonte: "metrik", on: true },
      { name: "Protocola e anexa ao card", icon: Gavel, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "Gerando petição do Proc. 0812/25", status: "run" },
      { t: "12 min", acao: "Protocolou e anexou ao card da Vega", status: "ok" },
      { t: "1 h", acao: "Faltou uma procuração no caso Prado", status: "erro", detalhe: "documento obrigatório ausente" },
    ],
    simCenario: "Rodar em massa pra todos na etapa “Protocolar”",
    sim: [
      { label: "Só pega quem tem documento completo", ok: true },
      { label: "Usa o modelo certo por tipo de ação", ok: true },
      { label: "Não protocola duplicado", ok: true },
      { label: "Anexa a peça no card certo", ok: true },
    ],
  },
  {
    id: "triagem-juridica",
    name: "Triagem Jurídica",
    glyph: Scale,
    papel: "Faz a triagem previdenciária e diz quem tem direito a quê",
    tipo: "resposta",
    state: "ativo",
    color: "#58aae4",
    agora: "Triando um caso de auxílio maternidade",
    expectativa: "Todo lead que chega é triado, cai no ramo certo (BPC, aposentadoria ou maternidade) e sai com resposta clara: agenda, sem direito ou humano.",
    metrics: { execucoes: 64, acertos: 62, erros: 0, custo: "R$ 1,74" },
    shield: "As regras de direito (renda, carência e prazo) vêm da banca e são blindadas. Você ajusta o tom e as falas, nunca a lei.",
    features: [
      { name: "Ouve áudio e lê documento", icon: Volume2, fonte: "metrik", on: true },
      { name: "Move o funil sozinho", icon: Columns3, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "Triando um caso de auxílio maternidade", status: "run" },
      {
        t: "9 min", acao: "Negou o BPC da Dona Cléia pela renda e ofereceu verificar outro benefício", status: "ok",
        conferencia: {
          veredito: "seguiu", regra: "BPC · renda acima do limite", fonte: "na-hora",
          checks: [
            { ok: true, label: "Não prometeu resultado que não existe" },
            { ok: true, label: "Explicou o porquê com carinho" },
            { ok: true, label: "Ofereceu verificar outro benefício antes de encerrar" },
            { ok: true, label: "Moveu o card para “Sem direito” com o motivo escrito" },
          ],
        },
      },
      {
        t: "22 min", acao: "Confirmou o auxílio maternidade da Ana Paula e agendou com a doutora", status: "ok",
        conferencia: { veredito: "seguiu", regra: "Maternidade · segurada no prazo", fonte: "na-hora" },
      },
      {
        t: "40 min", acao: "Ficou em dúvida sobre a renda de um caso e passou para o advogado", status: "ok",
        conferencia: { veredito: "segurou", porque: "Na dúvida, chamou uma pessoa em vez de arriscar um erro de direito.", fonte: "na-hora" },
      },
      {
        t: "1 h", acao: "Explicou ao Sr. Bento quais documentos levar na reunião", status: "ok",
        conferencia: { veredito: "conversou" },
      },
      {
        t: "1 h", acao: "Tentou agendar a análise da Sra. Marta e a agenda recusou", status: "erro", detalhe: "Horário já ocupado",
        conferencia: { veredito: "falhou", porque: "O horário oferecido já estava ocupado. O lead ficou sem confirmação de retorno.", fonte: "na-hora" },
      },
    ],
    insights: [
      { tipo: "elogio", titulo: "Triagem certeira", texto: "62 de 64 casos caíram no ramo certo de primeira.", prova: "Os 2 casos em dúvida foram para um humano, sem chute." },
    ],
    fluxo: [
      { label: "Recebe o caso", deveria: "todo lead que chama no WhatsApp", status: "ok" },
      { label: "Tria em 2–3 perguntas", deveria: "descobre o benefício certo sem interrogatório", status: "ok" },
      { label: "Aplica a regra do ramo", deveria: "responde com base na regra da banca, nunca inventa", status: "ok" },
      { label: "Move e registra", deveria: "etapa certa no funil + motivo escrito no card", status: "ok" },
    ],
    simCenario: "Lead com renda alta pergunta se tem direito ao BPC",
    sim: [
      { label: "Não promete direito que não existe", ok: true },
      { label: "Explica o porquê com carinho", ok: true },
      { label: "Oferece alternativa antes de encerrar", ok: true },
    ],
    mapa: {
      entrada: "Lead chama no WhatsApp do escritório",
      triagem: {
        faz: "Descobre em 2 ou 3 perguntas qual é o caso da pessoa, sem parecer interrogatório",
        coleta: ["qual benefício busca", "situação (trabalha? contribuiu? gravidez?)", "renda da casa"],
      },
      ramos: [
        {
          id: "bpc", nome: "BPC / LOAS", cor: "#3fb950",
          quando: "idoso 65+ ou pessoa com deficiência sem condição de se manter",
          coleta: ["idade", "renda da casa por pessoa", "CadÚnico em dia?"],
          on: true, execucoesHoje: 12, ultima: "Há 9 min · Dona Cléia",
          regras: [
            {
              se: "a renda da casa passa do limite (ex.: família que ganha R$ 5.000)",
              entao: "explica com carinho que o BPC não se encaixa e não deixa a pessoa sem resposta",
              diz: "Pela renda da sua casa, o BPC infelizmente não se encaixa no seu caso. Mas posso verificar se você tem direito a outro benefício, tudo bem?",
              move: "→ etapa “Sem direito” (com o motivo escrito no card)",
              mudou: "ajustada há 3 dias pela Escola — antes encerrava seco, sem oferecer alternativa",
            },
            {
              se: "renda dentro do limite e CadÚnico em dia",
              entao: "lista os documentos e já oferece horário com o advogado",
              diz: "Seu caso tem tudo pra seguir! Vou te falar os documentos e já deixo um horário reservado com a doutora.",
              move: "→ etapa “Agendado”",
            },
            {
              se: "a pessoa não sabe a renda ou o caso ficou na dúvida",
              entao: "não arrisca uma resposta",
              move: "→ “Atendimento humano”",
              aviso: true,
            },
          ],
        },
        {
          id: "previdenciario", nome: "Aposentadoria", cor: "#3b82f6",
          quando: "menciona INSS, tempo de contribuição ou “me aposentar”",
          coleta: ["anos de contribuição", "idade", "quando contribuiu por último"],
          on: true, execucoesHoje: 7, ultima: "Há 25 min · Sr. Almir",
          regras: [
            {
              se: "tem tempo de contribuição aparente",
              entao: "pede o extrato do CNIS e agenda a análise",
              diz: "Pra te dar certeza, preciso do seu extrato do INSS (CNIS). Te ensino a puxar em 2 minutos — e já agendo a análise.",
              move: "→ etapa “Análise de CNIS”",
            },
            {
              se: "nunca contribuiu",
              entao: "explica que a aposentadoria por contribuição não cabe e verifica o BPC",
              move: "→ ramo BPC / LOAS",
            },
          ],
        },
        {
          id: "maternidade", nome: "Auxílio Maternidade", cor: "#58aae4",
          quando: "menciona gravidez, parto recente ou adoção",
          coleta: ["data do parto ou adoção", "trabalhou/contribuiu nos últimos meses?", "trabalhadora rural?"],
          on: true, execucoesHoje: 5, ultima: "Há 2 min · Ana Paula",
          regras: [
            {
              se: "contribuiu (ou é segurada especial) e está no prazo",
              entao: "confirma o direito, lista documentos e agenda",
              diz: "Ótima notícia: pelo que você me contou, seu caso tem direito sim! Me manda a certidão do bebê que eu já agendo com a doutora.",
              move: "→ etapa “Agendado”",
            },
            {
              se: "não contribuiu e não se encaixa nas regras",
              entao: "explica o porquê de não ter direito e registra o motivo",
              diz: "Pelo que você me contou, o auxílio não se aplica no seu caso — te explico o porquê direitinho, tá bom?",
              move: "→ etapa “Sem direito”",
            },
          ],
        },
      ],
      aposRamos: "Todo caminho termina em agendamento com o advogado, sem direito (com o porquê no card) ou humano chamado. Nenhum lead fica sem resposta.",
      mudancas: [
        {
          quando: "há 3 dias",
          origem: "voce" as const,
          pedido: "Quando negar o BPC, não deixa a pessoa no vácuo — oferece outro caminho antes de encerrar.",
          antes: "Negava pela renda e encerrava a conversa ali.",
          agora: "Nega com carinho, explica o porquê e oferece verificar outro benefício antes de encerrar.",
          ramoId: "bpc",
          situacao: "a renda da casa passa do limite (ex.: família que ganha R$ 5.000)",
          porteiro: { nota: "9,6", casos: "12/12 casos passaram" },
          status: "no ar",
        },
        {
          quando: "há 1 semana",
          origem: "metrik",
          pedido: "Ser mais acolhedora com gestantes no ramo da maternidade.",
          antes: "Usava o mesmo tom neutro nos três caminhos.",
          agora: "Na maternidade, fala mais próxima (“ótima notícia”, “a doutora”) e confirma o prazo antes de tudo.",
          ramoId: "maternidade",
          situacao: "contribuiu (ou é segurada especial) e está no prazo",
          porteiro: { nota: "9,2", casos: "8/8 casos passaram" },
          status: "no ar",
        },
      ],
    },
  },
  {
    // A PROVA DA FÁBRICA: mapa compilado do PROMPT REAL da Bia
    // (clientes/metriksales/agente-ia/prompt.md — a IA comercial da Metrik no GHL).
    id: "bia",
    name: "Bia",
    glyph: Bot,
    papel: "Consultora comercial da Metrik que vende, agenda e escala no WhatsApp",
    tipo: "resposta",
    state: "ativo",
    color: "#d98a5c",
    agora: "Conduzindo um lead para a reunião de diagnóstico",
    expectativa: "Todo lead que chama é atendido na hora, cai numa das 3 rotas (implementação, Kommo Academy ou GHL Academy) e sai com reunião marcada, checkout na mão ou humano assumindo.",
    metrics: { execucoes: 48, acertos: 47, erros: 0, custo: "R$ 2,31" },
    shield: "As rotas, os preços oficiais (R$ 997, R$ 197 e R$ 47) e as travas de escalação vêm do prompt certificado e são blindados. Você ajusta o tom, nunca a oferta.",
    features: [
      { name: "Ouve áudio e lê imagem/PDF", icon: Volume2, fonte: "metrik", on: true },
      { name: "Agenda no calendário real", icon: CalendarClock, fonte: "metrik", on: true },
      { name: "CRM atualizado em silêncio", icon: Columns3, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "Ofereceu 2 horários de diagnóstico", status: "run" },
      { t: "18 min", acao: "Enviou o checkout da Kommo Academy na própria resposta", status: "ok" },
    ],
    insights: [
      { tipo: "elogio", titulo: "Rota certa de primeira", texto: "47 de 48 conversas caíram na rota certa sem entrevista longa.", prova: "A triagem usou no máximo 2 perguntas, como manda a regra." },
    ],
    fluxo: [
      { label: "Recebe o lead", deveria: "responde primeiro o que a pessoa perguntou", status: "ok" },
      { label: "Tria em até 2 perguntas", deveria: "empresa própria × aprender/prestar serviço", status: "ok" },
      { label: "Executa a rota", deveria: "diagnóstico, Academy ou escalação — sem inventar preço/link", status: "ok" },
      { label: "CRM em silêncio", deveria: "origem, qualificação, etapa e resumo gravados", status: "ok" },
    ],
    simCenario: "Lead pede desconto e link que não existe no catálogo",
    sim: [
      { label: "Não inventa preço, link nem desconto", ok: true },
      { label: "Reapresenta o valor antes de rebaixar a oferta", ok: true },
      { label: "Escala pra humano quando o link não está no catálogo", ok: true },
    ],
    mapa: {
      entrada: "Lead chama no WhatsApp da Metrik",
      triagem: {
        faz: "Apresenta-se, responde primeiro o que a pessoa perguntou e descobre o caso em no máximo 2 perguntas",
        coleta: ["é pra empresa própria ou pra aprender e prestar serviço?", "principal gargalo comercial", "Kommo, GHL ou agentes? (se for aprender)"],
      },
      ramos: [
        {
          id: "implementacao", nome: "Implementação (empresa)", cor: "#58aae4",
          quando: "quer resultado na própria operação: fala de equipe, atendimento, CRM, funil, automação",
          coleta: ["gargalo principal", "segmento", "CRM atual (só se mudar a recomendação)"],
          on: true, execucoesHoje: 6, ultima: "Há 12 min · Lead jurídico",
          regras: [
            {
              se: "o lead aceita a reunião de diagnóstico",
              entao: "consulta a agenda real, oferece 2 ou 3 horários em dias diferentes e confirma por extenso",
              diz: "Consegui quinta às 10h ou sexta às 14h. Qual fica melhor pra você?",
              move: "→ etapa “Diagnóstico agendado” (tag agendado entra, tag ia sai)",
            },
            {
              se: "pergunta o preço da implementação",
              entao: "não inventa preço, explica que depende do escopo e leva para o diagnóstico",
              diz: "O investimento depende do escopo do seu cenário. No diagnóstico a gente desenha isso certinho, sem chute.",
            },
            {
              se: "nenhum horário serve",
              entao: "escala o caso para uma pessoa buscar um encaixe",
              aviso: true,
            },
          ],
        },
        {
          id: "kommo", nome: "Kommo Academy · R$ 997/ano", cor: "#3b82f6",
          quando: "quer aprender Kommo, prestar serviço ou implementar pra clientes",
          on: true, execucoesHoje: 4, ultima: "Há 18 min · Agência SP",
          regras: [
            {
              se: "o interesse por aprender Kommo fica claro",
              entao: "apresenta a oferta completa já na primeira resposta",
              diz: "Kommo Academy, R$ 997 por ano: mais de 50 horas do zero ao avançado, IA e automação aplicadas a vendas e aulas ao vivo de segunda a quinta.",
            },
            {
              se: "diz que quer entrar",
              entao: "envia o checkout na mesma resposta, sem deixar o link para depois",
              move: "→ checkout na resposta e funil educação",
            },
          ],
        },
        {
          id: "ghl", nome: "GHL Academy · R$ 197/mês", cor: "#3fb950",
          quando: "quer montar agência, ter contas GHL próprias e margem recorrente",
          on: true, execucoesHoje: 3,
          regras: [
            {
              se: "acha R$ 197 caro",
              entao: "relembra as 2 contas GHL e a possibilidade de margem (sem prometer lucro) antes de qualquer oferta menor",
              diz: "A assinatura te dá duas contas. A segunda você pode oferecer a um cliente, e ela ajuda a pagar a sua. Esse modelo faz sentido pra sua agência?",
            },
            {
              se: "rejeita as Academies e pede uma entrada menor",
              entao: "só então apresenta o webinar de Claude Code por R$ 47, e o time envia o link",
              move: "→ oferta de último recurso",
              aviso: true,
            },
          ],
        },
      ],
      aposRamos: "Todo caminho termina em diagnóstico agendado, venda com checkout na resposta ou humano assumindo, com o CRM atualizado em silêncio. Suporte, irritação ou pedido de humano escalam na hora, sem tentativa de venda.",
      mudancas: [],
    },
  },
];

export const AGENT_BY_ID = (id: string) => AGENTS.find((a) => a.id === id);

export const STATE_META: Record<AgentState, { label: string; color: string }> = {
  ativo: { label: "Trabalhando", color: "#3fb950" },
  idle: { label: "Em espera", color: "#83879a" },
  pausado: { label: "Pausado", color: "#fbbf24" },
};

export const STATS = [
  { label: "Agentes no ar", value: "5", delta: "de 7", up: true },
  { label: "Execuções hoje", value: "774", delta: "+18%", up: true },
  { label: "Acertos", value: "99,3%", delta: "+0,4pp", up: true },
  { label: "Custo do dia", value: "R$ 13,97", delta: "Estável", up: true },
];

export type Modulo = {
  id: string;
  name: string;
  icon: any;
  color: string;
  blurb: string;
  gatilho: string;
  acao: string;
  installed: boolean;
  tag?: string;
};

export const MODULOS: Modulo[] = [
  { id: "m2", name: "Recuperar no-show", icon: CalendarX, color: "#3fb950", blurb: "Chama de volta quem faltou na reunião.", gatilho: "Faltou na reunião", acao: "Reoferece 2 horários", installed: true, tag: "popular" },
  { id: "m3", name: "Alerta por palavra", icon: BellRing, color: "#fbbf24", blurb: "Avisa quando alguém fala “cancelar” ou “reembolso”.", gatilho: "Palavra crítica", acao: "Avisa o seu grupo", installed: true },
  { id: "m1", name: "Upsell inteligente", icon: TrendingUp, color: "#3b82f6", blurb: "Oferece o upgrade certo para quem já é cliente.", gatilho: "Compra confirmada", acao: "Sugere o plano acima", installed: false, tag: "popular" },
  { id: "m5", name: "Contrato ZapSign", icon: FileSignature, color: "#7c9fe0", blurb: "Gera e envia o contrato para assinatura assim que o negócio fecha.", gatilho: "Negócio ganho", acao: "Envia o contrato", installed: false, tag: "novo" },
  { id: "m4", name: "Enriquecer campo", icon: Sparkles, color: "#58aae4", blurb: "Descobre e completa os dados do lead.", gatilho: "Dado faltando", acao: "Preenche o campo", installed: false },
  { id: "m6", name: "Rastreio de origem", icon: Radar, color: "#58aae4", blurb: "Mostra de qual anúncio veio cada lead.", gatilho: "Novo lead", acao: "Marca a origem", installed: true },
  { id: "m7", name: "Auditoria de funil", icon: ScanSearch, color: "#f85149", blurb: "Acha leads parados e dinheiro esquecido no funil.", gatilho: "Toda segunda", acao: "Manda o relatório", installed: true },
  { id: "m8", name: "Resumo por voz", icon: Volume2, color: "#58aae4", blurb: "Envia um áudio com o resumo do dia.", gatilho: "Fim do dia", acao: "Envia o áudio", installed: false, tag: "novo" },
];

export const CHAT_EXEMPLOS = [
  "Deixa o follow-up com só 2 toques",
  "Puxa o preço de outra API",
  "Fala num tom mais próximo",
  "Não oferece desconto sem eu aprovar",
];

export const CONEXOES_MCP = [
  { id: "claude", name: "Claude Code", desc: "conecte e peça direto do terminal — vira mudança segura, testada e reversível aqui dentro", status: "conectado", color: "#3b82f6" },
  { id: "codex", name: "Codex", desc: "mesma tomada, outro assistente — a Metrik aprova e publica com prova", status: "conectado", color: "#58aae4" },
];

export const CONEXOES_CANAIS = [
  { id: "ghl", name: "GoHighLevel", tipo: "CRM", status: "conectado", ok: true },
  { id: "kommo", name: "Kommo", tipo: "CRM", status: "conectado", ok: true },
  { id: "wa", name: "WhatsApp", tipo: "Canal", status: "+55 21 9 8174-0018", ok: true },
  { id: "cal", name: "Google Agenda", tipo: "Agenda", status: "conectado", ok: true },
];
