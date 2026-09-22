import { useRef } from "react";
import { CalendarDays, Check, CircuitBoard, ContactRound, Database, MessageCircle, Plug, Wrench } from "lucide-react";
import { AnimatedBeam } from "../components/ui/AnimatedBeam";
import { CONEXOES_CANAIS } from "../data";
import { Reveal, SectionHeader } from "../ui";

const CHANNEL_ICONS = {
  ghl: Database,
  kommo: ContactRound,
  wa: MessageCircle,
  cal: CalendarDays,
};

export default function Conexoes() {
  const mapRef = useRef<HTMLDivElement>(null);
  const ghlRef = useRef<HTMLDivElement>(null);
  const kommoRef = useRef<HTMLDivElement>(null);
  const waRef = useRef<HTMLDivElement>(null);
  const calRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const refs = { ghl: ghlRef, kommo: kommoRef, wa: waRef, cal: calRef };

  const channelNode = (id: keyof typeof refs) => {
    const channel = CONEXOES_CANAIS.find((item) => item.id === id)!;
    const Icon = CHANNEL_ICONS[id];
    return (
      <div ref={refs[id]} className="connection-node" key={id}>
        <span><Icon size={16} /></span>
        <div><strong>{channel.name}</strong><small>{channel.tipo} · ligado</small></div>
        <i aria-label="conectado" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="connection-hero">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Plug size={16} className="text-[var(--violet)]" />
              <span className="mono-label">As conexões da sua operação</span>
            </div>
            <h2 className="font-display text-[22px] md:text-[26px] font-semibold tracking-tight">
              Tudo conversa com o <span className="grad-text">motor Metrik</span>.
            </h2>
            <p className="text-[var(--txt-2)] mt-2.5 text-[14px] leading-relaxed">
              CRM, WhatsApp e agenda chegam ao mesmo núcleo. Você vê o fluxo; a Metrik cuida da parte técnica.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <section className="connection-map-shell" aria-labelledby="connection-map-title">
          <div className="connection-map-head">
            <div>
              <span className="mono-label">Fluxo operacional</span>
              <h3 id="connection-map-title">Uma operação, quatro pontos ligados</h3>
            </div>
            <span className="connection-map-status"><i /> sincronizado agora</span>
          </div>
          <div ref={mapRef} className="connection-map">
            <div className="connection-map-column">{channelNode("ghl")}{channelNode("kommo")}</div>
            <div ref={hubRef} className="connection-hub">
              <span><CircuitBoard size={22} /></span>
              <strong>Motor Metrik</strong>
              <small>decide · executa · registra</small>
            </div>
            <div className="connection-map-column">{channelNode("wa")}{channelNode("cal")}</div>
            <AnimatedBeam containerRef={mapRef} fromRef={ghlRef} toRef={hubRef} duration={4.2} />
            <AnimatedBeam containerRef={mapRef} fromRef={kommoRef} toRef={hubRef} delay={0.7} duration={4.8} curvature={-24} />
            <AnimatedBeam containerRef={mapRef} fromRef={waRef} toRef={hubRef} reverse delay={0.35} duration={4.5} />
            <AnimatedBeam containerRef={mapRef} fromRef={calRef} toRef={hubRef} reverse delay={1.05} duration={5} curvature={24} />
          </div>
        </section>
      </Reveal>

      <div>
        <SectionHeader label="Estado das pontas" title="Canais e sistemas" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {CONEXOES_CANAIS.map((channel, index) => {
            const Icon = CHANNEL_ICONS[channel.id as keyof typeof CHANNEL_ICONS];
            return (
              <Reveal key={channel.id} delay={0.03 * index}>
                <div className="connection-status-card">
                  <span className="connection-status-icon">{Icon ? <Icon size={16} /> : <Plug size={16} />}</span>
                  <div><span>{channel.tipo}</span><strong>{channel.name}</strong></div>
                  <span className="connection-ok"><Check size={11} /> ligado</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      <Reveal delay={0.1}>
        <div className="connection-backstage">
          <span><Wrench size={17} /></span>
          <div>
            <strong>Bastidores da Metrik</strong>
            <p>Claude Code e Codex operam por trás do motor. Para você, toda alteração chega como mudança testada, rastreável e reversível.</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
