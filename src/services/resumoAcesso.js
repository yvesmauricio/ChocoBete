// Explica, em português simples, QUEM decide o que você pode fazer na Caderneta e se é seguro ligar/desligar o modo servidor.
//
// Por que existe: há duas regras diferentes, e o Admin sentia isso como "às vezes posso, às vezes não":
//   MODO LOCAL     decide o APARELHO (Admin ou Vendas, escolhido uma vez). Cobranças são de UM aparelho só (o de Vendas);
//                  o aparelho Admin só consulta (travaPorPapel.js).
//   MODO SERVIDOR  decide o LOGIN (o e-mail do Cloudflare Access → perfil Admin ou Vendas no servidor; papeis.js).
//                  O papel do aparelho deixa de decidir a Caderneta.
// Módulo puro (sem Vue, banco ou rede): é o que os testes cobrem; a tela só mostra o resultado.

/** Ações da Caderneta, na ordem em que aparecem. `soAdmin` espelha SO_ADMIN de functions/_lib/papeis.js. */
export const ACOES = [
  { tipo: 'venda.criar', rotulo: 'Lançar venda (fiado)' },
  { tipo: 'pagamento.registrar', rotulo: 'Receber pagamento' },
  { tipo: 'recebimento.parcial', rotulo: 'Receber parte do valor' },
  { tipo: 'venda.vencimento', rotulo: 'Mudar vencimento' },
  { tipo: 'cliente.salvar', rotulo: 'Cadastrar e editar cliente' },
  { tipo: 'cliente.arquivar', rotulo: 'Arquivar cliente' },
  { tipo: 'loja.salvar', rotulo: 'Cadastrar e renomear loja' },
  { tipo: 'loja.arquivar', rotulo: 'Arquivar loja' },
  { tipo: 'pagamento.estornar', rotulo: 'Estornar pagamento', soAdmin: true },
  { tipo: 'venda.cancelar', rotulo: 'Cancelar compra', soAdmin: true, janela: true },
  { tipo: 'venda.corrigir', rotulo: 'Corrigir (editar) compra', soAdmin: true, janela: true },
]

export const NOME_PERFIL = { admin: 'Administrador', vendas: 'Vendas' }

/** Texto fixo das duas formas de trabalhar (mostrado no painel). */
export const DIFERENCAS_POR_MODO = {
  local: [
    'Quem decide é este aparelho: o aparelho Admin só consulta as cobranças; quem lança e recebe é o aparelho de Vendas.',
    'Os dados ficam no aparelho e vão e voltam pelo Google Drive. Um arquivo antigo do Drive pode desfazer uma alteração.',
    'Não há perfil por pessoa: qualquer um no aparelho de Vendas pode estornar, cancelar e corrigir.',
  ],
  servidor: [
    'Quem decide é o seu login (e-mail): o aparelho Admin também lança, recebe, estorna, cancela e corrige, desde que você entre com o e-mail de administrador.',
    'O servidor é a verdade. Este aparelho guarda uma cópia, e o que você faz vai numa fila (mesmo sem sinal) e é conferido pelo servidor.',
    'Perfil por pessoa: Vendas não estorna nem cancela (só desfaz a própria compra nos primeiros minutos).',
  ],
}

const aviso = (nivel, texto) => ({ nivel, texto })
const quem = (a) => (a?.usuario ? ` ${a.usuario}` : '')

/**
 * @param noServidor    o modo servidor está ligado neste aparelho?
 * @param papelAparelho 'admin' | 'vendas' | null  (função escolhida para este aparelho)
 * @param acesso        resposta de /api/caderneta/eu: { usuario, papel, permissoes, janela_desfazer_min } ou null (ainda não sabemos)
 */
export function resumirAcesso({ noServidor, papelAparelho, acesso }) {
  const perfil = acesso?.papel === 'admin' || acesso?.papel === 'vendas' ? acesso.papel : null
  const avisos = []
  let acoes

  if (!noServidor) {
    const edita = papelAparelho === 'vendas'
    acoes = ACOES.map(a => ({ tipo: a.tipo, rotulo: a.rotulo, estado: edita ? 'sim' : 'nao',
      nota: edita ? '' : (papelAparelho === 'admin' ? 'Somente consulta neste aparelho (modo local).' : 'Defina a função deste aparelho.') }))
    if (papelAparelho === 'admin') avisos.push(aviso('info', 'Modo local: este aparelho é Admin e só consulta a Caderneta. No modo servidor você poderia lançar e receber aqui com o seu login de administrador.'))
    if (!papelAparelho) avisos.push(aviso('alerta', 'Este aparelho ainda não tem função (Admin ou Vendas).'))
  } else {
    const janela = Number(acesso?.janela_desfazer_min) || 0
    acoes = ACOES.map(a => {
      if (perfil === 'admin') return { tipo: a.tipo, rotulo: a.rotulo, estado: 'sim', nota: '' }
      if (perfil === 'vendas') {
        if (acesso.permissoes?.includes(a.tipo)) return { tipo: a.tipo, rotulo: a.rotulo, estado: 'sim', nota: '' }
        if (a.janela && janela > 0) return { tipo: a.tipo, rotulo: a.rotulo, estado: 'janela', nota: `Só a própria compra, sem pagamento, até ${janela} min depois de lançar.` }
        return { tipo: a.tipo, rotulo: a.rotulo, estado: 'nao', nota: 'Só o administrador.' }
      }
      return { tipo: a.tipo, rotulo: a.rotulo, estado: 'nao', nota: 'Aguardando o login.' }
    })
    if (!acesso) avisos.push(aviso('alerta', 'Ainda não sei quem você é no servidor. Conecte-se à internet; até lá o app esconde as ações restritas.'))
    else if (!perfil) avisos.push(aviso('alerta', `O login${quem(acesso)} não tem perfil no servidor: nada da Caderneta funciona. O administrador precisa liberar este e-mail.`))
    if (papelAparelho === 'admin' && perfil === 'vendas') avisos.push(aviso('alerta',
      `Este aparelho é Admin, mas o login${quem(acesso)} é de Vendas. No modo servidor vale o LOGIN: estornar, cancelar e corrigir ficam bloqueados. Entre com o e-mail de administrador.`))
    if (papelAparelho === 'vendas' && perfil === 'admin') avisos.push(aviso('info', 'Este aparelho é de Vendas, mas o login é de administrador: no servidor você pode tudo na Caderneta.'))
    if (!papelAparelho) avisos.push(aviso('alerta', 'Este aparelho ainda não tem função (Admin ou Vendas).'))
  }

  return {
    modo: noServidor ? 'servidor' : 'local',
    quemDecide: noServidor ? 'o seu login' : 'este aparelho',
    aparelhoTexto: papelAparelho === 'admin' ? 'Admin' : papelAparelho === 'vendas' ? 'Vendas' : 'sem função',
    perfilTexto: perfil ? NOME_PERFIL[perfil] : (acesso ? 'sem perfil' : 'desconhecido'),
    usuario: acesso?.usuario || null,
    perfil, acoes, avisos,
  }
}

/** Só o ADMINISTRADOR liga/desliga: aparelho Admin E login de administrador (nem um nem outro sozinho basta). */
export function podeAlternarModo({ papelAparelho, acesso }) {
  if (papelAparelho !== 'admin') return { ok: false, motivo: 'Só o aparelho Admin pode ligar ou desligar o modo servidor.' }
  if (!acesso) return { ok: false, motivo: 'Conecte-se à internet para o app confirmar que o seu login é de administrador.' }
  if (acesso.papel !== 'admin') return { ok: false, motivo: acesso.papel === 'vendas'
    ? `O login${quem(acesso)} é de Vendas. Entre com o e-mail de administrador para alterar isto.`
    : 'Este login não tem perfil de administrador no servidor.' }
  return { ok: true, motivo: null }
}

/** Travas para DESLIGAR: nada pendente nem recusado sem ser visto; e o que o administrador precisa saber antes de confirmar. */
export function travasDesligar({ pendentes = 0, rejeitadas = 0, semLogin = false, papelAparelho = null }) {
  if (pendentes > 0) return { ok: false, motivo: `Há ${pendentes} alteração(ões) ainda não enviadas ao servidor. Conecte-se e espere o envio terminar; se desligar agora, elas nunca chegam.`, consequencias: [] }
  if (rejeitadas > 0) return { ok: false, motivo: `O servidor recusou ${rejeitadas} alteração(ões) e você ainda não viu. Abra o indicador no topo da Caderneta (toque em "alterações recusadas"), leia o motivo e toque em "Entendi".`, consequencias: [] }
  if (semLogin) return { ok: false, motivo: 'A sessão venceu: não dá para ter certeza de que tudo chegou ao servidor. Entre de novo e tente.', consequencias: [] }
  const c = [
    'O Google Drive só tem uma cópia ANTIGA da Caderneta: vendas e pagamentos feitos desde que o servidor virou verdade não estão nela.',
    'Os outros aparelhos continuam no servidor. O que for lançado aqui depois não chega a eles.',
  ]
  if (papelAparelho === 'admin') c.unshift('Este aparelho é Admin: no modo local ele volta a ser SOMENTE CONSULTA da Caderneta.')
  return { ok: true, motivo: null, consequencias: c }
}

const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Compara o saldo em aberto deste aparelho com o do servidor (resposta de /api/caderneta/conferencia). */
export function compararComServidor({ saldoAbertoLocalCentavos }, conferencia) {
  const srv = Number(conferencia?.saldo_aberto_centavos)
  if (!Number.isFinite(srv) || !Number.isFinite(saldoAbertoLocalCentavos)) return { comparavel: false, iguais: false, texto: 'Não deu para comparar.' }
  const dif = saldoAbertoLocalCentavos - srv
  const violacoes = Object.values(conferencia?.violacoes || {}).reduce((s, n) => s + Number(n || 0), 0)
  return {
    comparavel: true, iguais: dif === 0, diferencaCentavos: dif, violacoes,
    texto: dif === 0
      ? `Saldo em aberto igual nos dois lados (${reais(srv)}).`
      : `Saldo em aberto diferente: este aparelho ${reais(saldoAbertoLocalCentavos)}, servidor ${reais(srv)} (diferença ${reais(Math.abs(dif))}).`,
  }
}

/** Saldo em aberto das vendas deste aparelho, em centavos (venda cancelada não existe na cópia local). */
export const saldoAbertoLocal = (fiados = []) =>
  fiados.filter(f => f?.status === 'aberto').reduce((s, f) => s + Math.round((Number(f.saldo) || 0) * 100), 0)
