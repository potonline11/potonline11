import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Support VITE_ environment variables for deployments like Vercel, falling back to the JSON file
const getInitialFirebaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  try {
    const saved = localStorage.getItem('custom_firebase_config') || metaEnv.VITE_DEFAULT_FIREBASE_CONFIG;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.authDomain) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading custom firebase config:', e);
  }

  return {
    apiKey: (metaEnv.VITE_FIREBASE_API_KEY as string) || firebaseConfigJson.apiKey,
    authDomain: (metaEnv.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseConfigJson.authDomain,
    projectId: (metaEnv.VITE_FIREBASE_PROJECT_ID as string) || firebaseConfigJson.projectId,
    storageBucket: (metaEnv.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseConfigJson.storageBucket,
    messagingSenderId: (metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseConfigJson.messagingSenderId,
    appId: (metaEnv.VITE_FIREBASE_APP_ID as string) || firebaseConfigJson.appId,
    measurementId: (metaEnv.VITE_FIREBASE_MEASUREMENT_ID as string) || firebaseConfigJson.measurementId || "",
  };
};

export const firebaseConfig = getInitialFirebaseConfig();

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use Google Auth Provider with appropriate Google Workspace scopes
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

// Keep the token cached in memory to avoid exposing it to localStorage
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Register callbacks for authentication changes
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (errorMsg?: string) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Token was cleared or wasn't loaded via popup.
        // We will need to re-authenticate or clear.
        if (onAuthFailure) onAuthFailure("Token expired or unavailable. Please authenticate.");
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Start Google sign-in flow
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential || !credential.accessToken) {
      throw new Error('Failed to retrieve Google Access Token. Please verify authorization.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    // Enhance explanation if it's a known iframe popup blocked issue
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup ถูกบล็อกโดยเบราว์เซอร์ของคุณ กรุณาเปิดใช้งานป๊อปอัปสำหรับโดเมนนี้ หรือคลิกเปิดในแท็บใหม่ที่มุมขวาบนของหน้าจอ');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('หน้าต่างล็อกอินถูกปิดก่อนการทำรายการสำเร็จ กรุณาลองใหม่อีกครั้ง');
    } else if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('คำขอโหลดป๊อปอัปถูกปฏิเสธเนื่องจากมีรายการค้างอยู่ก่อนหน้านี้');
    } else if (error.code === 'auth/unauthorized-domain') {
      const currentDomain = window.location.hostname;
      throw new Error(`โดเมนนี้ [ ${currentDomain} ] ยังไม่ได้รับการยืนยันสิทธิ์ใน Firebase Console!\n\nกรุณาทำตามวิธีนี้เพื่ออนุญาต:\n1. เข้าเว็บบอร์ด Firebase Console\n2. ไปที่โครงการ "${firebaseConfig.projectId}" ของคุณ\n3. ไปที่เมนู Authentication -> แท็บ Settings (การตั้งค่า) -> หัวข้อ Authorized Domains (โดเมนที่ได้รับอนุญาต)\n4. กดปุ่ม "Add Domain" แล้วพิมพ์ใส่ชื่อโดเมนหลักนี้: ${currentDomain}`);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve token from cache
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Re-inject token if retrieved manually or set from other flow
export const setCachedToken = (token: string) => {
  cachedAccessToken = token;
};

// Logout
export const logoutUser = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Login with direct access token using Google UserInfo API
export const loginWithDirectAccessToken = async (token: string): Promise<User | null> => {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Google Access Token ใช้งานไม่ได้หรือหมดอายุแล้ว (${res.status})`);
    }
    const data = await res.json();
    
    // Construct a User-like object that fits our app's needs
    const mockUser: any = {
      uid: data.sub || 'direct-token-user',
      email: data.email,
      displayName: data.name || 'Google User',
      photoURL: data.picture,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      phoneNumber: null,
      emailVerified: data.email_verified || false,
    };
    
    cachedAccessToken = token;
    // Save to localStorage so they don't have to keep pasting it across page reloads!
    localStorage.setItem('direct_google_access_token', token);
    localStorage.setItem('direct_google_user', JSON.stringify(mockUser));
    
    return mockUser;
  } catch (error: any) {
    console.error('loginWithDirectAccessToken error:', error);
    throw error;
  }
};

/* ==========================================
   Google Workspace APIs (Drive & Sheets)
   ========================================== */

/**
 * Fetch list of spreadsheet files from User's Google Drive.
 */
export async function fetchUserSpreadsheets(accessToken: string) {
  const appsScriptUrl = localStorage.getItem('custom_apps_script_url');
  if (appsScriptUrl) {
    return []; // Return empty so they select sheets by direct ID or link
  }

  try {
    const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=50`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google Drive API error (${res.status})`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error: any) {
    console.error('fetchUserSpreadsheets error:', error);
    throw error;
  }
}

/**
 * Fetch spreadsheet structure (sheets/worksheets names)
 */
export async function fetchSpreadsheetMetadata(spreadsheetId: string, accessToken: string) {
  if (spreadsheetId === 'hubfree-products-database') {
    return {
      title: 'ฐานข้อมูลจำลอง (Sandbox)',
      sheets: [
        { title: 'All Products', index: 0 },
        { title: 'Donation Logs', index: 1 }
      ]
    };
  }
  const appsScriptUrl = localStorage.getItem('custom_apps_script_url');
  if (appsScriptUrl) {
    try {
      const res = await fetch(`${appsScriptUrl}?action=getMetadata&spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
      if (!res.ok) throw new Error(`Google Apps Script returned status ${res.status}`);
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      return { title: data.title, sheets: data.sheets };
    } catch (err: any) {
      console.error('Apps Script fetchSpreadsheetMetadata error:', err);
      throw new Error(`การเชื่อมต่อผ่าน Apps Script ล้มเหลว: ${err.message || String(err)}`);
    }
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google Sheets API error (${res.status})`);
    }

    const data = await res.json();
    const title = data.properties?.title || 'Unnamed Spreadsheet';
    const sheets = (data.sheets || []).map((s: any) => ({
      title: s.properties?.title || 'Sheet1',
      index: s.properties?.index || 0,
    }));

    return { title, sheets };
  } catch (error: any) {
    console.error('fetchSpreadsheetMetadata error:', error);
    throw error;
  }
}

/**
 * Fetch cell values of a specific range in spreadsheet
 */
export async function fetchWorksheetValues(spreadsheetId: string, sheetTitle: string, accessToken: string) {
  if (spreadsheetId === 'hubfree-products-database') {
    return [];
  }
  const appsScriptUrl = localStorage.getItem('custom_apps_script_url');
  if (appsScriptUrl) {
    try {
      const res = await fetch(`${appsScriptUrl}?action=read&spreadsheetId=${encodeURIComponent(spreadsheetId)}&sheetTitle=${encodeURIComponent(sheetTitle)}`);
      if (!res.ok) throw new Error(`Google Apps Script returned status ${res.status}`);
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      return data.values || [];
    } catch (err: any) {
      console.error('Apps Script fetchWorksheetValues error:', err);
      throw new Error(`การดึงข้อมูลตารางผ่าน Apps Script ล้มเหลว: ${err.message || String(err)}`);
    }
  }

  try {
    // We request the entire sheet values by referencing just the title (it returns everything)
    const range = `${sheetTitle}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google Sheets API error (${res.status})`);
    }

    const data = await res.json();
    return data.values || [];
  } catch (error: any) {
    console.error('fetchWorksheetValues error:', error);
    throw error;
  }
}

/**
 * Update cell value on a spreadsheet
 */
export async function updateCellInSpreadsheet(
  spreadsheetId: string,
  sheetTitle: string,
  rowIdx: number, // 0-indexed data-grid index (row 0 is typically visual, but we offset carefully)
  colIdx: number, // 0-indexed column index
  value: string,
  accessToken: string
) {
  if (spreadsheetId === 'hubfree-products-database') {
    return { status: 'success' };
  }
  const appsScriptUrl = localStorage.getItem('custom_apps_script_url');
  if (appsScriptUrl) {
    try {
      const payload = {
        action: 'update',
        spreadsheetId,
        sheetTitle,
        rowIdx,
        colIdx,
        value
      };
      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      return data;
    } catch (err: any) {
      console.error('Apps Script updateCellInSpreadsheet error:', err);
      throw new Error(`อัปเดตเซลล์ผ่าน Apps Script ล้มเหลว: ${err.message || String(err)}`);
    }
  }

  try {
    // Translate colIdx 0 -> 'A', 1 -> 'B', etc.
    const colLetter = getColumnLetter(colIdx);
    // Google sheets are 1-based, so rowIdx 0 corresponds to A1 (or A2 if headers are at 1)
    const cellRef = `${sheetTitle}!${colLetter}${rowIdx + 1}`;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(cellRef)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[value]],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google Sheets API Update error (${res.status})`);
    }

    return await res.json();
  } catch (error: any) {
    console.error('updateCellInSpreadsheet error:', error);
    throw error;
  }
}

/**
 * Append row values to sheet
 */
export async function appendRowToSpreadsheet(
  spreadsheetId: string,
  sheetTitle: string,
  rowValues: string[],
  accessToken: string
) {
  const appsScriptUrl = localStorage.getItem('custom_apps_script_url');
  if (appsScriptUrl) {
    try {
      const payload = {
        action: 'append',
        spreadsheetId,
        sheetTitle,
        row: rowValues
      };
      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      return data;
    } catch (err: any) {
      console.error('Apps Script appendRowToSpreadsheet error:', err);
      throw new Error(`เพิ่มแถวสินค้าผ่าน Apps Script ล้มเหลว: ${err.message || String(err)}`);
    }
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google Sheets append row error (${res.status})`);
    }

    return await res.json();
  } catch (error: any) {
    console.error('appendRowToSpreadsheet error:', error);
    throw error;
  }
}

/**
 * Create a new Sheet (tab) inside the spreadsheet
 */
export async function createWorksheet(spreadsheetId: string, sheetTitle: string, accessToken: string) {
  const appsScriptUrl = localStorage.getItem('custom_apps_script_url');
  if (appsScriptUrl) {
    try {
      const payload = {
        action: 'createSheet',
        spreadsheetId,
        title: sheetTitle
      };
      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.message);
      return data;
    } catch (err: any) {
      console.error('Apps Script createWorksheet error:', err);
      throw new Error(`สร้างแผ่นงานใหม่ผ่าน Apps Script ล้มเหลว: ${err.message || String(err)}`);
    }
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google Sheets batchUpdate error (${res.status})`);
    }

    return await res.json();
  } catch (error: any) {
    console.error('createWorksheet error:', error);
    throw error;
  }
}

/**
 * Create a brand new Google Spreadsheet file in Drive
 */
export async function createNewSpreadsheet(title: string, accessToken: string) {
  const appsScriptUrl = localStorage.getItem('custom_apps_script_url');
  if (appsScriptUrl) {
    throw new Error('การสร้างไฟล์สเปรดชีตอันใหม่ยังไม่รองรับในโหมด Apps Script (แนะนำสร้างแผ่นงานเปล่าบน Google Drive ของคุณโดยกำหนดแชร์แล้วนำไอดีมาพิมพ์ใส่ช่องเปิดสด)');
  }
  try {
    const url = 'https://sheets.googleapis.com/v4/spreadsheets';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: title,
        },
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to create new spreadsheet (${res.status})`);
    }

    const data = await res.json();
    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title || title,
    };
  } catch (error: any) {
    console.error('createNewSpreadsheet error:', error);
    throw error;
  }
}

/**
 * Helper to convert 0 -> A, 25 -> Z, 26 -> AA etc.
 */
function getColumnLetter(colIdx: number): string {
  let temp = colIdx;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}
