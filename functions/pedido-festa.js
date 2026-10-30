import { servirCardapio } from './_lib/servir.js'
export const onRequestGet = (ctx) => servirCardapio('festa', ctx)
