import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mesclar } from '../src/services/merge.js'

const loja = (o) => ({ id: 1, uid: 'loja-uid-0001', nome: 'Padaria', ...o })
const fiado = (o) => ({ id: 1, uid: 'venda-uid-0001', clienteId: 1, lojaId: 1, total: 100, saldo: 100, status: 'aberto', pagamentos: [], ...o })
const cli = { id: 1, uid: 'cli-uid-0001', lojaId: 1, nome: 'Ana' }
const snap = (f, l = loja()) => ({ cad_lojas: [l], cad_clientes: [cli], cad_fiados: [f], config: [] })

test('com a Caderneta no servidor, um Drive antigo NÃO desfaz o que o aparelho tem', () => {
  const base = snap(fiado()), local = snap(fiado({ saldo: 40, pagamentos: [{ valor: 60 }] }))
  const remote = snap(fiado({ saldo: 100 }))                       // arquivo velho, sem o pagamento
  const r = mesclar({ base, local, remote, ignorarTabelas: ['cad_lojas', 'cad_clientes', 'cad_fiados'] })
  assert.equal(r.dados.cad_fiados[0].saldo, 40); assert.equal(r.dados.cad_fiados[0].pagamentos.length, 1)
})

test('com a Caderneta no servidor, Drive sem a tabela (ou vazio) não apaga nada local', () => {
  const local = snap(fiado({ saldo: 40 })), base = snap(fiado())
  const r = mesclar({ base, local, remote: { config: [] }, ignorarTabelas: ['cad_lojas', 'cad_clientes', 'cad_fiados'] })
  assert.equal(r.dados.cad_fiados.length, 1); assert.equal(r.dados.cad_lojas.length, 1)
})

test('sem o modo servidor, o merge continua mesclando a Caderneta (comportamento de sempre)', () => {
  const base = snap(fiado()), local = snap(fiado()), remote = snap(fiado({ saldo: 40, pagamentos: [{ valor: 60, criadoEm: 'x' }] }))
  const r = mesclar({ base, local, remote, ignorarTabelas: [] })
  assert.equal(r.dados.cad_fiados[0].saldo, 40)
})
