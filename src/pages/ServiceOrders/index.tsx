import { useState, useEffect } from 'react'
import { Plus, Search, Eye, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { ServiceOrder, Customer } from '../../types'
import Modal from '../../components/Modal'
import { useAuthStore } from '../../store/auth'
import { format } from 'date-fns'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
  waiting_parts: { label: 'Aguardando Peças', color: 'bg-orange-100 text-orange-700' },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  delivered: { label: 'Entregue', color: 'bg-purple-100 text-purple-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' }
}
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Média', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' }
}

const emptyForm = { customer_id: '', equipment: '', brand: '', model: '', serial_number: '', accessories: '', problem_description: '', diagnosis: '', solution: '', status: 'pending', priority: 'medium', estimated_value: '', final_value: '', estimated_date: '', warranty_days: '90', notes: '' }

export default function ServiceOrders() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [editing, setEditing] = useState<ServiceOrder | null>(null)
  const [viewing, setViewing] = useState<ServiceOrder | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    const [ords, custs] = await Promise.all([
      window.api.serviceOrders.list({ status: statusFilter || undefined, search: search || undefined }),
      window.api.customers.list()
    ])
    setOrders(ords as ServiceOrder[])
    setCustomers(custs as Customer[])
  }
  useEffect(() => { load() }, [statusFilter])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search])

  const openEdit = async (o?: ServiceOrder) => {
    if (o) {
      setEditing(o)
      setForm({ customer_id: String(o.customer_id || ''), equipment: o.equipment, brand: o.brand || '', model: o.model || '', serial_number: o.serial_number || '', accessories: o.accessories || '', problem_description: o.problem_description, diagnosis: o.diagnosis || '', solution: o.solution || '', status: o.status, priority: o.priority, estimated_value: String(o.estimated_value || ''), final_value: String(o.final_value || ''), estimated_date: o.estimated_date || '', warranty_days: String(o.warranty_days || 90), notes: o.notes || '' })
    } else {
      setEditing(null); setForm(emptyForm)
    }
    setModal(true)
  }

  const openView = async (o: ServiceOrder) => {
    const detail = await window.api.serviceOrders.get(o.id)
    setViewing(detail as ServiceOrder); setViewModal(true)
  }

  const handleSave = async () => {
    if (!form.equipment.trim() || !form.problem_description.trim()) { toast.error('Equipamento e descrição do problema são obrigatórios'); return }
    const data = { ...form, customer_id: form.customer_id ? parseInt(form.customer_id) : null, user_id: user!.id, estimated_value: parseFloat(form.estimated_value) || null, final_value: parseFloat(form.final_value) || null, warranty_days: parseInt(form.warranty_days) || 90, estimated_date: form.estimated_date || null }
    try {
      if (editing) {
        await window.api.serviceOrders.update(editing.id, data, []); toast.success('OS atualizada')
      } else {
        const result = await window.api.serviceOrders.create(data, [])
        toast.success(`OS ${result.code} criada!`)
      }
      setModal(false); load()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro') }
  }

  const updateStatus = async (o: ServiceOrder, status: string) => {
    await window.api.serviceOrders.updateStatus(o.id, status)
    toast.success('Status atualizado'); load()
  }

  const printOS = async (o: ServiceOrder) => {
    const result = await window.api.printer.printServiceOrder(o)
    if (!result.success) toast.error(result.message || 'Erro ao imprimir')
    else toast.success('OS impressa!')
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ordens de Serviço</h1>
          <p className="text-sm text-gray-500">{orders.length} ordens encontradas</p>
        </div>
        <button onClick={() => openEdit()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Nova OS
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex gap-3 p-4 border-b">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código, equipamento, cliente..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Código', 'Cliente', 'Equipamento', 'Prioridade', 'Status', 'Valor Est.', 'Data', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{o.code}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customer_name || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{o.equipment}</p>
                    {o.brand && <p className="text-xs text-gray-400">{o.brand} {o.model}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_LABELS[o.priority]?.color}`}>
                      {PRIORITY_LABELS[o.priority]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={o.status} onChange={e => updateStatus(o, e.target.value)} className="text-xs border-0 bg-transparent focus:outline-none">
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{o.estimated_value ? `R$ ${o.estimated_value.toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(o.created_at), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openView(o)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Eye size={15} /></button>
                      <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"><Wrench size={15} /></button>
                      <button onClick={() => printOS(o)} title="Imprimir" className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6,18H4a2,2 0 0,1-2,-2V11a2,2 0 0,1 2,-2H20a2,2 0 0,1 2,2V16a2,2 0 0,1-2,2H18"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center">
                  <Wrench size={40} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-400">Nenhuma ordem de serviço encontrada</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? `Editar OS ${editing.code}` : 'Nova Ordem de Serviço'} size="2xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
            <select value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sem cliente</option>
              {customers.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
          {[
            { label: 'Equipamento *', key: 'equipment' },
            { label: 'Marca', key: 'brand' },
            { label: 'Modelo', key: 'model' },
            { label: 'Número de Série', key: 'serial_number' },
            { label: 'Acessórios', key: 'accessories', full: true },
          ].map(field => (
            <div key={field.key} className={field.full ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input value={(form as Record<string, string>)[field.key]} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição do Problema *</label>
            <textarea value={form.problem_description} onChange={e => setForm(p => ({ ...p, problem_description: e.target.value }))}
              rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Diagnóstico</label>
            <textarea value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))}
              rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valor Estimado</label>
            <input type="number" value={form.estimated_value} onChange={e => setForm(p => ({ ...p, estimated_value: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valor Final</label>
            <input type="number" value={form.final_value} onChange={e => setForm(p => ({ ...p, final_value: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Previsão de Entrega</label>
            <input type="date" value={form.estimated_date} onChange={e => setForm(p => ({ ...p, estimated_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Garantia (dias)</label>
            <input type="number" value={form.warranty_days} onChange={e => setForm(p => ({ ...p, warranty_days: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t">
          <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">Salvar</button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title={`OS ${viewing?.code}`} size="lg">
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">Cliente</p><p className="font-medium">{viewing.customer_name || 'Sem cliente'}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[viewing.status]?.color}`}>{STATUS_LABELS[viewing.status]?.label}</span></div>
              <div><p className="text-xs text-gray-500">Equipamento</p><p className="font-medium">{viewing.equipment}</p></div>
              <div><p className="text-xs text-gray-500">Marca/Modelo</p><p>{viewing.brand} {viewing.model || ''}</p></div>
              <div><p className="text-xs text-gray-500">N/S</p><p>{viewing.serial_number || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Prioridade</p><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_LABELS[viewing.priority]?.color}`}>{PRIORITY_LABELS[viewing.priority]?.label}</span></div>
            </div>
            <div><p className="text-xs text-gray-500 mb-1">Problema</p><p className="bg-gray-50 rounded-lg p-3">{viewing.problem_description}</p></div>
            {viewing.diagnosis && <div><p className="text-xs text-gray-500 mb-1">Diagnóstico</p><p className="bg-gray-50 rounded-lg p-3">{viewing.diagnosis}</p></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">Valor Estimado</p><p className="font-medium">{viewing.estimated_value ? `R$ ${viewing.estimated_value.toFixed(2)}` : '—'}</p></div>
              <div><p className="text-xs text-gray-500">Valor Final</p><p className="font-medium">{viewing.final_value ? `R$ ${viewing.final_value.toFixed(2)}` : '—'}</p></div>
              <div><p className="text-xs text-gray-500">Garantia</p><p>{viewing.warranty_days} dias</p></div>
              <div><p className="text-xs text-gray-500">Abertura</p><p>{format(new Date(viewing.created_at), 'dd/MM/yyyy HH:mm')}</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
