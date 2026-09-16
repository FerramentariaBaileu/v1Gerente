// Use the actual returned length: the server may cap pages below our request.
export async function collectPages(queryPage) {
  const rows = []
  for (;;) {
    const { data, error } = await queryPage(rows.length, rows.length + 499)
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
  }
}

export function addBalances(items, movements) {
  const balances = new Map()
  for (const row of movements) {
    const quantity = Number(row.quantity_delta)
    if (!Number.isFinite(quantity)) throw new Error('Movimentação com quantidade inválida.')
    balances.set(row.item_id, (balances.get(row.item_id) ?? 0) + quantity)
  }
  return items.map(item => ({ ...item, saldo_atual: balances.get(item.id) ?? 0 }))
}
