/**
 * Firebase compatibility shim — re-exports from api.ts (MySQL backend)
 * This file exists so no import paths need to change in App.tsx
 */
export {
  validateConnection,
  getMenuItemsFromDb,
  saveMenuItemToDb,
  deleteMenuItemFromDb,
  getRestaurantConfigFromDb,
  saveRestaurantConfigToDb,
  getOrdersFromDb,
  addOrderToDb,
  clearAllOrdersFromDb,
  getHeldOrdersFromDb,
  saveHeldOrderToDb,
  deleteHeldOrderFromDb,
  subscribeMenuItems,
  subscribeOrders,
  subscribeHeldOrders,
} from './api';
