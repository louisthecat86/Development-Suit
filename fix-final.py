#!/usr/bin/env python3
"""
fix-final.py — Definitive fix for DeepL persistence + FMEA Q&A display + PDF

Run from project root:
  cd /workspaces/Development-Suit
  python3 fix-final.py
"""
import sys, os

def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# ═══════════════════════════════════════════════════════════
# FIX 1: DeepL API Key — spec-generator.ts
# Problem: reads from sessionStorage which is cleared on restart
# Fix: read/write via electron-storage (getData/setData)
# ═══════════════════════════════════════════════════════════
print("═══ FIX 1: DeepL API Key Persistenz ═══")
sg_path = "client/src/lib/spec-generator.ts"
if not os.path.exists(sg_path):
    print(f"  ❌ {sg_path} nicht gefunden!")
    sys.exit(1)

sg = read(sg_path)

# Check current state
if 'getData(DEEPL_KEY_STORAGE)' in sg:
    print("  ✅ Bereits gefixt (getData wird benutzt)")
else:
    # Step 1: Add import (if missing)
    import_line = 'import { getData, setData } from "./electron-storage";'
    if import_line not in sg:
        # Insert after the last existing import line
        lines = sg.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_idx = i
        lines.insert(last_import_idx + 1, import_line)
        sg = '\n'.join(lines)
        print("  ✅ Import hinzugefügt: getData, setData")
    
    # Step 2: Replace getDeepLApiKey function
    old_get = '''export function getDeepLApiKey(): string | null {
  try {
    return sessionStorage.getItem(DEEPL_KEY_STORAGE) || localStorage.getItem(DEEPL_KEY_STORAGE);
  } catch { return null; }
}'''
    new_get = '''export function getDeepLApiKey(): string | null {
  try {
    // Primary: electron-storage (file-backed, survives restart)
    const stored = getData(DEEPL_KEY_STORAGE);
    if (stored) return typeof stored === "string" ? stored : String(stored);
    // Fallback: browser storage (dev mode)
    return sessionStorage.getItem(DEEPL_KEY_STORAGE) || localStorage.getItem(DEEPL_KEY_STORAGE);
  } catch { return null; }
}'''
    if old_get in sg:
        sg = sg.replace(old_get, new_get, 1)
        print("  ✅ getDeepLApiKey → liest aus electron-storage")
    else:
        print("  ❌ getDeepLApiKey Marker nicht gefunden!")
        print("     Bitte manuell prüfen.")
    
    # Step 3: Replace setDeepLApiKey function
    old_set = '''export function setDeepLApiKey(key: string): void {
  try {
    sessionStorage.setItem(DEEPL_KEY_STORAGE, key);
    localStorage.setItem(DEEPL_KEY_STORAGE, key);
  } catch { /* ignore */ }
}'''
    new_set = '''export function setDeepLApiKey(key: string): void {
  try {
    // Persist to disk via electron-storage (→ deepl-key.json)
    setData(DEEPL_KEY_STORAGE, key);
    sessionStorage.setItem(DEEPL_KEY_STORAGE, key);
    localStorage.setItem(DEEPL_KEY_STORAGE, key);
  } catch { /* ignore */ }
}'''
    if old_set in sg:
        sg = sg.replace(old_set, new_set, 1)
        print("  ✅ setDeepLApiKey → schreibt in electron-storage")
    else:
        print("  ❌ setDeepLApiKey Marker nicht gefunden!")
    
    write(sg_path, sg)
    print("  💾 spec-generator.ts gespeichert")


# ═══════════════════════════════════════════════════════════
# FIX 2: FMEA Editor — Fragen/Antworten IMMER sichtbar
# Problem: Details sind hinter Aufklapp-Pfeil versteckt,
#          und alte Einträge haben keine decisionDetails
# Fix: Q&A-Block direkt unter jeder CCP-Zeile rendern,
#      fehlende Details aus DECISION_TREE rekonstruieren
# ═══════════════════════════════════════════════════════════
print("\n═══ FIX 2: FMEA Q&A immer sichtbar ═══")
fe_path = "client/src/components/fmea-editor.tsx"
if not os.path.exists(fe_path):
    print(f"  ❌ {fe_path} nicht gefunden!")
    sys.exit(1)

fe = read(fe_path)

# Check if our expandable code is present
if 'expandedCcpRows' not in fe:
    print("  ❌ expandedCcpRows nicht gefunden — fmea-editor.tsx ist nicht gepatcht!")
    print("     Bitte zuerst install-all-changes.sh ausführen.")
    sys.exit(1)

# We need to add a helper function that reconstructs decision details
# from q1-q4 values using the DECISION_TREE constant
helper_fn = '''
    // Reconstruct decision details for CCPs that don't have them saved
    const getDetailsForCcp = (row: CcpRow): DecisionDetail[] => {
        if (row.decisionDetails && row.decisionDetails.length > 0) return row.decisionDetails;
        // Reconstruct from q1-q4 and DECISION_TREE
        const details: DecisionDetail[] = [];
        const qKeys = ['q1', 'q2', 'q3', 'q4', 'modification_check'] as const;
        for (const key of qKeys) {
            const treeKey = key === 'modification_check' ? 'modification_check' : key;
            const node = DECISION_TREE[treeKey as keyof typeof DECISION_TREE];
            const val = key === 'modification_check' ? null : row[key as 'q1'|'q2'|'q3'|'q4'];
            if (node && val !== null && val !== undefined) {
                details.push({ questionKey: key, questionText: node.text, answer: val as boolean });
            }
        }
        return details;
    };
'''

# Insert helper after updateQuestionComment function
if 'getDetailsForCcp' not in fe:
    anchor = 'const updateQuestionComment'
    if anchor in fe:
        # Find end of updateQuestionComment function (next closing };)
        pos = fe.index(anchor)
        # Find the function's closing brace
        brace_count = 0
        end_pos = pos
        started = False
        for i in range(pos, len(fe)):
            if fe[i] == '{':
                brace_count += 1
                started = True
            elif fe[i] == '}':
                brace_count -= 1
                if started and brace_count == 0:
                    # Find the next semicolon
                    semi = fe.find(';', i)
                    end_pos = semi + 1 if semi != -1 else i + 1
                    break
        fe = fe[:end_pos] + '\n' + helper_fn + fe[end_pos:]
        print("  ✅ getDetailsForCcp Helper-Funktion eingefügt")
    else:
        print("  ❌ updateQuestionComment nicht gefunden")
else:
    print("  ⏭️  getDetailsForCcp bereits vorhanden")

# Now replace the CCP table rendering to ALWAYS show Q&A below each row
ccp_map_marker = '{ccps.map((row) => ('
end_marker = '</TableBody>'

if ccp_map_marker in fe:
    block_start = fe.index(ccp_map_marker)
    
    # Find the </TableBody> that closes this CCP section (2nd TableBody in file)
    tbody_pos = fe.index(end_marker, block_start)
    
    # The ccps.map ends with ))} on the line before </TableBody>
    # Find that ))} 
    search_region = fe[block_start:tbody_pos]
    last_close = search_region.rfind('))}')
    if last_close == -1:
        print("  ❌ Konnte ))} Ende nicht finden!")
    else:
        block_end = block_start + last_close + 3  # +3 for ))}
        old_block = fe[block_start:block_end]
        print(f"  📐 Block gefunden: {len(old_block)} Zeichen (Zeile ~{fe[:block_start].count(chr(10))+1})")
    
    new_block = r'''{ccps.map((row) => {
                                            const details = getDetailsForCcp(row);
                                            const hasAnyQuestion = details.length > 0 || row.q1 !== null || row.q2 !== null || row.q3 !== null || row.q4 !== null;
                                            return (
                                            <React.Fragment key={row.id}>
                                            <TableRow>
                                                <TableCell className="p-1 text-center align-top">
                                                    {hasAnyQuestion && (
                                                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">Q&A</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        value={row.step} 
                                                        onChange={(e) => updateCcpRow(row.id, "step", e.target.value)}
                                                        placeholder="z.B. Erhitzung..." 
                                                        className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto font-medium"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select value={row.hazardType} onValueChange={(val) => updateCcpRow(row.id, "hazardType", val)}>
                                                        <SelectTrigger className="h-8 border-0 shadow-none bg-transparent p-0">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Physikalisch">Physikalisch</SelectItem>
                                                            <SelectItem value="Mikrobiologisch">Mikrobiologisch</SelectItem>
                                                            <SelectItem value="Chemisch">Chemisch</SelectItem>
                                                            <SelectItem value="Allergene">Allergene</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q1 === true} onChange={(e) => updateCcpRow(row.id, "q1", e.target.checked)} />
                                                </TableCell>
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q2 === true} onChange={(e) => updateCcpRow(row.id, "q2", e.target.checked)} />
                                                </TableCell>
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q3 === true} onChange={(e) => updateCcpRow(row.id, "q3", e.target.checked)} />
                                                </TableCell>
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q4 === true} onChange={(e) => updateCcpRow(row.id, "q4", e.target.checked)} />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                     <Select value={row.result} onValueChange={(val) => updateCcpRow(row.id, "result", val)}>
                                                        <SelectTrigger className={`h-8 border-0 shadow-none p-0 font-bold ${row.result === 'CCP' ? 'text-red-600' : 'text-slate-600'}`}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="KP">KP (GHP)</SelectItem>
                                                            <SelectItem value="CP">CP</SelectItem>
                                                            <SelectItem value="CCP">CCP</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Textarea 
                                                        value={row.controlMeasures} 
                                                        onChange={(e) => updateCcpRow(row.id, "controlMeasures", e.target.value)}
                                                        placeholder="Maßnahmen..." 
                                                        className="min-h-[40px] border-0 shadow-none focus-visible:ring-0 px-0 py-1 resize-y bg-transparent"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => removeCcpRow(row.id)} className="h-6 w-6 text-slate-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            {/* Q&A Details - ALWAYS visible */}
                                            {hasAnyQuestion && (
                                                <TableRow className="bg-blue-50/40">
                                                    <TableCell colSpan={10} className="p-0">
                                                        <div className="px-4 py-3 space-y-2">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <GitBranch className="w-3.5 h-3.5 text-blue-600" />
                                                                <span className="text-xs font-semibold text-blue-800">Entscheidungsdetails</span>
                                                            </div>
                                                            {details.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {details.map((detail) => (
                                                                        <div key={detail.questionKey} className="bg-white rounded border p-2.5 space-y-1.5">
                                                                            <div className="flex items-start gap-2">
                                                                                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 font-mono">{detail.questionKey.toUpperCase()}</Badge>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-xs text-slate-700 leading-snug">{detail.questionText}</p>
                                                                                    <div className="mt-1">
                                                                                        {detail.answer ? (
                                                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                                                                                <CheckCircle2 className="w-3 h-3" /> JA
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                                                                                                <XCircle className="w-3 h-3" /> NEIN
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="ml-8">
                                                                                <Textarea
                                                                                    value={row.questionComments?.[detail.questionKey] || ""}
                                                                                    onChange={(e) => updateQuestionComment(row.id, detail.questionKey, e.target.value)}
                                                                                    placeholder="Begründung / Kommentar..."
                                                                                    className="min-h-[36px] text-xs bg-slate-50 border-slate-200 resize-none"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 italic px-2">Keine Fragen beantwortet.</p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            </React.Fragment>
                                            );
                                        })}'''
    
    fe = fe[:block_start] + new_block + '\n' + fe[block_end:]
    print("  ✅ CCP-Tabelle: Q&A Details werden IMMER angezeigt")
else:
    print("  ❌ ccps.map Block nicht gefunden!")
    # Debug
    for pattern in ['ccps.map((row) => (', 'ccps.map((row) => {', 'ccps.map(']:
        if pattern in fe:
            print(f"     Gefunden: '{pattern}' — aber nicht im erwarteten Format")

write(fe_path, fe)
print("  💾 fmea-editor.tsx gespeichert")

# Verify balance
b = fe.count('{') - fe.count('}')
p = fe.count('(') - fe.count(')')
if b == 0 and p == 0:
    print(f"  ✅ Klammer-Balance OK")
else:
    print(f"  ⚠️  Klammer-Balance: braces={b}, parens={p}")


# ═══════════════════════════════════════════════════════════
# FIX 3: PDF Generator — FMEA Q&A im PDF
# ═══════════════════════════════════════════════════════════
print("\n═══ FIX 3: PDF FMEA Q&A ═══")
pg_path = "client/src/lib/pdf-generator.ts"
pg = read(pg_path)

if 'decisionDetails' in pg and 'Entscheidungsdetails' in pg:
    print("  ✅ PDF FMEA Q&A bereits vorhanden")
else:
    # Find the CCP section and add details after it
    old_ccp = '''            // CCPs
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
            }'''

    new_ccp = '''            // CCPs
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
                    headStyles: { fillColor: [254, 226, 226], textColor: 0 },
                    styles: { fontSize: 8 }
                });

                // @ts-ignore
                yPos = doc.lastAutoTable.finalY + 12;

                // DECISION_TREE questions for reconstructing details
                const DECISION_TREE_PDF: Record<string, string> = {
                    q1: "Existieren Maßnahmen zur Beherrschung der Gefahr?",
                    modification_check: "Ist eine Beherrschung an diesem Schritt notwendig für die Sicherheit?",
                    q2: "Ist der Schritt speziell dazu bestimmt, die Gefahr zu eliminieren oder auf ein akzeptables Maß zu reduzieren?",
                    q3: "Könnte eine Kontamination mit der identifizierten Gefahr inakzeptable Werte erreichen?",
                    q4: "Wird ein nachfolgender Schritt die Gefahr eliminieren oder auf ein akzeptables Maß reduzieren?"
                };

                // Entscheidungsdetails & Kommentare
                doc.setFontSize(11);
                doc.text("Entscheidungsdetails & Begründungen", 14, yPos);
                yPos += 6;

                project.fmeaData.ccps.forEach((ccp: any) => {
                    if (yPos > 250) { doc.addPage(); yPos = addHeader("FMEA - Fortsetzung"); }

                    doc.setFontSize(9);
                    doc.setFont("helvetica", "bold");
                    doc.text(`${ccp.step || "?"} → ${ccp.result}`, 14, yPos);
                    doc.setFont("helvetica", "normal");
                    yPos += 5;

                    // Build detail rows (from saved decisionDetails or reconstructed from q1-q4)
                    let detailRows: any[] = [];
                    if (ccp.decisionDetails && ccp.decisionDetails.length > 0) {
                        detailRows = ccp.decisionDetails.map((d: any) => [
                            d.questionKey.toUpperCase(),
                            d.questionText,
                            d.answer ? "JA" : "NEIN",
                            ccp.questionComments?.[d.questionKey] || ""
                        ]);
                    } else {
                        // Reconstruct from q1-q4
                        for (const qKey of ["q1", "q2", "q3", "q4"]) {
                            if (ccp[qKey] !== null && ccp[qKey] !== undefined) {
                                detailRows.push([
                                    qKey.toUpperCase(),
                                    DECISION_TREE_PDF[qKey] || qKey,
                                    ccp[qKey] ? "JA" : "NEIN",
                                    ccp.questionComments?.[qKey] || ""
                                ]);
                            }
                        }
                    }

                    if (detailRows.length > 0) {
                        autoTable(doc, {
                            startY: yPos,
                            head: [['Frage', 'Fragetext', 'Antwort', 'Begründung']],
                            body: detailRows,
                            theme: 'grid',
                            headStyles: { fillColor: [219, 234, 254], textColor: 0, fontSize: 7 },
                            styles: { fontSize: 7, cellPadding: 2 },
                            columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 60 }, 2: { cellWidth: 14 } }
                        });
                        // @ts-ignore
                        yPos = doc.lastAutoTable.finalY + 8;
                    } else {
                        yPos += 4;
                    }
                });
            }'''
    
    if old_ccp in pg:
        pg = pg.replace(old_ccp, new_ccp, 1)
        write(pg_path, pg)
        print("  ✅ PDF: FMEA Entscheidungsdetails + Begründungen eingefügt")
    else:
        print("  ❌ CCP-Block im PDF-Generator nicht gefunden!")
        if 'decisionDetails' in pg:
            print("     (Möglicherweise bereits teilweise gepatcht)")


# ═══════════════════════════════════════════════════════════
# FIX 4: Restore-Dialog Text-Overflow (product-dashboard.tsx)
# ═══════════════════════════════════════════════════════════
print("\n═══ FIX 4: Restore-Dialog Layout ═══")
pd_path = "client/src/pages/product-dashboard.tsx"
if os.path.exists(pd_path):
    pd = read(pd_path)
    pd_changes = 0
    
    if 'showRestoreProcessDialog' in pd:
        # 4a. Dialog breiter
        old_dlg = '<Dialog open={showRestoreProcessDialog} onOpenChange={setShowRestoreProcessDialog}>\n                <DialogContent className="max-w-md">'
        new_dlg = '<Dialog open={showRestoreProcessDialog} onOpenChange={setShowRestoreProcessDialog}>\n                <DialogContent className="max-w-lg">'
        if old_dlg in pd:
            pd = pd.replace(old_dlg, new_dlg, 1)
            pd_changes += 1

        # 4b. Button-Text kürzen
        if 'Wiederherstellen (neue Version erstellen)' in pd:
            pd = pd.replace('Wiederherstellen (neue Version erstellen)', 'Wiederherstellen', 1)
            pd = pd.replace('<Save className="w-4 h-4 mr-2" />', '<Save className="w-4 h-4 mr-2 shrink-0" />', 1)
            pd_changes += 1

        # 4c. Footer responsive
        restore_start = pd.find('Restore Process Version Dialog')
        if restore_start != -1:
            footer_old = '<DialogFooter className="gap-2">'
            footer_pos = pd.find(footer_old, restore_start)
            if footer_pos != -1 and footer_pos < restore_start + 4000:
                pd = pd[:footer_pos] + '<DialogFooter className="flex-col sm:flex-row gap-2">' + pd[footer_pos + len(footer_old):]
                pd_changes += 1

        if pd_changes > 0:
            write(pd_path, pd)
            print(f"  ✅ {pd_changes} Layout-Fix(e) angewendet")
        else:
            print("  ⏭️  Bereits gefixt")
    else:
        print("  ⏭️  Kein Restore-Dialog vorhanden")
else:
    print(f"  ⏭️  {pd_path} nicht gefunden")


# ═══════════════════════════════════════════════════════════
print("\n═══════════════════════════════════════════════")
print("  ✅ Alle Fixes angewendet!")
print("")
print("  Commit + Push für GitHub Actions Build:")
print("  git add -A && git commit -m 'fix: DeepL persist + FMEA Q&A + PDF' && git push")
print("═══════════════════════════════════════════════")
