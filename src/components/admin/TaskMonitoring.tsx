import React, { useState, useEffect } from 'react';
import { Loader2, Activity } from 'lucide-react';

interface ScrapeState {
    isScraping: boolean;
    currentKeyword: string;
    page: number;
    totalPages: number;
    totalSaved: number;
    isCancelled: boolean;
    logs: string[];
}

export function TaskMonitoring() {
    const [scrapeKeyword, setScrapeKeyword] = useState('');
    const [scrapeSource] = useState('samr');
    const [scrapeStatus, setScrapeStatus] = useState<ScrapeState | null>(null);
    const [startingScrape, setStartingScrape] = useState(false);

    const [rescrapeStatus, setRescrapeStatus] = useState<any>(null);
    const [startingRescrape, setStartingRescrape] = useState(false);

    // Poll scraper status
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/scrape/status?source=${scrapeSource}`);
                const data = await res.json();
                setScrapeStatus(data);

                const res2 = await fetch(`/api/scrape/status?source=rescrape`);
                const data2 = await res2.json();
                setRescrapeStatus(data2);
            } catch (e) { }
        }, 2000);
        return () => clearInterval(interval);
    }, [scrapeSource]);

    const handleStartScrape = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scrapeKeyword.trim()) return;

        setStartingScrape(true);
        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ keyword: scrapeKeyword.trim(), source: scrapeSource })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Failed to start scrape task');
            } else {
                setScrapeKeyword('');
            }
        } catch (error) {
            console.error('Failed to start scrape:', error);
            alert('发送抓取请求失败，检查当前是否已有任务运行');
        } finally {
            setStartingScrape(false);
        }
    };

    const handleCancelScrape = async () => {
        if (!confirm('确定要终止当前的抓取任务吗？')) return;
        try {
            await fetch('/api/scrape/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ source: scrapeSource })
            });
        } catch (error) {
            console.error('Failed to cancel scrape:', error);
            alert('发送终止请求失败');
        }
    };

    const handleStartRescrape = async () => {
        if (!confirm('确定要开始系统缺失数据修复抓取吗？')) return;
        setStartingRescrape(true);
        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ source: 'rescrape' })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Failed to start rescrape task');
            }
        } catch (error) {
            console.error('Failed to start rescrape:', error);
            alert('发送系统抓取请求失败');
        } finally {
            setStartingRescrape(false);
        }
    };

    const handleCancelRescrape = async () => {
        if (!confirm('确定要终止当前的修复抓取任务吗？')) return;
        try {
            await fetch('/api/scrape/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ source: 'rescrape' })
            });
        } catch (error) {
            console.error('Failed to cancel rescrape:', error);
            alert('发送终止请求失败');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900">后台任务监控</h2>
                    <p className="text-zinc-500 mt-1">查看和管理系统后台自动批量抓取任务。</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">按关键词批量抓取任务</h3>

                <div className="flex-1 w-full relative space-y-6">
                    <form onSubmit={handleStartScrape} className="flex flex-col sm:flex-row gap-2 max-w-2xl">
                        <div className="w-full sm:w-auto px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-600 font-medium select-none shrink-0 flex items-center justify-center">
                            国家全文公开网
                        </div>
                        <input
                            type="text"
                            placeholder="输入要批量抓取的关键词 (如 GB, 9985)..."
                            value={scrapeKeyword}
                            onChange={(e) => setScrapeKeyword(e.target.value)}
                            className="w-full sm:flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                        />
                        <button
                            type="submit"
                            disabled={startingScrape || !scrapeKeyword.trim() || !!scrapeStatus?.isScraping}
                            className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center justify-center shrink-0"
                        >
                            {startingScrape ? '启动中...' : '开始批量抓取'}
                        </button>
                    </form>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {scrapeStatus?.isScraping ? (
                                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                                ) : (
                                    <Activity className="w-5 h-5 text-zinc-400 shrink-0" />
                                )}
                                <div>
                                    <div className={`text-sm font-medium ${scrapeStatus?.isScraping ? 'text-indigo-900' : 'text-zinc-600'}`}>
                                        {scrapeStatus?.isScraping ? `正在抓取 "${scrapeStatus.currentKeyword}"` : '当前没有活跃的关键词抓取任务'}
                                    </div>
                                    {scrapeStatus?.isScraping && (
                                        <div className="text-xs text-indigo-700 mt-0.5">
                                            第 {scrapeStatus.page} / {scrapeStatus.totalPages || '?'} 页 · 已保存 {scrapeStatus.totalSaved} 条
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {scrapeStatus?.isCancelled && <span className="text-xs text-red-600 font-medium mr-2">正在中止...</span>}
                                <button
                                    onClick={handleCancelScrape}
                                    disabled={!scrapeStatus?.isScraping || scrapeStatus?.isCancelled}
                                    className="px-3 py-1 bg-white text-zinc-700 hover:text-red-700 hover:bg-red-50 border border-zinc-200 hover:border-red-200 disabled:opacity-50 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    中止任务
                                </button>
                                {scrapeStatus?.isScraping && <Activity className="w-5 h-5 text-indigo-400 animate-pulse hidden sm:block" />}
                            </div>
                        </div>

                        <div className="bg-zinc-900 rounded-lg p-3 h-64 overflow-y-auto font-mono text-[10px] sm:text-xs text-zinc-300 flex flex-col-reverse shadow-inner">
                            {scrapeStatus?.logs && scrapeStatus.logs.length > 0 ? (
                                scrapeStatus.logs.map((log, idx) => (
                                    <div key={idx} className="whitespace-pre-wrap py-0.5 border-b border-zinc-800 last:border-0">{log}</div>
                                ))
                            ) : (
                                <div className="text-zinc-500 italic">等待日志输出...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="text-lg font-semibold text-zinc-900">缺失数据系统修补任务</h3>
                    <button
                        onClick={handleStartRescrape}
                        disabled={startingRescrape || !!rescrapeStatus?.isRunning}
                        className="px-5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
                    >
                        {startingRescrape ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        开始修补丢失数据
                    </button>
                </div>

                <div className="flex-1 w-full relative">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {rescrapeStatus?.isRunning ? (
                                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                                ) : (
                                    <Activity className="w-5 h-5 text-zinc-400 shrink-0" />
                                )}
                                <div>
                                    <div className={`text-sm font-medium ${rescrapeStatus?.isRunning ? 'text-indigo-900' : 'text-zinc-600'}`}>
                                        {rescrapeStatus?.isRunning ? `正在修补数据` : '当前没有活跃的修补任务'}
                                    </div>
                                    {rescrapeStatus?.isRunning && (
                                        <div className="text-xs text-indigo-700 mt-0.5">
                                            进度: {rescrapeStatus.processed} / {rescrapeStatus.totalFound} · 成功: {rescrapeStatus.successCount} · 失败: {rescrapeStatus.failCount}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {rescrapeStatus?.isCancelled && <span className="text-xs text-red-600 font-medium mr-2">正在中止...</span>}
                                <button
                                    onClick={handleCancelRescrape}
                                    disabled={!rescrapeStatus?.isRunning || rescrapeStatus?.isCancelled}
                                    className="px-3 py-1 bg-white text-zinc-700 hover:text-red-700 hover:bg-red-50 border border-zinc-200 hover:border-red-200 disabled:opacity-50 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    中止任务
                                </button>
                                {rescrapeStatus?.isRunning && <Activity className="w-5 h-5 text-indigo-400 animate-pulse hidden sm:block" />}
                            </div>
                        </div>

                        <div className="bg-zinc-900 rounded-lg p-3 h-64 overflow-y-auto font-mono text-[10px] sm:text-xs text-zinc-300 flex flex-col-reverse shadow-inner">
                            {rescrapeStatus?.logs && rescrapeStatus.logs.length > 0 ? (
                                rescrapeStatus.logs.map((log: string, idx: number) => (
                                    <div key={idx} className="whitespace-pre-wrap py-0.5 border-b border-zinc-800 last:border-0">{log}</div>
                                ))
                            ) : (
                                <div className="text-zinc-500 italic">等待日志输出...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
