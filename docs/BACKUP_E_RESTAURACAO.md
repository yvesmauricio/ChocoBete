# Backup diário e restauração — ChocoBete

## O que acontece todo dia (sozinho)
Às **03:17 (Brasília)** uma rotina do GitHub:
1. **exporta o banco inteiro** (dados + as regras de proteção);
2. **prova que a cópia restaura** num banco limpo: integridade, mesmas regras do sistema, conferências de saldo com **zero violações**, e que **nenhuma linha se perdeu** (compara com o banco de verdade antes e depois da exportação). Um backup que não restaura **nunca** é guardado como bom;
3. **criptografa** (AES-256) — o backup tem nomes e telefones de clientes;
4. **guarda fora do Cloudflare** (um bucket seu, em outro fornecedor) e baixa de volta para conferir que o arquivo guardado é idêntico;
5. **registra no servidor** "backup feito". Às **12:43** uma **vigia** confere se o backup está em dia; se não estiver (ou se alguma conferência da Caderneta acusar erro), o GitHub **manda e-mail**.

Também fica uma 2ª cópia criptografada no próprio GitHub por 14 dias.

> A exportação deixa o banco **indisponível por alguns segundos** (no seu tamanho, quase nada). Por isso roda de madrugada. Se alguém lançar nesse instante, o app guarda na fila e reenvia.

## Retenção
| Onde | O que | Por quanto tempo |
|---|---|---|
| `diario/` no bucket | 1 por dia | configure a regra do bucket para apagar após **35 dias** |
| `mensal/` no bucket | cópia do dia 1 de cada mês | configure para guardar **400 dias** (ou mais) |
| GitHub (artefato) | cópia do dia | 14 dias |

## Configuração (uma vez só)

### 1) Bucket fora do Cloudflare
Recomendo **Backblaze B2** (10 GB grátis, fornecedor diferente do seu servidor). Qualquer bucket "S3-compatível" serve (AWS S3, outra conta Cloudflare R2…).
- Crie um bucket **privado**.
- Crie uma **chave de aplicativo restrita a esse bucket** (leitura e escrita).
- Regras de ciclo de vida (Lifecycle): prefixo `diario/` → apagar após 35 dias; prefixo `mensal/` → apagar após 400 dias.
- Anote: endpoint (ex.: `https://s3.us-west-004.backblazeb2.com`), nome do bucket, região, `keyID` e `applicationKey`.

### 2) Chaves novas
```bash
openssl rand -hex 32      # → BACKUP_TOKEN        (chave só de backup)
openssl rand -base64 32   # → BACKUP_PASSPHRASE   (frase-senha dos backups)
```
- **`BACKUP_PASSPHRASE`: guarde no seu gerenciador de senhas e também impressa em lugar seguro.** **Sem ela os backups não abrem — ninguém, nem eu, consegue recuperar.**
- **`BACKUP_TOKEN`**: cadastre também no Cloudflare Pages (Settings → Environment variables → `BACKUP_TOKEN`, Production). Ele só permite registrar "backup feito" e ler contagens; **não** abre a Caderneta.

### 3) Token da API do Cloudflare (para exportar)
Cloudflare → My Profile → API Tokens → Create Token → permissão **Account → D1 → Edit**, só para a sua conta. Anote também o **Account ID** e o **ID do banco D1** (Workers & Pages → D1 → seu banco).

### 4) GitHub → Settings → Secrets and variables → Actions
| Tipo | Nome | Valor |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | token do passo 3 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| Secret | `BACKUP_TOKEN` | o mesmo cadastrado no Pages |
| Secret | `BACKUP_PASSPHRASE` | frase-senha do passo 2 |
| Secret | `BACKUP_S3_KEY_ID` / `BACKUP_S3_SECRET` | chave do bucket |
| Variable | `D1_NOME` / `D1_ID` | nome e ID do banco D1 |
| Variable | `SITE_URL` | `https://seu-site` (sem barra no fim) |
| Variable | `BACKUP_S3_BUCKET` | nome do bucket |
| Variable | `BACKUP_S3_ENDPOINT` | endpoint (vazio se for AWS S3) |
| Variable | `BACKUP_S3_REGION` | região (padrão `us-east-1`) |

### 5) Primeiro teste
GitHub → **Actions → "Backup diário do banco" → Run workflow**. Deve terminar **verde**, com o resumo "Backup verificado". Depois rode "Vigia do backup" (deve passar). Confira que apareceu um arquivo em `diario/` no bucket.
Migrações novas do servidor: `0006_backups_registro.sql` (junto das anteriores).

## SIMULADO DE RESTAURAÇÃO (obrigatório antes de desligar o sistema antigo)
No **seu computador** (precisa de node 22+, gpg e aws cli; nada toca na produção):
```bash
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
export BACKUP_PASSPHRASE='...'                     # do gerenciador de senhas
export S3_BUCKET=meu-bucket S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
npm run backup:simulado                            # pega o mais recente
```
**Passou** = todas as linhas ✅ e a última frase **"BACKUP VERIFICADO: restaura e confere."** Confira também que o "Resumo restaurado" bate com o que você espera (vendas, pagamentos, saldo em aberto). Faça uma vez **antes de desligar o sistema antigo** e repita de tempos em tempos (a cada 3 meses, por exemplo).

## Se acontecer um desastre (banco perdido ou corrompido)
1. **Não entre em pânico e não faça nada às pressas:** os aparelhos continuam guardando na fila o que não foi enviado.
2. Baixe o backup mais recente do bucket e decifre: `BACKUP_PASSPHRASE=... scripts/backup/decifrar.sh arquivo.sql.gpg backup.sql`
3. **Prove** que ele está bom: `npm run backup:verificar -- backup.sql --simulado`
4. Crie um banco novo e restaure: `npx wrangler d1 create chocobete-novo` e depois `npx wrangler d1 execute chocobete-novo --remote --file=backup.sql`
5. Cloudflare Pages → seu projeto → Settings → Functions → D1 binding `DB` → aponte para o banco novo → faça um novo deploy.
6. Confira `GET /api/caderneta/conferencia` (como Admin) e compare com o simulado.
7. Reabra os aparelhos: a fila reenvia o que estava pendente.

**Limite honesto:** o que foi lançado **depois do último backup** (no máximo ~24 h) e já aceito pelo servidor **não está na cópia**. Os aparelhos já tiraram essas operações da fila, então precisam ser relançadas (o histórico de vendas do próprio celular ajuda a conferir). Para reduzir a janela, dá para rodar o backup também ao meio-dia (acrescente `- cron: '17 15 * * *'` em `backup-d1.yml`) ou clicar em "Run workflow" antes de qualquer mudança grande.
O D1 também tem recuperação por ponto no tempo (Time Travel), dentro do próprio Cloudflare — útil para desfazer um erro recente, mas **não substitui** o backup fora do Cloudflare (confirme o prazo do seu plano no painel).

## Segurança
- O backup contém **dados pessoais**: só existe criptografado fora do servidor. Não compartilhe o arquivo decifrado.
- Privilégio mínimo: o `BACKUP_TOKEN` só registra backup e lê contagens (sem nomes); o token do Cloudflare é só de D1; a chave do bucket é só daquele bucket.
- Se suspeitar de vazamento de algum segredo: gere outro, troque no GitHub e no Cloudflare, e rode a ação.

## Se a vigia mandar e-mail
GitHub → Actions → "Backup diário do banco" → abra a execução que falhou. Causas comuns: token do Cloudflare vencido/sem permissão D1; chave do bucket trocada ou bucket cheio; `SITE_URL`/`BACKUP_TOKEN` diferentes do cadastrado no Pages; a verificação acusou problema no próprio banco (**isso é sério: não ignore**; abra o log "Provar que restaura e confere"). Repositórios **públicos** têm agendamentos pausados após 60 dias sem atividade: mantenha o repositório privado ou reative em Actions.
