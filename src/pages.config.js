/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import CustomerInvoices from './pages/CustomerInvoices';
import Dashboard from './pages/Dashboard';
import Dishes from './pages/Dishes';
import Events from './pages/Events';
import Home from './pages/Home';
import Ingredients from './pages/Ingredients';
import Inventory from './pages/Inventory';
import KitchenView from './pages/KitchenView';
import PerEventTasks from './pages/PerEventTasks';
import ProducerPage from './pages/ProducerPage';
import RecurringTasks from './pages/RecurringTasks';
import Reports from './pages/Reports';
import SpecialIngredients from './pages/SpecialIngredients';
import SupplierInvoices from './pages/SupplierInvoices';
import Suppliers from './pages/Suppliers';
import TaskEmployees from './pages/TaskEmployees';
import TaskManagement from './pages/TaskManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CustomerInvoices": CustomerInvoices,
    "Dashboard": Dashboard,
    "Dishes": Dishes,
    "Events": Events,
    "Home": Home,
    "Ingredients": Ingredients,
    "Inventory": Inventory,
    "KitchenView": KitchenView,
    "PerEventTasks": PerEventTasks,
    "ProducerPage": ProducerPage,
    "RecurringTasks": RecurringTasks,
    "Reports": Reports,
    "SpecialIngredients": SpecialIngredients,
    "SupplierInvoices": SupplierInvoices,
    "Suppliers": Suppliers,
    "TaskEmployees": TaskEmployees,
    "TaskManagement": TaskManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};