import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Products
  products: {
    list: (filters?: object) => ipcRenderer.invoke('products:list', filters),
    get: (id: number) => ipcRenderer.invoke('products:get', id),
    getByBarcode: (barcode: string) => ipcRenderer.invoke('products:getByBarcode', barcode),
    getByCode: (code: string) => ipcRenderer.invoke('products:getByCode', code),
    create: (data: object) => ipcRenderer.invoke('products:create', data),
    update: (id: number, data: object) => ipcRenderer.invoke('products:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('products:delete', id),
    updateStock: (id: number, qty: number) => ipcRenderer.invoke('products:updateStock', id, qty),
    getLowStock: () => ipcRenderer.invoke('products:getLowStock')
  },
  // Categories
  categories: {
    list: (activeOnly?: boolean) => ipcRenderer.invoke('categories:list', activeOnly),
    create: (data: object) => ipcRenderer.invoke('categories:create', data),
    update: (id: number, data: object) => ipcRenderer.invoke('categories:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('categories:delete', id)
  },
  // Customers
  customers: {
    list: (search?: string) => ipcRenderer.invoke('customers:list', search),
    get: (id: number) => ipcRenderer.invoke('customers:get', id),
    create: (data: object) => ipcRenderer.invoke('customers:create', data),
    update: (id: number, data: object) => ipcRenderer.invoke('customers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('customers:delete', id),
    getSalesHistory: (id: number) => ipcRenderer.invoke('customers:getSalesHistory', id)
  },
  // Sales
  sales: {
    list: (filters?: object) => ipcRenderer.invoke('sales:list', filters),
    get: (id: number) => ipcRenderer.invoke('sales:get', id),
    create: (sale: object, items: object[]) => ipcRenderer.invoke('sales:create', sale, items),
    cancel: (id: number, reason?: string) => ipcRenderer.invoke('sales:cancel', id, reason),
    getPaymentMethods: () => ipcRenderer.invoke('sales:getPaymentMethods'),
    getToday: () => ipcRenderer.invoke('sales:getToday')
  },
  // Users
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    get: (id: number) => ipcRenderer.invoke('users:get', id),
    create: (data: object) => ipcRenderer.invoke('users:create', data),
    update: (id: number, data: object) => ipcRenderer.invoke('users:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('users:delete', id),
    login: (username: string, password: string) => ipcRenderer.invoke('users:login', username, password),
    changePassword: (id: number, old: string, newPass: string) => ipcRenderer.invoke('users:changePassword', id, old, newPass)
  },
  // Settings
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    setMultiple: (data: object) => ipcRenderer.invoke('settings:setMultiple', data),
    getPaymentMethods: () => ipcRenderer.invoke('settings:getPaymentMethods'),
    createPaymentMethod: (data: object) => ipcRenderer.invoke('settings:createPaymentMethod', data),
    updatePaymentMethod: (id: number, data: object) => ipcRenderer.invoke('settings:updatePaymentMethod', id, data),
    deletePaymentMethod: (id: number) => ipcRenderer.invoke('settings:deletePaymentMethod', id)
  },
  // Service Orders
  serviceOrders: {
    list: (filters?: object) => ipcRenderer.invoke('serviceOrders:list', filters),
    get: (id: number) => ipcRenderer.invoke('serviceOrders:get', id),
    create: (data: object, items: object[]) => ipcRenderer.invoke('serviceOrders:create', data, items),
    update: (id: number, data: object, items: object[]) => ipcRenderer.invoke('serviceOrders:update', id, data, items),
    updateStatus: (id: number, status: string) => ipcRenderer.invoke('serviceOrders:updateStatus', id, status),
    delete: (id: number) => ipcRenderer.invoke('serviceOrders:delete', id)
  },
  // Suppliers
  suppliers: {
    list: (search?: string) => ipcRenderer.invoke('suppliers:list', search),
    create: (data: object) => ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: object) => ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('suppliers:delete', id)
  },
  // Reports
  reports: {
    salesSummary: (start: string, end: string) => ipcRenderer.invoke('reports:salesSummary', start, end),
    stockReport: () => ipcRenderer.invoke('reports:stockReport'),
    cashFlow: (start: string, end: string) => ipcRenderer.invoke('reports:cashFlow', start, end),
    serviceOrdersSummary: (start: string, end: string) => ipcRenderer.invoke('reports:serviceOrdersSummary', start, end),
    dashboard: () => ipcRenderer.invoke('reports:dashboard')
  },
  // Printer
  printer: {
    test: () => ipcRenderer.invoke('printer:test'),
    printReceipt: (data: object) => ipcRenderer.invoke('printer:printReceipt', data),
    printServiceOrder: (data: object) => ipcRenderer.invoke('printer:printServiceOrder', data),
    listUsbDevices: () => ipcRenderer.invoke('printer:listUsbDevices')
  },
  // Cash Drawer
  cashDrawer: {
    open: () => ipcRenderer.invoke('cashDrawer:open'),
    openViaEscpos: () => ipcRenderer.invoke('cashDrawer:openViaEscpos'),
    listPorts: () => ipcRenderer.invoke('cashDrawer:listPorts')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).electron = electronAPI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = api
}
