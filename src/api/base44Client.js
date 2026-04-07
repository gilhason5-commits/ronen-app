import { createEntity } from './entityFactory';
import { auth } from './auth';

/**
 * Drop-in replacement for the Base44 client.
 * All base44.entities.EntityName and base44.auth calls work identically.
 */
export const base44 = {
  entities: {
    AppSetting:                 createEntity('AppSetting'),
    Category:                   createEntity('Category'),
    CustomerInvoice:            createEntity('CustomerInvoice'),
    Department:                 createEntity('Department'),
    Dish:                       createEntity('Dish'),
    EmployeeDailyAvailability:  createEntity('EmployeeDailyAvailability'),
    EmployeeRole:               createEntity('EmployeeRole'),
    Event:                      createEntity('Event'),
    EventDishNote:              createEntity('EventDishNote'),
    EventStaffing:              createEntity('EventStaffing'),
    Event_Stage:                createEntity('Event_Stage'),
    Events_Dish:                createEntity('Events_Dish'),
    Ingredient:                 createEntity('Ingredient'),
    Ingredient_Category:        createEntity('Ingredient_Category'),
    Ingredient_Price_History:   createEntity('Ingredient_Price_History'),
    InventoryMovement:          createEntity('InventoryMovement'),
    PurchaseOrder:              createEntity('PurchaseOrder'),
    SpecialIngredient:          createEntity('SpecialIngredient'),
    SubCategory:                createEntity('SubCategory'),
    Supplier:                   createEntity('Supplier'),
    SupplierInvoice:            createEntity('SupplierInvoice'),
    Supplier_Category:          createEntity('Supplier_Category'),
    TaskAssignment:             createEntity('TaskAssignment'),
    TaskCategory:               createEntity('TaskCategory'),
    TaskEmployee:               createEntity('TaskEmployee'),
    TaskTemplate:               createEntity('TaskTemplate'),
    WorkSummary:                createEntity('WorkSummary'),
    // Query is used generically in some places — map to a no-op passthrough
    Query: { list: async () => [], filter: async () => [], create: async (d) => d },
  },
  auth,
};
