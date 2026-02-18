import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, TrendingUp, Package, Wrench, AlertTriangle, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DashboardData {
  today: { sales_count: number; sales_total: number }
  month: { sales_count: number; sales_total: number }
  lowStock: { count: number }
  pendingOS: { count: number }
  last7days: { day: string; total: number }[]
}

function StatCard({ label, value, sub, icon: Icon, color, onClick }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [sym, setSym] = useState('R$')
  const navigate = useNavigate()

  useEffect(() => {
    window.api.reports.dashboard().then(d => setData(d as DashboardData))
    window.api.settings.get('currency_symbol').then(s => setSym(s || 'R$'))
    const interval = setInterval(() => {
      window.api.reports.dashboard().then(d => setData(d as DashboardData))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const fmt = (v: number) => `${sym} ${(v || 0).toFixed(2)}`

  const chartData = (data?.last7days || []).map(d => ({
    day: format(new Date(d.day + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
    total: d.total || 0
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas Hoje" value={String(data?.today?.sales_count || 0)}
          sub={fmt(data?.today?.sales_total || 0)} icon={ShoppingCart} color="bg-blue-500"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          label="Faturamento Hoje" value={fmt(data?.today?.sales_total || 0)}
          sub={`${data?.today?.sales_count || 0} vendas`} icon={DollarSign} color="bg-green-500"
        />
        <StatCard
          label="Faturamento do Mês" value={fmt(data?.month?.sales_total || 0)}
          sub={`${data?.month?.sales_count || 0} vendas`} icon={TrendingUp} color="bg-purple-500"
        />
        <StatCard
          label="Estoque Baixo" value={String(data?.lowStock?.count || 0)}
          sub="produtos abaixo do mínimo" icon={AlertTriangle}
          color={data?.lowStock?.count ? 'bg-red-500' : 'bg-gray-400'}
          onClick={() => navigate('/products')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Vendas — últimos 7 dias</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${sym}${v}`} />
              <Tooltip formatter={(v) => [`${sym} ${Number(v).toFixed(2)}`, 'Total']} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
                <Wrench size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Ordens de Serviço</p>
                <p className="text-xs text-gray-400">Em aberto</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{data?.pendingOS?.count || 0}</p>
            <button onClick={() => navigate('/service-orders')} className="mt-3 text-xs text-blue-600 hover:underline">
              Ver todas as OS
            </button>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Package size={20} />
              <p className="text-sm font-semibold">Ir para o Caixa</p>
            </div>
            <p className="text-xs text-blue-200 mb-3">Acesse o PDV para registrar vendas</p>
            <button
              onClick={() => navigate('/pdv')}
              className="w-full bg-white/20 hover:bg-white/30 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Abrir PDV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
