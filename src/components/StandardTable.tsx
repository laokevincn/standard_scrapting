import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Loader2, Database, ChevronRight } from 'lucide-react';

interface Standard {
  id: string;
  std_num: string;
  title: string;
  department: string;
  implement_date: string;
  status: string;
  url: string;
  url_csres?: string;
  url_samr?: string;
  publish_date?: string;
  replace_standard?: string;
  standard_category?: string;
  ccs_code?: string;
  ics_code?: string;
  execution_unit?: string;
  competent_department?: string;
}

export function StandardTable() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchStandards = async (searchQuery = query, pageNum = page) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/standards?q=${encodeURIComponent(searchQuery)}&page=${pageNum}`);
      const data = await res.json();
      setStandards(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (error) {
      console.error('获取标准失败:', error);
      setStandards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandards(query, page);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStandards(query, 1);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Local Database Table */}
      <div className="flex flex-col flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden min-h-0">
        <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              标准数据库查询
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              本地总计 <span className="font-semibold text-zinc-900">{totalCount}</span> 条标准
            </p>
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <form onSubmit={handleSearch} className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="输入关键词搜索..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-24 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
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
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/50 text-zinc-500 sticky top-0 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 font-medium whitespace-nowrap">标准号</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">标准名称</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">状态</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">发布日期</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">实施日期</th>
                <th className="px-6 py-4 font-medium text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                      <p>正在获取数据...</p>
                    </div>
                  </td>
                </tr>
              ) : standards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center text-zinc-500">
                    没有找到相关标准。请尝试其他关键词。
                  </td>
                </tr>
              ) : (
                standards.map((std) => (
                  <tr key={std.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono whitespace-nowrap">
                      <Link to={`/standard/${std.id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
                        {std.std_num}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-zinc-700 max-w-md truncate" title={std.title}>{std.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        std.status.includes('现行') || std.status.includes('Active') 
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' 
                          : std.status.includes('作废')
                          ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
                          : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-500/20'
                      }`}>
                        {std.status || '未知'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">{std.publish_date || '-'}</td>
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">{std.implement_date || '-'}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link 
                        to={`/standard/${std.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="查看详情"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && !loading && (
          <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-sm text-zinc-500 bg-zinc-50/50">
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
