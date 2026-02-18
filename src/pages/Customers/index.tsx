import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Customer } from '../../types'
import Modal from '../../components/Modal'

const emptyForm = { name: '', cpf_cnpj: '', rg: '', phone: '', phone2: '', email: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '', birth_date: '', notes: '', credit_limit: '' }

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    const res = await window.api.customers.list(search || undefined)
    setCustomers(res as Customer[])
  }
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search])

  const openEdit = (c: Customer) => {
    setEditing(c)
    setForm({ name: c.name, cpf_cnpj: c.cpf_cnpj || '', rg: c.rg || '', phone: c.phone || '', phone2: c.phone2 || '', email: c.email || '', address: c.address || '', number: c.number || '', complement: c.complement || '', neighborhood: c.neighborhood || '', city: c.city || '', state: c.state || '', zip_code: c.zip_code || '', birth_date: c.birth_date || '', notes: c.notes || '', credit_limit: String(c.credit_limit || '') })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    const data = { ...form, credit_limit: parseFloat(form.credit_limit) || 0, birth_date: form.birth_date || null }
    try {
      if (editing) {
        await window.api.customers.update(editing.id, data); toast.success('Cliente atualizado')
      } else {
        await window.api.customers.create(data); toast.success('Cliente criado')
      }
      setModal(false); load()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro') }
  }

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Desativar cliente "${c.name}"?`)) return
    await window.api.customers.delete(c.id); toast.success('Cliente desativado'); load()
  }

  const f = (v: string, key: string) => setForm(p => ({ ...p, [key]: v }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
          <p className="text-sm text-gray-500">{customers.length} clientes</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CPF/CNPJ, telefone..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Nome', 'CPF/CNPJ', 'Telefone', 'Cidade', 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.cpf_cnpj || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.city ? `${c.city}${c.state ? '/' + c.state : ''}` : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center">
                <Users size={40} className="mx-auto text-gray-200 mb-2" />
                <p className="text-gray-400">Nenhum cliente encontrado</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Editar Cliente' : 'Novo Cliente'} size="2xl">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Nome *', key: 'name', full: true },
            { label: 'CPF / CNPJ', key: 'cpf_cnpj' },
            { label: 'RG', key: 'rg' },
            { label: 'Telefone', key: 'phone' },
            { label: 'Telefone 2', key: 'phone2' },
            { label: 'E-mail', key: 'email', full: true },
            { label: 'Endereço', key: 'address' },
            { label: 'Número', key: 'number' },
            { label: 'Complemento', key: 'complement' },
            { label: 'Bairro', key: 'neighborhood' },
            { label: 'Cidade', key: 'city' },
            { label: 'Estado', key: 'state' },
            { label: 'CEP', key: 'zip_code' },
            { label: 'Data de Nascimento', key: 'birth_date', type: 'date' },
            { label: 'Limite de Crédito', key: 'credit_limit', type: 'number' }
          ].map(field => (
            <div key={field.key} className={field.full ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input type={field.type || 'text'} value={(form as Record<string, string>)[field.key]}
                onChange={e => f(e.target.value, field.key)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
