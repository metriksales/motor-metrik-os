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
  Repeat,
} from "lucide-react";

export type ViewId = "inicio" | "conversas" | "followup" | "agentes" | "aovivo" | "modulos" | "conexoes" | "admin";

export const NAV: { id: ViewId; label: string; icon: any; hint: string }[] = [
  { id: "inicio", label: "Início", icon: Activity, hint: "o estado da operação" },
  { id: "conversas", label: "Conversas", icon: MessageCircleHeart, hint: "o que sua IA está falando" },
  { id: "followup", label: "Follow-up", icon: Repeat, hint: "quem ela está cutucando" },
  { id: "agentes", label: "Agentes", icon: Bot, hint: "sua frota de robôs" },
  { id: "aovivo", label: "Ao vivo", icon: Radio, hint: "o que rola agora" },
  { id: "modulos", label: "Módulos", icon: Blocks, hint: "novas habilidades" },
  { id: "conexoes", label: "Conexões", icon: Plug, hint: "WhatsApp, CRM e agenda" },
  { id: "admin", label: "Admin", icon: UsersRound, hint: "sua conta e quem acessa" },
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
  seguiu: { label: "Seguiu a regra", cor: "#34d399", icon: Check },
  segurou: { label: "Segurou de propósito", cor: "#58aae4", icon: ShieldCheck },
  conversou: { label: "Conversou", cor: "#8a94a4", icon: MessageCircleHeart },
  falhou: { label: "Falhou", cor: "#fb7185", icon: X },
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
          id: "comprar", nome: "Quer contratar", cor: "#34d399",
          quando: "pergunta de plano, preço ou como funciona",
          coleta: ["tamanho da operação", "prazo pra começar"],
          on: true, execucoesHoje: 9, ultima: "há 4 min — Marina A.",
          regras: [
            { se: "demonstra interesse e responde a qualificação", entao: "apresenta o plano certo e oferece reunião", diz: "Pelo que você me contou, o Pro resolve seu caso. Quer que eu já marque 20 min com o especialista?", move: "→ etapa “Qualificada”" },
            { se: "pede preço antes de qualificar", entao: "segura o preço e faz 1 pergunta primeiro", diz: "Te passo certinho! Só me conta rapidinho: quantas pessoas atendem hoje?", mudou: "ajustada há 2 dias pela Escola — antes soltava a tabela inteira" },
          ],
        },
        {
          id: "cliente", nome: "Já é cliente", cor: "#58aae4",
          quando: "menciona problema, acesso ou suporte",
          on: true, execucoesHoje: 3, ultima: "há 1 h — Studio Lumen",
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
      aposRamos: "Todo caminho termina em: reunião marcada, dúvida resolvida ou humano avisado — sempre na etapa certa do funil.",
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
    agora: "respondendo a Marina — ofereceu quinta 14h",
    fluxo: [
      { label: "Recebe a mensagem", deveria: "todo lead que chama no WhatsApp", status: "ok" },
      { label: "Entende o pedido", deveria: "lê texto, áudio, imagem e PDF", status: "ok" },
      { label: "Responde e qualifica", deveria: "responde em segundos e descobre o que precisa", status: "ok" },
      { label: "Passa adiante", deveria: "entrega pro Agendador quando está pronto", status: "ok" },
    ],
    expectativa: "Responde todo lead no WhatsApp em segundos, qualifica e passa adiante — sem responder fora do horário.",
    metrics: { execucoes: 212, acertos: 206, erros: 2, custo: "R$ 6,12" },
    shield: "O jeito de qualificar e a política de desconto são blindados. Você muda o tom, não a regra.",
    insights: [
      { tipo: "elogio", titulo: "Você tá voando", texto: "99% de acerto nas últimas 200 conversas.", prova: "só 2 erros, ambos fora do horário — a trava segurou." },
      { tipo: "critico", titulo: "2 mensagens tentaram sair 22h", texto: "A regra segurou, mas o lead esperou até de manhã. Posso criar uma resposta automática de “fora do horário”?", ganho: "menos lead esfriando" },
    ],
    upgrades: [
      { name: "Resposta fora do horário", icon: Clock, blurb: "avisa e agenda retorno quando é tarde", onde: "entra no motor de Atendimento", sinergia: "combina com a Agenda", config: [{ pergunta: "Horário comercial?", opcoes: ["9h–18h", "8h–20h"] }, { pergunta: "Fora do horário, faz o quê?", opcoes: ["avisa e agenda retorno", "só diz que responde amanhã"] }], resultado: "responde avisando que é tarde e já oferece um horário pra amanhã", criterio: "vale fora do horário comercial que você definir acima" },
      { name: "Detector de compra", icon: TrendingUp, blurb: "acende quando o lead fica quente", onde: "muda a prioridade da fila", sinergia: "avisa o Handoff", resultado: "acende o lead no topo da fila e avisa o Handoff pra um humano entrar", criterio: "quente = pediu preço, respondeu em menos de 10 min e falou em “fechar”, “contratar” ou “valor”" },
    ],
    features: [
      { name: "Ouve áudio e lê imagem/PDF", icon: Volume2, fonte: "metrik", on: true },
      { name: "Base de conhecimento", icon: BookOpen, fonte: "metrik", on: true },
      { name: "Tom mais próximo", icon: MessageCircleHeart, fonte: "mcp", on: true },
      { name: "Enriquecer o lead", icon: Sparkles, fonte: "metrik", on: false },
    ],
    live: [
      { t: "agora", acao: "Respondeu Marina e ofereceu horário", status: "run", detalhe: "quinta 14h" },
      { t: "2 min", acao: "Leu um áudio de 0:38 e entendeu a dúvida", status: "ok" },
      { t: "6 min", acao: "Tentou responder fora do horário comercial", status: "erro", detalhe: "regra segurou o envio" },
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
          { a: "Marina Alves", b: "quente" },
          { a: "Rodrigo Pinto", b: "quente" },
          { a: "Júlia Bastos", b: "morno" },
          { a: "Empresa Vega", b: "quente" },
        ],
      },
    },
    state: "ativo",
    color: "#e0a44a",
    agora: "movendo 3 leads pra etapa “Qualificada”",
    fluxo: [
      { label: "Lê a conversa", deveria: "a cada lead novo", status: "ok" },
      { label: "Descobre o que falta", deveria: "só qualifica com o mínimo de informação", status: "ok" },
      { label: "Preenche o card", deveria: "campos e origem, sem duplicar", status: "ok" },
      { label: "Move a etapa", deveria: "manda pra “Qualificada”", status: "ok" },
    ],
    metrics: { execucoes: 188, acertos: 185, erros: 0, custo: "R$ 3,04" },
    shield: "As etapas e os campos obrigatórios são blindados. Você renomeia rótulo, não quebra o funil.",
    insights: [
      { tipo: "elogio", titulo: "Funil impecável", texto: "Nenhum card saiu com campo em branco hoje.", prova: "185 de 185 preenchidos." },
      { tipo: "dica", titulo: "Dá pra qualificar por porte", texto: "Se eu perguntar o tamanho da empresa, separo B2B de B2C sozinho.", ganho: "+8% de reunião qualificada" },
    ],
    upgrades: [
      { name: "Score por porte", icon: TrendingUp, blurb: "separa empresa grande de pequena", onde: "adiciona 1 campo e 1 critério", sinergia: "alimenta o Agendador", config: [{ pergunta: "Separa por quê?", opcoes: ["nº de funcionários", "faturamento"] }] },
      { name: "Anti-duplicado", icon: Columns3, blurb: "impede dois cards do mesmo lead", onde: "roda antes de criar a oportunidade" },
    ],
    features: [
      { name: "Preenche campos sozinho", icon: Sparkles, fonte: "metrik", on: true },
      { name: "Detecta origem do lead", icon: Radar, fonte: "metrik", on: true },
      { name: "Score de intenção", icon: TrendingUp, fonte: "mcp", on: true },
    ],
    live: [
      { t: "agora", acao: "Moveu Rodrigo pra “Qualificada”", status: "run" },
      { t: "4 min", acao: "Preencheu 6 campos do card sem erro", status: "ok" },
      { t: "9 min", acao: "Marcou origem = Instagram Ads", status: "ok" },
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
    agora: "confirmando sex 10h com Rodrigo",
    fluxo: [
      { label: "Vê que o lead está pronto", deveria: "quando demonstra interesse", status: "ok" },
      { label: "Oferece horário livre", deveria: "lê a agenda real, sem chocar horário", status: "ok" },
      { label: "Confirma", deveria: "só grava depois do “ok” do lead", status: "ok" },
      { label: "Marca e avisa o time", deveria: "cria o evento e notifica o responsável", status: "ok" },
    ],
    expectativa: "Quando o lead está pronto, oferece um horário livre e grava a reunião na agenda, avisando o time.",
    integracoes: ["Google Agenda"],
    metrics: { execucoes: 74, acertos: 73, erros: 0, custo: "R$ 1,89" },
    shield: "A agenda e a janela de horários são blindadas. Você ajusta a duração, não a fonte da verdade.",
    insights: [
      { tipo: "elogio", titulo: "Agenda cheia", texto: "5 reuniões marcadas hoje, zero conflito.", prova: "100% confirmadas antes de gravar." },
      { tipo: "dica", titulo: "Lembrete corta falta", texto: "Um lembrete 1h antes costuma reduzir bastante o no-show.", ganho: "-20% de falta" },
    ],
    upgrades: [
      { name: "Lembrete 1h antes", icon: BellRing, blurb: "reduz falta na reunião", onde: "entra no motor de Agenda", sinergia: "combina com o Recuperador", config: [{ pergunta: "Em qual agenda?", opcoes: ["Google Agenda", "Outlook"] }, { pergunta: "Quando avisar?", opcoes: ["1h antes", "3h antes", "1 dia antes"] }, { pergunta: "Por qual canal?", opcoes: ["WhatsApp", "E-mail"] }] },
      { name: "Reagendar sozinho", icon: CalendarClock, blurb: "remarca quando dá conflito", onde: "muda o comportamento de conflito" },
    ],
    features: [
      { name: "Lê a agenda real", icon: CalendarClock, fonte: "metrik", on: true },
      { name: "Avisa o time ao marcar", icon: BellRing, fonte: "metrik", on: true },
      { name: "Lembrete 1h antes", icon: CalendarClock, fonte: "mcp", on: false },
    ],
    live: [
      { t: "agora", acao: "Ofereceu 3 horários livres", status: "run" },
      { t: "8 min", acao: "Criou evento e avisou o time", status: "ok", detalhe: "sex 10h" },
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
    color: "#34d399",
    agora: "reabrindo 2 conversas que esfriaram",
    fluxo: [
      { label: "Percebe que sumiu", deveria: "lead parou de responder", status: "ok" },
      { label: "Espera o tempo certo", deveria: "6h → 24h → 72h, sem pressa", status: "ok" },
      { label: "Chama de volta", deveria: "tom leve, reoferece a reunião", status: "ok" },
      { label: "Respeita o limite", deveria: "para no 3º toque ou se o lead responder", status: "espera" },
    ],
    metrics: { execucoes: 46, acertos: 41, erros: 1, custo: "R$ 1,12" },
    shield: "A cadência e o limite de toques são blindados pra não virar spam. Você suaviza o texto.",
    insights: [
      { tipo: "critico", titulo: "Quase virou insistência", texto: "Bati no limite com a Beatriz e a trava cortou o 4º toque. Posso deixar o 3º mais leve?", ganho: "menos risco de bloqueio" },
      { tipo: "elogio", titulo: "Trouxe gente de volta", texto: "9 conversas retomadas essa semana.", prova: "2 no-shows recuperados ontem." },
    ],
    upgrades: [
      { name: "Toque por áudio", icon: Volume2, blurb: "um dos toques vira áudio", onde: "muda o 2º toque", sinergia: "usa a voz do Atendente" },
      { name: "Reativar 30 dias", icon: HeartPulse, blurb: "chama leads frios de 30 dias", onde: "cria uma nova cadência" },
    ],
    features: [
      { name: "3 toques: 6h, 24h, 72h", icon: HeartPulse, fonte: "metrik", on: true },
      { name: "Recupera no-show", icon: CalendarX, fonte: "metrik", on: true },
      { name: "Para se o lead responder", icon: BellRing, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "2º toque enviado pra Beatriz", status: "run" },
      { t: "31 min", acao: "Recuperou um no-show de ontem", status: "ok" },
      { t: "1 h", acao: "Insistiu além do limite", status: "erro", detalhe: "trava cortou o 4º toque" },
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
        titulo: "Leads parados achados",
        itens: [
          { a: "23 leads sem toque +10 dias", b: "R$ 12k" },
          { a: "5 no funil errado", b: "rerotear" },
          { a: "3 sem origem marcada", b: "rastrear" },
        ],
      },
    },
    state: "idle",
    color: "#fbbf24",
    agora: "aguardando a próxima varredura (segunda 8h)",
    fluxo: [
      { label: "Varre o funil", deveria: "toda segunda 8h, todos os funis", status: "ok" },
      { label: "Separa parado de perdido", deveria: "pela regra blindada", status: "ok" },
      { label: "Monta o relatório", deveria: "sem tocar em nenhum card", status: "ok" },
      { label: "Manda no grupo", deveria: "entrega legível pra você", status: "espera" },
    ],
    metrics: { execucoes: 4, acertos: 4, erros: 0, custo: "R$ 0,40" },
    shield: "As regras do que é “parado” e “perdido” são blindadas. Você ajusta o prazo, não a definição.",
    insights: [
      { tipo: "dica", titulo: "Achei R$ 12k parados", texto: "23 leads sem toque há mais de 10 dias. Posso mandar o Recuperador neles?", ganho: "R$ 12k em jogo" },
      { tipo: "elogio", titulo: "Relatório em dia", texto: "Última varredura entregue limpa no seu grupo.", prova: "23 achados, 0 card tocado." },
    ],
    upgrades: [
      { name: "Auditoria diária", icon: ScanSearch, blurb: "varre todo dia, não só segunda", onde: "muda a frequência" },
      { name: "Fila de reativação", icon: HeartPulse, blurb: "manda os parados pro Recuperador", onde: "liga Auditor → Recuperador", sinergia: "precisa do Recuperador ligado", config: [{ pergunta: "Manda pra quem?", opcoes: ["Recuperador"] }, { pergunta: "A partir de quantos dias parado?", opcoes: ["10 dias", "15 dias", "30 dias"] }] },
    ],
    features: [
      { name: "Acha leads parados", icon: Filter, fonte: "metrik", on: true },
      { name: "Relatório no seu grupo", icon: BellRing, fonte: "metrik", on: true },
      { name: "Sugere quem reativar", icon: TrendingUp, fonte: "mcp", on: false },
    ],
    live: [
      { t: "seg 8h", acao: "Última varredura: 23 leads parados achados", status: "ok" },
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
          { a: "Direto / desconhecido", b: "14%" },
          { a: "Google", b: "7%" },
        ],
      },
    },
    state: "ativo",
    color: "#58aae4",
    agora: "marcando origem de 5 leads novos",
    fluxo: [
      { label: "Captura o clique", deveria: "UTM e click id de cada lead novo", status: "ok" },
      { label: "Cruza com o CRM", deveria: "liga o lead à campanha certa", status: "ok" },
      { label: "Marca a origem", deveria: "sem inventar quando não tem", status: "ok" },
      { label: "Devolve pra Meta", deveria: "manda a conversão pela CAPI", status: "ok" },
    ],
    expectativa: "Marca a origem de cada lead novo e devolve a conversão pra Meta.",
    integracoes: ["Meta CAPI"],
    metrics: { execucoes: 132, acertos: 130, erros: 0, custo: "R$ 0,88" },
    shield: "O modelo de atribuição é blindado. Você liga/desliga canais, não reescreve a conta.",
    insights: [
      { tipo: "elogio", titulo: "Rastreio redondo", texto: "130 de 132 leads com origem certa.", prova: "conversões voltando pro pixel." },
      { tipo: "dica", titulo: "Dá pra subir o sinal", texto: "Mandar o e-mail junto na conversão melhora o match com a Meta.", ganho: "+ qualidade de sinal" },
    ],
    upgrades: [
      { name: "E-mail na conversão", icon: Webhook, blurb: "melhora o match na Meta", onde: "muda o envio da CAPI" },
      { name: "Origem por campanha", icon: Radar, blurb: "detalha até a campanha", onde: "adiciona 1 campo" },
    ],
    features: [
      { name: "Captura UTM e clique", icon: Radar, fonte: "metrik", on: true },
      { name: "Devolve conversão pra Meta", icon: Webhook, fonte: "metrik", on: true },
      { name: "Cruza com o CRM", icon: Columns3, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "Marcou origem = Meta Ads · campanha 03", status: "run" },
      { t: "12 min", acao: "Devolveu conversão pro pixel", status: "ok" },
      { t: "40 min", acao: "Lead sem UTM — origem = direto", status: "ok" },
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
    papel: "Gera e envia o contrato pra assinar",
    tipo: "acao",
    work: {
      kind: "contratos",
      label: "Contratos",
      contratos: [
        { quem: "Empresa Vega", valor: "R$ 12.000", status: "assinado" },
        { quem: "Studio Lumen", valor: "R$ 7.500", status: "vencendo", prazo: "vence amanhã" },
        { quem: "Marina Alves", valor: "R$ 4.900", status: "enviado", prazo: "expira em 2 dias" },
        { quem: "Rodrigo Pinto", valor: "R$ 3.200", status: "expirado", prazo: "expirou ontem" },
      ],
    },
    state: "pausado",
    color: "#fb7185",
    agora: "pausado por você — retoma quando quiser",
    fluxo: [
      { label: "Negócio é ganho", deveria: "gatilho de ganho no funil", status: "espera", alvo: { tipo: "etapa", nome: "Ganho" } },
      { label: "Gera pelo modelo", deveria: "preenche os dados certos do cliente", status: "espera", alvo: { tipo: "documento", nome: "modelo de contrato" } },
      { label: "Manda pra assinar", deveria: "envia pelo ZapSign no WhatsApp", status: "espera", alvo: { tipo: "integracao", nome: "ZapSign" } },
      { label: "Registra a assinatura", deveria: "cola de volta no card quando assina", status: "espera", alvo: { tipo: "campo", nome: "status do contrato" } },
    ],
    expectativa: "Quando o negócio é ganho, gera o contrato pelo modelo, manda pra assinar e registra a assinatura de volta.",
    integracoes: ["ZapSign"],
    metrics: { execucoes: 18, acertos: 18, erros: 0, custo: "R$ 0,52" },
    shield: "O modelo do contrato e os campos obrigatórios são blindados. Você troca texto, não cláusula travada.",
    insights: [
      { tipo: "elogio", titulo: "Todo mundo assinou", texto: "18 de 18 contratos enviados foram assinados.", prova: "assinatura registrada de volta no CRM." },
      { tipo: "dica", titulo: "Dá pra cobrar assinatura", texto: "Se ninguém assinar em 24h, eu posso lembrar sozinho.", ganho: "menos contrato parado" },
    ],
    upgrades: [
      { name: "Lembrete de assinatura", icon: BellRing, blurb: "cobra quem não assinou em 24h", onde: "entra no motor de Contratos" },
      { name: "2ª via automática", icon: FileSignature, blurb: "reenvia se o link expirar", onde: "muda o comportamento de expiração" },
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
        gatilho: "entrou na etapa “Protocolar” — ou você clica no card",
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
    color: "#edc074",
    agora: "gerando petição pra 3 casos na etapa “Protocolar”",
    fluxo: [
      { label: "Recebe o gatilho", deveria: "caso entra na etapa “Protocolar” — ou você clica no card", status: "ok", alvo: { tipo: "etapa", nome: "Protocolar" } },
      { label: "Confere os documentos", deveria: "só segue se procuração e anexos estão no card", status: "ok", alvo: { tipo: "documento", nome: "procuração + anexos" } },
      { label: "Monta a peça", deveria: "usa o modelo certo pro tipo de ação", status: "ok", alvo: { tipo: "documento", nome: "modelo da peça" } },
      { label: "Protocola no AdvBox", deveria: "envia pela API e pega o número do processo", status: "falha", porque: "a API do AdvBox recusou 1 caso: campo “comarca” vazio no card", sugestao: "posso exigir a comarca preenchida antes de tentar — aí não falha na API.", alvo: { tipo: "integracao", nome: "AdvBox" } },
      { label: "Anexa e avisa", deveria: "cola o número no card e avisa no WhatsApp", status: "espera", alvo: { tipo: "canal", nome: "WhatsApp" } },
    ],
    expectativa: "Quando um caso entra na etapa “Protocolar”, monta a peça pelo modelo, protocola no AdvBox e anexa o número ao card.",
    integracoes: ["AdvBox"],
    metrics: { execucoes: 41, acertos: 40, erros: 1, custo: "R$ 2,10" },
    shield: "O modelo da peça e as regras de prazo são blindados. Você troca o texto, não o rito.",
    insights: [
      { tipo: "elogio", titulo: "Zerou a fila ontem", texto: "34 petições geradas e protocoladas sem retrabalho.", prova: "só 1 travou por falta de documento." },
      { tipo: "dica", titulo: "Dá pra avisar o cliente", texto: "Quando eu protocolar, posso mandar o número do processo no WhatsApp.", ganho: "menos “e aí, saiu?”" },
    ],
    upgrades: [
      { name: "Aviso de protocolo", icon: BellRing, blurb: "manda o número do processo no WhatsApp", onde: "conecta com o Atendente", sinergia: "usa o canal do Atendente", config: [{ pergunta: "Avisa por onde?", opcoes: ["WhatsApp", "E-mail"] }, { pergunta: "Manda o quê?", opcoes: ["número do processo", "número + link do andamento"] }] },
      { name: "Cheque de documentos", icon: FileSignature, blurb: "segura se faltar documento", onde: "roda antes de protocolar" },
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
    agora: "triando um caso de auxílio maternidade",
    expectativa: "Todo lead que chega é triado, cai no ramo certo (BPC, aposentadoria ou maternidade) e sai com resposta clara: agenda, sem direito ou humano.",
    metrics: { execucoes: 64, acertos: 62, erros: 0, custo: "R$ 1,74" },
    shield: "As REGRAS de direito (renda, carência, prazo) são blindadas — vêm da banca. Você ajusta o tom e as falas, nunca a lei.",
    features: [
      { name: "Ouve áudio e lê documento", icon: Volume2, fonte: "metrik", on: true },
      { name: "Move o funil sozinho", icon: Columns3, fonte: "metrik", on: true },
    ],
    live: [
      { t: "agora", acao: "Triando um caso de auxílio maternidade", status: "run" },
      {
        t: "9 min", acao: "Dona Cléia · BPC negado pela renda, com porta aberta pra outro benefício", status: "ok",
        conferencia: {
          veredito: "seguiu", regra: "BPC · renda acima do limite", fonte: "na-hora",
          checks: [
            { ok: true, label: "não prometeu resultado que não existe" },
            { ok: true, label: "explicou o porquê com carinho" },
            { ok: true, label: "ofereceu verificar outro benefício antes de encerrar" },
            { ok: true, label: "moveu o card pra Sem direito com o motivo escrito" },
          ],
        },
      },
      {
        t: "22 min", acao: "Ana Paula · confirmou o direito ao auxílio maternidade e agendou com a doutora", status: "ok",
        conferencia: { veredito: "seguiu", regra: "Maternidade · segurada no prazo", fonte: "na-hora" },
      },
      {
        t: "40 min", acao: "Na dúvida sobre a renda de um caso, preferiu não chutar e passou pro advogado", status: "ok",
        conferencia: { veredito: "segurou", porque: "Na dúvida ela chama a pessoa, não arrisca um erro de direito — a trava funcionou.", fonte: "na-hora" },
      },
      {
        t: "1 h", acao: "Explicou ao Sr. Bento quais documentos levar na reunião", status: "ok",
        conferencia: { veredito: "conversou" },
      },
      {
        t: "1 h", acao: "Tentou agendar a análise da Sra. Marta e a agenda recusou", status: "erro", detalhe: "o horário oferecido já estava ocupado — ela não confirmou o retorno pro lead",
        conferencia: { veredito: "falhou", porque: "o horário oferecido já estava ocupado — ela não confirmou o retorno pro lead", fonte: "na-hora" },
      },
    ],
    insights: [
      { tipo: "elogio", titulo: "Triagem redonda", texto: "62 de 64 casos caíram no ramo certo de primeira.", prova: "2 na dúvida foram pro humano — nenhum chute." },
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
        faz: "Descobre em 2–3 perguntas qual é o caso da pessoa — sem parecer interrogatório",
        coleta: ["qual benefício busca", "situação (trabalha? contribuiu? gravidez?)", "renda da casa"],
      },
      ramos: [
        {
          id: "bpc", nome: "BPC / LOAS", cor: "#34d399",
          quando: "idoso 65+ ou pessoa com deficiência sem condição de se manter",
          coleta: ["idade", "renda da casa por pessoa", "CadÚnico em dia?"],
          on: true, execucoesHoje: 12, ultima: "há 9 min — Dona Cléia",
          regras: [
            {
              se: "a renda da casa passa do limite (ex.: família que ganha R$ 5.000)",
              entao: "explica com carinho que o BPC não se encaixa — e NÃO deixa a pessoa no vácuo",
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
              entao: "NÃO arrisca: chama um humano na hora",
              move: "→ “Atendimento humano”",
              aviso: true,
            },
          ],
        },
        {
          id: "previdenciario", nome: "Aposentadoria", cor: "#e0a44a",
          quando: "menciona INSS, tempo de contribuição ou “me aposentar”",
          coleta: ["anos de contribuição", "idade", "quando contribuiu por último"],
          on: true, execucoesHoje: 7, ultima: "há 25 min — Sr. Almir",
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
          on: true, execucoesHoje: 5, ultima: "há 2 min — Ana Paula",
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
      aposRamos: "Todo caminho termina em: agendado com o advogado, sem direito (com o porquê no card) ou humano chamado — nunca no vácuo.",
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
          antes: "Tom neutro, igual nos três caminhos.",
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
    papel: "A consultora comercial da Metrik no WhatsApp — vende, agenda e escala",
    tipo: "resposta",
    state: "ativo",
    color: "#d98a5c",
    agora: "conduzindo um lead pra reunião de diagnóstico",
    expectativa: "Todo lead que chama é atendido na hora, cai numa das 3 rotas (implementação, Kommo Academy ou GHL Academy) e sai com reunião marcada, checkout na mão ou humano assumindo.",
    metrics: { execucoes: 48, acertos: 47, erros: 0, custo: "R$ 2,31" },
    shield: "As rotas, os preços oficiais (R$ 997 · R$ 197 · R$ 47) e as travas de escalação são blindados — vêm do prompt certificado. Você ajusta o tom, nunca a oferta.",
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
      { tipo: "elogio", titulo: "Rota certa de primeira", texto: "47 de 48 conversas caíram na rota certa sem entrevista longa.", prova: "máx. 2 perguntas de triagem, como manda a regra." },
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
        faz: "Se apresenta, responde primeiro o que a pessoa perguntou e descobre em NO MÁXIMO 2 perguntas qual é o caso",
        coleta: ["é pra empresa própria ou pra aprender e prestar serviço?", "principal gargalo comercial", "Kommo, GHL ou agentes? (se for aprender)"],
      },
      ramos: [
        {
          id: "implementacao", nome: "Implementação (empresa)", cor: "#58aae4",
          quando: "quer resultado na própria operação: fala de equipe, atendimento, CRM, funil, automação",
          coleta: ["gargalo principal", "segmento", "CRM atual (só se mudar a recomendação)"],
          on: true, execucoesHoje: 6, ultima: "há 12 min — lead jurídico",
          regras: [
            {
              se: "o lead aceita a reunião de diagnóstico",
              entao: "consulta a agenda real e oferece 2–3 horários em dias diferentes; confirma por extenso",
              diz: "Consegui quinta às 10h ou sexta às 14h. Qual fica melhor pra você?",
              move: "→ etapa “Diagnóstico agendado” (tag agendado entra, tag ia sai)",
            },
            {
              se: "pergunta o preço da implementação",
              entao: "NUNCA inventa preço no chat: explica que depende do escopo e leva pro diagnóstico",
              diz: "O investimento depende do escopo do seu cenário. No diagnóstico a gente desenha isso certinho, sem chute.",
            },
            {
              se: "nenhum horário serve",
              entao: "escala pra uma pessoa buscar um encaixe",
              aviso: true,
            },
          ],
        },
        {
          id: "kommo", nome: "Kommo Academy · R$ 997/ano", cor: "#e0a44a",
          quando: "quer aprender Kommo, prestar serviço ou implementar pra clientes",
          on: true, execucoesHoje: 4, ultima: "há 18 min — agência SP",
          regras: [
            {
              se: "o interesse por aprender Kommo fica claro",
              entao: "apresenta a oferta completa OBRIGATORIAMENTE já na primeira resposta",
              diz: "Kommo Academy, R$ 997 por ano: mais de 50 horas do zero ao avançado, IA e automação aplicadas a vendas e aulas ao vivo de segunda a quinta.",
            },
            {
              se: "diz que quer entrar",
              entao: "envia o checkout NA MESMA resposta — nunca “depois te mando o link”",
              move: "→ checkout na resposta + funil educação",
            },
          ],
        },
        {
          id: "ghl", nome: "GHL Academy · R$ 197/mês", cor: "#34d399",
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
              entao: "só então apresenta o webinar de Claude Code por R$ 47; pro link, chama o time (não está no catálogo)",
              move: "→ oferta de último recurso",
              aviso: true,
            },
          ],
        },
      ],
      aposRamos: "Todo caminho termina em: diagnóstico agendado, venda com checkout na resposta, ou humano assumindo — com o CRM atualizado em silêncio. Suporte, irritação ou pedido de humano escalam na hora, sem vender.",
      mudancas: [],
    },
  },
];

export const AGENT_BY_ID = (id: string) => AGENTS.find((a) => a.id === id);

export const STATE_META: Record<AgentState, { label: string; color: string }> = {
  ativo: { label: "trabalhando", color: "#34d399" },
  idle: { label: "em espera", color: "#83879a" },
  pausado: { label: "pausado", color: "#fbbf24" },
};

export const STATS = [
  { label: "Agentes no ar", value: "5", delta: "de 7", up: true },
  { label: "Execuções hoje", value: "774", delta: "+18%", up: true },
  { label: "Acertos", value: "99,3%", delta: "+0,4pp", up: true },
  { label: "Custo do dia", value: "R$ 13,97", delta: "estável", up: true },
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
  { id: "m2", name: "Recuperar no-show", icon: CalendarX, color: "#34d399", blurb: "reativa quem faltou na reunião, sem você lembrar", gatilho: "faltou na reunião", acao: "reoferece 2 horários", installed: true, tag: "popular" },
  { id: "m3", name: "Alerta por palavra", icon: BellRing, color: "#fbbf24", blurb: "te avisa quando alguém fala “cancelar” ou “reembolso”", gatilho: "palavra crítica", acao: "avisa seu grupo", installed: true },
  { id: "m1", name: "Upsell inteligente", icon: TrendingUp, color: "#e0a44a", blurb: "oferece o upgrade certo pra quem já é cliente", gatilho: "compra confirmada", acao: "sugere o plano acima", installed: false, tag: "popular" },
  { id: "m5", name: "Contrato ZapSign", icon: FileSignature, color: "#7c9fe0", blurb: "gera e manda o contrato pra assinar assim que fecha", gatilho: "negócio ganho", acao: "envia contrato", installed: false, tag: "novo" },
  { id: "m4", name: "Enriquecer campo", icon: Sparkles, color: "#58aae4", blurb: "descobre e completa os dados do lead sozinho", gatilho: "dado faltando", acao: "preenche o campo", installed: false },
  { id: "m6", name: "Rastreio de origem", icon: Radar, color: "#58aae4", blurb: "mostra de qual anúncio cada lead realmente veio", gatilho: "novo lead", acao: "marca a origem", installed: true },
  { id: "m7", name: "Auditoria de funil", icon: ScanSearch, color: "#fb7185", blurb: "acha leads parados e dinheiro esquecido no funil", gatilho: "toda segunda", acao: "manda o relatório", installed: true },
  { id: "m8", name: "Resumo por voz", icon: Volume2, color: "#58aae4", blurb: "te manda um áudio com o resumo do dia", gatilho: "fim do dia", acao: "envia o áudio", installed: false, tag: "novo" },
];

export const CHAT_EXEMPLOS = [
  "Deixa o follow-up com só 2 toques",
  "Puxa o preço de outra API",
  "Fala num tom mais próximo",
  "Não oferece desconto sem eu aprovar",
];

export const CONEXOES_MCP = [
  { id: "claude", name: "Claude Code", desc: "conecte e peça direto do terminal — vira mudança segura, testada e reversível aqui dentro", status: "conectado", color: "#e0a44a" },
  { id: "codex", name: "Codex", desc: "mesma tomada, outro assistente — a Metrik aprova e publica com prova", status: "conectado", color: "#58aae4" },
];

export const CONEXOES_CANAIS = [
  { id: "ghl", name: "GoHighLevel", tipo: "CRM", status: "conectado", ok: true },
  { id: "kommo", name: "Kommo", tipo: "CRM", status: "conectado", ok: true },
  { id: "wa", name: "WhatsApp", tipo: "Canal", status: "+55 21 9 8174-0018", ok: true },
  { id: "cal", name: "Google Agenda", tipo: "Agenda", status: "conectado", ok: true },
];
