import { useState, useEffect } from 'react'
import { Eye, XCircle, Receipt } from 'lucide-react'
import { Sale } from '../../types'
import Modal from '../../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), status: '' })
  const [viewing, setViewing] = useState<Sale | null>(null)
  const [sym, setSym] = useState('R$')

  const load = () => window.api.sales.list({ start: search.start, end: search.end, status: search.status || undefined }).then(s => setSales(s as Sale[]))
  useEffect(() => { load(); window.api.settings.get('currency_symbol').then(s => setSym(s || 'R$')) }, [])
  useEffect(() => { load() }, [search])

  const openView = async (s: Sale) => {
    const detail = await window.api.sales.get(s.id)
    setViewing(detail as Sale)
  }

  const cancelSale = async (s: Sale) => {
    const reason = prompt('Motivo do cancelamento:')
    if (reason === null) return
    await window.api.sales.cancel(s.id, reason)
    toast.success('Venda cancelada'); load()
  }

  const printReceipt = async (s: Sale) => {
    const detail = await window.api.sales.get(s.id) as Sale
    const result = await window.api.printer.printReceipt({
      code: detail.code,
      date: format(new Date(detail.created_at), 'dd/MM/yyyy HH:mm'),
      customer: detail.customer_name,
      items: (detail.items || []).map(i => ({ name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total })),
      subtotal: detail.subtotal, discount: detail.discount, total: detail.total,
      payment_method: detail.payment_method, payment_amount: detail.payment_amount, change_amount: detail.change_amount,
      user: detail.user_name || ''
    })
    if (!result.success) toast.error(result.message || 'Erro ao imprimir')
    else toast.success('Cupom impresso!')
  }

  const fmt = (v: number) => `${sym} ${v.toFixed(2)}`
  const totalRevenue = sales.filter(s => s.status === 'completed').reduce((a, s) => a + s.total, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">Histórico de Vendas</h1>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
          <span className="text-sm text-gray-500">Total: </span>
          <span className="text-sm font-bold text-green-600">{fmt(totalRevenue)}</span>
          <span className="text-sm text-gray-400 ml-2">({sales.filter(s => s.status === 'completed').length} vendas)</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-wrap gap-3 p-4 border-b">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">De</label>
            <input type="date" value={search.start} onChange={e => setSearch(p => ({ ...p, start: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Até</label>
            <input type="date" value={search.end} onChange={e => setSearch(p => ({ ...p, end: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={search.status} onChange={e => setSearch(p => ({ ...p, status: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Todos os status</option>
            <option value="completed">Concluídas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Código', 'Data/Hora', 'Cliente', 'Operador', 'Pagamento', 'Total', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600">{s.code}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(s.created_at), 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-4 py-3 text-gray-700">{s.customer_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.user_name}</td>
                <td className="px-4 py-3 text-gray-500">{s.payment_method}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{fmt(s.total)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {s.status === 'completed' ? 'Concluída' : s.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openView(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Eye size={14} /></button>
                    <button onClick={() => printReceipt(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50"><Receipt size={14} /></button>
                    {s.status === 'completed' && (
                      <button onClick={() => cancelSale(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><XCircle size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">Nenhuma venda encontrada no período</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={`Venda ${viewing?.code}`} size="lg">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Data</p><p className="font-medium">{format(new Date(viewing.created_at), 'dd/MM/yyyy HH:mm')}</p></div>
              <div><p className="text-xs text-gray-500">Cliente</p><p className="font-medium">{viewing.customer_name || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Operador</p><p>{viewing.user_name}</p></div>
              <div><p className="text-xs text-gray-500">Pagamento</p><p>{viewing.payment_method}</p></div>
            </div>
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50"><tr>
                {['Produto', 'Qtd', 'Preço', 'Total'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}
              </tr></thead>
              <tbody>
                {(viewing.items || []).map(i => (
                  <tr key={i.id} className="border-t"><td className="px-3 py-2">{i.product_name}</td><td className="px-3 py-2">{i.quantity}</td><td className="px-3 py-2">{fmt(i.unit_price)}</td><td className="px-3 py-2 font-medium">{fmt(i.total)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm space-y-1 bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(viewing.subtotal)}</span></div>
              {viewing.discount > 0 && <div className="flex justify-between text-red-500"><span>Desconto</span><span>- {fmt(viewing.discount)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="text-blue-600">{fmt(viewing.total)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pago</span><span>{fmt(viewing.payment_amount)}</span></div>
              {viewing.change_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Troco</span><span>{fmt(viewing.change_amount)}</span></div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
