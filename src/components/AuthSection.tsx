import { useState, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { LogOut, RefreshCw, Key, ShieldCheck, HelpCircle, ExternalLink, Globe } from 'lucide-react';

interface AuthSectionProps {
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onManualTokenSubmit: (token: string) => void;
}

export default function AuthSection({
  user,
  needsAuth,
  isLoggingIn,
  onLogin,
  onLogout,
  onManualTokenSubmit,
}: AuthSectionProps) {
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showIframeTip, setShowIframeTip] = useState(false);

  // Check if we are running in an iframe
  const isInIframe = window.self !== window.top;

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      onManualTokenSubmit(manualToken.trim());
      setManualToken('');
      setShowManualInput(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4" id="sheets-auth-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Connection status badge / Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${user ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-1.5">
              Google Workspace API Cloud Access
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            {user
              ? `Authorized as ${user.displayName || user.email}`
              : 'Sign in to access, search, and edit live spreadsheets directly from your Google Sheets.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {needsAuth || !user ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* official look and feel button */}
              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50"
                id="sign-in-google-btn"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                )}
                {isLoggingIn ? 'Connecting...' : 'Connect Google Sheets'}
              </button>

              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-medium rounded-lg transition-colors"
                title="Input manually generated oauth token"
              >
                <Key className="w-3.5 h-3.5" />
                Advanced Token
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 pl-2 pr-3 py-1 rounded-lg border border-slate-100">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    referrerPolicy="no-referrer"
                    className="w-5.5 h-5.5 rounded-full"
                  />
                ) : (
                  <div className="w-5.5 h-5.5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                    {user.email ? user.email[0].toUpperCase() : 'G'}
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-700">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1 px-3 py-2 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-100 text-slate-600 text-xs font-medium rounded-lg transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}

          {/* Guide toggle button */}
          <button
            onClick={() => setShowIframeTip(!showIframeTip)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Authentication help"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Embedded Iframe Popup Warning banner */}
      {isInIframe && !user && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200/60 text-amber-800 text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="text-base">💡</span>
            <div className="space-y-0.5">
              <p className="font-semibold">Iframe Detected</p>
              <p className="text-amber-700 leading-normal">
                Browsers blocks secure authentication popups inside iframe viewports. If login does not respond, click the button below to open in a dedicated tab!
              </p>
            </div>
          </div>
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold font-mono text-[10px] uppercase tracking-wide transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open New Tab
          </a>
        </div>
      )}

      {/* Help block with OAuth issues guide */}
      {(showIframeTip || (needsAuth && isInIframe)) && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs space-y-2">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Why doesn&apos;t the Google Sheets connection respond?
          </h4>
          <p className="leading-relaxed">
            Due to strict security protocols, nested browser containers (iframes) require specific settings or direct permissions to initialize Google Auth modules successfully.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-500">
            <li>
              <strong>Popups blocked:</strong> Verify your browser address bar has not blocked the popup. Click the &quot;Allow popups from this site&quot; option.
            </li>
            <li>
              <strong>Direct link fallback:</strong> Open the application in a new tab by clicking the <strong>Open New Tab</strong> button. It runs outside the iframe with perfect permission support.
            </li>
            <li>
              <strong>Token Override:</strong> For secure corporate workspaces, developers can generate an Access Token manually and paste it into the <strong>Advanced Token</strong> field.
            </li>
          </ul>
        </div>
      )}

      {/* Manual Token input drawer */}
      {showManualInput && (
        <form onSubmit={handleManualSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Manual Google OAuth Access Token
            </label>
            <p className="text-[11px] text-slate-500">
              Paste a custom temporary Bearer access token generated from your Google Cloud Console or playground.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="e.g. ya29.a0AfB_by_..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs leading-normal font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-colors"
            >
              Apply Token
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
