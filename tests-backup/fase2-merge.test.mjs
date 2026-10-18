import assert from 'node:assert/strict'
import { mesclar, igual } from '../src/services/merge.js'
let ok=0; const t=(n,fn)=>{ try{ fn(); ok++; console.log('✔',n) }catch(e){ console.log('✘',n,'\n',e.message); process.exitCode=1 } }

const vazio=()=>({produtos:[],receitas:[],producoes:[],financeiro:[],historico_precos:[],historico_precos_venda:[],cad_lojas:[],cad_clientes:[],cad_fiados:[],cardapio_pedidos:[],config:[]})
const clone=x=>JSON.parse(JSON.stringify(x))
// base comum: 1 loja, 1 cliente, 1 fiado de 100 com nenhum pagamento
const baseComum=()=>{ const d=vazio()
  d.cad_lojas=[{id:1,uid:'L1',nome:'Loja A'}]
  d.cad_clientes=[{id:1,uid:'C1',lojaId:1,nome:'Ana'}]
  d.cad_fiados=[{id:1,uid:'F1',clienteId:1,lojaId:1,clienteNome:'Ana',lojaNome:'Loja A',total:100,saldo:100,status:'aberto',pagamentos:[],estornos:[],dataVenc:'2026-11-01'}]
  d.produtos=[{uuid:'p1',nome:'Farinha',preco:5}]
  d.config=[{chave:'company',valor:{nome:'Choco',whatsapp:'1'}}]
  return d }
const porUid=(d,t)=>Object.fromEntries(d[t].map(r=>[r.uid||r.uuid,r]))

t('IDs colidindo: cada aparelho cria um cliente com id 2 → ambos sobrevivem com ids distintos', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  A.cad_clientes.push({id:2,uid:'CA',lojaId:1,nome:'Do A'})
  B.cad_clientes.push({id:2,uid:'CB',lojaId:1,nome:'Do B'})
  const r=mesclar({base,local:A,remote:B})
  const nomes=r.dados.cad_clientes.map(c=>c.nome).sort(); assert.deepEqual(nomes,['Ana','Do A','Do B'])
  const ids=r.dados.cad_clientes.map(c=>c.id); assert.equal(new Set(ids).size,3)
  assert.equal(r.dados.cad_clientes.find(c=>c.uid==='CA').id,2,'id local preservado')
  assert.equal(r.dados.cad_clientes.find(c=>c.uid==='CB').id,3,'do outro ganha id novo')
})
t('FK remapeada: fiado do outro aparelho aponta pro cliente certo no espaço de ids local', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  A.cad_clientes.push({id:2,uid:'CA',lojaId:1,nome:'Do A'})
  B.cad_clientes.push({id:2,uid:'CB',lojaId:1,nome:'Do B'})
  B.cad_fiados.push({id:2,uid:'FB',clienteId:2,lojaId:1,clienteNome:'Do B',total:50,saldo:50,status:'aberto',pagamentos:[]})
  const r=mesclar({base,local:A,remote:B})
  const cB=r.dados.cad_clientes.find(c=>c.uid==='CB'); const fB=r.dados.cad_fiados.find(f=>f.uid==='FB')
  assert.equal(fB.clienteId,cB.id); assert.notEqual(fB.clienteId,2)
})
t('dois pagamentos diferentes na MESMA compra → união, saldo recalculado (100-30-20=50)', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  const pA={valor:30,data:'2026-10-17',hora:'10:00',criadoEm:'2026-10-17T13:00:00Z'}, pB={valor:20,data:'2026-10-17',hora:'10:05',criadoEm:'2026-10-17T13:05:00Z'}
  Object.assign(A.cad_fiados[0],{pagamentos:[pA],saldo:70}); Object.assign(B.cad_fiados[0],{pagamentos:[pB],saldo:80})
  for (const pref of [true,false]){
    const f=mesclar({base,local:A,remote:B,preferirLocal:pref}).dados.cad_fiados[0]
    assert.equal(f.pagamentos.length,2); assert.equal(f.saldo,50); assert.equal(f.status,'aberto')
  }
})
t('pagamentos que quitam juntos → status pago e pagoEm preenchido', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  Object.assign(A.cad_fiados[0],{pagamentos:[{valor:60,criadoEm:'2026-10-17T13:00:00Z'}],saldo:40})
  Object.assign(B.cad_fiados[0],{pagamentos:[{valor:40,criadoEm:'2026-10-17T13:05:00Z'}],saldo:60})
  const f=mesclar({base,local:A,remote:B}).dados.cad_fiados[0]
  assert.equal(f.saldo,0); assert.equal(f.status,'pago'); assert.ok(f.pagoEm)
})
t('estorno num aparelho + pagamento novo no outro', ()=>{
  const base=baseComum(); const P={valor:30,criadoEm:'2026-10-16T10:00:00Z'}; Object.assign(base.cad_fiados[0],{pagamentos:[P],saldo:70})
  const A=clone(base), B=clone(base)
  Object.assign(A.cad_fiados[0],{pagamentos:[],saldo:100,estornos:[{valor:30,criadoEm:'2026-10-17T10:00:00Z'}]})
  Object.assign(B.cad_fiados[0],{pagamentos:[P,{valor:10,criadoEm:'2026-10-17T11:00:00Z'}],saldo:60})
  const f=mesclar({base,local:A,remote:B}).dados.cad_fiados[0]
  assert.deepEqual(f.pagamentos.map(p=>p.valor),[10]); assert.equal(f.saldo,90); assert.equal(f.estornos.length,1)
})
t('campos diferentes do mesmo registro: junta os dois (sem conflito)', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  A.cad_clientes[0].telefone='111'; B.cad_clientes[0].nome='Ana Maria'
  const r=mesclar({base,local:A,remote:B}); const c=r.dados.cad_clientes[0]
  assert.equal(c.telefone,'111'); assert.equal(c.nome,'Ana Maria'); assert.equal(r.resumo.conflitos,0)
})
t('mesmo campo nos dois: vale o mais recente (preferirLocal) e conta conflito', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  A.produtos[0].preco=7; B.produtos[0].preco=9
  assert.equal(mesclar({base,local:A,remote:B,preferirLocal:true}).dados.produtos[0].preco,7)
  const r=mesclar({base,local:A,remote:B,preferirLocal:false}); assert.equal(r.dados.produtos[0].preco,9); assert.equal(r.resumo.conflitos,1)
})
t('exclusão: apagado aqui e intocado lá → some; apagado aqui e EDITADO lá → fica', ()=>{
  const base=baseComum(); base.produtos.push({uuid:'p2',nome:'Açúcar',preco:3},{uuid:'p3',nome:'Sal',preco:1})
  const A=clone(base), B=clone(base)
  A.produtos=A.produtos.filter(p=>p.uuid==='p1') // apagou p2 e p3
  B.produtos.find(p=>p.uuid==='p3').preco=2        // editou p3
  const nomes=mesclar({base,local:A,remote:B}).dados.produtos.map(p=>p.uuid).sort()
  assert.deepEqual(nomes,['p1','p3'])
})
t('exclusão remota de registro que o local não mexeu propaga', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base); B.produtos=[]
  assert.equal(mesclar({base,local:A,remote:B}).dados.produtos.length,0)
})
t('pai apagado mas filho novo no outro aparelho → pai ressuscita (sem órfão)', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  A.cad_fiados=[]; A.cad_clientes=[]; A.cad_lojas=[]          // A apagou tudo da caderneta
  B.cad_fiados.push({id:2,uid:'FN',clienteId:1,lojaId:1,total:10,saldo:10,status:'aberto',pagamentos:[]})
  const r=mesclar({base,local:A,remote:B})
  assert.ok(r.dados.cad_fiados.some(f=>f.uid==='FN')); assert.ok(r.dados.cad_clientes.some(c=>c.uid==='C1')); assert.ok(r.dados.cad_lojas.some(l=>l.uid==='L1'))
  assert.ok(r.resumo.ressuscitados>=2)
  const f=r.dados.cad_fiados.find(f=>f.uid==='FN'); assert.equal(f.clienteId,r.dados.cad_clientes.find(c=>c.uid==='C1').id)
})
t('financeiro: mesma transação importada nos dois aparelhos (mesmo hash) vira UM registro', ()=>{
  const base=vazio(); const A=clone(base), B=clone(base)
  A.financeiro.push({id:1,hash_duplicidade:'abc',valor:10,descricao:'x'})
  B.financeiro.push({id:7,hash_duplicidade:'abc',valor:10,descricao:'x'},{id:8,hash_duplicidade:'def',valor:5})
  const r=mesclar({base,local:A,remote:B}); assert.equal(r.dados.financeiro.length,2)
  const hs=r.dados.financeiro.map(f=>f.hash_duplicidade).sort(); assert.deepEqual(hs,['abc','def'])
  assert.equal(r.dados.financeiro.find(f=>f.hash_duplicidade==='abc').id,1)
})
t('config: chaves diferentes e campos diferentes do mesmo objeto', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base)
  A.config.find(c=>c.chave==='company').valor.whatsapp='21'; B.config.find(c=>c.chave==='company').valor.slogan='doce'
  B.config.push({chave:'modo_lista_compras',valor:'estoque'})
  const r=mesclar({base,local:A,remote:B}); const co=r.dados.config.find(c=>c.chave==='company').valor
  assert.deepEqual(co,{nome:'Choco',whatsapp:'21',slogan:'doce'}); assert.equal(r.dados.config.find(c=>c.chave==='modo_lista_compras').valor,'estoque')
})
t('sem base (primeira vez): união, nada some', ()=>{
  const A=baseComum(), B=baseComum(); A.produtos.push({uuid:'a',nome:'A'}); B.produtos.push({uuid:'b',nome:'B'})
  const r=mesclar({base:null,local:A,remote:B}); assert.deepEqual(r.dados.produtos.map(p=>p.uuid).sort(),['a','b','p1'])
})
t('só o remoto mudou → resultado == remoto (igualAoRemoto) e ids locais preservados', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base); B.cad_clientes.push({id:2,uid:'CB',lojaId:1,nome:'Novo'})
  const r=mesclar({base,local:A,remote:B}); assert.equal(r.igualAoLocal,false); assert.equal(r.igualAoRemoto,true)
})
t('só o local mudou → igualAoLocal', ()=>{
  const base=baseComum(); const A=clone(base), B=clone(base); A.produtos[0].preco=99
  const r=mesclar({base,local:A,remote:B}); assert.equal(r.igualAoLocal,true); assert.equal(r.igualAoRemoto,false)
})
t('nada mudou → idêntico aos dois', ()=>{
  const base=baseComum(); const r=mesclar({base,local:clone(base),remote:clone(base)}); assert.ok(r.igualAoLocal&&r.igualAoRemoto)
  assert.ok(igual(r.dados.cad_fiados,base.cad_fiados))
})
t('backup antigo sem uid: aparelhos com o mesmo lineage casam pelos uids legados', ()=>{
  const velho=vazio(); velho.cad_lojas=[{id:1,nome:'X'}]; velho.cad_clientes=[{id:1,lojaId:1,nome:'Y'}]
  const A=clone(velho), B=clone(velho); B.cad_clientes[0].nome='Y2'
  const r=mesclar({base:velho,local:A,remote:B}); assert.equal(r.dados.cad_clientes.length,1); assert.equal(r.dados.cad_clientes[0].nome,'Y2')
  assert.equal(r.dados.cad_clientes[0].lojaId,1)
})
t('tabela desconhecida é repassada do local, sem perder linhas', ()=>{
  const base=baseComum(); const A=clone(base); A.tabela_nova=[{x:1}]; const r=mesclar({base,local:A,remote:clone(base)}); assert.deepEqual(r.dados.tabela_nova,[{x:1}])
})
t('lista sem identidade (strings) e conflito: não explode', ()=>{
  const base=baseComum(); base.config.push({chave:'tags',valor:['a','b']}); const A=clone(base), B=clone(base)
  A.config.find(c=>c.chave==='tags').valor=['a','b','c']; B.config.find(c=>c.chave==='tags').valor=['a','b','d']
  const v=mesclar({base,local:A,remote:B}).dados.config.find(c=>c.chave==='tags').valor; assert.deepEqual(v.sort(),['a','b','c','d'])
})

// ── Convergência aleatória: operações NÃO conflitantes em dois aparelhos ──
function rnd(seed){ let s=seed; return ()=> (s=(s*1664525+1013904223)%4294967296)/4294967296 }
t('aleatório (300 rodadas): A⊕B e B⊕A convergem (em uid) e nenhum registro novo se perde', ()=>{
  for(let seed=1;seed<=300;seed++){
    const R=rnd(seed); const base=baseComum()
    for(let i=0;i<5;i++) base.cad_fiados.push({id:i+2,uid:'BF'+i,clienteId:1,lojaId:1,total:10*(i+1),saldo:10*(i+1),status:'aberto',pagamentos:[]})
    const A=clone(base), B=clone(base); let n=100
    const novos=[]
    for(const [X,nome] of [[A,'A'],[B,'B']]){
      const ops=1+Math.floor(R()*4)
      for(let o=0;o<ops;o++){
        const k=R()
        if(k<.35){ const uid=nome+'N'+(n++); const id=Math.max(...X.cad_fiados.map(f=>f.id))+1; X.cad_fiados.push({id,uid,clienteId:1,lojaId:1,total:5,saldo:5,status:'aberto',pagamentos:[]}); novos.push(uid) }
        else if(k<.7){ const f=X.cad_fiados[Math.floor(R()*X.cad_fiados.length)]; if(f.uid.startsWith('BF')&&nome==='A'? true: true){ const campo=nome==='A'?'obsA':'obsB'; f[campo]='x'+seed } }
        else { // pagamento em fiado base (campos distintos entre aparelhos não existe: pagamentos têm criadoEm único)
          const f=X.cad_fiados.find(f=>f.uid==='BF'+Math.floor(R()*5)); if(f){ f.pagamentos=[...f.pagamentos,{valor:1,criadoEm:`${nome}-${seed}-${o}`}]; f.saldo=f.total-f.pagamentos.length } }
      }
    }
    const ab=mesclar({base,local:A,remote:B,preferirLocal:true}), ba=mesclar({base,local:B,remote:A,preferirLocal:false})
    const canon=x=>Array.isArray(x)?x.map(canon):(x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x)
    const norm=d=>JSON.stringify(canon(d.cad_fiados.map(f=>{const c={...f};delete c.id;return c}).sort((x,y)=>x.uid.localeCompare(y.uid))))
    assert.equal(norm(ab.dados),norm(ba.dados),'divergiu seed '+seed)
    for(const u of novos) assert.ok(ab.dados.cad_fiados.some(f=>f.uid===u),'perdeu '+u+' seed '+seed)
    assert.equal(new Set(ab.dados.cad_fiados.map(f=>f.id)).size,ab.dados.cad_fiados.length)
  }
})
console.log(`\n${ok} testes de merge ok`)
