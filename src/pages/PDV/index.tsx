import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingBag, User, ChevronDown, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { Product, Customer, CartItem, PaymentMethod } from '../../types'
import { useAuthStore } from '../../store/auth'

let itemKey = 0
const newKey = () => String(++itemKey)

export default function PDV() {
  const { user } = useAuthStore()
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('percent')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currencySymbol, setCurrencySymbol] = useState('R$')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.sales.getPaymentMethods().then(pm => {
      const methods = pm as PaymentMethod[]
      setPaymentMethods(methods)
      const cash = methods.find(m => m.type === 'cash')
      if (cash) setPaymentMethod(cash)
    })
    window.api.settings.get('currency_symbol').then(s => setCurrencySymbol(s || 'R$'))
    searchRef.current?.focus()
  }, [])

  const fmt = (v: number) => `${currencySymbol} ${v.toFixed(2)}`

  const subtotal = cart.reduce((s, i) => s + i.total, 0)
  const discountValue = discountType === 'percent' ? subtotal * (discount / 100) : discount
  const total = Math.max(0, subtotal - discountValue)
  const paid = parseFloat(paymentAmount) || 0
  const change = Math.max(0, paid - total)

  const addToCart = useCallback((product: Product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.unit_price }
          : i)
      }
      return [...prev, {
        _key: newKey(),
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        quantity: qty,
        unit_price: product.price,
        discount: 0,
        total: product.price * qty
      }]
    })
  }, [])

  const updateQty = (key: string, qty: number) => {
    if (qty <= 0) { removeItem(key); return }
    setCart(prev => prev.map(i => i._key === key ? { ...i, quantity: qty, total: qty * i.unit_price } : i))
  }

  const updatePrice = (key: string, price: number) => {
    setCart(prev => prev.map(i => i._key === key ? { ...i, unit_price: price, total: i.quantity * price } : i))
  }

  const removeItem = (key: string) => setCart(prev => prev.filter(i => i._key !== key))

  const clearCart = () => {
    setCart([])
    setDiscount(0)
    setPaymentAmount('')
    setCustomer(null)
    searchRef.current?.focus()
  }

  const handleProductSearch = async (value: string) => {
    setProductSearch(value)
    if (!value.trim()) { setProductResults([]); setShowProductSearch(false); return }
    const results = await window.api.products.list({ search: value, active: true }) as Product[]
    setProductResults(results.slice(0, 8))
    setShowProductSearch(results.length > 0)
  }

  const handleBarcodeEnter = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const val = productSearch.trim()
    if (!val) return
    const byBarcode = await window.api.products.getByBarcode(val) as Product | null
    if (byBarcode) {
      addToCart(byBarcode)
      setProductSearch('')
      setShowProductSearch(false)
      return
    }
    const byCode = await window.api.products.getByCode(val) as Product | null
    if (byCode) {
      addToCart(byCode)
      setProductSearch('')
      setShowProductSearch(false)
      return
    }
    toast.error('Produto não encontrado')
  }

  const searchCustomers = async (v: string) => {
    setCustomerSearch(v)
    if (!v) { setCustomerResults([]); return }
    const res = await window.api.customers.list(v) as Customer[]
    setCustomerResults(res.slice(0, 6))
  }

  const finalizeSale = async () => {
    if (cart.length === 0) { toast.error('Carrinho vazio'); return }
    if (!paymentMethod) { toast.error('Selecione a forma de pagamento'); return }
    if (paid < total && paymentMethod.type === 'cash') {
      toast.error('Valor pago insuficiente'); return
    }
    setLoading(true)
    try {
      const saleData = {
        customer_id: customer?.id || null,
        user_id: user!.id,
        subtotal,
        discount: discountValue,
        total,
        payment_method: paymentMethod.name,
        payment_amount: paid || total,
        change_amount: change,
        status: 'completed',
        notes: ''
      }
      const items = cart.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        product_code: i.product_code,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        total: i.total
      }))
      const result = await window.api.sales.create(saleData, items)
      toast.success(`Venda ${result.code} realizada!`)

      const autoprint = await window.api.settings.get('auto_print_receipt')
      if (autoprint === 'true') {
        await window.api.printer.printReceipt({
          code: result.code,
          date: new Date().toLocaleString('pt-BR'),
          customer: customer?.name,
          items: cart.map(i => ({ name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total })),
          subtotal, discount: discountValue, total,
          payment_method: paymentMethod.name,
          payment_amount: paid || total,
          change_amount: change,
          user: user!.name
        })
        await window.api.cashDrawer.open()
      }
      clearCart()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar venda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full bg-gray-100 gap-0">
      {/* LEFT: Product Search + Cart */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-gray-200">
        {/* Search bar */}
        <div className="bg-white border-b border-gray-200 p-3 relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={productSearch}
                onChange={e => handleProductSearch(e.target.value)}
                onKeyDown={handleBarcodeEnter}
                placeholder="Buscar produto por nome, código ou código de barras..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showProductSearch && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1">
                  {productResults.map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => { addToCart(p); setProductSearch(''); setShowProductSearch(false) }}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 text-left border-b last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.code} {p.barcode ? `· ${p.barcode}` : ''}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-bold text-blue-600">{fmt(p.price)}</p>
                        <p className="text-xs text-gray-400">Est: {p.stock} {p.unit}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Customer selector */}
            <div className="relative">
              <button
                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 whitespace-nowrap"
              >
                <User size={15} className="text-gray-400" />
                <span className="text-gray-600 max-w-[120px] truncate">{customer?.name || 'Cliente'}</span>
                <ChevronDown size={13} className="text-gray-400" />
              </button>
              {showCustomerSearch && (
                <div className="absolute top-full right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1 w-72">
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => searchCustomers(e.target.value)}
                      placeholder="Buscar cliente..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  {customer && (
                    <button
                      onMouseDown={() => { setCustomer(null); setShowCustomerSearch(false) }}
                      className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 border-b"
                    >
                      Remover cliente
                    </button>
                  )}
                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => { setCustomer(c); setCustomerSearch(''); setCustomerResults([]); setShowCustomerSearch(false) }}
                      className="w-full flex flex-col px-3 py-2 hover:bg-blue-50 text-left border-b last:border-0"
                    >
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.cpf_cnpj || c.phone || ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingBag size={64} strokeWidth={1} />
              <p className="mt-3 text-base">Carrinho vazio</p>
              <p className="text-sm">Busque um produto ou leia o código de barras</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Produto</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-32">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Preço Unit.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Total</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item._key} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-800">{item.product_name}</p>
                      <p className="text-xs text-gray-400">{item.product_code}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateQty(item._key, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateQty(item._key, parseFloat(e.target.value) || 1)}
                          className="w-14 text-center border border-gray-200 rounded-lg py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          min={0.001}
                          step={1}
                        />
                        <button onClick={() => updateQty(item._key, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={e => updatePrice(item._key, parseFloat(e.target.value) || 0)}
                        className="w-full text-right border border-gray-200 rounded-lg py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        min={0}
                        step={0.01}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(item.total)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeItem(item._key)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RIGHT: Totals + Payment */}
      <div className="w-72 flex flex-col bg-white border-l border-gray-200 shrink-0">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <h2 className="font-bold text-gray-800 text-base">Resumo da Venda</h2>

          {customer && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
              <User size={14} className="text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-800 truncate">{customer.name}</p>
                <p className="text-xs text-blue-500">{customer.cpf_cnpj || customer.phone || 'Sem contato'}</p>
              </div>
              <button onClick={() => setCustomer(null)} className="text-blue-400 hover:text-blue-600">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Itens</span>
              <span className="font-medium">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{fmt(subtotal)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 shrink-0">Desconto</span>
              <div className="flex flex-1 gap-1">
                <input
                  type="number"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min={0}
                  step={0.01}
                />
                <button
                  onClick={() => setDiscountType(d => d === 'percent' ? 'value' : 'percent')}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 hover:bg-gray-100 font-medium"
                >
                  {discountType === 'percent' ? '%' : 'R$'}
                </button>
              </div>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Desconto aplicado</span>
                <span>- {fmt(discountValue)}</span>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-gray-800">TOTAL</span>
              <span className="text-2xl font-bold text-blue-600">{fmt(total)}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-2 gap-1.5">
              {paymentMethods.map(pm => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                    paymentMethod?.id === pm.id
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {pm.name}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod?.type === 'cash' && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Valor Recebido</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder={fmt(total)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={0}
                step={0.01}
              />
              {paid > 0 && paid >= total && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex justify-between">
                  <span className="text-sm text-green-700">Troco</span>
                  <span className="text-sm font-bold text-green-700">{fmt(change)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t space-y-2">
          <button
            onClick={finalizeSale}
            disabled={loading || cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-600/30"
          >
            {loading ? (
              <span>Finalizando...</span>
            ) : (
              <>
                <Check size={20} />
                Finalizar Venda
              </>
            )}
          </button>
          <button
            onClick={clearCart}
            disabled={cart.length === 0 && !customer}
            className="w-full border border-gray-200 hover:border-red-300 hover:text-red-500 text-gray-500 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
          >
            <X size={15} />
            Limpar Carrinho
          </button>
        </div>
      </div>
    </div>
  )
}
