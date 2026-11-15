// Painel "Caderneta no servidor": quem decide, o que posso fazer, e as travas de ligar/desligar. Puro, sem Vue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumirAcesso, podeAlternarModo, travasDesligar, compararComServidor, saldoAbertoLocal, ACOES } from '../src/services/resumoAcesso.js'
import { PERMISSOES_VENDAS, SO_ADMIN } from '../functions/_lib/papeis.js'

const admin = { usuario: 'dono@x.com', papel: 'admin', permissoes: [...PERMISSOES_VENDAS, ...SO_ADMIN], janela_desfazer_min: 15 }
const vendas = { usuario: 'bete@x.com', papel: 'vendas', permissoes: [...PERMISSOES_VENDAS], janela_desfazer_min: 15 }
const estado = (r, tipo) => r.acoes.find(a => a.tipo === tipo).estado

test('a lista de ações do painel cobre exatamente as permissões do servidor (não desatualiza)', () => {
  assert.deepEqual(ACOES.map(a => a.tipo).sort(), [...PERMISSOES_VENDAS, ...SO_ADMIN].sort())
  assert.deepEqual(ACOES.filter(a => a.soAdmin).map(a => a.tipo).sort(), [...SO_ADMIN].sort())
})

test('modo servidor + login admin: pode tudo, mesmo no aparelho Admin (o papel do aparelho não manda)', () => {
  const r = resumirAcesso({ noServidor: true, papelAparelho: 'admin', acesso: admin })
  assert.ok(r.acoes.every(a => a.estado === 'sim')); assert.equal(r.avisos.length, 0); assert.equal(r.quemDecide, 'o seu login')
})

test('modo servidor + login de Vendas: estorno bloqueado; cancelar/corrigir só na janela; resto liberado', () => {
  const r = resumirAcesso({ noServidor: true, papelAparelho: 'vendas', acesso: vendas })
  assert.equal(estado(r, 'venda.criar'), 'sim'); assert.equal(estado(r, 'pagamento.estornar'), 'nao')
  assert.equal(estado(r, 'venda.cancelar'), 'janela'); assert.match(r.acoes.find(a => a.tipo === 'venda.corrigir').nota, /15 min/)
})

test('a confusão do Admin: aparelho Admin com login de Vendas → avisa que vale o LOGIN', () => {
  const r = resumirAcesso({ noServidor: true, papelAparelho: 'admin', acesso: vendas })
  assert.equal(estado(r, 'pagamento.estornar'), 'nao')
  assert.ok(r.avisos.some(a => a.nivel === 'alerta' && /vale o LOGIN/.test(a.texto) && /bete@x\.com/.test(a.texto)))
})

test('sem saber o login ou sem perfil: tudo bloqueado, com aviso (falha fechada)', () => {
  const a = resumirAcesso({ noServidor: true, papelAparelho: 'admin', acesso: null })
  assert.ok(a.acoes.every(x => x.estado === 'nao')); assert.equal(a.avisos[0].nivel, 'alerta')
  const b = resumirAcesso({ noServidor: true, papelAparelho: 'admin', acesso: { usuario: 'x@y.com', papel: null, permissoes: [] } })
  assert.ok(b.acoes.every(x => x.estado === 'nao')); assert.match(b.avisos[0].texto, /não tem perfil/)
})

test('modo local: aparelho Admin só consulta; aparelho de Vendas edita (regra antiga)', () => {
  const a = resumirAcesso({ noServidor: false, papelAparelho: 'admin', acesso: admin })
  assert.ok(a.acoes.every(x => x.estado === 'nao')); assert.equal(a.quemDecide, 'este aparelho')
  const v = resumirAcesso({ noServidor: false, papelAparelho: 'vendas', acesso: null })
  assert.ok(v.acoes.every(x => x.estado === 'sim'))
})

test('só alterna o modo quem é aparelho Admin E login de administrador', () => {
  assert.equal(podeAlternarModo({ papelAparelho: 'admin', acesso: admin }).ok, true)
  assert.equal(podeAlternarModo({ papelAparelho: 'vendas', acesso: admin }).ok, false)      // aparelho de Vendas
  assert.equal(podeAlternarModo({ papelAparelho: 'admin', acesso: vendas }).ok, false)      // login de Vendas
  assert.equal(podeAlternarModo({ papelAparelho: 'admin', acesso: null }).ok, false)        // desconhecido
  assert.equal(podeAlternarModo({ papelAparelho: null, acesso: admin }).ok, false)
})

test('desligar: bloqueia com pendência, recusa não vista ou sessão vencida; senão lista as consequências', () => {
  assert.equal(travasDesligar({ pendentes: 2 }).ok, false)
  assert.equal(travasDesligar({ rejeitadas: 1 }).ok, false)
  assert.equal(travasDesligar({ semLogin: true }).ok, false)
  const ok = travasDesligar({ papelAparelho: 'admin' })
  assert.equal(ok.ok, true); assert.match(ok.consequencias[0], /SOMENTE CONSULTA/); assert.ok(ok.consequencias.some(c => /Drive/.test(c)))
  assert.equal(travasDesligar({ papelAparelho: 'vendas' }).consequencias.some(c => /SOMENTE CONSULTA/.test(c)), false)
})

test('comparar com o servidor: iguais, diferentes e violações', () => {
  const conf = { saldo_aberto_centavos: 12345, violacoes: { a: 0, b: 0 } }
  assert.equal(compararComServidor({ saldoAbertoLocalCentavos: 12345 }, conf).iguais, true)
  const d = compararComServidor({ saldoAbertoLocalCentavos: 12000 }, conf)
  assert.equal(d.iguais, false); assert.equal(d.diferencaCentavos, -345); assert.match(d.texto, /diferente/)
  assert.equal(compararComServidor({ saldoAbertoLocalCentavos: 1 }, { violacoes: {} }).comparavel, false)
  assert.equal(compararComServidor({ saldoAbertoLocalCentavos: 12345 }, { ...conf, violacoes: { a: 2 } }).violacoes, 2)
})

test('saldo local em centavos sem erro de ponto flutuante', () => {
  assert.equal(saldoAbertoLocal([{ status: 'aberto', saldo: 0.1 }, { status: 'aberto', saldo: 0.2 }, { status: 'pago', saldo: 0 }]), 30)
})
