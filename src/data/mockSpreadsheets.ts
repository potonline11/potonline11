import { SpreadsheetFile } from '../types';

export interface MockSpreadsheet {
  id: string;
  name: string;
  modifiedTime: string;
  sheets: {
    [sheetTitle: string]: string[][];
  };
}

export const mockSpreadsheets: MockSpreadsheet[] = [
  {
    id: 'hubfree-products-database',
    name: '🟢 HubFree Products Database (Main Feed)',
    modifiedTime: '2026-06-21T20:00:00Z',
    sheets: {
      'All Products': [
        ['Title', 'Category', 'Description', 'Views', 'Downloads', 'FileSize', 'ImageUrl', 'DownloadUrl', 'Rating'],
        [
          'Gold Hunter Scalper EA Pro 2026 (Unlocked)',
          'บอท Forex EA',
          'สุดยอดบอทเทรดทองคำ (XAUUSD) ด้วยระบบ Multi-Indicator Scalping รันบน MT4 วิเคราะห์จุดกลับตัวแม่นยำ ปลอดภัยด้วยระบบป้องกันสูงสูด!',
          '14285',
          '9812',
          '4.8 MB',
          'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/GoldHunter_EA.zip',
          '4.9'
        ],
        [
          'News Hunter EA v4.2 (Anti-Slippage)',
          'บอท Forex EA',
          'EA สายข่าวอัจฉริยะ ตั้งค่าดักราคาช่วงข่าวแรงอัตโนมัติ พร้อมฟังก์ชัน Trailing Stop และป้องกันเงินทุนหดตัวแบบมีประสิทธิภาพ',
          '8320',
          '4115',
          '3.2 MB',
          'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/NewsHunter_v4.2.zip',
          '4.7'
        ],
        [
          'Grid Trend Master EA v9.0',
          'บอท Forex EA',
          'บอทเทรดระบบ Grid ผสมถัวเฉลี่ยไม้อย่างปลอดภัย มีระบบตัดขาดทุนที่แม่นยำ เหมาะกับคู่เงินผันผวนต่ำ EURUSD และ GBPUSD',
          '5490',
          '2810',
          '2.5 MB',
          'https://images.unsplash.com/photo-1624996379697-f01d168b1a52?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/GridTrendMaster_v9.zip',
          '4.5'
        ],
        [
          'Internet Download Manager (IDM) 2026 Pre-activated',
          'โหลดซอฟต์แวร์',
          'โปรแกรมเร่งความเร็วในการดาวน์โหลดอันดับหนึ่งของโลก ตัวเต็มถาวร ไม่ต้องแคร็ก ไม่เด้งเตือนคีย์ปลอม โหลดเต็มสปีดท่ออินเทอร์เน็ต',
          '24510',
          '18920',
          '12.5 MB',
          'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/IDM_Full_Activated.zip',
          '4.8'
        ],
        [
          'Adobe Photoshop 2026 (Portable Multi-language)',
          'โหลดซอฟต์แวร์',
          'โปรแกรมแต่งภาพในตำนาน เวอร์ชันพกพา ไม่ต้องติดตั้ง เปิดใช้งานได้ทันที รองรับฟีเจอร์ AI Generative Fill ขั้นสูง',
          '19300',
          '12050',
          '1.2 GB',
          'https://images.unsplash.com/photo-1541462608141-2ffb68df685e?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/Photoshop_Portable.zip',
          '4.9'
        ],
        [
          'WinRAR v7.10 Corporate Edition Full (TH/EN)',
          'โหลดซอฟต์แวร์',
          'สุดยอดโปรแกรมบีบอัดและคลายไฟล์ยอดนิยม รองรับไฟล์บีบอัดทุกประเภท ติดตั้งครั้งเดียวใช้งานได้ตลอดชีพ ไม่มีโฆษณากวนใจ',
          '11020',
          '9530',
          '6.4 MB',
          'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/WinRAR_Corporate_Full.zip',
          '4.6'
        ],
        [
          'Avatar 3: Fire and Ash (2026 ซับไทย/พากย์ไทย)',
          'ดูหนังฟรี (24-hds)',
          'ภาพยนตร์มหากาพย์ไซไฟฟอร์มยักษ์ เรื่องราวต่อเนื่องบนดาวแพนโดร่า พร้อมการเผชิญหน้ากับชนเผ่าเถ้าถ่านไฟที่มีความเกรี้ยวกราดรุนแรง',
          '31500',
          '22100',
          '2.4 GB',
          'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
          '',
          '4.9'
        ],
        [
          'The Matrix Resurrections (พากย์ไทย FHD 1085p)',
          'ดูหนังฟรี (24-hds)',
          'การกลับมาอีกครั้งของ นีโอ และ ทรินิตี้ ในโลกเสมือนเดอะเมทริกซ์ที่ได้รับการอัปเกรดใหม่ มหากาพย์ความแอ็คชั่นไซไฟระดับตำนาน',
          '18400',
          '11200',
          '1.8 GB',
          'https://images.unsplash.com/photo-1478720568477-15109b3f6636?auto=format&fit=crop&w=600&q=80',
          '',
          '4.5'
        ]
      ],
      'Donation Logs': [
        ['Name', 'Amount', 'Date', 'Message'],
        ['คุณสมศักดิ์', '200 บาท', '2026-06-20', 'ขอบคุณบอทเทรดทองคำเฉียบขาดมากครับ!'],
        ['คุณอัมพร', '100 บาท', '2026-06-19', 'สนับสนุนค่าน้ำชา สำหรับโปรแกรม IDM เจ๋งๆ ครับ'],
        ['คุณสุรีย์', '300 บาท', '2026-06-18', 'หนังชนโรงภาพชัดแจ๋ว แวะมาฝากค่าน้ำชาจ้า']
      ]
    }
  }
];
