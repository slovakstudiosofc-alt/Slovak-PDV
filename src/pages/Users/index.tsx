import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { User } from '../../types'
import Modal from '../../components/Modal'
import { useAuthStore } from '../../store/auth'

const ROLES = { admin: 'Administrador', manager: 'Gerente', cashier: 'Operador' }

export default function Users() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', username: '', password: '', confirmPassword: '', role: 'cashier', active: true })

  const load = () => window.api.users.list().then(u => setUsers(u as User[]))
  useEffect(() => { load() }, [])

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ name: u.name, username: u.username, password: '', confirmPassword: '', role: u.role, active: u.active })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.username.trim()) { toast.error('Nome e usuário são obrigatórios'); return }
    if (!editing && !form.password) { toast.error('Senha é obrigatória'); return }
    if (form.password && form.password !== form.confirmPassword) { toast.error('Senhas não conferem'); return }
    if (form.password && form.password.length < 4) { toast.error('Senha deve ter pelo menos 4 caracteres'); return }
    try {
      const data = { name: form.name.trim(), username: form.username.trim(), role: form.role, active: form.active, ...(form.password ? { password: form.password } : {}) }
      if (editing) {
        await window.api.users.update(editing.id, data); toast.success('Usuário atualizado')
      } else {
        await window.api.users.create({ ...data, password: form.password }); toast.success('Usuário criado')
      }
      setModal(false); load()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro') }
  }

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) { toast.error('Não é possível remover o usuário atual'); return }
    if (!confirm(`Desativar usuário "${u.name}"?`)) return
    try {
      await window.api.users.delete(u.id); toast.success('Usuário desativado'); load()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro') }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">Usuários</h1>
        {currentUser?.role === 'admin' && (
          <button onClick={() => { setEditing(null); setForm({ name: '', username: '', password: '', confirmPassword: '', role: 'cashier', active: true }); setModal(true) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> Novo Usuário
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['Nome', 'Usuário', 'Perfil', 'Status', 'Criado em', 'Ações'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">{u.name.charAt(0)}</div>
                    <span className="font-medium text-gray-800">{u.name}</span>
                    {u.id === currentUser?.id && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">você</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    <Shield size={11} /> {ROLES[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.created_at?.split(' ')[0]}</td>
                <td className="px-4 py-3">
                  {currentUser?.role === 'admin' && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Editar Usuário' : 'Novo Usuário'} size="sm">
        <div className="space-y-4">
          {[{ label: 'Nome Completo *', key: 'name' }, { label: 'Nome de Usuário *', key: 'username' }].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input value={(form as Record<string, unknown>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{editing ? 'Nova Senha (deixar vazio para manter)' : 'Senha *'}</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar Senha</label>
            <input type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              <span className="text-sm text-gray-600">Usuário ativo</span>
            </label>
          )}
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t">
          <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">Salvar</button>
        </div>
      </Modal>
    </div>
  )
}
