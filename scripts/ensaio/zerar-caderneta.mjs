#!/usr/bin/env node
// ZERA SÓ A CADERNETA do banco para repetir a importação (ensaio → virada).
//
//   node scripts/ensaio/zerar-caderneta.mjs --confirmo-apagar-tudo [--saida=zerar-caderneta.sql]
//   npx wrangler d1 execute NOME_DO_BANCO --remote --config wrangler.migracoes.toml --file=zerar-caderneta.sql
//
// ⚠️  DESTRUTIVO E IRREVERSÍVEL. Só use ANTES da virada (quando a Caderneta no servidor ainda tem só dados de ensaio).
//     Depois da virada o histórico é imutável de propósito: não zere; use backup e restauração.
// Apaga: lojas, clientes, vendas, itens, pagamentos, estornos, operações e o diário de mudanças.
// NÃO toca em: cardápios, itens do site, pedidos e o registro de backups.
// Como funciona: derruba as tabelas da Caderneta e as recria a partir das MESMAS migrações 0003, 0004 e 0005 (regras idênticas).
import { readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MIGRACOES = new URL('../../migrations/', import.meta.url)
const ler = (f) => readFileSync(new URL(f, MIGRACOES), 'utf8')

export function gerarSqlZerar() {
  return [
    '-- ZERA SÓ A CADERNETA (ver scripts/ensaio/zerar-caderneta.mjs). IRREVERSÍVEL. Só antes da virada.',
    // filhos antes dos pais (as chaves estrangeiras estão ligadas)
    'DROP TABLE IF EXISTS cad_estornos;', 'DROP TABLE IF EXISTS cad_pagamentos;', 'DROP TABLE IF EXISTS cad_venda_itens;',
    'DROP TABLE IF EXISTS cad_vendas;', 'DROP TABLE IF EXISTS cad_clientes;', 'DROP TABLE IF EXISTS cad_lojas;',
    'DROP TABLE IF EXISTS operacoes;', 'DROP TABLE IF EXISTS mudancas;',
    "DELETE FROM sqlite_sequence WHERE name = 'mudancas';",
    '-- recria, com as mesmas regras:',
    ler('0003_caderneta.sql'), ler('0004_cad_vendas_substitui.sql'), ler('0005_operacoes_papel.sql'),
  ].join('\n')
}

// Só como comando (importar a função, por exemplo nos testes, não aciona nada):
const executadoDireto = (() => { try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()
if (executadoDireto) {
  const arg = process.argv.slice(2)
  if (!arg.includes('--confirmo-apagar-tudo')) {
    console.error('Recusado: isto APAGA toda a Caderneta do banco. Rode de novo com --confirmo-apagar-tudo se tiver certeza\n(e só antes da virada; depois dela use backup e restauração).')
    process.exit(2)
  }
  const saida = (arg.find(a => a.startsWith('--saida=')) || '--saida=zerar-caderneta.sql').split('=')[1]
  writeFileSync(saida, gerarSqlZerar())
  console.log(`Gerado: ${saida}\nAgora execute no banco (veja o cabeçalho deste script). Lembre: só antes da virada.`)
}
