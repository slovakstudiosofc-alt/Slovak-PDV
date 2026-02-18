import { ElectronAPI } from '@electron-toolkit/preload'

interface Api {
  products: {
    list(filters?: object): Promise<unknown[]>
    get(id: number): Promise<unknown>
    getByBarcode(barcode: string): Promise<unknown>
    getByCode(code: string): Promise<unknown>
    create(data: object): Promise<unknown>
    update(id: number, data: object): Promise<boolean>
    delete(id: number): Promise<boolean>
    updateStock(id: number, qty: number): Promise<boolean>
    getLowStock(): Promise<unknown[]>
  }
  categories: {
    list(activeOnly?: boolean): Promise<unknown[]>
    create(data: object): Promise<unknown>
    update(id: number, data: object): Promise<boolean>
    delete(id: number): Promise<boolean>
  }
  customers: {
    list(search?: string): Promise<unknown[]>
    get(id: number): Promise<unknown>
    create(data: object): Promise<unknown>
    update(id: number, data: object): Promise<boolean>
    delete(id: number): Promise<boolean>
    getSalesHistory(id: number): Promise<unknown[]>
  }
  sales: {
    list(filters?: object): Promise<unknown[]>
    get(id: number): Promise<unknown>
    create(sale: object, items: object[]): Promise<{ id: number; code: string }>
    cancel(id: number, reason?: string): Promise<boolean>
    getPaymentMethods(): Promise<unknown[]>
    getToday(): Promise<unknown>
  }
  users: {
    list(): Promise<unknown[]>
    get(id: number): Promise<unknown>
    create(data: object): Promise<unknown>
    update(id: number, data: object): Promise<boolean>
    delete(id: number): Promise<boolean>
    login(username: string, password: string): Promise<unknown>
    changePassword(id: number, old: string, newPass: string): Promise<boolean>
  }
  settings: {
    getAll(): Promise<Record<string, string>>
    get(key: string): Promise<string>
    set(key: string, value: string): Promise<boolean>
    setMultiple(data: object): Promise<boolean>
    getPaymentMethods(): Promise<unknown[]>
    createPaymentMethod(data: object): Promise<unknown>
    updatePaymentMethod(id: number, data: object): Promise<boolean>
    deletePaymentMethod(id: number): Promise<boolean>
  }
  serviceOrders: {
    list(filters?: object): Promise<unknown[]>
    get(id: number): Promise<unknown>
    create(data: object, items: object[]): Promise<{ id: number; code: string }>
    update(id: number, data: object, items: object[]): Promise<boolean>
    updateStatus(id: number, status: string): Promise<boolean>
    delete(id: number): Promise<boolean>
  }
  suppliers: {
    list(search?: string): Promise<unknown[]>
    create(data: object): Promise<unknown>
    update(id: number, data: object): Promise<boolean>
    delete(id: number): Promise<boolean>
  }
  reports: {
    salesSummary(start: string, end: string): Promise<unknown>
    stockReport(): Promise<unknown[]>
    cashFlow(start: string, end: string): Promise<unknown>
    serviceOrdersSummary(start: string, end: string): Promise<unknown>
    dashboard(): Promise<unknown>
  }
  printer: {
    test(): Promise<{ success: boolean; message?: string }>
    printReceipt(data: object): Promise<{ success: boolean; message?: string }>
    printServiceOrder(data: object): Promise<{ success: boolean; message?: string }>
    listUsbDevices(): Promise<unknown[]>
  }
  cashDrawer: {
    open(): Promise<{ success: boolean; message?: string }>
    openViaEscpos(): Promise<{ success: boolean; message?: string }>
    listPorts(): Promise<string[]>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
