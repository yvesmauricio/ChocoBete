import { ref } from 'vue'
import { useStore } from '../store.js'
import { maskMoney, parseMoney } from '../utils.js'

export function montarItemLista(prod, qtdSug = null, origem = 'manual', mediaMensal = 0, store = null) {
  const unidadeBase = prod?.unidade_base || 'un'
  const fatorConv = Number(prod?.fator_conversao || 0)
  const custoPorEmbalagem = Number(prod?.custo_por_unidade || 0)
  const unidCompra = prod?.unidade_compra || prod?.unidade_base || unidadeBase
  const qtd = qtdSug == null ? (fatorConv || 1) : Number(qtdSug || 0)

  const nomeEmbMap = {
    kg: ['pacote', 'pacotes'], g: ['pacote', 'pacotes'],
    L: ['frasco', 'frascos'], l: ['frasco', 'frascos'], ml: ['frasco', 'frascos'],
    cx: ['caixa', 'caixas'], pct: ['pacote', 'pacotes'],
    dz: ['duzia', 'duzias'], un: ['unidade', 'unidades'],
  }
  const [nomeEmbDefault, nomeEmbPluralDefault] = nomeEmbMap[unidCompra] || ['unid.', 'unid.']
  const precoUnitario = store?.getPrecoUnitarioInsumo ? store.getPrecoUnitarioInsumo(prod) : 0

  let embalagens = 0
  let nomeEmb = nomeEmbDefault
  let nomeEmbPlural = nomeEmbPluralDefault
  let custo = 0

  if (unidadeBase === 'un') {
    embalagens = Math.ceil(qtd) || 1
    nomeEmb = 'unidade'
    nomeEmbPlural = 'unidades'
    if (fatorConv > 1) {
      embalagens = Math.ceil(qtd / fatorConv) || 1
      nomeEmb = nomeEmbDefault
      nomeEmbPlural = nomeEmbPluralDefault
    }
    custo = custoPorEmbalagem > 0 ? embalagens * custoPorEmbalagem : precoUnitario * qtd
  } else if (fatorConv > 0) {
    embalagens = Math.ceil(qtd / fatorConv) || 1
    custo = custoPorEmbalagem > 0 ? embalagens * custoPorEmbalagem : precoUnitario * qtd
  } else {
    embalagens = 1
    custo = precoUnitario * qtd
  }

  return {
    id: prod.uuid,
    nome: prod.nome,
    unidade: unidadeBase,
    mediaMensal,
    qtdSugerida: qtd,
    custoEstimado: custo,
    embalagens,
    embalagensFinal: embalagens || 1,
    nomeEmb,
    nomeEmbPlural,
    fatorConv,
    custoPorEmbalagem,
    checked: false,
    origem
  }
}

export function useModalCompra(options = {}) {
  const s = useStore()
  const modalPreco = ref(null)
  const modoPreco = ref('embalagem')
  const precoEmbInput = ref('')
  const precoEmbCalculado = ref(0)
  const fracValor = ref('')
  const fracQtd = ref('')
  const fracResultado = ref(0)
  const qtdEntradaInput = ref('')

  function abrirModalPreco(itemOuProduto) {
    const item = itemOuProduto?.uuid
      ? montarItemLista(itemOuProduto, itemOuProduto.fator_conversao || 1, 'manual', 0, s)
      : itemOuProduto

    modalPreco.value = item
    modoPreco.value = item.fatorConv > 1 ? 'embalagem' : 'fracionado'
    precoEmbInput.value = item.custoPorEmbalagem > 0 ? maskMoney(item.custoPorEmbalagem) : ''
    precoEmbCalculado.value = item.custoPorEmbalagem > 0 && item.fatorConv > 0 ? item.custoPorEmbalagem / item.fatorConv : 0
    fracValor.value = ''
    fracQtd.value = ''
    fracResultado.value = 0
    qtdEntradaInput.value = item.embalagensFinal > 0 ? String(item.embalagensFinal) : '1'
  }

  function fecharModalPreco() {
    modalPreco.value = null
  }

  function onPrecoEmbInput(e) {
    const raw = e.target.value.replace(/\D/g, '')
    const num = parseInt(raw || '0') / 100
    precoEmbInput.value = num > 0 ? maskMoney(num) : ''
    const fator = modalPreco.value?.fatorConv || 1
    precoEmbCalculado.value = num > 0 && fator > 0 ? num / fator : 0
  }

  function onFracValorInput(e) {
    const raw = e.target.value.replace(/\D/g, '')
    const num = parseInt(raw || '0') / 100
    fracValor.value = num > 0 ? maskMoney(num) : ''
    calcFracionado()
  }

  function bloquearLetras(e) {
    const permitidas = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter']
    if (permitidas.includes(e.key)) return
    if (!/^\d$/.test(e.key)) e.preventDefault()
  }

  function calcFracionado() {
    const valor = parseMoney(fracValor.value)
    const qtd = parseFloat(String(fracQtd.value).replace(',', '.'))
    fracResultado.value = (valor > 0 && qtd > 0) ? valor / qtd : 0
  }

  async function confirmarCompra(item, custoPorEmbalagem) {
    const prod = s.produtos.find(p => p.uuid === item.id)
    if (!prod) {
      s.notify('Produto nao encontrado', 'error')
      return false
    }

    const qtdEmb = parseFloat(qtdEntradaInput.value) || 1
    const fator = Number(prod.fator_conversao) > 0 ? Number(prod.fator_conversao) : 1
    const novoEstoque = (Number(prod.estoque_atual) || 0) + (qtdEmb * fator)

    try {
      await s.salvarProduto({
        ...prod,
        fator_conversao: fator,
        custo_por_unidade: custoPorEmbalagem,
        estoque_atual: novoEstoque
      })
      options.onCompraConfirmada?.({ item, produto: prod, qtdEmb, fator, novoEstoque, custoPorEmbalagem })
      return true
    } catch (e) {
      s.notify(e?.message || 'Erro ao salvar produto', 'error')
      return false
    }
  }

  async function confirmarPrecoEmb() {
    const val = parseMoney(precoEmbInput.value)
    if (isNaN(val) || val <= 0 || !modalPreco.value) return
    if (await confirmarCompra(modalPreco.value, val)) fecharModalPreco()
  }

  async function confirmarPrecoFrac() {
    const item = modalPreco.value
    const prod = s.produtos.find(p => p.uuid === item?.id)
    if (!prod || fracResultado.value <= 0) return
    const novoCustoPorEmb = fracResultado.value * (prod.fator_conversao || 1)
    if (await confirmarCompra(item, novoCustoPorEmb)) fecharModalPreco()
  }

  return {
    modalPreco,
    modoPreco,
    precoEmbInput,
    precoEmbCalculado,
    fracValor,
    fracQtd,
    fracResultado,
    qtdEntradaInput,
    abrirModalPreco,
    fecharModalPreco,
    onPrecoEmbInput,
    onFracValorInput,
    bloquearLetras,
    calcFracionado,
    confirmarPrecoEmb,
    confirmarPrecoFrac,
  }
}
