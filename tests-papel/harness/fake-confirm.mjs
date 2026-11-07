export function useConfirm() { return { ask: async (msg) => { globalThis.__perguntas.push(msg); return globalThis.__resposta } } }
