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
// Route-level code splitting: each page is its own chunk, fetched only when
// actually navigated to, instead of every page's code shipping in the one
// initial bundle (App.jsx wraps the routes using these in <Suspense>).
import { lazy } from 'react';
const CustomerInvoices = lazy(() => import('./pages/CustomerInvoices'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Dishes = lazy(() => import('./pages/Dishes'));
const Events = lazy(() => import('./pages/Events'));
const Home = lazy(() => import('./pages/Home'));
const Ingredients = lazy(() => import('./pages/Ingredients'));
const Inventory = lazy(() => import('./pages/Inventory'));
const KitchenView = lazy(() => import('./pages/KitchenView'));
const PerEventTasks = lazy(() => import('./pages/PerEventTasks'));
const ProducerPage = lazy(() => import('./pages/ProducerPage'));
const RecurringTasks = lazy(() => import('./pages/RecurringTasks'));
const Reports = lazy(() => import('./pages/Reports'));
const SpecialIngredients = lazy(() => import('./pages/SpecialIngredients'));
const SupplierInvoices = lazy(() => import('./pages/SupplierInvoices'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const TaskEmployees = lazy(() => import('./pages/TaskEmployees'));
const TaskManagement = lazy(() => import('./pages/TaskManagement'));
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