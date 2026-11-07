# Controle de importação de extratos (Financeiro)

Antes, escolher um arquivo gravava direto nas finanças. Agora o fluxo é:
**arquivo → análise → tela "Conferir antes de importar" → confirmação → gravação.**
Nada é gravado antes da confirmação.

## O que a análise barra (`services/extratoImport.js`)
| Situação | Resultado |
|---|---|
| CSV sem o formato do banco escolhido (ex.: sem "Lançamento"/"Detalhes" no importador do BB; CSV do BB no importador do PagBank) | **Bloqueia** |
| Nome de **outro banco** no topo do arquivo (e nenhum do esperado) | **Bloqueia** |
| Conta de destino de outro banco / sem conta | **Bloqueia** |
| Conta com "Nº da conta no extrato" preenchido e o arquivo não o contém | **Bloqueia** |
| **Mesmo arquivo** (SHA-256) já importado e não desfeito | **Bloqueia** |
| Sem lançamentos válidos; mais de 30% com data futura | **Bloqueia** |
| PDF sem nenhum nome de banco; formato diferente do último aceito na conta | **Exige marcar "Confirmo que é do banco X, conta Y"** |
| Período > 400 dias, > 3 anos de idade, > 1500 lançamentos, valor ≥ R$ 100 mil, só entradas/só saídas, 1ª importação da conta | **Aviso** na conferência |

A conferência mostra arquivo, banco, conta, período, quantos entram × já existiam, entradas, saídas e os primeiros lançamentos.

## Histórico e desfazer
- Cada importação vira um **lote** persistente (config `extrato_importacoes`): arquivo, conta, período, quantidade e quais lançamentos criou.
- **Desfazer qualquer lote** (não só o último), mesmo depois de fechar o app.
- O desfazer também **devolve a categoria/natureza** que a conciliação de transferências tinha alterado em lançamentos antigos (antes isso ficava para trás).
- Em Ajustes → Contas: campo opcional **"Nº da conta no extrato"** para distinguir duas contas do mesmo banco.

## Limites
- Reconhecer o banco pelo conteúdo só vai até onde o arquivo traz sinais. Por isso há 3 camadas: sinal do arquivo → identificador da conta → conferência visual.
- Importações feitas **antes** desta versão não estão no histórico (não dá para desfazê-las por aqui).
- Banco sem leitor (Nubank, Inter…) continua sem importação: o app agora recusa, mas ler esse banco exige um arquivo de exemplo.
- Testado com os arquivos simulados e o `store.js` real (`npm run test:papel`); não testado com extratos reais nem clicando na interface.
