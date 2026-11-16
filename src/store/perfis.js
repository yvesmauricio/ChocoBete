// Perfis de acesso: Admin ('ym') e Vendas ('bete') — lógica pura, sem estado.
//
// Os ids 'ym' e 'bete' são fixos de propósito — além de identificar a tela,
// eles também marcam a ORIGEM de registros de produção/financeiro já
// salvos no banco (campo `origem: 'bete'` em vários lugares). Nunca renomear
// ou remover esses dois ids.
//
// Cada aparelho é Admin ou Vendedor (ver store/aparelho.js); aqui ficam só o
// nome, a descrição e as telas de cada um. Perfis adicionais foram removidos:
// dados antigos com `extras`/`inicial` são simplesmente ignorados.
export const PERFIS_PADRAO = {
  ym: {
    nome: 'Admin',
    descricao: 'Acesso a todas as telas do sistema',
    modulos: ['painel', 'cozinha', 'receitas', 'insumos', 'financeiro', 'producao', 'inteligencia', 'etiquetas', 'cardapio', 'ajustes']
  },
  bete: {
    nome: 'Vendas',
    descricao: 'Fiados, clientes e entregas',
    modulos: ['caderneta']
  }
}

// Telas que um perfil pode receber. Valida tanto o que vem salvo quanto o
// que a tela de Ajustes deixa marcar.
export const MODULOS_VALIDOS = [
  'painel', 'cozinha', 'receitas', 'insumos', 'financeiro', 'producao',
  'inteligencia', 'etiquetas', 'cardapio', 'ajustes', 'caderneta'
]

// Só o NOME é personalizável. Descrição e telas são sempre as do padrão:
// o Admin enxerga tudo (a área de Vendas é só consulta nele, para não
// misturar alterações com o banco que vai para o Google Drive).
function normalizarPerfis(valor) {
  const base = JSON.parse(JSON.stringify(PERFIS_PADRAO))
  if (!valor || typeof valor !== 'object') return base

  for (const id of ['ym', 'bete']) {
    const nomeSalvo = typeof valor[id]?.nome === 'string' ? valor[id].nome.trim() : ''
    if (nomeSalvo) base[id].nome = nomeSalvo
  }

  return base
}

export { normalizarPerfis }
