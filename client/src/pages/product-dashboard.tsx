import { getData, setData, getItem, setItem } from "@/lib/electron-storage";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Trash2, ArrowLeft, Save, FileText, Settings,
  Calendar, ChefHat, ShieldCheck, Eye, Package, MoreVertical,
  CheckCircle2, Clock, Archive, Upload, Clipboard, Image as ImageIcon,
  Download, Edit, LayoutDashboard, AlertTriangle, PlayCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectRecipeEditor } from "@/components/project-recipe-editor";
import { ProcessParametersEditor, ProcessSettings, DEFAULT_PROCESS_SETTINGS } from "@/components/process-parameters-editor";
import { FmeaEditor, FmeaData } from "@/components/fmea-editor";
import { DataManagement } from "@/components/data-management";
import { LandingPage } from "@/pages/landing-page";
import { SavedRecipe } from "@/lib/recipe-db";
import { QuidResult } from "@/lib/quid-calculator";
import { generateProjectPDF } from "@/lib/pdf-generator";
import { RecipeComparison } from "@/components/recipe-comparison";
import { ProcessComparison } from "@/components/process-comparison";

// --- Types ---
type ProjectStatus = "development" | "validation" | "production" | "archived";

interface TimelineEvent {
  id: number;
  type: "milestone" | "recipe" | "email" | "parameter" | "file" | "note";
  title: string;
  date: string;
  status: "completed" | "received" | "ok" | "pending";
  user?: string;
  attachment?: string;
  attachmentType?: string;
  attachmentContent?: string;
}

interface Sensory {
  appearance?: string;
  odor?: string;
  taste?: string;
  texture?: string;
  dimensions?: {
    length?: string;
    diameter?: string;
    weight?: string;
  };
  preparation?: string;
}

interface Checklist {
  articleCreated: boolean;
  recipeCreated: boolean;
  labelCreated: boolean;
  nutritionCreated: boolean;
  specCreated: boolean;
  processCreated: boolean;
  navisionCreated: boolean;
}

interface Project {
  id: string;
  name: string;
  articleNumber?: string;
  status: ProjectStatus;
  customer?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
  currentRecipe?: SavedRecipe;
  latestResult?: QuidResult;
  processFlow?: string;
  isNewProcess?: boolean;
  riskAnalysis?: string;
  fmeaData?: FmeaData;
  sensory?: Sensory;
  processSettings?: ProcessSettings;
  checklist?: Checklist;
  productIdea?: string;
  productImage?: string;
  customerAgreements?: string;
  notes?: string;
}

const STORAGE_KEY = "quid-projects-db-clean";
const FIRST_VISIT_KEY = "quid-first-visit-done";

// Flow Diagrams List
const FLOW_DIAGRAMS = [
  { id: "FD_001", label: "FD_001 Fließdiagramm Gewürze und Hilfsstoffe" },
  { id: "FD_002", label: "FD_002 Fließdiagramm Auftauen gefrorenes Fleisch" },
  { id: "FD_003", label: "FD_003 Fließdiagramm Fleischteilstücke" },
  { id: "FD_004", label: "FD_004 Fließdiagramm rohe Fleischprodukte" },
  { id: "FD_005", label: "FD_005 Fließdiagramm gegarte Fleischprodukte" },
  { id: "FD_006", label: "FD_006 Fließdiagramm Roh- und Kochpökelwaren" },
  { id: "FD_007", label: "FD_007 Fließdiagramm Brüh- und Kochwurst (Kaliberware)" },
  { id: "FD_008", label: "FD_008 Fließdiagramm geschnittene Wurst- und Bratenartikel" },
  { id: "FD_009", label: "FD_009 Fließdiagramm Bratstraßenartikel natur/grundgewürzt" },
  { id: "FD_010", label: "FD_010 Fließdiagramm Piccata" },
  { id: "FD_011", label: "FD_011 Fließdiagramm Bratstraßenartikel paniert" },
  { id: "FD_012", label: "FD_012 Fließdiagramm Bratstraßenartikel mariniert" },
  { id: "FD_013", label: "FD_013 Fließdiagramm Bratstraßenartikel gefüllt" },
  { id: "FD_014", label: "FD_014 Fließdiagramm Bratstraßenartikel gefüllt, paniert" },
  { id: "FD_015", label: "FD_015 Fließdiagramm Bratstraßenartikel belegt" },
  { id: "FD_016", label: "FD_016 Fließdiagramm Kochwurst Kaliberware" },
  { id: "FD_017", label: "FD_017 Fließdiagramm Handelsware" },
  { id: "FD_018", label: "FD_018 Fließdiagramm Suppen und Saucen" },
];

const DEFAULT_CHECKLIST: Checklist = {
  articleCreated: false,
  recipeCreated: false,
  labelCreated: false,
  nutritionCreated: false,
  specCreated: false,
  processCreated: false,
  navisionCreated: false,
};

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: React.ReactNode }> = {
  development: { label: "Entwicklung", color: "bg-blue-100 text-blue-800", icon: <Settings className="w-3 h-3" /> },
  validation: { label: "Validierung", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" /> },
  production: { label: "Produktion", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-3 h-3" /> },
  archived: { label: "Archiv", color: "bg-gray-100 text-gray-600", icon: <Archive className="w-3 h-3" /> },
};

// --- Helper Functions ---
function loadProjects(): Project[] {
  try {
    const data = getData(STORAGE_KEY);
    return data || [];
  } catch { return []; }
}

function saveProjects(projects: Project[]) {
  setData(STORAGE_KEY, projects);
  window.dispatchEvent(new Event("projects-storage-update"));
}

function createNewProject(name: string, customer?: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    status: "development",
    customer: customer || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [{
      id: 1,
      type: "milestone",
      title: "Projekt erstellt",
      date: new Date().toISOString(),
      status: "completed",
      user: "System",
    }],
    checklist: { ...DEFAULT_CHECKLIST },
  };
}

// --- Main Component ---
export default function ProductDashboard() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [showLanding, setShowLanding] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Snapshot comparison state
  const [showRecipeComparison, setShowRecipeComparison] = useState(false);
  const [comparisonRecipes, setComparisonRecipes] = useState<{ old: SavedRecipe; new: SavedRecipe } | null>(null);
  const [showProcessComparison, setShowProcessComparison] = useState(false);
  const [comparisonProcess, setComparisonProcess] = useState<{ old: ProcessSettings; new: ProcessSettings } | null>(null);

  // Load projects on mount
  useEffect(() => {
    const loaded = loadProjects();
    setProjects(loaded);
    
    const firstVisitDone = getItem(FIRST_VISIT_KEY);
    if (!firstVisitDone && loaded.length === 0) {
      setShowLanding(true);
    }
  }, []);

  // Listen for external storage changes
  useEffect(() => {
    const handler = () => setProjects(loadProjects());
    window.addEventListener("projects-storage-update", handler);
    return () => window.removeEventListener("projects-storage-update", handler);
  }, []);

  const handleLandingStart = () => {
    setItem(FIRST_VISIT_KEY, "true");
    setShowLanding(false);
  };

  const handleLandingImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Import is handled by DataManagement component
    setItem(FIRST_VISIT_KEY, "true");
    setShowLanding(false);
    setTimeout(() => setProjects(loadProjects()), 500);
  };

  // --- CRUD ---
  const updateProject = useCallback((updated: Project) => {
    updated.updatedAt = new Date().toISOString();
    setProjects(prev => {
      const next = prev.map(p => p.id === updated.id ? updated : p);
      saveProjects(next);
      return next;
    });
    setSelectedProject(updated);
  }, []);

  const handleCreateProject = () => {
    if (!newName.trim()) {
      toast({ title: "Fehler", description: "Bitte einen Projektnamen eingeben.", variant: "destructive" });
      return;
    }
    const p = createNewProject(newName.trim(), newCustomer.trim());
    const next = [...projects, p];
    saveProjects(next);
    setProjects(next);
    setNewName("");
    setNewCustomer("");
    setShowNewDialog(false);
    setSelectedProject(p);
    toast({ title: "Projekt erstellt", description: `"${p.name}" wurde angelegt.` });
  };

  const handleDeleteProject = (id: string) => {
    if (!confirm("Projekt wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return;
    const next = projects.filter(p => p.id !== id);
    saveProjects(next);
    setProjects(next);
    if (selectedProject?.id === id) setSelectedProject(null);
    toast({ title: "Gelöscht", variant: "destructive" });
  };

  const handleArchiveProject = (project: Project) => {
    const updated = { ...project, status: "archived" as ProjectStatus };
    addTimelineEvent(updated, "milestone", "Projekt archiviert");
    updateProject(updated);
    toast({ title: "Archiviert", description: `"${project.name}" wurde archiviert.` });
  };

  // --- Timeline ---
  const addTimelineEvent = (project: Project, type: TimelineEvent["type"], title: string) => {
    project.timeline = [
      ...project.timeline,
      {
        id: Date.now(),
        type,
        title,
        date: new Date().toISOString(),
        status: "completed",
        user: "Benutzer",
      },
    ];
  };

  // --- Recipe Save Handler ---
  const handleRecipeSave = (recipe: SavedRecipe, result: QuidResult | null, createSnapshot?: boolean) => {
    if (!selectedProject) return;
    const updated = { ...selectedProject };
    
    if (createSnapshot && updated.currentRecipe) {
      addTimelineEvent(updated, "recipe", `Rezeptur-Snapshot: ${recipe.name}`);
    }
    
    updated.currentRecipe = recipe;
    if (result) updated.latestResult = result;
    updated.checklist = { ...(updated.checklist || DEFAULT_CHECKLIST), recipeCreated: true };
    updateProject(updated);
    toast({ title: "Rezeptur gespeichert" });
  };

  // --- Process Settings Save Handler ---
  const handleProcessSave = (settings: ProcessSettings, note: string) => {
    if (!selectedProject) return;
    const updated = { ...selectedProject };
    
    if (updated.processSettings) {
      addTimelineEvent(updated, "parameter", `Parameter aktualisiert: ${note || "Änderung"}`);
    }
    
    updated.processSettings = settings;
    updated.checklist = { ...(updated.checklist || DEFAULT_CHECKLIST), processCreated: true };
    updateProject(updated);
    toast({ title: "Prozess-Parameter gespeichert" });
  };

  // --- FMEA Save Handler ---
  const handleFmeaSave = (data: FmeaData) => {
    if (!selectedProject) return;
    const updated = { ...selectedProject };
    updated.fmeaData = data;
    addTimelineEvent(updated, "milestone", "FMEA aktualisiert");
    updateProject(updated);
    toast({ title: "FMEA gespeichert" });
  };

  // --- Filter & Search ---
  const filteredProjects = projects.filter(p => {
    const matchesSearch = !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.articleNumber && p.articleNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.customer && p.customer.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // --- Landing Page ---
  if (showLanding) {
    return <LandingPage onStart={handleLandingStart} onImportBackup={handleLandingImport} />;
  }

  // --- Project Detail View ---
  if (selectedProject) {
    const project = selectedProject;
    const checklist = project.checklist || DEFAULT_CHECKLIST;
    const checklistTotal = Object.values(checklist).filter(Boolean).length;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b bg-background">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedProject(null); setActiveTab("overview"); }}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold truncate">{project.name}</h1>
              <Badge className={STATUS_CONFIG[project.status].color}>
                {STATUS_CONFIG[project.status].label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {project.articleNumber && `Art.Nr.: ${project.articleNumber} · `}
              {project.customer && `${project.customer} · `}
              Checkliste: {checklistTotal}/7
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => generateProjectPDF(project as any)}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Select value={project.status} onValueChange={(val) => {
              const updated = { ...project, status: val as ProjectStatus };
              addTimelineEvent(updated, "milestone", `Status → ${STATUS_CONFIG[val as ProjectStatus].label}`);
              updateProject(updated);
            }}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Entwicklung</SelectItem>
                <SelectItem value="validation">Validierung</SelectItem>
                <SelectItem value="production">Produktion</SelectItem>
                <SelectItem value="archived">Archiv</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-2 w-fit">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="recipe">Rezeptur</TabsTrigger>
            <TabsTrigger value="process">Prozess</TabsTrigger>
            <TabsTrigger value="fmea">FMEA</TabsTrigger>
            <TabsTrigger value="sensory">Sensorik</TabsTrigger>
            <TabsTrigger value="timeline">Verlauf</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Stammdaten */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Stammdaten</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label>Projektname</Label>
                      <Input value={project.name} onChange={e => updateProject({ ...project, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Artikelnummer</Label>
                      <Input value={project.articleNumber || ""} onChange={e => updateProject({ ...project, articleNumber: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Kunde</Label>
                      <Input value={project.customer || ""} onChange={e => updateProject({ ...project, customer: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Standard-Fließdiagramm</Label>
                      <Select value={project.processFlow || ""} onValueChange={val => updateProject({ ...project, processFlow: val })}>
                        <SelectTrigger><SelectValue placeholder="Auswählen..." /></SelectTrigger>
                        <SelectContent>
                          {FLOW_DIAGRAMS.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch checked={project.isNewProcess || false} onCheckedChange={v => updateProject({ ...project, isNewProcess: v })} />
                      <Label>Neuer Prozess (FMEA erforderlich)</Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Checklist */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Checkliste ({checklistTotal}/7)</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { key: "articleCreated", label: "Artikelanlage" },
                      { key: "recipeCreated", label: "Rezeptur erstellt" },
                      { key: "labelCreated", label: "Etikett / Deklaration" },
                      { key: "nutritionCreated", label: "Nährwerte berechnet" },
                      { key: "specCreated", label: "Spezifikation erstellt" },
                      { key: "processCreated", label: "Prozessparameter definiert" },
                      { key: "navisionCreated", label: "Navision / ERP angelegt" },
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-2">
                        <Switch
                          checked={(checklist as any)[item.key] || false}
                          onCheckedChange={(v) => {
                            const updated = { ...project, checklist: { ...checklist, [item.key]: v } };
                            updateProject(updated);
                          }}
                        />
                        <span className="text-sm">{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Produktidee */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Produktidee</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Beschreibung der Produktidee..."
                      value={project.productIdea || ""}
                      onChange={e => updateProject({ ...project, productIdea: e.target.value })}
                      rows={4}
                    />
                  </CardContent>
                </Card>

                {/* Kundenabsprachen */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Kundenabsprachen</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Vereinbarungen mit dem Kunden..."
                      value={project.customerAgreements || ""}
                      onChange={e => updateProject({ ...project, customerAgreements: e.target.value })}
                      rows={4}
                    />
                  </CardContent>
                </Card>

                {/* Notizen */}
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-base">Notizen</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Interne Notizen..."
                      value={project.notes || ""}
                      onChange={e => updateProject({ ...project, notes: e.target.value })}
                      rows={3}
                    />
                  </CardContent>
                </Card>

                {/* Quick Result Summary */}
                {project.latestResult && (
                  <Card className="lg:col-span-2 border-primary/30">
                    <CardHeader><CardTitle className="text-base">Letztes QUID-Ergebnis</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">{project.latestResult.totalRawMass.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">Rohmasse (kg)</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">{project.latestResult.totalEndWeight.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">Endgewicht (kg)</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">{project.latestResult.meatPercentage.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">Fleischanteil</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">{project.latestResult.ingredients.length}</div>
                          <div className="text-xs text-muted-foreground">Zutaten</div>
                        </div>
                      </div>
                      {project.latestResult.warnings.length > 0 && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          {project.latestResult.warnings.length} Hinweis(e)
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* RECIPE TAB */}
            <TabsContent value="recipe" className="p-4">
              <ProjectRecipeEditor
                initialRecipe={project.currentRecipe}
                onSave={handleRecipeSave}
                autoSave={true}
                onResultChange={(result) => {
                  if (result && selectedProject) {
                    const updated = { ...selectedProject, latestResult: result };
                    setSelectedProject(updated);
                  }
                }}
                mode="project"
              />
            </TabsContent>

            {/* PROCESS TAB */}
            <TabsContent value="process" className="p-4">
              <ProcessParametersEditor
                initialSettings={project.processSettings}
                onSave={handleProcessSave}
                productName={project.name}
                articleNumber={project.articleNumber}
              />
            </TabsContent>

            {/* FMEA TAB */}
            <TabsContent value="fmea" className="p-4">
              {project.isNewProcess ? (
                <FmeaEditor
                  initialData={project.fmeaData}
                  onSave={handleFmeaSave}
                  productName={project.name}
                  articleNumber={project.articleNumber}
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">FMEA nicht erforderlich</p>
                    <p className="text-sm mt-1">Aktivieren Sie &quot;Neuer Prozess&quot; in der Übersicht, um eine FMEA anzulegen.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* SENSORY TAB */}
            <TabsContent value="sensory" className="p-4">
              <Card>
                <CardHeader><CardTitle>Sensorische Eigenschaften</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Aussehen</Label>
                      <Textarea
                        value={project.sensory?.appearance || ""}
                        onChange={e => updateProject({
                          ...project,
                          sensory: { ...project.sensory, appearance: e.target.value }
                        })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Geruch</Label>
                      <Textarea
                        value={project.sensory?.odor || ""}
                        onChange={e => updateProject({
                          ...project,
                          sensory: { ...project.sensory, odor: e.target.value }
                        })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Geschmack</Label>
                      <Textarea
                        value={project.sensory?.taste || ""}
                        onChange={e => updateProject({
                          ...project,
                          sensory: { ...project.sensory, taste: e.target.value }
                        })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Textur</Label>
                      <Textarea
                        value={project.sensory?.texture || ""}
                        onChange={e => updateProject({
                          ...project,
                          sensory: { ...project.sensory, texture: e.target.value }
                        })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label>Länge / Breite</Label>
                      <Input
                        value={project.sensory?.dimensions?.length || ""}
                        onChange={e => updateProject({
                          ...project,
                          sensory: {
                            ...project.sensory,
                            dimensions: { ...project.sensory?.dimensions, length: e.target.value }
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Kaliber</Label>
                      <Input
                        value={project.sensory?.dimensions?.diameter || ""}
                        onChange={e => updateProject({
                          ...project,
                          sensory: {
                            ...project.sensory,
                            dimensions: { ...project.sensory?.dimensions, diameter: e.target.value }
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Gewicht</Label>
                      <Input
                        value={project.sensory?.dimensions?.weight || ""}
                        onChange={e => updateProject({
                          ...project,
                          sensory: {
                            ...project.sensory,
                            dimensions: { ...project.sensory?.dimensions, weight: e.target.value }
                          }
                        })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Zubereitungsempfehlung</Label>
                    <Textarea
                      value={project.sensory?.preparation || ""}
                      onChange={e => updateProject({
                        ...project,
                        sensory: { ...project.sensory, preparation: e.target.value }
                      })}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TIMELINE TAB */}
            <TabsContent value="timeline" className="p-4">
              <Card>
                <CardHeader>
                  <CardTitle>Projekt-Verlauf ({project.timeline.length} Einträge)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...project.timeline].reverse().map(event => (
                      <div key={event.id} className="flex gap-3 items-start p-2 rounded hover:bg-muted/50">
                        <div className="mt-1">
                          {event.type === "milestone" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          {event.type === "recipe" && <ChefHat className="w-4 h-4 text-blue-500" />}
                          {event.type === "parameter" && <Settings className="w-4 h-4 text-orange-500" />}
                          {event.type === "file" && <FileText className="w-4 h-4 text-purple-500" />}
                          {event.type === "note" && <Clipboard className="w-4 h-4 text-gray-500" />}
                          {event.type === "email" && <FileText className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleString("de-DE")}
                            {event.user && ` · ${event.user}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Recipe Comparison Dialog */}
        {showRecipeComparison && comparisonRecipes && (
          <RecipeComparison
            oldRecipe={comparisonRecipes.old}
            newRecipe={comparisonRecipes.new}
            onClose={() => setShowRecipeComparison(false)}
          />
        )}

        {/* Process Comparison Dialog */}
        {showProcessComparison && comparisonProcess && (
          <ProcessComparison
            oldProcess={comparisonProcess.old}
            newProcess={comparisonProcess.new}
            onClose={() => setShowProcessComparison(false)}
          />
        )}
      </div>
    );
  }

  // --- Project List View ---
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" /> Produkt Dashboard
          </h1>
          <div className="flex gap-2">
            <DataManagement />
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Neues Projekt</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neues Projekt anlegen</DialogTitle>
                  <DialogDescription>Erstellen Sie ein neues Produktentwicklungs-Projekt.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <Label>Projektname *</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Schweineschnitzel paniert" autoFocus />
                  </div>
                  <div className="space-y-1">
                    <Label>Kunde (optional)</Label>
                    <Input value={newCustomer} onChange={e => setNewCustomer(e.target.value)} placeholder="z.B. Firma XY" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewDialog(false)}>Abbrechen</Button>
                  <Button onClick={handleCreateProject}>Erstellen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Art.Nr., Kunde..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="development">Entwicklung</SelectItem>
              <SelectItem value="validation">Validierung</SelectItem>
              <SelectItem value="production">Produktion</SelectItem>
              <SelectItem value="archived">Archiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Project Grid */}
      <ScrollArea className="flex-1 p-4">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Keine Projekte gefunden</p>
            <p className="text-sm mt-1">Erstellen Sie ein neues Projekt um loszulegen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredProjects.map(project => {
              const checklist = project.checklist || DEFAULT_CHECKLIST;
              const checkDone = Object.values(checklist).filter(Boolean).length;
              return (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedProject(project)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm truncate">{project.name}</CardTitle>
                        <CardDescription className="truncate">
                          {project.articleNumber && `${project.articleNumber} · `}
                          {project.customer || "Kein Kunde"}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); generateProjectPDF(project as any); }}>
                            <Download className="w-4 h-4 mr-2" /> PDF exportieren
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchiveProject(project); }}>
                            <Archive className="w-4 h-4 mr-2" /> Archivieren
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Badge variant="outline" className={`${STATUS_CONFIG[project.status].color} text-xs`}>
                        {STATUS_CONFIG[project.status].label}
                      </Badge>
                      <span>{checkDone}/7 erledigt</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Aktualisiert: {new Date(project.updatedAt).toLocaleDateString("de-DE")}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
