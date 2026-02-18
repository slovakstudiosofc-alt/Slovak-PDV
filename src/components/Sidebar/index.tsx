import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Tag, Users, Wrench,
  FileText, BarChart2, Settings, LogOut, ChevronRight, Truck, Store
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pdv', label: 'PDV / Caixa', icon: ShoppingCart, highlight: true },
  { to: '/sales', label: 'Vendas', icon: FileText },
  { to: '/products', label: 'Produtos', icon: Package },
  { to: '/categories', label: 'Categorias', icon: Tag },
  { to: '/customers', label: 'Clientes', icon: Users },
  { to: '/service-orders', label: 'Ordens de Serviço', icon: Wrench },
  { to: '/suppliers', label: 'Fornecedores', icon: Truck },
  { to: '/reports', label: 'Relatórios', icon: BarChart2 },
  { to: '/users', label: 'Usuários', icon: Users },
  { to: '/settings', label: 'Configurações', icon: Settings }
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex flex-col w-56 min-w-[220px] h-full bg-[#1a1f2e] text-white select-none">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
          <Store size={20} />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Slovak PDV</p>
          <p className="text-xs text-gray-400">Sistema de Vendas</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon, highlight }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group
              ${isActive
                ? highlight
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-blue-600/20 text-blue-400 font-medium'
                : highlight
                  ? 'text-blue-300 hover:bg-blue-600 hover:text-white'
                  : 'text-gray-400 hover:bg-white/8 hover:text-white'}`
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gerente' : 'Operador'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-600/20 hover:text-red-400 transition-all"
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </aside>
  )
}
