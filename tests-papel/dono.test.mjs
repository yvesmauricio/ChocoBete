import test from 'node:test'
import assert from 'node:assert/strict'
import { donoDaTabela, donoDaConfig, podeEscreverTabela, podeEscreverConfig, mensagemSomenteConsulta } from '../src/services/papelAparelho.js'

test('dono das tabelas', () => {
  for (const t of ['cad_lojas', 'cad_clientes', 'cad_fiados', 'cardapio_pedidos']) assert.equal(donoDaTabela(t), 'vendas', t)
  for (const t of ['receitas', 'produtos', 'producoes', 'financeiro', 'historico_precos', 'historico_precos_venda']) assert.equal(donoDaTabela(t), 'admin', t)
})
test('dono das chaves de config usadas pela caderneta e cardápio', () => {
  for (const c of ['cad_taxas', 'cad_precos_categorias', 'cad_log_renomeacao_loja', 'cardapio_config', 'cardapio_config_diaadia']) assert.equal(donoDaConfig(c), 'vendas', c)
  for (const c of ['company', 'perfis_app', 'contas_financeiras', 'cozinha_lote', 'lista_compras_salva', 'categorias_financeiro']) assert.equal(donoDaConfig(c), 'admin', c)
})
test('sem papel nada grava', () => {
  assert.equal(podeEscreverTabela(null, 'receitas'), false)
  assert.equal(podeEscreverConfig(undefined, 'company'), false)
})
test('mensagens em português claro', () => {
  assert.match(mensagemSomenteConsulta('cad_fiados', 'admin'), /as cobranças só são editadas no aparelho Vendas/)
  assert.match(mensagemSomenteConsulta('cardapio_pedidos', 'admin'), /cardápio/)
  assert.match(mensagemSomenteConsulta('receitas', 'vendas'), /Admin/)
})
