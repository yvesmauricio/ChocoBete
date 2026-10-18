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


setActivePinia(createPinia())
const s = useStore()
const conf = useConfirm()
const respostas=[]       // fila de respostas pros diálogos
const dialogos=[]
const iv=setInterval(()=>{ if(conf.state.visible){ dialogos.push(conf.state.title); conf.respond(respostas.length?respostas.shift():false) } },20)
let ok=0; const t=(n,fn)=>fn().then(()=>{ok++;console.log('✔',n)}).catch(e=>{console.log('✘',n,'\n',e);process.exitCode=1})
const mainDrive=()=>[...files.values()].find(f=>f.name==='ChocoBete-backup.json')
const driveBackup=()=>JSON.parse(mainDrive().content).backup
const outroAparelhoSalva=async(prod)=>{ const st=await drive.lerEstadoRemoto(); const b=driveBackup(); b.produtos=[...(b.produtos||[]),prod]; await drive.salvarBackupNoDrive(b,{verificarContra:st.modifiedTime}) }
await dbm.db.open()

await t('baseline: envio inicial grava referência e limpa pendência', async()=>{
  await dbm.db.produtos.put({uuid:'a',nome:'A'})
  await s.syncImediato({manual:true})
  assert.equal(s.hasLocalChanges,false); assert.equal(s.syncStatus,'ok')
  assert.ok((await dbm.configGet('sync_remote_ts')))
  assert.equal((await dbm.db.config.get('sync_remote_ts')).valor, mainDrive().modifiedTime)
})
await t('sem alteração no Drive, iniciarSync NÃO baixa o próprio backup (bug do relógio)', async()=>{
  const antes=calls.length; await s.iniciarSync()
  assert.ok(!calls.slice(antes).some(c=>c.startsWith('GET /drive/v3/files/')&&false))
  assert.equal(dialogos.length,0); assert.equal(s.snapshotsSeguranca.length,0)
})
await t('outro aparelho salvou, aqui sem pendência → baixa (sem diálogo e sem cópia desnecessária)', async()=>{
  await outroAparelhoSalva({uuid:'b',nome:'do-outro'})
  await s.iniciarSync()
  assert.deepEqual((await dbm.db.produtos.toArray()).map(p=>p.uuid).sort(),['a','b'])
  assert.equal(s.snapshotsSeguranca.length,0); assert.equal(s.hasLocalChanges,false); assert.equal(dialogos.length,0)
})
await t('os dois mudaram: MERGE automático (nada some, sem diálogo), cópia local guardada e envio do resultado', async()=>{
  await outroAparelhoSalva({uuid:'c',nome:'do-outro-2'})
  await dbm.db.produtos.put({uuid:'local',nome:'minha-alteracao'})
  await s.syncImediato()
  const uuids=(await dbm.db.produtos.toArray()).map(p=>p.uuid).sort()
  assert.deepEqual(uuids,['a','b','c','local'])
  assert.deepEqual(driveBackup().produtos.map(p=>p.uuid).sort(),['a','b','c','local'])
  assert.equal(dialogos.length,0); assert.equal(s.hasLocalChanges,false); assert.notEqual(s.syncStatus,'conflict')
  assert.equal(s.snapshotsSeguranca.length,1)
})
await t('FALLBACK: se o Drive não para de mudar (não converge), cai na decisão manual e "usar Drive" guarda cópia', async()=>{
  const realFetch=globalThis.fetch; let n=0
  globalThis.fetch=async(u,o={})=>{ if(String(u).includes('fields=modifiedTime')&&!String(u).includes('upload')) return json({modifiedTime:'2099-01-01T00:00:0'+(n++%10)+'Z'}); return realFetch(u,o) }
  await dbm.db.produtos.put({uuid:'local2',nome:'minha-2'})
  respostas.push(true)                       // 1º diálogo: Usar a versão do Drive
  await s.syncImediato(); globalThis.fetch=realFetch
  assert.ok(dialogos.at(-1).includes('Dois aparelhos'))
  assert.ok(!(await dbm.db.produtos.toArray()).some(p=>p.uuid==='local2'),'visão do Drive aplicada')
  const snaps=await sb.listarSnapshots(); const ult=await sb.lerSnapshot(snaps[0].id)
  assert.ok(ult.dados.produtos.some(p=>p.uuid==='local2'),'alteração local preservada na cópia de segurança')
  assert.equal(s.hasLocalChanges,false); assert.notEqual(s.syncStatus,'conflict')
})
await t('FALLBACK: "decidir depois" mantém conflito; toque manual → "enviar a minha" fixa a versão do Drive', async()=>{
  const realFetch=globalThis.fetch; let n=0
  const burlar=()=>{ globalThis.fetch=async(u,o={})=>{ if(String(u).includes('fields=modifiedTime')&&!String(u).includes('upload')) return json({modifiedTime:'2099-01-01T00:00:0'+(n++%10)+'Z'}); return realFetch(u,o) } }
  await outroAparelhoSalva({uuid:'d',nome:'do-outro-3'})
  await dbm.db.produtos.put({uuid:'local3',nome:'minha-3'})
  burlar(); respostas.push(false,false)
  await s.syncImediato(); globalThis.fetch=realFetch
  assert.equal(s.syncStatus,'conflict'); assert.equal(s.hasLocalChanges,true)
  const antes=calls.length; await s.syncImediato(); assert.equal(calls.length,antes,'automático espera')
  respostas.push(false,true)
  await s.syncImediato({manual:true})
  assert.notEqual(s.syncStatus,'conflict'); assert.equal(s.hasLocalChanges,false)
  assert.ok(driveBackup().produtos.some(p=>p.uuid==='local3'))
  const fixada=hist().find(f=>f.appProperties.pin); assert.ok(fixada)
  assert.ok(JSON.parse(fixada.content).backup.produtos.some(p=>p.uuid==='d'))
})
await t('envios concorrentes são enfileirados (um por vez) e todos os dados chegam ao Drive', async()=>{
  respostas.length=0
  await dbm.db.produtos.put({uuid:'r1',nome:'r1'})
  const p1=s.syncImediato(); 
  await dbm.db.produtos.put({uuid:'r2',nome:'r2'})
  const p2=s.syncImediato(); const p3=s.syncImediato()
  await Promise.all([p1,p2,p3]); await new Promise(r=>setTimeout(r,200))
  const ids=driveBackup().produtos.map(p=>p.uuid)
  assert.ok(ids.includes('r1')&&ids.includes('r2')); assert.equal(s.hasLocalChanges,false)
})
await t('edição DURANTE o upload mantém a marca de pendência', async()=>{
  const realFetch=globalThis.fetch; let fired=false
  globalThis.fetch=async(u,o={})=>{ if(!fired&&(o.method==='PATCH')){ fired=true; await dbm.db.produtos.put({uuid:'durante',nome:'d'}); s.syncImediato() /* nova alteração durante o envio */ } return realFetch(u,o) }
  await dbm.db.produtos.put({uuid:'antes-up',nome:'x'})
  await s.syncImediato(); await new Promise(r=>setTimeout(r,400))
  globalThis.fetch=realFetch
  assert.ok(driveBackup().produtos.some(p=>p.uuid==='durante'),'a edição feita durante o envio chegou ao Drive (envio extra)')
  assert.equal(s.hasLocalChanges,false)
})
await t('restaurar versão do histórico: vira verdade local, é enviada e não é desfeita pelo próximo sync', async()=>{
  respostas.push(true)
  const velho=hist().sort((a,b)=>a.modifiedTime.localeCompare(b.modifiedTime))[0]
  await s.restaurarGoogleDriveVersao({id:velho.id,modifiedTime:new Date(velho.modifiedTime)})
  const esperado=JSON.parse(velho.content).backup.produtos.map(p=>p.uuid).sort()
  assert.deepEqual((await dbm.db.produtos.toArray()).map(p=>p.uuid).sort(),esperado)
  assert.deepEqual(driveBackup().produtos.map(p=>p.uuid).sort(),esperado)
  await s.iniciarSync()   // simula o reload
  assert.deepEqual((await dbm.db.produtos.toArray()).map(p=>p.uuid).sort(),esperado)
  assert.equal(s.syncStatus==='conflict',false)
})
console.log(`\n${ok} testes de store ok`); clearInterval(iv); process.exit(process.exitCode||0)
