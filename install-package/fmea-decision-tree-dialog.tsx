import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitBranch, ImageOff, ZoomIn, ZoomOut } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import decisionTreeImage from "@assets/image_1771493134781.png";

export function FmeaDecisionTreeDialog() {
    const [imageError, setImageError] = useState(false);
    const [zoom, setZoom] = useState(1);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto gap-2">
                    <GitBranch className="w-4 h-4" />
                    Entscheidungsbaum Öffnen
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>FMEA Entscheidungsbaum (CCP-Ermittlung)</DialogTitle>
                    <DialogDescription>
                        Entscheidungslogik zur Ermittlung von kritischen Lenkungspunkten (CCPs).
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex items-center gap-2 border-b pb-2">
                    <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5}>
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
                    <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(3, z + 0.25))} disabled={zoom >= 3}>
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setZoom(1)} className="text-xs">
                        Zurücksetzen
                    </Button>
                </div>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="flex flex-col items-center py-8 overflow-auto">
                        {imageError ? (
                            <div className="bg-amber-50 p-8 rounded-lg border-2 border-amber-200 text-center max-w-md">
                                <ImageOff className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                                <h3 className="font-semibold text-amber-800 mb-2">Bild konnte nicht geladen werden</h3>
                                <p className="text-sm text-amber-700">
                                    Das Entscheidungsbaum-Bild wurde nicht gefunden. 
                                    Bitte stellen Sie sicher, dass die Bilddatei im 
                                    Ordner <code className="bg-amber-100 px-1 rounded">attached_assets/</code> vorhanden ist.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white p-4 rounded-lg shadow-sm border" style={{ maxWidth: `${zoom * 100}%`, minWidth: '300px' }}>
                                <img 
                                    src={decisionTreeImage} 
                                    alt="FMEA Entscheidungsbaum" 
                                    className="w-full h-auto object-contain"
                                    onError={() => setImageError(true)}
                                />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
