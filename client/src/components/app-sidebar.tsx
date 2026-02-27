import { 
  LayoutDashboard, 
  Calculator, 
  Database, 
  History,
  Package,
  Printer,
  Wrench,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { Link, useLocation } from "wouter";

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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { 
  Collapsible, 
  CollapsibleTrigger, 
  CollapsibleContent 
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

// Menu items
const items = [
  {
    title: "Produkt Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Rezepturen",
    url: "/recipes",
    icon: Package,
  },
  {
    title: "Zutaten-DB",
    url: "/ingredients",
    icon: Database,
  },
  {
    title: "Statistiken",
    url: "/statistics",
    icon: BarChart3,
  },
  {
    title: "Tools",
    icon: Wrench,
    items: [
      {
        title: "QUID Rechner",
        url: "/quid-calculator",
        icon: Calculator,
      },
      {
        title: "Reverser",
        url: "/reverser",
        icon: History,
      },
    ]
  }
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="h-14 flex items-center px-4 font-bold text-lg text-primary border-b border-border bg-sidebar justify-start">
        DEVELOPMENT Suite
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.items ? (
                    <Collapsible defaultOpen className="group/collapsible">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton size="sm" className="font-medium text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                          <item.icon className="w-4 h-4 mr-2" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 w-4 h-4" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={location === subItem.url} size="md" className="data-[active=true]:bg-blue-100 data-[active=true]:text-primary">
                                <Link href={subItem.url}>
                                  {subItem.icon && <subItem.icon className="w-4 h-4 mr-2" />}
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url} size="sm" className="font-medium text-foreground data-[active=true]:bg-blue-100 data-[active=true]:text-primary">
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4 mr-2" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
