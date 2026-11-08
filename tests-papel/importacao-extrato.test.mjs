// Importação de extrato no store.js real: simulação sem gravar, histórico persistente,
// desfazer completo (inclusive o que a conciliação alterou em lançamentos antigos).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from './harness/aparelho.mjs'

let amb
before(async () => { amb = await criarAmbiente() })
after(() => amb.fechar())

const CONTAS = `
  s.saveContasFinanceiras([
    { id: 'c-pag', nome: 'PagBank PJ', banco: 'pagbank', titular: 'Elisabete', natureza: 'empresarial' },
    { id: 'c-itau', nome: 'Itaú PF', banco: 'itau', titular: 'Elisabete', natureza: 'pessoal' }
  ])`
const LANC_PAG = `[
  { data: '2026-10-05', tipo: 'Pix enviado', descricao: 'PIX ENVIADO ELISABETE BATISTA', valor: -100, banco: 'pagbank', conta_id: 'c-pag' },
  { data: '2026-10-06', tipo: 'Pix recebido', descricao: 'PIX RECEBIDO CLIENTE A', valor: 50, banco: 'pagbank', conta_id: 'c-pag' }
]`
const LANC_ITAU = `[
  { data: '2026-10-05', tipo: 'PIX recebido', descricao: 'PIX TRANSF ELISABETE BATISTA', valor: 100, banco: 'itau', conta_id: 'c-itau' },
  { data: '2026-10-07', tipo: 'Cartão de Débito', descricao: 'RSHOP MERCADO', valor: -30, banco: 'itau', conta_id: 'c-itau' }
]`

test('simulação não grava nada e conta novos x duplicados', async () => {
  const A = new amb.Ap(); await A.init()
  await A.store(CONTAS)
  const sim = await A.store(`return s.simularImportacaoFinanceira(${LANC_PAG})`)
  assert.deepEqual([sim.novos, sim.duplicados, sim.validos], [2, 0, 2])
  assert.equal(await A.store(`return db.financeiro.count()`), 0, 'nada foi gravado')
  await A.store(`await s.importarLancamentosFinanceiros(${LANC_PAG})`)
  const sim2 = await A.store(`return s.simularImportacaoFinanceira(${LANC_PAG})`)
  assert.deepEqual([sim2.novos, sim2.duplicados], [0, 2])
})

test('o histórico é persistente: sobrevive a recarregar e permite desfazer depois', async () => {
  const A = new amb.Ap(); await A.init()
  await A.store(CONTAS)
  const r = await A.store(`return s.importarLancamentosFinanceiros(${LANC_PAG}, { banco: 'pagbank', conta_id: 'c-pag', arquivo: 'extrato.csv', hashArquivo: 'abc', formato: 'csv', assinatura: 'csv:data|tipo' })`)
  assert.ok(r.loteId)
  const noBanco = await A.store(`return (await db.config.get('extrato_importacoes')).valor`)
  assert.equal(noBanco[0].arquivo, 'extrato.csv'); assert.equal(noBanco[0].hash_arquivo, 'abc'); assert.equal(noBanco[0].qtd, 2)
  assert.equal(await A.store(`return (await db.config.get('extrato_assinaturas')).valor['c-pag']`), 'csv:data|tipo')

  await A.init()   // "recarregar o app": relê tudo do banco
  assert.equal(await A.store(`return s.importacoesExtrato.length`), 1)
  assert.equal(await A.store(`return s.desfazerUltimaImportacao()`), true)
  assert.equal(await A.store(`return db.financeiro.count()`), 0)
  assert.equal(await A.store(`return s.importacoesExtrato[0].desfeito_em !== null`), true)
  assert.equal(await A.store(`return s.desfazerUltimaImportacao()`), false, 'já desfeita: nada a fazer')
})

test('desfazer um lote antigo não mexe nos mais novos (qualquer lote, não só o último)', async () => {
  const A = new amb.Ap(); await A.init()
  await A.store(CONTAS)
  const l1 = await A.store(`return s.importarLancamentosFinanceiros(${LANC_PAG}, { banco: 'pagbank', conta_id: 'c-pag', arquivo: 'a.csv', hashArquivo: 'h1' })`)
  const l2 = await A.store(`return s.importarLancamentosFinanceiros([{ data: '2026-11-02', tipo: 'Pix recebido', descricao: 'PIX RECEBIDO CLIENTE B', valor: 80, banco: 'pagbank', conta_id: 'c-pag' }], { banco: 'pagbank', conta_id: 'c-pag', arquivo: 'b.csv', hashArquivo: 'h2' })`)
  await A.store(`return s.desfazerImportacaoExtrato('${l1.loteId}')`)
  const restam = await A.store(`return (await db.financeiro.toArray()).map(f => f.descricao_original)`)
  assert.deepEqual(restam, ['PIX RECEBIDO CLIENTE B'])
  assert.ok(l2.loteId)
})

test('desfazer devolve a categoria que a conciliação mudou em lançamento ANTIGO', async () => {
  const A = new amb.Ap(); await A.init()
  await A.store(CONTAS)
  await A.store(`await s.importarLancamentosFinanceiros(${LANC_PAG}, { banco: 'pagbank', conta_id: 'c-pag', arquivo: 'pag.csv', hashArquivo: 'h1' })`)
  const antes = await A.store(`const f = (await db.financeiro.toArray()).find(x => x.valor === -100); return { categoria: f.categoria, natureza: f.natureza }`)
  const l = await A.store(`return s.importarLancamentosFinanceiros(${LANC_ITAU}, { banco: 'itau', conta_id: 'c-itau', arquivo: 'itau.pdf', hashArquivo: 'h2' })`)
  const durante = await A.store(`const f = (await db.financeiro.toArray()).find(x => x.valor === -100); return { categoria: f.categoria, natureza: f.natureza }`)
  console.log('   categoria do lançamento antigo: antes', JSON.stringify(antes), '→ durante', JSON.stringify(durante))
  assert.notDeepEqual(durante, antes, 'cenário de teste: a importação deveria ter conciliado o lançamento antigo')
  const lote = await A.store(`return s.importacoesExtrato[0]`)
  assert.ok(lote.alterados.length >= 1, 'o lote guardou o estado anterior')

  await A.store(`return s.desfazerImportacaoExtrato('${l.loteId}')`)
  const depois = await A.store(`const f = (await db.financeiro.toArray()).find(x => x.valor === -100); return { categoria: f.categoria, natureza: f.natureza }`)
  assert.deepEqual(depois, antes, 'o lançamento antigo voltou ao que era')
  assert.equal(await A.store(`return db.financeiro.count()`), 2, 'só os do PagBank ficaram')
})

// ── Fluxo completo do importador (preparar → conferência → confirmar) ──────────────────
const BB_COLS = ['Data', 'Dependencia Origem', 'Lançamento', 'Detalhes', 'Valor', 'Tipo Lançamento']
const BB_TEXTO = 'Data;Lançamento;Detalhes;Valor\n05/10/2026;Pix - Recebido;CLIENTE A;50,00\n'
const BB_LANC = `[
  { data: '2026-10-05', tipo: 'PIX recebido', descricao: 'CLIENTE A', valor: 50, banco: 'bb', conta_id: 'c-bb' },
  { data: '2026-10-06', tipo: 'PIX enviado', descricao: 'FORNECEDOR', valor: -20, banco: 'bb', conta_id: 'c-bb' }
]`
const CONTA_BB = `s.saveContasFinanceiras([{ id: 'c-bb', nome: 'BB MEI', banco: 'bb', natureza: 'pessoal' }, { id: 'c-bb2', nome: 'BB Diaria', banco: 'bb', identificador_extrato: '99999-9', natureza: 'pessoal' }])`
const extrato = (A, o) => A.cmd({ cmd: 'extrato', banco: 'bb', formato: 'csv', nome: 'extrato.csv', texto: BB_TEXTO, colunas: BB_COLS, lancamentos: BB_LANC, contaId: 'c-bb', ...o })

test('INCIDENTE: extrato de banco não cadastrado é barrado e NADA é gravado', async () => {
  const A = new amb.Ap(); await A.init(); await A.store(CONTA_BB)
  const r = await extrato(A, { colunas: ['Data', 'Valor', 'Identificador', 'Descrição'], texto: 'Data,Valor,Identificador,Descrição\n05/10/2026,50,1,x\n', confirmar: true })
  assert.equal(r.nivel, 'bloqueado'); assert.ok(r.bloqueios.includes('formato_incompativel'))
  assert.ok(!r.resultado, 'não gravou')
  assert.equal(await A.store(`return db.financeiro.count()`), 0)
  assert.equal(await A.store(`return s.importacoesExtrato.length`), 0)
})

test('extrato correto: confere, confirma, grava e registra o lote; o mesmo arquivo é barrado depois', async () => {
  const A = new amb.Ap(); await A.init(); await A.store(CONTA_BB)
  const prev = await extrato(A, {})
  assert.deepEqual(prev.bloqueios, []); assert.equal(prev.simulacao.novos, 2)
  assert.equal(await A.store(`return db.financeiro.count()`), 0, 'a prévia não gravou nada')

  const ok = await extrato(A, { confirmar: true })
  assert.equal(ok.resultado.importadosCount, 2)
  assert.equal(await A.store(`return db.financeiro.count()`), 2)
  assert.equal(await A.store(`return s.importacoesExtrato[0].arquivo`), 'extrato.csv')

  const de_novo = await extrato(A, {})
  assert.ok(de_novo.bloqueios.includes('arquivo_repetido'), 'mesmo arquivo de novo é barrado')
  await A.store(`return s.desfazerUltimaImportacao()`)
  const liberado = await extrato(A, {})
  assert.ok(!liberado.bloqueios.includes('arquivo_repetido'), 'desfeita a importação, pode importar de novo')
})

test('conta errada do mesmo banco (identificador) é barrada', async () => {
  const A = new amb.Ap(); await A.init(); await A.store(CONTA_BB)
  const r = await extrato(A, { contaId: 'c-bb2', confirmar: true })
  assert.ok(r.bloqueios.includes('conta_diferente'))
  assert.equal(await A.store(`return db.financeiro.count()`), 0)
  const certo = await extrato(A, { contaId: 'c-bb2', texto: BB_TEXTO + 'Conta 99999-9' })
  assert.ok(!certo.bloqueios.includes('conta_diferente'))
})

test('depois da 1ª importação, formato diferente na mesma conta exige confirmação reforçada', async () => {
  const A = new amb.Ap(); await A.init(); await A.store(CONTA_BB)
  await extrato(A, { confirmar: true })
  const r = await extrato(A, { nome: 'outro.csv', texto: BB_TEXTO + 'x', colunas: [...BB_COLS, 'Coluna Nova'], lancamentos: `[{ data: '2026-10-09', tipo: 'PIX recebido', descricao: 'NOVO', valor: 10, banco: 'bb', conta_id: 'c-bb' }]` })
  assert.equal(r.reforcada, true); assert.ok(r.avisos.includes('formato_mudou'))
})
