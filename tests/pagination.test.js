import test from 'node:test'
import assert from 'node:assert/strict'
import { collectPages, addBalances } from '../src/services/pagination.js'

test('soma mais de mil movimentos mesmo quando o servidor limita cada página', async () => {
  const records = Array.from({ length: 1201 }, (_, id) => ({ id, item_id: 'a', quantity_delta: id % 2 ? -1 : 2 }))
  const all = await collectPages(async from => ({ data: records.slice(from, from + 100) }))
  assert.equal(all.length, 1201)
  assert.equal(addBalances([{ id: 'a' }, { id: 'b' }], all)[0].saldo_atual, 602)
  assert.equal(addBalances([{ id: 'b' }], all)[0].saldo_atual, 0)
})

test('não devolve saldo parcial quando uma página falha', async () => {
  await assert.rejects(collectPages(async from => from ? { error: new Error('offline') } : { data: [{ id: 1 }] }), /offline/)
})

test('aceita números decimais do banco e rejeita movimentações inválidas', () => {
  assert.equal(addBalances([{ id: 1 }], [{ item_id: 1, quantity_delta: '1.5' }, { item_id: 1, quantity_delta: '-0.5' }])[0].saldo_atual, 1)
  assert.throws(() => addBalances([{ id: 1 }], [{ item_id: 1, quantity_delta: 'invalid' }]), /inválida/)
})
