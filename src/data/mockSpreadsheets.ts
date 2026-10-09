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
          'เกิดใหม่พร้อมดวงตาเทพมองทะลุ (พากย์ไทย เต็มเรื่อง HD)',
          'หนังฟรี',
          'เรื่องราวของชายหนุ่มที่ได้รับโอกาสเกิดใหม่พร้อมกับเนตรทิพย์ดวงตาเทพที่สามารถมองทะลุทุกสิ่งและหยั่งรู้อนาคต ภาพยนตร์แอ็กชันแฟนตาซีสุดมันส์',
          '38500',
          '28400',
          '1.5 GB',
          'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80',
          '<iframe width="600" height="480" src="https://playmogo.com/e/iiwiccjcoyz4" scrolling="no" frameborder="0" allowfullscreen="true"></iframe>',
          '4.8'
        ],
        [
          'Avatar 3: Fire and Ash (2026 ซับไทย/พากย์ไทย)',
          'ดูหนังฟรี (24-hds)',
          'ภาพยนตร์มหากาพย์ไซไฟฟอร์มยักษ์ เรื่องราวต่อเนื่องบนดาวแพนโดร่า พร้อมการเผชิญหน้ากับชนเผ่าเถ้าถ่านไฟที่มีความเกรี้ยวกราดรุนแรง',
          '31500',
          '22100',
          '2.4 GB',
          'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
          '<iframe width="600" height="480" src="https://playmogo.com/e/iiwicjcoyz4" scrolling="no" frameborder="0" allowfullscreen="true"></iframe>',
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
          'https://www.youtube.com/embed/9ix7TUGVYIo',
          '4.5'
        ],
        [
          'Interstellar ทะลุมิติจักรวาล (พากย์ไทย Master 4K)',
          'ดูหนังฟรี (24-hds)',
          'ภาพยนตร์ไซไฟระดับตำนานเรื่องราวการเดินทางข้ามรูหนอนเพื่อค้นหาดาวเคราะห์ดวงใหม่สำหรับมนุษยชาติ กำกับโดย คริสโตเฟอร์ โนแลน',
          '42100',
          '31500',
          '2.8 GB',
          'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
          'https://www.youtube.com/embed/zSWdZVtXT7E',
          '5.0'
        ],
        [
          'Oppenheimer ออปเพนไฮเมอร์ (2024 พากย์ไทย HD)',
          'ดูหนังฟรี (24-hds)',
          'เรื่องราวของ เจ. โรเบิร์ต ออปเพนไฮเมอร์ บิดาแห่งระเบิดปรมาณู ภาพยนตร์รางวัลออสการ์ยอดเยี่ยม ถ่ายทอดประวัติศาสตร์สุดเข้มข้น',
          '39800',
          '27300',
          '2.6 GB',
          'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80',
          'https://www.youtube.com/embed/uYPbbksJxIg',
          '4.9'
        ],
        [
          'Top Gun: Maverick ท็อปกัน มาเวอริค (พากย์ไทย 1080p)',
          'ดูหนังฟรี (24-hds)',
          'การกลับมาของกัปตันพีท มาเวอริค มิทเชลล์ ในภารกิจฝึกนักบินรุ่นใหม่เพื่อภารกิจเสี่ยงตาย แอ็กชันกลางเวหาสุดตื่นเต้น',
          '35200',
          '24900',
          '2.1 GB',
          'https://images.unsplash.com/photo-1519074069444-1ba4ea16e919?auto=format&fit=crop&w=600&q=80',
          'https://www.youtube.com/embed/giXco2jaZ_4',
          '4.8'
        ],
        [
          'Dune: Part Two ดูน ภาคสอง (2024 พากย์ไทย FHD)',
          'ดูหนังฟรี (24-hds)',
          'การเดินทางของพอล อะทรีเดส ร่วมกับชานีและชาวเฟรเมน เพื่อล้างแค้นผู้ที่ทำลายครอบครัวของเขา พร้อมเผชิญชะตากรรมของจักรวาล',
          '41000',
          '30200',
          '2.7 GB',
          'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
          'https://www.youtube.com/embed/Way9Dexny3w',
          '4.9'
        ],
        [
          'Spider-Man: Across the Spider-Verse (พากย์ไทย)',
          'ดูหนังฟรี (24-hds)',
          'ไมลส์ มอราลส์ เดินทางข้ามมัลติเวิร์สเพื่อพบกับเหล่าสไปเดอร์คนอื่นๆ และต้องเผชิญหน้ากับทางเลือกในการปกป้องคนที่รัก',
          '29800',
          '21400',
          '1.9 GB',
          'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=600&q=80',
          'https://www.youtube.com/embed/cqGjhVJWtEg',
          '4.9'
        ],
        [
          'Inception จิตพิฆาตโลก (พากย์ไทย HD)',
          'ดูหนังฟรี (24-hds)',
          'ดอม คอบบ์ จอมโจรกรรมความคิดที่แทรกซึมเข้าไปในจิตใต้สำนึกของเป้าหมายในขณะที่กำลังหลับเพื่อขโมยข้อมูลสำคัญ',
          '34100',
          '23800',
          '2.2 GB',
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
          'https://www.youtube.com/embed/YoHD9XEInc0',
          '4.8'
        ],
        [
          'Spirited Away มิติวิญญาณมหัศจรรย์ (สตูดิโอจิบลิ พากย์ไทย)',
          'ดูหนังฟรี (24-hds)',
          'อนิเมะระดับตำนานจากสตูดิโอจิบลิ เรื่องราวของเด็กหญิงจิฮิโระที่หลุดเข้าไปในโลกของภูตผีและวิญญาณ',
          '26500',
          '18900',
          '1.6 GB',
          'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
          'https://www.youtube.com/embed/ByXuk9QqQkk',
          '5.0'
        ],
        [
          'VS Code Pro Extended Pack 2026',
          'โหลดซอฟต์แวร์',
          'ชุดปลั๊กอินและโปรแกรมแก้ไขโค้ดยอดนิยม รวมเครื่องมือ AI Completion, GitLens Pro, และธีมระดับพรีเมียมครบวงจร',
          '15600',
          '11800',
          '180 MB',
          'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/VSCode_Extended.zip',
          '4.9'
        ],
        [
          'OBS Studio Pro 2026 for Streamer (Pre-setup)',
          'โหลดซอฟต์แวร์',
          'โปรแกรมบันทึกหน้าจอและสตรีมสดระดับมืออาชีพ ตั้งค่าฉาก โอเวอร์เลย์ และระบบตัดเสียงรบกวน AI พร้อมใช้งาน',
          '18900',
          '13400',
          '340 MB',
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/OBS_Pro_Streamer.zip',
          '4.8'
        ],
        [
          'DaVinci Resolve Studio 2026 Portable',
          'โหลดซอฟต์แวร์',
          'ซอฟต์แวร์ตัดต่อวิดีโอ เกรดสีเสียงขั้นเทพ ฉบับพกพา ไม่ต้องลงทะเบียน พร้อมชุด LUTs ระดับฮอลลีวูดกว่า 200 แบบ',
          '22400',
          '15900',
          '2.1 GB',
          'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/DaVinci_Resolve_Port.zip',
          '4.9'
        ],
        [
          'Microsoft Office 2026 LTSC AIO Silent Install',
          'โหลดซอฟต์แวร์',
          'ชุดโปรแกรมสำนักงาน Word, Excel, PowerPoint ตัวเต็มภาษาไทย ติดตั้งคลิกเดียว จบในขั้นตอนเดียว ปลอดภัยไร้ไวรัส',
          '45200',
          '38100',
          '3.4 GB',
          'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/Office2026_Silent.zip',
          '4.7'
        ],
        [
          'Canva Pro Offline Templates & Graphics Bundle',
          'โหลดซอฟต์แวร์',
          'ชุดเทมเพลตและกราฟิกสำเร็จรูปสำหรับงานโซเชียลมีเดีย ป้ายโฆษณา อินโฟกราฟิก กว่า 5,000 ชิ้นงานคุณภาพสูง',
          '14200',
          '9800',
          '850 MB',
          'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/Canva_Bundle_2026.zip',
          '4.8'
        ],
        [
          'TradingView Desktop Pro Edition (Bypass Premium)',
          'บอท Forex EA',
          'แอปพลิเคชัน TradingView เวอร์ชันคอมพิวเตอร์ รองรับการเปิดดูกราฟ 8 หน้าจอพร้อมกัน พร้อมการแจ้งเตือนไม่จำกัด',
          '17800',
          '12900',
          '160 MB',
          'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/TradingView_Desktop_Pro.zip',
          '4.9'
        ],
        [
          'Deriv Synthetic Bot v3.5 (Volatility 75)',
          'บอท Forex EA',
          'บอทเทรดดัชนีสังเคราะห์ Deriv Vix 75 ด้วยระบบคำนวณโมเมนตัมแบบเรียลไทม์ ทำกำไรอัตโนมัติ 24 ชม. ตลอด 7 วัน',
          '11200',
          '7400',
          '3.1 MB',
          'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/Deriv_Vix75_Bot.zip',
          '4.6'
        ],
        [
          'Smart Money Concepts (SMC) Indicator MT4/MT5',
          'บอท Forex EA',
          'อินดิเคเตอร์แสดงโซน Order Block, Break of Structure (BOS), และ Change of Character (CHoCH) อัตโนมัติแม่นยำสูง',
          '21300',
          '16200',
          '1.8 MB',
          'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/SMC_Indicator_AIO.zip',
          '4.9'
        ],
        [
          'Multi-Currency Trend Rider EA 2026 (MT5)',
          'บอท Forex EA',
          'บอทรันพร้อมกัน 28 คู่เงิน กระจายความเสี่ยงอย่างสมบูรณ์แบบ มีระบบ Dynamic Drawdown Control ป้องกันพอร์ตแตก',
          '13400',
          '8900',
          '5.4 MB',
          'https://images.unsplash.com/photo-1624996379697-f01d168b1a52?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/TrendRider_EA_MT5.zip',
          '4.7'
        ],
        [
          'Auto Fibonacci Retracement Indicator Pro (MT4)',
          'บอท Forex EA',
          'อินดิเคเตอร์ลากเส้นฟีโบนัชชีอัตโนมัติ คำนวณ High/Low ตาม Timeframe พร้อมแจ้งเตือนเมื่อราคาชนระดับ Golden Ratio 61.8%',
          '9800',
          '6500',
          '1.2 MB',
          'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/AutoFibo_Pro_MT4.zip',
          '4.6'
        ],
        [
          'XAUUSD Gold Beast EA v12 (High Winrate)',
          'บอท Forex EA',
          'สุดยอดบอททองคำที่ผ่านการทดสอบ Backtest 10 ปี ด้วย 99.9% Modelling Quality วางไม้ตามโครงสร้างตลาดปลอดภัยขั้นสูงสุด',
          '28400',
          '19900',
          '6.2 MB',
          'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/GoldBeast_v12.zip',
          '5.0'
        ],
        [
          'Notion Desktop Productivity Master Suite 2026',
          'โหลดซอฟต์แวร์',
          'ชุดเทมเพลต Notion สำหรับจัดระเบียบชีวิต การงาน วางแผนเทรด และบริหารการเงินส่วนบุคคล ครบทุกมิติ',
          '16700',
          '12100',
          '95 MB',
          'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/Notion_Suite_2026.zip',
          '4.8'
        ],
        [
          'Python Automation & Data Science AIO Pack',
          'โหลดซอฟต์แวร์',
          'ชุดสคริปต์ Python อัตโนมัติสำหรับดึงข้อมูล ดึงราคาสินค้า และวิเคราะห์ข้อมูล พร้อมคลังโมเดล Machine Learning พร้อมใช้',
          '18200',
          '13500',
          '520 MB',
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
          'https://github.com/example/files/raw/main/Python_Automation_Pack.zip',
          '4.9'
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
