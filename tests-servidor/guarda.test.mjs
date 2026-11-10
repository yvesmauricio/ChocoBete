import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const mem = new Map(); globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }
const { db } = await import('../src/db.js')
const { instalarGuardaServidor, EscritaForaDoServidorError } = await import('../src/services/guardaServidor.js')
const { definirCadernetaNoServidor, comEscritaLocalLiberada } = await import('../src/services/modoServidor.js')
const { salvarFiado, atualizarFiado } = await import('../src/composables/useCaderneta.js')

test('modo servidor desligado: tudo grava como sempre', async () => {
  instalarGuardaServidor(db)
  const id = await db.cad_fiados.add({ uid: 'venda-guarda-001', total: 1, saldo: 1 })
  assert.ok(id)
})
test('modo servidor ligado: gravação local solta é barrada; pela ponte, importação ou transação liberada, passa', async () => {
  definirCadernetaNoServidor(true)
  await assert.rejects(() => db.cad_fiados.add({ uid: 'venda-guarda-002', total: 1, saldo: 1 }), EscritaForaDoServidorError)
  await assert.rejects(() => db.cad_lojas.add({ uid: 'loja-guarda-0001', nome: 'X' }), EscritaForaDoServidorError)
  const f = await db.cad_fiados.toCollection().first()
  await assert.rejects(() => atualizarFiado(f.id, { saldo: 0 }), EscritaForaDoServidorError)
  assert.equal((await db.cad_fiados.get(f.id)).saldo, 1)                           // nada mudou
  await comEscritaLocalLiberada(() => atualizarFiado(f.id, { saldo: 0.5 }))        // caminho da ponte
  assert.equal((await db.cad_fiados.get(f.id)).saldo, 0.5)
  await db.transaction('rw', db.cad_fiados, async () => { (await import('../src/services/travaPorPapel.js')).liberarEscrita(); await db.cad_fiados.put({ ...f, saldo: 0.7 }) })   // importação/projeção
  assert.equal((await db.cad_fiados.get(f.id)).saldo, 0.7)
  assert.equal((await db.cad_fiados.count()), 1)
})

test('link ?caderneta=servidor|local liga/desliga neste aparelho e limpa a barra de endereço', async () => {
  const { aplicarParametroDeUrl, cadernetaNoServidor } = await import('../src/services/modoServidor.js')
  definirCadernetaNoServidor(false)
  const hist = { url: null, replaceState(_a, _b, u) { this.url = u } }
  assert.equal(aplicarParametroDeUrl({ href: 'https://app.test/?caderneta=servidor&x=1#a' }, hist), true)
  assert.equal(cadernetaNoServidor(), true); assert.equal(hist.url, '/?x=1#a')
  assert.equal(aplicarParametroDeUrl({ href: 'https://app.test/?caderneta=servidor' }, hist), false)   // já estava ligado
  assert.equal(aplicarParametroDeUrl({ href: 'https://app.test/?caderneta=local' }, hist), true)
  assert.equal(cadernetaNoServidor(), false)
  assert.equal(aplicarParametroDeUrl({ href: 'https://app.test/?caderneta=qualquer' }, hist), false)    // valor desconhecido: ignora
})
