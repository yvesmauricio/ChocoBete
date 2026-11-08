import test from 'node:test'
import assert from 'node:assert/strict'
import { analisarExtrato, resumirLancamentos, assinaturaDoArquivo } from '../src/services/extratoImport.js'

const HOJE = new Date('2026-11-07T12:00:00Z')
const L = (data, valor, tipo = 'PIX recebido', descricao = 'x') => ({ data, valor, tipo, descricao })
const lancs = (n = 10) => Array.from({ length: n }, (_, i) => L(`2026-10-${String((i % 28) + 1).padStart(2, '0')}`, i % 2 ? -20 - i : 50 + i, 'PIX', 'item ' + i))
const contaBb = { id: 'c1', nome: 'BB Mei', banco: 'bb' }
const contaPag = { id: 'c2', nome: 'PagBank', banco: 'pagbank' }
const contaItau = { id: 'c3', nome: 'Itaú', banco: 'itau', identificador_extrato: '' }
const colBb = ['Data', 'Dependencia Origem', 'Lançamento', 'Detalhes', 'Valor', 'Tipo Lançamento']
const colPag = ['DATA', 'TIPO', 'DESCRIÇÃO', 'VALOR']
const base = { hoje: HOJE, importacoes: [], hashArquivo: 'h1', assinaturaConta: null }
const codigos = (r) => r.bloqueios.map(b => b.codigo)

test('BB correto: sem bloqueios', () => {
  const r = analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, texto: 'Data;Lançamento', lancamentos: lancs(), conta: contaBb })
  assert.deepEqual(codigos(r), []); assert.ok(['ok', 'atencao'].includes(r.nivel))
})
test('CSV de outro banco no importador do BB é bloqueado (formato)', () => {
  const r = analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: ['Data', 'Valor', 'Identificador', 'Descrição'], texto: '', lancamentos: lancs(), conta: contaBb })
  assert.ok(codigos(r).includes('formato_incompativel')); assert.equal(r.nivel, 'bloqueado')
})
test('CSV do BB no importador do PagBank é bloqueado', () => {
  const r = analisarExtrato({ ...base, banco: 'pagbank', formato: 'csv', colunas: colBb, texto: '', lancamentos: lancs(), conta: contaPag })
  assert.ok(codigos(r).includes('formato_incompativel'))
})
test('PagBank correto passa; CSV sem coluna Tipo é bloqueado', () => {
  assert.deepEqual(codigos(analisarExtrato({ ...base, banco: 'pagbank', formato: 'csv', colunas: colPag, texto: '', lancamentos: lancs(), conta: contaPag })), [])
  const r = analisarExtrato({ ...base, banco: 'pagbank', formato: 'csv', colunas: ['Data', 'Descrição', 'Valor'], texto: '', lancamentos: lancs(), conta: contaPag })
  assert.ok(codigos(r).includes('formato_incompativel'))
})
test('PDF com o nome de OUTRO banco no topo é bloqueado no importador do Itaú', () => {
  const r = analisarExtrato({ ...base, banco: 'itau', formato: 'pdf', texto: 'Banco Inter S.A. Extrato conta corrente ' + 'x'.repeat(100), lancamentos: lancs(), conta: contaItau })
  assert.ok(codigos(r).includes('outro_banco')); assert.match(r.bloqueios[0].msg, /Inter/)
})
test('PDF do Itaú identificado passa sem confirmação reforçada', () => {
  const r = analisarExtrato({ ...base, banco: 'itau', formato: 'pdf', texto: 'Itaú Unibanco - extrato', lancamentos: lancs(), conta: contaItau })
  assert.deepEqual(codigos(r), []); assert.equal(r.reforcada, false)
})
test('PDF sem nenhum nome de banco: não bloqueia, mas exige confirmação reforçada', () => {
  const r = analisarExtrato({ ...base, banco: 'itau', formato: 'pdf', texto: 'EXTRATO 01/10/2026 PIX 10,00', lancamentos: lancs(), conta: contaItau })
  assert.deepEqual(codigos(r), []); assert.equal(r.reforcada, true)
})
test('nome de outro banco numa DESCRIÇÃO (fora do topo) não condena o arquivo', () => {
  const texto = 'Itaú extrato ' + ' '.repeat(2000) + 'PIX ENVIADO BANCO INTER 10,00'
  const r = analisarExtrato({ ...base, banco: 'itau', formato: 'pdf', texto, lancamentos: lancs(), conta: contaItau })
  assert.deepEqual(codigos(r), [])
})
test('conta de outro banco / sem conta', () => {
  assert.ok(codigos(analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: lancs(), conta: contaPag })).includes('conta_de_outro_banco'))
  assert.ok(codigos(analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: lancs(), conta: null })).includes('sem_conta'))
})
test('identificador da conta: ausente no arquivo bloqueia; presente passa', () => {
  const conta = { ...contaBb, identificador_extrato: '12345-6' }
  const sem = analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, texto: 'Agência 1111-1 Conta 99999-9', lancamentos: lancs(), conta })
  assert.ok(codigos(sem).includes('conta_diferente'))
  const com = analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, texto: 'Conta 12345 - 6', lancamentos: lancs(), conta })
  assert.ok(!codigos(com).includes('conta_diferente'))
})
test('mesmo arquivo já importado é bloqueado; se foi desfeito, libera', () => {
  const imp = [{ hash_arquivo: 'h1', quando: '2026-10-30T10:00:00Z', desfeito_em: null }]
  assert.ok(codigos(analisarExtrato({ ...base, importacoes: imp, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: lancs(), conta: contaBb })).includes('arquivo_repetido'))
  imp[0].desfeito_em = '2026-10-31T10:00:00Z'
  assert.ok(!codigos(analisarExtrato({ ...base, importacoes: imp, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: lancs(), conta: contaBb })).includes('arquivo_repetido'))
})
test('sem lançamentos; datas no futuro', () => {
  assert.ok(codigos(analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: [], conta: contaBb })).includes('sem_lancamentos'))
  const fut = Array.from({ length: 10 }, (_, i) => L(`2027-0${(i % 9) + 1}-10`, 10))
  assert.ok(codigos(analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: fut, conta: contaBb })).includes('datas_futuras'))
})
test('avisos: período longo, valor alto, só entradas, primeira importação', () => {
  const l = [L('2023-06-02', 5), L('2026-10-02', 200000), L('2026-10-03', 7), L('2026-10-04', 7), L('2026-10-05', 7), L('2026-10-06', 7)]
  const r = analisarExtrato({ ...base, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: l, conta: contaBb })
  const av = r.avisos.map(a => a.codigo)
  for (const c of ['periodo_longo', 'valor_alto', 'so_um_sentido', 'primeira_importacao', 'datas_antigas']) assert.ok(av.includes(c), c)
  assert.equal(r.nivel, 'atencao')
})
test('formato diferente do aprendido na conta exige confirmação reforçada', () => {
  const assin = assinaturaDoArquivo({ formato: 'csv', colunas: colBb, banco: 'bb' })
  const igual = analisarExtrato({ ...base, assinaturaConta: assin, banco: 'bb', formato: 'csv', colunas: colBb, lancamentos: lancs(), conta: contaBb })
  assert.equal(igual.reforcada, false)
  const outra = analisarExtrato({ ...base, assinaturaConta: assin, banco: 'bb', formato: 'csv', colunas: [...colBb, 'Extra'], lancamentos: lancs(), conta: contaBb })
  assert.equal(outra.reforcada, true)
})
test('resumo: período, entradas, saídas', () => {
  const r = resumirLancamentos([L('2026-10-05', 100), L('2026-10-01', -30), L('2026-10-09', -20)])
  assert.deepEqual([r.ini, r.fim, r.entradas, r.saidas, r.qtd], ['2026-10-01', '2026-10-09', 100, 50, 3])
})
