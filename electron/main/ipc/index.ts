import { registerProductsIpc } from './products'
import { registerCategoriesIpc } from './categories'
import { registerCustomersIpc } from './customers'
import { registerSalesIpc } from './sales'
import { registerUsersIpc } from './users'
import { registerSettingsIpc } from './settings'
import { registerPrinterIpc } from './printer'
import { registerServiceOrdersIpc } from './serviceOrders'
import { registerReportsIpc } from './reports'
import { registerSuppliersIpc } from './suppliers'
import { registerCashDrawerIpc } from './cashDrawer'

export function registerIpcHandlers(): void {
  registerProductsIpc()
  registerCategoriesIpc()
  registerCustomersIpc()
  registerSalesIpc()
  registerUsersIpc()
  registerSettingsIpc()
  registerPrinterIpc()
  registerServiceOrdersIpc()
  registerReportsIpc()
  registerSuppliersIpc()
  registerCashDrawerIpc()
}
