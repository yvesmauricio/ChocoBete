# Papel do aparelho (Admin / Vendas) — o que mudou

Cada aparelho é **Admin** ou **Vendas** (escolhido uma vez; guardado só no aparelho, fora do backup).
Cada área tem um único dono; no outro aparelho ela é só consulta.

| Área | Dono |
|---|---|
| Cobranças (`cad_lojas`, `cad_clientes`, `cad_fiados`), pedidos do balcão (`cardapio_pedidos`), config `cad_*` e `cardapio_config*` | **Vendas** |
| Todo o resto (receitas, produtos, produções, financeiro, históricos de preço, config da empresa, perfis…) | **Admin** |

## Defesas (cada uma tem teste — `npm run test:papel`)
1. **Trava no banco local** (`services/travaPorPapel.js`): gravar em área alheia é recusado (add/put/update/delete/bulk/modify/clear). Importar/mesclar passam por transação liberada.
2. **Regra de dono no merge** (`services/merge.js`, opção `papel`): o que não é do aparelho vem sempre do Drive; nunca é reenviado.
3. **Envio com o Drive sem mudança** também compõe por dono (`_paraEnvio` em `store.js`).
4. **Conferência antes de enviar/aplicar** (`services/validacaoDados.js`): queda brusca de registros ou cobrança incoerente *nova* pausa a sincronização, guarda cópia local e pede confirmação. Dado antigo incoerente não trava nada.
5. **Sem papel definido, o aparelho não sincroniza nem grava.**
6. O botão "enviar a versão deste aparelho" do conflito também respeita o dono.

## Interface
- Primeira abertura: "Que aparelho é este?" (Admin / Vendas + nome). Vendas abre direto na caderneta.
- Aviso "Somente consulta" ao ver a área de outro dono; cartões de perfil marcados.
- Restaurar de arquivo/pasta só no Admin; Vendas só "baixar do Google Drive".
- Ajustes → Perfis → "Este aparelho": função, nome, estado do envio, mudar função (só sem pendências).
- Monitor de pedidos do site roda só no aparelho Vendas.

## Limites conhecidos
- Restaurar um backup no **Admin** não restaura cobranças (elas voltam do Drive). Recuperar cobranças = aparelho Vendas / versões do Drive. Falta um "modo de emergência" explícito.
- O cardápio (edição e pedidos) passou a ser do Vendas; o Admin só consulta.
- Testado em Node com Dexie/IndexedDB simulados e Drive falso; **não** testado em navegador real nem no Drive real. A interface foi compilada, não exercitada visualmente.
- `src/store/sync.js` não é importado por ninguém (código morto, CRLF); o sync que vale está em `src/store.js`.
