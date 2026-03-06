import React, { useState, useEffect } from 'react';
import { Database, DownloadCloud, UploadCloud, Trash2, RefreshCw, Search, Loader2, Activity, Edit2, X } from 'lucide-react';

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

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState('department');
  const [editValue, setEditValue] = useState('');

  const fetchStandards = async (searchQuery = query, pageNum = page, sortB = sortBy, sortO = sortOrder, currentFilters = filters) => {
    setLoading(true);
    try {
      const filtersParam = encodeURIComponent(JSON.stringify(currentFilters));
      const res = await fetch(`/api/standards?q=${encodeURIComponent(searchQuery)}&page=${pageNum}&limit=50&sortBy=${sortB}&sortOrder=${sortO}&filters=${filtersParam}`);
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
    fetchStandards(query, page, sortBy, sortOrder, filters);
  }, [page, sortBy, sortOrder, filters]);

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
    if (!selectAllFiltered && selectedIds.size === 0) return;
    const msg = selectAllFiltered ? '确定要删除所有符合当前筛选条件的数据吗？' : `确定要删除 ${selectedIds.size} 条标准吗？`;
    if (!confirm(msg)) return;

    try {
      await fetch('/api/admin/standards/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          selectAllFiltered,
          query,
          filters
        })
      });
      setSelectedIds(new Set());
      setSelectAllFiltered(false);
      fetchStandards();
    } catch (error) {
      console.error('Failed to delete standards:', error);
    }
  };

  const handleBatchRefresh = async () => {
    if (!selectAllFiltered && selectedIds.size === 0) return;
    const msg = selectAllFiltered ? '确定要抓取所有符合筛选条件的标准的详细信息吗？此操作将在后台进行。' : `确定要抓取 ${selectedIds.size} 条标准的详细信息吗？此操作将在后台进行。`;
    if (!confirm(msg)) return;

    try {
      await fetch('/api/admin/standards/batch-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          selectAllFiltered,
          query,
          filters
        })
      });
      alert('批量抓取已在后台启动。');
      setSelectedIds(new Set());
      setSelectAllFiltered(false);
    } catch (error) {
      console.error('Failed to refresh standards:', error);
    }
  };

  const handleBatchEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectAllFiltered && selectedIds.size === 0) return;

    try {
      const res = await fetch('/api/admin/standards/batch-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          field: editField,
          value: editValue,
          ids: Array.from(selectedIds),
          selectAllFiltered,
          query,
          filters
        })
      });
      if (res.ok) {
        setShowEditModal(false);
        setEditValue('');
        setSelectedIds(new Set());
        setSelectAllFiltered(false);
        fetchStandards();
        alert('批量修改成功！');
      } else {
        alert('批量修改失败');
      }
    } catch (error) {
      console.error('Failed to batch edit:', error);
      alert('批量修改时出错');
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

      const filtersParam = encodeURIComponent(JSON.stringify(filters));
      const res = await fetch(`/api/export?q=${encodeURIComponent(query)}&sortBy=${sortBy}&sortOrder=${sortOrder}&filters=${filtersParam}`, {
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto flex-wrap">
            <label className="flex items-center gap-2 text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-zinc-100 transition-colors">
              <input
                type="checkbox"
                checked={selectAllFiltered}
                onChange={(e) => setSelectAllFiltered(e.target.checked)}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              选择当前筛选下所有数据
            </label>
            <button
              onClick={handleBatchDelete}
              disabled={!selectAllFiltered && selectedIds.size === 0}
              className="w-full sm:w-auto px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              批量删除 ({selectAllFiltered ? '全部' : selectedIds.size})
            </button>
            <button
              onClick={handleBatchRefresh}
              disabled={!selectAllFiltered && selectedIds.size === 0}
              className="w-full sm:w-auto px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              批量抓取详情 ({selectAllFiltered ? '全部' : selectedIds.size})
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              disabled={!selectAllFiltered && selectedIds.size === 0}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              批量修改字段 ({selectAllFiltered ? '全部' : selectedIds.size})
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
                <th className="px-4 py-3 w-12 align-top">
                  <input
                    type="checkbox"
                    checked={standards.length > 0 && selectedIds.size === standards.length}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 mt-1"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors align-top" onClick={() => handleSort('id')}>ID{renderSortIndicator('id')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors align-top" onClick={() => handleSort('std_num')}>标准号{renderSortIndicator('std_num')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors align-top" onClick={() => handleSort('title')}>标准名称{renderSortIndicator('title')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">
                  <div className="flex flex-col gap-2">
                    <span className="cursor-pointer hover:bg-zinc-100 transition-colors p-1 -m-1 rounded" onClick={() => handleSort('department')}>部门{renderSortIndicator('department')}</span>
                    <input type="text" placeholder="筛选" className="w-24 px-2 py-1 bg-white border border-zinc-200 rounded text-xs font-normal focus:outline-none focus:border-indigo-500" value={filters.department || ''} onChange={e => { setFilters({ ...filters, department: e.target.value }); setPage(1); }} />
                  </div>
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">
                  <div className="flex flex-col gap-2">
                    <span className="cursor-pointer hover:bg-zinc-100 transition-colors p-1 -m-1 rounded" onClick={() => handleSort('implement_date')}>实施日期{renderSortIndicator('implement_date')}</span>
                    <input type="text" placeholder="筛选" className="w-24 px-2 py-1 bg-white border border-zinc-200 rounded text-xs font-normal focus:outline-none focus:border-indigo-500" value={filters.implement_date || ''} onChange={e => { setFilters({ ...filters, implement_date: e.target.value }); setPage(1); }} />
                  </div>
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">
                  <div className="flex flex-col gap-2">
                    <span className="cursor-pointer hover:bg-zinc-100 transition-colors p-1 -m-1 rounded" onClick={() => handleSort('status')}>状态{renderSortIndicator('status')}</span>
                    <input type="text" placeholder="筛选" className="w-24 px-2 py-1 bg-white border border-zinc-200 rounded text-xs font-normal focus:outline-none focus:border-indigo-500" value={filters.status || ''} onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1); }} />
                  </div>
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">
                  <div className="flex flex-col gap-2">
                    <span className="cursor-pointer hover:bg-zinc-100 transition-colors p-1 -m-1 rounded" onClick={() => handleSort('publish_date')}>发布日期{renderSortIndicator('publish_date')}</span>
                    <input type="text" placeholder="筛选" className="w-24 px-2 py-1 bg-white border border-zinc-200 rounded text-xs font-normal focus:outline-none focus:border-indigo-500" value={filters.publish_date || ''} onChange={e => { setFilters({ ...filters, publish_date: e.target.value }); setPage(1); }} />
                  </div>
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('replace_standard')}>代替标准{renderSortIndicator('replace_standard')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">
                  <div className="flex flex-col gap-2">
                    <span className="cursor-pointer hover:bg-zinc-100 transition-colors p-1 -m-1 rounded" onClick={() => handleSort('standard_category')}>标准类别{renderSortIndicator('standard_category')}</span>
                    <input type="text" placeholder="筛选" className="w-24 px-2 py-1 bg-white border border-zinc-200 rounded text-xs font-normal focus:outline-none focus:border-indigo-500" value={filters.standard_category || ''} onChange={e => { setFilters({ ...filters, standard_category: e.target.value }); setPage(1); }} />
                  </div>
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">CCS代码</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">ICS代码</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">执行单位</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">主管单位</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">来源URL</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">CSRES URL</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top">SAMR URL</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap align-top cursor-pointer hover:bg-zinc-100 transition-colors" onClick={() => handleSort('updated_at')}>更新时间{renderSortIndicator('updated_at')}</th>
                <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap text-right sticky right-0 bg-zinc-50 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] align-top">操作</th>
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
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${(std.status || '').includes('现行') || (std.status || '').includes('Active')
                        ? 'bg-emerald-50 text-emerald-700'
                        : (std.status || '').includes('作废')
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

      {
        showEditModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900">批量修改字段</h3>
                <button onClick={() => setShowEditModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleBatchEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">修改对象</label>
                  <div className="text-sm bg-zinc-50 p-2 rounded border border-zinc-200 text-zinc-600">
                    {selectAllFiltered ? '当前所有符合筛选条件的数据' : `已选中的 ${selectedIds.size} 条数据`}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">选择要修改的字段</label>
                  <select
                    value={editField}
                    onChange={(e) => setEditField(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="department">部门 (Department)</option>
                    <option value="status">状态 (Status)</option>
                    <option value="standard_category">标准类别 (Standard Category)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">修改为 (留空则清空该字段)</label>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="输入新的字段值..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors text-sm font-medium"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    确认修改
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
}
