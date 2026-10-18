import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { useStore } from '../src/store.js'
import { useConfirm } from '../src/composables/useConfirm.js'
import assert from 'node:assert/strict'
import * as drive from '../src/services/googleDriveBackup.js'
import * as dbm from '../src/db.js'
import * as sb from '../src/services/safetyBackup.js'

// ---------- ambiente de navegador mínimo ----------
const store = new Map()
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) }
globalThis.window = globalThis; globalThis.document = {}
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true})
localStorage.setItem('ChocoBete-google-drive-connected','1')
globalThis.history={pushState(){},back(){}}
window.addEventListener=()=>{}
localStorage.setItem('ChocoBete-gtoken', JSON.stringify({token:'T', exp: Date.now()+3_000_000}))

// ---------- Drive falso em memória ----------
let seq = 0; const files = new Map()  // id -> {id,name,parents,appProperties,content,modifiedTime}
let tick = 0
const stamp = () => new Date(Date.now() + (++tick)*1000).toISOString()
const json = (o)=>({ok:true,status:200,json:async()=>o,text:async()=>JSON.stringify(o)})
const calls = []
globalThis.fetch = async (url, opts={}) => {
  const u = new URL(url); const method = opts.method||'GET'; calls.push(method+' '+u.pathname)
  if (u.pathname.startsWith('/upload/')) {
    const m = u.pathname.match(/files\/(.+)$/); 
    const body = opts.body; const boundary = body.match(/^--(\S+)\r\n/)[1]
    const parts = body.split('--'+boundary).filter(p=>p.trim() && p.trim()!=='--')
    const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].replace(/\r\n$/,''))
    const content = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/,'')
    let f
    if (method==='POST') { f={id:'f'+(++seq),name:meta.name,parents:meta.parents,appProperties:meta.appProperties||{},content,modifiedTime:stamp()}; files.set(f.id,f) }
    else { f=files.get(m[1]); f.content=content; f.modifiedTime=stamp(); if(meta.appProperties) f.appProperties=meta.appProperties }
    return json({id:f.id,modifiedTime:f.modifiedTime})
  }
  const m = u.pathname.match(/\/drive\/v3\/files\/(.+)$/)
  if (m) {
    const f = files.get(m[1]); if(!f) return {ok:false,status:404,text:async()=>'nf'}
    if (method==='DELETE') { files.delete(m[1]); return json({}) }
    if (u.searchParams.get('alt')==='media') return {ok:true,status:200,text:async()=>f.content,json:async()=>JSON.parse(f.content)}
    return json({modifiedTime:f.modifiedTime})
  }
  const q = u.searchParams.get('q')||''
  let list=[...files.values()]
  if (q.includes("name='ChocoBete-backup.json'")) list=list.filter(f=>f.name==='ChocoBete-backup.json')
  else list=list.filter(f=>f.name.startsWith('ChocoBete-backup-hist-'))
  list.sort((a,b)=>b.modifiedTime.localeCompare(a.modifiedTime))
  if (u.searchParams.get('pageSize')==='1') list=list.slice(0,1)
  return json({files:list.map(f=>({id:f.id,name:f.name,modifiedTime:f.modifiedTime,size:String(f.content.length),appProperties:f.appProperties}))})
}

const hist = ()=>[...files.values()].filter(f=>f.name.startsWith('ChocoBete-backup-hist-'))
const age = (min)=>hist().forEach(f=>f.modifiedTime=new Date(new Date(f.modifiedTime).getTime()-min*60000).toISOString())



const conf = useConfirm()
const dialogos=[]
const iv=setInterval(()=>{ if(conf.state.visible){ dialogos.push(conf.state.title); conf.respond(false) } },20)
let ok=0; const t=(n,fn)=>fn().then(()=>{ok++;console.log('✔',n)}).catch(e=>{console.log('✘',n,'\n',e);process.exitCode=1})
const mainDrive=()=>[...files.values()].find(f=>f.name==='ChocoBete-backup.json')
const driveBackup=()=>JSON.parse(mainDrive().content).backup

// ── harness de aparelhos: cada um tem seu banco, sua base e seu store ──
const TABS=()=>dbm.db.tables.map(t=>t.name)
async function salvarAparelho(){ const raw={}; for(const n of TABS()) raw[n]=await dbm.db[n].toArray(); const b=await sb.lerBase(); return {raw,base:b?.dados||null} }
async function carregarAparelho(est){
  await dbm.db.open()
  await dbm.db.transaction('rw',dbm.db.tables,async()=>{ for(const n of TABS()){ await dbm.db[n].clear(); if(est?.raw?.[n]?.length) await dbm.db[n].bulkPut(est.raw[n]) } })
  if(est?.base) await sb.salvarBase(est.base); else await sb.apagarBase()
  setActivePinia(createPinia()); return useStore()
}
const aparelho=()=>({raw:{},base:null})
let A=aparelho(), B=aparelho()
const usar=async(nome)=>{ // troca de aparelho: guarda o atual, carrega o outro
  if(usar.atual===nome) return globalThis.s
  if(usar.atual==='A') A=await salvarAparelho(); if(usar.atual==='B') B=await salvarAparelho()
  usar.atual=nome; globalThis.s=await carregarAparelho(nome==='A'?A:B); return globalThis.s }
usar.atual=null
const nomes=async(tab)=> (await dbm.db[tab].toArray()).map(r=>r.nome||r.uid).sort()
const esperar=()=>new Promise(r=>setTimeout(r,60))

await t('A cria loja+cliente e envia; B (novo) entra e recebe tudo', async()=>{
  let s=await usar('A')
  await dbm.db.cad_lojas.add({nome:'Loja 1'}); await dbm.db.cad_clientes.add({lojaId:1,nome:'Ana'})
  await s.syncImediato({manual:true}); assert.equal(s.hasLocalChanges,false)
  assert.ok((await dbm.db.cad_lojas.toArray())[0].uid,'uid automático')
  s=await usar('B'); await s.iniciarSync()
  assert.deepEqual(await nomes('cad_clientes'),['Ana']); assert.equal(s.snapshotsSeguranca.length,0)
})
await t('IDs colidindo: A e B criam cliente id 2 sem sincronizar; ao sincronizar ninguém perde nada', async()=>{
  let s=await usar('A'); const idDoA=await dbm.db.cad_clientes.add({lojaId:1,nome:'DoA'}); await s.syncImediato()
  s=await usar('B'); // B ainda não viu o DoA
  const idB=await dbm.db.cad_clientes.add({lojaId:1,nome:'DoB'}) // (o gerador de ids do fake-indexeddb é compartilhado entre os 'aparelhos' do teste)
  await dbm.db.cad_fiados.add({clienteId:idB,lojaId:1,clienteNome:'DoB',total:50,saldo:50,status:'aberto',pagamentos:[]})
  await s.syncImediato()                       // B encontra o Drive alterado → merge automático
  assert.equal(dialogos.length,0,'sem diálogo de conflito')
  assert.deepEqual(await nomes('cad_clientes'),['Ana','DoA','DoB'])
  const cli=await dbm.db.cad_clientes.toArray(); const idDoB=cli.find(c=>c.nome==='DoB').id
  assert.equal((await dbm.db.cad_fiados.toArray())[0].clienteId,idDoB)
  assert.deepEqual(driveBackup().cad_clientes.map(c=>c.nome).sort(),['Ana','DoA','DoB'])
  s=await usar('A'); await s.iniciarSync()
  assert.deepEqual(await nomes('cad_clientes'),['Ana','DoA','DoB'])
  const a=await dbm.db.cad_clientes.toArray(); assert.equal(a.find(c=>c.nome==='DoA').id,idDoA,'id local do A preservado')
  const f=(await dbm.db.cad_fiados.toArray())[0]; assert.equal(f.clienteId,a.find(c=>c.nome==='DoB').id,'fiado aponta pro cliente certo no A também')
})
await t('dois pagamentos na mesma compra, um em cada aparelho: soma certa', async()=>{
  let s=await usar('A'); const fid=(await dbm.db.cad_fiados.toArray())[0].id
  const f0=await dbm.db.cad_fiados.get(fid)
  await dbm.db.cad_fiados.put({...f0,pagamentos:[{valor:20,criadoEm:'2026-10-17T10:00:00Z'}],saldo:30})
  s=await usar('B'); const f1=await dbm.db.cad_fiados.get((await dbm.db.cad_fiados.toArray())[0].id)
  await dbm.db.cad_fiados.put({...f1,pagamentos:[{valor:10,criadoEm:'2026-10-17T10:05:00Z'}],saldo:40})
  await s.syncImediato()                       // B envia
  s=await usar('A'); await s.syncImediato()    // A: Drive mudou e A tem alteração → merge
  const f=(await dbm.db.cad_fiados.toArray())[0]
  assert.equal(f.pagamentos.length,2); assert.equal(f.saldo,20)
  s=await usar('B'); await s.iniciarSync(); const fb=(await dbm.db.cad_fiados.toArray())[0]
  assert.equal(fb.pagamentos.length,2); assert.equal(fb.saldo,20)
})
await t('exclusão num aparelho propaga; edição concorrente de outro registro não é perdida', async()=>{
  let s=await usar('A'); const cli=await dbm.db.cad_clientes.toArray()
  await dbm.db.cad_clientes.delete(cli.find(c=>c.nome==='Ana').id)
  await dbm.db.cad_clientes.update(cli.find(c=>c.nome==='DoA').id,{telefone:'999'})
  await s.syncImediato()
  s=await usar('B'); const clib=await dbm.db.cad_clientes.toArray()
  await dbm.db.cad_clientes.update(clib.find(c=>c.nome==='DoB').id,{telefone:'888'})
  await s.syncImediato()
  assert.deepEqual(await nomes('cad_clientes'),['DoA','DoB'])
  const m=await dbm.db.cad_clientes.toArray(); assert.equal(m.find(c=>c.nome==='DoA').telefone,'999'); assert.equal(m.find(c=>c.nome==='DoB').telefone,'888')
})
await t('mesmo campo editado nos dois: vale o mais recente (o último a editar)', async()=>{
  let s=await usar('A'); await s.iniciarSync()
  const ca=(await dbm.db.cad_clientes.toArray())[0]; await dbm.db.cad_clientes.update(ca.id,{nome:'Nome do A'}); s.syncImediato; // marca só local
  await dbm.configSet('sync_last_change',new Date(Date.now()-60000).toISOString()); await dbm.configSet('sync_pending',true); s.hasLocalChanges=true
  s=await usar('B'); const cb=(await dbm.db.cad_clientes.toArray()).find(c=>c.uid===ca.uid)
  await dbm.db.cad_clientes.update(cb.id,{nome:'Nome do B'})
  await s.syncImediato()    // B edita DEPOIS (agora) e envia
  s=await usar('A'); await s.syncImediato({manual:true})
  assert.equal((await dbm.db.cad_clientes.toArray()).find(c=>c.uid===ca.uid).nome,'Nome do B')
})
await t('app antigo sem uid: restaurar backup antigo dá uid determinístico e não duplica', async()=>{
  const s=await usar('A')
  await dbm.importarDados({cad_lojas:[{id:1,nome:'X'}],cad_clientes:[{id:1,lojaId:1,nome:'Y'}],cad_fiados:[],financeiro:[{id:1,hash_duplicidade:'H1',valor:1}]})
  assert.equal((await dbm.db.cad_lojas.get(1)).uid,'lg:cad_lojas:1'); assert.equal((await dbm.db.financeiro.get(1)).uid,'h:H1')
})
await t('db: uid sobrevive a put() sem o campo e é gerado em registros novos', async()=>{
  const id=await dbm.db.cad_lojas.add({nome:'Z'}); const u=(await dbm.db.cad_lojas.get(id)).uid; assert.ok(u)
  await dbm.db.cad_lojas.put({id,nome:'Z2'}); assert.equal((await dbm.db.cad_lojas.get(id)).uid,u)
})
await t('merge ao vivo: edição local feita DURANTE o download não se perde (guarda de corrida)', async()=>{
  let s=await usar('A'); await s.syncImediato({manual:true})
  s=await usar('B'); await s.iniciarSync()
  // A salva algo novo no Drive
  s=await usar('A'); await dbm.db.cad_lojas.add({nome:'LojaA2'}); await s.syncImediato()
  // B tem alteração local e, no meio do sync, grava outra coisa
  s=await usar('B'); await dbm.db.cad_lojas.add({nome:'LojaB1'}); 
  const realFetch=globalThis.fetch; let fired=false
  globalThis.fetch=async(u,o={})=>{ const r=await realFetch(u,o); if(!fired && String(u).includes('alt=media')){ fired=true; await dbm.db.cad_lojas.add({nome:'LojaB-DURANTE'}) } return r }
  await s.syncImediato(); globalThis.fetch=realFetch
  const n=await nomes('cad_lojas'); for(const x of ['LojaA2','LojaB1','LojaB-DURANTE']) assert.ok(n.includes(x),'perdeu '+x+' → '+n)
  assert.ok(driveBackup().cad_lojas.some(l=>l.nome==='LojaB-DURANTE'),'e chegou ao Drive')
})
console.log(`\n${ok} testes de store (fase 2) ok`); clearInterval(iv); process.exit(process.exitCode||0)
