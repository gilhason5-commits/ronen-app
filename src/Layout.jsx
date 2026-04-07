import React from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  Calendar, 
  UtensilsCrossed, 
  Package, 
  Users, 
  ShoppingCart, 
  FileText, 
  Receipt, 
  BarChart3,
  ChevronRight,
  AlertCircle,
  LogOut,
  ClipboardList,
  ChefHat
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "לוח בקרה",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
    section: "main"
  },
  {
    title: "אירועים",
    url: createPageUrl("Events"),
    icon: Calendar,
    section: "operations"
  },
  {
    title: "מנות ותפריטים",
    url: createPageUrl("Dishes"),
    icon: UtensilsCrossed,
    section: "operations"
  },
  {
    title: "רכיבים",
    url: createPageUrl("Ingredients"),
    icon: Package,
    section: "operations"
  },
  {
    title: "תת מנות",
    url: createPageUrl("SpecialIngredients"),
    icon: Package,
    section: "operations"
  },
  {
    title: "מלאי",
    url: createPageUrl("Inventory"),
    icon: AlertCircle,
    section: "operations"
  },
  {
    title: "ספקים",
    url: createPageUrl("Suppliers"),
    icon: Users,
    section: "operations"
  },

  {
    title: "דוחות",
    url: createPageUrl("Reports"),
    icon: BarChart3,
    section: "main"
  },
  {
    title: "מאגר משימות",
    url: createPageUrl("TaskManagement"),
    icon: FileText,
    section: "tasks"
  },
  {
    title: "משימות שוטפות",
    url: createPageUrl("RecurringTasks"),
    icon: ClipboardList,
    section: "tasks"
  },
  {
    title: "משימות אירועים",
    url: createPageUrl("PerEventTasks"),
    icon: Calendar,
    section: "tasks"
  },
  {
    title: "משימות שוטפות פטי וור",
    url: createPageUrl("PetiVorRecurringTasks"),
    icon: ClipboardList,
    section: "tasks"
  },
  {
    title: "עובדים",
    url: createPageUrl("TaskEmployees"),
    icon: Users,
    section: "tasks"
  },
  {
    title: "סיכומי עובדים",
    url: createPageUrl("WorkSummaries"),
    icon: FileText,
    section: "tasks"
  },
  {
    title: "עמוד רכש",
    url: createPageUrl("KitchenView"),
    icon: ChefHat,
    section: "operations"
  },
  {
    title: "עמוד מפיק",
    url: createPageUrl("ProducerPage"),
    icon: FileText,
    section: "operations"
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => setUserRole(u?.role)).catch(() => {});
  }, []);

  const adminOnlyPages = ["Reports", "PurchaseOrders", "Inventory"];

  // Purchase role can only see KitchenView
  if (userRole === 'purchase') {
    if (currentPageName !== "KitchenView") {
      return <Navigate to={createPageUrl("KitchenView")} replace />;
    }
  }

  // Producer role can only see ProducerPage
  if (userRole === 'producer') {
    if (currentPageName !== "ProducerPage") {
      return <Navigate to={createPageUrl("ProducerPage")} replace />;
    }
  }

  const filteredItems = navigationItems.filter(item => {
    if (userRole === 'purchase') {
      return item.url.includes("KitchenView");
    }
    if (userRole === 'producer') {
      return item.url.includes("ProducerPage");
    }
    if (adminOnlyPages.some(p => item.url.includes(p)) && userRole !== 'admin') {
      return false;
    }
    return true;
  });

  const sections = {
    main: [],
    operations: [],
    purchasing: [],
    tasks: []
  };

  filteredItems.forEach(item => {
    sections[item.section].push(item);
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FAFAF9]" dir="rtl">
        <Sidebar className="border-l border-stone-200 bg-white" side="right">
          <SidebarHeader className="border-b border-stone-200 p-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-sm">
                  <UtensilsCrossed className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-stone-900 text-lg">Ray Event Hall</h2>
                  <p className="text-xs text-stone-500">מערכת ניהול</p>
                </div>
              </div>
              <button
                onClick={() => base44.auth.logout()}
                className="flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                התנתק
              </button>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {sections.main.length > 0 && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sections.main.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          className={`hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200 rounded-lg mb-1 ${
                            location.pathname === item.url ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-700'
                          }`}
                          onClick={() => navigate(item.url, { replace: true })}
                        >
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2">
                תפעול
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sections.operations.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        className={`hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-700'
                        }`}
                        onClick={() => navigate(item.url, { replace: true })}
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {sections.purchasing.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2">
                    רכש
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {sections.purchasing.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            className={`hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200 rounded-lg mb-1 ${
                              location.pathname === item.url ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-700'
                            }`}
                            onClick={() => navigate(item.url, { replace: true })}
                          >
                            <div className="flex items-center gap-3 px-3 py-2.5">
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                )}

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 py-2">
                משימות
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sections.tasks.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        className={`hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-700'
                        }`}
                        onClick={() => navigate(item.url, { replace: true })}
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-stone-200 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-stone-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-lg font-semibold text-stone-900">Ray Event Hall</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}