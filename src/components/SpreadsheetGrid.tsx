import { useState, useMemo, useTransition, FormEvent, KeyboardEvent } from 'react';
import { Worksheet } from '../types';
import {
  FileCode,
  Download,
  PlusCircle,
  Columns,
  Search,
  CheckCircle,
  HelpCircle,
  CornerDownLeft,
  ChevronsUpDown,
  TableProperties
} from 'lucide-react';

interface SpreadsheetGridProps {
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  worksheets: Worksheet[];
  activeWorksheet: string | null;
  values: string[][];
  isLoading: boolean;
  isCloudMode: boolean;
  onTabChange: (title: string) => void;
  onCellUpdate: (rowIdx: number, colIdx: number, value: string) => void;
  onAddRow: (rowValues: string[]) => void;
  onAddWorksheet: (sheetTitle: string) => void;
}

export default function SpreadsheetGrid({
  spreadsheetId,
  spreadsheetName,
  worksheets,
  activeWorksheet,
  values,
  isLoading,
  isCloudMode,
  onTabChange,
  onCellUpdate,
  onAddRow,
  onAddWorksheet,
}: SpreadsheetGridProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [newTabName, setNewTabName] = useState('');
  const [showAddTabForm, setShowAddTabForm] = useState(false);
  const [newRowValues, setNewRowValues] = useState<string[]>([]);
  const [showAddRowForm, setShowAddRowForm] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ colIdx: number; direction: 'asc' | 'desc' } | null>(null);

  // Transition for smooth tab switches
  const [, startTransition] = useTransition();

  // Convert column index to Google Sheet column A..Z letter
  const getColLetter = (index: number) => {
    let temp = index;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // Determine actual maximum columns across all rows to construct uniform table rows
  const maxColumns = useMemo(() => {
    if (values.length === 0) return 5;
    return Math.max(...values.map((row) => row.length), 5);
  }, [values]);

  // Map raw data rows to ensure each row has uniform padding
  const normalRows = useMemo(() => {
    return values.map((row) => {
      const newRow = [...row];
      while (newRow.length < maxColumns) {
        newRow.push('');
      }
      return newRow;
    });
  }, [values, maxColumns]);

  // Headers representation
  const tableHeaders = useMemo(() => {
    if (hasHeader && normalRows.length > 0) {
      return normalRows[0].map((cell, idx) => ({
        label: cell || `Column ${getColLetter(idx)}`,
        colIdx: idx,
      }));
    } else {
      const headers = [];
      for (let i = 0; i < maxColumns; i++) {
        headers.push({
          label: `Col ${getColLetter(i)}`,
          colIdx: i,
        });
      }
      return headers;
    }
  }, [normalRows, hasHeader, maxColumns]);

  // Core list of data rows (excluding header row if hasHeader is active)
  const dataRows = useMemo(() => {
    if (hasHeader && normalRows.length > 0) {
      return normalRows.slice(1).map((cells, idx) => ({
        cells,
        originalIdx: idx + 1, // original index in the 'values' list representing real row rowIdx for API
      }));
    }
    return normalRows.map((cells, idx) => ({
      cells,
      originalIdx: idx,
    }));
  }, [normalRows, hasHeader]);

  // Search filter
  const filteredDataRows = useMemo(() => {
    if (!searchTerm.trim()) return dataRows;
    const term = searchTerm.toLowerCase();
    return dataRows.filter((row) =>
      row.cells.some((cell) => cell.toLowerCase().includes(term))
    );
  }, [dataRows, searchTerm]);

  // Sorting columns helper
  const sortedAndFilteredRows = useMemo(() => {
    if (!sortConfig) return filteredDataRows;
    const { colIdx, direction } = sortConfig;
    const sorted = [...filteredDataRows].sort((a, b) => {
      const cellA = a.cells[colIdx] || '';
      const cellB = b.cells[colIdx] || '';

      // Try numeric parsing if numbers
      const numA = parseFloat(cellA.replace(/[\$,]/g, ''));
      const numB = parseFloat(cellB.replace(/[\$,]/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) {
        return direction === 'asc' ? numA - numB : numB - numA;
      }

      // String sort otherwise
      return direction === 'asc'
        ? cellA.localeCompare(cellB, undefined, { numeric: true, sensitivity: 'base' })
        : cellB.localeCompare(cellA, undefined, { numeric: true, sensitivity: 'base' });
    });
    return sorted;
  }, [filteredDataRows, sortConfig]);

  // Toggle sorting
  const handleSort = (colIdx: number) => {
    setSortConfig((prev) => {
      if (prev?.colIdx === colIdx) {
        if (prev.direction === 'asc') {
          return { colIdx, direction: 'desc' };
        }
        return null;
      }
      return { colIdx, direction: 'asc' };
    });
  };

  // Start cell editing click
  const handleCellClick = (rowIdx: number, colIdx: number, val: string) => {
    setEditingCell({ row: rowIdx, col: colIdx });
    setEditValue(val);
  };

  // Save the edited cell
  const handleCellSave = () => {
    if (editingCell) {
      onCellUpdate(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Add worksheet submit
  const handleAddTabSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newTabName.trim()) {
      onAddWorksheet(newTabName.trim());
      setNewTabName('');
      setShowAddTabForm(false);
    }
  };

  // Add new row values initialization
  const openAddRowForm = () => {
    setNewRowValues(Array(maxColumns).fill(''));
    setShowAddRowForm(true);
  };

  const handleNewRowValueChange = (idx: number, val: string) => {
    const updated = [...newRowValues];
    updated[idx] = val;
    setNewRowValues(updated);
  };

  const handleAddRowSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAddRow(newRowValues);
    setShowAddRowForm(false);
  };

  // Download CSV helper
  const handleDownloadCSV = () => {
    if (values.length === 0) return;
    const csvContent = values
      .map((row) =>
        row
          .map((cell) => {
            const clean = cell.replace(/"/g, '""');
            return clean.includes(',') || clean.includes('\n') ? `"${clean}"` : clean;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${spreadsheetName || 'spreadsheet'}-${activeWorksheet || 'sheet'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Simple spreadsheet formula evaluator (for cosmetics / custom interactive touch)
  const evaluatePreview = (val: string) => {
    if (val.startsWith('=')) {
      return (
        <span
          className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-indigo-50 text-[10px] font-mono text-indigo-700 rounded border border-indigo-150 shrink-0"
          title={`Formula detected: ${val}`}
        >
          <FileCode className="w-2.5 h-2.5" />
          Formula
        </span>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" id="spreadsheet-grid-component">
      {/* File Header Details */}
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 bg-green-100 text-green-700 rounded text-xs font-bold font-mono">
              {isCloudMode ? 'CLOUD' : 'LOCAL'}
            </span>
            <h1 className="text-base font-bold text-slate-800 tracking-tight">
              {spreadsheetName || 'No spreadsheet loaded'}
            </h1>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            ID: <span className="select-all bg-slate-100 p-0.5 px-1 rounded">{spreadsheetId || 'sandbox-cache'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {values.length > 0 && (
            <button
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              id="headerToggle"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
            />
            <label htmlFor="headerToggle" className="font-medium cursor-pointer">
              First row is header
            </label>
          </div>
        </div>
      </div>

      {/* Tabs list (Worksheets manager) */}
      <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto select-none font-sans scrollbar-none">
        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mr-2 shrink-0">Tabs:</span>
        {worksheets.map((sheet) => {
          const isActive = sheet.title === activeWorksheet;
          return (
            <button
              key={sheet.title}
              onClick={() => {
                startTransition(() => {
                  onTabChange(sheet.title);
                });
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {sheet.title}
            </button>
          );
        })}

        {/* Tab add button */}
        {!showAddTabForm ? (
          <button
            onClick={() => setShowAddTabForm(true)}
            className="p-1 px-2.5 rounded-full border border-dashed border-slate-300 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50/20 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
          >
            + Add Tab
          </button>
        ) : (
          <form onSubmit={handleAddTabSubmit} className="flex items-center gap-1 px-1 bg-white border border-slate-300 rounded-full">
            <input
              type="text"
              required
              placeholder="Worksheet title..."
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              className="px-2 py-0.5 text-xs bg-transparent focus:outline-none placeholder-slate-400"
            />
            <button type="submit" className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full hover:bg-indigo-700 transition-colors">
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddTabForm(false)}
              className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Search & Actions toolbar */}
      {spreadsheetId && (
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search / filter values inside this worksheet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white leading-normal"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={openAddRowForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Add Data Row
            </button>
          </div>
        </div>
      )}

      {/* Grid container overlay with loader states */}
      <div className="relative min-h-[250px] overflow-auto">
        {isLoading ? (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 z-10">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500 animate-pulse font-mono">Fetching cells grid structure...</p>
          </div>
        ) : null}

        {!spreadsheetId ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-center px-4 space-y-3">
            <TableProperties className="w-12 h-12 text-slate-300" />
            <div className="space-y-1 max-w-sm">
              <h3 className="font-bold text-slate-700">No Spreadsheet Selected</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Click a Sandbox Template from above, paste a Spreadsheet ID, or Sign In to access live sheets!
              </p>
            </div>
          </div>
        ) : values.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center px-4 space-y-2">
            <Columns className="w-10 h-10 text-slate-300 animate-bounce" />
            <div className="space-y-1">
              <p className="font-bold text-slate-700 text-xs">Spreadsheet is empty</p>
              <p className="text-[11px] text-slate-500 max-w-xs leading-normal">
                This worksheet doesn&apos;t seem to have any cell values yet. Go ahead and add some rows.
              </p>
            </div>
            <button
              onClick={openAddRowForm}
              className="mt-2 text-xs text-indigo-600 font-semibold hover:underline"
            >
              + Create first row
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs font-mono" id="sheets-rendered-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold text-center">
                {/* Row Index Indicator Column */}
                <th className="w-12 bg-slate-100 text-center sticky left-0 z-10 border-r border-slate-200">#</th>
                
                {tableHeaders.map((head) => (
                  <th
                    key={head.colIdx}
                    className="p-2 border-r border-slate-200 hover:bg-slate-150 transition-colors max-w-[200px]"
                  >
                    <div className="flex items-center justify-between gap-1.5 px-1">
                      <span className="truncate" title={head.label}>{head.label}</span>
                      <button
                        onClick={() => handleSort(head.colIdx)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                        title="Sort Column"
                      >
                        <ChevronsUpDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAndFilteredRows.map((row) => {
                const globalRowIdx = row.originalIdx;
                return (
                  <tr key={globalRowIdx} className="hover:bg-slate-50/50 group text-slate-700">
                    {/* Index header cell */}
                    <td className="bg-slate-50 text-slate-400 text-center font-bold border-r border-slate-200 font-sans select-none sticky left-0 z-10">
                      {globalRowIdx + 1}
                    </td>

                    {/* Cells values array */}
                    {row.cells.map((cellValue, colIdx) => {
                      const isEditing = editingCell?.row === globalRowIdx && editingCell?.col === colIdx;

                      return (
                        <td
                          key={colIdx}
                          onDoubleClick={() => handleCellClick(globalRowIdx, colIdx, cellValue)}
                          className={`p-2 border-r border-slate-150 transition-all select-all outline-none cursor-pointer max-w-[220px] relative ${
                            isEditing ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-200 ring-inset' : ''
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex items-center justify-between gap-1">
                              <input
                                type="text"
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                                onBlur={handleCellSave}
                                className="w-full bg-transparent focus:outline-none font-mono text-xs select-text leading-tight"
                              />
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevents blur
                                  handleCellSave();
                                }}
                                className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded shrink-0"
                                title="Press Enter to save"
                              >
                                <CornerDownLeft className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate" title={cellValue}>{cellValue || <span className="text-slate-300 italic">empty</span>}</span>
                              {evaluatePreview(cellValue)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Row details count footer bar */}
      {spreadsheetId && values.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-150 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span>Rows Count: {sortedAndFilteredRows.length} shown of {dataRows.length} total</span>
            {searchTerm.trim() && <span className="text-indigo-600">(filtered results)</span>}
          </div>
          <p className="italic text-slate-400 hidden sm:block">Double-click on any cell block to dynamically edit its content</p>
        </div>
      )}

      {/* Interactive Modal / slide drawers */}
      {showAddRowForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 transition-all">
          <div className="bg-white rounded-xl border border-slate-250 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">New Row details input</h3>
              <button
                onClick={() => setShowAddRowForm(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddRowSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide data values for the new spreadsheet row. Columns align in order from left to right.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {tableHeaders.map((col, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Column {idx + 1}: {col.label}
                    </label>
                    <input
                      type="text"
                      value={newRowValues[idx] || ''}
                      onChange={(e) => handleNewRowValueChange(idx, e.target.value)}
                      placeholder={`Enter value matching ${col.label}...`}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs leading-normal focus:outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRowForm(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer"
                >
                  Append Row Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
