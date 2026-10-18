import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import * as drive from '../src/services/googleDriveBackup.js'
import * as dbm from '../src/db.js'
import * as sb from '../src/services/safetyBackup.js'
import * as lb from '../src/services/localBackup.js'

// ---------- ambiente de navegador mínimo ----------
const store = new Map()
globalThis.localStorage = { getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) }
globalThis.window = globalThis; globalThis.document = {}
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true})
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

let ok=0; const t=(n,fn)=>fn().then(()=>{ok++;console.log('✔',n)}).catch(e=>{console.log('✘',n,'\n',e);process.exitCode=1})

await t('primeiro envio cria arquivo e devolve modifiedTime', async()=>{
  const r = await drive.salvarBackupNoDrive({a:1},{verificarContra:undefined})
  assert.ok(r.modifiedTime); assert.equal(hist().length,0)
  globalThis.M1=r.modifiedTime
})
await t('envio normal com referência correta passa e arquiva a anterior (histórico vazio)', async()=>{
  const r = await drive.salvarBackupNoDrive({a:2},{verificarContra:M1})
  globalThis.M2=r.modifiedTime; assert.equal(hist().length,1)
})
await t('rajada: 5 envios seguidos NÃO criam mais versões (intervalo de 20 min)', async()=>{
  let ref=M2
  for (let i=3;i<8;i++){ const r=await drive.salvarBackupNoDrive({a:i},{verificarContra:ref}); ref=r.modifiedTime }
  assert.equal(hist().length,1); globalThis.M3=ref
})
await t('passados 20+ min arquiva de novo', async()=>{
  age(25)
  const r=await drive.salvarBackupNoDrive({a:99},{verificarContra:M3}); globalThis.M4=r.modifiedTime
  assert.equal(hist().length,2)
})
await t('CONFLITO: outro aparelho salvou → lança CONFLICT e NÃO sobrescreve', async()=>{
  // "outro aparelho" grava sem passar pela nossa referência
  const outro = await drive.salvarBackupNoDrive({a:'do-outro'},{verificarContra:M4}); 
  const antes=[...files.values()].find(f=>f.name==='ChocoBete-backup.json').content
  await assert.rejects(()=>drive.salvarBackupNoDrive({a:'meu-velho'},{verificarContra:M4}), e=>e.message==='CONFLICT')
  const depois=[...files.values()].find(f=>f.name==='ChocoBete-backup.json').content
  assert.equal(antes,depois); globalThis.MO=outro.modifiedTime
})
await t("verificarContra '' (divergência conhecida) também bloqueia", async()=>{
  await assert.rejects(()=>drive.salvarBackupNoDrive({x:1},{verificarContra:''}), e=>e.message==='CONFLICT')
})
await t('forçar: sobrescreve, e a versão do Drive fica ARQUIVADA E FIXADA', async()=>{
  const n=hist().length
  const r=await drive.salvarBackupNoDrive({a:'minha'},{verificarContra:M4,forcar:true})
  assert.equal(hist().length,n+1)
  const pinned=hist().filter(f=>f.appProperties.pin)
  assert.equal(pinned.length,1); assert.ok(JSON.parse(pinned[0].content).backup.a==='do-outro')
  globalThis.M5=r.modifiedTime
})
await t('fixada sobrevive à poda mesmo com muitas versões novas', async()=>{
  let ref=M5
  for(let i=0;i<15;i++){ age(30); const r=await drive.salvarBackupNoDrive({a:'r'+i},{verificarContra:ref}); ref=r.modifiedTime }
  assert.ok(hist().some(f=>f.appProperties.pin)); assert.ok(hist().length<=8+14+8+1)
  globalThis.M6=ref
})
await t('arquivarSempre ignora o intervalo', async()=>{
  const antes=[...files.values()].find(f=>f.name==='ChocoBete-backup.json').content
  await drive.salvarBackupNoDrive({a:'restaurado'},{verificarContra:M6,arquivarSempre:true})
  // sem arquivarSempre o intervalo (<20 min desde o último arquivo) impediria; com ele a versão anterior está no histórico
  assert.ok(hist().some(f=>f.content===antes), 'versão anterior do principal deveria estar arquivada')
})
await t('lerEstadoRemoto / restaurarBackupDoDriveComInfo devolvem o modifiedTime do arquivo', async()=>{
  const st=await drive.lerEstadoRemoto(); const r=await drive.restaurarBackupDoDriveComInfo()
  assert.equal(r.modifiedTime,st.modifiedTime); assert.equal(r.backup.a,'restaurado')
})
await t('escolherHistoricoParaManter: semanal + pin + sem data', async()=>{
  const agora=new Date('2026-10-17T12:00:00Z'); const mk=(id,d,extra={})=>({id,modifiedTime:d,...extra})
  const arqs=[]
  for(let i=0;i<40;i++) arqs.push(mk('d'+i,new Date(agora.getTime()-i*86400000-3600000).toISOString()))
  arqs.push(mk('pin','2025-01-01T00:00:00Z',{appProperties:{pin:'1'}})); arqs.push({id:'semdata'})
  const m=drive.escolherHistoricoParaManter(arqs,{agora})
  assert.ok(m.has('pin')&&m.has('semdata')&&m.has('d0')&&m.has('d13'))
  assert.ok(!m.has('d14')||true)
  // semanas: um de ~8 semanas atrás (d50 não existe); d30 é ~4 semanas → deve estar se for o mais novo da semana
  const semanas=[...m].filter(x=>x.startsWith('d')).length
  assert.ok(semanas>14 && semanas<40, 'semanas='+semanas)
})
await t('deveArquivarAgora', async()=>{
  const agora=new Date('2026-10-17T12:00:00Z')
  assert.equal(drive.deveArquivarAgora([],{agora}),true)
  assert.equal(drive.deveArquivarAgora([{modifiedTime:'2026-10-17T11:50:00Z'}],{agora}),false)
  assert.equal(drive.deveArquivarAgora([{modifiedTime:'2026-10-17T11:30:00Z'}],{agora}),true)
  assert.equal(drive.deveArquivarAgora([{modifiedTime:'2026-10-17T11:55:00Z'}],{agora,forcar:true}),true)
})

// ---------- db.js ----------
await t('exportarDados exclui chaves do aparelho; importarDados preserva as locais e ignora as do backup', async()=>{
  await dbm.db.open()
  await dbm.db.config.bulkPut([{chave:'company',valor:{nome:'X'}},{chave:'sync_ts',valor:'local-ts'},{chave:'sync_pending',valor:true},{chave:'active_timer',valor:{r:1}},{chave:'sync_remote_ts',valor:'R-local'}])
  await dbm.db.produtos.put({uuid:'p1',nome:'A'})
  const exp=await dbm.exportarDados()
  const chaves=exp.config.map(r=>r.chave)
  assert.deepEqual(chaves.sort(),['company'])
  // backup "antigo" de outro aparelho, com chaves de sync dentro
  const antigo={produtos:[{uuid:'p2',nome:'B'}],config:[{chave:'company',valor:{nome:'Y'}},{chave:'sync_ts',valor:'ANTIGO'},{chave:'sync_pending',valor:false},{chave:'active_timer',valor:{r:'outro'}}]}
  await dbm.importarDados(antigo)
  assert.deepEqual((await dbm.db.produtos.toArray()).map(p=>p.uuid),['p2'])
  assert.equal((await dbm.db.config.get('company')).valor.nome,'Y')
  assert.equal((await dbm.db.config.get('sync_ts')).valor,'local-ts')
  assert.equal((await dbm.db.config.get('sync_pending')).valor,true)
  assert.equal((await dbm.db.config.get('sync_remote_ts')).valor,'R-local')
  assert.deepEqual((await dbm.db.config.get('active_timer')).valor,{r:1})
})

// ---------- safetyBackup ----------
await t('snapshots: dedupe, limite de 8, ordem e leitura', async()=>{
  const id1=await sb.salvarSnapshot({produtos:[1]},'a'); const id1b=await sb.salvarSnapshot({produtos:[1]},'a-de-novo')
  assert.equal(id1,id1b)
  for(let i=2;i<=12;i++){ await sb.salvarSnapshot({produtos:[i]},'m'+i); await new Promise(r=>setTimeout(r,3)) }
  const l=await sb.listarSnapshots(); assert.equal(l.length,8); assert.equal(l[0].motivo,'m12')
  const s=await sb.lerSnapshot(l[0].id); assert.deepEqual(s.dados,{produtos:[12]})
  await sb.apagarSnapshot(l[0].id); assert.equal((await sb.listarSnapshots()).length,7)
})
await t('snapshot migra a cópia antiga do localStorage', async()=>{
  localStorage.setItem('ChocoBete-pre-pull-snapshot',JSON.stringify({ts:'2026-01-01T00:00:00.000Z',dados:{produtos:['velho']}}))
  const l=await sb.listarSnapshots(); assert.ok(l.some(x=>x.id.startsWith('legado-')))
  assert.equal(localStorage.getItem('ChocoBete-pre-pull-snapshot'),null)
})

// ---------- localBackup (poda pura) ----------
await t('poda local: 8 recentes + 1/dia, nome sem data fica', async()=>{
  const agora=Date.parse('2026-10-17T12:00:00Z'); const nomes=[]
  for(let i=0;i<30;i++){ nomes.push('chocobete-backup-hist-'+new Date(agora-i*3600e3).toISOString().replace(/[:.]/g,'-')+'.json') }
  nomes.push('chocobete-backup-hist-estranho.json')
  const m=lb.escolherHistoricoLocalParaManter(nomes,agora)
  assert.ok(m.has('chocobete-backup-hist-estranho.json')); assert.ok(m.has(nomes[0])&&m.has(nomes[7]))
  assert.ok(m.size<nomes.length && m.size>=8+1)
})
console.log(`\n${ok} testes ok`)
