// A ENTRADA ÚNICA do pacote de serviço (control + runtime num só .mjs).
//
// POR QUE UM PACOTE SÓ. Antes eram dois — control.mjs e runtime.mjs — e cada um
// carregava a PRÓPRIA cópia de `@motor/db`: dois AsyncLocalStorage, dois pools.
// O `comConta` de um não transportava contexto para o `db` do outro, e o
// esbuild ainda eliminava `comContexto` do runtime por nunca ser chamado lá.
//
// Enquanto a aplicação conectava como dona do banco isso passava despercebido:
// sem contexto, a dona vê tudo. Com o papel restrito (S-046) o mesmo código
// devolvia ZERO linhas — `loadSpec` virava null e o webhook respondia "ok" ao
// canal sem fazer nada. Reproduzido com os pacotes reais sobre uma cópia de
// produção; o teste `pacote-unico.test.ts` guarda isso.
//
// Não há nome exportado em comum entre os dois módulos (conferido), então o
// reexport chapado é seguro. Se um dia houver, o TypeScript acusa aqui.
export * from "../../../packages/control/src/index";
export * from "../../../apps/runtime/src/index";
