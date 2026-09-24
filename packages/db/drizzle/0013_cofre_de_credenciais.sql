CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"rotulo" text DEFAULT 'padrao' NOT NULL,
	"segredo_cifrado" text NOT NULL,
	"renovacao_cifrada" text,
	"chave_versao" integer DEFAULT 1 NOT NULL,
	"dica" text,
	"meta" jsonb,
	"expira_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_em" timestamp with time zone,
	"revogada_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credentials_org" ON "credentials" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_org_kind_rotulo" ON "credentials" USING btree ("org_id","kind","rotulo");--> statement-breakpoint
-- A tabela mais sensível da plataforma nasce sob a política de conta (S-011).
-- Sem isto, uma consulta distraída leria o cofre de todos os clientes de uma
-- vez — e o conteúdo estaria cifrado, mas a lista de quem tem o quê já é
-- informação demais.
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS credentials_da_conta ON credentials;--> statement-breakpoint
CREATE POLICY credentials_da_conta ON credentials FOR ALL TO metrik_app
	USING (org_id = conta_em_curso())
	WITH CHECK (org_id = conta_em_curso());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON credentials TO metrik_app;
