# Etapa 1 — Caderneta com o servidor como fonte da verdade

## O que está pronto (e testado)
| Peça | Arquivo |
|---|---|
| Esquema + regras no banco (gatilhos) | `migrations/0003_caderneta.sql` |
| Operações idempotentes, leitura incremental, conferência | `functions/_lib/caderneta.js` |
| Rotas | `functions/api/caderneta/ops.js` (POST), `estado.js` (GET), `conferencia.js` (GET) |
| Fila offline + "N alterações aguardando" | `src/services/filaOperacoes.js`, `src/composables/useFilaOps.js` |
| Migração do backup JSON → SQL + relatório | `scripts/migrar-caderneta.mjs` |
| Testes (29) | `tests-servidor/` → `npm run test:servidor` |
| Correção | `functions/api/ping.js` exigia a tabela `registros`, que a migração 0002 apaga (ping nunca ficava verde) |

Verificado também no motor D1 real (`wrangler d1 migrations apply --local`): migrações aplicam, o SQL de importação roda e tentativas de violar as regras são recusadas.

## Regras que o banco garante (mesmo com SQL direto)
saldo ≥ 0 e ≤ total · "pago" ⇔ saldo 0 · pagamento ≤ saldo · saldo = total − pagamentos não estornados (conferido a cada alteração) · estorno é linha nova, pagamento nunca é apagado · pagamentos, estornos, itens e operações imutáveis · nada é excluído (arquivar/cancelar) · telefone e nome de loja únicos.

## Decisões que tomei (confirme)
1. **Sem tolerância de R$ 0,01.** Em centavos inteiros, quitar exige saldo exato.
2. **Pagamento maior que o saldo é recusado**, não cortado em silêncio. Aparece como "recusada" no aparelho para alguém decidir.
3. **Excluir venda vira cancelar** (só sem pagamento ativo). Loja/cliente só arquivam.
4. **Renomear loja/cliente não reescreve as vendas**; cada venda guarda o nome da época e a tela mostra o nome atual pelo vínculo.
5. **Sem token no aparelho**: as rotas novas usam o login do Cloudflare Access (já existe em `_lib/acesso.js`).

## Para colocar no ar
1. `wrangler d1 migrations apply <banco> --remote` (aplica 0003 e 0004) (faça antes um `wrangler d1 export`).
2. Proteger `/api/caderneta/*` no Cloudflare Access e conferir `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD`.
3. Com o backup JSON real: `npm run migrar:caderneta -- backup.json --saida=./saida`; ler `relatorio.md`; só prosseguir se as conferências fecharem e a quarentena estiver decidida.
4. `wrangler d1 execute <banco> --remote --file=saida/importar-caderneta.sql`, depois `GET /api/caderneta/conferencia` e comparar com o relatório.

## Etapa 1b — telas ligadas ao servidor (parte 1: cobrança)

**Modo servidor, por aparelho, desligado por padrão.** Com ele desligado o app funciona exatamente como antes.
Ligar/desligar pelo link: `https://SEU-SITE/?caderneta=servidor` · `https://SEU-SITE/?caderneta=local`.

Com o modo ligado:
- **Receber, quitar tudo, recebimento parcial, estorno e mudar vencimento** viram operações na fila. A fila é gravada
  **antes** da tela atualizar (se o app fechar no meio, a intenção não se perde). A tela mostra o resultado na hora, mesmo sem sinal.
- O botão/indicador **"N alterações aguardando"** aparece no topo da Caderneta; recusas do servidor aparecem ali, com o motivo.
- O banco local vira **espelho do servidor** (`projetarServidorNoLocal`): vendas, lojas e clientes criados em outro aparelho aparecem aqui.
  Venda com operação ainda pendente não é sobrescrita.
- A Caderneta **sai do merge do Drive** (um arquivo antigo não desfaz o que o servidor decidiu). O Drive segue só como cópia.
- **Guarda**: o que ainda não tem operação no servidor (venda nova, editar, excluir, loja, cliente) é **barrado** com aviso, em vez de gravar só no aparelho.

Arquivos: `src/services/{modoServidor,uidServidor,guardaServidor,cadernetaServidor}.js`, `src/components/FilaIndicador.vue`;
alterados: `src/services/merge.js`, `src/composables/useCaderneta.js` (pagamento ganha `uid`), `src/views/TabCaderneta.vue`, `src/App.vue`.

### Roteiro de ativação (só quando as partes 2 e 3 também estiverem prontas)
1. Servidor com a migração aplicada e os dados importados e conferidos (seção "Para colocar no ar").
2. Aparelho **Admin** e **Vendas** com o app atualizado; Drive sincronizado uma última vez.
3. Ligar o modo servidor **em todos os aparelhos no mesmo dia**; a partir daí o sistema antigo fica só para consulta.
4. Primeiro dia: conferir `/api/caderneta/conferencia` à noite contra o caderno.

## Etapa 1b — parte 2: lançar, cancelar e corrigir

Decisão tomada: **corrigir = cancelar a venda errada e lançar a certa** (nada é reescrito).

| Situação | O que acontece no modo servidor |
|---|---|
| Lançou cobrança **nova** (vale sem sinal) | operação `venda.criar` na fila; a tela mostra na hora |
| Lançou **sem querer / duplicada** | **Cancelar** (era "Excluir"), com motivo. Fica no histórico; sai da cobrança |
| **Desfazer** logo após lançar | também vira cancelamento (com rastro) |
| **Valor/itens/desconto/datas errados** ("Editar venda") | `venda.corrigir`: cancela a antiga e cria a nova **numa operação só** (tudo ou nada); a nova guarda qual venda substitui |
| Venda **com pagamento** a cancelar/corrigir | barrado: estorne o pagamento antes (o histórico do dinheiro não é reescrito) |
| **Pagamento errado/duplicado** | **Estorno**: o pagamento continua no histórico; saldo volta, venda reabre |
| Toque duplo / reenvio por queda de sinal | não duplica (identificador por operação; servidor recusa pagamento acima do saldo) |
| Ver o que foi cancelado/corrigido/estornado | indicador no topo da Caderneta → "Ver cancelamentos, correções e estornos" |

Observações: "nota livre" (venda sem itens) vira um item único com o texto da nota. Migração nova: `0004_cad_vendas_substitui.sql`.

## O que NÃO está feito
- **Parte 3: loja e cliente** (criar, editar, arquivar, juntar duplicados). Hoje ficam barrados no modo servidor.
- **Quem pode cancelar/corrigir**: ainda não há restrição por perfil no servidor (só se registra quem fez). Sugestão: só Admin.
- **Duplicidade de venda** só é avisada na tela ("Lançar mesmo assim", já existente); o servidor aceita duas vendas iguais, porque pode ser compra repetida de verdade.
- **Backup diário fora do servidor + teste de restauração.**
- **Teste no aparelho real** (a lógica foi testada com banco local e servidor reais, não a tela tocada com o dedo).
- As pastas `tests-papel/` e `tests-backup/` citadas no `package.json` não vieram no zip; os testes existentes do merge não foram rodados.
- Financeiro, receitas e cardápio: etapas seguintes.
