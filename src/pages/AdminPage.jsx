import { useState } from 'react'
import { Boxes, CheckCircle2, PackagePlus } from 'lucide-react'
import AppShell from '../components/AppShell.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { atualizarEstoque, cadastrarProduto } from '../services/inventoryService.js'

const emptyProduct = { nome: '', descricao: '', preco: '', categoria: '', estoque_inicial: '0' }
const emptyStock = { produto: '', operacao: 'adicionar', quantidade: '' }

export default function AdminPage() {
  const { profile } = useAuth()
  const [product, setProduct] = useState(emptyProduct)
  const [stock, setStock] = useState(emptyStock)
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState('')

  async function create(event) {
    event.preventDefault(); setBusy('product'); setFeedback(null)
    try { const result = await cadastrarProduto(product, profile.id); setProduct(emptyProduct); setFeedback({ ok: true, text: `Produto “${result.produto.fantasy_name}” cadastrado com sucesso.` }) }
    catch (error) { setFeedback({ ok: false, text: error.message }) }
    finally { setBusy('') }
  }

  async function adjust(event) {
    event.preventDefault(); setBusy('stock'); setFeedback(null)
    try {
      const result = await atualizarEstoque(stock, profile.id)
      if (!result.sucesso) throw new Error(result.message)
      setStock(emptyStock); setFeedback({ ok: true, text: `Estoque de “${result.produto}” ajustado. Novo saldo: ${result.novo_saldo}.` })
    } catch (error) { setFeedback({ ok: false, text: error.message }) }
    finally { setBusy('') }
  }

  return <AppShell><section className="admin-page">
    <header className="page-header"><div><h1>Administração</h1><p>Cadastre produtos e registre ajustes manuais de estoque.</p></div><span className="role-badge admin">acesso admin</span></header>
    {feedback && <div className={`feedback ${feedback.ok ? 'success' : 'failure'}`}><CheckCircle2 size={19} />{feedback.text}</div>}
    <div className="admin-grid">
      <form className="form-card" onSubmit={create}><div className="form-title"><PackagePlus /><div><h2>Novo produto</h2><p>Cadastro de produto acabado</p></div></div>
        <label>Nome do produto<input required value={product.nome} onChange={(e) => setProduct({ ...product, nome: e.target.value })} /></label>
        <label>Descrição<textarea required rows="3" value={product.descricao} onChange={(e) => setProduct({ ...product, descricao: e.target.value })} /></label>
        <div className="form-row"><label>Preço (R$)<input required min="0" step="0.01" type="number" value={product.preco} onChange={(e) => setProduct({ ...product, preco: e.target.value })} /></label><label>Estoque inicial<input required min="0" step="0.001" type="number" value={product.estoque_inicial} onChange={(e) => setProduct({ ...product, estoque_inicial: e.target.value })} /></label></div>
        <label>Categoria<input required value={product.categoria} onChange={(e) => setProduct({ ...product, categoria: e.target.value })} /></label>
        <button className="primary" disabled={busy === 'product'}>{busy === 'product' ? 'Salvando...' : 'Cadastrar produto'}</button>
      </form>
      <form className="form-card" onSubmit={adjust}><div className="form-title"><Boxes /><div><h2>Ajustar estoque</h2><p>Registra uma movimentação auditável</p></div></div>
        <label>Produto ou código<input required value={stock.produto} onChange={(e) => setStock({ ...stock, produto: e.target.value })} placeholder="Ex.: PA-0001" /></label>
        <label>Operação<select value={stock.operacao} onChange={(e) => setStock({ ...stock, operacao: e.target.value })}><option value="adicionar">Adicionar</option><option value="remover">Remover</option></select></label>
        <label>Quantidade<input required min="0.001" step="0.001" type="number" value={stock.quantidade} onChange={(e) => setStock({ ...stock, quantidade: e.target.value })} /></label>
        <button className="primary" disabled={busy === 'stock'}>{busy === 'stock' ? 'Salvando...' : 'Registrar ajuste'}</button>
      </form>
    </div>
  </section></AppShell>
}
