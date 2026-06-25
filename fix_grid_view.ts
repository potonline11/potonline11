import fs from 'fs';

try {
  let content = fs.readFileSync('src/App.tsx', 'utf8');

  // Find the worksheets tab selection block inside active worksheets view
  const marker = `{/* Worksheets tabs options selector */}`;
  
  // Since there might be other places, let's find the occurrence that resides around where the spreadsheet editor is.
  // The spreadsheet editor has the header: "ตารางแก้ไขข้อมูลสดแผ่นงาน"
  const editorHeader = `ตารางแก้ไขข้อมูลสดแผ่นงาน:`;
  const headerIdx = content.indexOf(editorHeader);
  if (headerIdx === -1) {
    throw new Error('Spreadsheet editor header not found');
  }

  // Find the marker after the editor header
  const markerIdx = content.indexOf(marker, headerIdx);
  if (markerIdx === -1) {
    throw new Error('Marker not found after editor header');
  }

  // Find the target where the table div begins
  const tableDiv = `<div className="overflow-x-auto rounded-xl border border-gray-850 max-h-96">`;
  const tableDivIdx = content.indexOf(tableDiv, markerIdx);
  if (tableDivIdx === -1) {
    throw new Error('Table div start not found');
  }

  const replacementCode = `{/* Worksheets tabs options selector */}
                    {worksheets.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 bg-black/40 border border-gray-850 p-1.5 rounded-xl max-w-full overflow-x-auto">
                        {worksheets.map((w, i) => (
                          <button
                            key={i}
                            onClick={() => handleTabChange(w.title)}
                            className={\`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 \${
                              activeWorksheet === w.title
                                ? 'bg-amber-500 text-black font-black'
                                : 'text-gray-400 hover:text-white hover:bg-gray-900'
                            }\`}
                          >
                            <span>📄</span>
                            <span>{w.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {isGridLoading ? (
                    <div className="flex items-center justify-center p-12 text-gray-400 gap-2 bg-gray-950/20 rounded-xl border border-gray-850">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                      <span className="text-xs font-bold font-sans text-gray-400">กำลังดึงข้อมูลแผ่นงาน...</span>
                    </div>
                  ) : (
                      `;

  content = content.substring(0, markerIdx) + replacementCode + content.substring(tableDivIdx);

  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('Successfully fixed the worksheets tab selector and grid loading layout!');

} catch (err: any) {
  console.error('Error in fix_grid_view:', err.message);
  process.exit(1);
}
