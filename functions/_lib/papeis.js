// Perfis da Caderneta no SERVIDOR. O perfil é da PESSOA (e-mail do login do Cloudflare Access), não do aparelho.
//
//   admin   pode tudo.
//   vendas  lança fiado, recebe, cadastra loja/cliente, muda vencimento, arquiva.
//           NÃO estorna pagamento, NÃO cancela e NÃO corrige venda… exceto a PRÓPRIA venda, sem pagamento,
//           nos primeiros minutos depois de lançar (o "Desfazer" / corrigir digitação continua funcionando).
//
// Quem é quem fica em variáveis do servidor (não são segredos, mas também não vão para o banco nem para o app):
//   PAPEL_ADMIN_EMAILS    e-mails separados por vírgula, espaço ou ponto e vírgula
//   PAPEL_VENDAS_EMAILS
//   CADERNETA_VENDAS_TAMBEM_PODE    (opcional) tipos extras liberados para Vendas, ex.: "pagamento.estornar"
//   CADERNETA_JANELA_DESFAZER_MIN   (opcional) minutos da exceção acima (padrão 15; 0 desliga)
// Chave de administrador (ADMIN_TOKEN) = admin. E-mail que não consta em nenhuma lista = sem acesso (falha fechada).

export const PAPEL_ADMIN = 'admin'
export const PAPEL_VENDAS = 'vendas'

export const PERMISSOES_VENDAS = [
  'loja.salvar', 'loja.arquivar', 'cliente.salvar', 'cliente.arquivar',
  'venda.criar', 'venda.vencimento', 'pagamento.registrar', 'recebimento.parcial',
]
/** Só Admin (Vendas só na janela de desfazer, na própria venda). */
export const SO_ADMIN = ['pagamento.estornar', 'venda.cancelar', 'venda.corrigir']
const COM_JANELA = ['venda.cancelar', 'venda.corrigir']

const lista = (v) => String(v || '').toLowerCase().split(/[\s,;]+/).filter(Boolean)

export function papelDoUsuario(quem, env = {}) {
  if (!quem?.ok) return null
  if (quem.modo === 'token') return PAPEL_ADMIN
  const email = String(quem.usuario || '').trim().toLowerCase()
  if (!email) return null
  if (lista(env.PAPEL_ADMIN_EMAILS).includes(email)) return PAPEL_ADMIN
  if (lista(env.PAPEL_VENDAS_EMAILS).includes(email)) return PAPEL_VENDAS
  return null
}

export const janelaDesfazerMs = (env = {}) => {
  const n = env.CADERNETA_JANELA_DESFAZER_MIN
  const min = n === undefined || n === '' ? 15 : Number(n)
  return Number.isFinite(min) && min > 0 ? min * 60_000 : 0
}

const tiposExtras = (env) => lista(env.CADERNETA_VENDAS_TAMBEM_PODE)

/** Tipos que o perfil pode executar sem condição. */
export function permissoesDoPapel(papel, env = {}) {
  if (papel === PAPEL_ADMIN) return [...PERMISSOES_VENDAS, ...SO_ADMIN]
  if (papel === PAPEL_VENDAS) return [...PERMISSOES_VENDAS, ...tiposExtras(env).filter(t => SO_ADMIN.includes(t))]
  return []
}

const MSG = {
  semPerfil: 'Seu login não tem perfil para usar a Caderneta. Peça ao administrador para liberar.',
  soAdmin: (tipo) => ({
    'pagamento.estornar': 'Só o administrador pode estornar pagamento.',
    'venda.cancelar': 'Só o administrador pode cancelar uma compra (a Vendas só desfaz a própria compra nos primeiros minutos, antes de qualquer pagamento).',
    'venda.corrigir': 'Só o administrador pode corrigir uma compra (a Vendas só corrige a própria compra nos primeiros minutos, antes de qualquer pagamento).',
  }[tipo] || 'Seu perfil não pode fazer isso.'),
}

/**
 * Esta operação pode ser feita por este usuário? Retorna { ok:true } ou { ok:false, motivo }.
 * `DB` é lido só para a exceção de desfazer (procura a venda e quem a lançou).
 */
export async function autorizarOperacao({ papel, usuario, op, DB, agora = Date.now(), env = {} }) {
  if (papel !== PAPEL_ADMIN && papel !== PAPEL_VENDAS) return { ok: false, motivo: MSG.semPerfil }
  const tipo = op?.tipo
  if (papel === PAPEL_ADMIN || permissoesDoPapel(papel, env).includes(tipo)) return { ok: true }
  if (!COM_JANELA.includes(tipo)) return { ok: false, motivo: MSG.soAdmin(tipo) }

  // Exceção: a PRÓPRIA venda, ainda sem pagamento, dentro da janela.
  const janela = janelaDesfazerMs(env)
  const uid = op?.dados?.venda_uid
  const v = janela && uid ? await DB.prepare('SELECT usuario, criado_em, saldo_centavos, total_centavos, cancelada_em FROM cad_vendas WHERE uid = ?').bind(String(uid)).first() : null
  const propria = v && usuario && v.usuario === usuario
  const recente = v && agora - v.criado_em <= janela
  if (propria && recente && v.saldo_centavos === v.total_centavos && !v.cancelada_em) return { ok: true }
  return { ok: false, motivo: MSG.soAdmin(tipo) }
}

/** O que o aparelho precisa saber para esconder botões (o servidor continua sendo quem decide). */
export function descreverAcesso(quem, env = {}) {
  const papel = papelDoUsuario(quem, env)
  return {
    usuario: quem?.usuario || null,
    papel,
    permissoes: permissoesDoPapel(papel, env),
    so_admin: SO_ADMIN,
    janela_desfazer_min: janelaDesfazerMs(env) / 60_000,
  }
}
