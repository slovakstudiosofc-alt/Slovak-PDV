import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Reports() {
  const [tab, setTab] = useState<'sales' | 'stock' | 'os'>('sales')
  const [start, setStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [salesData, setSalesData] = useState<Record<string, unknown>>({})
  const [stockData, setStockData] = useState<Record<string, unknown>[]>([])
  const [osData, setOsData] = useState<Record<string, unknown>>({})
  const [sym, setSym] = useState('R$')

  const loadSales = () => window.api.reports.salesSummary(start, end).then(d => setSalesData(d as Record<string, unknown>))
  const loadStock = () => window.api.reports.stockReport().then(d => setStockData(d as Record<string, unknown>[]))
  const loadOS = () => window.api.reports.serviceOrdersSummary(start, end).then(d => setOsData(d as Record<string, unknown>))

  useEffect(() => { window.api.settings.get('currency_symbol').then(s => setSym(s || 'R$')) }, [])
  useEffect(() => { loadSales(); loadOS() }, [start, end])
  useEffect(() => { if (tab === 'stock') loadStock() }, [tab])

  const fmt = (v: number) => `${sym} ${(v || 0).toFixed(2)}`
  const summary = salesData.summary as Record<string, number> || {}
  const byPayment = salesData.byPayment as { payment_method: string; count: number; total: number }[] || []
  const byDay = salesData.byDay as { day: string; total: number }[] || []
  const topProducts = salesData.topProducts as { product_name: string; qty: number; total: number }[] || []

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Relatórios</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">De</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Até</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ key: 'sales', label: 'Vendas' }, { key: 'stock', label: 'Estoque' }, { key: 'os', label: 'Ordens de Serviço' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as 'sales' | 'stock' | 'os')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total de Vendas', value: String(summary.total_sales || 0) },
              { label: 'Faturamento', value: fmt(summary.total_revenue || 0) },
              { label: 'Descontos', value: fmt(summary.total_discounts || 0) },
              { label: 'Ticket Médio', value: fmt(summary.avg_ticket || 0) }
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className="text-xl font-bold text-gray-800">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Faturamento por Dia</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byDay.map(d => ({ day: format(new Date(d.day + 'T00:00:00'), 'dd/MM'), total: d.total }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => fmt(Number(v))} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Formas de Pagamento</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={byPayment} dataKey="total" nameKey="payment_method" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {topProducts.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Produtos</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b">{['Produto', 'Qtd. Vendida', 'Faturamento'].map(h => <th key={h} className="pb-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2">{p.product_name}</td>
                      <td className="py-2 text-gray-600">{p.qty}</td>
                      <td className="py-2 font-medium text-gray-800">{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'stock' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b">
            <p className="text-sm text-gray-500">
              Valor total em estoque: <strong className="text-gray-800">{fmt(stockData.reduce((s, p) => s + ((p.stock_value as number) || 0), 0))}</strong>
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              {['Código', 'Produto', 'Categoria', 'Estoque', 'Mín.', 'Preço', 'Valor Total'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {stockData.map((p, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.code as string}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name as string}</td>
                  <td className="px-4 py-3 text-gray-500">{(p.category_name as string) || '—'}</td>
                  <td className={`px-4 py-3 font-medium ${Number(p.stock) <= Number(p.min_stock) && Number(p.min_stock) > 0 ? 'text-red-600' : 'text-gray-800'}`}>{p.stock as number}</td>
                  <td className="px-4 py-3 text-gray-500">{p.min_stock as number}</td>
                  <td className="px-4 py-3 text-gray-700">{fmt(p.price as number)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(p.stock_value as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'os' && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total de OS', value: String(osData.total || 0) },
            { label: 'Concluídas', value: String(osData.completed || 0) },
            { label: 'Pendentes', value: String(osData.pending || 0) },
            { label: 'Faturamento', value: fmt(Number(osData.total_revenue) || 0) }
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
