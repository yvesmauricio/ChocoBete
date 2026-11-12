#!/usr/bin/env bash
# SIMULADO DE RESTAURAÇÃO — o teste que precisa passar ANTES de desligar o sistema antigo (e que vale repetir de vez em quando).
# Baixa o backup mais recente (ou o que você indicar) do bucket, decifra e prova que restaura num banco limpo,
# sem tocar na produção. Roda no SEU computador; precisa de: node 22+, gpg e aws cli.
#
#   export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...        # chaves do bucket (leitura bastam)
#   export BACKUP_PASSPHRASE='...'                                 # a frase-senha dos backups (do seu gerenciador de senhas)
#   export S3_BUCKET=meu-bucket  S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com   # S3_ENDPOINT vazio = AWS S3
#   scripts/backup/simulado-restauracao.sh                        # o mais recente
#   scripts/backup/simulado-restauracao.sh diario/2026/11/chocobete-d1-20261112-061700.sql.gpg
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${S3_BUCKET:?defina S3_BUCKET}"; : "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"
ep=(); [ -z "${S3_ENDPOINT:-}" ] || ep=(--endpoint-url "$S3_ENDPOINT")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT     # nada do backup (dados de clientes) fica em disco depois

CHAVE="${1:-}"
if [ -z "$CHAVE" ]; then
  CHAVE=$(aws "${ep[@]}" s3 ls "s3://${S3_BUCKET}/diario/" --recursive | awk '{print $4}' | sort | tail -1)
  [ -n "$CHAVE" ] || { echo "❌ nenhum backup encontrado em s3://${S3_BUCKET}/diario/"; exit 1; }
fi
echo "Backup escolhido: $CHAVE"
aws "${ep[@]}" s3 cp "s3://${S3_BUCKET}/${CHAVE}" "$TMP/backup.sql.gpg" --only-show-errors
echo "Baixado: $(stat -c %s "$TMP/backup.sql.gpg") bytes · sha256 $(sha256sum "$TMP/backup.sql.gpg" | cut -c1-16)…"
scripts/backup/decifrar.sh "$TMP/backup.sql.gpg" "$TMP/backup.sql"
echo "Decifrado com sucesso. Verificando a restauração…"; echo
node scripts/backup/verificar-restauracao.mjs "$TMP/backup.sql" --simulado --saida="$TMP/relatorio.json"
