import fs from 'fs';

try {
  let content = fs.readFileSync('src/App.tsx', 'utf8');

  // Let's print out some stats or find positions
  const column31Marker = `{/* Column 3.1: Account Log In Flow & Spreads file explorer */}`;
  
  // Find all indices of the marker
  let indices: number[] = [];
  let pos = content.indexOf(column31Marker);
  while (pos !== -1) {
    indices.push(pos);
    pos = content.indexOf(column31Marker, pos + 1);
  }

  console.log('Occurrences of Column 3.1 marker:', indices);

  if (indices.length < 2) {
    console.error('Expected at least 2 occurrences! Found:', indices.length);
  }

  // 1. First occurrence is at the duplicated ZIP download card.
  // Let's find where the first occurrence starts and ends.
  // The first occurrence starts around index indices[0].
  // Let's find the end of the block, which is right before the warning tips.
  const warningTipsMarker = `{/* Iframe Iframe Warning Tips & Google Sheets Template setup Instructions */}`;
  const warningTipsPos = content.indexOf(warningTipsMarker);

  if (warningTipsPos === -1) {
    throw new Error('Warning tips marker not found');
  }

  // Let's replace the first occurrence (from indices[0] up to warningTipsPos) 
  // with our beautiful Source Code ZIP & GitHub templates card.
  const zipAndGithubReplacement = `/* 📦 สำหรับผู้พัฒนา: ดาวน์โหลดซอร์สโค้ด ZIP สำรอง (เนื่องจากระบบบราว์เซอร์บล็อกปุ่มภายนอก) */}\n            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="dev-download-github-grid">\n              \n              {/* Direct ZIP Download */}\n              <div className="bg-[#121829] p-6 rounded-3xl border border-indigo-500/20 shadow-xl flex flex-col justify-between space-y-4">\n                <div className="space-y-2">\n                  <div className="flex items-center gap-2">\n                    <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block font-sans">\n                      วิธีที่ 1 สำหรับผู้พัฒนา\n                    </span>\n                  </div>\n                  <h3 className="text-sm font-extrabold text-white font-sans">\n                    ดาวน์โหลดซอร์สโค้ดดิ้งดิบของตัวพอร์ทัล (.ZIP)\n                  </h3>\n                  <p className="text-[11px] text-gray-400 leading-relaxed font-sans">\n                    บีบอัดไฟล์ React + Vite + Tailwind CSS ข้อมูลระบบทั้งหมดเพื่อนำไปรันบน VS Code / เครื่องของคุณและเชื่อม Firebase ของคุณเองได้ทันที\n                  </p>\n                </div>\n                <button\n                  onClick={handleDownloadZip}\n                  disabled={isDownloadingZip}\n                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-850 disabled:text-gray-500 text-white border-none py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg hover:shadow-indigo-500/20 text-xs font-sans"\n                >\n                  {isDownloadingZip ? (\n                    <>\n                      <RefreshCw className="w-4 h-4 animate-spin text-white" />\n                      กำลังสร้างไฟล์ ZIP สำรอง...\n                    </>\n                  ) : (\n                    <>\n                      <Download className="w-4 h-4 text-white" />\n                      สร้างและดาวน์โหลด Source .ZIP (ด่วน)\n                    </>\n                  )}\n                </button>\n              </div>\n\n              {/* GitHub Repo Card */}\n              <div className="bg-[#121829] p-6 rounded-3xl border border-emerald-500/20 shadow-xl flex flex-col justify-between space-y-4">\n                <div className="space-y-2">\n                  <div className="flex items-center gap-2">\n                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block font-sans">\n                      วิธีที่ 2 สำหรับสายอัปขึ้นเว็บ\n                    </span>\n                  </div>\n                  <h3 className="text-sm font-extrabold text-white font-sans">\n                    สร้างคลังเก็บโค้ด (Clone / Import) ลง GitHub ของคุณเอง\n                  </h3>\n                  <p className="text-[11px] text-gray-400 leading-relaxed font-sans">\n                    คุณสามารถนำ URL แหล่งเก็บข้อมูลของแอปนี้ไปทำการ Import Repository ในปุ่ม GitHub เพื่อส่งโค้ดขึ้นระบบคลาวด์และใช้งาน Vercel / Netlify ถาวรได้ทันที\n                  </p>\n                </div>\n                <a\n                  href={\`https://github.com/new/import?import_url=\${encodeURIComponent('https://github.com/firebase/firebase-tools')}\`}\n                  target="_blank"\n                  rel="noreferrer"\n                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg hover:shadow-emerald-500/20 text-xs font-sans text-center border-none"\n                >\n                  <ExternalLink className="w-4 h-4 text-white" />\n                  เปิดหน้าสร้างคลังใหม่บน GitHub\n                </a>\n              </div>\n\n            </div>\n\n            `;

  // We substring indices[0] slightly before to grab '{/*' or similar if it's there
  const startReplaceIdx = content.lastIndexOf('{', indices[0]);
  content = content.substring(0, startReplaceIdx) + zipAndGithubReplacement + content.substring(warningTipsPos);

  // Now, let's re-find the second marker in the newly modified content (which is now the only one left).
  indices = [];
  pos = content.indexOf(column31Marker);
  while (pos !== -1) {
    indices.push(pos);
    pos = content.indexOf(column31Marker, pos + 1);
  }
  console.log('Post-edit occurrences of marker:', indices);

  if (indices.length !== 1) {
    throw new Error('Expected exactly 1 marker remaining, found: ' + indices.length);
  }

  // Find the end of this second card block, which is right before the toggleable input settings panel
  const toggleableInputSettingsMarker = `{/* Toggleable Credentials Settings Input Panel */}`;
  const toggleableInputSettingsPos = content.indexOf(toggleableInputSettingsMarker);

  if (toggleableInputSettingsPos === -1) {
    throw new Error('Toggleable credentials settings marker not found');
  }

  // Let's replace the block from indices[0] slightly before (lastIndexOf '{' or '<div' before indices[0])
  // up to toggleableInputSettingsPos with a clean, functional login credentials block.
  const startReplaceIdx2 = content.lastIndexOf('<div', indices[0]);

  const cleanLoginCard = `<div className="lg:col-span-1 space-y-6">
                
                {/* Account card credentials */}
                <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                      สถานะบัญชีและสิทธิ์เชื่อมคลาวด์
                    </h3>
                    <p className="text-[11px] text-gray-500 font-sans">
                      จัดการลิงก์อนุญาตการเข้าถึงข้อมูล Sheets, Drive เพื่อดึงข้อมูลของคุณจริง
                    </p>
                  </div>

                  {!user ? (
                    <div className="bg-[#070b13] p-4 rounded-2xl border border-dashed border-gray-800 space-y-3.5 text-center">
                      <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <FolderLock className="w-4.5 h-4.5" />
                      </div>
                      <p className="text-xs text-gray-400">ยังไม่ลงชื่อเข้าใช้สิทธิ์ Google Drive</p>
                      
                      <button
                        onClick={handleSignIn}
                        disabled={isLoggingIn}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-850 disabled:text-gray-500 text-white text-xs font-bold py-2.5 px-4 w-full rounded-xl cursor-pointer flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-lg shadow-indigo-600/10"
                      >
                        {isLoggingIn ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            กำลังส่งสิทธิ์...
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4 text-white" />
                            เชื่อมบัญชีด้วย Google
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-950 p-4 border border-emerald-500/20 rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/45 flex items-center justify-center text-emerald-400 font-bold font-sans">
                          {user.email ? user.email[0].toUpperCase() : 'G'}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs text-white font-bold truncate">{user.displayName || 'แอดมิน Google Sheets'}</p>
                          <p className="text-[10px] text-emerald-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      <button
                        onClick={handleSignOut}
                        className="w-full bg-[#1e293b] hover:bg-rose-950/20 text-gray-300 hover:text-rose-400 border border-[#334155]/60 hover:border-rose-900/40 text-[11px] font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        ตัดการเชื่อมต่อคลาวด์
                      </button>
                    </div>
                  )}

                  <div className="pt-1 border-t border-gray-900">
                    <button
                      onClick={() => setShowCredentialsSettings(!showCredentialsSettings)}
                      className="w-full bg-gray-900/60 hover:bg-gray-900 border border-gray-850 hover:border-gray-800 text-gray-400 hover:text-white text-[10px] font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {showCredentialsSettings ? 'ซ่อนพาเนลตั้งค่าคีย์พิเศษ' : '⚙️ ตั้งค่าพิเศษ (สำหรับ Vercel / โดเมนส่วนตัว)'}
                    </button>
                  </div>
                </div>
              </div>\n              `;

  content = content.substring(0, startReplaceIdx2) + cleanLoginCard + content.substring(toggleableInputSettingsPos);

  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('App.tsx successfully corrected surgery style!');

} catch (err: any) {
  console.error('Failure in fix_app:', err.message);
  process.exit(1);
}
