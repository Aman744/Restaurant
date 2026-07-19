import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, ArrowUpDown } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchField?: keyof T;
  onExportCsv?: () => void;
  rowsPerPage?: number;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = 'Search records...',
  searchField,
  onExportCsv,
  rowsPerPage = 8,
  emptyMessage = 'No records found.'
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Search Filter
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter((item) => {
      if (searchField && item[searchField]) {
        return String(item[searchField]).toLowerCase().includes(term);
      }
      return Object.values(item).some((val) =>
        String(val).toLowerCase().includes(term)
      );
    });
  }, [data, search, searchField]);

  // 2. Sorting
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal === bVal) return 0;
      const res = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? res : -res;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // 3. Pagination
  const totalPages = Math.ceil(sortedData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const handleSort = (key?: keyof T) => {
    if (!key) return;
    if (sortColumn === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else setSortColumn(null);
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full border border-zinc-800 bg-zinc-900/60 pl-10 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/30 rounded-xl placeholder-zinc-500"
          />
        </div>

        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 text-xs font-semibold rounded-xl transition"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            Export CSV
          </button>
        )}
      </div>

      {/* Table Surface */}
      <div className="border border-zinc-800/80 bg-zinc-900/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-6 py-4"
                    onClick={() => col.sortable && handleSort(col.accessorKey)}
                  >
                    <div className="flex items-center gap-1.5 cursor-pointer select-none">
                      <span>{col.header}</span>
                      {col.sortable && <ArrowUpDown className="h-3 w-3 text-zinc-600 hover:text-zinc-300" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {paginatedData.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-zinc-800/20 transition">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-6 py-4">
                      {col.cell ? col.cell(row) : col.accessorKey ? row[col.accessorKey] : null}
                    </td>
                  ))}
                </tr>
              ))}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-zinc-500 font-medium">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-850 text-xs text-zinc-500 bg-zinc-950/40">
          <div>
            Showing <span className="font-semibold text-zinc-300">{paginatedData.length}</span> of{' '}
            <span className="font-semibold text-zinc-300">{filteredData.length}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition text-zinc-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-zinc-300 font-bold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition text-zinc-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
