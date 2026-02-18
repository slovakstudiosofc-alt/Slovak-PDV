import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, Printer, Store, CreditCard, Box } from 'lucide-react'
import { Settings } from '../../types'

const tabs = [
  { key: 'store', label: 'Loja', icon: Store },
  { key: 'printer', label: 'Impressora', icon: Printer },
  { key: 'drawer', label: 'Gaveta', icon: Box },
  { key: 'payments', label: 'Pagamentos', icon: CreditCard },
  { key: 'advanced', label: 'Avançado', icon: SettingsIcon }
]

interface PaymentMethod { id: number; name: string; type: string; active: boolean }

export default function SettingsPage() {
  const [tab, setTab] = useState('store')
  const [settings, setSettings] = useState<Partial<Settings>>({})
  const [payments, setPayments] = useState<PaymentMethod[]>([])
  const [ports, setPorts] = useState<string[]>([])
  const [usbDevices, setUsbDevices] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [newPayment, setNewPayment] = useState({ name: '', type: 'other' })

  useEffect(() => {
    window.api.settings.getAll().then(s => setSettings(s as Partial<Settings>))
    window.api.settings.getPaymentMethods().then(p => setPayments(p as PaymentMethod[]))
    window.api.cashDrawer.listPorts().then(p => setPorts(p))
    window.api.printer.listUsbDevices().then(d => setUsbDevices(d))
  }, [])

  const save = async () => {
    setLoading(true)
    try {
      await window.api.settings.setMultiple(settings as Record<string, string>)
      toast.success('Configurações salvas!')
    } catch { toast.error('Erro ao salvar') }
    finally { setLoading(false) }
  }

  const set = (key: keyof Settings, value: string) => setSettings(p => ({ ...p, [key]: value }))

  const testPrinter = async () => {
    await save()
    const r = await window.api.printer.test()
    if (r.success) { toast.success('Impressora OK!') } else { toast.error(r.message || 'Erro') }
  }

  const testDrawer = async () => {
    const r = await window.api.cashDrawer.open()
    if (r.success) { toast.success('Gaveta aberta!') } else { toast.error(r.message || 'Erro') }
  }

  const addPayment = async () => {
    if (!newPayment.name) return
    await window.api.settings.createPaymentMethod(newPayment)
    setNewPayment({ name: '', type: 'other' })
    window.api.settings.getPaymentMethods().then(p => setPayments(p as PaymentMethod[]))
    toast.success('Método adicionado')
  }

  const togglePayment = async (pm: PaymentMethod) => {
    await window.api.settings.updatePaymentMethod(pm.id, { ...pm, active: !pm.active })
    window.api.settings.getPaymentMethods().then(p => setPayments(p as PaymentMethod[]))
  }

  const deletePayment = async (id: number) => {
    if (!confirm('Excluir método de pagamento?')) return
    await window.api.settings.deletePaymentMethod(id)
    window.api.settings.getPaymentMethods().then(p => setPayments(p as PaymentMethod[]))
    toast.success('Método removido')
  }

  return (
    <div className="flex h-full">
      <div className="w-44 bg-white border-r border-gray-200 py-4 px-2 space-y-0.5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${tab === t.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'store' && (
          <Section title="Informações da Loja">
            {[
              { label: 'Nome da Loja', key: 'store_name' as keyof Settings },
              { label: 'CNPJ / CPF', key: 'store_cnpj' as keyof Settings },
              { label: 'Endereço', key: 'store_address' as keyof Settings },
              { label: 'Telefone', key: 'store_phone' as keyof Settings },
              { label: 'E-mail', key: 'store_email' as keyof Settings }
            ].map(f => (
              <Field key={f.key} label={f.label}>
                <input value={settings[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            ))}
            <Field label="Rodapé do Cupom">
              <textarea value={settings.receipt_footer || ''} onChange={e => set('receipt_footer', e.target.value)}
                rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <Field label="Símbolo da Moeda">
              <input value={settings.currency_symbol || ''} onChange={e => set('currency_symbol', e.target.value)}
                placeholder="R$" className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
          </Section>
        )}

        {tab === 'printer' && (
          <Section title="Configurações de Impressora">
            <Field label="Impressora Habilitada">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.printer_enabled === 'true'} onChange={e => set('printer_enabled', String(e.target.checked))} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-600">Ativar impressão térmica</span>
              </label>
            </Field>
            <Field label="Tipo de Conexão">
              <select value={settings.printer_type || 'usb'} onChange={e => set('printer_type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="usb">USB</option>
                <option value="serial">Serial / COM</option>
                <option value="network">Rede (TCP/IP)</option>
              </select>
            </Field>
            {settings.printer_type === 'serial' && (
              <Field label="Porta Serial">
                <select value={settings.printer_port || ''} onChange={e => set('printer_port', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {ports.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            )}
            {settings.printer_type === 'network' && (
              <>
                <Field label="IP da Impressora">
                  <input value={settings.printer_ip || ''} onChange={e => set('printer_ip', e.target.value)} placeholder="192.168.1.100"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="Porta TCP">
                  <input value={settings.printer_network_port || '9100'} onChange={e => set('printer_network_port', e.target.value)}
                    className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
              </>
            )}
            {settings.printer_type === 'usb' && usbDevices.length > 0 && (
              <Field label="Dispositivos USB encontrados">
                <div className="space-y-1">
                  {(usbDevices as { vendorId: number; productId: number }[]).map((d, i) => (
                    <p key={i} className="text-sm text-gray-600">VendorID: {d.vendorId} | ProductID: {d.productId}</p>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Impressão Automática">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.auto_print_receipt === 'true'} onChange={e => set('auto_print_receipt', String(e.target.checked))} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-600">Imprimir cupom automaticamente ao finalizar venda</span>
              </label>
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Salvar</button>
              <button onClick={testPrinter} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Testar Impressora</button>
            </div>
          </Section>
        )}

        {tab === 'drawer' && (
          <Section title="Gaveta de Dinheiro">
            <Field label="Gaveta Habilitada">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.cash_drawer_enabled === 'true'} onChange={e => set('cash_drawer_enabled', String(e.target.checked))} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-600">Ativar controle de gaveta via porta serial</span>
              </label>
            </Field>
            <Field label="Porta Serial">
              <select value={settings.cash_drawer_port || ''} onChange={e => set('cash_drawer_port', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {ports.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Baud Rate">
              <select value={settings.cash_drawer_baud || '9600'} onChange={e => set('cash_drawer_baud', e.target.value)}
                className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['9600','19200','38400','57600','115200'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              A gaveta de dinheiro também pode ser aberta automaticamente via impressora térmica. Certifique-se de que o cabo RJ11/RJ12 da gaveta está conectado à impressora.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Salvar</button>
              <button onClick={testDrawer} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Testar Abertura</button>
            </div>
          </Section>
        )}

        {tab === 'payments' && (
          <Section title="Métodos de Pagamento">
            <div className="space-y-2 mb-4">
              {payments.map(pm => (
                <div key={pm.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={pm.active} onChange={() => togglePayment(pm)} className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium text-gray-800">{pm.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{pm.type}</span>
                  </div>
                  <button onClick={() => deletePayment(pm.id)} className="text-xs text-red-400 hover:text-red-600">Remover</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-end border-t pt-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input value={newPayment.name} onChange={e => setNewPayment(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Vale Refeição" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select value={newPayment.type} onChange={e => setNewPayment(p => ({ ...p, type: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Crédito</option>
                  <option value="debit_card">Débito</option>
                  <option value="pix">PIX</option>
                  <option value="transfer">Transferência</option>
                  <option value="check">Cheque</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <button onClick={addPayment} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Adicionar</button>
            </div>
          </Section>
        )}

        {tab === 'advanced' && (
          <Section title="Configurações Avançadas">
            {[
              { label: 'Prefixo das Vendas', key: 'sale_code_prefix' as keyof Settings, placeholder: 'VND' },
              { label: 'Prefixo das OS', key: 'os_code_prefix' as keyof Settings, placeholder: 'OS' },
              { label: 'Taxa de Impostos (%)', key: 'tax_rate' as keyof Settings, placeholder: '0' }
            ].map(f => (
              <Field key={f.key} label={f.label}>
                <input value={settings[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                  className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            ))}
            {[
              { label: 'Permitir estoque negativo', key: 'allow_negative_stock' as keyof Settings },
              { label: 'Exigir cliente na venda', key: 'require_customer' as keyof Settings },
              { label: 'Alertar estoque baixo', key: 'low_stock_alert' as keyof Settings }
            ].map(f => (
              <Field key={f.key} label={f.label}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={settings[f.key] === 'true'} onChange={e => set(f.key, String(e.target.checked))} className="w-4 h-4 rounded" />
                  <span className="text-sm text-gray-600">Habilitado</span>
                </label>
              </Field>
            ))}
          </Section>
        )}

        {tab !== 'printer' && tab !== 'drawer' && tab !== 'payments' && (
          <div className="pt-4">
            <button onClick={save} disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
              {loading ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-5">{title}</h2>
      <div className="space-y-4 max-w-xl">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
