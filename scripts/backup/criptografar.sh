#!/usr/bin/env bash
# Criptografa um backup com AES-256 (gpg simétrico, com verificação de integridade).
# O backup tem nomes e telefones de clientes: NUNCA sai do GitHub/servidor sem criptografia.
#   BACKUP_PASSPHRASE='...' scripts/backup/criptografar.sh dump.sql dump.sql.gpg
set -euo pipefail
[ $# -eq 2 ] || { echo "uso: BACKUP_PASSPHRASE=... $0 <entrada> <saida.gpg>" >&2; exit 2; }
[ "${#BACKUP_PASSPHRASE}" -ge 20 ] || { echo "BACKUP_PASSPHRASE ausente ou curta demais (mínimo 20 caracteres)" >&2; exit 2; }
[ -s "$1" ] || { echo "arquivo de entrada vazio ou inexistente: $1" >&2; exit 2; }
rm -f "$2"
printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 0 \
  --symmetric --cipher-algo AES256 --compress-algo none -o "$2" "$1"
[ -s "$2" ] || { echo "falha ao criptografar" >&2; exit 1; }
