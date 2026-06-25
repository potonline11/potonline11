import fs from 'fs';

try {
  let content = fs.readFileSync('src/App.tsx', 'utf8');

  // 1. Fix the JSX comment brace mismatch around line 1669
  const badComment = `/* 📦 สำหรับผู้พัฒนา: ดาวน์โหลดซอร์สโค้ด ZIP สำรอง (เนื่องจากระบบบราว์เซอร์บล็อกปุ่มภายนอก) */}`;
  const goodComment = `{/* 📦 สำหรับผู้พัฒนา: ดาวน์โหลดซอร์สโค้ด ZIP สำรอง (เนื่องจากระบบบราว์เซอร์บล็อกปุ่มภายนอก) */}`;

  if (content.indexOf(badComment) === -1) {
    console.log('Note: Bad comment not found, might have been modified already.');
  } else {
    content = content.replace(badComment, goodComment);
    console.log('Successfully fixed JSX comment format!');
  }

  // 2. Fix the premature closing divs around lines 1931-1933
  // Let's trace from line 1923 onwards
  const targetSectionStartStr = `                  <div className="pt-1 border-t border-gray-900">
                    <button
                      onClick={() => setShowCredentialsSettings(!showCredentialsSettings)}
                      className="w-full bg-gray-900/60 hover:bg-gray-900 border border-gray-850 hover:border-gray-800 text-gray-400 hover:text-white text-[10px] font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {showCredentialsSettings ? 'ซ่อนพาเนลตั้งค่าคีย์พิเศษ' : '⚙️ ตั้งค่าพิเศษ (สำหรับ Vercel / โดเมนส่วนตัว)'}
                    </button>
                  </div>
                </div>
              </div>`;

  // We want to replace it to remove the premature '</div>\n              </div>' (which correspond to line 1932/1933)
  const correctedSectionStr = `                  <div className="pt-1 border-t border-gray-900">
                    <button
                      onClick={() => setShowCredentialsSettings(!showCredentialsSettings)}
                      className="w-full bg-gray-900/60 hover:bg-gray-900 border border-gray-850 hover:border-gray-800 text-gray-400 hover:text-white text-[10px] font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {showCredentialsSettings ? 'ซ่อนพาเนลตั้งค่าคีย์พิเศษ' : '⚙️ ตั้งค่าพิเศษ (สำหรับ Vercel / โดเมนส่วนตัว)'}
                    </button>
                  </div>`;

  if (content.indexOf(targetSectionStartStr) === -1) {
    throw new Error('Target premature closing divs block not found in src/App.tsx');
  }

  content = content.replace(targetSectionStartStr, correctedSectionStr);
  console.log('Successfully removed the premature closing divs!');

  fs.writeFileSync('src/App.tsx', content, 'utf8');

} catch (err: any) {
  console.error('Error in fix_final_jsx:', err.message);
  process.exit(1);
}
