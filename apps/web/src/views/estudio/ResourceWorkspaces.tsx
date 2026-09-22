import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Check,
  CircleDashed,
  Clock3,
  ContactRound,
  FlaskConical,
  MessagesSquare,
  Play,
  Search,
  Send,
  ShieldCheck,
  TimerReset,
  Zap,
} from "lucide-react";
import type { Agent } from "../../data";
import type { LogReal } from "../../lib/live";
import { tempoRelativo } from "../../lib/live";
import { BentoGrid } from "../../components/ui/bento-grid";
import { BentoCard } from "../../components/ui/bento-grid-utils/bento-card";
import type { BrainPiece } from "./AgentBrainMap";

export type FollowupSummary = {
  wait: string;
  touches: number;
  channel: string;
};

const resourceCopy: Record<string, { test: string; live: string; event: string }> = {
  conversa: {
    test: "Converse com o agente e confira a resposta que o lead receberia.",
    live: "Conversas e decisões tomadas pelo prompt agora.",
    event: "conversa",
  },
  followup: {
    test: "Simule a cadência sem enviar nenhuma mensagem real.",
    live: "Fila, disparos e retomadas feitas pelo Follow-up.",
    event: "disparo",
  },
  base: {
    test: "Faça uma pergunta e confira quais materiais seriam consultados.",
    live: "Consultas feitas à base para responder os leads.",
    event: "consulta",
  },
  campos: {
    test: "Veja quais dados seriam extraídos e gravados no CRM.",
    live: "Campos do lead atualizados pelo agente.",
    event: "atualização",
  },
  agenda: {
    test: "Simule a busca de horário e o próximo passo do agendamento.",
    live: "Horários consultados e reuniões marcadas.",
    event: "agendamento",
  },
  midia: {
    test: "Confira como o agente interpreta um arquivo recebido.",
    live: "Áudios, imagens e documentos processados.",
    event: "arquivo",
  },
};

function copyFor(piece: BrainPiece) {
  return resourceCopy[piece.id] ?? {
    test: `Confira o comportamento de ${piece.nome} antes de usar em produção.`,
    live: `Atividade real de ${piece.nome}.`,
    event: "execução",
  };
}

function textOf(log: LogReal) {
  const did = typeof log.did === "string" ? log.did : JSON.stringify(log.did ?? {});
  return `${log.motor ?? ""} ${log.resumo} ${did} ${log.meta?.tipo ?? ""}`.toLowerCase();
}

function matchesResource(log: LogReal, piece: BrainPiece) {
  const text = textOf(log);
  const eventText = `${log.motor ?? ""} ${log.resumo} ${log.meta?.tipo ?? ""}`.toLowerCase();
  if (piece.id === "conversa") return !/(follow|cad[eê]ncia|disparo|agenda|calendar|arquivo|[aá]udio|pdf|campo|crm|base|fonte|documento)/i.test(eventText);
  if (piece.id === "followup") return /(follow|cad[eê]ncia|disparo|retom|toque|template|esgotado)/i.test(eventText);
  if (piece.id === "base") return /(base|fonte|documento|conhecimento|retriev)/i.test(text);
  if (piece.id === "campos") return /(crm|campo|card|lead|pipeline|etapa)/i.test(text);
  if (piece.id === "agenda") return /(agenda|calendar|reuni|hor[aá]rio|appointment)/i.test(text);
  if (piece.id === "midia") return /(arquivo|[aá]udio|imagem|pdf|m[ií]dia|media)/i.test(text);
  return text.includes(piece.id.replace(/^(feature|motor|modulo):/, "")) || text.includes(piece.nome.toLowerCase());
}

function TestBadge({ children }: { children: string }) {
  return <span className="resource-test-badge"><CircleDashed size={12} />{children}</span>;
}

export function ResourceTestWorkspace({
  piece,
  agent,
  followup,
  versionLabel,
}: {
  piece: BrainPiece;
  agent: Agent;
  followup: FollowupSummary;
  versionLabel: string;
}) {
  const [simulation, setSimulation] = useState(false);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const knowledge = agent.work?.kind === "conhecimento" ? (agent.work.conhecimento ?? []) : [];
  const copy = copyFor(piece);

  if (piece.id === "followup") {
    return (
      <div className="resource-workspace scroll-thin">
        <header className="resource-workspace-head">
          <div><span>TESTAR · FOLLOW-UP</span><h2>Veja a cadência acontecer</h2><p>{copy.test}</p></div>
          <TestBadge>{versionLabel}</TestBadge>
        </header>
        <BentoGrid className="resource-bento-grid">
          <BentoCard title="Ensaio da cadência" description="Cenário: o lead parou de responder no meio da conversa." eyebrow="SIMULAÇÃO SEGURA" icon={<TimerReset size={17} />} colSpan={3}>
            <div className="followup-simulation" data-running={simulation ? "true" : "false"}>
              <div data-state="done"><span><Check size={13} /></span><div><strong>Lead ficou sem responder</strong><small>gatilho identificado na conversa</small></div></div>
              <i />
              <div data-state={simulation ? "done" : "next"}><span>{simulation ? <Check size={13} /> : <Clock3 size={13} />}</span><div><strong>Espera {followup.wait}</strong><small>nenhuma mensagem é enviada durante a espera</small></div></div>
              <i />
              <div data-state={simulation ? "active" : "waiting"}><span><Send size={13} /></span><div><strong>Primeiro toque</strong><small>{simulation ? `pronto para sair por ${followup.channel}` : "aguardando a simulação"}</small></div></div>
            </div>
            <button type="button" className="resource-primary-action" onClick={() => setSimulation(true)}>
              <Play size={14} /> {simulation ? "Rodar de novo" : "Simular cadência"}
            </button>
          </BentoCard>
          <BentoCard title="Regra em teste" description="A configuração usada neste ensaio." eyebrow="CONFIGURAÇÃO" icon={<ShieldCheck size={17} />}>
            <dl className="resource-facts">
              <div><dt>Espera</dt><dd>{followup.wait}</dd></div>
              <div><dt>Limite</dt><dd>{followup.touches} {followup.touches === 1 ? "toque" : "toques"}</dd></div>
              <div><dt>Canal</dt><dd>{followup.channel}</dd></div>
            </dl>
          </BentoCard>
          <BentoCard title="O que o Guardião confere" description="Antes de valer, o agente precisa respeitar estas travas." eyebrow="CRITÉRIOS" icon={<FlaskConical size={17} />} colSpan={4}>
            <div className="resource-checks">
              <span><Check size={13} /> não dispara antes da espera</span>
              <span><Check size={13} /> para quando o lead responde</span>
              <span><Check size={13} /> respeita o limite de toques</span>
              <span><Check size={13} /> usa apenas o canal conectado</span>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    );
  }

  if (piece.id === "base") {
    const visible = searched ? knowledge.filter((item) => `${item.cat} ${item.titulo}`.toLowerCase().includes(query.toLowerCase()) || !query.trim()) : knowledge;
    return (
      <div className="resource-workspace scroll-thin">
        <header className="resource-workspace-head">
          <div><span>TESTAR · BASE DE CONHECIMENTO</span><h2>Teste de onde viria a resposta</h2><p>{copy.test}</p></div>
          <TestBadge>{versionLabel}</TestBadge>
        </header>
        <BentoGrid className="resource-bento-grid">
          <BentoCard title="Pergunta de teste" description="Isto consulta o índice visual; não envia nada ao lead." eyebrow="PERGUNTA" icon={<Search size={17} />} colSpan={3}>
            <form className="resource-query" onSubmit={(event) => { event.preventDefault(); setSearched(true); }}>
              <input value={query} onChange={(event) => { setQuery(event.target.value); setSearched(false); }} placeholder="Ex.: qual é o prazo de implantação?" />
              <button type="submit"><Search size={14} /> Buscar fontes</button>
            </form>
          </BentoCard>
          <BentoCard title="Materiais disponíveis" description="Itens que o agente pode consultar." eyebrow="BASE ATUAL" icon={<BookOpenText size={17} />}>
            <strong className="resource-big-number">{knowledge.length}</strong>
            <span className="resource-big-caption">fontes cadastradas</span>
          </BentoCard>
          <BentoCard title={searched ? "Fontes encontradas" : "Fontes que serão verificadas"} description={searched && visible.length === 0 ? "Nenhum material correspondeu a esta busca." : "A resposta só pode usar o que estiver disponível aqui."} eyebrow="RASTREABILIDADE" icon={<Zap size={17} />} colSpan={4}>
            <div className="resource-source-list">
              {(visible.length ? visible : knowledge).slice(0, 6).map((item, index) => <span key={`${item.titulo}-${index}`}><small>{item.cat}</small><strong>{item.titulo}</strong></span>)}
              {knowledge.length === 0 ? <div className="resource-inline-empty">Nenhum material disponível neste agente.</div> : null}
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    );
  }

  if (piece.id === "campos") {
    const fields = ["Nome", "Empresa", "WhatsApp", "Interesse"];
    return (
      <div className="resource-workspace scroll-thin">
        <header className="resource-workspace-head">
          <div><span>TESTAR · CAMPOS DO LEAD</span><h2>Veja o CRM antes de gravar</h2><p>{copy.test}</p></div>
          <TestBadge>{versionLabel}</TestBadge>
        </header>
        <BentoGrid className="resource-bento-grid">
          <BentoCard title="Conversa de exemplo" description="Dados reconhecidos na fala do lead." eyebrow="ENTRADA" icon={<MessagesSquare size={17} />} colSpan={2}>
            <blockquote className="resource-quote">“Sou a Marina, da Vértice. Quero entender a implantação e pode me chamar neste WhatsApp.”</blockquote>
            <button type="button" className="resource-primary-action" onClick={() => setSimulation(true)}><Play size={14} /> {simulation ? "Simular de novo" : "Simular preenchimento"}</button>
          </BentoCard>
          <BentoCard title="Card que seria atualizado" description="Prévia sem escrever no CRM." eyebrow="SAÍDA" icon={<ContactRound size={17} />} colSpan={2}>
            <div className="resource-field-list">
              {fields.map((field, index) => <div key={field}><span>{field}</span><strong>{simulation ? ["Marina", "Vértice", "número da conversa", "Implantação"][index] : "—"}</strong>{simulation ? <Check size={13} /> : null}</div>)}
            </div>
          </BentoCard>
          <BentoCard title="Regra de segurança" description="Só grava quando o valor aparece claramente na conversa." eyebrow="GUARDIÃO" icon={<ShieldCheck size={17} />} colSpan={4}>
            <div className="resource-checks"><span><Check size={13} /> não inventa dados ausentes</span><span><Check size={13} /> preserva valores já confirmados</span><span><Check size={13} /> registra a origem da atualização</span></div>
          </BentoCard>
        </BentoGrid>
      </div>
    );
  }

  return (
    <div className="resource-workspace scroll-thin">
      <header className="resource-workspace-head">
        <div><span>TESTAR · {piece.nome.toUpperCase()}</span><h2>{piece.nome} em um cenário seguro</h2><p>{copy.test}</p></div>
        <TestBadge>{versionLabel}</TestBadge>
      </header>
      <BentoGrid className="resource-bento-grid">
        <BentoCard title="O que entra" description="O evento que aciona este recurso." eyebrow="CENÁRIO" icon={<Play size={17} />} colSpan={2}>
          <p className="resource-card-copy">{piece.resumo}</p>
        </BentoCard>
        <BentoCard title="O que deve acontecer" description="Resultado esperado antes de publicar." eyebrow="RESULTADO" icon={<ArrowRight size={17} />} colSpan={2}>
          <p className="resource-card-copy">O recurso executa sua função e deixa o resultado registrado no Ao vivo.</p>
        </BentoCard>
        <BentoCard title="Guardião" description="Valida o comportamento sem afetar um lead real." eyebrow="PROTEÇÃO" icon={<ShieldCheck size={17} />} colSpan={4}>
          <div className="resource-checks"><span><Check size={13} /> gatilho correto</span><span><Check size={13} /> ação esperada</span><span><Check size={13} /> resultado rastreável</span></div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}

export function ResourceLiveWorkspace({ piece, agent, logs }: { piece: BrainPiece; agent: Agent; logs: LogReal[] }) {
  const copy = copyFor(piece);
  const resourceLogs = useMemo(() => logs.filter((log) => matchesResource(log, piece)), [logs, piece]);
  const followups = piece.id === "followup" && agent.work?.kind === "followups" ? (agent.work.followups ?? []) : [];
  const queued = followups.filter((item) => item.status !== "feito");
  const successful = resourceLogs.filter((log) => log.ok).length;

  return (
    <div className="resource-workspace scroll-thin">
      <header className="resource-workspace-head">
        <div><span>AO VIVO · {piece.nome.toUpperCase()}</span><h2>{piece.id === "followup" ? "Disparos e fila agora" : `Atividade de ${piece.nome}`}</h2><p>{copy.live}</p></div>
        <span className="resource-live-badge"><i /> atualiza sozinho</span>
      </header>
      <BentoGrid className="resource-bento-grid">
        <BentoCard
          title={piece.id === "followup" ? "Últimos disparos" : `Últimas ${copy.event === "execução" ? "execuções" : `${copy.event}s`}`}
          description={piece.id === "followup" ? "Somente eventos do Follow-up aparecem aqui." : `Somente eventos ligados a ${piece.nome}.`}
          eyebrow="ATIVIDADE REAL"
          icon={piece.id === "followup" ? <Send size={17} /> : <Zap size={17} />}
          colSpan={3}
        >
          <div className="resource-event-list">
            {piece.id === "followup" && followups.length > 0 ? followups.map((item, index) => (
              <div key={`${item.quem}-${index}`}><span data-ok={item.status === "feito" ? "true" : "pending"}>{item.status === "feito" ? <Check size={13} /> : <Clock3 size={13} />}</span><div><strong>{item.quem}</strong><small>{item.toque}</small></div><time>{item.quando}</time></div>
            )) : resourceLogs.slice(0, 12).map((log) => (
              <div key={log.id}><span data-ok={log.ok ? "true" : "false"}>{log.ok ? <Check size={13} /> : <CircleDashed size={13} />}</span><div><strong>{log.resumo}</strong><small>{piece.id === "followup" ? "Follow-up" : (log.motor || piece.nome)}</small></div><time>{tempoRelativo(log.at)}</time></div>
            ))}
            {followups.length === 0 && resourceLogs.length === 0 ? (
              <div className="resource-event-empty"><span><CircleDashed size={17} /></span><strong>Nenhuma {copy.event} registrada</strong><small>Quando {piece.nome} agir, o evento aparece aqui — sem misturar com outros recursos.</small></div>
            ) : null}
          </div>
        </BentoCard>
        <div className="resource-side-stack lg:col-span-1">
          <BentoCard title={piece.id === "followup" ? "Na fila" : "Hoje"} eyebrow="AGORA" icon={<Clock3 size={16} />}>
            <strong className="resource-big-number">{piece.id === "followup" ? queued.length : resourceLogs.length}</strong>
            <span className="resource-big-caption">{piece.id === "followup" ? "contatos aguardando" : `${copy.event}s registradas`}</span>
          </BentoCard>
          <BentoCard title="Sem erro" eyebrow="SAÚDE" icon={<ShieldCheck size={16} />}>
            <strong className="resource-big-number">{resourceLogs.length ? `${successful}/${resourceLogs.length}` : "—"}</strong>
            <span className="resource-big-caption">execuções concluídas</span>
          </BentoCard>
        </div>
      </BentoGrid>
    </div>
  );
}
