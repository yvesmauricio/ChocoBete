# ChocoBete · colocar o cardápio no servidor (D1) — passo a passo

> **Correção urgente, independente do servidor (faça primeiro):** o `vite.config.js` do seu projeto já tinha um
> defeito que quebra o service worker (`PUBLIC_MENU_PATHS is not defined`). Aplique `correcao-service-worker.patch`
> (`git apply correcao-service-worker.patch`), faça build e push. Nos aparelhos, aceite o aviso de
> "atualização disponível" do app para trocar o service worker antigo pelo corrigido.

Tempo estimado: 30 a 40 minutos. **Até o passo 7 nada muda para os seus clientes.**
O app só passa a usar o servidor quando você cola a chave no passo 7.

## Parte 1 — Cloudflare (no painel)

1. **Criar o banco.** Storage & Databases → D1 → Create. Nome: `chocobete`.
2. **Criar as tabelas.** Abra o banco → aba **Console** → cole o conteúdo de `migrations/0001_cardapio.sql` → Execute.
   (Alternativa pelo terminal: `npx wrangler d1 execute chocobete --remote --file=migrations/0001_cardapio.sql`)
3. **Ligar o banco ao site.** Workers & Pages → seu projeto → Settings → Bindings → Add → D1 database.
   Variable name: `DB` (exatamente assim). Banco: `chocobete`. Faça em Production (e em Preview, se você usa).
4. **Criar a chave de administrador.** No computador: `openssl rand -hex 32` (ou um gerador de senhas com 64 letras/números).
   Settings → Variables and secrets → Add → tipo **Secret** → nome `ADMIN_TOKEN` → valor = a chave.
   Guarde a chave no seu gerenciador de senhas: você vai colá-la no app.

## Parte 2 — Código

5. Copie as pastas `functions/` e `migrations/` para a **raiz do projeto** (ao lado de `public/` e `src/`).
   Depois aplique as mudanças do app: `git apply alteracoes-app.patch`
   (ou copie os 4 arquivos de `app/src/...` por cima dos seus; use o patch se você mexeu neles depois de 29/10).
6. Rode `npm run build` para conferir, faça commit e push. O Cloudflare publica sozinho.

## Parte 3 — Ligar

7. Abra o app (versão nova) → Ajustes → Sistema → **Servidor do Cardápio (D1)** → cole a chave → **Salvar e testar**.
   Deve aparecer "Servidor conectado!".
8. No Cardápio **Dia a dia**, publique o link como você já faz. No celular, abra `seusite/pedido-diaadia` (sem `.html`).
9. **Faça um pedido de teste** (uma trufa) até o WhatsApp. Confira:
   - a mensagem tem a linha **"Pedido nº XXXXXX"**;
   - no Console do D1: `SELECT uuid, total_centavos, criado_em FROM pedidos ORDER BY criado_em DESC LIMIT 5;`
   - apague o teste depois: `DELETE FROM pedido_itens; DELETE FROM pedidos;`
10. Repita no cardápio **Festas**.

## Parte 4 — Depois de alguns dias estável

11. **Links antigos com `.html`**: copie `public-opcional/_redirects` para `public/_redirects`, faça push e teste abrir
    `seusite/pedido-diaadia.html` (deve ir para `/pedido-diaadia`).
12. **Apague o token do GitHub**: no GitHub → Settings → Developer settings → Fine-grained tokens → Revoke.
    No app: Ajustes → Link do Cardápio Interativo → apague o token → Salvar.

## Voltar atrás (se precisar)

- Ajustes → Servidor do Cardápio → apague a chave → Salvar. O app tira as versões do servidor do ar
  (precisa de internet) e os links voltam ao arquivo do GitHub. Publique de novo pelo GitHub para atualizar.
- Se o app não conseguir, no Console do D1: `UPDATE cardapios SET html = NULL;`

## Se algo parecer errado

- **Abre a página antiga mesmo depois de publicar:** confirme que o binding `DB` existe e que o deploy terminou.
  Se persistir, o arquivo estático está vencendo a função: apague `public/pedido-diaadia.html` e
  `public/pedido-festa.html` do repositório e faça push (o app recria o arquivo se você publicar pelo GitHub).
- **"Token não aceito":** a chave do app tem que ser idêntica ao `ADMIN_TOKEN`, sem espaços.
- **Pedido não registra mas o WhatsApp abre:** é o comportamento de segurança (servidor fora do ar/lento = a venda segue).
  Veja Workers & Pages → seu projeto → Functions → logs.

## Pedidos do site dentro do app (atualização)

1. Limpe os pedidos de teste do banco antes de abrir o app novo (senão eles chegam como pedidos de verdade):
   no Console do D1 → `DELETE FROM pedido_itens; DELETE FROM pedidos;`
2. Substitua `functions/api/pedido.js` pelo novo (agora grava pedido e itens juntos) e aplique `pedidos-do-site.patch`
   (`git apply pedidos-do-site.patch`). Build, commit e push.
3. Abra o app: com a chave do servidor salva em Ajustes, ele confere o site a cada 1 minuto (enquanto aberto),
   ao voltar para o app e ao voltar a internet. Pedido novo = aviso na tela + contador na Caderneta + vai pro Drive.
4. Em Cardápio → Pedidos há um botão de atualizar (⟳) para buscar na hora.

## Contato do cliente (nome e WhatsApp) — atualização

Antes, o pedido do site chegava ao app sem telefone. Agora a página pede **nome e WhatsApp** na revisão do pedido
(obrigatórios, só nas páginas publicadas pelo servidor), guarda no banco e o app mostra o número no cartão do pedido,
com o botão de WhatsApp para combinar a entrega.

1. Substitua `functions/api/pedido.js` de novo (agora limpa e valida o telefone).
2. `git apply contato-do-cliente.patch`, build, commit e push.
3. **Republique os dois cardápios** no app (Dia a dia e Festa). Sem republicar, a página no ar continua a antiga, sem os campos.
4. Faça um pedido de teste: a página deve exigir nome e WhatsApp; no app, o pedido mostra o número e o botão WhatsApp.

## Versão, commit e "Buscar atualização" — atualização

Em **Ajustes → Sistema → Versão e atualização** (primeiro bloco da aba):
- mostra o **commit** instalado (ex.: `d246057`; toque nele para copiar), o número da versão e quando foi publicada;
- **Buscar atualização** consulta o servidor e o service worker na hora e diz se você está na versão mais recente,
  se há uma nova pronta (aparece **Atualizar agora**) ou se há uma publicada que ainda não chegou ao aparelho;
- **O app não atualiza? → Forçar atualização completa**: apaga só a cópia do app guardada no aparelho (service worker e cache)
  e recarrega. Seus dados não são tocados. Exige internet e recusa se o servidor não responder.

Como o commit chega ao app: no build, o `vite.config.js` lê `CF_PAGES_COMMIT_SHA` (o Cloudflare Pages preenche sozinho)
e grava o commit dentro do app e em `/version.json`. Nada para configurar. Rodando no seu computador, usa o `git`;
se não houver git, a tela mostra só a data.

Passos: `git apply versao-e-atualizacao.patch`, build, commit e push. **Atenção:** o aparelho só mostra o commit
depois de instalar essa versão; nela, o commit é o do próprio deploy que a contém.

## Apagar pedido também no servidor + remover tabela `registros` — atualização

- Ao apagar um pedido **do site** no app, o app avisa o servidor (exclusão lógica). O pedido some das listas e dos aparelhos
  novos, fica guardado 30 dias no banco (dá para recuperar pelo Console) e depois é removido de vez, sozinho.
  Sem internet, o aviso fica numa fila no aparelho e é reenviado na próxima verificação.
- A tabela `registros` não era usada por nada. Foi removida da migração.

Passos:
1. Copie os arquivos novos de `functions/` (`api/admin/pedidos.js` e `api/admin/pedidos/[uuid].js`).
2. No Console do D1 rode `migrations/0002_remove_registros.sql` (ou só: `DROP TABLE IF EXISTS registros;`).
3. `git apply apagar-pedidos.patch`, build, commit e push.
4. Pedidos que você apagou no app **antes** desta atualização continuam no banco sem marca. Para limpá-los de uma vez
   (apaga TODOS os pedidos do banco, só faça se não precisar do histórico):
   `DELETE FROM pedido_itens; DELETE FROM pedidos;`
