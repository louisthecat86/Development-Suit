import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

// Define interfaces to match those in product-dashboard.tsx
interface Project {
    id: string;
    name: string;
    articleNumber?: string;
    status: string;
    customer?: string;
    createdAt: string;
    updatedAt: string;
    timeline: any[];
    currentRecipe?: any; 
    latestResult?: any;
    processFlow?: string;
    isNewProcess?: boolean;
    riskAnalysis?: string;
    fmeaData?: any;
    sensory?: {
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
    };
    processSettings?: any; // Added
    checklist?: any; // Added
    productIdea?: string; // Added
    productImage?: string; // Added
    customerAgreements?: string; // Added
    notes?: string;
}

export const generateProjectPDF = (project: Project) => {
    const doc = new jsPDF();
    const primaryColor = [41, 128, 185]; // Blue
    const secondaryColor = [100, 100, 100]; // Grey
    
    // Helper for Page Numbers
    const totalPagesExp = "{total_pages_count_string}";
    
    // Helper to add header to each page
    const addHeader = (pageTitle: string) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Stripe
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 20, 'F');
        
        // Title
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(pageTitle, 14, 13);
        
        // Project Info Small - Truncated
        const maxHeaderTitleLen = 40;
        let headerTitle = project.name;
        if (headerTitle.length > maxHeaderTitleLen) {
            headerTitle = headerTitle.substring(0, maxHeaderTitleLen) + "...";
        }

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`${headerTitle} | ${format(new Date(), "dd.MM.yyyy")}`, pageWidth - 14, 13, { align: "right" });
        
        // Reset Text Color
        doc.setTextColor(0, 0, 0);
        return 30; // Start Y for content
    };

    // --- PAGE 1: STAMMDATEN & BESCHREIBUNG ---
    let yPos = addHeader("Projekt-Report");
    
    // Project Title & Basic Info Block
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    
    // Wrap Title if too long
    const splitTitle = doc.splitTextToSize(project.name, 120);
    doc.text(splitTitle, 14, yPos + 5);
    
    yPos += (splitTitle.length * 8) + 10;
    
    // Image Box Logic
    const boxX = 146; // Right aligned
    const boxY = 35;  // Fixed Y position for image
    const boxW = 50;
    const boxH = 50;
    
    // Attempt to find image from Timeline if not explicit
    let displayImage = project.productImage;
    if (!displayImage && project.timeline) {
        const imageEvents = project.timeline.filter((e: any) => 
            e.type === 'file' && 
            e.attachmentContent && 
            (
                (e.attachmentType && e.attachmentType.startsWith('image/')) || 
                (e.attachment && /\.(jpg|jpeg|png|webp)$/i.test(e.attachment))
            )
        );
        
        if (imageEvents.length > 0) {
             // Get latest by ID
             const latest = imageEvents.sort((a: any, b: any) => b.id - a.id)[0];
             displayImage = latest.attachmentContent;
        }
    }
    
    // Draw Image Frame
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    
    if (displayImage) {
        try {
            const imgData = displayImage;
            let format = 'JPEG';
            if (imgData.startsWith('data:image/png')) {
                format = 'PNG';
            } else if (imgData.startsWith('data:image/webp')) {
                format = 'WEBP';
            }

            const imgProps = doc.getImageProperties(imgData);
            
            // Fit image in box
            let w = imgProps.width;
            let h = imgProps.height;
            const ratio = w / h;
            
            let finalW = boxW;
            let finalH = finalW / ratio;
            
            if (finalH > boxH) {
                finalH = boxH;
                finalW = finalH * ratio;
            }
            
            // Center in box
            const x = boxX + (boxW - finalW) / 2;
            const y = boxY + (boxH - finalH) / 2;
            
            doc.addImage(imgData, format, x, y, finalW, finalH);
            doc.rect(boxX, boxY, boxW, boxH);
            
        } catch(e) {
            console.error("PDF Image Error", e);
            // Fallback if image fails
            doc.rect(boxX, boxY, boxW, boxH);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("Fehler beim Laden", boxX + boxW/2, boxY + boxH/2, { align: 'center', baseline: 'middle' });
        }
    } else {
        doc.rect(boxX, boxY, boxW, boxH);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Kein Bild", boxX + boxW/2, boxY + boxH/2, { align: 'center', baseline: 'middle' });
    }
    
    // Metadata Table (Left Side)
    const metaData = [
        ['Artikelnummer', project.articleNumber || "-"],
        ['Kunde', project.customer || "Allgemein"],
        ['Status', project.status],
        ['Erstellt am', format(new Date(project.createdAt), "dd.MM.yyyy")],
        ['Bearbeitet am', format(new Date(project.updatedAt), "dd.MM.yyyy")],
        ['Version', project.timeline ? (project.timeline.length + 1).toString() : "1"]
    ];

    autoTable(doc, {
        startY: yPos,
        body: metaData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', width: 35 },
            1: { width: 85 }
        },
        margin: { right: 70 } // Avoid image area
    });
    
    // @ts-ignore
    let tableEnd = doc.lastAutoTable.finalY;
    yPos = Math.max(tableEnd, boxY + boxH) + 10;
    
    // Idea & Agreements
    if (project.productIdea || project.customerAgreements) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Produktbeschreibung", 14, yPos);
        yPos += 6;
        
        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPos, 196, yPos);
        yPos += 5;

        if (project.productIdea) {
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("Produktidee:", 14, yPos);
            doc.setFont("helvetica", "normal");
            yPos += 5;
            
            doc.setFontSize(10);
            const splitIdea = doc.splitTextToSize(project.productIdea, 180);
            doc.text(splitIdea, 14, yPos);
            yPos += (splitIdea.length * 5) + 5;
        }

        if (project.customerAgreements) {
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("Kundenabsprachen:", 14, yPos);
            doc.setFont("helvetica", "normal");
            yPos += 5;
            
            doc.setFontSize(10);
            const splitAgreements = doc.splitTextToSize(project.customerAgreements, 180);
            doc.text(splitAgreements, 14, yPos);
            yPos += (splitAgreements.length * 5) + 5;
        }
        yPos += 5;
    }

    // Sensory (Page 2)
    if (project.sensory) {
        doc.addPage();
        yPos = addHeader("Sensorik & Eigenschaften");
        yPos += 5;

        const sensoryData = [];
        if(project.sensory.appearance) sensoryData.push(["Aussehen", project.sensory.appearance]);
        if(project.sensory.odor) sensoryData.push(["Geruch", project.sensory.odor]);
        if(project.sensory.taste) sensoryData.push(["Geschmack", project.sensory.taste]);
        if(project.sensory.texture) sensoryData.push(["Textur", project.sensory.texture]);
        
        // Dimensions
        if(project.sensory.dimensions) {
             const dims = [];
             if(project.sensory.dimensions.length) dims.push(`Länge/Breite: ${project.sensory.dimensions.length}`);
             if(project.sensory.dimensions.diameter) dims.push(`Kaliber: ${project.sensory.dimensions.diameter}`);
             if(project.sensory.dimensions.weight) dims.push(`Gewicht: ${project.sensory.dimensions.weight}`);
             if(dims.length > 0) sensoryData.push(["Abmessungen", dims.join(", ")]);
        }

        if (sensoryData.length > 0) {
            autoTable(doc, {
                startY: yPos,
                head: [['Parameter', 'Beschreibung']],
                body: sensoryData,
                theme: 'grid',
                headStyles: { fillColor: [255, 193, 7], textColor: 0 }, // Amber
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: { 0: { width: 40, fontStyle: 'bold' } }
            });
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 10;
        }
        
        if (project.sensory.preparation) {
            // Check space
            if (yPos > 250) {
                 doc.addPage();
                 yPos = addHeader("Zubereitung");
            }

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("Zubereitungsempfehlung:", 14, yPos);
            doc.setFont("helvetica", "normal");
            yPos += 5;
            
            doc.setFontSize(10);
            const splitPrep = doc.splitTextToSize(project.sensory.preparation, 180);
            doc.text(splitPrep, 14, yPos);
        }
    }

    // --- PAGE 3: REZEPTUR ---
    if (project.currentRecipe && project.currentRecipe.ingredients && project.currentRecipe.ingredients.length > 0) {
        doc.addPage();
        yPos = addHeader("Aktuelle Rezeptur");

        const tableData = project.currentRecipe.ingredients.map((ing: any) => [
            ing.name,
            ing.articleNumber || "-",
            `${ing.rawWeight.toFixed(3)} kg`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Zutat', 'Art.Nr.', 'Menge']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: { 
                0: { width: 100 },
                2: { halign: 'right' }
            }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 10;
        
        // Sums
        if (project.latestResult) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Gesamt-Rohmasse: ${project.latestResult.totalRawMass.toFixed(3)} kg`, 14, yPos);
            doc.text(`Endgewicht: ${project.latestResult.totalEndWeight.toFixed(3)} kg`, 14, yPos + 5);
            
            if (project.currentRecipe.cookingLoss > 0) {
                 // Highlight Cooking Loss
                 doc.setTextColor(255, 0, 0); // Red highlight for importance
                 doc.text(`Garverlust: ${project.currentRecipe.cookingLoss}%`, 100, yPos);
                 doc.setTextColor(0, 0, 0); // Reset
            }
        }
    }

    // --- PAGE 4: QUID & DEKLARATION ---
    if (project.latestResult) {
        doc.addPage();
        yPos = addHeader("Deklaration & Nährwerte");

        // Deklaration
        if (project.latestResult.labelText) {
            doc.setFontSize(12);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text("Zutatenliste (Entwurf)", 14, yPos);
            yPos += 7;
            
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "italic");
            
            // Draw a box around label text
            const splitText = doc.splitTextToSize(project.latestResult.labelText, 170);
            const boxHeight = (splitText.length * 5) + 10;
            
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(250, 250, 250);
            doc.rect(14, yPos, 180, boxHeight, 'FD');
            
            doc.text(splitText, 19, yPos + 7);
            yPos += boxHeight + 15;
            doc.setFont("helvetica", "normal");
        }

        // Nutrition Table
        if (project.latestResult.nutritionPer100g) {
            doc.setFontSize(12);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text("Nährwerte (pro 100g)", 14, yPos);
            yPos += 5;
            
            const nutri = project.latestResult.nutritionPer100g;
            const nutriData = [
                ['Energie', `${Math.round(nutri.energyKj)} kJ / ${Math.round(nutri.energyKcal)} kcal`],
                ['Fett', `${nutri.fat.toFixed(1)} g`],
                ['  davon gesättigte Fettsäuren', `${nutri.saturatedFat.toFixed(1)} g`],
                ['Kohlenhydrate', `${nutri.carbohydrates.toFixed(1)} g`],
                ['  davon Zucker', `${nutri.sugar.toFixed(1)} g`],
                ['Eiweiß', `${nutri.protein.toFixed(1)} g`],
                ['Salz', `${nutri.salt.toFixed(2)} g`],
                // Tech Data Section
                [{ content: 'Technische Werte', colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'italic' } }],
                ['Wasser (kalkulatorisch)', `${(nutri.water || 0).toFixed(1)} g`],
                ['Fleischanteil (QUID)', `${(project.latestResult.meatPercentage || 0).toFixed(1)} %`]
            ];

            autoTable(doc, {
                startY: yPos,
                head: [['Parameter', 'Wert']],
                body: nutriData,
                theme: 'grid',
                headStyles: { fillColor: [50, 50, 50] },
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: { 0: { width: 100 } },
                alternateRowStyles: { fillColor: [255, 255, 255] }
            });
        }
    }

    // --- PAGE 5: PROZESS-PARAMETER ---
    if (project.processSettings) {
        doc.addPage();
        yPos = addHeader("Prozess-Parameter");

        doc.setFontSize(12);
        doc.text(`Version: ${project.processSettings.version || "1.0"}`, 14, yPos);
        yPos += 10;
        
        // Flow Diagram Info
         if (project.processFlow) {
             // Map ID to Label
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
                { id: "FD_019", label: "FD_019 Fließdiagramm Zollware Bratstraßenartikel" },
                { id: "FD_020", label: "FD_020 Fließdiagramm Bratstraßenartikel gebraten Kruste" },
                { id: "FD_021", label: "FD_021 Fließdiagramm Gefüllte Paprika" },
                { id: "FD_022", label: "FD_022 Fließdiagramm Brühwürstchen" },
                { id: "FD_023", label: "FD_023 Fließdiagramm Krautwickel TK" },
                { id: "FD_024", label: "FD_024 Fließdiagramm Sous vide gegarte Fleischware" },
                { id: "FD_025", label: "FD_025 Fließdiagramm Vegetarische Artikel paniert roh, TK" },
                { id: "FD_026", label: "FD_026 Fließdiagramm Vegetarisch Taler/ Bällchen roh, TK" },
                { id: "FD_027", label: "FD_027 Fließdiagramm Vegetarisch Taler/ Bällchen paniert, roh, TK" },
                { id: "FD_028", label: "FD_028 Fließdiagramm Sülze, Kaliberware" },
                { id: "FD_029", label: "FD_029 Fließdiagramm gekochte Fleischartikel geschnitten TK" },
                { id: "FD_030", label: "FD_030 Fließdiagramm Vegetarische Artikel mit Topping, roh, TK" },
                { id: "FD_031", label: "FD_031 Fließdiagramm Vegetarische Artikel mariniert, roh, TK" },
                { id: "FD_032", label: "FD_032 Fließdiagramm Kommissionierung" },
                { id: "FD_033", label: "FD_033 Fließdiagramm Fleischkäse" },
                { id: "FD_034", label: "FD_034 Fließdiagramm Zukaufware Spieße gebraten" },
                { id: "FD_035", label: "FD_035 Fließdiagramm Vegetarisches Produkt in Form gegart, TK" },
                { id: "FD_036", label: "FD_036 Fließdiagramm Brühwurst geschnitten, gebraten, TK" },
                { id: "FD_037", label: "FD_037 Fließdiagramm Rohe Wurst TK" },
                { id: "FD_038", label: "FD_038 Fließdiagramm Brühwurst in geschnittene Kaliberware gewickelt" },
                { id: "FD_039", label: "FD_039 Fließdiagramm Teilstücke gebräunt, sous vide gegart" },
                { id: "FD_040", label: "FD_040 Fließdiagramm Gefüllte Paprika gegart" },
                { id: "FD_042", label: "FD_042 Fließdiagramm Rohpökelwaren (mit Ummantelung) Stückware" },
                { id: "FD_043", label: "FD_043 Fließdiagramm Vegetarische Bällchen-Taler, gebraten-gegart" },
                { id: "FD_044", label: "FD_044 Fließdiagramm Rohwurst kaltgeräuchert frisch/TK" },
                { id: "FD_045", label: "FD_045 Wareneingang und Kühllagerung" },
                { id: "FD_046", label: "FD_046 Fließdiagramm Bratstraßenartikel gewolft" },
                { id: "FD_047", label: "FD_047 Teilstücke gebräunt, sous vide gegart, gesiebt" },
                { id: "FD_048", label: "FD_048 Vegetarisches Produkt geschnitten" },
                { id: "FD_049", label: "FD_049 Nachpasteurisierung verzehrfertiger Produkte" }
             ];
             
             // Check if custom flows are stored in localStorage - tricky in PDF generator which might run in different context?
             // But this runs on client, so localStorage is available.
             let allFlows = [...FLOW_DIAGRAMS];
             try {
                 const customFlows = localStorage.getItem("quid-custom-flows");
                 if (customFlows) {
                     allFlows = [...allFlows, ...JSON.parse(customFlows)];
                 }
             } catch(e) { console.error(e); }

             const flowObj = allFlows.find(f => f.id === project.processFlow);
             const flowLabel = flowObj ? flowObj.label : project.processFlow;

             doc.setFontSize(10);
             doc.text(`Standard-Fließdiagramm: ${flowLabel}`, 14, yPos);
             yPos += 8;
        }

        if (project.processSettings.sections) {
            const processData: any[][] = [];
            project.processSettings.sections.forEach((section: any) => {
                 // Removed strict filter to show more fields even if they seem empty, but not completely null/undefined
                 // Show fields that have a value OR are of type that might be relevant even if empty-ish (though table needs content)
                 // Let's filter only strictly empty or dash
                 const validFields = section.fields.filter((f: any) => {
                     if (f.value === undefined || f.value === null) return false;
                     const val = String(f.value).trim();
                     return val !== ""; // Show everything except empty string. Show "0", "-", etc.
                 });

                 if (validFields.length > 0) {
                     processData.push([{ content: section.title, colSpan: 2, styles: { fillColor: [230, 230, 230], fontStyle: 'bold', textColor: 0 } }]);
                     validFields.forEach((field: any) => {
                         processData.push([field.label, field.value]);
                     });
                 }
            });

            if (processData.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    head: [['Parameter', 'Wert']],
                    body: processData,
                    theme: 'grid',
                    headStyles: { fillColor: [100, 100, 100] },
                    styles: { fontSize: 10, cellPadding: 3 },
                    columnStyles: { 0: { width: 80 } }
                });
            }
        } else {
            // Legacy Fallback
            const settings = project.processSettings;
            const processData = [
                ['Kutter-Temperatur', `${settings.cutterTemperature || "-"} °C`],
                ['Füll-Temperatur', `${settings.fillingTemperature || "-"} °C`],
                ['Darm-Kaliber', `${settings.casingCaliber || "-"}`],
                ['Rauch-Programm', settings.smokingProgram || "-"],
                ['Kerntemperatur', `${settings.coreTemperature || "-"} °C`],
                ['Kammer', settings.chamberId || "-"]
            ];
            autoTable(doc, {
                startY: yPos,
                head: [['Parameter', 'Wert']],
                body: processData,
                theme: 'grid',
                headStyles: { fillColor: [100, 100, 100] },
            });
        }
    }

    // --- PAGE 6: FMEA (If applicable) ---
    if ((project.riskAnalysis || (project.fmeaData && project.fmeaData.hazards && project.fmeaData.hazards.length > 0)) && project.isNewProcess) {
        doc.addPage();
        yPos = addHeader("Risikoanalyse (FMEA)");
        
        if (project.fmeaData && project.fmeaData.hazards && project.fmeaData.hazards.length > 0) {
            const hazards = project.fmeaData.hazards.map((h: any) => [
                h.hazard,
                h.category,
                h.severity,
                h.occurrence,
                h.severity * h.occurrence,
                h.measures
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Gefährdung', 'Kat.', 'S', 'A', 'RPZ', 'Maßnahmen']],
                body: hazards,
                theme: 'grid',
                headStyles: { fillColor: [255, 237, 213], textColor: 0 }, // Orange
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: { 
                    0: { width: 50 },
                    5: { width: 60 }
                }
            });
            
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 15;

            // CCPs
            if (project.fmeaData.ccps && project.fmeaData.ccps.length > 0) {
                doc.setFontSize(12);
                doc.text("Entscheidungsbaum (CCP/CP)", 14, yPos);
                yPos += 5;

                const ccps = project.fmeaData.ccps.map((c: any) => [
                    c.step,
                    c.hazardType,
                    c.result,
                    c.controlMeasures
                ]);

                autoTable(doc, {
                    startY: yPos,
                    head: [['Schritt', 'Gefahr', 'Typ', 'Lenkungsmaßnahme']],
                    body: ccps,
                    theme: 'grid',
                    headStyles: { fillColor: [254, 226, 226], textColor: 0 }, // Red
                    styles: { fontSize: 8 }
                });
            }
        }
    }

    // --- PAGE 7: TIMELINE & STATUS ---
    doc.addPage();
    yPos = addHeader("Projekt-Verlauf");

    const timelineData = project.timeline.map((event: any) => [
        event.date,
        event.type.toUpperCase(),
        event.title,
        event.user
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [['Datum', 'Typ', 'Ereignis', 'Benutzer']],
        body: timelineData,
        theme: 'plain',
        headStyles: { fillColor: [220, 220, 220], textColor: 0 },
        styles: { fontSize: 9, cellPadding: 2 }
    });

    // Checklists (bottom of page or new page)
    // @ts-ignore
    yPos = doc.lastAutoTable.finalY + 20;
    
    if (project.checklist) {
         doc.setFontSize(12);
         doc.text("Checkliste Status", 14, yPos);
         yPos += 5;
         
         const checkData = [
            ['Artikelanlage', project.checklist.articleCreated ? 'Ja' : 'Nein'],
            ['Rezeptur', project.checklist.recipeCreated ? 'Ja' : 'Nein'],
            ['Etikett / Deklaration', project.checklist.labelCreated ? 'Ja' : 'Nein'],
            ['Nährwerte', project.checklist.nutritionCreated ? 'Ja' : 'Nein'],
            ['Spezifikation', project.checklist.specCreated ? 'Ja' : 'Nein'],
            ['Prozessparameter', project.checklist.processCreated ? 'Ja' : 'Nein'],
            ['Navision', project.checklist.navisionCreated ? 'Ja' : 'Nein'],
        ];
        
        autoTable(doc, {
            startY: yPos,
            head: [['Schritt', 'Erledigt']],
            body: checkData,
            theme: 'striped',
            headStyles: { fillColor: [50, 50, 50] },
            styles: { fontSize: 9 },
            columnStyles: { 0: { width: 100 } }
        });
    }


    // Footer Page Numbers
    const pageCount = doc.internal.pages.length - 1; // -1 because jspdf adds one empty? No, it's 1-based index?
    // Actually doc.internal.getNumberOfPages()
    const pageCountReal = (doc as any).internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCountReal; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Seite ${i} von ${pageCountReal}`, 196, 285, { align: "right" });
    }

    // Save
    doc.save(`${project.name.replace(/[^a-z0-9]/gi, '_')}_Report.pdf`);
};
