import React, { useState, useEffect } from 'react';
import { Database, DownloadCloud, UploadCloud, Trash2, RefreshCw, Search, Loader2, Activity } from 'lucide-react';

interface ScrapeState {
  isScraping: boolean;
  currentKeyword: string;
  page: number;
  totalPages: number;
  totalSaved: number;
}

export function DatabaseManagement() {
  const [standards, setStandards] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [scrapingId, setScrapingId] = useState<number | null>(null);

  const [scrapeKeyword, setScrapeKeyword] = useState('');
  const [scrapeSource, setScrapeSource] = useState('csres');
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeState | null>(null);
  const [startingScrape, setStartingScrape] = useState(false);

  const fetchStandards = async (searchQuery = query, pageNum = page, sortB = sortBy, sortO = sortOrder) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/standards?q=${encodeURIComponent(searchQuery)}&page=${pageNum}&limit=50&sortBy=${sortB}&sortOrder=${sortO}`);
      const data = await res.json();
      setStandards(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch standards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandards(query, page, sortBy, sortOrder);
  }, [page, sortBy, sortOrder]);

  // Poll scraper status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scrape/status?source=${scrapeSource}`);
        const data = await res.json();
        setScrapeStatus(data);

        // If it's scraping, refresh the table occasionally to show new data
        if (data.isScraping && data.totalSaved > 0 && data.totalSaved % 10 === 0) {
          fetchStandards(query, page);
        }
      } catch (e) { }
    }, 2000);
    return () => clearInterval(interval);
  }, [query, page, scrapeSource]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStandards(query, 1, sortBy, sortOrder);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const renderSortIndicator = (column: string) => {
    if (sortBy !== column) return null;
    return <span className="ml-1 text-indigo-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === standards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(standards.map(s => s.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除 ${selectedIds.size} 条标准吗？`)) return;

    try {
      await fetch('/api/admin/standards/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      setSelectedIds(new Set());
      fetchStandards();
    } catch (error) {
      console.error('Failed to delete standards:', error);
    }
  };

  const handleBatchRefresh = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要抓取 ${selectedIds.size} 条标准的详细信息吗？此操作将在后台进行。`)) return;

    try {
      await fetch('/api/admin/standards/batch-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      alert('批量抓取已在后台启动。');
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to refresh standards:', error);
    }
  };

  const handleScrapeDetail = async (id: number) => {
    setScrapingId(id);
    try {
      const res = await fetch(`/api/admin/standards/${id}/scrape-detail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const { data } = await res.json();
        setStandards(standards.map(s => s.id === id ? data : s));
      } else {
        const err = await res.json();
        alert(`抓取失败: ${err.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Failed to scrape detail:', error);
      alert('抓取失败，请检查网络');
    } finally {
      setScrapingId(null);
    }
  };

  const handleStartScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeKeyword.trim() || scrapeStatus?.isScraping) return;

    setStartingScrape(true);
    try {
      await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: scrapeKeyword, source: scrapeSource })
      });
      setScrapeKeyword('');
    } catch (error) {
      console.error('Failed to start scrape:', error);
    } finally {
      setStartingScrape(false);
    }
  };

  const handleExport = async () => {
    try {
      // Need a valid API token for export
      const tokenRes = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ user_id: JSON.parse(localStorage.getItem('adminUser') || '{}').id, expires_in_days: 1 })
      });
      const tokenData = await tokenRes.json();

      const res = await fetch(`/api/export?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${tokenData.token}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'standards.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('导出失败');
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-zinc-900">数据库管理</h2>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <DownloadCloud className="w-4 h-4" />
            导出为 Excel
          </button>
        </div>
      </div>

      {/* Scraper Control Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-indigo-600" />
              后台批量抓取任务
            </h2>
            <p className="text-sm text-zinc-500 mt-1">输入关键词，后台自动翻页抓取所有相关标准并保存到本地</p>
          </div>

          <div className="flex-1 max-w-md w-full">
            {scrapeStatus?.isScraping ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  <div>
                    <div className="text-sm font-medium text-indigo-900">
                      正在抓取 "{scrapeStatus.currentKeyword}"
                    </div>
                    <div className="text-xs text-indigo-700 mt-0.5">
                      第 {scrapeStatus.page} / {scrapeStatus.totalPages || '?'} 页 · 已保存 {scrapeStatus.totalSaved} 条
                    </div>
                  </div>
                </div>
                <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
            ) : (
              <form onSubmit={handleStartScrape} className="flex flex-col sm:flex-row gap-2">
                <select
                  value={scrapeSource}
                  onChange={(e) => setScrapeSource(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="csres">工标网</option>
                  <option value="samr">国家全文公开网</option>
                </select>
                <input
                  type="text"
                  placeholder="输入要批量抓取的关键词 (如 GB, 9985)..."
                  value={scrapeKeyword}
                  onChange={(e) => setScrapeKeyword(e.target.value)}
                  className="w-full sm:flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={startingScrape || !scrapeKeyword.trim()}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center justify-center"
                >
                  {startingScrape ? '启动中...' : '开始批量抓取'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <button
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
              className="w-full sm:w-auto px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              批量删除 ({selectedIds.size})
            </button>
            <button
              onClick={handleBatchRefresh}
              disabled={selectedIds.size === 0}
              className="w-full sm:w-auto px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              批量抓取详情 ({selectedIds.size})
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="搜索标准..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-24 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              搜索
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1000px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={standards.length > 0 && selectedIds.size === standards.length}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('id')}>ID{renderSortIndicator('id')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('std_num')}>标准号{renderSortIndicator('std_num')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('title')}>标准名称{renderSortIndicator('title')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('department')}>部门{renderSortIndicator('department')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('implement_date')}>实施日期{renderSortIndicator('implement_date')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('status')}>状态{renderSortIndicator('status')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('publish_date')}>发布日期{renderSortIndicator('publish_date')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('replace_standard')}>代替标准{renderSortIndicator('replace_standard')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('standard_category')}>标准类别{renderSortIndicator('standard_category')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">CCS代码</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">ICS代码</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">执行单位</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">主管单位</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">来源URL</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">CSRES URL</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">SAMR URL</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('updated_at')}>更新时间{renderSortIndicator('updated_at')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap text-right sticky right-0 bg-zinc-50 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={19} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
                  </td>
                </tr>
              ) : standards.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-6 py-12 text-center text-zinc-500">
                    未找到标准。
                  </td>
                </tr>
              ) : (
                standards.map((std) => (
                  <tr key={std.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(std.id)}
                        onChange={() => toggleSelect(std.id)}
                        className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{std.id}</td>
                    <td className="px-4 py-3 font-mono text-zinc-900 whitespace-nowrap">{std.std_num}</td>
                    <td className="px-4 py-3 text-zinc-700 max-w-[200px] truncate" title={std.title}>{std.title}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{std.department || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{std.implement_date || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${std.status.includes('现行') || std.status.includes('Active')
                        ? 'bg-emerald-50 text-emerald-700'
                        : std.status.includes('作废')
                          ? 'bg-red-50 text-red-700'
                          : 'bg-zinc-100 text-zinc-600'
                        }`}>
                        {std.status || '未知'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{std.publish_date || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={std.replace_standard}>{std.replace_standard || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={std.standard_category}>{std.standard_category || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{std.ccs_code || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{std.ics_code || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={std.execution_unit}>{std.execution_unit || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={std.competent_department}>{std.competent_department || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={std.url}>
                      {std.url ? <a href={std.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{std.url}</a> : '-'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={std.url_csres}>
                      {std.url_csres ? <a href={std.url_csres} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{std.url_csres}</a> : '-'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[150px] truncate" title={std.url_samr}>
                      {std.url_samr ? <a href={std.url_samr} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{std.url_samr}</a> : '-'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{new Date(std.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.02)]">
                      <button
                        onClick={() => handleScrapeDetail(std.id)}
                        disabled={scrapingId === std.id}
                        className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1 ml-auto"
                      >
                        {scrapingId === std.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />抓取中</>
                        ) : '抓取详情'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && !loading && (
          <div className="mt-6 flex items-center justify-between text-sm text-zinc-500">
            <div>第 {page} 页，共 {totalPages} 页</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
