import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const assets = "./dist/assets";
const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));

const css = readFileSync(`${assets}/${cssFile}`, "utf8");
let js = readFileSync(`${assets}/${jsFile}`, "utf8");
js = js.replace(/<\/script>/gi, "<\\/script>");

const out = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

const target =
  "C:/Users/compu/AppData/Local/Temp/claude/C--Users-compu-OneDrive-Documentos-prompts-metrik-geral-CLAUDE-IA---AGENTES-EM-PYTHON/67582adf-520c-4e50-aefa-8ecaef8a7ed4/scratchpad/motor-os.html";
writeFileSync(target, out);
console.log(`OK -> ${target}\nbytes: ${out.length} (js ${js.length}, css ${css.length})`);
