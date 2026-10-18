import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import assert from 'node:assert/strict'
import * as dbm from '../src/db.js'
const velho=new Dexie('chocobeteDB_v2')
velho.version(12).stores({produtos:'uuid, nome',receitas:'uuid, nome',producoes:'uuid, data_producao, origem, gerar_financeiro',financeiro:'++id, data, valor, tipo, categoria, natureza, escopo, tipo_contabil, descricao, mes_ref, &hash_duplicidade',historico_precos:'++id, produto_uuid, data',cad_lojas:'++id, nome',cad_clientes:'++id, lojaId, nome',cad_fiados:'++id, clienteId, lojaId, status, dataVenc',cardapio_pedidos:'uuid, cardapioId, status, criadoEm',historico_precos_venda:'++id, receita_uuid, data',config:'chave'})
await velho.open()
await velho.cad_lojas.add({nome:'L'}); await velho.cad_clientes.add({lojaId:1,nome:'C'}); await velho.cad_fiados.add({clienteId:1,lojaId:1,total:5})
await velho.financeiro.bulkAdd([{hash_duplicidade:'HH',valor:1},{valor:2,hash_duplicidade:'H2'}])
await velho.produtos.add({uuid:'p',nome:'x'}); velho.close()
await dbm.db.open()
const l=await dbm.db.cad_lojas.toArray(), f=await dbm.db.financeiro.toArray()
assert.equal(l[0].uid,'lg:cad_lojas:1'); assert.equal((await dbm.db.cad_fiados.toArray())[0].uid,'lg:cad_fiados:1')
assert.deepEqual(f.map(x=>x.uid).sort(),['h:H2','h:HH']); assert.equal((await dbm.db.produtos.toArray()).length,1)
console.log('✔ migração v12→v13: dados preservados e uid determinístico'); process.exit(0)
