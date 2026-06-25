import { useState, FormEvent } from 'react';
import { SpreadsheetFile } from '../types';
import { Search, Plus, Link, Database, FileSpreadsheet, RefreshCw, Layers } from 'lucide-react';

interface SpreadsheetSelectorProps {
  files: SpreadsheetFile[];
  activeId: string | null;
  isLoading: boolean;
  isCloudMode: boolean;
  onSelect: (id: string, name: string) => void;
  onCreateSpreadsheet: (title: string) => void;
  onRefreshList: () => void;
  onLoadByIdOrUrl: (input: string) => void;
}

export default function SpreadsheetSelector({
  files,
  activeId,
  isLoading,
  isCloudMode,
  onSelect,
  onCreateSpreadsheet,
  onRefreshList,
  onLoadByIdOrUrl,
}: SpreadsheetSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newSheetTitle.trim()) {
      onCreateSpreadsheet(newSheetTitle.trim());
      setNewSheetTitle('');
      setIsCreating(false);
    }
  };

  const handleCustomImport = (e: FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onLoadByIdOrUrl(customInput.trim());
      setCustomInput('');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4" id="spreadsheet-selector">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4.5 h-4.5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-800">
            {isCloudMode ? 'Google Drive Spreadsheet Browser' : 'Select Predefined Sandbox Templates'}
          </h2>
        </div>
        
        {isCloudMode && (
          <button
            onClick={onRefreshList}
            disabled={isLoading}
            className="p-1 px-2 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded text-xs transition-colors flex items-center gap-1 font-mono"
            title="Refresh drive spreadsheets file list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            Refresh List
          </button>
        )}
      </div>

      {/* Manual import by ID or URL */}
      <form onSubmit={handleCustomImport} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
        <div className="sm:col-span-3">
          <label className="sr-only">Spreadsheet URL or Spreadsheet ID</label>
          <div className="relative">
            <Link className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Paste Google Spreadsheet URL or Sheet ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 leading-normal"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition-colors w-full flex items-center justify-center gap-1 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          Load Sheet
        </button>
      </form>

      {/* Search inside the existing loaded list */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter spreadsheets by name..."
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 leading-normal"
        />
      </div>

      {/* Spreadsheet grid-list container */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="font-medium animate-pulse">Loading sheets metadata from Google Drive query...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No spreadsheets match the search filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredFiles.map((file) => {
              const isSelected = file.id === activeId;
              return (
                <button
                  key={file.id}
                  onClick={() => onSelect(file.id, file.name)}
                  className={`text-left p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 hover:bg-indigo-50'
                      : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-green-50 text-green-700'}`}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {file.name}
                    </p>
                    {file.modifiedTime && (
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        Modified: {new Date(file.modifiedTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create brand new spreadsheet card (Only in Cloud Mode) */}
      {isCloudMode && (
        <div className="border-t border-slate-100 pt-3">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2 border border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 text-indigo-600 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create A Brand New Spreadsheet In Drive
            </button>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                New Spreadsheet Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="e.g. Sales Forecast Q3"
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded transition-colors"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
