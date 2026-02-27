import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitBranch, CheckCircle2, XCircle, HelpCircle, ArrowRight, ArrowDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import decisionTreeImage from "@assets/image_1771493134781.png";

export function FmeaDecisionTreeDialog() {
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
                
                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="flex flex-col items-center py-8">
                        <div className="bg-white p-4 rounded-lg shadow-sm border max-w-full">
                            <img 
                                src={decisionTreeImage} 
                                alt="FMEA Entscheidungsbaum" 
                                className="max-w-full h-auto object-contain"
                            />
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
