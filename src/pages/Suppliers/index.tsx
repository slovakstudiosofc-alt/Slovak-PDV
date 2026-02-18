import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Trash2, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Supplier } from '../../types'
import Modal from '../../components/Modal'

const emptyForm = { name: '', cnpj: '', phone: '', email: '', address: '', contact_name: '', notes: '' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = () => window.api.suppliers.list(search || undefined).then(s => setSuppliers(s as Supplier[]))
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search])

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({ name: s.name, cnpj: s.cnpj || '', phone: s.phone || '', email: s.email || '', address: s.address || '', contact_name: s.contact_name || '', notes: s.notes || '' })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    try {
      if (editing) {
        await window.api.suppliers.update(editing.id, form); toast.success('Fornecedor atualizado')
      } else {
        await window.api.suppliers.create(form); toast.success('Fornecedor criado')
      }
      setModal(false); load()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro') }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">Fornecedores</h1>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Novo Fornecedor
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['Nome', 'CNPJ', 'Telefone', 'Contato', 'Ações'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.cnpj || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.contact_name || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>
                    <button onClick={async () => { if (!confirm('Remover fornecedor?')) return; await window.api.suppliers.delete(s.id); toast.success('Removido'); load() }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center">
                <Truck size={40} className="mx-auto text-gray-200 mb-2" />
                <p className="text-gray-400">Nenhum fornecedor cadastrado</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="md">
        <div className="space-y-3">
          {[
            { label: 'Nome *', key: 'name' }, { label: 'CNPJ', key: 'cnpj' },
            { label: 'Telefone', key: 'phone' }, { label: 'E-mail', key: 'email' },
            { label: 'Endereço', key: 'address' }, { label: 'Nome do Contato', key: 'contact_name' }
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t">
          <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">Salvar</button>
        </div>
      </Modal>
    </div>
  )
}
