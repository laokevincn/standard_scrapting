import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Loader2, Database, DownloadCloud, Activity } from 'lucide-react';

interface Standard {
  id: string;
  std_num: string;
  title: string;
  department: string;
  implement_date: string;
  status: string;
  url: string;
}

interface ScrapeState {
  isScraping: boolean;
  currentKeyword: string;
  page: number;
  totalPages: number;
  totalSaved: number;
}

export function StandardTable() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [scrapeKeyword, setScrapeKeyword] = useState('');
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeState | null>(null);
  const [startingScrape, setStartingScrape] = useState(false);

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
    fetchStandards();
  }, [page]);

  // Poll scraper status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scrape/status');
        const data = await res.json();
        setScrapeStatus(data);
        
        // If it's scraping, refresh the table occasionally to show new data
        if (data.isScraping && data.totalSaved > 0 && data.totalSaved % 10 === 0) {
          fetchStandards(query, page);
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [query, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStandards(query, 1);
  };

  const handleStartScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeKeyword.trim() || scrapeStatus?.isScraping) return;
    
    setStartingScrape(true);
    try {
      await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: scrapeKeyword })
      });
      setScrapeKeyword('');
    } catch (error) {
      console.error('Failed to start scrape:', error);
    } finally {
      setStartingScrape(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
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
              <form onSubmit={handleStartScrape} className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入要批量抓取的关键词 (如 GB, 9985)..."
                  value={scrapeKeyword}
                  onChange={(e) => setScrapeKeyword(e.target.value)}
                  className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={startingScrape || !scrapeKeyword.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {startingScrape ? '启动中...' : '开始批量抓取'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Local Database Table */}
      <div className="flex flex-col flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden min-h-0">
        <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              标准数据库查询
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              搜索时会自动从工标网获取最新数据并合并到本地 (本地总计 <span className="font-semibold text-zinc-900">{totalCount}</span> 条)
            </p>
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <form onSubmit={handleSearch} className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="输入关键词搜索 (自动抓取并保存)..."
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
                <th className="px-6 py-4 font-medium">标准号</th>
                <th className="px-6 py-4 font-medium">标准名称</th>
                <th className="px-6 py-4 font-medium">发布部门</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">实施日期</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                      <p>正在获取数据并合并到本地...</p>
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
                  <tr key={std.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-zinc-900 whitespace-nowrap">{std.std_num}</td>
                    <td className="px-6 py-4 text-zinc-700 max-w-xs truncate" title={std.title}>{std.title}</td>
                    <td className="px-6 py-4 text-zinc-500 max-w-[150px] truncate" title={std.department}>{std.department}</td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">{std.implement_date || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      {std.url && (
                        <a 
                          href={std.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                          title="在工标网查看详情"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
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
