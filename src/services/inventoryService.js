import { supabase } from '../lib/supabase.js'
import { addBalances, collectPages } from './pagination.js'

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
  const movements = await collectPages((from, to) => supabase.from('inventory_movements').select('id, item_id, quantity_delta').in('item_id', ids).order('id').range(from, to))
  return addBalances(items, movements)
}

export async function listarEstoque({ term = '', page = 0 } = {}) {
  let query = supabase.from('inventory_items').select('*', { count: 'exact' }).order('internal_code').order('id')
  const cleaned = cleanTerm(term)
  if (cleaned) query = query.or(`fantasy_name.ilike.%${cleaned}%,technical_name.ilike.%${cleaned}%,internal_code.ilike.%${cleaned}%`)
  const { data, error, count } = await query.range(page * 20, page * 20 + 19)
  if (error) throw error
  return { items: await stockForItems(data ?? []), total: count ?? 0 }
}

export async function listarMovimentos(itemId) {
  const { data, error } = await supabase.from('inventory_movements').select('id, movement_type, quantity_delta, notes, created_at').eq('item_id', itemId).order('created_at', { ascending: false }).order('id').limit(50)
  if (error) throw error
  return data ?? []
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
    movement_type: 'inventory_adjustment',
    unit: match.item.unit,
    quantity_delta: delta,
    created_by: userId,
    notes: 'Ajuste pelo Gerente Virtual'
  }).select().single()
  if (error) throw error
  const [withBalance] = await stockForItems([match.item])
  return { sucesso: true, movimento: data, produto: match.item.fantasy_name, novo_saldo: withBalance.saldo_atual }
}

export async function cadastrarProduto({ codigo, nome, observacoes = '', categoria, unidade = 'un' }) {
  if (!codigo?.trim() || !nome?.trim() || !categoria?.trim() || !unidade?.trim()) throw new Error('Código, nome, categoria e unidade são obrigatórios.')
  const { data: id, error } = await supabase.rpc('upsert_finished_product_master', {
    p_item_id: null, p_internal_code: codigo.trim(), p_fantasy_name: nome.trim(), p_technical_name: nome.trim(),
    p_category: categoria.trim(), p_unit: unidade.trim(), p_location: null, p_notes: observacoes.trim(),
    p_target_stock: 0, p_safety_stock: 0, p_avg_monthly_outflow: 0, p_manufacturing_lead_days: 0
  })
  if (error) throw error
  return { sucesso: true, produto: { id, fantasy_name: nome.trim(), internal_code: codigo.trim() }, mensagem: 'Produto cadastrado. Registre o saldo pelo ajuste de estoque, se necessário.' }
}

export async function atualizarProduto({ produto, campo, novo_valor }) {
  const match = await requireOneItem(produto)
  if (!match.item) return match
  if (!allowedItemFields.has(campo)) throw new Error('Campo não permitido. O cadastro atual não possui preço de venda.')
  const parsed = String(novo_valor ?? '').trim()
  if (!parsed) throw new Error('Novo valor inválido.')
  const { data, error } = await supabase.from('inventory_items').update({ [campo]: parsed }).eq('id', match.item.id).select().single()
  if (error) throw error
  return { sucesso: true, produto: match.item.fantasy_name, campo, novo_valor: parsed, registro: data }
}

export async function executeFunction(name, args, profile) {
  if (WRITE_FUNCTIONS.has(name) && profile?.role !== 'admin') return { erro: 'PERMISSAO_NEGADA', mensagem: 'Esta ação é exclusiva de administradores.' }
  const map = {
    consultar_estoque: () => consultarEstoque(args),
    consultar_produto: () => consultarProduto(args),
    consultar_processo: () => consultarProcesso(args),
    consultar_pessoa: async () => {
      const nome = cleanTerm(args.nome)
      if (!nome) throw new Error('Informe o nome da pessoa.')
      const { data, error } = await supabase.from('profiles').select('full_name, role').eq('active', true).ilike('full_name', `%${nome}%`).limit(20)
      if (error) throw error
      return { encontrado: Boolean(data?.length), pessoas: data ?? [] }
    },
    atualizar_estoque: () => atualizarEstoque(args, profile.id),
    cadastrar_produto: () => cadastrarProduto(args, profile.id),
    atualizar_produto: () => atualizarProduto(args)
  }
  if (!map[name]) throw new Error(`Função desconhecida: ${name}`)
  try { return await map[name]() } catch (error) { return { erro: 'FALHA_NA_OPERACAO', mensagem: error.message } }
}

export function isWriteFunction(name) { return WRITE_FUNCTIONS.has(name) }
