import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell,
    LineChart,
    Line
} from 'recharts';
import { 
    TrendingUp, 
    Users, 
    Package, 
    CheckCircle2, 
    CalendarRange,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";

// Types (Mirrored from ProductDashboard)
type TimelineEvent = {
    id: number;
    type: 'milestone' | 'recipe' | 'email' | 'parameter' | 'file';
    title: string;
    date: string;
    status: 'completed' | 'received' | 'ok' | 'pending';
};

interface Project {
    id: string;
    name: string;
    status: 'development' | 'validation' | 'production' | 'archived';
    customer?: string;
    createdAt: string;
    updatedAt: string;
    timeline: TimelineEvent[];
    checklist?: Record<string, boolean>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ef4444', '#3b82f6'];

export default function StatisticsPage() {
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        try {
            const data = localStorage.getItem("quid-projects-db-clean");
            if (data) {
                setProjects(JSON.parse(data));
            }
        } catch (e) {
            console.error("Failed to load projects for stats", e);
        }
    }, []);

    // --- Statistics Calculation ---

    // 1. Monthly Data (Current Year)
    const monthlyData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        
        const data = months.map(m => ({ name: m, neuanlagen: 0, gelistet: 0 }));

        projects.forEach(p => {
            const date = new Date(p.createdAt);
            if (date.getFullYear() === currentYear) {
                const monthIndex = date.getMonth();
                data[monthIndex].neuanlagen++;
                
                // If it's in production, count as listed (using updatedAt as proxy for listing date or check timeline)
                if (p.status === 'production') {
                    // Ideally check timeline for "Production" milestone, but status is good enough proxy
                    // Check if it was moved to production THIS year
                    const productionDate = new Date(p.updatedAt); // Approximation
                    if (productionDate.getFullYear() === currentYear) {
                         // We might want to count it in the month it was moved to production
                         const prodMonthIndex = productionDate.getMonth();
                         data[prodMonthIndex].gelistet++;
                    }
                }
            }
        });
        return data;
    }, [projects]);

    // 2. Customer Data
    const customerData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => {
            const cust = p.customer || "Sonstige";
            counts[cust] = (counts[cust] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // Top 8
    }, [projects]);

    // 3. Status Data
    const statusData = useMemo(() => {
        const counts = {
            development: 0,
            validation: 0,
            production: 0,
            archived: 0
        };

        projects.forEach(p => {
            if (counts[p.status] !== undefined) {
                counts[p.status]++;
            }
        });

        return [
            { name: 'In Entwicklung', value: counts.development, color: '#3b82f6' },
            { name: 'Validierung', value: counts.validation, color: '#f59e0b' },
            { name: 'Produktion', value: counts.production, color: '#22c55e' },
            { name: 'Archiviert', value: counts.archived, color: '#64748b' },
        ];
    }, [projects]);

    // 4. Yearly Comparison
    const yearlyData = useMemo(() => {
        const years: Record<string, { total: number, listed: number }> = {};
        
        projects.forEach(p => {
            const year = new Date(p.createdAt).getFullYear().toString();
            if (!years[year]) years[year] = { total: 0, listed: 0 };
            
            years[year].total++;
            if (p.status === 'production') {
                years[year].listed++;
            }
        });

        // Ensure we have at least current year
        const currentYear = new Date().getFullYear().toString();
        if (!years[currentYear]) years[currentYear] = { total: 0, listed: 0 };

        return Object.entries(years)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => parseInt(a.name) - parseInt(b.name));
    }, [projects]);


    // KPI Values
    const totalArticles = projects.length;
    const listedCount = projects.filter(p => p.status === 'production').length;
    const activeCustomers = new Set(projects.filter(p => p.status !== 'archived').map(p => p.customer)).size;
    
    // Avg Lead Time (Mock calculation based on creation vs update for production items)
    const avgLeadTime = useMemo(() => {
        const prodProjects = projects.filter(p => p.status === 'production');
        if (prodProjects.length === 0) return 0;

        const totalDays = prodProjects.reduce((acc, p) => {
            const start = new Date(p.createdAt).getTime();
            const end = new Date(p.updatedAt).getTime(); // Approximation
            return acc + (end - start);
        }, 0);
        
        return Math.round((totalDays / prodProjects.length) / (1000 * 60 * 60 * 24));
    }, [projects]);


    const kpis = [
        {
            title: "Artikel Gesamt",
            value: totalArticles.toString(),
            change: "", // No historical data to compare yet
            trend: "up",
            icon: Package,
            description: "Total angelegt"
        },
        {
            title: "Gelistet",
            value: listedCount.toString(),
            change: totalArticles > 0 ? `${Math.round((listedCount/totalArticles)*100)}%` : "0%",
            trend: "up",
            icon: CheckCircle2,
            description: "Quote"
        },
        {
            title: "Aktive Kunden",
            value: activeCustomers.toString(),
            change: "",
            trend: "up",
            icon: Users,
            description: "Mit laufenden Projekten"
        },
        {
            title: "Ø Durchlaufzeit",
            value: `${avgLeadTime} Tage`,
            change: "",
            trend: "down", 
            icon: CalendarRange,
            description: "Entwicklung bis Produktion"
        }
    ];

    if (projects.length === 0) {
        return (
            <div className="space-y-8 max-w-7xl mx-auto p-8 font-sans">
                 <div className="flex flex-col gap-2 border-b pb-6">
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900">Statistiken</h1>
                    <p className="text-lg text-slate-500">
                        Keine Projektdaten gefunden. Bitte legen Sie erst Projekte an.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-8 font-sans">
            <div className="flex flex-col gap-2 border-b pb-6">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">Statistiken</h1>
                <p className="text-lg text-slate-500">
                    Auswertung Ihrer Entwicklungsaktivitäten und Projekterfolge.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map((kpi, index) => (
                    <Card key={index} className="hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {kpi.title}
                            </CardTitle>
                            <kpi.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-800">{kpi.value}</div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                {kpi.change && (
                                    <span className={kpi.trend === 'up' ? "text-green-600 flex items-center" : "text-green-600 flex items-center"}>
                                        {kpi.trend === 'up' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                                        {kpi.change}
                                    </span>
                                )}
                                {kpi.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Entwicklungen pro Monat ({new Date().getFullYear()})</CardTitle>
                        <CardDescription>
                            Neuanlagen vs. erfolgreiche Listungen (Produktion).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Legend />
                                <Bar dataKey="neuanlagen" name="Neuanlagen" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="gelistet" name="In Produktion" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Top Kunden (Aktivität)</CardTitle>
                        <CardDescription>
                            Verteilung der Projekte nach Kunden.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={customerData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {customerData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="middle" align="right" layout="vertical" />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Projekt Status</CardTitle>
                        <CardDescription>Aktuelle Verteilung aller Projekte.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={0}
                                    outerRadius={80}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Jahresverlauf</CardTitle>
                        <CardDescription>Entwicklung der Artikelzahlen über die Jahre.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={yearlyData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="total" name="Gesamt Entwickelt" stroke="#8884d8" strokeWidth={2} dot={{r: 4}} />
                                <Line type="monotone" dataKey="listed" name="In Produktion" stroke="#82ca9d" strokeWidth={2} dot={{r: 4}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
