// Seed de demonstração — roda quando DATABASE_URL estiver setado:
//   DATABASE_URL=... npm run seed --workspace @motor/db
// Cria uma org, um membro dono e dois agentes, provando o fluxo multi-tenant.
import { db, organizations, memberships, agents } from "./index";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("falta DATABASE_URL");

  const [org] = await db.insert(organizations).values({ name: "Vega Consultoria" }).returning();
  await db.insert(memberships).values({ orgId: org.id, userId: "demo-owner", role: "owner" });
  await db.insert(agents).values([
    { orgId: org.id, name: "Atendente", tipo: "resposta", state: "ativo" },
    { orgId: org.id, name: "Petições", tipo: "acao", state: "ativo" },
  ]);

  console.log("✅ seed ok — org:", org.id);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ seed falhou:", e);
    process.exit(1);
  });
