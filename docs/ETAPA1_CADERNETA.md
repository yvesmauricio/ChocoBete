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
1. `wrangler d1 migrations apply <banco> --remote` (aplica 0003 a 0006) (faça antes um `wrangler d1 export`).
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

### Roteiro de ativação (todas as partes da Caderneta estão prontas)
**Pré-requisito:** `/api/caderneta/*` protegido pelo Cloudflare Access (o aparelho não guarda token; sem login a fila só acumula e o indicador pede login).
1. Servidor com migrações 0003 e 0004 aplicadas, dados importados e conferidos (seção "Para colocar no ar").
2. **Ensaio**: ligar o modo servidor em UM aparelho (`?caderneta=servidor`), lançar/receber/estornar/cancelar de teste, conferir `/api/caderneta/conferencia`, e voltar (`?caderneta=local`). Importar de novo antes da virada.
3. **Virada**: Drive sincronizado uma última vez → importar o backup final → ligar o modo servidor em **todos os aparelhos no mesmo dia**. A partir daí o sistema antigo é só consulta.
4. Primeiro dia: conferir `/api/caderneta/conferencia` à noite contra o caderno. Backup diário e teste de restauração **antes** de desligar o antigo.

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

## Etapa 1b — parte 3: loja e cliente

| Ação | No modo servidor |
|---|---|
| Criar / renomear loja, criar / editar cliente | operação na fila; vale sem sinal (cadastrar loja → cliente → lançar fiado tudo offline chega na ordem certa) |
| Renomear loja ou cliente | o servidor **não reescreve vendas antigas** (cada venda guarda o nome da época); a tela mostra o **nome atual**, como sempre mostrou |
| Mudar cliente de loja ("levar abertas") | as vendas **em aberto** vão junto; as **pagas** ficam na loja onde aconteceram |
| "Excluir" loja ou cliente sem histórico | **arquiva** (nada é apagado; o nome fica reservado) |
| Telefone ou nome repetido | barrado no aparelho; se outro aparelho cadastrou antes, o servidor recusa, o cadastro **some daqui** e a recusa aparece no indicador |
| "Juntar cadastros repetidos" | não se aplica: o servidor impede repetidos. Seus dados atuais não têm nenhum |

## Perfis (quem pode o quê) — no servidor, por PESSOA

O perfil vem do **e-mail do login** do Cloudflare Access (não do aparelho). Configure no projeto (Cloudflare → Variáveis; não são segredos, mas ficam **fora do banco** e do app):

| Variável | Exemplo | Para quê |
|---|---|---|
| `PAPEL_ADMIN_EMAILS` | `dono@seuemail.com` | quem é Admin (vírgula, espaço ou `;`) |
| `PAPEL_VENDAS_EMAILS` | `bete@seuemail.com` | quem é Vendas |
| `CADERNETA_VENDAS_TAMBEM_PODE` | `pagamento.estornar` | (opcional) libera ações extras para Vendas |
| `CADERNETA_JANELA_DESFAZER_MIN` | `15` | (opcional) minutos para a Vendas desfazer/corrigir a **própria** venda; `0` desliga |

Além disso: `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD` (login) e `ADMIN_TOKEN` (chave de administrador = Admin).
**Falha fechada:** e-mail que não está em nenhuma lista **não acessa** a Caderneta (403 "sem perfil"); sem as variáveis, ninguém entra por Access.

| Ação | Vendas | Admin |
|---|---|---|
| Lançar fiado, receber (total/parcial), mudar vencimento | ✅ | ✅ |
| Cadastrar/renomear/arquivar loja e cliente | ✅ | ✅ |
| **Estornar pagamento** | ❌ | ✅ |
| **Cancelar** ou **corrigir** compra | ❌ — exceto a **própria** compra, **sem pagamento**, nos primeiros **15 min** (o "Desfazer" continua funcionando) | ✅ |
| Ler a Caderneta | ✅ | ✅ |
| `/api/caderneta/conferencia` | ❌ | ✅ |

O servidor decide: operação sem permissão é **recusada antes de gravar**, fica **registrada** (quem, perfil, quando, motivo) e aparece no indicador do aparelho com a explicação. O app só esconde os botões que a pessoa não pode usar (Estornar, Editar, Excluir). Toda operação nova guarda o **perfil** de quem fez (migração 0005). Se o aparelho está sem sinal e ainda não sabe o perfil, esconde o que é restrito (o servidor confere de qualquer jeito).

No modo servidor, o **papel do aparelho** (Admin/Vendas) deixa de decidir a Caderneta: o aparelho do Admin também pode estornar/cancelar/corrigir, e o da Vendas fica limitado pelo perfil da pessoa que fez login.

## Backup diário (pronto — falta configurar na sua conta)
Guia completo: **`docs/BACKUP_E_RESTAURACAO.md`**. Resumo: todo dia às 03:17 (Brasília) o GitHub exporta o banco, **prova que a cópia restaura** (regras, saldos, nada perdido), criptografa e guarda num bucket fora do Cloudflare; uma **vigia** manda e-mail se o backup parar. Arquivos: `.github/workflows/backup-d1.yml`, `.github/workflows/backup-vigia.yml`, `scripts/backup/*`, migração `0006`, rota `/api/caderneta/backup` (chave **só de backup**, sem acesso a clientes).
**Simulado de restauração** (`npm run backup:simulado`) é o teste obrigatório antes de desligar o sistema antigo.

## O que NÃO está feito
- **Configurar o backup na sua conta e rodar a primeira vez** (bucket, chaves, secrets do GitHub: passo a passo no guia). A rotina foi ensaiada ponta a ponta aqui com servidor e bucket simulados, e a restauração foi provada no motor D1 real, mas **nunca rodou com a sua conta Cloudflare/GitHub/bucket**.
- **Teste no aparelho real**: a lógica foi testada com banco local e servidor reais (88 testes), mas não a tela tocada com o dedo, nem o login do Cloudflare Access.
- **Duplicidade de venda** só é avisada na tela ("Lançar mesmo assim"); o servidor aceita duas vendas iguais (pode ser compra repetida de verdade).
- As pastas `tests-papel/` e `tests-backup/` citadas no `package.json` não vieram no zip; os testes existentes do merge não foram rodados.
- Financeiro, receitas e cardápio: etapas seguintes.
