import { supabase } from '../lib/supabase.js'

const WRITE_FUNCTIONS = new Set(['atualizar_estoque', 'cadastrar_produto', 'atualizar_produto'])
const allowedItemFields = new Set(['fantasy_name', 'technical_name', 'description', 'category'])

function cleanTerm(value) {
  return String(value ?? '').trim().replace(/[,%()]/g, ' ')
}

function assertPositive(value, label = 'quantidade') {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} deve ser maior que zero.`)
  return parsed
}

async function findItems(term) {
  const query = cleanTerm(term)
  if (!query) throw new Error('Informe um produto para pesquisar.')
  const pattern = `%${query}%`
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .or(`fantasy_name.ilike.${pattern},technical_name.ilike.${pattern},internal_code.ilike.${pattern}`)
    .limit(20)
  if (error) throw error
  return data ?? []
}

async function requireOneItem(term) {
  const items = await findItems(term)
  if (!items.length) return { error: 'ITEM_NAO_ENCONTRADO', message: `Nenhum item encontrado para "${term}".` }
  if (items.length > 1) return { error: 'BUSCA_AMBIGUA', message: 'Mais de um item foi encontrado.', opcoes: items.map(({ id, internal_code, fantasy_name, technical_name }) => ({ id, internal_code, fantasy_name, technical_name })) }
  return { item: items[0] }
}

async function stockForItems(items) {
  if (!items.length) return []
  const ids = items.map((item) => item.id)
  const { data: movements, error } = await supabase.from('inventory_movements').select('item_id, quantity_delta').in('item_id', ids)
  if (error) throw error
  const balances = (movements ?? []).reduce((acc, row) => {
    acc[row.item_id] = (acc[row.item_id] ?? 0) + Number(row.quantity_delta)
    return acc
  }, {})
  return items.map((item) => ({ ...item, saldo_atual: balances[item.id] ?? 0 }))
}

export async function consultarEstoque({ produto }) {
  const items = await findItems(produto)
  if (!items.length) return { encontrado: false, mensagem: `Nenhum item encontrado para "${produto}".` }
  return { encontrado: true, quantidade_resultados: items.length, itens: await stockForItems(items) }
}

export async function consultarProduto({ produto }) {
  const items = await findItems(produto)
  if (!items.length) return { encontrado: false, mensagem: `Nenhum produto encontrado para "${produto}".` }
  const ids = items.map((item) => item.id)
  const { data: finished, error } = await supabase.from('finished_products').select('*').in('item_id', ids)
  if (error) throw error
  const byId = Object.fromEntries((finished ?? []).map((row) => [row.item_id, row]))
  return { encontrado: true, quantidade_resultados: items.length, produtos: items.map((item) => ({ ...item, produto_acabado: byId[item.id] ?? null })) }
}

export async function consultarProcesso({ termo }) {
  const query = cleanTerm(termo)
  const { data, error } = await supabase.from('semi_finished_items').select('*').ilike('process_name', `%${query}%`).limit(20)
  if (error) throw error
  return { encontrado: Boolean(data?.length), quantidade_resultados: data?.length ?? 0, processos: data ?? [] }
}

export async function atualizarEstoque({ produto, operacao, quantidade }, userId) {
  if (!['adicionar', 'remover'].includes(operacao)) throw new Error('Operação inválida.')
  const match = await requireOneItem(produto)
  if (!match.item) return match
  const amount = assertPositive(quantidade)
  const delta = operacao === 'adicionar' ? amount : -amount
  const { data, error } = await supabase.from('inventory_movements').insert({
    item_id: match.item.id,
    movement_type: operacao === 'adicionar' ? 'entrada_ajuste' : 'saida_ajuste',
    quantity_delta: delta,
    created_by: userId,
    notes: 'Ajuste pelo Gerente Virtual'
  }).select().single()
  if (error) throw error
  const [withBalance] = await stockForItems([match.item])
  return { sucesso: true, movimento: data, produto: match.item.fantasy_name, novo_saldo: withBalance.saldo_atual }
}

export async function cadastrarProduto({ nome, descricao, preco, categoria, estoque_inicial }, userId) {
  const price = Number(preco)
  if (!nome?.trim() || !descricao?.trim() || !categoria?.trim()) throw new Error('Nome, descrição e categoria são obrigatórios.')
  if (!Number.isFinite(price) || price < 0) throw new Error('Preço inválido.')
  const initial = Number(estoque_inicial)
  if (!Number.isFinite(initial) || initial < 0) throw new Error('Estoque inicial inválido.')

  const { data: item, error: itemError } = await supabase.from('inventory_items').insert({
    fantasy_name: nome.trim(), technical_name: nome.trim(), description: descricao.trim(), category: categoria.trim(), item_type: 'finished_product'
  }).select().single()
  if (itemError) throw itemError

  const { error: finishedError } = await supabase.from('finished_products').insert({ item_id: item.id, price })
  if (finishedError) throw finishedError

  if (initial > 0) {
    const { error: movementError } = await supabase.from('inventory_movements').insert({ item_id: item.id, movement_type: 'saldo_inicial', quantity_delta: initial, created_by: userId, notes: 'Cadastro pelo Gerente Virtual' })
    if (movementError) throw movementError
  }
  return { sucesso: true, produto: { ...item, price }, estoque_inicial: initial }
}

export async function atualizarProduto({ produto, campo, novo_valor }) {
  const match = await requireOneItem(produto)
  if (!match.item) return match
  const isPrice = campo === 'price'
  if (!isPrice && !allowedItemFields.has(campo)) throw new Error('Campo não permitido.')
  const parsed = isPrice ? Number(novo_valor) : String(novo_valor).trim()
  if ((isPrice && (!Number.isFinite(parsed) || parsed < 0)) || (!isPrice && !parsed)) throw new Error('Novo valor inválido.')
  const table = isPrice ? 'finished_products' : 'inventory_items'
  const key = isPrice ? 'item_id' : 'id'
  const { data, error } = await supabase.from(table).update({ [campo]: parsed }).eq(key, match.item.id).select().single()
  if (error) throw error
  return { sucesso: true, produto: match.item.fantasy_name, campo, novo_valor: parsed, registro: data }
}

export async function executeFunction(name, args, profile) {
  if (WRITE_FUNCTIONS.has(name) && profile?.role !== 'admin') return { erro: 'PERMISSAO_NEGADA', mensagem: 'Esta ação é exclusiva de administradores.' }
  const map = {
    consultar_estoque: () => consultarEstoque(args),
    consultar_produto: () => consultarProduto(args),
    consultar_processo: () => consultarProcesso(args),
    consultar_pessoa: async () => ({ implementado: false, mensagem: 'A consulta de pessoas ainda não foi implementada.' }),
    atualizar_estoque: () => atualizarEstoque(args, profile.id),
    cadastrar_produto: () => cadastrarProduto(args, profile.id),
    atualizar_produto: () => atualizarProduto(args)
  }
  if (!map[name]) throw new Error(`Função desconhecida: ${name}`)
  try { return await map[name]() } catch (error) { return { erro: 'FALHA_NA_OPERACAO', mensagem: error.message } }
}

export function isWriteFunction(name) { return WRITE_FUNCTIONS.has(name) }
