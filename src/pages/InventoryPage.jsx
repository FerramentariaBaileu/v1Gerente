import { useEffect, useState } from 'react'
import { Boxes, Search } from 'lucide-react'
import AppShell from '../components/AppShell.jsx'
import { listarEstoque, listarMovimentos } from '../services/inventoryService.js'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
export default function InventoryPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState({ term: '', page: 0, revision: 0 })
  const [result, setResult] = useState({ items: [], total: 0 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')
  useEffect(() => {
    let active = true
    setBusy(true); setError(''); setSelected(null)
    listarEstoque(query).then(data => { if (active) setResult(data) })
      .catch(error => { if (active) setError(error.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [query])
  useEffect(() => {
    let active = true
    setHistory(null); setHistoryError('')
    if (selected) listarMovimentos(selected.id).then(data => { if (active) setHistory(data) })
      .catch(error => { if (active) setHistoryError(error.message) })
    return () => { active = false }
  }, [selected])
  return <AppShell><section className="inventory-page">
    <header className="page-header"><div><h1>Estoque</h1><p>Produtos e saldos calculados pelas movimentações registradas.</p></div><Boxes aria-hidden="true" /></header>
    <form className="inventory-search" onSubmit={event => { event.preventDefault(); setQuery({ term: input.trim(), page: 0, revision: query.revision + 1 }) }}>
      <label htmlFor="inventory-search">Nome, nome técnico ou código<input id="inventory-search" value={input} onChange={event => setInput(event.target.value)} placeholder="Ex.: PA-0001 ou broca" /></label>
      <button className="primary" disabled={busy}><Search size={18} />Buscar</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => setQuery({ ...query, revision: query.revision + 1 })}>Atualizar</button>
    </form>
    {error ? <p className="error-box" role="alert">{error}</p> : busy ? <p role="status">Carregando estoque...</p> : <>
      <p className="muted">{result.total} produto(s) encontrado(s)</p>
      {result.items.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Saldo</th><th>Consulta</th></tr></thead><tbody>
        {result.items.map(item => <tr key={item.id}><td>{item.internal_code || '—'}</td><td><strong>{item.fantasy_name || item.technical_name}</strong><small>{item.technical_name}</small></td><td>{item.category || '—'}</td><td className={item.saldo_atual <= 0 ? 'stock-warning' : ''}>{number.format(item.saldo_atual)}</td><td><button className="secondary" onClick={() => setSelected(item)}>Ver histórico</button></td></tr>)}
      </tbody></table></div> : <div className="form-card">Nenhum produto encontrado. Tente outro nome ou código.</div>}
      <div className="pagination"><button className="secondary" disabled={query.page === 0} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Anterior</button><span>Página {query.page + 1} de {Math.max(1, Math.ceil(result.total / 20))}</span><button className="secondary" disabled={(query.page + 1) * 20 >= result.total} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Próxima</button></div>
    </>}
    {selected && <section className="form-card" aria-label="Histórico do produto"><div className="page-header"><div><h2>{selected.fantasy_name || selected.technical_name}</h2><p>Até 50 movimentações mais recentes</p></div><button className="secondary" onClick={() => setSelected(null)}>Fechar</button></div>
      {historyError ? <p role="alert">{historyError}</p> : !history ? <p role="status">Carregando histórico...</p> : !history.length ? <p>Nenhuma movimentação registrada.</p> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Quantidade</th><th>Observação</th></tr></thead><tbody>{history.map(row => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('pt-BR')}</td><td>{row.movement_type}</td><td>{number.format(row.quantity_delta)}</td><td>{row.notes || '—'}</td></tr>)}</tbody></table></div>}
    </section>}
  </section></AppShell>
}
