import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Product, Category } from '../../types'
import Modal from '../../components/Modal'

const UNITS = ['UN', 'KG', 'G', 'L', 'ML', 'M', 'CM', 'CX', 'PCT', 'PAR', 'DZ']

const emptyForm = { code: '', barcode: '', name: '', description: '', category_id: '', price: '', cost_price: '', stock: '', min_stock: '', unit: 'UN', active: true }

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [sym, setSym] = useState('R$')

  const load = async () => {
    const filters: Record<string, unknown> = { active: true }
    if (search) filters.search = search
    if (catFilter) filters.category_id = parseInt(catFilter)
    const [prods, cats] = await Promise.all([
      window.api.products.list(filters),
      window.api.categories.list(true)
    ])
    setProducts(prods as Product[])
    setCategories(cats as Category[])
  }

  useEffect(() => { load(); window.api.settings.get('currency_symbol').then(s => setSym(s || 'R$')) }, [])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search, catFilter])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true) }
  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({ code: p.code, barcode: p.barcode || '', name: p.name, description: p.description || '', category_id: String(p.category_id || ''), price: String(p.price), cost_price: String(p.cost_price || ''), stock: String(p.stock), min_stock: String(p.min_stock || ''), unit: p.unit, active: p.active })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error('Código e nome são obrigatórios'); return }
    const data = {
      code: form.code.trim(), barcode: form.barcode.trim() || null, name: form.name.trim(),
      description: form.description.trim() || null, category_id: form.category_id ? parseInt(form.category_id) : null,
      price: parseFloat(form.price) || 0, cost_price: parseFloat(form.cost_price) || 0,
      stock: parseFloat(form.stock) || 0, min_stock: parseFloat(form.min_stock) || 0,
      unit: form.unit, active: form.active ? 1 : 0
    }
    try {
      if (editing) {
        await window.api.products.update(editing.id, data)
        toast.success('Produto atualizado')
      } else {
        await window.api.products.create(data)
        toast.success('Produto criado')
      }
      setModal(false); load()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro ao salvar') }
  }

  const handleDelete = async (p: Product) => {
    if (!confirm(`Desativar produto "${p.name}"?`)) return
    await window.api.products.delete(p.id)
    toast.success('Produto desativado'); load()
  }

  const f = (v: string | number) => `${sym} ${parseFloat(String(v)).toFixed(2)}`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Produtos</h1>
          <p className="text-sm text-gray-500">{products.length} produtos cadastrados</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, código ou código de barras..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Código', 'Produto', 'Categoria', 'Preço', 'Custo', 'Estoque', 'Unid.', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{p.name}</p>
                    {p.barcode && <p className="text-xs text-gray-400">{p.barcode}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.category_name || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{f(p.price)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.cost_price ? f(p.cost_price) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 font-medium ${p.min_stock && p.stock <= p.min_stock ? 'text-red-600' : 'text-gray-800'}`}>
                      {p.min_stock && p.stock <= p.min_stock && <AlertTriangle size={13} />}
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center">
                  <Package size={40} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-400">Nenhum produto encontrado</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Editar Produto' : 'Novo Produto'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Código *', key: 'code', placeholder: 'EX001' },
            { label: 'Código de Barras', key: 'barcode', placeholder: '7891234567890' },
            { label: 'Nome *', key: 'name', placeholder: 'Nome do produto', full: true },
            { label: 'Preço de Venda', key: 'price', placeholder: '0.00', type: 'number' },
            { label: 'Preço de Custo', key: 'cost_price', placeholder: '0.00', type: 'number' },
            { label: 'Estoque Atual', key: 'stock', placeholder: '0', type: 'number' },
            { label: 'Estoque Mínimo', key: 'min_stock', placeholder: '0', type: 'number' }
          ].map(f => (
            <div key={f.key} className={f.full ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input type={f.type || 'text'} value={(form as Record<string, unknown>)[f.key] as string}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
            <select value={form.category_id} onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
            <select value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t">
          <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium">Salvar</button>
        </div>
      </Modal>
    </div>
  )
}
