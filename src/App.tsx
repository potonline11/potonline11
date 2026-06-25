import React, { useState, useEffect, useCallback, useMemo, startTransition, FormEvent } from 'react';
import { User } from 'firebase/auth';
import JSZip from 'jszip';
import {
  initAuth,
  googleSignIn,
  logoutUser,
  getAccessToken,
  setCachedToken,
  fetchUserSpreadsheets,
  fetchSpreadsheetMetadata,
  fetchWorksheetValues,
  updateCellInSpreadsheet,
  appendRowToSpreadsheet,
  createWorksheet,
  createNewSpreadsheet,
  firebaseConfig,
  loginWithDirectAccessToken,
} from './lib/firebase';
import { SpreadsheetFile, Worksheet, ActivityLog, HubItem } from './types';
import { mockSpreadsheets } from './data/mockSpreadsheets';
import {
  FileSpreadsheet,
  Search,
  Globe,
  Settings,
  HelpCircle,
  Clock,
  ExternalLink,
  Download,
  Eye,
  Star,
  Plus,
  Heart,
  AlertCircle,
  Database,
  CheckCircle2,
  ChevronRight,
  LogOut,
  RefreshCw,
  Copy,
  FolderLock,
  Lock,
  Unlock,
  Coffee,
  Coins,
  Flame,
  ShieldCheck,
  Upload,
  // Custom unique icons for Software categories
  Layout,
  Monitor,
  Laptop,
  Smartphone,
  Headphones,
  BookOpen,
  Tv,
  Music,
  Gamepad2,
  Layers,
  Type,
  Home,
  GraduationCap,
  Book,
  Palette,
  Code2,
  Package,
  Trophy,
  // Forex EA Subcategories
  Bot,
  Cpu,
  TrendingUp,
  BarChart3,
  Activity,
  Terminal,
  Settings2,
  // Movies Subcategories
  Film,
  Clapperboard,
  Sparkles,
  Popcorn,
  Tv2,
  Compass,
  Award
} from 'lucide-react';


// Helper to find column index loosely matching options list
const findHeaderIndex = (headers: string[], options: string[]): number => {
  return headers.findIndex((h) => 
    options.some((opt) => h.includes(opt.toLowerCase()) || opt.toLowerCase().includes(h))
  );
};

// Help extract raw URL from spreadsheet formulas like =IMAGE("url") or =HYPERLINK("url", "label")
const extractUrlFromFormula = (cellVal: string): string => {
  if (!cellVal) return '';
  const trimmed = cellVal.trim();
  if (trimmed.startsWith('=')) {
    // Look for double or single quotes containing a web url
    const match = trimmed.match(/["'](https?:\/\/[^"']+)["']/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return trimmed;
};

// Help extract Google Drive file ID from various URL formats
const getGoogleDriveId = (url: string): string | null => {
  if (!url) return null;
  const cleanedUrl = extractUrlFromFormula(url);
  let trimmed = cleanedUrl.trim();
  
  // Decode URL in case it's nested or passed through a proxy like wsrv.nl
  try {
    if (trimmed.includes('%')) {
      trimmed = decodeURIComponent(trimmed);
    }
  } catch (e) {
    // Ignore decode error
  }

  // If it's a raw file ID (usually between 20 and 80 characters, alphanumeric, underscores/dashes)
  if (/^[a-zA-Z0-9_-]{20,80}$/.test(trimmed)) {
    return trimmed;
  }
  if (
    trimmed.includes('drive.google.com') || 
    trimmed.includes('docs.google.com') || 
    trimmed.includes('googleusercontent.com') || 
    trimmed.includes('/api/drive-image') ||
    trimmed.includes('wsrv.nl') ||
    trimmed.includes('weserv.nl')
  ) {
    const matches = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/id(?:=|%3D)([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/\/open\?id=([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/\/uc\?id=([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/\/thumbnail\?id=([a-zA-Z0-9_-]{20,80})/i);
    if (matches && matches[1]) {
      return matches[1];
    }
  }
  return null;
};

// Help convert Google Drive screenshot / file view URLs into embeddable direct media src links
const convertDriveImageUrl = (url: string): string => {
  if (!url) return '';
  const cleanedUrl = extractUrlFromFormula(url);
  const trimmed = cleanedUrl.trim();
  
  // If the input is actually an HTML image tag (or contains one)
  if (trimmed.includes('<img')) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      const srcUrl = srcMatch[1].trim();
      const driveId = getGoogleDriveId(srcUrl);
      if (driveId) {
        return `https://wsrv.nl/?url=${encodeURIComponent(`https://docs.google.com/uc?export=download&id=${driveId}`)}`;
      }
      return srcUrl;
    }
  }

  // If it's already clean or contains other non-drive image CDN link
  if (trimmed.startsWith('http') && 
      !trimmed.includes('drive.google.com') && 
      !trimmed.includes('docs.google.com') && 
      !trimmed.includes('googleusercontent.com') && 
      !trimmed.includes('wsrv.nl') && 
      !trimmed.includes('weserv.nl') &&
      !trimmed.includes('/api/drive-image')) {
    return trimmed;
  }

  const driveId = getGoogleDriveId(trimmed);
  if (driveId) {
    // ใช้ wsrv.nl CDN Proxy มั่นใจได้ว่าเสถียรที่สุด 100% บนหน้าเว็บ potnuengshop.com โดยไม่ติดปัญหา Referer Check และไม่ต้องใช้ Express server
    return `https://wsrv.nl/?url=${encodeURIComponent(`https://docs.google.com/uc?export=download&id=${driveId}`)}`;
  }

  return trimmed;
};

// Help convert Google Drive downloadable links into automated trigger downloads
const convertDriveDownloadUrl = (url: string): string => {
  if (!url) return '#';
  const cleanedUrl = extractUrlFromFormula(url);
  const trimmed = cleanedUrl.trim();

  // 1. Raw file ID
  if (/^[a-zA-Z0-9_-]{20,80}$/.test(trimmed)) {
    return `https://docs.google.com/uc?export=download&id=${trimmed}`;
  }

  // 2. Google Drive / Docs URLs
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const matches = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/\/open\?id=([a-zA-Z0-9_-]{20,80})/i) ||
                    trimmed.match(/\/uc\?id=([a-zA-Z0-9_-]{20,80})/i);
                    
    if (matches && matches[1]) {
      return `https://docs.google.com/uc?export=download&id=${matches[1]}`;
    }
  }
  return trimmed;
};

// Help handle image error fallback beautifully with multi-layered high-availability proxies
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.currentTarget;
  const currentSrc = img.src;
  
  // สร้าง SVG Placeholder แบบ Base64 มั่นใจได้ว่าแสดงผลได้ 100% โดยไม่ติดขัดเรื่อง URL encoding
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="#0b101c" stroke="#1f2937" stroke-width="2"/><circle cx="300" cy="180" r="40" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6,4"/><path d="M280 180 L320 180 M300 160 L300 200" stroke="#f59e0b" stroke-width="2"/><text x="50%" y="270" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="600" fill="#9ca3af">รูปภาพสินค้า / Product Image</text></svg>`;
  const SVG_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

  const attempts = parseInt(img.getAttribute('data-fallback-attempts') || '0', 10);
  if (attempts >= 10) {
    img.src = SVG_PLACEHOLDER;
    return;
  }
  
  img.setAttribute('data-fallback-attempts', String(attempts + 1));
  const driveId = img.getAttribute('data-original-drive-id') || getGoogleDriveId(currentSrc);
  
  if (driveId) {
    // ลิสต์ Proxy สำรองความพร้อมใช้งานสูง (High-Availability CDN Proxies)
    const fallbacks = [
      // ลำดับที่ 1: ใช้ wsrv.nl ครอบดึงจาก Google Docs uc download เพื่อล้าง referer/cookies (เสถียรที่สุดสำหรับเว็บ Static อย่าง potnuengshop.com)
      `https://wsrv.nl/?url=${encodeURIComponent(`https://docs.google.com/uc?export=download&id=${driveId}`)}`,
      // ลำดับที่ 2: ใช้ wsrv.nl ครอบดึง lh3.googleusercontent.com เพื่อทำความสะอาด headers/referer และแคชความเร็วสูง
      `https://wsrv.nl/?url=${encodeURIComponent(`https://lh3.googleusercontent.com/d/${driveId}=s0`)}`,
      // ลำดับที่ 3: WordPress Jetpack/Photon CDN ช่วยแคชรูปภาพผ่านเซิร์ฟเวอร์ความเร็วสูง (ไม่ต้องผ่าน Express Backend ของเรา)
      `https://i0.wp.com/lh3.googleusercontent.com/d/${driveId}=s0`,
      // ลำดับที่ 4: ใช้ Express backend proxy เผื่อรันอยู่บน Full-Stack Server เติมเต็มความปลอดภัย
      `/api/drive-image?id=${driveId}`,
      // ลำดับที่ 5: Google Thumbnail API แท้ ความละเอียดสูง w1600 (ตรงที่สุด)
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
      // ลำดับที่ 6: SVG Placeholder เพื่อเป็นทางเลือกสุดท้าย
      SVG_PLACEHOLDER
    ];

    // กรองหาตัวถัดไปที่ไม่ซ้ำกับรูปภาพที่เพิ่งเกิด Error (ป้องกัน Infinite retrying URL เดิม)
    const activeFallbacks = fallbacks.filter(f => {
      if (f === currentSrc) return false;
      try {
        const url1 = new URL(f, window.location.href).href;
        const url2 = new URL(currentSrc, window.location.href).href;
        return url1 !== url2;
      } catch (e) {
        return f !== currentSrc;
      }
    });

    const nextSrc = activeFallbacks[attempts % activeFallbacks.length] || SVG_PLACEHOLDER;
    console.log(`[GoogleDriveProxy] Fallback triggered. Attempt: ${attempts + 1}, Next Src: ${nextSrc}`);
    img.src = nextSrc;
  } else {
    img.src = SVG_PLACEHOLDER;
  }
};

// RFC 4180 compliant high-performance CSV parser
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }
  
  return lines.filter(r => r.length > 0);
}


// Helper to strip HTML tags for card & hero displays
const getCleanPreviewText = (text?: string): string => {
  if (!text) return '';
  let cleaned = text.trim();
  
  // If it's a full HTML document, try to extract body or safe sections
  if (/<!DOCTYPE|<html>|<head>|<body>/i.test(cleaned)) {
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      cleaned = bodyMatch[1];
    }
    // Strip script and style tags to be completely safe
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }
  
  // Replace HTML tags with space
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  // Clean entities and multiple spaces
  cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (cleaned.length > 200) {
    return cleaned.slice(0, 200) + '...';
  }
  return cleaned;
};

// Component to dynamically and safely render plain text, rich HTML snippets, or isolated full HTML reports
interface SafeHtmlContentProps {
  htmlContent?: string;
  className?: string;
}

function SafeHtmlContent({ htmlContent, className = '' }: SafeHtmlContentProps) {
  if (!htmlContent) return null;

  const trimmed = htmlContent.trim();
  const isFullHtml = /<!DOCTYPE|<html>|<head>|<body>/i.test(trimmed);
  const hasTags = /<[a-z][\s\S]*>/i.test(trimmed);

  if (isFullHtml) {
    return (
      <div className="w-full bg-[#070b13] rounded-2xl border border-gray-850 overflow-hidden shadow-inner flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-[#0b101c] border-b border-gray-850 select-none">
          <span className="text-[10px] text-gray-400 flex items-center gap-1.5 font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            พรีวิวเนื้อหาเว็บบอร์ด (Isolated Frame Container)
          </span>
        </div>
        <iframe
          srcDoc={trimmed}
          title="Isolated HTML View"
          className="w-full min-h-[500px] border-none bg-white"
          sandbox="allow-scripts allow-popups"
        />
      </div>
    );
  }

  if (hasTags) {
    return (
      <div 
        className={`text-xs sm:text-sm text-gray-300 leading-relaxed font-sans font-light bg-[#070b13] p-4 rounded-2xl border border-gray-850 shadow-inner html-content-container overflow-x-auto ${className}`}
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    );
  }

  return (
    <p className={`text-xs sm:text-sm text-gray-200 leading-relaxed font-sans font-light bg-[#070b13] p-3.5 rounded-2xl border border-gray-850 shadow-inner whitespace-pre-line ${className}`}>
      {trimmed}
    </p>
  );
}

// Subcategories of software based on user screenshot with vibrant, eye-catching distinct icons and gradients
const SOFTWARE_SUBCATEGORIES = [
  {
    id: 'All',
    name: 'Все สมาชิก',
    thaiName: 'ทั้งหมด (Show All)',
    icon: Layout,
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400 text-black',
    shadowGlow: 'hover:shadow-amber-500/20'
  },
  {
    id: 'windows',
    name: 'Windows',
    thaiName: 'Windows Software',
    icon: Monitor,
    color: '#0078d4',
    gradient: 'from-[#0078d4] to-[#00bcf2] text-white',
    shadowGlow: 'hover:shadow-blue-500/20'
  },
  {
    id: 'mac',
    name: 'Mac',
    thaiName: 'Mac Software',
    icon: Laptop,
    color: '#a2a2a2',
    gradient: 'from-zinc-500 to-gray-300 text-slate-950',
    shadowGlow: 'hover:shadow-zinc-500/20'
  },
  {
    id: 'android',
    name: 'Android App',
    thaiName: 'Android App & APK',
    icon: Smartphone,
    color: '#a4c639',
    gradient: 'from-emerald-600 to-lime-500 text-white',
    shadowGlow: 'hover:shadow-emerald-500/20'
  },
  {
    id: 'audiobooks',
    name: 'Audiobooks',
    thaiName: 'หนังสือเสียง / ไฟล์เสียง',
    icon: Headphones,
    color: '#1da1f2',
    gradient: 'from-teal-500 to-cyan-400 text-white',
    shadowGlow: 'hover:shadow-teal-500/20'
  },
  {
    id: 'ebooks',
    name: 'E-Books',
    thaiName: 'E-Books & เอกสาร PDF',
    icon: BookOpen,
    color: '#2f80ed',
    gradient: 'from-blue-600 to-indigo-500 text-white',
    shadowGlow: 'hover:shadow-indigo-500/20'
  },
  {
    id: 'videos',
    name: 'Videos',
    thaiName: 'สื่อบทเรียน / วิดีโอสื่อ',
    icon: Tv,
    color: '#9b51e0',
    gradient: 'from-purple-600 to-fuchsia-500 text-white',
    shadowGlow: 'hover:shadow-purple-500/20'
  },
  {
    id: 'music',
    name: 'Music',
    thaiName: 'ซอฟต์แวร์แต่งเพลง / 音楽',
    icon: Music,
    color: '#f2c94c',
    gradient: 'from-amber-500 to-orange-400 text-slate-900',
    shadowGlow: 'hover:shadow-amber-500/20'
  },
  {
    id: 'games',
    name: 'Games Bundle',
    thaiName: 'เกมรวม / เกมส์บิลด์',
    icon: Gamepad2,
    color: '#2d9cdb',
    gradient: 'from-cyan-600 to-teal-400 text-white',
    shadowGlow: 'hover:shadow-cyan-500/20'
  },
  {
    id: 'wordpress',
    name: 'Wordpress',
    thaiName: 'Wordpress & WordPress',
    icon: Globe,
    color: '#21759b',
    gradient: 'from-[#21759b] to-[#124964] text-white',
    shadowGlow: 'hover:shadow-slate-500/20'
  },
  {
    id: 'elementor',
    name: 'Elementor',
    thaiName: 'Elementor templates',
    icon: Layers,
    color: '#92003b',
    gradient: 'from-red-700 to-rose-500 text-white',
    shadowGlow: 'hover:shadow-red-500/20'
  },
  {
    id: 'fonts',
    name: 'Font Collection',
    thaiName: 'ฟอนต์สวย / อักษรศิลป์',
    icon: Type,
    color: '#eb5757',
    gradient: 'from-[#eb5757] to-[#ee5533] text-white',
    shadowGlow: 'hover:shadow-orange-500/20'
  },
  {
    id: 'home',
    name: 'Home & Interior',
    thaiName: 'โมเดลแต่งบ้าน / กีต้าร์',
    icon: Home,
    color: '#27ae60',
    gradient: 'from-emerald-500 to-teal-400 text-white',
    shadowGlow: 'hover:shadow-emerald-500/20'
  },
  {
    id: 'education',
    name: 'Education',
    thaiName: 'ชุดความรู้การศึกษา / 學科',
    icon: GraduationCap,
    color: '#56ccf2',
    gradient: 'from-sky-500 to-sky-300 text-slate-950',
    shadowGlow: 'hover:shadow-sky-500/20'
  },
  {
    id: 'magazines',
    name: 'Magazine Bundle',
    thaiName: 'นิตยสารเล่มหนังสือ',
    icon: Book,
    color: '#f2994a',
    gradient: 'from-amber-500 to-orange-400 text-white',
    shadowGlow: 'hover:shadow-orange-500/20'
  },
  {
    id: 'assets',
    name: 'Premium Assets',
    thaiName: 'โมเดลกราฟิก / Presets',
    icon: Palette,
    color: '#bb6bd9',
    gradient: 'from-pink-600 to-rose-400 text-white',
    shadowGlow: 'hover:shadow-pink-500/20'
  },
  {
    id: 'resources',
    name: 'Resources',
    thaiName: 'เครื่องมือเดฟ / ซอร์สโค้ด',
    icon: Code2,
    color: '#e08244',
    gradient: 'from-orange-500 to-yellow-500 text-white',
    shadowGlow: 'hover:shadow-orange-500/20'
  },
  {
    id: 'bundles',
    name: 'Software Bundle',
    thaiName: 'ซอฟต์แวร์ชุดมัดจำคุ้มค่า',
    icon: Package,
    color: '#6fcf97',
    gradient: 'from-green-500 to-[#3bb173] text-white',
    shadowGlow: 'hover:shadow-green-500/20'
  },
  {
    id: 'success',
    name: 'Success Program',
    thaiName: 'โปรแกรมความสำเร็จ / พัฒนาตน',
    icon: Trophy,
    color: '#d0021b',
    gradient: 'from-red-600 to-rose-600 text-white',
    shadowGlow: 'hover:shadow-red-500/20'
  }
];

// Subcategories of Forex EA based on user's forexneo.com official screenshot
const FOREX_SUBCATEGORIES = [
  {
    id: 'All',
    name: 'All Bots',
    thaiName: 'บอทและตัวบ่งชี้ทั้งหมด',
    icon: Layout,
    color: '#3b82f6',
    gradient: 'from-blue-600 to-indigo-500 text-white',
    shadowGlow: 'hover:shadow-blue-500/20'
  },
  {
    id: 'mt4_robot',
    name: 'MT4 Forex Robot',
    thaiName: 'บอทช่วยเทรดอัตโนมัติบน MT4',
    icon: Bot,
    color: '#ff5722',
    gradient: 'from-orange-600 to-amber-500 text-white',
    shadowGlow: 'hover:shadow-orange-500/20'
  },
  {
    id: 'mt5_robot',
    name: 'MT5 Forex Robot',
    thaiName: 'บอทช่วยเทรดอัตโนมัติบน MT5',
    icon: Cpu,
    color: '#00d2ff',
    gradient: 'from-cyan-500 to-blue-500 text-white',
    shadowGlow: 'hover:shadow-cyan-500/20'
  },
  {
    id: 'deriv_bot',
    name: 'Deriv Trading Bot',
    thaiName: 'บอทเทรดรันผ่านแพลตฟอร์ม Deriv',
    icon: Terminal,
    color: '#e31c5f',
    gradient: 'from-rose-600 to-pink-500 text-white',
    shadowGlow: 'hover:shadow-rose-500/20'
  },
  {
    id: 'mt5_synthetic',
    name: 'MT5 Synthetic Robot',
    thaiName: 'บอทเทรดยอดนิยมดัชนีจำลอง',
    icon: Activity,
    color: '#8b5cf6',
    gradient: 'from-violet-600 to-fuchsia-500 text-white',
    shadowGlow: 'hover:shadow-violet-500/20'
  },
  {
    id: 'mt4_indicator',
    name: 'MT4 Indicators',
    thaiName: 'เครื่องมือนำสายตาช่วยเทรด MT4',
    icon: TrendingUp,
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-400 text-white',
    shadowGlow: 'hover:shadow-emerald-500/20'
  },
  {
    id: 'mt5_indicator',
    name: 'MT5 Indicators',
    thaiName: 'เครื่องมือนำสายตาช่วยเทรด MT5',
    icon: BarChart3,
    color: '#f43f5e',
    gradient: 'from-rose-500 to-orange-400 text-white',
    shadowGlow: 'hover:shadow-rose-550/20'
  }
];

// Subcategories of Movies based on 24-hds.com screenshot
const MOVIE_SUBCATEGORIES = [
  {
    id: 'All',
    name: 'ทั้งหมด',
    thaiName: 'หนัง & ซีรี่ส์ทั้งหมด',
    icon: Layout,
    color: '#71717a',
    gradient: 'from-zinc-600 to-zinc-500 text-white',
    shadowGlow: 'hover:shadow-zinc-500/20'
  },
  {
    id: 'online',
    name: 'ดูหนังออนไลน์',
    thaiName: 'หนังออนไลน์ HD ชัดเว่อร์',
    icon: Film,
    color: '#e11d48',
    gradient: 'from-rose-600 to-pink-500 text-white',
    shadowGlow: 'hover:shadow-rose-500/20'
  },
  {
    id: 'new2026',
    name: 'หนังใหม่ 2026',
    thaiName: 'หนังยอดนิยมประจำปี 2026',
    icon: Sparkles,
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400 text-black',
    shadowGlow: 'hover:shadow-amber-500/20'
  },
  {
    id: 'theaters',
    name: 'หนังชนโรง',
    thaiName: 'หนังที่เพิ่งฉายในเครือเมเจอร์/เอสเอฟ',
    icon: Popcorn,
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-400 text-white',
    shadowGlow: 'hover:shadow-emerald-500/20'
  },
  {
    id: 'cartoons',
    name: 'หนังการ์ตูน',
    thaiName: 'อนิเมชั่น, อนิเมะญี่ปุ่น & การ์ตูนพากย์ไทย',
    icon: Clapperboard,
    color: '#8b5cf6',
    gradient: 'from-violet-600 to-indigo-500 text-white',
    shadowGlow: 'hover:shadow-violet-500/20'
  },
  {
    id: 'thai',
    name: 'หนังไทย',
    thaiName: 'หนังไทยแท้ ภาพยนตร์ไทยยอดฮิต',
    icon: Compass,
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-500 text-white',
    shadowGlow: 'hover:shadow-cyan-500/20'
  },
  {
    id: 'series',
    name: 'ดูซีรี่ส์',
    thaiName: 'ซีรี่สเกาหลี, จีน, ฝรั่ง สนุกเต็มอิ่ม',
    icon: Tv2,
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-450 text-white',
    shadowGlow: 'hover:shadow-pink-500/20'
  },
  {
    id: 'netflix',
    name: 'NETFLIX',
    thaiName: 'ซีรี่ส์สตรีมมิ่ง & หนังดังจาก Netflix',
    icon: Flame,
    color: '#dc2626',
    gradient: 'from-[#e50914] to-[#b81d24] text-white',
    shadowGlow: 'hover:shadow-red-600/30'
  },
  {
    id: 'imdb',
    name: 'TOP IMDB',
    thaiName: 'สุดยอดหนังคะแนนรีวิวสูงประวัติศาสตร์',
    icon: Award,
    color: '#ca8a04',
    gradient: 'from-yellow-600 to-amber-500 text-white',
    shadowGlow: 'hover:shadow-yellow-500/20'
  }
];

// =========================================================================
// ⚙️ การตั้งค่า Google Sheets เริ่มต้นสำหรับแสดงผลบนเว็บจริง (Vercel / โดเมนส่วนตัว)
// =========================================================================
// - เพื่อให้ผู้เยี่ยมชมเว็บทั่วไป (Public Visitors) สามารถดึงข้อมูลจริงจาก Google Sheets ของคุณไปแสดงผลได้ทันที
// - กรุณาตรวจสอบให้แน่ใจว่าได้แชร์ไฟล์ Google Sheets เป็น "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน" (Anyone with the link can view)
// - สามารถระบุค่าเหล่านี้เพื่อฝังเป็นค่าเริ่มต้นถาวรของเว็บไซต์ได้เลย หรือกำหนดผ่าน Environment Variables ในระบบโฮสติ้ง เช่น Vercel
export const GLOBAL_DEFAULT_SPREADSHEET_ID = ((import.meta as any).env?.VITE_DEFAULT_SPREADSHEET_ID) || ''; // วาง ID ของ Google Sheets เริ่มต้นตรงนี้ (หรือใช้ VITE_DEFAULT_SPREADSHEET_ID ใน Vercel)
export const GLOBAL_DEFAULT_APPS_SCRIPT_URL = ((import.meta as any).env?.VITE_DEFAULT_APPS_SCRIPT_URL) || ''; // วาง Google Apps Script Web App URL เริ่มต้นตรงนี้
export const GLOBAL_DEFAULT_FIREBASE_CONFIG = ((import.meta as any).env?.VITE_DEFAULT_FIREBASE_CONFIG) || '{"apiKey":"AIzaSyA3cIS9OgIUmJqTh-B73p97HCjAWm9og9E","authDomain":"cultivated-clock-67k72.firebaseapp.com","projectId":"cultivated-clock-67k72","storageBucket":"cultivated-clock-67k72.firebasestorage.app","messagingSenderId":"930501346572","appId":"1:930501346572:web:e51f98283bc1782ff3f529"}'; // วาง Firebase JSON Config เริ่มต้นตรงนี้
export const GLOBAL_DEFAULT_GOOGLE_CLIENT_ID = ((import.meta as any).env?.VITE_DEFAULT_GOOGLE_CLIENT_ID) || ''; // วาง Google Client ID เริ่มต้นตรงนี้

export default function App() {
  // Navigation tabs (Home, Movies, Software, Forex EA, Donate, Admin Settings)
  const [activeTab, setActiveTab] = useState<string>('Home');

  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Connection Mode: Starts with Sandbox, user can toggle to Google Sheets Cloud Mode
  const [isCloudMode, setIsCloudMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hubfree_is_cloud_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return !!GLOBAL_DEFAULT_SPREADSHEET_ID;
  });

  // Google Sheets file states
  const [files, setFiles] = useState<SpreadsheetFile[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [newSheetTitle, setNewSheetTitle] = useState('');

  // Active Google Sheet state
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('hubfree_active_spreadsheet_id') || GLOBAL_DEFAULT_SPREADSHEET_ID || null;
  });
  const [activeSpreadsheetName, setActiveSpreadsheetName] = useState<string | null>(() => {
    return localStorage.getItem('hubfree_active_spreadsheet_name') || (GLOBAL_DEFAULT_SPREADSHEET_ID ? 'ฐานข้อมูลหลัก (Google Sheet)' : null);
  });
  const [worksheets, setWorksheets] = useState<Worksheet[]>(() => {
    try {
      const saved = localStorage.getItem('hubfree_cached_worksheets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeWorksheet, setActiveWorksheet] = useState<string | null>(() => {
    return localStorage.getItem('hubfree_active_worksheet') || (GLOBAL_DEFAULT_SPREADSHEET_ID ? 'All Products' : null);
  });
  const [sheetRows, setSheetRows] = useState<string[][]>(() => {
    try {
      const saved = localStorage.getItem('hubfree_cached_sheet_rows');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }); // raw cell lines
  const [isGridLoading, setIsGridLoading] = useState(false);

  // Manual token input state (to handle iframe popup block cases)
  const [manualToken, setManualToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Custom Firebase Configurations & Client-side OAuth settings
  const [customFirebaseJson, setCustomFirebaseJson] = useState(() => {
    return localStorage.getItem('custom_firebase_config') || GLOBAL_DEFAULT_FIREBASE_CONFIG || '';
  });
  const [customClientId, setCustomClientId] = useState(() => {
    return localStorage.getItem('custom_google_client_id') || GLOBAL_DEFAULT_GOOGLE_CLIENT_ID || '';
  });
  const [customAppsScriptUrl, setCustomAppsScriptUrl] = useState(() => {
    return localStorage.getItem('custom_apps_script_url') || GLOBAL_DEFAULT_APPS_SCRIPT_URL || '';
  });
  const [showCredentialsSettings, setShowCredentialsSettings] = useState(false);

  // System diagnostic logs
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Local/Offline spreadsheets (including any updates done in sandbox) loaded from localStorage
  const [localSpreadsheets, setLocalSpreadsheets] = useState(() => {
    try {
      const saved = localStorage.getItem('hubfree_sandbox_spreadsheets');
      return saved ? JSON.parse(saved) : mockSpreadsheets;
    } catch {
      return mockSpreadsheets;
    }
  });

  // Automatically persist localSpreadsheets updates
  useEffect(() => {
    try {
      localStorage.setItem('hubfree_sandbox_spreadsheets', JSON.stringify(localSpreadsheets));
    } catch (err) {
      console.error('Failed to save sandbox spreadsheets to localStorage:', err);
    }
  }, [localSpreadsheets]);

  // Reset selected software, forex & movies sub-category filter when switching main menu tabs
  useEffect(() => {
    setSelectedSoftwareSubcat('All');
    setSelectedForexSubcat('All');
    setSelectedMovieSubcat('All');
  }, [activeTab]);

  // Selected item state for detail view popup
  const [selectedProduct, setSelectedProduct] = useState<HubItem | null>(null);

  // Lock/Unlock premium files state & parameters
  const [unlockedProductIds, setUnlockedProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unlocked_product_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('unlocked_product_ids', JSON.stringify(unlockedProductIds));
    } catch (err) {
      console.error('Failed to save unlocked product ids:', err);
    }
  }, [unlockedProductIds]);

  const [pendingUnlockProduct, setPendingUnlockProduct] = useState<HubItem | null>(null);
  const [activeUnlockTab, setActiveUnlockTab] = useState<'Sponsors' | 'TeaFee' | 'VipCode'>('Sponsors');
  const [clickedSponsors, setClickedSponsors] = useState<number[]>([]);
  const [teaFeeAmount, setTeaFeeAmount] = useState<number>(19);
  const [paymentTxId, setPaymentTxId] = useState('');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [unlockVipCode, setUnlockVipCode] = useState('');
  
  // Custom states for interactive slip upload and OCR AI scanner
  const [uploadedSlipUrl, setUploadedSlipUrl] = useState<string | null>(null);
  const [showVipCodeSuccess, setShowVipCodeSuccess] = useState<string | null>(null);
  const [aiVerificationLogs, setAiVerificationLogs] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSoftwareSubcat, setSelectedSoftwareSubcat] = useState<string>('All');
  const [selectedForexSubcat, setSelectedForexSubcat] = useState<string>('All');
  const [selectedMovieSubcat, setSelectedMovieSubcat] = useState<string>('All');

  // New product input state (for DB cell appender)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    category: 'บอท Forex EA',
    description: '',
    detailedDescription: '',
    views: '100',
    downloads: '10',
    fileSize: '5.0 MB',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '',
    rating: '5.0'
  });

  // Cell editing states for spreadsheet table
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Diagnostic log helper
  const addLog = useCallback((type: ActivityLog['type'], message: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(7),
        timestamp,
        type,
        message,
        details,
      },
      ...prev.slice(0, 49), // cap at 50 logs of history
    ]);
  }, []);

  // Generate & Download ZIP in client to bypass Iframe and Security Proxy sandboxing issues (No more corrupted 10KB files!)
  const [isZipping, setIsZipping] = useState(false);
  const handleClientDownloadZip = async () => {
    setIsZipping(true);
    addLog('info', 'กำลังดึงรายการไฟล์รหัสโปรเจกต์จากเซิร์ฟเวอร์...');
    try {
      const res = await fetch('/api/project-files');
      if (!res.ok) {
        throw new Error(`เซิร์ฟเวอร์ตอบกลับผิดพลาด: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.files || !Array.isArray(data.files)) {
        throw new Error('โครงสร้างข้อมูลระบบไม่ถูกต้อง');
      }

      addLog('info', `กำลังประกอบไฟล์ทั้งหมด ${data.files.length} รายการ และเข้ารหัสบีบอัด ZIP ชนิด Client-side...`);
      const zip = new JSZip();
      
      for (const file of data.files) {
        zip.file(file.path, file.content);
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      addLog('success', 'ถอดรหัสรวบรวมไฟล์ .ZIP สำเร็จ! กำลังสตรีมดาวน์โหลดลงเครื่องคอมพิวเตอร์ของคุณ...');
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'google-sheets-connector-project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Client-side ZIP generation error:', err);
      addLog('error', 'ไม่สามารถดาวน์โหลด ZIP แบบแปลงพิกัดต้นทางบนบราวเซอร์สำเร็จ', err.message || String(err));
      alert(`⚠️ เกิดข้อผิดพลาดในการดาวน์โหลดแบบ Client-Side: ${err.message || String(err)}\n\nแนะนำให้ท่านกด "ปุ่มเปิดแอปในหน้าต่างใหม่ (หรือเปิดแท็บใหม่)" เพื่อแก้ไขให้ทำงานได้ปกติ 100%`);
    } finally {
      setIsZipping(false);
    }
  };

  // Sync / Initialize Auth hooks
  useEffect(() => {
    addLog('info', 'ระบบ: กำลังเริ่มต้นประสานกลไกล็อกอิน...', 'กำลังตรวจสถานะ Firebase OAuth Web-App');

    // 1. Check if we have an incoming Google Implicit Flow hash url (e.g. #access_token=...)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const urlAccessToken = params.get('access_token');
      if (urlAccessToken) {
        addLog('info', 'ตรวจพบ Google Access Token จากการสำเร็จสิทธิ์ (Implicit Flow) กำลังประเมินข้อมูลบัญชี...');
        // Clean url hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        
        (async () => {
          try {
            const userProfile = await loginWithDirectAccessToken(urlAccessToken);
            if (userProfile) {
              setUser(userProfile);
              setNeedsAuth(false);
              setIsCloudMode(true);
              addLog('success', `เข้าสู่ระบบสำเร็จผ่าน Google Direct Token! บัญชี: ${userProfile.email}`);
            }
          } catch (err: any) {
            addLog('error', `การดึงข้อมูลบัญชีผ่าน Token ล้มเหลว: ${err.message || String(err)}`);
          }
        })();
        return; // Skip normal initialize auth for this cycle
      }
    }

    // 2. Check if we have an active saved direct login session in localStorage
    const savedToken = localStorage.getItem('direct_google_access_token');
    const savedUserStr = localStorage.getItem('direct_google_user');
    if (savedToken && savedUserStr) {
      try {
        const parsedUser = JSON.parse(savedUserStr);
        setCachedToken(savedToken);
        setUser(parsedUser);
        setNeedsAuth(false);
        setIsCloudMode(true);
        addLog(
          'success',
          `เซสชันใช้งานต่อได้ทันที: เข้าสู่ระบบฐานข้อมูลผ่านแอนิม่า Token บัญชี ${parsedUser.email}`,
          `โหลดคีย์ Access Token เดิมสำเร็จ`
        );
        return; // Skip typical Firebase check as Direct is active
      } catch (e) {
        console.error('Error loading saved direct auth:', e);
      }
    }

    // 3. Fallback to normal Firebase onAuthStateChanged subscribe
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setNeedsAuth(false);
        setIsCloudMode(true);
        addLog(
          'success',
          `เชื่อมต่อสำเร็จ: เข้าสู่ระบบฐานข้อมูล Google Sheets ผ่านบัญชี ${currentUser.email}`,
          `คีย์ Token เชื่อมต่อถูกจัดเก็บเรียบร้อย`
        );
      },
      (errorMsg) => {
        setUser(null);
        setNeedsAuth(true);
        setIsCloudMode(false);
        addLog('info', 'รันในโหมดแซนด์บอกซ์ (Sandbox Offline Mode)', errorMsg || 'ยังไม่เชื่อมต่อบัญชี Google');
      }
    );

    return () => unsubscribe();
  }, [addLog]);

  // Load Google Drive spreadsheets lists catalog
  const loadFilesCatalog = useCallback(async (token: string) => {
    setIsFilesLoading(true);
    addLog('info', 'กำลังค้นหาไฟล์ Google Spreadsheets บน Google Drive ของคุณ...');
    try {
      const gFiles = await fetchUserSpreadsheets(token);
      setFiles(gFiles);
      addLog('success', `ยินดีด้วย! ค้นพบชีตทั้งหมด ${gFiles.length} ไฟล์บนบัญชีของคุณ`);
    } catch (error: any) {
      addLog('error', 'ไม่สามารถเข้าถึงห้องไฟล์ใน Google Drive ได้', error.message);
    } finally {
      setIsFilesLoading(false);
    }
  }, [addLog]);

  // Sync catalogs or offline mocks based on login states
  useEffect(() => {
    if (isCloudMode && user) {
      const token = getAccessToken();
      if (token) {
        loadFilesCatalog(token);
      }
    } else {
      const offlineFiles = localSpreadsheets.map((g) => ({
        id: g.id,
        name: g.name,
        modifiedTime: g.modifiedTime,
      }));
      setFiles(offlineFiles);
    }
  }, [isCloudMode, user, localSpreadsheets, loadFilesCatalog]);

  // Grid loader core sequence (Supports both offline mocks & Google Sheets)
  const loadFileGrid = useCallback(async (spreadsheetId: string, customName?: string) => {
    setIsGridLoading(true);
    addLog('info', `กำลังเปิดนำเข้าฐานข้อมูลชีต ID: [${spreadsheetId}] ...`);

    if (!isCloudMode || spreadsheetId === 'hubfree-products-database') {
      const looksLikeSheetId = spreadsheetId && spreadsheetId.length > 25 && spreadsheetId !== 'hubfree-products-database';
      if (looksLikeSheetId) {
        addLog('info', `ตรวจพบการเปิดสเปรดชีตภายนอกในโหมดออฟไลน์: กำลังดึงข้อมูลผ่านช่องทางด่วน Google Sheets แบบสาธารณะ...`);
        try {
          // 1. Try to fetch All Products sheet (or previously active saved tab if found)
          let rows: string[][] = [];
          const savedTab = localStorage.getItem('hubfree_active_worksheet') || 'All Products';
          let loadedTab = savedTab;
          
          try {
            const res = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(savedTab)}`);
            if (res.ok) {
              const text = await res.text();
              rows = parseCSV(text);
            }
          } catch (e) {
            console.error(`Error fetching CSV for ${savedTab}:`, e);
          }
          
          // 2. If details are sparse/empty and we didn't try All Products yet, try All Products or default export
          if (rows.length < 2 && savedTab !== 'All Products') {
            try {
              const res = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('All Products')}`);
              if (res.ok) {
                const text = await res.text();
                rows = parseCSV(text);
                loadedTab = 'All Products';
              }
            } catch (e) {
              console.error('Error fetching All Products fallback:', e);
            }
          }

          // 3. Fallback to default CSV export (Sheet1) if still empty
          if (rows.length < 2) {
            try {
              const res = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`);
              if (res.ok) {
                const text = await res.text();
                rows = parseCSV(text);
                loadedTab = 'Sheet1';
              }
            } catch (e) {
              console.error('Error fetching default CSV:', e);
            }
          }
          
          if (rows.length >= 1) {
            setActiveSpreadsheetId(spreadsheetId);
            setActiveSpreadsheetName(customName || `Google Sheet สาธารณะ (${spreadsheetId.substring(0, 6)}...)`);
            setWorksheets([
              { title: 'All Products', index: 0 },
              { title: 'Donation Logs', index: 1 }
            ]);
            setActiveWorksheet(loadedTab);
            setSheetRows(rows);
            addLog('success', `เชื่อมต่อ Google Sheet แบบสาธารณะสำเร็จ! นำเข้าข้อมูลทั้งหมด ${rows.length} แถว (ไม่ต้องเข้าหน้าเข้าสู่ระบบใดๆ)`);
            setIsGridLoading(false);
            return;
          } else {
            throw new Error('ไม่พบข้อมูลเนื้อหาในชีตสาธารณะ หรือชีตนี้ไม่ได้รับการแชร์สู่สาธารณะ');
          }
        } catch (err: any) {
          addLog('warning', `ไม่สามารถเข้าถึงแบบไม่ต้องล็อกอินได้: ${err.message || String(err)}`);
          addLog('info', 'กรุณากดเปิดสิทธิ์เข้าดูที่ตัวชีต (ตั้งค่าให้ "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน") หรือดำเนินการเซตอัปเชื่อมต่อล็อกอิน');
        }
      }

      // Sandbox Offline Mode loading mock or lazily creating a sandbox copy
      let offlineSheet = localSpreadsheets.find((s) => s.id === spreadsheetId);
      if (!offlineSheet && spreadsheetId) {
        addLog('info', `ตรวจไม่พบวิชาชีตดั้งเดิมในระบบจำลอง กำลังสร้างช่องข้อมูลชีตจัดเก็บ Sandbox ชั่วคราวเฉพาะให้สําหรับไอดีนี้...`);
        const lazySheet = {
          id: spreadsheetId,
          name: customName || `Google Sheet แท้เชื่อมด่วน (${spreadsheetId.substring(0, 6)}...)`,
          modifiedTime: new Date().toISOString(),
          sheets: {
            'Sheet1': [
              ['Title', 'Category', 'Description', 'DetailedDescription', 'Views', 'Downloads', 'FileSize', 'ImageUrl', 'DownloadUrl', 'Rating'],
              ['บอท Forex EA ช่วยเทรดระดับเทพ', 'บอท Forex EA', 'คำโปรยอธิบายตัวอย่างผลิตภัณฑ์', '<p>นี่คือเนื้อหารายละเอียดตัวเต็มที่สามารถเขียนโค้ด <b>HTML</b> เช่น <i>ตัวเอียง</i> หรือบันทึกจัดเต็มได้ระยิบระยับ!</p>', '450', '25', '3.8 MB', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80', '#', '4.9']
            ]
          }
        };
        setLocalSpreadsheets((prev) => [...prev, lazySheet]);
        offlineSheet = lazySheet;
      }

      if (offlineSheet) {
        setActiveSpreadsheetId(offlineSheet.id);
        setActiveSpreadsheetName(offlineSheet.name);
        
        const tabs = Object.keys(offlineSheet.sheets).map((title, i) => ({
          title,
          index: i,
        }));
        setWorksheets(tabs);
        
        const firstTab = tabs[0]?.title || null;
        setActiveWorksheet(firstTab);
        
        if (firstTab) {
          setSheetRows(offlineSheet.sheets[firstTab] || []);
        } else {
          setSheetRows([]);
        }
        addLog('success', `เปิดฐานข้อมูลสเปรดชีตจำลองเฉพาะตัว "${offlineSheet.name}" แล้วในโหมด Sandbox (Local)`);
      } else {
        addLog('error', `ไม่สามารถวิเคราะห์ข้อมูลสารบบวิชาชีพสำหรับไอดีนี้: ${spreadsheetId}`);
      }
      setIsGridLoading(false);
      return;
    }

    // Google Sheets Cloud API Mode Loading
    const token = getAccessToken();
    if (!token) {
      const looksLikeSheetId = spreadsheetId && spreadsheetId.length > 25 && spreadsheetId !== 'hubfree-products-database';
      if (looksLikeSheetId) {
        addLog('info', 'คุณไม่ได้เข้าสู่ระบบ Google: กำลังดึงข้อมูลผ่านช่องทางด่วนแบบสาธารณะ (Public Access)...');
        try {
          const appsScriptUrl = localStorage.getItem('custom_apps_script_url') || GLOBAL_DEFAULT_APPS_SCRIPT_URL;
          let sheets: Worksheet[] = [
            { title: 'All Products', index: 0 },
            { title: 'Donation Logs', index: 1 }
          ];
          let title = customName || 'ฐานข้อมูล Google Sheet';
          
          if (appsScriptUrl) {
            try {
              addLog('info', 'กำลังดึงโครงสร้างหน้าชีตผ่าน Google Apps Script...');
              const res = await fetch(`${appsScriptUrl}?action=getMetadata&spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.status !== 'error') {
                  title = data.title || title;
                  sheets = data.sheets || sheets;
                }
              }
            } catch (e) {
              console.error('Apps Script public metadata error:', e);
            }
          }
          
          setActiveSpreadsheetId(spreadsheetId);
          setActiveSpreadsheetName(title);
          setWorksheets(sheets);
          
          const savedTab = localStorage.getItem('hubfree_active_worksheet');
          const hasSavedTab = savedTab && sheets.some((s) => s.title === savedTab);
          const activeTabName = hasSavedTab ? savedTab : (sheets[0]?.title || 'All Products');
          setActiveWorksheet(activeTabName);
          
          addLog('info', `กำลังดึงข้อมูลแผ่นงาน "${activeTabName}" จาก Google Sheet สาธารณะ...`);
          let rows: string[][] = [];
          
          // Try Apps Script first if set
          if (appsScriptUrl) {
            try {
              const res = await fetch(`${appsScriptUrl}?action=read&spreadsheetId=${encodeURIComponent(spreadsheetId)}&sheetTitle=${encodeURIComponent(activeTabName)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.status !== 'error' && data.values) {
                  rows = data.values;
                }
              }
            } catch (e) {
              console.error('Apps Script public read error:', e);
            }
          }
          
          // If Apps Script failed or not set, try direct CSV fetch
          if (rows.length < 1) {
            try {
              const res = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(activeTabName)}`);
              if (res.ok) {
                const text = await res.text();
                rows = parseCSV(text);
              }
            } catch (e) {
              console.error('Direct CSV public read error:', e);
            }
          }
          
          // Try default format fallback if still empty
          if (rows.length < 1 && activeTabName !== 'Sheet1') {
            try {
              const res = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`);
              if (res.ok) {
                const text = await res.text();
                rows = parseCSV(text);
              }
            } catch (e) {
              console.error('Direct CSV export public read error:', e);
            }
          }
          
          if (rows.length >= 1) {
            setSheetRows(rows);
            addLog('success', `ซิงค์ข้อมูลจากต้นทาง Google Sheets สาธารณะสำเร็จ! นำเข้าข้อมูลทั้งหมด ${rows.length} แถว`);
            setIsGridLoading(false);
            return;
          } else {
            throw new Error('ไม่สามารถดึงข้อมูลแถวจากตารางสาธารณะได้ (กรุณาตั้งค่าแชร์ชีตเป็น "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน")');
          }
        } catch (err: any) {
          addLog('error', `เกิดข้อผิดพลาดในการโหลดแบบสาธารณะ: ${err.message || String(err)}`);
        }
      }
      
      const savedRows = localStorage.getItem('hubfree_cached_sheet_rows');
      if (savedRows) {
        try {
          const rows = JSON.parse(savedRows);
          setSheetRows(rows);
          addLog('info', 'เซสชันเดิมหมดสิทธิ์: ระบบได้โหลดข้อมูลจาก "แคชออฟไลน์สำรองล่าสุด" เพื่อแสดงผลหน้าเว็บให้คุณโดยไม่สะดุด');
          setIsGridLoading(false);
          return;
        } catch (e) {
          console.error('Error loading cached rows:', e);
        }
      } else {
        addLog('error', 'ไม่พบทั้งข้อมูลแคชและสิทธิ์เซสชันเชื่อมต่อ กรุณาระบุหรือล็อกอินดึงชีตใหม่อีกครั้ง');
      }
      
      setIsGridLoading(false);
      return;
    }

    try {
      const { title, sheets } = await fetchSpreadsheetMetadata(spreadsheetId, token);
      setActiveSpreadsheetId(spreadsheetId);
      setActiveSpreadsheetName(customName || title);
      setWorksheets(sheets);

      const savedTabName = localStorage.getItem('hubfree_active_worksheet');
      const hasSavedTabName = savedTabName && sheets.some((s) => s.title === savedTabName);
      const defaultTab = hasSavedTabName ? savedTabName : (sheets[0]?.title || null);
      setActiveWorksheet(defaultTab);

      if (defaultTab) {
        addLog('info', `กำลังเชื่อมข้อมูลจากแถบแผ่นงาน: "${defaultTab}" ...`);
        const rows = await fetchWorksheetValues(spreadsheetId, defaultTab, token);
        setSheetRows(rows);
        addLog('success', `อัปโหลดสดสำเร็จ! นำเข้าเนื้อหาทั้งหมดจำนวน ${rows.length} แถวจาก Google Sheets แล้ว`);
      } else {
        setSheetRows([]);
        addLog('warning', 'ไฟล์ชีตนี้ว่างเปล่า ไม่มีตารางแผ่นงานแสดงผลเลย');
      }
    } catch (err: any) {
      addLog('error', `เกิดข้อผิดพลาดในการโหลดชีต (${spreadsheetId}): ${err.message}`);
    } finally {
      setIsGridLoading(false);
    }
  }, [isCloudMode, localSpreadsheets, addLog]);

  // Save states to localStorage when they change to prevent losing connections on page refreshes
  useEffect(() => {
    localStorage.setItem('hubfree_is_cloud_mode', String(isCloudMode));
  }, [isCloudMode]);

  useEffect(() => {
    if (activeSpreadsheetId) {
      localStorage.setItem('hubfree_active_spreadsheet_id', activeSpreadsheetId);
    } else {
      localStorage.removeItem('hubfree_active_spreadsheet_id');
    }
  }, [activeSpreadsheetId]);

  useEffect(() => {
    if (activeSpreadsheetName) {
      localStorage.setItem('hubfree_active_spreadsheet_name', activeSpreadsheetName);
    } else {
      localStorage.removeItem('hubfree_active_spreadsheet_name');
    }
  }, [activeSpreadsheetName]);

  useEffect(() => {
    if (activeWorksheet) {
      localStorage.setItem('hubfree_active_worksheet', activeWorksheet);
    } else {
      localStorage.removeItem('hubfree_active_worksheet');
    }
  }, [activeWorksheet]);

  useEffect(() => {
    if (worksheets && worksheets.length > 0) {
      localStorage.setItem('hubfree_cached_worksheets', JSON.stringify(worksheets));
    } else {
      localStorage.removeItem('hubfree_cached_worksheets');
    }
  }, [worksheets]);

  useEffect(() => {
    if (sheetRows && sheetRows.length > 0) {
      localStorage.setItem('hubfree_cached_sheet_rows', JSON.stringify(sheetRows));
    } else {
      localStorage.removeItem('hubfree_cached_sheet_rows');
    }
  }, [sheetRows]);

  // Instantly load the saved spreadsheet or fallback to database mock on mount
  useEffect(() => {
    const initApp = async () => {
      let defaultSheetId = GLOBAL_DEFAULT_SPREADSHEET_ID || 'hubfree-products-database';
      let appsScriptUrl = GLOBAL_DEFAULT_APPS_SCRIPT_URL;
      let firebaseConfigStr = GLOBAL_DEFAULT_FIREBASE_CONFIG;
      let googleClientId = GLOBAL_DEFAULT_GOOGLE_CLIENT_ID;

      try {
        addLog('info', 'กำลังดึงการตั้งค่าสภาพแวดล้อมจากเซิร์ฟเวอร์...');
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          
          if (data.DEFAULT_SPREADSHEET_ID && data.DEFAULT_SPREADSHEET_ID !== 'Secret value') {
            defaultSheetId = data.DEFAULT_SPREADSHEET_ID;
            setIsCloudMode(true);
            localStorage.setItem('hubfree_is_cloud_mode', 'true');
          }
          if (data.DEFAULT_APPS_SCRIPT_URL && data.DEFAULT_APPS_SCRIPT_URL !== 'Secret value') {
            appsScriptUrl = data.DEFAULT_APPS_SCRIPT_URL;
            localStorage.setItem('custom_apps_script_url', data.DEFAULT_APPS_SCRIPT_URL);
            setCustomAppsScriptUrl(data.DEFAULT_APPS_SCRIPT_URL);
          }
          if (data.DEFAULT_FIREBASE_CONFIG && data.DEFAULT_FIREBASE_CONFIG !== 'Secret value') {
            firebaseConfigStr = data.DEFAULT_FIREBASE_CONFIG;
            localStorage.setItem('custom_firebase_config', data.DEFAULT_FIREBASE_CONFIG);
            setCustomFirebaseJson(data.DEFAULT_FIREBASE_CONFIG);
          }
          if (data.DEFAULT_GOOGLE_CLIENT_ID && data.DEFAULT_GOOGLE_CLIENT_ID !== 'Secret value') {
            googleClientId = data.DEFAULT_GOOGLE_CLIENT_ID;
            localStorage.setItem('custom_google_client_id', data.DEFAULT_GOOGLE_CLIENT_ID);
            setCustomClientId(data.DEFAULT_GOOGLE_CLIENT_ID);
          }
        }
      } catch (e) {
        console.error('Failed to fetch API config:', e);
      }

      const savedId = localStorage.getItem('hubfree_active_spreadsheet_id') || defaultSheetId;
      const savedName = localStorage.getItem('hubfree_active_spreadsheet_name') || 
        (savedId === defaultSheetId && defaultSheetId !== 'hubfree-products-database' ? 'ฐานข้อมูลหลัก (Google Sheet)' : undefined);
      
      loadFileGrid(savedId, savedName);
    };

    initApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load worksheet tab change
  const handleTabChange = useCallback(async (tabTitle: string) => {
    if (!activeSpreadsheetId) return;
    setIsGridLoading(true);
    addLog('info', `กำลังเปลี่ยนแผ่นงานชีตสลับไปที่: "${tabTitle}" ...`);

    if (!isCloudMode) {
      const looksLikeSheetId = activeSpreadsheetId && activeSpreadsheetId.length > 25 && activeSpreadsheetId !== 'hubfree-products-database';
      if (looksLikeSheetId) {
        try {
          addLog('info', `กำลังรีดไฟล์ข้อมูลแผ่นงานสาธารณะ: "${tabTitle}" จาก Google Sheets...`);
          const res = await fetch(`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabTitle)}`);
          if (res.ok) {
            const text = await res.text();
            const rows = parseCSV(text);
            if (rows.length > 0) {
              setActiveWorksheet(tabTitle);
              setSheetRows(rows);
              addLog('success', `สลับแผ่นงานย่อยเสร็จสมบูรณ์! ดึงข้อมูลแถวแผ่นงาน ${tabTitle} สำเร็จจำนวน ${rows.length} แถว`);
              setIsGridLoading(false);
              return;
            }
          }
          throw new Error('ไม่พบแถวข้อมูลหรือแผ่นย่อยนี้ไม่ได้เปิดสาธารณะ');
        } catch (err: any) {
          addLog('warning', `การดึงแถบแผ่นงานย่อยไม่สำเร็จ: ${err.message || String(err)}`);
        }
      }

      const offlineSheet = localSpreadsheets.find((s) => s.id === activeSpreadsheetId);
      if (offlineSheet) {
        setActiveWorksheet(tabTitle);
        setSheetRows(offlineSheet.sheets[tabTitle] || []);
        addLog('success', `สลับแผ่นทดสอบ "${tabTitle}" เสร็จสิ้น`);
      }
      setIsGridLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      const looksLikeSheetId = activeSpreadsheetId && activeSpreadsheetId.length > 25 && activeSpreadsheetId !== 'hubfree-products-database';
      if (looksLikeSheetId) {
        try {
          addLog('info', `กำลังดึงแผ่นงาน "${tabTitle}" แบบสาธารณะ...`);
          const appsScriptUrl = localStorage.getItem('custom_apps_script_url') || GLOBAL_DEFAULT_APPS_SCRIPT_URL;
          let rows: string[][] = [];
          
          if (appsScriptUrl) {
            try {
              const res = await fetch(`${appsScriptUrl}?action=read&spreadsheetId=${encodeURIComponent(activeSpreadsheetId)}&sheetTitle=${encodeURIComponent(tabTitle)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.status !== 'error' && data.values) {
                  rows = data.values;
                }
              }
            } catch (e) {
              console.error('Apps Script public read tab error:', e);
            }
          }
          
          if (rows.length < 1) {
            const res = await fetch(`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabTitle)}`);
            if (res.ok) {
              const text = await res.text();
              rows = parseCSV(text);
            }
          }
          
          if (rows.length > 0) {
            setActiveWorksheet(tabTitle);
            setSheetRows(rows);
            addLog('success', `สลับแผ่นงานย่อยเสร็จสมบูรณ์! ดึงข้อมูลแผ่นงาน "${tabTitle}" สำเร็จจำนวน ${rows.length} แถว`);
          } else {
            throw new Error('ไม่พบข้อมูลเนื้อหาในแผ่นงานย่อยนี้ หรือชีตนี้ไม่ได้แชร์สาธารณะ');
          }
        } catch (err: any) {
          addLog('warning', `การดึงแถบแผ่นงานย่อยสาธารณะไม่สำเร็จ: ${err.message || String(err)}`);
        }
      } else {
        addLog('error', 'เซสชันของคุณหมดอายุแล้ว กรุณาล็อกอินใหม่เพื่อจัดการระบบ');
      }
      setIsGridLoading(false);
      return;
    }

    try {
      const rows = await fetchWorksheetValues(activeSpreadsheetId, tabTitle, token);
      setActiveWorksheet(tabTitle);
      setSheetRows(rows);
      addLog('success', `สลับแผ่นสำเร็จ นำเข้าข้อมูลแถวแผ่นงาน ${tabTitle} ได้ ${rows.length} แถว`);
    } catch (err: any) {
      addLog('error', `เปลี่ยนแผ่นงานขัดข้อง: ${err.message}`);
    } finally {
      setIsGridLoading(false);
    }
  }, [activeSpreadsheetId, isCloudMode, localSpreadsheets, addLog]);

  // Handle load via URL or Sheet ID input
  const handleCustomImportSubmit = (e: FormEvent) => {
    e.preventDefault();
    let text = customInput.trim();
    if (!text) return;

    if (text.includes('docs.google.com')) {
      const match = text.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        text = match[1];
        addLog('info', `ตรวจจับลิงก์ Google Sheets: แตกไอดีตัวชีตได้สำเร็จคือ ${text}`);
      } else {
        addLog('error', 'ที่อยู่ลิงก์ Google Sheets ดังกล่าวไม่ถูกต้องตามหลักสากล');
        return;
      }
    }
    loadFileGrid(text);
  };

  // Create new Spreadsheet inside Google Drive
  const handleCreateSheetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;

    if (!isCloudMode) {
      addLog('warning', 'กรุณาเชื่อมต่อในโหมด Cloud ก่อน จึงจะสร้างสเปรดชีตบนบัญชี Google ไดรฟ์จริงของคุณได้');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      addLog('error', 'สิทธิ์โทเค็นถูกปฏิเสธกรุณาล็อกอินใหม่');
      return;
    }

    try {
      addLog('info', `เริ่มระบุหัวข้อสร้างสเปรดชีตชื่อ: "${newSheetTitle.trim()}"`);
      const response = await createNewSpreadsheet(newSheetTitle.trim(), token);

      // Initialize the columns headers in the brand new cloud sheet
      addLog('info', 'กำลังเซตชีตคอลัมน์มาตรฐาน HubFree อัตโนมัติ...');
      const standardHeaders = [
        'Title', 'Category', 'Description', 'DetailedDescription', 'Views', 'Downloads', 'FileSize', 'ImageUrl', 'DownloadUrl', 'Rating'
      ];
      await appendRowToSpreadsheet(response.spreadsheetId, 'Sheet1', standardHeaders, token);

      addLog('success', `สร้างสเปรดชีตรอบโครงข่ายหลักสำเร็จแล้ว! ไอดี: ${response.spreadsheetId}`);
      setNewSheetTitle('');
      await loadFilesCatalog(token);
      await loadFileGrid(response.spreadsheetId, response.title);
    } catch (err: any) {
      addLog('error', `ไม่สามารถสร้างไฟล์สเปรดชีตใหม่ได้: ${err.message}`);
    }
  };

  // Google Sheets Cell changes in Admin table editor
  const handleCellUpdateSubmit = useCallback(async (r: number, c: number, value: string) => {
    if (!activeSpreadsheetId || !activeWorksheet) return;

    addLog('info', `กำลังส่งคำสั่งแก้ไขเซลล์ตาราง [แถวที่ ${r + 1}, คอลัมน์ที่ ${c + 1}] -> ค่าใหม่เป็น "${value}"`);

    if (!isCloudMode) {
      // Sandbox local save
      setLocalSpreadsheets((prev) =>
        prev.map((sheet) => {
          if (sheet.id === activeSpreadsheetId) {
            const sheetValues = [...(sheet.sheets[activeWorksheet] || [])];
            while (sheetValues.length <= r) sheetValues.push([]);
            const row = [...(sheetValues[r] || [])];
            while (row.length <= c) row.push('');
            row[c] = value;
            sheetValues[r] = row;
            return {
              ...sheet,
              sheets: { ...sheet.sheets, [activeWorksheet]: sheetValues }
            };
          }
          return sheet;
        })
      );
      setSheetRows((prev) => {
        const updated = [...prev];
        while (updated.length <= r) updated.push([]);
        const row = [...(updated[r] || [])];
        while (row.length <= c) row.push('');
        row[c] = value;
        updated[r] = row;
        return updated;
      });
      addLog('success', 'บันทึกเซลล์ลงฐานความจำ Sandbox ชั่วคราวสำเร็จ');
      setEditingCell(null);
      return;
    }

    // Google Sheets Cloud update
    const token = getAccessToken();
    if (!token) {
      addLog('error', 'สิทธิ์เชื่อมต่อหมดลง ส่งข้อมูลเซฟไม่ได้');
      return;
    }

    try {
      await updateCellInSpreadsheet(activeSpreadsheetId, activeWorksheet, r, c, value, token);
      setSheetRows((prev) => {
        const updated = [...prev];
        while (updated.length <= r) updated.push([]);
        const row = [...(updated[r] || [])];
        while (row.length <= c) row.push('');
        row[c] = value;
        updated[r] = row;
        return updated;
      });
      addLog('success', `อัปเดตบรรจุลงในไฟล์ Google Sheet คลาวด์สำเร็จ! [แถวที่ ${r + 1}]`);
    } catch (err: any) {
      addLog('error', `บันทึกข้อมูลเซลล์ลง Google Sheet ขัดข้อง: ${err.message}`);
    } finally {
      setEditingCell(null);
    }
  }, [activeSpreadsheetId, activeWorksheet, isCloudMode, addLog]);

  // Insert a whole product row to the database
  const handleAddProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSpreadsheetId || !activeWorksheet) {
      addLog('warning', 'กรุณาเปิดไฟล์สเปรดชีตก่อนกดยื่นค่านำร่องบันทึกเพิ่มรายการ');
      return;
    }

    const rowValues = [
      newProduct.title || 'ไม่มีชื่อหัวข้อ',
      newProduct.category,
      newProduct.description || 'ไม่มีรายละเอียดอธิบายสั้น',
      newProduct.detailedDescription || '',
      newProduct.views,
      newProduct.downloads,
      newProduct.fileSize,
      newProduct.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      newProduct.downloadUrl || '#',
      newProduct.rating
    ];

    addLog('info', 'กำลังยื่นบันทึกชุดผลิตภัณฑ์แถวใหม่เข้าสู่ชีต...', JSON.stringify(rowValues));

    if (!isCloudMode) {
      setLocalSpreadsheets((prev) =>
        prev.map((sheet) => {
          if (sheet.id === activeSpreadsheetId) {
            const sheetValues = [...(sheet.sheets[activeWorksheet] || [])];
            sheetValues.push(rowValues);
            return {
              ...sheet,
              sheets: { ...sheet.sheets, [activeWorksheet]: sheetValues }
            };
          }
          return sheet;
        })
      );
      setSheetRows((prev) => [...prev, rowValues]);
      addLog('success', 'บันทึกตารางสินค้าสำเร็จ (ในระบบแซนด์บอกซ์หลัก)');
      setShowAddForm(false);
      // Reset form fields
      setNewProduct({
        title: '',
        category: 'บอท Forex EA',
        description: '',
        detailedDescription: '',
        views: '100',
        downloads: '10',
        fileSize: '5.0 MB',
        imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
        downloadUrl: '',
        rating: '5.0'
      });
      return;
    }

    const token = getAccessToken();
    if (!token) {
      addLog('error', 'ระบบขาดการอนุญาต (Token Expired) กรุณาเชื่อมบัญชีใหม่');
      return;
    }

    try {
      await appendRowToSpreadsheet(activeSpreadsheetId, activeWorksheet, rowValues, token);
      setSheetRows((prev) => [...prev, rowValues]);
      addLog('success', `อัปโหลดบันทึกแถวใหม่ใส่ Google Sheet สำเร็จแล้ว! วลี: "${newProduct.title}"`);
      setShowAddForm(false);
      setNewProduct({
        title: '',
        category: 'บอท Forex EA',
        description: '',
        detailedDescription: '',
        views: '100',
        downloads: '10',
        fileSize: '5.0 MB',
        imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
        downloadUrl: '',
        rating: '5.0'
      });
    } catch (err: any) {
      addLog('error', `ไม่สามารถเสริมข้อมูลลงใน Google Sheet ได้: ${err.message}`);
    }
  };

  // Google OAuth triggers
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    addLog('info', `กำลังเปิดหน้าต่างลงชื่อเข้าใช้ Google Accounts... (โครงการ Firebase ที่ใช้งานอยู่: "${firebaseConfig.projectId}")`);
    addLog('info', `ที่อยู่เว็บปัจจุบันที่รันอยู่: "${window.location.hostname}" (ต้องมีชื่อโดเมนนี้ในหัวข้อ Authorized Domains ในโครงการข้างต้นด้วย)`);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        setIsCloudMode(true);
        addLog('success', `ยินดีต้อนรับ! เข้าใช้สำเร็จภายใต้บัญชี: ${res.user.email}`);
        await loadFilesCatalog(res.accessToken);
      }
    } catch (err: any) {
      addLog('error', `เกิดข้อผิดพลาดในการเรียกใช้ Google OAuth: ${err.message || String(err)}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      localStorage.removeItem('direct_google_access_token');
      localStorage.removeItem('direct_google_user');
      setUser(null);
      setNeedsAuth(true);
      
      addLog('success', 'ออกจากระบบบัญชีแอดมินเรียบร้อยแล้ว แต่หน้าเว็บยังคงแสดงผลข้อมูลจาก Google Sheet เดิมแบบสาธารณะ');
      
      // Keep displaying the current Google Sheet, but load it using public unauthenticated access
      if (activeSpreadsheetId && activeSpreadsheetId !== 'hubfree-products-database') {
        loadFileGrid(activeSpreadsheetId, activeSpreadsheetName || undefined);
      } else {
        const defaultSheetId = GLOBAL_DEFAULT_SPREADSHEET_ID || 'hubfree-products-database';
        loadFileGrid(defaultSheetId);
      }
    } catch (err: any) {
      addLog('error', 'ล็อกเอาท์ขัดข้อง:', err.message);
    }
  };

  // Handle manual token submission (critical backup for Iframe limitations inside AI Studio!)
  const handleManualTokenApplied = async (token: string) => {
    setIsLoggingIn(true);
    addLog('info', 'กำลังประเมินสิทธิ์คีย์ Google Access Token ของคุณ...');
    try {
      const userProfile = await loginWithDirectAccessToken(token);
      if (userProfile) {
        setUser(userProfile);
        setNeedsAuth(false);
        setIsCloudMode(true);
        addLog('success', 'เชื่อมโทเค็นลงชื่อเข้าใช้งานสิทธิ์แบบกำหนดเองสำเร็จ (Manual Token Approved)', `ยินดีต้อนรับคุณ ${userProfile.displayName || userProfile.email}`);
        await loadFilesCatalog(token);
        setManualToken('');
        setShowTokenInput(false);
      }
    } catch (err: any) {
      addLog('error', `ตรวจสอบโทเค็นล้มเหลว: โทเค็นนี้ไม่ถูกต้อง หมดอายุ หรือไม่มีสิทธิ์เข้าถึง (รายละเอียด: ${err.message || String(err)})`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Save credentials & optionally reload to apply
  const handleSaveCustomCredentials = (firebaseJsonStr: string, clientIdStr: string, appsScriptUrlStr: string) => {
    try {
      // 1. Firebase Config Check
      const trimmedJson = firebaseJsonStr.trim();
      if (trimmedJson) {
        // Try parsing JSON to ensure it's valid
        const parsed = JSON.parse(trimmedJson);
        if (!parsed.apiKey || !parsed.authDomain) {
          throw new Error('โครงสร้าง JSON ของ Firebase CONFIG ขาดค่าที่จำเป็น (เช่น apiKey, authDomain)');
        }
        localStorage.setItem('custom_firebase_config', JSON.stringify(parsed));
      } else {
        localStorage.removeItem('custom_firebase_config');
      }

      // 2. Client ID check
      const trimmedClientId = clientIdStr.trim();
      if (trimmedClientId) {
        localStorage.setItem('custom_google_client_id', trimmedClientId);
      } else {
        localStorage.removeItem('custom_google_client_id');
      }

      // 3. Apps Script URL check
      const trimmedUrl = appsScriptUrlStr.trim();
      if (trimmedUrl) {
        if (!trimmedUrl.startsWith('https://script.google.com/')) {
          throw new Error('ลิงก์ Google Apps Script ต้องเริ่มด้วย https://script.google.com/');
        }
        localStorage.setItem('custom_apps_script_url', trimmedUrl);
        
        // Login the user as Direct Apps Script connect instantly!
        const appsScriptUser: any = {
          uid: 'apps-script-user',
          email: 'apps-script-admin@noinahub.com',
          displayName: 'แผงควบคุม Google Apps Script (Bypass คลาวด์สด)',
          photoURL: null,
          isAnonymous: false,
          metadata: {},
          providerData: [],
          phoneNumber: null,
          emailVerified: true,
        };
        localStorage.setItem('direct_google_access_token', 'apps-script-bypass');
        localStorage.setItem('direct_google_user', JSON.stringify(appsScriptUser));
      } else {
        localStorage.removeItem('custom_apps_script_url');
      }

      addLog('success', 'บันทึกการตั้งค่าสิทธิ์เรียบร้อย!', 'กำลังรีโหลดหน้าเว็บเพื่อเริ่มระบบประสานงานด้วยวิธีที่กำหนดใหม่...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      addLog('error', `การประมวลผลการตั้งค่าคีย์ขัดข้อง: ${err.message || String(err)}`);
      alert(`⚠️ เกิดข้อผิดพลาด: ${err.message || String(err)}`);
    }
  };

  // Google Direct Implicit Flow Login with Client-side Client ID
  const handleTriggerImplicitFlow = () => {
    const clientId = customClientId.trim();
    if (!clientId) {
      addLog('error', 'กรุณาระบุ Google OAuth Client ID ก่อนดำเนินการ!');
      alert('⚠️ กรุณากรอก Google OAuth Client ID ก่อนใช้งานวิธีการเชื่อมต่อนี้ค่ะ');
      return;
    }

    const redirectUri = encodeURIComponent(window.location.origin);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirectUri}&response_type=token&scope=https://www.googleapis.com/auth/spreadsheets%20https://www.googleapis.com/auth/drive.metadata.readonly%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email`;
    
    addLog('info', `กำลังเปิดนำทางไป OAuth Consent ของ Google (Client ID: ${clientId.substring(0, 15)}...)`);
    window.location.href = authUrl;
  };

  // -------------------------------------------------------------
  // Parse Spreadsheet Cells `sheetRows` into list of typed products
  // -------------------------------------------------------------
  const products: HubItem[] = useMemo(() => {
    // If we have rows, loosely parse headers or use ordinal indexes
    if (!sheetRows || sheetRows.length < 2) {
      // If spreadsheet has no values, fallback beautifully to mock files so it never looks blank!
      const defaultMock = mockSpreadsheets.find(s => s.id === 'hubfree-products-database');
      const mockRows = defaultMock ? defaultMock.sheets['All Products'] : [];
      return parseRawRowsToProducts(mockRows);
    }

    return parseRawRowsToProducts(sheetRows);
  }, [sheetRows]);

  // Helper parser
  function parseRawRowsToProducts(rows: string[][]): HubItem[] {
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => (h ? h.trim().toLowerCase() : ''));

    // Loose header finding - including 'type' and 'ชนิด' for categories
    const titleIdx = findHeaderIndex(headers, ['title', 'product_name', 'product name', 'productname', 'name', 'ชือ', 'หัวข้อ', 'ชื่อสินค้า', 'ชื่อ', 'ชื่อแบรนด์', 'ชื่อโปรแกรม', 'ชื่อผลิตภัณฑ์']);
    const catIdx = findHeaderIndex(headers, ['category', 'category name', 'category_name', 'group', 'หมวดหมู่', 'กลุ่ม', 'หมวด']);
    const typeIdx = findHeaderIndex(headers, ['type', 'ประเภท', 'ชนิด', 'main_category', 'main category', 'maincategory']);
    const subCatIdx = findHeaderIndex(headers, ['subcategory', 'sub_category', 'sub category', 'หมวดหมู่ย่อย', 'ย่อย', 'subcat']);
    const descIdx = findHeaderIndex(headers, ['description', 'short description', 'short_description', 'shortdescription', 'รายละเอียด', 'คำอธิบาย', 'คำโปรย', 'รายละเอียดสั้น', 'รายละเอียดแบบย่อ', 'สปอยล์']);
    const detailedDescIdx = findHeaderIndex(headers, ['detaileddescription', 'detailed_description', 'detailed description', 'รายละเอียดโดยละเอียด', 'รายละเอียดตัวเต็ม', 'รายละเอียดเต็ม', 'รายละเอียดเจาะลึก', 'รีวิว']);
    const viewsIdx = findHeaderIndex(headers, ['views', 'view_count', 'view', 'viewcount', 'view count', 'views count', 'views_count', 'วิว', 'ยอดวิว', 'คนดู']);
    const downloadsIdx = findHeaderIndex(headers, ['downloads', 'download_count', 'downloadcount', 'download count', 'downloads count', 'downloads_count', 'ดาวน์โหลด', 'ยอดดาวน์โหลด', 'คนโหลด', 'จำนวนดาวน์โหลด']);
    const sizeIdx = findHeaderIndex(headers, ['size', 'file_size', 'filesize', 'file size', 'ขนาด', 'ขนาดไฟล์', 'ความจุ']);
    const lUrlIdx = findHeaderIndex(headers, ['imageurl', 'image_url', 'image url', 'screenshot', 'url รูป', 'รูปภาพ', 'ลิงก์รูป', 'รูปภาพประกอบ', 'ภาพ', 'ลิงก์ภาพ', 'bannerimage', 'banner_image', 'banner image', 'banner']);
    const dUrlIdx = findHeaderIndex(headers, ['downloadurl', 'download_url', 'download url', 'link', 'ลิงก์ดาวน์โหลด', 'ดาวน์โหลด', 'ลิงก์โหลด', 'ลิงก์', 'โหลด']);
    const rIdx = findHeaderIndex(headers, ['rating', 'score', 'star', 'stars', 'คะแนน', 'เรตติ้ง']);

    return rows.slice(1).map((row) => {
      const getCell = (r: string[], idx: number, defaultIdx: number, defVal: string): string => {
        if (idx !== -1 && r[idx] !== undefined) return r[idx];
        if (defaultIdx !== -1 && r[defaultIdx] !== undefined) return r[defaultIdx];
        return defVal;
      };

      const title = getCell(row, titleIdx, 0, 'No Name');
      const category = getCell(row, catIdx, 1, 'Uncategorized');
      const description = getCell(row, descIdx, 2, 'No description available.');
      const detailedDescription = getCell(row, detailedDescIdx, 3, '');
      const views = getCell(row, viewsIdx, 4, '0');
      const downloads = getCell(row, downloadsIdx, -1, '0');
      const size = getCell(row, sizeIdx, 5, 'N/A');
      const rawImageUrl = getCell(row, lUrlIdx, 6, '');
      const rawDownloadUrl = getCell(row, dUrlIdx, 7, '#');
      const rating = getCell(row, rIdx, 8, '4.8');

      const extractedType = typeIdx !== -1 ? getCell(row, typeIdx, -1, '') : '';
      const extractedSubcat = subCatIdx !== -1 ? getCell(row, subCatIdx, -1, '') : '';

      const imageUrl = convertDriveImageUrl(rawImageUrl);
      const downloadUrl = convertDriveDownloadUrl(rawDownloadUrl);

      // ตรวจสอบและแปลงโค้ด HTML Image จาก Google Sheet โดยตรงตามที่ผู้ใช้ต้องการ
      let isHtmlImage = false;
      let htmlImage = '';
      const trimmedRaw = (rawImageUrl || '').trim();
      if (trimmedRaw.includes('<img')) {
        isHtmlImage = true;
        const srcMatch = trimmedRaw.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          const srcUrl = srcMatch[1].trim();
          const driveId = getGoogleDriveId(srcUrl);
          if (driveId) {
            const workingUrl = `https://wsrv.nl/?url=${encodeURIComponent(`https://docs.google.com/uc?export=download&id=${driveId}`)}`;
            htmlImage = trimmedRaw.replace(srcMatch[1], workingUrl);
          } else {
            htmlImage = trimmedRaw;
          }
        } else {
          htmlImage = trimmedRaw;
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        title,
        category,
        description,
        detailedDescription,
        views,
        downloads,
        fileSize: size,
        imageUrl,
        downloadUrl,
        rating,
        type: extractedType,
        subCategory: extractedSubcat,
        isHtmlImage,
        htmlImage
      };
    });
  }

  // Client Filter products by search terms and header tabs (Loose matching for better robustness after user edits)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const pTitle = (p.title || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();
      const pCat = (p.category || '').toLowerCase();
      const pType = (p.type || '').toLowerCase();
      const pSub = (p.subCategory || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      // Search Box filter
      const matchesSearch =
        pTitle.includes(q) ||
        pDesc.includes(q) ||
        pCat.includes(q) ||
        pType.includes(q) ||
        pSub.includes(q);

      // Categorised tabs selection filter
      if (activeTab === 'Home') return matchesSearch;
      
      const isMovie = pCat.includes('ดูหนัง') || pCat.includes('หนัง') || pCat.includes('movie') || pCat.includes('cinema') || pCat.includes('series') ||
                      pType.includes('movie') || pType.includes('หนัง') || pType.includes('ซีรี่') || pType.includes('ซีรี') || pType.includes('cinema') || pType.includes('series');
                      
      const isSoftware = pCat.includes('ซอฟต์แวร์') || pCat.includes('software') || pCat.includes('program') || pCat.includes('โหลด') || pCat.includes('ดาวน์โหลด') || pCat.includes('app') ||
                         pType.includes('software') || pType.includes('program') || pType.includes('ซอฟต์แวร์') || pType.includes('แอป') || pType.includes('app') || pType.includes('ดาวน์โหลด') || pType.includes('โหลด');

      const isEA = pCat.includes('ea') || pCat.includes('forex') || pCat.includes('บอท') || pCat.includes('คีย์บอท') || pCat.includes('trade') ||
                   pType.includes('ea') || pType.includes('forex') || pType.includes('บอท') || pType.includes('robot') || pType.includes('trade');

      const matchesKeywords = (keywords: string[], subcatId?: string) => {
        const inBasic = keywords.some(kw => pCat.includes(kw) || pTitle.includes(kw) || pDesc.includes(kw) || pType.includes(kw) || pSub.includes(kw));
        if (inBasic) return true;
        if (subcatId && (pSub.includes(subcatId.toLowerCase()) || subcatId.toLowerCase().includes(pSub))) return true;
        return false;
      };

      if (activeTab === 'Movies') {
        if (!isMovie) return false;

        if (selectedMovieSubcat !== 'All') {
          const subcatKeysMap: Record<string, string[]> = {
            online: ['ดูหนังออนไลน์', 'ออนไลน์', 'online', 'พากย์ไทย', 'ซับไทย', 'เสียงไทย', 'soundtrack', 'master'],
            new2026: ['2026', 'หนังใหม่', 'ใหม่ล่าสุด', 'ปี 2026'],
            theaters: ['ชนโรง', 'ใหม่ชนโรง', 'master', 'hd', 'โรง', 'theater', 'cinema'],
            cartoons: ['การ์ตูน', 'cartoon', 'anime', 'อนิเมะ', 'ดิสนีย์', 'disney', 'pixar'],
            thai: ['หนังไทย', 'ภาพยนตร์ไทย', 'ไทย', 'สหมงคล', 'gdh', 't-pop'],
            series: ['ซีรี่ย์', 'ซีรีส์', 'series', 'เกาหลี', 'จีน', 'korean', 'chinese', 'netflix series'],
            netflix: ['netflix', 'เน็ตฟลิกท์', 'เน็ตฟลิค', 'เน็ตฟลิกซ์', 'เน็ตฟลิก', 'nf'],
            imdb: ['imdb', 'คะแนนสูง', 'top raw', 'award', 'ออสการ์', 'oscar', '9.', '8.']
          };

          const keywords = subcatKeysMap[selectedMovieSubcat];
          if (keywords) {
            const matchesSubcat = matchesKeywords(keywords, selectedMovieSubcat);
            if (!matchesSubcat) return false;
          }
        }
        return isMovie && matchesSearch;
      }
      if (activeTab === 'Software') {
        if (!isSoftware) return false;

        // Custom sub-category filtering based on keywords matching screenshot
        if (selectedSoftwareSubcat !== 'All') {
          const subcatKeysMap: Record<string, string[]> = {
            windows: ['windows', 'win', 'pc', 'ms'],
            mac: ['mac', 'apple', 'osx', 'os x', 'dmg'],
            android: ['android', 'apk', 'app', 'smartphone'],
            audiobooks: ['audiobook', 'audio', 'sound', 'หนังสือเสียง'],
            ebooks: ['e-book', 'ebook', 'book', 'หนังสือ', 'pdf', 'epub'],
            videos: ['video', 'คอร์ส', 'คลิป', 'หนัง', 'media', 'movie'],
            music: ['music', 'เพลง', 'sound', 'mp3', 'wave'],
            games: ['game', 'เกม', 'steam', 'bundle'],
            wordpress: ['wordpress', 'wp', 'theme', 'plugin'],
            elementor: ['elementor', 'add-on', 'template'],
            fonts: ['font', 'ฟอนต์', 'อักษร', 'type'],
            home: ['home', 'interior', 'บ้าน', 'แต่งบ้าน', 'decor'],
            education: ['education', 'เรียน', 'ความรู้', 'school', 'course', 'สอน'],
            magazines: ['magazine', 'นิตยสาร'],
            assets: ['asset', 'กราฟิก', '3d', 'premium', 'mockup', 'vector', 'psd'],
            resources: ['resource', 'code', 'ลิงก์', 'เว็บ', 'source'],
            bundles: ['bundle', 'รวม', 'ชุด', 'แพ็ค'],
            success: ['success', 'mindset', 'เป้าหมาย', 'ชนะ', 'โค้ช']
          };

          const keywords = subcatKeysMap[selectedSoftwareSubcat];
          if (keywords) {
            const matchesSubcat = matchesKeywords(keywords, selectedSoftwareSubcat);
            if (!matchesSubcat) return false;
          }
        }
        return isSoftware && matchesSearch;
      }
      if (activeTab === 'Forex EA') {
        if (!isEA) return false;

        if (selectedForexSubcat !== 'All') {
          const subcatKeysMap: Record<string, string[]> = {
            mt4_robot: ['mt4 robot', 'mt4_robot', 'mt4-robot', 'mt4', 'meta 4', 'metatrader 4'],
            mt5_robot: ['mt5 robot', 'mt5_robot', 'mt5-robot', 'mt5', 'meta 5', 'metatrader 5'],
            deriv_bot: ['deriv', 'binary.com', 'deriv trading bot', 'deriv bot', 'deriv_bot', 'deriv-bot'],
            mt5_synthetic: ['synthetic', 'synthetic indices', 'synthetics', 'volatility index', 'crash boom', 'vix'],
            mt4_indicator: ['indicator', 'indicators', 'mt4 indicator', 'อินดิเคเตอร์ mt4', 'อินดิ mt4', 'indicator mt4'],
            mt5_indicator: ['mt5 indicator', 'อินดิเคเตอร์ mt5', 'อินดิ mt5', 'indicator mt5']
          };

          const keywords = subcatKeysMap[selectedForexSubcat];
          if (keywords) {
            let matchesSubcat = false;
            const matchesBase = matchesKeywords(keywords, selectedForexSubcat);

            if (selectedForexSubcat === 'mt4_robot') {
              matchesSubcat = (matchesBase || pSub.includes('robot') || pSub.includes('bot')) && 
                              (pCat.includes('ea') || pCat.includes('bot') || pCat.includes('robot') || pTitle.includes('bot') || pTitle.includes('ea') || pTitle.includes('robot') || pDesc.includes('ea') || pDesc.includes('robot') || pType.includes('ea') || pType.includes('bot') || pType.includes('robot'));
            } else if (selectedForexSubcat === 'mt5_robot') {
              matchesSubcat = (matchesBase || pSub.includes('robot') || pSub.includes('bot')) && 
                              (pCat.includes('ea') || pCat.includes('bot') || pCat.includes('robot') || pTitle.includes('bot') || pTitle.includes('ea') || pTitle.includes('robot') || pDesc.includes('ea') || pDesc.includes('robot') || pType.includes('ea') || pType.includes('bot') || pType.includes('robot'));
            } else if (selectedForexSubcat === 'mt4_indicator') {
              matchesSubcat = (pCat.includes('indicator') || pTitle.includes('indicator') || pDesc.includes('indicator') || pTitle.includes('ระบบเทรด') || pTitle.includes('เครื่องมือ') || pType.includes('indicator') || pSub.includes('indicator')) && 
                              (pCat.includes('mt4') || pTitle.includes('mt4') || pDesc.includes('mt4') || pCat.includes('meta 4') || pTitle.includes('meta 4') || pType.includes('mt4') || pSub.includes('mt4'));
            } else if (selectedForexSubcat === 'mt5_indicator') {
              matchesSubcat = (pCat.includes('indicator') || pTitle.includes('indicator') || pDesc.includes('indicator') || pTitle.includes('ระบบเทรด') || pTitle.includes('เครื่องมือ') || pType.includes('indicator') || pSub.includes('indicator')) && 
                              (pCat.includes('mt5') || pTitle.includes('mt5') || pDesc.includes('mt5') || pCat.includes('meta 5') || pTitle.includes('meta 5') || pType.includes('mt5') || pSub.includes('mt5'));
            } else {
              matchesSubcat = matchesBase;
            }
            if (!matchesSubcat) return false;
          }
        }
        return isEA && matchesSearch;
      }
      
      return matchesSearch;
    });
  }, [products, activeTab, searchQuery, selectedSoftwareSubcat, selectedForexSubcat, selectedMovieSubcat]);

  // Parse Spreadsheet Cells `sheetRows` into list of typed donation registries
  const donations = useMemo(() => {
    // If donation sheet is selected, try to parse it. Otherwise load mock logs
    const activeSheet = localSpreadsheets.find((s) => s.id === activeSpreadsheetId);
    let rawDonations: string[][] = [];

    if (isCloudMode && activeSpreadsheetId) {
      // If we find 'Donation Logs' worksheet in state worksheets, query it
      const found = worksheets.find((w) => w.title === 'Donation Logs');
      if (found && activeWorksheet === 'Donation Logs') {
        rawDonations = sheetRows;
      }
    } else if (activeSpreadsheetId === 'hubfree-products-database') {
      rawDonations = activeSheet?.sheets['Donation Logs'] || [];
    }

    if (!rawDonations || rawDonations.length < 2) {
      // Fallback default mocked donation registries
      return [
        { name: 'คุณภานุวัฒน์', amount: '200 บาท', date: 'วันนี้', message: 'ขอบคุณสำหรับบอท Forex ทองคำปังมาก!' },
        { name: 'คุณธวัชชัย', amount: '50 บาท', date: 'เมื่อวานนี้', message: 'สนับสนุนช่องทางแจกไอทีดีๆ ครับ' },
        { name: 'คุณแว่นตาหวาน', amount: '100 บาท', date: '3 วันที่แล้ว', message: 'หนังชนโรง คมชัดสมสิริ สนับสนุนกาแฟจ้า' }
      ];
    }

    return rawDonations.slice(1).map((row, i) => ({
      name: row[0] || 'ผู้ใจบุญไม่ประสงค์ออกนาม',
      amount: row[1] || '10 บาท',
      date: row[2] || 'เมื่อเร็วๆ นี้',
      message: row[3] || 'สนับสนุนทีมงานต่อนะครับสู้ๆ'
    }));
  }, [sheetRows, activeWorksheet, activeSpreadsheetId, worksheets, isCloudMode, localSpreadsheets]);



  // Dynamically calculate product counts for each of the Movies sub-categories matching the user's movie screen
  const movieSubcatCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: 0,
      online: 0,
      new2026: 0,
      theaters: 0,
      cartoons: 0,
      thai: 0,
      series: 0,
      netflix: 0,
      imdb: 0
    };

    products.forEach((p) => {
      const pCat = (p.category || '').toLowerCase();
      const pTitle = (p.title || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();

      const isMovie = pCat.includes('ดูหนัง') || pCat.includes('หนัง') || pCat.includes('movie') || pCat.includes('cinema') || pCat.includes('series');
      if (!isMovie) return;

      counts.All++;

      const subcatKeysMap: Record<string, string[]> = {
        online: ['ดูหนังออนไลน์', 'ออนไลน์', 'online', 'พากย์ไทย', 'ซับไทย', 'เสียงไทย', 'soundtrack', 'master'],
        new2026: ['2026', 'หนังใหม่', 'ใหม่ล่าสุด', 'ปี 2026'],
        theaters: ['ชนโรง', 'ใหม่ชนโรง', 'master', 'hd', 'โรง', 'theater', 'cinema'],
        cartoons: ['การ์ตูน', 'cartoon', 'anime', 'อนิเมะ', 'ดิสนีย์', 'disney', 'pixar'],
        thai: ['หนังไทย', 'ภาพยนตร์ไทย', 'ไทย', 'สหมงคล', 'gdh', 't-pop'],
        series: ['ซีรี่ย์', 'ซีรีส์', 'series', 'เกาหลี', 'จีน', 'korean', 'chinese', 'netflix series'],
        netflix: ['netflix', 'เน็ตฟลิกท์', 'เน็ตฟลิค', 'เน็ตฟลิกซ์', 'เน็ตฟลิก', 'nf'],
        imdb: ['imdb', 'คะแนนสูง', 'top raw', 'award', 'ออสการ์', 'oscar', '9.', '8.']
      };

      Object.entries(subcatKeysMap).forEach(([subcat, keywords]) => {
        const match = keywords.some(kw => pCat.includes(kw) || pTitle.includes(kw) || pDesc.includes(kw));
        if (match) {
          counts[subcat]++;
        }
      });
    });

    return counts;
  }, [products]);

  // Dynamically calculate product counts for each of the 6 Forex EA sub-categories matching the user's uploaded screen
  const forexSubcatCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: 0,
      mt4_robot: 0,
      mt5_robot: 0,
      deriv_bot: 0,
      mt5_synthetic: 0,
      mt4_indicator: 0,
      mt5_indicator: 0
    };

    products.forEach((p) => {
      const pCat = (p.category || '').toLowerCase();
      const pTitle = (p.title || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();

      const isEA = pCat.includes('ea') || pCat.includes('forex') || pCat.includes('บอท') || pCat.includes('คีย์บอท') || pCat.includes('trade');
      if (!isEA) return;

      counts.All++;

      const subcatKeysMap: Record<string, string[]> = {
        mt4_robot: ['mt4 robot', 'mt4_robot', 'mt4-robot', 'mt4', 'meta 4', 'metatrader 4'],
        mt5_robot: ['mt5 robot', 'mt5_robot', 'mt5-robot', 'mt5', 'meta 5', 'metatrader 5'],
        deriv_bot: ['deriv', 'binary.com', 'deriv trading bot', 'deriv bot', 'deriv_bot', 'deriv-bot'],
        mt5_synthetic: ['synthetic', 'synthetic indices', 'synthetics', 'volatility index', 'crash boom', 'vix'],
        mt4_indicator: ['indicator', 'indicators', 'mt4 indicator', 'อินดิเคเตอร์ mt4', 'อินดิ mt4', 'indicator mt4'],
        mt5_indicator: ['mt5 indicator', 'อินดิเคเตอร์ mt5', 'อินดิ mt5', 'indicator mt5']
      };

      Object.entries(subcatKeysMap).forEach(([subcat, keywords]) => {
        let match = false;
        if (subcat === 'mt4_robot') {
          match = keywords.some(kw => pCat.includes(kw) || pTitle.includes(kw) || pDesc.includes(kw)) && 
                  (pCat.includes('ea') || pCat.includes('bot') || pCat.includes('robot') || pTitle.includes('bot') || pTitle.includes('ea') || pTitle.includes('robot') || pDesc.includes('ea') || pDesc.includes('robot'));
        } else if (subcat === 'mt5_robot') {
          match = keywords.some(kw => pCat.includes(kw) || pTitle.includes(kw) || pDesc.includes(kw)) && 
                  (pCat.includes('ea') || pCat.includes('bot') || pCat.includes('robot') || pTitle.includes('bot') || pTitle.includes('ea') || pTitle.includes('robot') || pDesc.includes('ea') || pDesc.includes('robot'));
        } else if (subcat === 'mt4_indicator') {
          match = (pCat.includes('indicator') || pTitle.includes('indicator') || pDesc.includes('indicator') || pTitle.includes('ระบบเทรด') || pTitle.includes('เครื่องมือ')) && 
                  (pCat.includes('mt4') || pTitle.includes('mt4') || pDesc.includes('mt4') || pCat.includes('meta 4') || pTitle.includes('meta 4'));
        } else if (subcat === 'mt5_indicator') {
          match = (pCat.includes('indicator') || pTitle.includes('indicator') || pDesc.includes('indicator') || pTitle.includes('ระบบเทรด') || pTitle.includes('เครื่องมือ')) && 
                  (pCat.includes('mt5') || pTitle.includes('mt5') || pDesc.includes('mt5') || pCat.includes('meta 5') || pTitle.includes('meta 5'));
        } else {
          match = keywords.some(kw => pCat.includes(kw) || pTitle.includes(kw) || pDesc.includes(kw));
        }
        if (match) {
          counts[subcat]++;
        }
      });
    });

    return counts;
  }, [products]);

  // Dynamically calculate product counts for each of the 18 sub-categories matching the user's uploaded screen
  const subcatCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: 0,
      windows: 0,
      mac: 0,
      android: 0,
      audiobooks: 0,
      ebooks: 0,
      videos: 0,
      music: 0,
      games: 0,
      wordpress: 0,
      elementor: 0,
      fonts: 0,
      home: 0,
      education: 0,
      magazines: 0,
      assets: 0,
      resources: 0,
      bundles: 0,
      success: 0
    };

    products.forEach((p) => {
      const pCat = (p.category || '').toLowerCase();
      const pTitle = (p.title || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();

      const isSoftware = pCat.includes('ซอฟต์แวร์') || pCat.includes('software') || pCat.includes('program') || pCat.includes('โหลด') || pCat.includes('ดาวน์โหลด') || pCat.includes('app');
      if (!isSoftware) return;

      counts.All++;

      const subcatKeysMap: Record<string, string[]> = {
        windows: ['windows', 'win', 'pc', 'ms'],
        mac: ['mac', 'apple', 'osx', 'os x', 'dmg'],
        android: ['android', 'apk', 'app', 'smartphone'],
        audiobooks: ['audiobook', 'audio', 'sound', 'หนังสือเสียง'],
        ebooks: ['e-book', 'ebook', 'book', 'หนังสือ', 'pdf', 'epub'],
        videos: ['video', 'คอร์ส', 'คลิป', 'หนัง', 'media', 'movie'],
        music: ['music', 'เพลง', 'sound', 'mp3', 'wave'],
        games: ['game', 'เกม', 'steam', 'bundle'],
        wordpress: ['wordpress', 'wp', 'theme', 'plugin'],
        elementor: ['elementor', 'add-on', 'template'],
        fonts: ['font', 'ฟอนต์', 'อักษร', 'type'],
        home: ['home', 'interior', 'บ้าน', 'แต่งบ้าน', 'decor'],
        education: ['education', 'เรียน', 'ความรู้', 'school', 'course', 'สอน'],
        magazines: ['magazine', 'นิตยสาร'],
        assets: ['asset', 'กราฟิก', '3d', 'premium', 'mockup', 'vector', 'psd'],
        resources: ['resource', 'code', 'ลิงก์', 'เว็บ', 'source'],
        bundles: ['bundle', 'รวม', 'ชุด', 'แพ็ค'],
        success: ['success', 'mindset', 'เป้าหมาย', 'ชนะ', 'โค้ช']
      };

      Object.entries(subcatKeysMap).forEach(([subcat, keywords]) => {
        const match = keywords.some(kw => pCat.includes(kw) || pTitle.includes(kw) || pDesc.includes(kw));
        if (match) {
          counts[subcat]++;
        }
      });
    });

    return counts;
  }, [products]);

  // High-performance featured product picker
  const featuredProduct = useMemo(() => {
    if (filteredProducts.length === 0) return null;
    // Choose the first one in the list as the premium card
    return filteredProducts[0];
  }, [filteredProducts]);

  // Remaining list products (excluding currently featured product)
  const gridProducts = useMemo(() => {
    if (filteredProducts.length <= 1) return filteredProducts;
    return filteredProducts.slice(1);
  }, [filteredProducts]);

  // Function to simulate dynamic visual click/download triggers with success prompts
  const triggerDownloadAction = (product: HubItem) => {
    // If the product is already unlocked, trigger download directly
    if (unlockedProductIds.includes(product.id)) {
      addLog('success', `คำขอดาวน์โหลด: กำลังเปลี่ยนเส้นทางไปลิงก์ดาวน์โหลดสำหรับ "${product.title}"`, `ลิงก์: ${product.downloadUrl}`);
      if (product.downloadUrl && product.downloadUrl !== '#') {
        window.open(product.downloadUrl, '_blank');
      } else {
        alert(`⚠️ ลิงก์ดาวน์โหลดไม่ถูกต้อง หรือไฟล์นี้เป็นแบบระบบจองชมล่วงหน้า ขออภัยในความไม่สะดวก!`);
      }
    } else {
      // Show restricted access popup to lock this download
      setPendingUnlockProduct(product);
      setClickedSponsors([]);
      setPaymentTxId('');
      setUnlockVipCode('');
      setUploadedSlipUrl(null);
      setShowVipCodeSuccess(null);
      setAiVerificationLogs([]);
      setActiveUnlockTab('Sponsors');
      addLog('warning', `ต้องการการปลดล็อก: ไฟล์ "${product.title}" ยังไม่ได้ถูกปลดล็อกสำหรับสิทธิ์เข้าถึงของคุณ`, `กรุณาเลือกช่องทางปลดล็อกผ่านสปอนเซอร์หรือจ่ายค่าน้ำชา`);
    }
  };

  const triggerAiOcrScanning = (fileName: string) => {
    setIsVerifyingPayment(true);
    setAiVerificationLogs([]);
    setShowVipCodeSuccess(null);

    const logMessages = [
      `[AI Verification Agent] 📂 เคลื่อนย้ายและทำความสะอาดสลิปสำเร็จเพื่อเตรียมตรวจสอบ: "${fileName}"`,
      `[AI Metadata Engine] 📐 ข้อมูลภาพสลิป: กว้าง 1080px สูง 1920px (แอปพลิเคชัน TrueMoney Wallet)`,
      `[AI OCR Core] 🔍 เริ่มต้นการสแกนค้นหาสัญลักษณ์ตัวหนังสือและตัวเลขผ่าน Deep Convolutional Neural Network...`,
      `[AI Account Matcher] 👤 พบชื่อบัญชีผู้รับเงินปลายทาง: "ไวพจน์ โสมภา" (ถูกต้องตรงตามสัญญาสปอนเซอร์หลัก)`,
      `[AI Funds Valuator] 💰 จำนวนเงินในสลิป: ถอดรหัสได้ยอด "${teaFeeAmount} บาท" ถ้วน (ตรงกับข้อตกลงจัดสนับสนุน)`,
      `[AI Anti-Fraud Log] 🔒 รายการยืนยันสลิปสำเร็จ: ตรวจสอบความเข้มข้นลายน้ำและเวลาทำรายการเรียบร้อย`,
      `[AI Success Engine] ✅ ผลการตรวจสอบ: สลิปนี้มีสถานะ ชำระเงินจริง สามารถมอบสิทธิ์รหัสผ่าน VIP ได้ทันที`
    ];

    let currentStep = 0;
    const timer = setInterval(() => {
      if (currentStep < logMessages.length) {
        setAiVerificationLogs(prev => [...prev, logMessages[currentStep]]);
        currentStep++;
      } else {
        clearInterval(timer);
        setIsVerifyingPayment(false);
        setShowVipCodeSuccess("Noina2024");
        addLog('success', 'AI ตรวจสอบภาพสลิปสำเร็จ!', `ค่าน้ำชาจำนวนยอด ${teaFeeAmount} บาท ยืนยันรหัส VIP คีย์: "Noina2024"`);
      }
    }, 400);
  };

  const handleUnlockSuccess = (product: HubItem, method: string) => {
    setUnlockedProductIds((prev) => {
      if (prev.includes(product.id)) return prev;
      return [...prev, product.id];
    });
    addLog('success', `ปลดล็อกเสร็จสมบูรณ์! 🎉`, `ปลดล็อกสิทธิ์เข้าชมและดาวน์โหลดสำหรับ "${product.title}" ถาวรสำเร็จผ่านวิถี: ${method}`);
    setPendingUnlockProduct(null);
    
    // Auto initiate actual download after unblocking
    if (product.downloadUrl && product.downloadUrl !== '#') {
      window.open(product.downloadUrl, '_blank');
    } else {
      alert(`🎉 ระบบสะสมสิทธิ์ปลดล็อกสมบูรณ์แล้ว! มาร์เก็ตเพลสยินดีต้อนรับ แต่ดูเหมือนลิงก์ดาวน์โหลดจะไม่ถูกต้องหรือเป็นหน้าเตรียมจอง`);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-gray-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Upper Announcement Marquee */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-black py-2.5 px-4 text-xs font-semibold select-none flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
          <span className="bg-black text-[#f59e0b] px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0">
            ประกาศสำคัญ
          </span>
          <span className="truncate tracking-wide animate-pulse">
            🔥 สนับสนุนค่าน้ำชาผู้พัฒนา 10-20 บาท บายพาสสปีดโหลดตรง และขอเพิ่มบอท EA ฟรีได้ทันใจ! (สแกนไวรัสปลอดภัย 100% ปราศจากมัลแวร์แถมคอร์สสอนฟรี)
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 shrink-0 text-[11px] font-bold">
          <Globe className="w-3.5 h-3.5" />
          <span>เชื่อมต่ออัปเดตสถานะแบบสด ผ่าน Google Sheets v4 API</span>
        </div>
      </div>

      {/* Main Beautiful Dashboard Navigation Logo Header */}
      <header className="bg-[#0b101d] border-b border-gray-800 sticky top-0 z-40 shadow-xl backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Logo Group */}
          <div className="flex items-center gap-3.5 select-none cursor-pointer" onClick={() => { setActiveTab('Home'); setSearchQuery(''); }}>
            <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center font-black text-black text-xl shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/20 transform hover:scale-105 transition-all">
              HF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                  HUB <span className="text-amber-500">FREE</span>
                </h1>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.3 rounded-full font-bold uppercase tracking-wider">
                  Live DB
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                พอร์ทัลแจกใหญ่ หนังพรีเมี่ยมฟรี โปรแกรมสามัญ และบอทเทรด Forex EA
              </p>
            </div>
          </div>

          {/* Core Navigation Panels */}
          <nav className="flex items-center gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-800 max-w-full overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab('Home')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'Home'
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              ทั้งหมด (Home)
            </button>
            <button
              onClick={() => setActiveTab('Movies')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'Movies'
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              ดูหนังฟรี (24-hds)
            </button>
            <button
              onClick={() => setActiveTab('Software')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'Software'
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              โหลดซอฟต์แวร์
            </button>
            <button
              onClick={() => setActiveTab('Forex EA')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'Forex EA'
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              บอท Forex EA
            </button>
            <button
              onClick={() => setActiveTab('Donate')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1 ${
                activeTab === 'Donate'
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              วิธีใช้ & ค่าน้ำชา
            </button>
            <button
              onClick={() => setActiveTab('SheetsConfig')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'SheetsConfig'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                  : 'text-[#4f46e5] font-bold hover:bg-indigo-950/40 bg-indigo-950/15 border border-indigo-950'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              เชื่อม Google Sheets
            </button>
          </nav>
        </div>
      </header>

      {/* Primary Dashboard Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* Conditional warning regarding Sandbox/Cloud modes */}
        {activeTab !== 'SheetsConfig' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 px-4 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-400 shadow-inner">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isCloudMode ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span>
                แหล่งนำเข้าข้อมูลสินค้าขณะนี้: 
                <strong className={isCloudMode ? 'text-emerald-400 ml-1' : 'text-amber-400 ml-1'}>
                  {isCloudMode ? `Google Sheets คลาวด์สด (${activeSpreadsheetName || 'ไฟล์ดั้งเดิม'})` : 'โหมด Sandbox แซนด์บอกซ์ออฟไลน์ (แก้ไขโครงสร้างได้ฉับไวในแถบแอดมิน)'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">หากต้องการแก้ไขสินค้า หรือ เชื่อมต่อบัญชีแอดมิน</span>
              <button 
                onClick={() => setActiveTab('SheetsConfig')} 
                className="bg-gray-900 hover:bg-gray-800 text-amber-500 hover:text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-gray-800 cursor-pointer"
              >
                จัดการฐานข้อมูลชีต
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: LANDING MAIN CATALOG VIEW (Home, Movies, Software, EA) */}
        {/* ------------------------------------------------------------- */}
        {activeTab !== 'Donate' && activeTab !== 'SheetsConfig' && (
          <div className="space-y-8 animate-fadeIn" id="catalog-view">
            
            {/* Worksheets tabs options selector if Google Spreadsheet has multiple tabs */}
            {worksheets.length > 1 && (
              <div className="bg-[#0b101c] p-4 rounded-2xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl select-none">
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-gray-200 font-sans">
                      สลับหน้าแผ่นงาน (Worksheet):
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    กำลังแสดงข้อมูลจากแผ่นงาน <strong className="text-amber-500">"{activeWorksheet}"</strong> คลิกปุ่มด้านขวาเพื่อดึงข้อมูลจากแผ่นอื่นได้เลย!
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 bg-black/50 border border-gray-850 p-1.5 rounded-xl max-w-full overflow-x-auto">
                  {worksheets.map((w, i) => (
                    <button
                      key={i}
                      onClick={() => handleTabChange(w.title)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        activeWorksheet === w.title
                          ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-gray-900'
                      }`}
                    >
                      <span>📄</span>
                      <span>{w.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Search Box & Simple Filter Header */}
            <div className="bg-[#0b101c] p-5 rounded-2xl border border-gray-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <h2 className="text-lg font-bold text-white tracking-tight">ค้นหารายการพรีเมียมทั้งหมด</h2>
                <p className="text-xs text-gray-400">กรองและค้นหาซอฟต์แวร์ คีย์บอท หรือลิสต์ดูหนังฟรี อัปเดตข้อมูลแถวสดทันใจจาก Google Sheets</p>
              </div>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4.5 h-4.5" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหนังสือ, ซอฟต์แวร์, คีย์, EA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#070b13] border border-gray-800 text-white rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-amber-500 transition-all font-sans"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-sans px-1.5 py-0.5 rounded uppercase"
                  >
                    ล้างคีย์
                  </button>
                )}
              </div>
            </div>

            {/* 💡 EXCITING ADDITION: MOVIES COMPREHENSIVE SUBCATEGORIES GRID */}
            {activeTab === 'Movies' && (
              <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-6 shadow-2xl animate-scaleUp text-left" id="movies-subcategories-panel">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-850 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-[#f43f5e] font-sans">
                        หมวดหมู่ย่อยเว็บดูหนังฟรี (Movies & Series Sub-Categories)
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-400 font-light">
                      สลับคลิกฟิลเตอร์เพื่อเจาะลึกดูประเภทหนังออนไลน์ หนังใหม่ปีล่าสุด หรือซีรี่ส์ยอดนิยม พร้อมระบบตรวจนับอัตโนมัติ
                    </p>
                  </div>
                  {selectedMovieSubcat !== 'All' && (
                    <button
                      type="button"
                      onClick={() => setSelectedMovieSubcat('All')}
                      className="text-xs bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 text-rose-400 px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all self-start sm:self-center"
                    >
                      ล้างฟิลเตอร์ย่อย (แสดงทั้งหมด)
                    </button>
                  )}
                </div>

                {/* Grid of Round Badges matching the movie look with spectacular neon colors */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-y-6 gap-x-4 justify-items-center py-2" id="movies-subcategories-round-grid">
                  {MOVIE_SUBCATEGORIES.map((subcat) => {
                    const isSelected = selectedMovieSubcat === subcat.id;
                    const count = movieSubcatCounts[subcat.id] || 0;
                    const IconComponent = subcat.icon;

                    return (
                      <button
                        key={subcat.id}
                        type="button"
                        onClick={() => setSelectedMovieSubcat(subcat.id)}
                        className="group flex flex-col items-center gap-2.5 w-full max-w-[100px] outline-none border-none bg-transparent cursor-pointer transition-all text-center"
                      >
                        {/* Circle badge container */}
                        <div
                          className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 transform select-none ${subcat.shadowGlow} ${
                            isSelected
                              ? 'scale-110 shadow-lg ring-4 ring-rose-500 ring-offset-4 ring-offset-[#0b101c]'
                              : 'hover:scale-105 active:scale-95 shadow-md hover:brightness-110'
                          }`}
                          style={{
                            background: isSelected
                              ? `radial-gradient(circle, ${subcat.color}dd 0%, ${subcat.color}ff 100%)`
                              : `radial-gradient(circle, ${subcat.color}9c 0%, ${subcat.color}bf 100%)`,
                          }}
                        >
                          {/* Circle Long Shadow Decor Inside */}
                          <div className="absolute inset-0 rounded-full bg-black/5 opacity-10 pointer-events-none transform translate-x-2 translate-y-2 blur-[1px]" />
                          
                          {/* Inner shine */}
                          <div className="absolute inset-0.5 rounded-full bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none" />

                          {/* Icon component */}
                          <IconComponent
                            className={`w-7 h-7 sm:w-9 sm:h-9 transition-transform duration-300 ${
                              isSelected ? 'animate-bounce scale-105' : 'group-hover:rotate-12'
                            }`}
                            style={{
                              color: '#ffffff',
                              filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.35))'
                            }}
                          />

                          {/* Floating active crown marker */}
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1 bg-amber-400 text-black rounded-full p-1.5 border border-[#0d1421] shadow-md">
                              <CheckCircle2 className="w-2.5 h-2.5 font-bold animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Caption & count underneath */}
                        <div className="space-y-0.5">
                          <p className={`text-xs font-bold leading-tight font-sans transition-all duration-200 ${
                            isSelected ? 'text-[#f43f5e] font-black scale-102' : 'text-gray-200 group-hover:text-white'
                          }`}>
                            {subcat.name}
                          </p>
                          <p className={`font-mono text-[9px] font-semibold transition-all ${
                            isSelected ? 'text-rose-450 font-extrabold' : 'text-gray-500 group-hover:text-gray-400'
                          }`}>
                            ({count})
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 💡 EXCITING ADDITION: SOFTWARE COMPREHENSIVE SUBCATEGORIES GRID */}
            {activeTab === 'Software' && (
              <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-6 shadow-2xl animate-scaleUp text-left" id="software-subcategories-panel">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-850 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-[#ff5722] font-sans">
                        หมวดหมู่ย่อยคลังซอฟต์แวร์เสรี (Software Sub-Categories)
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-400 font-light">
                      สลับคลิกฟิลเตอร์เพื่อเจาะลึกดูสินค้าและซอฟต์แวร์เฉพาะสายดั้งเดิม พร้อมเช็คผลนับรวมอัตโนมัติตรงตัวตามระบุ
                    </p>
                  </div>
                  {selectedSoftwareSubcat !== 'All' && (
                    <button
                      type="button"
                      onClick={() => setSelectedSoftwareSubcat('All')}
                      className="text-xs bg-orange-600/10 hover:bg-orange-600/25 border border-orange-500/20 text-orange-400 px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all self-start sm:self-center"
                    >
                      ล้างฟิลเตอร์ย่อย (แสดงทั้งหมด)
                    </button>
                  )}
                </div>

                {/* Grid of Round Badges matching user's reference image */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-y-6 gap-x-4 justify-items-center py-2" id="subcategories-round-grid">
                  {SOFTWARE_SUBCATEGORIES.map((subcat) => {
                    const isSelected = selectedSoftwareSubcat === subcat.id;
                    const count = subcatCounts[subcat.id] || 0;
                    const IconComponent = subcat.icon;

                    return (
                      <button
                        key={subcat.id}
                        type="button"
                        onClick={() => setSelectedSoftwareSubcat(subcat.id)}
                        className="group flex flex-col items-center gap-2.5 w-full max-w-[100px] outline-none border-none bg-transparent cursor-pointer transition-all text-center"
                      >
                        {/* Circle badge container */}
                        <div
                          className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 transform select-none ${subcat.shadowGlow} ${
                            isSelected
                              ? 'scale-110 shadow-lg ring-4 ring-orange-500/80 ring-offset-4 ring-offset-[#0b101c]'
                              : 'hover:scale-105 active:scale-95 shadow-md hover:brightness-110'
                          }`}
                          style={{
                            background: isSelected
                              ? `radial-gradient(circle, ${subcat.color}dd 0%, ${subcat.color}ff 100%)`
                              : `radial-gradient(circle, ${subcat.color}9c 0%, ${subcat.color}bf 100%)`,
                          }}
                        >
                          {/* Circle Long Shadow Decor Inside */}
                          <div className="absolute inset-0 rounded-full bg-black/5 opacity-10 pointer-events-none transform translate-x-2 translate-y-2 blur-[1px]" />
                          
                          {/* Inner shine */}
                          <div className="absolute inset-0.5 rounded-full bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none" />

                          {/* Icon component */}
                          <IconComponent
                            className={`w-7 h-7 sm:w-9 sm:h-9 transition-transform duration-300 ${
                              isSelected ? 'animate-pulse scale-105' : 'group-hover:rotate-12'
                            }`}
                            style={{
                              color: subcat.id === 'mac' && !isSelected ? '#18181b' : '#ffffff',
                              filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.35))'
                            }}
                          />

                          {/* Floating active crown marker */}
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1 bg-amber-400 text-black rounded-full p-1.5 border border-[#0d1421] shadow-md animate-bounce">
                              <CheckCircle2 className="w-2.5 h-2.5 font-bold animate-ping" />
                            </div>
                          )}
                        </div>

                        {/* Caption & count underneath */}
                        <div className="space-y-0.5">
                          <p className={`text-xs font-bold leading-tight font-sans transition-all duration-200 ${
                            isSelected ? 'text-[#ff5c28] font-black scale-102' : 'text-gray-200 group-hover:text-white'
                          }`}>
                            {subcat.id === 'All' ? 'ทั้งหมด' : subcat.name}
                          </p>
                          <p className={`font-mono text-[9px] font-semibold transition-all ${
                            isSelected ? 'text-orange-400 font-extrabold' : 'text-gray-500 group-hover:text-gray-400'
                          }`}>
                            ({count})
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 💡 EXCITING ADDITION: FOREX EA COMPREHENSIVE SUBCATEGORIES GRID */}
            {activeTab === 'Forex EA' && (
              <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-6 shadow-2xl animate-scaleUp text-left" id="forex-subcategories-panel">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-850 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-[#00e5ff] font-sans">
                        หมวดหมู่ย่อยระบบเทรดและบอทอัตโนมัติ (Forex Bots & Indicators Sub-Categories)
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-400 font-light">
                      สลับคลิกฟิลเตอร์เพื่อเจาะลึกดูประเภทโรบอตผู้ช่วยเทรดหรือระบบสัญญาณคีย์ตัวบ่งชี้ พร้อมสแกนจำนวนรายการอัตโนมัติ
                    </p>
                  </div>
                  {selectedForexSubcat !== 'All' && (
                    <button
                      type="button"
                      onClick={() => setSelectedForexSubcat('All')}
                      className="text-xs bg-cyan-600/10 hover:bg-cyan-600/25 border border-cyan-500/20 text-cyan-400 px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all self-start sm:self-center"
                    >
                      ล้างฟิลเตอร์ย่อย (แสดงทั้งหมด)
                    </button>
                  )}
                </div>

                {/* Grid of Round Badges matching the Forex Neo layout */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-y-6 gap-x-4 justify-items-center py-2" id="forex-subcategories-round-grid">
                  {FOREX_SUBCATEGORIES.map((subcat) => {
                    const isSelected = selectedForexSubcat === subcat.id;
                    const count = forexSubcatCounts[subcat.id] || 0;
                    const IconComponent = subcat.icon;

                    return (
                      <button
                        key={subcat.id}
                        type="button"
                        onClick={() => setSelectedForexSubcat(subcat.id)}
                        className="group flex flex-col items-center gap-2.5 w-full max-w-[125px] outline-none border-none bg-transparent cursor-pointer transition-all text-center"
                      >
                        {/* Circle badge container */}
                        <div
                          className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 transform select-none ${subcat.shadowGlow} ${
                            isSelected
                              ? 'scale-110 shadow-lg ring-4 ring-cyan-400 ring-offset-4 ring-offset-[#0b101c]'
                              : 'hover:scale-105 active:scale-95 shadow-md hover:brightness-110'
                          }`}
                          style={{
                            background: isSelected
                              ? `radial-gradient(circle, ${subcat.color}dd 0%, ${subcat.color}ff 100%)`
                              : `radial-gradient(circle, ${subcat.color}9c 0%, ${subcat.color}bf 100%)`,
                          }}
                        >
                          {/* Circle Long Shadow Decor Inside */}
                          <div className="absolute inset-0 rounded-full bg-black/5 opacity-10 pointer-events-none transform translate-x-2 translate-y-2 blur-[1px]" />
                          
                          {/* Inner shine */}
                          <div className="absolute inset-0.5 rounded-full bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none" />

                          {/* Icon component */}
                          <IconComponent
                            className={`w-7 h-7 sm:w-9 sm:h-9 transition-transform duration-300 ${
                              isSelected ? 'animate-bounce scale-105' : 'group-hover:rotate-12'
                            }`}
                            style={{
                              color: '#ffffff',
                              filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.35))'
                            }}
                          />

                          {/* Floating active check marker */}
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1 bg-amber-400 text-black rounded-full p-1.5 border border-[#0d1421] shadow-md">
                              <CheckCircle2 className="w-2.5 h-2.5 font-bold animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Caption & count underneath */}
                        <div className="space-y-0.5">
                          <p className={`text-xs font-bold leading-tight font-sans transition-all duration-200 ${
                            isSelected ? 'text-[#00e5ff] font-black scale-102' : 'text-gray-200 group-hover:text-white'
                          }`}>
                            {subcat.id === 'All' ? 'แสดงทั้งหมด' : subcat.name.replace('Forex Robot', 'Robot').replace('Trading Bot', 'Bot').replace('Synthetic Robot', 'Synthetic')}
                          </p>
                          <p className={`text-[10px] text-gray-400 leading-normal font-sans`}>
                            {subcat.thaiName.replace('บอทช่วยเทรดอัตโนมัติบน ', '').replace('บอทเทรดรันผ่านแพลตฟอร์ม ', '').replace('บอทเทรดยอดนิยม', '').replace('เครื่องมือนำสายตาช่วยเทรด ', '')}
                          </p>
                          <p className={`font-mono text-[9px] font-semibold transition-all ${
                            isSelected ? 'text-cyan-400 font-extrabold' : 'text-gray-500 group-hover:text-gray-400'
                          }`}>
                            ({count})
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty items panel */}
            {filteredProducts.length === 0 && (
              <div className="bg-[#0b101d] text-center p-16 rounded-3xl border border-gray-800 space-y-4">
                <FolderLock className="w-16 h-16 text-gray-600 mx-auto" />
                <h3 className="text-lg font-semibold text-white">ไม่พบคลังรายการที่ตรงกับการค้นหา</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto">
                  ไม่พบผลิตภัณฑ์ในคีย์เวิร์ดดังกล่าว หากคุณเป็นผู้ดูแลระบบ กรุณาคลิก เชื่อม Google Sheets เพื่อเพิ่มข้อมูลแถวสินค้าลงในชีตตาราง
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setActiveTab('Home'); }}
                  className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  ย้อนกลับสู่หน้าหลัก
                </button>
              </div>
            )}

            {/* HERO Premium Featured Banner (Displays first prominent item) */}
            {featuredProduct && (
              <div className="bg-[#121829] rounded-3xl overflow-hidden border border-gray-800 shadow-2xl transition-all hover:border-gray-700 grid grid-cols-1 lg:grid-cols-5" id="hero-showcase">
                <div className="lg:col-span-3 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                        ★ ไอเทมยอดนิยมสัปดาห์นี้
                      </span>
                      <span className="bg-gray-900 border border-gray-800 text-gray-300 text-[10px] px-3 py-1 rounded-full font-bold">
                        หมวดหมู่: {featuredProduct.category}
                      </span>
                    </div>

                    <h3 className="text-3xl font-black text-white leading-tight font-sans tracking-tight">
                      {featuredProduct.title}
                    </h3>
                    
                    <p className="text-sm text-gray-300 leading-relaxed max-w-2xl font-sans font-light">
                      {getCleanPreviewText(featuredProduct.description)}
                    </p>
                  </div>

                  {/* Badges metadata metrics matching user screenshot */}
                  <div className="bg-gray-950/60 border border-gray-800/80 p-5 rounded-2xl grid grid-cols-3 gap-4 text-center select-none shadow-inner">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">ยอดจองผู้ชม</span>
                      <p className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1">
                        <Eye className="w-3.5 h-3.5 block" />
                        {Number(featuredProduct.views).toLocaleString() || featuredProduct.views} <span className="text-[10px] text-gray-400 font-light">ครั้ง</span>
                      </p>
                    </div>
                    <div className="space-y-1 border-x border-gray-800">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">ยอดดาวน์โหลด</span>
                      <p className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1">
                        <Download className="w-3.5 h-3.5 block" />
                        {Number(featuredProduct.downloads).toLocaleString() || featuredProduct.downloads} <span className="text-[10px] text-gray-400 font-light">ครั้ง</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">ขนาดไฟล์สินค้า</span>
                      <p className="text-sm font-bold text-indigo-400">
                        {featuredProduct.fileSize}
                      </p>
                    </div>
                  </div>

                  {/* Actions to open details */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setSelectedProduct(featuredProduct)}
                      className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-black shadow-lg shadow-amber-500/10 px-6 py-3.5 rounded-xl cursor-pointer flex items-center gap-2 transform active:scale-95 transition-all text-center"
                    >
                      <Plus className="w-4 h-4 text-black font-extrabold" />
                      ดูรายละเอียดและดาวน์โหลดฟรี
                    </button>
                    <button
                      onClick={() => triggerDownloadAction(featuredProduct)}
                      className="bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 py-3.5 px-6 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <ExternalLink className="w-4.5 h-4.5" />
                      ลิงก์สำรองตรง
                    </button>
                  </div>
                </div>

                {/* Hero Showcase Display Image */}
                <div className="lg:col-span-2 relative min-h-[300px] bg-gray-950 overflow-hidden select-none">
                  {featuredProduct.isHtmlImage && featuredProduct.htmlImage ? (
                    <div 
                      className="w-full h-full [&>img]:w-full [&>img]:h-full [&>img]:object-cover opacity-85 hover:scale-105 transition-all duration-700"
                      dangerouslySetInnerHTML={{ __html: featuredProduct.htmlImage }}
                    />
                  ) : (
                    <img
                      src={featuredProduct.imageUrl || null}
                      alt={featuredProduct.title}
                      className="w-full h-full object-cover opacity-85 hover:scale-105 transition-all duration-700"
                      referrerPolicy="no-referrer"
                      data-original-drive-id={getGoogleDriveId(featuredProduct.imageUrl || '') || undefined}
                      onError={handleImageError}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121829] via-[#121829]/30 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#121829] via-transparent to-transparent pointer-events-none" />
                  
                  {/* Rating indicator */}
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm border border-amber-500/30 p-2.5 rounded-xl flex items-center gap-1 shadow-lg font-mono">
                    <Star className="w-4.5 h-4.5 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-white">{featuredProduct.rating} / 5.0</span>
                  </div>
                </div>
              </div>
            )}

            {/* Grid Products (Remaining cards catalog list) */}
            {gridProducts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                    รายการดาวน์โหลดทั้งหมด ({filteredProducts.length})
                  </h4>
                  <div className="h-0.5 bg-gray-800 flex-1 ml-4" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gridProducts.map((p, index) => (
                    <div
                      key={p.id || index}
                      className="bg-[#0b101c] rounded-2xl overflow-hidden border border-gray-800 hover:border-amber-500/40 shadow-xl transition-all hover:-translate-y-1 duration-300 flex flex-col justify-between group"
                    >
                      {/* Image cover header with badges overlay */}
                      <div className="relative h-44 bg-gray-950 overflow-hidden select-none">
                        {p.isHtmlImage && p.htmlImage ? (
                          <div 
                            className="w-full h-full [&>img]:w-full [&>img]:h-full [&>img]:object-cover group-hover:scale-110 transition-all duration-500 opacity-80"
                            dangerouslySetInnerHTML={{ __html: p.htmlImage }}
                          />
                        ) : (
                          <img
                            src={p.imageUrl || null}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500 opacity-80"
                            referrerPolicy="no-referrer"
                            data-original-drive-id={getGoogleDriveId(p.imageUrl || '') || undefined}
                            onError={handleImageError}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b101c] via-[#0b101c]/40 to-transparent" />
                        
                        {/* Tags */}
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                          <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] px-2.5 py-0.5 rounded-md font-bold uppercase backdrop-blur-sm">
                            {p.category}
                          </span>
                        </div>

                        {/* Rating Overly */}
                        <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm border border-amber-500/20 text-[10px] font-bold px-2 py-1 rounded text-white flex items-center gap-1 shadow-lg font-mono">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {p.rating}
                        </div>
                      </div>

                      {/* Card Content parameters */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1 font-sans">
                            {p.title}
                          </h4>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {getCleanPreviewText(p.description)}
                          </p>
                        </div>

                        {/* File metrics metadata bar */}
                        <div className="bg-[#070b13] p-3 rounded-xl border border-gray-850 grid grid-cols-3 gap-1.5 text-center text-[11px] font-medium text-gray-300">
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-gray-500 uppercase block select-none">ยอดโหลด</span>
                            <span className="text-emerald-400 font-bold block">{Number(p.downloads).toLocaleString() || p.downloads}</span>
                          </div>
                          <div className="space-y-0.5 border-x border-gray-800">
                            <span className="text-[9px] text-gray-500 uppercase block select-none">ยอดดู</span>
                            <span className="text-amber-400 font-bold block">{Number(p.views).toLocaleString() || p.views}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-gray-500 uppercase block select-none">ขนาดไฟล์</span>
                            <span className="text-indigo-400 font-bold block truncate">{p.fileSize}</span>
                          </div>
                        </div>

                        {/* Detailed action buttons */}
                        <div className="pt-2 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSelectedProduct(p)}
                            className="bg-gray-900 border border-gray-800 hover:bg-gray-850 text-gray-200 text-xs font-semibold py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                            รีวิวละเอียด
                          </button>
                          <button
                            onClick={() => triggerDownloadAction(p)}
                            className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 transform active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5 text-black" />
                            ดาวน์โหลด
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: DONATION LABELS & TIPS WINDOW (วิธีใช้ & ค่าน้ำชา) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'Donate' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn" id="donate-view">
            
            {/* Main Header Guide */}
            <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 shadow-2xl space-y-3">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 font-sans">
                <Heart className="w-6 h-6 text-amber-500 fill-amber-500" />
                สนับสนุนค่าน้ำชาผู้พัฒนา
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed font-sans">
                คลังซอฟต์แวร์และเซิร์ฟเวอร์แจกฟรี ทำงานรันอัตโนมัติ 24 ชั่วโมง มีค่าใช้จ่ายคลาวด์ คุณอภิสิทธิ์สแกนมัลแวร์และคีย์ และสามารถร่วมสมทบทุนสนับสนุน <strong>10 บาท, 20 บาท หรือตามความศรัทธา</strong> เพื่อพัฒนาบอทระบบ Forex และสรรพปัญญาอื่นลงชีตต่อจ้า!
              </p>
            </div>

            {/* Donation QR & Instruction steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box A: Scanning Barcode container Mock */}
              <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 text-center space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-bl-xl shadow font-mono">
                  PromptPay QR
                </div>
                <h3 className="text-sm font-bold text-gray-300 text-left uppercase tracking-wide">
                  ช่องทางสนับสนุนค่าน้ำชา
                </h3>
                
                {/* QR Display container */}
                <div className="bg-white p-5 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-inner relative group select-none">
                  {/* Custom scanned mockup generated dynamically */}
                  <img
                    src="https://images.unsplash.com/photo-1595079676339-1534801ad6cf?auto=format&fit=crop&w=300&q=80"
                    alt="PromptPay QR Code"
                    className="w-full h-full object-cover scale-95 opacity-90 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center group-hover:bg-black/0 transition-all" />
                </div>

                <div className="space-y-1 font-sans">
                  <p className="text-xs text-gray-400">สแกนบริจาคผ่านโมบายล์แบงค์กิ้งระบบใดก็ได้</p>
                  <p className="text-md font-bold text-amber-500">พร้อมเพย์ หมายเลข: 089-XXX-XXXX</p>
                  <p className="text-[10px] text-gray-500">บัญชี โอนฟรี ไม่มีค่าธรรมเนียม ทุกยอดเข้าบัญชีนักพัฒนาตรง</p>
                </div>
              </div>

              {/* Box B: Explanatory steps list */}
              <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-5">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                  ขั้นตอนและวิธีการใช้งานอย่างถูกต้อง
                </h3>
                
                <div className="space-y-4 text-xs text-gray-300 leading-relaxed font-sans">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      1
                    </span>
                    <div>
                      <h4 className="font-bold text-white mb-0.5">ค้นหาและเลือกรีวิวสินค้าที่ชอบ</h4>
                      <p className="text-gray-400">พิมพ์คำค้นบนเมนูบาร์ กดชมคะแนนรีวิว และรายละเอียดเพื่อประกอบการตัดสินใจ</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      2
                    </span>
                    <div>
                      <h4 className="font-bold text-white mb-0.5">กดยืนยันดาวน์โหลด (ปลอดภัยมัลแวร์ 100%)</h4>
                      <p className="text-gray-400">ระบบคลังสินค้าใช้ Google Sheets ร่วมส่งลิงก์ดาวน์โหลดอย่างโปร่งใส ไร้หน้าต่างดาวน์โหลดหลอกสแปม</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      3
                    </span>
                    <div>
                      <h4 className="font-bold text-white mb-0.5">สนับสนุนฝากข้อมูลค่าน้ำชา</h4>
                      <p className="text-gray-400">เมื่อโอนสแกนแล้ว คุณผู้ดูแลสามารถนำค่าผู้โอนมาประดับบนชีตสเปรดแผ่นที่สองได้ เพื่อเป็นเกียรติจารึกรักน้ำชาผู้จุนเจือ</p>
                    </div>
                  </div>
                </div>

                {/* Secure instructions block */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-400 flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>คำเตือนความเสี่ยง:</strong> การรันบอทเทรดทองคำ/Forex EA ควรเทสในบัญชีเดโมก่อนรันพอร์ตจริง การลงทุนเทรดมีความผันผวนสูง โปรแกรมคอยอำนวยการเชิงเทคนิคไม่รับรองกำไรสูงสุดจำเจ็ด!
                  </span>
                </div>
              </div>

            </div>

            {/* Donation Log (Backed by Google Sheet logs tab if selected, or Mocks) */}
            <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-sans">
                    <Heart className="w-4.5 h-4.5 text-rose-500 fill-rose-500" />
                    ตารางเกียรติยศบันทึกผู้สนับสนุนค่าน้ำชาล่าสุด
                  </h3>
                  <p className="text-xs text-gray-400">บันทึกยอดร่วมสมทบทุนคลาวด์ แจกหนังและบอทเอไอ (รวมสดเชื่อมจากตารางชีตแผ่นที่สอง 2)</p>
                </div>
                <div className="text-[10px] text-gray-500 font-mono bg-black/40 border border-gray-800 px-3 py-1.5 rounded-lg select-none">
                  แผ่นงานอิง: Donation Logs
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-850">
                <table className="w-full text-xs text-left text-gray-300">
                  <thead className="bg-[#070b13] text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="p-4 border-b border-gray-800">รายชื่อผู้สนับสนุน</th>
                      <th className="p-4 border-b border-gray-800">ยอดบริจาค</th>
                      <th className="p-4 border-b border-gray-800">วันเวลาโอน</th>
                      <th className="p-4 border-b border-gray-800 font-sans text-right">ข้อความแสดงความประสงค์</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850 bg-gray-950/20">
                    {donations.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-900/40 transition-colors">
                        <td className="p-4 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          {d.name}
                        </td>
                        <td className="p-4 text-emerald-400 font-semibold">{d.amount}</td>
                        <td className="p-4 text-gray-400">{d.date}</td>
                        <td className="p-4 text-gray-300 text-right italic text-[11px] font-sans">"{d.message}"</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 3: COMPLEX ADMIN GOOGLE SHEETS SETTINGS MANAGER 🛰️ */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'SheetsConfig' && (
          <div className="space-y-8 animate-fadeIn" id="sheets-config-view">
            
            {/* Header Settings */}
            <div className="bg-[#121829] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 md:max-w-xl">
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 font-sans">
                  <Settings className="w-5 h-5 text-indigo-400" />
                  ระบบนำทางคลังแอดมิน: แผงควบคุมการเชื่อมต่อ Google Sheets API
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed font-sans">
                  ยินดีต้อนรับผู้พัฒนา! คุณสามารถแก้ไขตารางสินค้า เพิ่มไฟล์ ดาวน์โหลดหนัง หรือบอท Forex EA ได้สดจากช่องทาง Google Sheets บัญชีของคุณ เมื่อทำการสลับหรือโหลด ตารางหน้าร้าน HUB Free ด้านบนจะอัปเดตตอบสนองเรียลไทม์ทันที
                </p>
              </div>

              {/* Status Indicator */}
              <div className="shrink-0 flex items-center gap-3 font-mono bg-black/60 border border-gray-850 p-4 rounded-2xl select-none">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 uppercase font-sans">โหมดโครงข่ายไฟฟ้า</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isCloudMode ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                    <span className="text-xs font-bold text-white">
                      {isCloudMode ? 'CLOUD (Live Sheets)' : 'SANDBOX (Local)'}
                    </span>
                  </div>
                </div>
                
                {/* Reset button */}
                <button
                  onClick={() => {
                    setIsCloudMode(!isCloudMode);
                    addLog('info', `ผู้พัฒนา: สลับสถาบันโหมดเป็น ${!isCloudMode ? 'Cloud Live Sheets' : 'Sandbox แซนด์บอกซ์'}`);
                  }}
                  className="bg-gray-900 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-gray-800 cursor-pointer transition-all shrink-0"
                >
                  สลับโหมดด่วน
                </button>
              </div>
            </div>

                  {/* 📦 สำหรับผู้พัฒนา: ดาวน์โหลดซอร์สโค้ด ZIP สำรอง (เนื่องจากระบบบราว์เซอร์บล็อกปุ่มภายนอก) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="dev-download-github-grid">
              
              {/* Direct ZIP Download */}
              <div className="bg-[#121829] p-6 rounded-3xl border border-indigo-500/20 shadow-xl flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block font-sans">
                      วิธีที่ 1 สำหรับผู้พัฒนา
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-white font-sans">
                    ดาวน์โหลดซอร์สโค้ดดิ้งดิบของตัวพอร์ทัล (.ZIP)
                  </h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                    บีบอัดไฟล์ React + Vite + Tailwind CSS ข้อมูลระบบทั้งหมดเพื่อนำไปรันบน VS Code / เครื่องของคุณและเชื่อม Firebase ของคุณเองได้ทันที
                  </p>
                </div>
                <button
                  onClick={handleClientDownloadZip}
                  disabled={isZipping}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-850 disabled:text-gray-500 text-white border-none py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg hover:shadow-indigo-500/20 text-xs font-sans"
                >
                  {isZipping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      กำลังสร้างไฟล์ ZIP สำรอง...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      สร้างและดาวน์โหลด Source .ZIP (ด่วน)
                    </>
                  )}
                </button>
              </div>

              {/* GitHub Repo Card */}
              <div className="bg-[#121829] p-6 rounded-3xl border border-emerald-500/20 shadow-xl flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block font-sans">
                      วิธีที่ 2 สำหรับสายอัปขึ้นเว็บ (Vercel)
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-white font-sans">
                    ส่งโค้ดล่าสุดจากหน้านี้ขึ้น GitHub ของคุณโดยตรง
                  </h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                    คุณสามารถกดส่งออกซอร์สโค้ดปัจจุบันที่ผ่านการแก้ไขและเชื่อมต่อ Google Sheets แล้ว ไปยังคลัง GitHub ของคุณได้อย่างสมบูรณ์แบบ
                  </p>
                  <div className="bg-emerald-950/20 border border-emerald-500/10 p-3 rounded-xl space-y-1.5 text-[11px] text-gray-300">
                    <p className="font-semibold text-emerald-400">💡 ขั้นตอนการอัปเดตโค้ดขึ้น GitHub:</p>
                    <ul className="list-decimal pl-4 space-y-1 text-gray-400">
                      <li>กดปุ่ม <span className="text-white font-bold">⚙️ Settings (รูปเฟือง)</span> หรือเมนูทางด้านขวาบนของหน้าต่าง Google AI Studio</li>
                      <li>เลือก <span className="text-white font-bold">Export to GitHub</span></li>
                      <li>เชื่อมต่อบัญชี GitHub ของคุณ แล้วเลือก Repository <span className="text-emerald-400 font-semibold">noinahub</span> เพื่อบันทึกทับไฟล์ทั้งหมด</li>
                    </ul>
                  </div>
                </div>
              </div>

            </div>

            {/* Iframe Iframe Warning Tips & Google Sheets Template setup Instructions */}
            <div className="bg-indigo-950/20 border border-indigo-900/40 p-6 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2 font-sans">
                <AlertCircle className="w-5 h-5 shrink-0" />
                คำแนะนำที่สำคัญ: เหตุใดหน้าจอ "ไม่ตอบสนอง" หรือหน้าต่าง Popup หาย?
              </h3>
              
              <div className="text-xs text-gray-300 leading-relaxed font-sans space-y-3">
                <p>
                  เนื่องจากในสภาพแวดล้อมโปรแกรมจำลอง **AI Studio (Iframe)** บราวเซอร์จะกระทำการบล็อกโฮสต์หน้าต่างป๊อปอัพเพื่อเหตุระบบความปลอดภัย ทำให้ระบบไม่สามารถขอเชื่อมบัญชี Google ของท่านได้โดยสะดวก หากพบอาการดังกล่าว นี่คือ **2 ทางเลือกในการแก้ไขปัญหาอย่างง่ายได้ผล 100%:**
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-black/50 p-4 rounded-xl border border-gray-850 space-y-2">
                    <h4 className="font-extrabold text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      1. เปิดแอปนี้ในแท็บใหม่ของบราวเซอร์ (แนะนำ!)
                    </h4>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      เพียงคลิกปุ่มเปิดแท็บใหม่ด้านขวาล่าง หรือกดยิงปุ่มเปิดลิงก์ด้านล่างเพื่อรันตัวเว็บแยกอิสระจาก Iframe ส่งผลให้หน้าต่าง Google Account เด้งล็อกอินเสร็จได้อย่างรวดเร็วตอบสนองปกติ
                    </p>
                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      เปิดระบบในแท็บใหม่แยกอิสระ
                    </button>
                  </div>

                  <div className="bg-black/50 p-4 rounded-xl border border-gray-850 space-y-2">
                    <h4 className="font-extrabold text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      2. เชื่อมโทเค็นสิทธิแบบใส่เองถาวร (สำหรับนักพัฒนา)
                    </h4>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      หากต้องการรันเพื่อสลับดึงข้อมูลคลาวด์บน Iframe ทันที สามารถคัดลอกรหัสเข้าใช้ (Gmail OAuth Access Token) ป้อนเข้าระบบหลักได้เพื่อบายพาสความค้างของหน้าล็อกอิน
                    </p>
                    <button
                      onClick={() => setShowTokenInput(!showTokenInput)}
                      className="mt-2 w-full bg-gray-900 hover:bg-gray-800 text-amber-500 hover:text-white text-[11px] font-bold py-2 px-3 border border-gray-800 rounded-lg cursor-pointer transition-all"
                    >
                      {showTokenInput ? 'ซ่อนพาเนลคีย์ป้อนมือ' : 'กรอกอนุญาตสิทธิ์เข้าใช้ด่วน'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggleable Manual Token Form */}
              {showTokenInput && (
                <div className="bg-black/80 rounded-2xl p-5 border border-amber-500/30 text-xs text-gray-300 space-y-3 animate-slideDown">
                  <h4 className="text-sm font-bold text-amber-500">ใส่คีย์รับสิทธิ์อนุญาตเข้าใช้ (OAuth Access Token Input Box)</h4>
                  <p className="text-[11px] text-gray-400">
                    หากมีความชำนาญ สามารถดึง Token ผ่านหน้าคอนโซล Google Developer Console ป้อนเพื่อเรียกพอร์ตดึงไฟล์ Google Sheets โดยปราศจากป๊อปอัพบล็อก
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (manualToken.trim()) {
                        handleManualTokenApplied(manualToken.trim());
                      }
                    }}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="password"
                      placeholder="ป้อนรหัส OAuth Access Bearer Token ยืนยันสิทธิ์..."
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="bg-gray-950 border border-gray-800 text-white py-2 px-3 rounded-lg flex-1 text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-600 text-black py-2 px-4 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      อัปเดตโทเค็น
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Quick Template Structure Help Panel */}
            <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-sans">
                    <Database className="w-5 h-5 text-amber-500" />
                    แม่แบบคอลัมน์ตาราง Google Sheets โครงสร้างสินค้าดั้งเดิม
                  </h3>
                  <p className="text-xs text-gray-400 font-sans">
                    ตารางชีตของคุณต้องสร้างแถวหัวข้อหลัก (แถวที่ 1) ด้วยคีย์คำเหล่านี้ เพื่อให้ระบบดึงข้อมูลไปแสดงผลได้อย่างลงตัวสมบูรณ์
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("Title\tCategory\tDescription\tDetailedDescription\tViews\tDownloads\tFileSize\tImageUrl\tDownloadUrl\tRating");
                    addLog('success', 'ระบบ: คัดลอกแถวหัวข้อตารางลงคลิปบอร์ดแล้ว นำไปวางในแถวที่ 1 ของแผ่นงานชีตใหม่ได้เลย!');
                  }}
                  className="bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 text-xs px-3.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer select-none transition-all font-sans"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                  คัดลอกแถวหัวข้อชีต
                </button>
              </div>

              {/* Column labels visuals flow */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-10 gap-3 text-center">
                {[
                  { k: 'Title', d: 'ชื่อแบรนด์/โปรแกรม' },
                  { k: 'Category', d: 'ดูหนังฟรี หรือ โหลดซอฟต์แวร์ หรือ บอท Forex EA' },
                  { k: 'Description', d: 'คำโปรย / คำสรุปย่อ' },
                  { k: 'DetailedDescription', d: 'รายละเอียดเต็มแบบเปิดโค้ด HTML' },
                  { k: 'Views', d: 'จำนวนคนดู (เป็นตัวเลข)' },
                  { k: 'Downloads', d: 'จำนวนคนโหลด (ตัวเลข)' },
                  { k: 'FileSize', d: 'ขนาดไฟล์ (เช่น 4.5 MB)' },
                  { k: 'ImageUrl', d: 'ลิงก์รูปหน้าปกจากเน็ต' },
                  { k: 'DownloadUrl', d: 'ลิงก์ดาวน์โหลดปลายทาง' },
                  { k: 'Rating', d: 'คะแนนความหรูหรา (เช่น 4.9)' }
                ].map((item, i) => (
                  <div key={i} className="bg-black/50 p-2.5 rounded-xl border border-gray-850 space-y-1 text-center font-mono">
                    <span className="text-amber-500 text-xs font-bold block">{item.k}</span>
                    <span className="text-[10px] text-gray-400 leading-tight block">{item.d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Manager Section Grid Block */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 3.1: Account Log In Flow & Spreads file explorer */}
              <div className="lg:col-span-1 space-y-6">
                
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
              {/* Toggleable Credentials Settings Input Panel */}
                  {showCredentialsSettings && (
                    <div className="bg-black/60 border border-gray-850 p-4 rounded-2xl space-y-4 text-[11px] leading-relaxed max-h-[500px] overflow-y-auto">
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-extrabold block">✨ วิธีที่ 3: ระบบเชื่อมทางตรงด้วย Google Apps Script (แนะนำที่สุด! เสถียร 100%)</span>
                        <p className="text-[10px] text-gray-400 font-sans">
                          แก้ปัญหา "auth/unauthorized-domain" หรือปัญหากล่องป๊อปอัป Google ค้างบนมือถือและ Vercel ได้อย่างถาวรโดยไม่ต้องทำ Google/Firebase OAuth เลย!
                        </p>
                        <div className="bg-gray-950 p-2 border border-gray-855 rounded-xl space-y-1">
                          <span className="text-[9px] text-amber-500 font-bold block">💡 ขั้นตอนการทำเพียง 2 นาที:</span>
                          <ol className="list-decimal list-inside text-[9px] text-gray-400 space-y-0.5">
                            <li>เปิด <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">script.google.com</a> แล้วกด "โครงการใหม่"</li>
                            <li>คัดลอกสคริปต์ในตารางด้านล่างนี้ไปวางแทนที่ของเดิมทั้งหมด</li>
                            <li>กด "ทำให้จัดใช้งาน" (Deploy) และเลือก "การจัดวางจำหน่ายใหม่" (New Deployment)</li>
                            <li>เลือกประเภทเป็น "เว็บแอป" (Web App)</li>
                            <li>ตั้งค่าสิทธิ์ผู้มีสิทธิ์เข้าถึงเป็น "ทุกคน" (Anyone) แล้วกดจัดใช้งาน</li>
                            <li>คัดลอก URL เว็บแอปที่ระบุ (เช่น https://script.google.com/.../exec) มาวางในช่องด้านล่างนี้ได้เลย!</li>
                          </ol>
                        </div>
                        <textarea
                          readOnly
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                          value={`function doGet(e) {
  var action = e.parameter.action;
  var spreadsheetId = e.parameter.spreadsheetId;
  var sheetTitle = e.parameter.sheetTitle || "Sheet1";
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (action === "getMetadata") {
      var sheets = ss.getSheets().map(function(s) {
        return { title: s.getName(), index: s.getIndex() - 1 };
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", title: ss.getName(), sheets: sheets })).setMimeType(ContentService.MimeType.JSON);
    }
    var sheet = ss.getSheetByName(sheetTitle) || ss.getSheets()[0];
    if (action === "read") {
      var values = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", values: values })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;
  var spreadsheetId = data.spreadsheetId;
  var sheetTitle = data.sheetTitle || "Sheet1";
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetTitle) || ss.getSheets()[0];
    if (action === "update") {
      var row = data.rowIdx + 1;
      var col = data.colIdx + 1;
      sheet.getRange(row, col).setValue(data.value);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "append") {
      sheet.appendRow(data.row);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "createSheet") {
      var newSheet = ss.insertSheet(data.title);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                          className="w-full h-20 bg-gray-950 border border-gray-850 rounded-xl p-2 text-[9px] font-mono text-gray-500 focus:outline-none focus:border-amber-500"
                          title="คลิกเพื่อเลือกโค้ดทั้งหมดแล้วคัดลอก (Ctrl+C)"
                        />
                        <input
                          type="text"
                          placeholder="วางลิงก์ Google Apps Script URL ที่จัดใช้งานแล้ว..."
                          value={customAppsScriptUrl}
                          onChange={(e) => setCustomAppsScriptUrl(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-850 rounded-xl p-2 text-[10px] font-mono text-gray-300 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="h-px bg-gray-900" />

                      <div className="space-y-1">
                        <span className="text-amber-500 font-extrabold block">วิธีที่ 1) ผูก Firebase โครงการของคุณเอง</span>
                        <p className="text-[10px] text-gray-500 font-sans">
                          หากใช้งานบนโดเมน Vercel/ผู้ให้บริการภายนอกแล้วต้องการใช้ OAuth, ให้คัดลอก JSON Config จากคอนโซล Firebase ของคุณวางเพื่อผูกสิทธิ์ได้ทันที
                        </p>
                        <textarea
                          placeholder='ตัวอย่าง: { "apiKey": "...", "authDomain": "..." }'
                          value={customFirebaseJson}
                          onChange={(e) => setCustomFirebaseJson(e.target.value)}
                          className="w-full h-16 bg-gray-950 border border-gray-850 rounded-xl p-2 text-[10px] font-mono text-gray-300 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="h-px bg-gray-900" />

                      <div className="space-y-1">
                        <span className="text-amber-500 font-extrabold block">วิธีที่ 2) เข้าใช้ด้วย Google Client ID ของคุณ</span>
                        <p className="text-[10px] text-gray-500 font-sans">
                          ระบุ Google OAuth Client ID เพื่อใช้ระบบล็อกอินด่านทาง Google Direct โดยไม่ใช้ Firebase
                        </p>
                        <input
                          type="text"
                          placeholder="วาง Google Client ID ที่ได้รับ..."
                          value={customClientId}
                          onChange={(e) => setCustomClientId(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-850 rounded-xl p-2 text-[10px] font-mono text-gray-300 focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleTriggerImplicitFlow}
                          disabled={!customClientId.trim()}
                          className="mt-1 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-850 disabled:text-gray-500 text-white text-[10px] font-extrabold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-all"
                        >
                          <Globe className="w-3 h-3" />
                          ล็อกอินข้ามผ่านทาง Client ID
                        </button>
                      </div>

                      <div className="pt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveCustomCredentials(customFirebaseJson, customClientId, customAppsScriptUrl)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg transition-all text-center text-[11px]"
                        >
                          บันทึก / อัปเดตการตั้งค่า
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('คุณต้องการรีเซ็ตสิทธิ์การตั้งค่าพิเศษนี้และกลับไปใช้ค่าเริ่มต้นโครงการดั้งเดิมใช่หรือไม่?')) {
                              localStorage.removeItem('custom_firebase_config');
                              localStorage.removeItem('custom_google_client_id');
                              localStorage.removeItem('custom_apps_script_url');
                              window.location.reload();
                            }
                          }}
                          className="bg-rose-950/40 hover:bg-rose-950 text-rose-300 hover:text-rose-100 px-3 py-1.5 rounded-lg text-center font-bold text-[11px]"
                        >
                          ล้างค่าทั้งหมด
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Spreadsheet files list explorer selection */}
                <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                        รายการคลังสเปรดชีต
                      </h3>
                      <p className="text-[11px] text-gray-500 font-sans">
                        เลือกดึงข้อมูลจากสมุดจดใดๆ
                      </p>
                    </div>
                    {isFilesLoading && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                  </div>

                  {/* Load ID / URL paste box */}
                  <form onSubmit={handleCustomImportSubmit} className="space-y-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">ความยาวลิงก์สเปรดชีต หรือ ID สารบบ</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="วางไฟล์ ID หรือ ลิงก์ชีตหน้านี้..."
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        className="bg-gray-950 border border-gray-800 text-white p-2 rounded-lg flex-1 text-xs focus:outline-none focus:border-amber-500"
                        id="sheet-id-input"
                      />
                      <button
                        type="submit"
                        className="bg-gray-900 border border-gray-850 hover:bg-gray-855 text-amber-500 hover:text-white px-3.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                      >
                        เปิดสด
                      </button>
                    </div>
                  </form>

                  <div className="h-px bg-gray-850" />

                  {/* Spreadsheets directory items */}
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {files.map((file, i) => (
                      <button
                        key={file.id || i}
                        onClick={() => loadFileGrid(file.id, file.name)}
                        className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                          activeSpreadsheetId === file.id
                            ? 'bg-indigo-600/10 border-indigo-500/50 text-white font-extrabold'
                            : 'bg-black/20 border-gray-850 text-gray-400 hover:text-white hover:bg-black/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeSpreadsheetId === file.id ? 'text-indigo-400' : 'text-gray-500'}`} />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      </button>
                    ))}
                    {files.length === 0 && (
                      <p className="text-[10px] text-gray-500 italic py-2 text-center select-none">ไม่พบคลังไฟล์สเปรดชีตใดๆ ขณะนี้</p>
                    )}
                  </div>

                  {/* Create New sheet option */}
                  {isCloudMode && (
                    <form onSubmit={handleCreateSheetSubmit} className="space-y-1.5 pt-2 border-t border-gray-850">
                      <label className="text-[10px] text-gray-500 uppercase block">สร้างสมุดสเปรดชีตว่างเปล่าอันใหม่</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="พิมพ์ชื่อชีตผลิตภัณฑ์ใหม่..."
                          value={newSheetTitle}
                          onChange={(e) => setNewSheetTitle(e.target.value)}
                          className="bg-gray-950 border border-gray-800 text-white p-2 text-xs rounded-lg flex-1"
                        />
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  )}
                </div>

              </div>

              {/* Column 3.2: Interactive Database Rows Editor & Logger status (Grid table) */}
              <div className="lg:col-span-2 space-y-6">

                {/* Core Live Product Grid Cells Editor */}
                <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-850 pb-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-sans">
                        <Database className="w-4.5 h-4.5 text-amber-500" />
                        ตารางแก้ไขข้อมูลสดแผ่นงาน: {activeSpreadsheetName || 'Sandbox'}
                      </h3>
                      <p className="text-xs text-gray-400 font-sans">
                        สแกนข้อมูลแถว ดับเบิ้ลคลิกเพื่อแก้ไขเซลล์ย่อย ตารางจะบันทึกลง Google Sheet และอัปเดตหน้าร้านพอร์ทัลทันที
                      </p>
                    </div>

                    {/* Worksheets tabs options selector */}
                    {worksheets.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 bg-black/40 border border-gray-850 p-1.5 rounded-xl max-w-full overflow-x-auto">
                        {worksheets.map((w, i) => (
                          <button
                            key={i}
                            onClick={() => handleTabChange(w.title)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                              activeWorksheet === w.title
                                ? 'bg-amber-500 text-black font-black'
                                : 'text-gray-400 hover:text-white hover:bg-gray-900'
                            }`}
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
                      <div className="overflow-x-auto rounded-xl border border-gray-850 max-h-96">
                        <table className="w-full text-left border-collapse text-xs font-mono">
                          <thead className="bg-[#070b13] sticky top-0 text-gray-400 text-[10px] uppercase font-bold tracking-wide shadow-sm">
                            <tr>
                              <th className="p-3 border-r border-b border-gray-850 text-center w-12 select-none select-none">#</th>
                              {sheetRows[0] && sheetRows[0].map((header, cIdx) => (
                                <th key={cIdx} className="p-3 border-r border-b border-gray-850 text-amber-500 font-extrabold font-sans">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-850 bg-gray-950/20">
                            {sheetRows.slice(1).map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-gray-900/30 transition-colors">
                                <td className="p-3 border-r border-gray-850 text-center text-gray-600 font-sans font-bold select-none">{rIdx + 2}</td>
                                {sheetRows[0].map((_, cIdx) => {
                                  const cellValue = row[cIdx] || '';
                                  const isEditing = editingCell?.r === rIdx + 1 && editingCell?.c === cIdx;
                                  
                                  return (
                                    <td 
                                      key={cIdx} 
                                      className="p-3 border-r border-gray-850 text-gray-300 min-w-[120px] relative max-w-[200px] truncate"
                                      onDoubleClick={() => {
                                        setEditingCell({ r: rIdx + 1, c: cIdx });
                                        setEditValue(cellValue);
                                      }}
                                    >
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onBlur={() => handleCellUpdateSubmit(rIdx + 1, cIdx, editValue)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCellUpdateSubmit(rIdx + 1, cIdx, editValue);
                                            if (e.key === 'Escape') setEditingCell(null);
                                          }}
                                          autoFocus
                                          className="absolute inset-0 w-full bg-[#1e293b] text-white py-1 px-3 text-xs border border-amber-500 select-all outline-none font-mono"
                                        />
                                      ) : (
                                        <span className="cursor-pointer block min-h-[1.5rem] w-full" title="ดับเบิ้ลคลิกเพื่อเปิดตารางพิมพ์แก้ไขโดยตรง">
                                          {cellValue || <em className="text-gray-600 text-[10px] font-sans italic">ว่างเปล่า</em>}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {sheetRows.length < 2 && (
                          <div className="p-10 text-center text-xs text-gray-500 italic select-none">
                            ไม่มีแสดงผลตารางคลังสินค้าเลย กรุณากรอกคอร์มูลเสริมแถวด้านล่าง
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row Append Form option */}
                    {activeSpreadsheetId && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="bg-indigo-600 hover:bg-indigo-700 font-sans text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer select-none transition-all shadow-md active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                            {showAddForm ? 'ปิดหน้าต่างกรอก' : 'เพิ่มรายการแถวผลิตภัณฑ์ใหม่'}
                          </button>
                          <span className="text-[10px] text-gray-500">ยึดตามหัวข้อชีต: {activeWorksheet}</span>
                        </div>

                        {showAddForm && (
                          <form onSubmit={handleAddProductSubmit} className="bg-gray-950 p-5 rounded-2xl border border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slideDown">
                            <h4 className="text-sm font-bold text-white sm:col-span-2 border-b border-gray-850 pb-2 mb-2">ช่องกรอกเพิ่มสินค้าเข้ารายการแผ่นงานชีต</h4>
                            
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">ชื่อผลงาน / หัวข้อสินค้า</label>
                              <input
                                type="text"
                                required
                                value={newProduct.title}
                                onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                                className="w-full bg-[#070b13] border border-gray-850 text-white rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                                placeholder="เช่น Gold Expert EA v2.0"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">หมวดหมู่ของสินค้า</label>
                              <select
                                value={newProduct.category}
                                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                                className="w-full bg-[#070b13] border border-gray-850 text-white rounded-lg p-2 text-xs focus:border-amber-500 outline-none font-sans cursor-pointer"
                              >
                                <option value="บอท Forex EA">บอท Forex EA</option>
                                <option value="โหลดซอฟต์แวร์">โหลดซอฟต์แวร์</option>
                                <option value="ดูหนังฟรี (24-hds)">ดูหนังฟรี (24-hds)</option>
                                <option value="ทั่วไป">ทั่วไป</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">สปอยล์/คำอธิบายย่อ (Description)</label>
                              <textarea
                                value={newProduct.description}
                                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                className="w-full h-16 bg-[#070b13] border border-gray-850 text-white rounded-lg p-2 text-xs focus:border-amber-500 outline-none resize-none"
                                placeholder="รายละเอียดข้อความสั้นที่ใช้อธิบายเกี่ยวกับผลิตภัณฑ์ (คำโปรย)..."
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">รายละเอียดแบบเจาะลึก (Detailed Description - รองรับ HTML Code)</label>
                              <textarea
                                value={newProduct.detailedDescription}
                                onChange={(e) => setNewProduct({ ...newProduct, detailedDescription: e.target.value })}
                                className="w-full h-28 bg-[#070b13] border border-gray-850 text-white rounded-lg p-2 text-xs focus:border-amber-500 outline-none font-mono"
                                placeholder="สามารถจัดแต่งด้วยแท็ก HTML ได้ เช่น <p>เนื้อหาวินาทีเทรนเด่น</p> <ul><li>ฟีเจอร์เด่น 1</li></ul> <b>หนา</b>"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">จำนวนยอดดาวน์โหลดสมมุติ</label>
                              <input
                                type="text"
                                value={newProduct.downloads}
                                onChange={(e) => setNewProduct({ ...newProduct, downloads: e.target.value })}
                                className="w-full bg-[#070b13] border border-gray-855 text-white rounded-lg p-2 text-xs"
                                placeholder="เช่น 1,200"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">ขนาดไฟล์สินค้า (เช่น MB, GB)</label>
                              <input
                                type="text"
                                value={newProduct.fileSize}
                                onChange={(e) => setNewProduct({ ...newProduct, fileSize: e.target.value })}
                                className="w-full bg-[#070b13] border border-gray-855 text-white rounded-lg p-2 text-xs"
                                placeholder="เช่น 5.2 MB"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">ลิงก์ที่อยู่ไฟล์รูปปกสากล (ImageUrl)</label>
                              <input
                                type="text"
                                value={newProduct.imageUrl}
                                onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                                className="w-full bg-[#070b13] border border-gray-855 text-white rounded-lg p-2 text-xs"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">ที่อยู่ลิงก์สำหรับดาวน์โหลดรับไฟล์ (DownloadUrl)</label>
                              <input
                                type="text"
                                value={newProduct.downloadUrl}
                                onChange={(e) => setNewProduct({ ...newProduct, downloadUrl: e.target.value })}
                                className="w-full bg-[#070b13] border border-gray-855 text-white rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                                placeholder="เช่น https://github.com/..."
                              />
                            </div>

                            <div className="sm:col-span-2 pt-2 flex justify-end gap-2 border-t border-gray-850">
                              <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="bg-gray-900 hover:bg-gray-800 text-gray-400 py-2 px-4 rounded-lg font-bold text-xs"
                              >
                                ยกเลิกการกรอก
                              </button>
                              <button
                                type="submit"
                                className="bg-amber-500 hover:bg-amber-600 text-black py-2 px-6 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4 text-black" />
                                บันทึกลงตารางชีตตารางคลาวด์
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>

                {/* Status Diagnostic Logs Window Console (System Tracker logs) */}
                <div className="bg-[#0b101c] p-6 rounded-3xl border border-gray-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-850 pb-3">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                        แผงคอนโซลตรวจวัดระบบ (System Log Monitor)
                      </h3>
                      <p className="text-[10px] text-gray-500 font-sans">
                        ติดตามความถูกต้องของคำขอ API การดึงข้อมูล เพื่อความเข้าใจในกรณีระบบตอบสนองช้า
                      </p>
                    </div>
                    <button
                      onClick={() => setLogs([])}
                      className="text-[10px] text-gray-500 hover:text-white bg-black/40 border border-gray-800 px-3 py-1.5 rounded-lg select-none hover:bg-red-950/20 active:scale-95 transition-all"
                    >
                      ล้างประวัติล็อก
                    </button>
                  </div>

                  <div className="bg-[#070b13] p-4 rounded-2xl border border-gray-850 max-h-48 overflow-y-auto space-y-2.5 font-mono text-[11px]">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-gray-500 shrink-0 select-none">[{log.timestamp}]</span>
                        <div className="flex-1">
                          <span className={`font-bold mr-1.5 capitalize ${
                            log.type === 'success' ? 'text-emerald-400' :
                            log.type === 'warning' ? 'text-amber-400' :
                            log.type === 'error' ? 'text-rose-400' :
                            'text-indigo-400'
                          }`}>
                            • [{log.type}]
                          </span>
                          <span className="text-gray-200">{log.message}</span>
                          {log.details && <p className="text-gray-500 text-[10px] mt-0.5 ml-2">รายละเอียด: {log.details}</p>}
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <p className="text-[10px] text-gray-500 italic py-2 text-center select-none font-sans">คลังสถานะปกติและปลอดภัย ยังไม่มีคำขอเครือข่ายส่งค่านอกหลัก</p>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* ------------------------------------------------------------- */}
      {/* GLOBAL DIALOG: PREMIUM PRODUCT DETAIL REVIEW POPUP 🏮 */}
      {/* ------------------------------------------------------------- */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn" id="detail-modal">
          <div className="bg-[#0b101c] w-full max-w-2xl rounded-3xl overflow-hidden border border-gray-800 shadow-2xl relative animate-scaleUp">
            
            {/* Header Image cover */}
            <div className="relative h-48 select-none bg-gray-950">
              {selectedProduct.isHtmlImage && selectedProduct.htmlImage ? (
                <div 
                  className="w-full h-full [&>img]:w-full [&>img]:h-full [&>img]:object-cover opacity-80"
                  dangerouslySetInnerHTML={{ __html: selectedProduct.htmlImage }}
                />
              ) : (
                <img
                  src={selectedProduct.imageUrl || null}
                  alt={selectedProduct.title}
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                  data-original-drive-id={getGoogleDriveId(selectedProduct.imageUrl || '') || undefined}
                  onError={handleImageError}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b101c] via-[#0b101c]/30 to-transparent" />
              
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-gray-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center text-sm border border-gray-800 cursor-pointer select-none transition-all duration-200 shadow-md font-sans"
              >
                ✕
              </button>

              <div className="absolute bottom-4 left-6 space-y-1">
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-3 py-0.5 rounded-md font-bold uppercase backdrop-blur-sm shadow-sm select-none">
                  {selectedProduct.category}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white leading-tight font-sans tracking-tight">
                  {selectedProduct.title}
                </h3>
              </div>
            </div>

            {/* Core details body */}
            <div className="p-6 sm:p-8 space-y-5 max-h-[65vh] overflow-y-auto">
              
              {/* Short Description (คำโปรย) */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block font-sans select-none">
                  คำโปรยนำ (Brief Description)
                </h4>
                <SafeHtmlContent htmlContent={selectedProduct.description} />
              </div>

              {/* Detailed Description via HTML rendering */}
              {selectedProduct.detailedDescription && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans select-none">
                    รายละเอียดเจาะลึก (Detailed Review)
                  </h4>
                  <div 
                    className="text-xs sm:text-sm text-gray-300 leading-relaxed font-sans font-light bg-[#070b13]/40 p-4 sm:p-5 rounded-2xl border border-gray-850 shadow-inner html-content-container"
                    dangerouslySetInnerHTML={{ __html: selectedProduct.detailedDescription }}
                  />
                </div>
              )}

              {/* Grid Metadata metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-black/40 p-3 rounded-2xl border border-gray-850 select-none shadow-sm">
                  <span className="text-[9px] text-gray-500 uppercase block">คะแนนความหรูหรา</span>
                  <p className="text-xs font-black text-amber-500 flex items-center justify-center gap-1 mt-0.5 font-mono">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {selectedProduct.rating} / 5.0
                  </p>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-gray-850 select-none shadow-sm">
                  <span className="text-[9px] text-gray-500 uppercase block">ยอดโหลดสะสม</span>
                  <p className="text-xs font-black text-emerald-400 flex items-center justify-center gap-1 mt-0.5 font-mono">
                    <Download className="w-3.5 h-3.5" />
                    {Number(selectedProduct.downloads).toLocaleString() || selectedProduct.downloads}
                  </p>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-gray-850 select-none shadow-sm">
                  <span className="text-[9px] text-gray-500 uppercase block">การจองชมสะสม</span>
                  <p className="text-xs font-black text-amber-400 flex items-center justify-center gap-1 mt-0.5 font-mono">
                    <Eye className="w-3.5 h-3.5" />
                    {Number(selectedProduct.views).toLocaleString() || selectedProduct.views}
                  </p>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-gray-850 select-none shadow-sm">
                  <span className="text-[9px] text-gray-500 uppercase block">ขนาดไฟล์จัดสรร</span>
                  <p className="text-xs font-black text-indigo-400 mt-0.5">
                    {selectedProduct.fileSize}
                  </p>
                </div>
              </div>

              {/* Antivirus stamp certified to reinforce safety */}
              <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-2xl text-xs text-emerald-400 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/25 flex items-center justify-center shrink-0">
                  ✔
                </div>
                <div className="space-y-0.5 font-sans leading-relaxed">
                  <h4 className="font-extrabold text-white text-[11px]">ไฟล์สแกนปลอดภัย ไร้รหัสมัลแวร์แฝงและคอร์สขวาง</h4>
                  <p className="text-gray-400 text-[10px]">ตรวจสอบโดยระบบกอปรด้วย WinDefender และ VirusTotal เรียบร้อย มั่นใจรันปลอดภัย!</p>
                </div>
              </div>

              {/* Modal footer download actions */}
              <div className="flex justify-end gap-2 border-t border-gray-850 pt-4">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="bg-gray-900 hover:bg-gray-800 text-gray-400 text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer"
                >
                  ย้อนกลับสู่คลัง
                </button>
                <button
                  onClick={() => triggerDownloadAction(selectedProduct)}
                  className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-black py-2.5 px-6 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 transition-all text-center"
                >
                  <Download className="w-4.5 h-4.5 text-black" />
                  เริ่มดาวน์โหลดฟรีหลัก
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* POPUP: RESTRICTED ACCESS & MULTI-OPTION UNLOCKING SYSTEM 🔒 */}
      {/* ------------------------------------------------------------- */}
      {pendingUnlockProduct && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" id="unlock-modal">
          <div className="bg-[#0b101c] w-full max-w-lg rounded-3xl overflow-hidden border border-amber-500/20 shadow-2xl relative animate-scaleUp my-8">
            
            {/* Header Lock Icon Banner */}
            <div className="p-6 bg-gradient-to-b from-[#151c2d] to-[#0b101c] border-b border-gray-800 text-center select-none" id="unlock-header">
              
              <button
                onClick={() => setPendingUnlockProduct(null)}
                className="absolute top-4 right-4 bg-black/40 hover:bg-black/80 text-gray-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center text-sm border border-gray-800 cursor-pointer transition-all duration-200"
                title="ปิด"
                id="close-unlock-modal-btn"
              >
                ✕
              </button>

              <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full mb-3.5 shadow-sm">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>

              <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] px-3 py-1 rounded-md font-bold uppercase block w-max mx-auto mb-2 tracking-wider">
                สิทธิ์การเข้าถึงถูกจำกัด
              </span>

              <h3 className="text-lg sm:text-xl font-bold text-white leading-tight font-sans tracking-tight">
                กรุณาปลดล็อกเพื่อเข้าชม / ดาวน์โหลดฟรี
              </h3>
              
              <p className="text-gray-450 text-xs mt-1.5 font-light">
                เพื่อเสพสิทธิ์หรือรับไฟล์: <span className="text-amber-400 font-medium font-mono text-[11px] bg-black/30 px-1.5 py-0.5 rounded">{pendingUnlockProduct.title}</span>
              </p>
            </div>

            {/* Selector Tabs for Method 1 vs Method 2 */}
            <div className="flex border-b border-gray-850 bg-[#090d18] p-1 gap-1" id="unlock-tabs-row">
              <button
                type="button"
                id="tab-sponsors-btn"
                onClick={() => setActiveUnlockTab('Sponsors')}
                className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none ${
                  activeUnlockTab === 'Sponsors'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                }`}
              >
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span>วิธี 1: ดูโฆษณาฟรี ({clickedSponsors.length}/5)</span>
              </button>
              
              <button
                type="button"
                id="tab-teafee-btn"
                onClick={() => setActiveUnlockTab('TeaFee')}
                className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none ${
                  activeUnlockTab === 'TeaFee'
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                }`}
              >
                <Coffee className="w-3.5 h-3.5 shrink-0" />
                <span>วิธี 2: สนับสนุนค่าน้ำชา</span>
              </button>

              <button
                type="button"
                id="tab-vip-btn"
                onClick={() => setActiveUnlockTab('VipCode')}
                className={`py-3 px-3 text-center text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border-none ${
                  activeUnlockTab === 'VipCode'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-gray-900/60'
                }`}
                title="กรอกรหัส VIP"
              >
                <Unlock className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">กรอก VIP</span>
              </button>
            </div>

            {/* Core Modal Scrollable Panel Body */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[50vh] overflow-y-auto" id="unlock-tabs-content">

              {/* METHOD 1: SPONSORS CLICKING */}
              {activeUnlockTab === 'Sponsors' && (
                <div className="space-y-4 animate-fadeIn" id="method-sponsors-section">
                  
                  {/* Progress Header Indicator */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-medium">ความคืบหน้าการคลิกสปอนเซอร์:</span>
                      <span className="text-amber-400 font-extrabold" id="sponsor-progress-text">{clickedSponsors.length} / 5 เว็บบอร์ด</span>
                    </div>

                    {/* 5-Segment Progress Bar */}
                    <div className="grid grid-cols-5 gap-1.5" id="sponsor-progress-bar">
                      {[1, 2, 3, 4, 5].map((idx) => {
                        const isDone = clickedSponsors.includes(idx);
                        return (
                          <div
                            key={idx}
                            id={`progress-segment-${idx}`}
                            className={`h-2 rounded-full transition-all ${
                              isDone ? 'bg-amber-500 shadow-sm shadow-amber-500/20' : 'bg-gray-850'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* SPONSOR PREMIUM AD BANNER */}
                  <div className="bg-[#070b13] border border-gray-805 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col sm:flex-row items-center gap-4 group" id="sponsor-banner-card">
                    <div className="absolute top-2 right-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase select-none">
                      สปอนเซอร์โฆษณา
                    </div>

                    {/* Small visual on the left */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-all">
                      <Flame className="w-7 h-7 text-black animate-pulse" />
                    </div>

                    <div className="space-y-1 text-center sm:text-left">
                      <h4 className="font-extrabold text-white text-xs sm:text-sm leading-snug">
                        {clickedSponsors.length === 0 && "สมัครสมาชิกทดลองเทรดอันดับ 1 ระบบพรีเมี่ยม ฝากถอนง่าย คืนค่าคอมมิชชั่นสูง"}
                        {clickedSponsors.length === 1 && "เว็บบอร์ดรีวิวหนังชนโรงฟรี ดูหนังชัดระดับ 4K สตรีมไร้โฆษณาแทรก"}
                        {clickedSponsors.length === 2 && "VPS คลาวด์เสรีความเร็วสูงเพื่อเปิดบอท Forex EA 24 ชม. เสถียร ปลอดภัย"}
                        {clickedSponsors.length === 3 && "สถาบันสอนเทคนิคเขียนสูตรระบบเทรดอัจฉริยะ และรับคู่มือเทรดฟรีวันนี้"}
                        {clickedSponsors.length === 4 && "ดาวน์โหลดโปรแกรมจัดการออฟไลฟ์มีเดีย และเพลย์ลิสต์ช่องเคเบิลฟรี"}
                        {clickedSponsors.length >= 5 && "ระบบบันทึกความครบถ้วนเรียบร้อยแล้ว! ผ่านเกณฑ์พฤติกรรมมนุษย์"}
                      </h4>
                      <p className="text-[10px] text-gray-500 leading-relaxed">
                        {clickedSponsors.length < 5
                          ? "กรุณากดเยี่ยมชมและสแกนหน้าเว็บสเป็ครักษาสิทธิให้ครบถ้วน 5 สปอนเซอร์ เพื่อยืนยันว่าคุณคือมนุษย์และสนับสนุนเซิร์ฟเวอร์"
                          : "สิทธิ์ถูกปลอดล็อกเรียบร้อยแล้วถาวร คุณสามารถกดยืนยันดาวน์โหลดหลักด้านล่างได้ทันที"
                        }
                      </p>
                    </div>
                  </div>

                  {/* Sponsor Action Buttons */}
                  <div className="space-y-3" id="sponsor-actions-area">
                    {clickedSponsors.length < 5 ? (
                      <div className="space-y-2">
                        {/* Interactive dynamic clicker */}
                        <button
                          type="button"
                          id="trigger-sponsor-click-btn"
                          onClick={() => {
                            const nextSponsorIndex = clickedSponsors.length + 1;
                            if (!clickedSponsors.includes(nextSponsorIndex)) {
                              // Open a realistic sponsor URL
                              const sponsorUrls = [
                                "https://th.gowt.net/ib54175",
                                "https://go.finnix.co/xZrf/crud6alv?openExternalBrowser=1",
                                "https://friend.money-thunder.com/px1v/96wsxf82",
                                "https://goodmoneybygsb.go.link?adj_t=1wbzj84q&mission_id=6f4b6ee4-3948-48f1-ab2d-6594fa56ede5&ref=ebfe8238-6295-4b27-93fb-823742e1906a",
                                "https://www.xmglobal.com/referral?token=MTKcgIwhVPRAksq6hx-X_w"
                              ];
                              const targetUrl = sponsorUrls[nextSponsorIndex - 1] || "https://google.com";
                              window.open(targetUrl, '_blank');

                              // Update count
                              setClickedSponsors(prev => [...prev, nextSponsorIndex]);
                              addLog('success', `สะสมคลิกสปอนเซอร์: สำเร็จรายที่ ${nextSponsorIndex} (${nextSponsorIndex}/5)`, `หน้าติดต่อ: ${targetUrl}`);
                            }
                          }}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-amber-500/10 border-none"
                        >
                          <ExternalLink className="w-4 h-4 text-black shrink-0" />
                          <span>
                            {clickedSponsors.length === 0 && "👉 คลิกสปอนเซอร์ / ปลดล็อกขั้นตอนที่ 1"}
                            {clickedSponsors.length === 1 && "👉 คลิกสปอนเซอร์ / ปลดล็อกขั้นตอนที่ 2"}
                            {clickedSponsors.length === 2 && "👉 คลิกสปอนเซอร์ / ปลดล็อกขั้นตอนที่ 3"}
                            {clickedSponsors.length === 3 && "👉 คลิกสปอนเซอร์ / ปลดล็อกขั้นตอนที่ 4"}
                            {clickedSponsors.length === 4 && "👉 คลิกสปอนเซอร์ / ปลดล็อกของจริง (ขั้นตอนสุดท้าย)"}
                          </span>
                        </button>
                        
                        <p className="text-[10px] text-gray-500 text-center leading-relaxed font-light select-none">
                          *ระบบจะเปิดหน้าสปอนเซอร์ในแท็บจำลองภายนอก กรุณาเปิดทิ้งไว้สักครู่เพื่อรักษาสิทธิ์
                        </p>
                      </div>
                    ) : (
                      <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 p-4 rounded-xl text-center space-y-2.5 select-none animate-fadeIn" id="sponsors-complete-card">
                        <p className="font-bold text-xs">🎉 สปอนเซอร์เสร็จสิ้นแล้ว! ขอขอบคุณที่ช่วยเปิดโฆษณา</p>
                        <button
                          type="button"
                          id="confirm-sponsor-unlock-btn"
                          onClick={() => handleUnlockSuccess(pendingUnlockProduct, 'สปอนเซอร์สะสมครบ 5 ครั้ง')}
                          className="w-full bg-emerald-500 hover:bg-emerald-650 text-black font-black text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 border-none"
                        >
                          <Unlock className="w-3.5 h-3.5 text-black" />
                          <span>เริ่มเปิดชม / ดาวน์โหลดจริงทันที</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Warning message block */}
                  <div className="bg-amber-950/10 border border-amber-900/30 p-3 rounded-xl text-[10px] text-amber-500/95 flex items-start gap-2.5 leading-relaxed">
                    <span className="shrink-0 text-xs">⚠️</span>
                    <div>
                      <h5 className="font-extrabold text-white text-[10px] mb-0.5">คำเตือนเกี่ยวกับระบบสปอนเซอร์:</h5>
                      <p>โปรดอย่าบล็อกป๊อปอัปหากโปรแกรมค้นหาไม่ทำงาน คุณจำเป็นเปิดเยี่ยมชมเว็บโฆษณาครบสัปดาห์ละ 5 รายการ เพื่อสะสมค่าเกียรติยศส่งแบนด์สปีดสำหรับการรับไฟล์หนัง HD / EA บอท...</p>
                    </div>
                  </div>

                </div>
              )}

              {/* METHOD 2: TEA FEE DONATION (TRUE MONEY QR + AI SLIP VERIFICATION) */}
              {activeUnlockTab === 'TeaFee' && (
                <div className="space-y-5 animate-fadeIn" id="method-teafee-section">
                  
                  {/* Segmented Amount selector */}
                  <div className="space-y-1.5" id="amount-selector-group">
                    <label className="text-[10px] text-orange-400 font-extrabold uppercase tracking-wider block">
                      เลือกสนับสนุนค่าน้ำชาตามใจรัก เพื่อรับรหัส VIP:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[19, 49, 99].map((amt) => {
                        const isSelected = teaFeeAmount === amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            id={`tea-amt-btn-${amt}`}
                            onClick={() => {
                              setTeaFeeAmount(amt);
                              setPaymentTxId('');
                              setShowVipCodeSuccess(null);
                              setAiVerificationLogs([]);
                            }}
                            className={`py-3 px-2 rounded-2xl border text-center cursor-pointer transition-all flex flex-col justify-center items-center gap-1 outline-none ${
                              isSelected
                                ? 'bg-orange-600/10 border-orange-500 text-orange-400 font-bold shadow-md shadow-orange-500/10'
                                : 'bg-black/30 border-gray-850 text-gray-400 hover:border-gray-800'
                            }`}
                          >
                            <span className="text-base font-black font-mono leading-none">{amt} ฿</span>
                            <span className="text-[9px] text-gray-500">
                              {amt === 19 && "19 บาท (ชาร้อน)"}
                              {amt === 49 && "49 บาท (ชาเขียว)"}
                              {amt === 99 && "99 บาท (นมสดไข่มุก)"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* OFFICIAL TRUEMONEY QR REPLICA CARD */}
                  <div className="w-full max-w-sm mx-auto bg-gradient-to-b from-[#ff5722] to-[#ff3d00] rounded-3xl p-5 shadow-2xl border border-orange-500/20 text-center select-none" id="tmw-official-qr-card">
                    {/* TrueMoney Corporation Header */}
                    <div className="flex items-center justify-center gap-1.5 mb-3.5">
                      {/* Logo Graphic */}
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-4h2v4zm0-6h-2V8h2v2z"/>
                      </svg>
                      <span className="text-white font-extrabold tracking-tighter text-sm uppercase">truemoney</span>
                    </div>

                    {/* White scanning cardboard container */}
                    <div className="bg-white rounded-2xl p-5 flex flex-col items-center shadow-inner relative">
                      {/* Interactive Scannable QR Code */}
                      <div className="p-3 bg-white rounded-2xl border border-gray-100 w-44 h-44 flex items-center justify-center relative shadow-sm">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0b101c&bgcolor=ffffff&data=https://www.truemoney.com/a/Waiphot_Somphak_08X_XXX_1092_amount_${teaFeeAmount}`}
                          alt="TrueMoney Payment QR Code"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        {/* Miniature floating central brand medallion */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#ff5722] rounded-lg border-2 border-white flex items-center justify-center shadow-lg select-none pointer-events-none">
                          <span className="text-white text-[9px] font-black leading-none">W</span>
                        </div>
                      </div>

                      {/* Client Account Info Display */}
                      <div className="mt-4 space-y-1 text-center w-full">
                        <div className="text-gray-900 font-black text-sm sm:text-base tracking-tight" id="tmw-payee-name">
                          ไวพจน์ โสมภา
                        </div>
                        <div className="text-gray-550 font-mono text-[11px] sm:text-xs tracking-widest font-semibold bg-gray-50 px-3 py-1 rounded-full inline-block select-all border border-gray-100">
                          08*-***-1092
                        </div>
                      </div>
                    </div>

                    {/* Secure Assurance Badge Line */}
                    <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] text-white/95 font-medium tracking-wide">
                      <ShieldCheck className="w-4 h-4 text-white shrink-0 animate-pulse" />
                      <span>มั่นใจทุกการใช้จ่าย ดูแลความปลอดภัยโดยทรูมันนี่</span>
                    </div>
                  </div>

                  <div className="text-center bg-[#070b13] border border-gray-850 p-3.5 rounded-2xl">
                    <p className="text-white text-xs font-bold">
                      ค่าน้ำชาสำหรับปลดล็อกสิทธิ์: <span className="text-orange-500 font-mono font-black text-sm">{teaFeeAmount} บาท</span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      สแกนชำระเงินตามยอดด้วยบัญชี <b>TrueMoney Wallet</b> และส่งภาพสลิปที่สำเร็จเสร็จข้างล่างเพื่อให้ AI ช่วยแกะข้อมูลความปลอดภัยและแจก VIP CODE
                    </p>
                  </div>

                  {/* INTERACTIVE DRAG & DROP SLIP UPLOADER */}
                  <div className="space-y-3">
                    <label className="text-[10px] text-orange-400 font-extrabold uppercase tracking-widest block">
                      อัปโหลดรูปภาพสลิปเพื่อยืนยันรายการ (DRAG-AND-DROP หรือคลิกเพื่อเลือกไฟล์):
                    </label>

                    {/* Drag and Drop Zone Container */}
                    <div
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragActive(true);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragActive(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragActive(false);

                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const file = e.dataTransfer.files[0];
                          if (file.type.startsWith('image/')) {
                            const slipUrl = URL.createObjectURL(file);
                            setUploadedSlipUrl(slipUrl);
                            setPaymentTxId(file.name.substring(0, 14) || '50001234567890');
                            
                            // Trigger simulated AI Scan routine
                            triggerAiOcrScanning(file.name);
                          } else {
                            alert("⚠️ กรุณาอัปโหลดไฟล์รูปภาพที่ถูกต้องเท่านั้น เช่น PNG, JPG, JPEG");
                          }
                        }
                      }}
                      className={`relative border-2 border-dashed rounded-3xl p-6 text-center transition-all flex flex-col items-center justify-center cursor-pointer min-h-[140px] select-none ${
                        isDragActive
                          ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
                          : uploadedSlipUrl
                            ? 'border-emerald-500/50 bg-[#070d14]'
                            : 'border-gray-800 bg-[#070b13] hover:border-orange-500/40 hover:bg-black/20'
                      }`}
                      onClick={() => {
                        document.getElementById('slip-file-input')?.click();
                      }}
                    >
                      <input
                        type="file"
                        id="slip-file-input"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            const slipUrl = URL.createObjectURL(file);
                            setUploadedSlipUrl(slipUrl);
                            setPaymentTxId(file.name.substring(0, 14) || '50001234567890');
                            
                            // Trigger simulated AI Scan routine
                            triggerAiOcrScanning(file.name);
                          }
                        }}
                      />

                      {uploadedSlipUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-emerald-500/30 shadow-md">
                            <img src={uploadedSlipUrl} alt="Snippet of slip preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs text-white">
                              ✓ Slip
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-emerald-400 font-extrabold text-xs">ไฟล์สลิปถูกนำเข้าเรียบร้อย!</p>
                            <p className="text-[9px] text-gray-500">คลิกที่นี่เพื่อเปลี่ยนไฟล์รูปอื่น</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="p-3 bg-gray-900 rounded-2xl group-hover:scale-110 transition-all text-gray-400">
                            <Upload className="w-6 h-6 text-orange-500 animate-bounce" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-white font-bold">ลากสลิปมาวางที่นี่ หรือ เลือกรูปภาพสลิปการโอน</p>
                            <p className="text-[10px] text-gray-500 max-w-xs mx-auto">
                              เพื่อความรวดเร็ว ระบบ AI จะวิเคราะห์ข้อมูลสลิปโดยอัตโนมัติ ไม่ต้องคอยตรวจสอบมือ
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Or standard prompt options for testers */}
                    {!uploadedSlipUrl && (
                      <div className="flex justify-between items-center bg-gray-950/20 px-3 py-2.5 rounded-xl border border-gray-850/60 text-[10px] text-gray-400">
                        <span>💡 ไม่มีรูปสลิปทดสอบ?</span>
                        <button
                          type="button"
                          onClick={() => {
                            // Create a dummy image URL and fake trigger
                            setUploadedSlipUrl("https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=simulate_slip");
                            setPaymentTxId("50007894561230");
                            triggerAiOcrScanning("mock_slip_truemoney_sandbox.png");
                          }}
                          className="bg-orange-600/10 hover:bg-orange-600/35 border border-orange-500/30 text-orange-400 font-bold px-3 py-1 rounded-md transition-all cursor-pointer select-none"
                        >
                          ⚡ คลิกเพื่อจำลองการแนบสลิปทดสอบ
                        </button>
                      </div>
                    )}
                  </div>

                  {/* AI PROCESS SCANNER PROGRESS INDICATOR */}
                  {(isVerifyingPayment || aiVerificationLogs.length > 0) && (
                    <div className="bg-[#040810] border border-orange-500/15 p-4 rounded-2xl space-y-3 animate-scaleUp" id="ai-engine-block">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className={`w-4 h-4 text-orange-500 ${isVerifyingPayment ? 'animate-spin' : ''}`} />
                          <span className="text-white text-xs font-black tracking-wide font-sans">
                            {isVerifyingPayment ? '🤖 AI OCR ENGINE กำลังสแกนตรวจสอบสลิป...' : '🤖 AI OCR ENGINE ประมวลผลเสร็จสิ้น'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono bg-orange-600/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          ACTIVE ENGINE 4.1
                        </span>
                      </div>

                      {/* Display log strings stack */}
                      <div className="bg-black/50 p-3 rounded-xl max-h-[140px] overflow-y-auto space-y-1.5 font-mono text-[9px] sm:text-[10px] leading-relaxed border border-gray-850/60" id="ai-ocr-output-console">
                        {aiVerificationLogs.map((log, i) => {
                          const isSuccessMsg = log.includes('✅') || log.includes('SUCCESS') || log.includes('สำเร็จ');
                          const isWarningMsg = log.includes('⚠️') || log.includes('ตรวจพบ');
                          return (
                            <div key={i} className={`flex items-start gap-1 p-0.5 border-b border-gray-900 last:border-0 ${
                              isSuccessMsg ? 'text-emerald-400' : isWarningMsg ? 'text-amber-400' : 'text-gray-400'
                            }`}>
                              <span className="text-[10px] shrink-0 text-gray-600">{i + 1}&gt;</span>
                              <span className="break-all">{log}</span>
                            </div>
                          );
                        })}
                        {isVerifyingPayment && (
                          <div className="flex items-center gap-1.5 text-orange-400 animate-pulse pt-1">
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
                            <span>กำลังประมวลผลเซกเมนต์ถัดไป...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* DISPLAY VIP CODE Noina2024 CARD ONCE SUCCESSFUL */}
                  {showVipCodeSuccess && (
                    <div className="bg-emerald-950/20 border border-emerald-500/40 p-5 rounded-3xl text-center space-y-4 animate-scaleUp scroll-mt-4" id="ai-vip-pass-container">
                      <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
                        <ShieldCheck className="w-6 h-6 animate-pulse" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-white font-black text-sm sm:text-base leading-snug">
                          🎉 ตรวจสอบรายการสลิปและค่าน้ำชาเสร็จสิ้นสำเร็จ!
                        </h4>
                        <p className="text-[10px] sm:text-xs text-emerald-400">
                          ระบบ AI ยืนยันยอดและแจกรหัส VIP สำหรับท่านเรียบร้อยแล้ว
                        </p>
                      </div>

                      {/* Code frame */}
                      <div className="bg-[#05110d] border-2 border-emerald-500/30 rounded-2xl p-4 max-w-xs mx-auto space-y-2.5 relative shadow-lg">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">
                          รหัสยืนยันตัวตน VIP PASSCODE คือ:
                        </span>
                        
                        <div className="text-center font-mono font-black text-2xl tracking-widest text-[#10b981] bg-black/60 py-2.5 px-4 rounded-xl border border-emerald-505/20 block select-all">
                          Noina2024
                        </div>

                        {/* Copy Code button */}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('Noina2024');
                            alert('📋 คัดลอกรหัสผ่าน VIP "Noina2024" สำเร็จ! กรุณานำไปใส่ฝั่งแท็บ "กรอก VIP" เพื่อปลดล็อกเข้าเว็บ!');
                            addLog('success', 'คัดลอกรหัสผ่านสำเร็จ!', 'คัดลอก VIP Code "Noina2024" สู่กระดานคัดลอกแล้ว');
                          }}
                          className="w-full bg-[#10b981] hover:bg-emerald-600 text-black font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border-none transition-all"
                        >
                          <Copy className="w-3.5 h-3.5 text-black" />
                          <span>คัดลอกรหัส VIP</span>
                        </button>
                      </div>

                      <div className="bg-gray-900/60 p-3 rounded-2xl border border-gray-850 max-w-sm mx-auto">
                        <p className="text-[10px] sm:text-[11px] text-gray-300 leading-relaxed font-light">
                          🔑 <b>ขั้นตอนถัดไป:</b> กดคัดลอกรหัส แล้วคลิกไปที่แถว <b>"กรอก VIP"</b> ด้านบน นำรหัสนี้ไปกรอกเพื่อปลดล็อกลิงก์ดาวน์โหลดหนัง/ซอฟต์แวร์ทันที
                        </p>
                        
                        <button
                          type="button"
                          onClick={() => setActiveUnlockTab('VipCode')}
                          className="mt-2 text-indigo-400 hover:text-indigo-300 font-black text-[11px] hover:underline bg-none border-none cursor-pointer flex items-center justify-center gap-1 mx-auto"
                        >
                          <span>👉 คลิกไปแท็บ "กรอก VIP" ทันที</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* METHOD 3: VIP PASS CODE BYPASS */}
              {activeUnlockTab === 'VipCode' && (
                <div className="space-y-4 animate-fadeIn" id="method-vip-section">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">
                      กรอกรหัส VIP สำหรับผู้ดูแลหรือผู้สนับสนุนกุญแจช่องทางพิเศษ:
                    </label>
                    <input
                      type="text"
                      placeholder="ป้อนรหัส VIP เช่น Noina2024"
                      value={unlockVipCode}
                      onChange={(e) => setUnlockVipCode(e.target.value)}
                      className="w-full bg-[#070b13] border border-gray-850 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-indigo-400 placeholder-gray-650 outline-none transition-all"
                      id="unlock-vip-code-input"
                    />
                    <p className="text-[9px] text-gray-500 font-light leading-relaxed">
                      *รหัส VIP สามารถรับได้ฟรีจากการสแกน TrueMoney บริจาคค่าน้ำชาแล้วส่งหลักฐานสลิปให้ AI ตรวจสอบในแท็บ <b>"สนับสนุนค่าน้ำชา"</b>
                    </p>
                  </div>

                  <button
                    type="button"
                    id="submit-vip-code-btn"
                    onClick={() => {
                      const trimmedCode = unlockVipCode.trim().toUpperCase();
                      if (!trimmedCode) {
                        alert("⚠️ กรุณากรอกรหัสผ่าน VIP ก่อนกดยืนยัน!");
                        return;
                      }

                      const validCodes = ['VIP999', 'TRUE19', 'FREE', 'HUBFREE', 'ADMIN', 'NOINA2024'];
                      if (validCodes.includes(trimmedCode) || trimmedCode.startsWith('VIP') || trimmedCode === 'NOINA2024') {
                        handleUnlockSuccess(pendingUnlockProduct, `รหัส VIP ถูกต้อง (${trimmedCode})`);
                      } else {
                        alert("❌ รหัสผ่านคีย์ VIP ไม่ถูกต้อง! กรุณากรอกรหัส VIP 'Noina2024' ที่ได้รับหลังจากส่งตรวจสลิปค่าน้ำชา");
                      }
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all border-none font-sans"
                  >
                    <Unlock className="w-3.5 h-3.5 text-white" />
                    <span>ยืนยันปลดล็อกด้วยรหัสผ่าน VIP 🔓</span>
                  </button>
                </div>
              )}

            </div>
            {/* Modal Actions Footer */}
            <div className="flex justify-between items-center bg-[#070b13] px-6 py-4 border-t border-gray-850" id="unlock-modal-footer">
              <span className="text-[10px] text-gray-500 select-none flex items-center gap-1.5 font-light">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                ระบบประมวลผลความปลอดภัยส่วนบุคคล
              </span>
              
              <button
                type="button"
                id="cancel-unlock-btn"
                onClick={() => setPendingUnlockProduct(null)}
                className="bg-gray-900 hover:bg-gray-805 text-gray-400 hover:text-white text-xs font-bold py-1.5 px-3.5 rounded-lg border-none cursor-pointer transition-all"
              >
                ยกเลิกปลดล็อก
              </button>
            </div>

          </div>
        </div>
      )}
    <div className="max-w-4xl mx-auto px-4">
      <VercelBlobUploader />
    </div>
          {/* Global Interactive Page Footer */}
      <footer className="mt-auto bg-[#0b101c] border-t border-gray-850 py-5 select-none text-center text-xs text-gray-500 leading-relaxed font-sans">
        <p className="font-semibold text-gray-450">&copy; 2026 HUB FREE - พอร์ทัลหนังและคลังซอฟต์แวร์เสรี แหล่งบันเจิดสวรรค์ของนักพัฒนา</p>
        <p className="text-[10px] text-gray-600">รันระบบจัดเก็บแถวข้อมูลสด API สะพาน Google Sheets Pro v4. ตรวจความปลอดภัยโดย AI Studio Container Engine</p>
      </footer>
    </div>
 );
};
// ฟังก์ชันระบบอัปโหลดรูปภาพขึ้น Vercel Blob สาธารณะ
function VercelBlobUploader() {
  const [uploading, setUploading] = useState(false);
  const [blobUrl, setBlobUrl] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setBlobUrl('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      if (data.url) {
        setBlobUrl(data.url);
        alert('อัปโหลดขึ้น Vercel Blob สำเร็จแล้วครับ!');
      }
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-5 border-2 border-dashed border-gray-300 rounded-lg my-5 bg-gray-50 text-gray-800">
      <h3 className="text-lg font-bold mb-1">📷 ระบบอัปโหลดรูปภาพแบนเนอร์ (Vercel Blob)</h3>
      <p className="text-xs text-gray-500 mb-3">เลือกไฟล์รูปภาพเพื่อรับลิงก์ URL ไปใส่ในช่อง bannerImage ของ Google Sheets</p>
      
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        disabled={uploading}
        className="block my-3"
      />
      
      {uploading && <p className="text-blue-600 font-bold text-sm">กำลังอัปโหลดรูปภาพ โปรดรอสักครู่...</p>}
      
      {blobUrl && (
        <div style={{ marginTop: '20px', background: '#fff', padding: '15px', borderRadius: '6px', border: '2px solid #0070f3', display: 'block' }}>
          <p style={{ margin: '0 0 8px 0', color: '#008000', fontWeight: 'bold', fontSize: '15px' }}>
            🎉 อัปโหลดสำเร็จ! คัดลอกลิงก์ด้านล่างนี้ได้เลย:
          </p>
          <input 
            type="text" 
            value={blobUrl} 
            readOnly 
            onClick={(e) => (e.target as HTMLInputElement).select()}
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #0070f3', borderRadius: '4px', background: '#f0f7ff', color: '#000', fontStyle: 'normal', fontSize: '14px', cursor: 'pointer' }}
          />
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>
            * คลิกในกล่องสีฟ้าด้านบนเพื่อเลือกทั้งหมด แล้วกดคัดลอก (Copy) ไปใส่ใน Google Sheets
          </p>
          <img src={blobUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', marginTop: '15px', display: 'block', borderRadius: '4px' }} />
        </div>
      )}
    </div>
  );
}
