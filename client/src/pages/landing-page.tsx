import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, Play, Database, FolderOpen, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LandingPageProps {
    onStart: () => void;
    onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function LandingPage({ onStart, onImportBackup }: LandingPageProps) {
    const [animationState, setAnimationState] = useState<'initial' | 'fly-in' | 'options'>('initial');
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Start animation sequence
        setTimeout(() => setAnimationState('fly-in'), 100);
        setTimeout(() => setAnimationState('options'), 1500); // Show options after text settles
    }, []);

    const handleStartClick = () => {
        setAnimationState('initial'); // Hide options
        setIsLoading(true);
        
        // Simulate loading
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            setLoadingProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(onStart, 500);
            }
        }, 30);
    };

    const handleBackupClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setAnimationState('initial');
            setIsLoading(true);
            
            // Simulate loading before processing
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                setLoadingProgress(progress);
                if (progress >= 100) {
                    clearInterval(interval);
                    // Trigger actual import
                    onImportBackup(e);
                    // Wait a bit then start
                    setTimeout(onStart, 1000);
                }
            }, 50);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-sidebar overflow-hidden animate-in fade-in duration-1000">
            {/* Background elements if needed, but keeping it clean as requested */}
            
            {/* Main Text Animation */}
            <div className={`transition-all duration-1000 ease-out transform ${
                animationState === 'initial' ? 'scale-0 opacity-0' : 
                animationState === 'fly-in' ? 'scale-100 opacity-100 translate-y-0' : 
                'scale-125 opacity-100 -translate-y-24'
            }`}>
                <h1 className="text-6xl md:text-9xl font-bold tracking-tighter text-sidebar-foreground text-center drop-shadow-sm">
                    Development<br/>
                    <span className="text-primary">Suite</span>
                </h1>
            </div>

            {/* Options Container */}
            <div className={`absolute bottom-1/4 transition-all duration-700 transform flex flex-col gap-4 items-center ${
                animationState === 'options' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'
            }`}>
                <div className="flex gap-6">
                    <Button 
                        size="lg" 
                        className="h-16 px-8 text-lg gap-3 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white text-slate-800 hover:bg-slate-50 border-2 border-slate-200"
                        onClick={handleBackupClick}
                    >
                        <Upload className="w-6 h-6 text-slate-500" />
                        <div>
                            <div className="font-bold text-left">Backup laden</div>
                            <div className="text-xs text-slate-400 font-normal">.zip Datei importieren</div>
                        </div>
                    </Button>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept=".zip"
                        onChange={handleFileChange}
                    />

                    <Button 
                        size="lg" 
                        className="h-16 px-8 text-lg gap-3 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={handleStartClick}
                    >
                        <div>
                            <div className="font-bold text-left">Neu starten</div>
                            <div className="text-xs text-primary-foreground/70 font-normal">Dashboard öffnen</div>
                        </div>
                        <ArrowRight className="w-6 h-6" />
                    </Button>
                </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
                <div className="absolute bottom-1/3 w-96 max-w-[80vw] space-y-2 animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between text-sm text-slate-500 font-medium">
                        <span>System wird initialisiert...</span>
                        <span>{loadingProgress}%</span>
                    </div>
                    <Progress value={loadingProgress} className="h-2" />
                </div>
            )}
            
            <div className="absolute bottom-8 text-slate-300 text-sm">
                v2.4.0 • Enterprise Edition
            </div>
        </div>
    );
}
