#!/usr/bin/env bash
# Decifra um backup criptografado por criptografar.sh. Falha (código ≠ 0) se a frase-senha estiver errada
# ou se o arquivo foi alterado/corrompido.
#   BACKUP_PASSPHRASE='...' scripts/backup/decifrar.sh dump.sql.gpg dump.sql
set -euo pipefail
[ $# -eq 2 ] || { echo "uso: BACKUP_PASSPHRASE=... $0 <entrada.gpg> <saida>" >&2; exit 2; }
[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE ausente" >&2; exit 2; }
rm -f "$2"
if ! printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 0 -o "$2" --decrypt "$1"; then
  rm -f "$2"; echo "não foi possível decifrar (frase-senha errada ou arquivo alterado)" >&2; exit 1
fi
[ -s "$2" ] || { echo "resultado vazio" >&2; exit 1; }
