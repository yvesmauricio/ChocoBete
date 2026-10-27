// Resumos e projeções (financeiro por mês, MEI, provisionamento, produção por mês).
import { computed } from 'vue'
import { getMesRef } from '../utils.js'

export function criarAnalytics({ financeiro, producoes, receitas, company }) {
  const resumoFinanceiroPorMes = computed(() => {
    const meses = new Map()

    financeiro.value.forEach(item => {
      const mesRef = item.mes_ref || getMesRef(item.data) // Use getMesRef from utils
      if (!mesRef) return

      if (!meses.has(mesRef)) {
        meses.set(mesRef, {
          mes_ref: mesRef,
          total: 0,
          quantidade: 0,
          entradas: 0,
          receitas_mei: 0,
          renda_pessoal: 0,
          saidas_operacionais: 0,
          saidas_insumos: 0,    // Novo: Rastreador específico de insumos
          saidas_das_mei: 0,    // Novo: Rastreador específico de DAS
          saidas_pessoais: 0,
          rendimento_financeiro: 0
        })
      }

      const atual = meses.get(mesRef)
      const valor = Number(item.valor || 0)

      // Para conciliação, total e quantidade incluem tudo
      atual.total += valor
      atual.quantidade += 1

      if (item.natureza === 'interna') return

      if (item.natureza === 'entrada') {
        atual.entradas += valor
        if (item.categoria === 'Rendimento Financeiro') {
          atual.rendimento_financeiro += valor
        } else {
          atual.receitas_mei += valor
        }
      }
      else if (item.natureza === 'operacional') { // Saídas operacionais
        atual.saidas_operacionais -= valor
        
        // Identifica Insumos e DAS para provisionamento específico
        const cat = item.categoria || ''
        if (cat.includes('Insumos')) {
          atual.saidas_insumos -= valor
        } else if (cat === 'DAS-MEI' || cat === 'Impostos e Contribuições') {
          atual.saidas_das_mei -= valor
        }
      }
      else if (item.natureza === 'pessoal') {
        if (valor > 0) {
          atual.entradas += valor
          atual.renda_pessoal += valor
        } else {
          atual.saidas_pessoais += Math.abs(valor)
        }
      }
    })

    return [...meses.values()].sort((a, b) => {
      const [mesA, anoA] = a.mes_ref.split('/')
      const [mesB, anoB] = b.mes_ref.split('/')
      return `${anoB}${mesB}`.localeCompare(`${anoA}${mesA}`)
    })
  })

  const totalRecebidoAnoAtual = computed(() => {
    const anoAtual = String(new Date().getFullYear())
    return resumoFinanceiroPorMes.value
      .filter(item => item.mes_ref.endsWith(`/${anoAtual}`))
      .reduce((acc, item) => acc + Number(item.receitas_mei || 0), 0)
  })

  const relatorioMensalMei = computed(() => {
    return resumoFinanceiroPorMes.value.map(item => ({
      ...item,
      // Tudo que entrou mas NÃO é receita MEI nem rendimento financeiro (ex: Renda Pessoal, pensão, etc.)
      outras_entradas_nao_mei: Math.max(0,
        Number(item.entradas || 0) - Number(item.receitas_mei || 0) - Number(item.rendimento_financeiro || 0)
      ),
      saldo_operacional: Number(item.receitas_mei || 0) - Number(item.saidas_operacionais || 0),
      saldo_mes: Number(item.entradas || 0) - Number(item.saidas_operacionais || 0) - Number(item.saidas_pessoais || 0)
    }))
  })

  /** Média específica apenas de Insumos (últimos 3 meses) */
  const mediaInsumos3Meses = computed(() => {
    const meses = relatorioMensalMei.value.slice(0, 3)
    if (!meses.length) return 0
    return meses.reduce((acc, m) => acc + (m.saidas_insumos || 0), 0) / meses.length
  })

  /** Média específica do DAS-MEI (últimos 3 meses) */
  const mediaDasMei3Meses = computed(() => {
    const meses = relatorioMensalMei.value.slice(0, 3)
    if (!meses.length) return 0
    return meses.reduce((acc, m) => acc + (m.saidas_das_mei || 0), 0) / meses.length
  })

  /**
   * Sugestão de provisionamento focada apenas no operacional crítico:
   * Média de Insumos + Média de DAS-MEI (arredondado para cima)
   */
  const sugestaoProvisionamentoMensal = computed(() => {
    const totalCritico = mediaInsumos3Meses.value + mediaDasMei3Meses.value
    if (totalCritico <= 0) return 0
    // Arredonda para a próxima dezena (ex: 452 -> 460) para dar uma margem de segurança
    return Math.ceil(totalCritico / 10) * 10
  })

  /** 
   * Sugestão de capital de giro (Giro de Segurança):
   * Se houver valor manual definido em Ajustes, usa ele. Senão calcula a média semanal.
   */
  const sugestaoProvisionamentoSemanal = computed(() => {
    if (company.value.reserva_operacional_fixa > 0) return company.value.reserva_operacional_fixa
    return Math.ceil((sugestaoProvisionamentoMensal.value / 4.5) / 5) * 5
  })

  /** 
   * Devolve o valor de um campo "versionado" (meta de retirada, giro de
   * segurança) que valia em um mês específico — não o valor atual.
   * Procura, no histórico, a mudança mais recente que já tinha acontecido
   * até aquele mês; se não achar nenhuma (mês anterior a todo o histórico
   * registrado), usa o valor mais antigo conhecido como melhor estimativa.
   * `historico` é uma lista [{ mes: 'MM/YYYY', valor }]; `mesRef` também
   * é 'MM/YYYY' (mesmo formato de getMesRef/mes_ref usado no relatório).
   */
  function valorVigenteEm(historico, valorAtual, mesRef) {
    const chave = (mr) => {
      const [m, a] = String(mr || '').split('/').map(Number)
      return (a || 0) * 100 + (m || 0)
    }
    if (!Array.isArray(historico) || !historico.length) return valorAtual
    const alvo = chave(mesRef)
    const passados = historico.filter(h => chave(h.mes) <= alvo)
    if (!passados.length) {
      // Mês pedido é anterior a qualquer registro do histórico: usa o mais antigo
      return historico.reduce((a, b) => chave(a.mes) < chave(b.mes) ? a : b).valor
    }
    return passados.reduce((a, b) => chave(a.mes) > chave(b.mes) ? a : b).valor
  }

  /** Meta de retirada que valia em um mês específico (ex: '08/2026'). */
  function metaSalarioEm(mesRef) {
    return valorVigenteEm(company.value.meta_salario_historico, company.value.meta_salario_mensal, mesRef)
  }

  /** Giro de Segurança que valia em um mês específico. Sem valor manual
   *  registrado pra época, cai no cálculo automático atual (mesmo
   *  comportamento de sempre quando não há valor fixo definido). */
  function reservaGiroEm(mesRef) {
    const manual = valorVigenteEm(company.value.reserva_operacional_historico, company.value.reserva_operacional_fixa, mesRef)
    if (manual > 0) return manual
    return sugestaoProvisionamentoSemanal.value
  }

  /**
   * Resumo do tempo de produção e custo de mão de obra por mês.
   * Calcula o total de minutos trabalhados e o custo associado para cada mês
   * com base nas produções registradas e no custo da hora de trabalho configurado.
   */
  const resumoProducaoPorMes = computed(() => {
    const meses = new Map()
    const custoHora = company.value.custo_hora_trabalho || 0

    // 1. Inicializa com todos os meses que têm movimentação financeira (A Verdade do Banco)
    relatorioMensalMei.value.forEach(m => {
      meses.set(m.mes_ref, {
        mes_ref: m.mes_ref,
        total_tempo_min: 0,
        total_tempo_horas: 0,
        custo_mao_de_obra_total: 0,
        unidades_produzidas: 0,
        lucro_logado_producao: 0,
        // O "Real" gerado para o seu bolso é o Saldo Operacional (Receitas MEI - Despesas Empresa)
        total_gerado_retirada: m.saldo_operacional || 0,
        receitas_reais_banco: m.receitas_mei || 0,
        despesas_reais_banco: m.saidas_operacionais || 0
      })
    })

    // 2. Mescla os dados de produção registrados (O seu esforço cronometrado)
    producoes.value.forEach(prod => {
      const mesRef = getMesRef(prod.data_producao)
      if (!mesRef) return

      if (!meses.has(mesRef)) {
        meses.set(mesRef, {
          mes_ref: mesRef, total_tempo_min: 0, total_tempo_horas: 0,
          custo_mao_de_obra_total: 0, unidades_produzidas: 0,
          total_gerado_retirada: 0, receitas_reais_banco: 0, despesas_reais_banco: 0,
          lucro_logado_producao: 0
        })
      }

      const m = meses.get(mesRef);
      const qtdRaw = prod.quantidade_produzida || prod.quantidade || 0;
      const validQtd = isNaN(Number(qtdRaw)) ? 0 : Number(qtdRaw);
      
      m.total_tempo_min += Number(prod.tempo_real_min || 0);
      m.unidades_produzidas += validQtd;

      // Lucro estimado da produção (Preço Snapshot - Custo Snapshot)
      const pVenda = Number(prod.preco_unitario_snapshot || 0);
      const cTotal = Number(prod.custo_unitario_snapshot || 0);
      m.lucro_logado_producao += (pVenda - cTotal) * validQtd;
    })

    // 3. Finaliza cálculos de custo de mão de obra
    meses.forEach(mes => {
      mes.total_tempo_horas = mes.total_tempo_min / 60
      mes.custo_mao_de_obra_total = mes.total_tempo_horas * custoHora
      
      // Indicador de Saúde: Quanto o negócio pagou por hora trabalhada de fato
      // Se sobrou 1000 reais e trabalhei 10 horas, minha hora real foi R$ 100.
      mes.valor_hora_real = mes.total_tempo_horas > 0 
        ? mes.total_gerado_retirada / mes.total_tempo_horas 
        : 0

      // Identifica se houve lucro no banco além do que foi registrado na produção
      // Útil para o cenário onde a esposa produz e não registra no cronômetro
      const lucroBanco = mes.total_gerado_retirada;
      mes.tem_ganhos_nao_registrados = lucroBanco > (mes.lucro_logado_producao * 1.15); // Mais de 15% de diferença
    })

    return [...meses.values()].sort((a, b) => {
      const [mesA, anoA] = a.mes_ref.split('/')
      const [mesB, anoB] = b.mes_ref.split('/')
      return `${anoB}${mesB}`.localeCompare(`${anoA}${mesA}`)
    })
  })

  return {
    resumoFinanceiroPorMes,
    totalRecebidoAnoAtual,
    relatorioMensalMei,
    mediaInsumos3Meses,
    mediaDasMei3Meses,
    sugestaoProvisionamentoMensal,
    sugestaoProvisionamentoSemanal,
    valorVigenteEm,
    metaSalarioEm,
    reservaGiroEm,
    resumoProducaoPorMes
  }
}
