import React, { useState, useEffect } from 'react';
import { DatabaseBackup, Trash2, Clock, UploadCloud, RefreshCw } from 'lucide-react';

export function DatabaseBackups() {
    const [backups, setBackups] = useState<any[]>([]);
    const [schedule, setSchedule] = useState('0 3 * * *');
    const [backupLoading, setBackupLoading] = useState(false);

    const fetchBackups = async () => {
        try {
            const res = await fetch('/api/admin/backups', {
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                setBackups(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch backups:', error);
        }
    };

    const fetchSchedule = async () => {
        try {
            const res = await fetch('/api/admin/backups/schedule', {
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                setSchedule(data.schedule);
            }
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
        }
    };

    useEffect(() => {
        fetchBackups();
        fetchSchedule();
    }, []);

    const handleCreateBackup = async () => {
        if (backupLoading) return;
        setBackupLoading(true);
        try {
            const res = await fetch('/api/admin/backups', {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                alert('备份创建成功！');
                fetchBackups();
            } else {
                alert(`备份失败: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            alert('备份创建失败');
        } finally {
            setBackupLoading(false);
        }
    };

    const handleRestoreBackup = async (filename: string) => {
        if (!confirm(`警告：确定要从 ${filename} 恢复数据库吗？这将会覆盖并丢失当前未备份的所有数据更改！`)) return;
        try {
            const res = await fetch('/api/admin/backups/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ filename })
            });
            const data = await res.json();
            if (data.success) {
                alert('数据库恢复成功！');
            } else {
                alert(`恢复失败: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to restore backup:', error);
            alert('数据库恢复失败');
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!confirm(`确定要永久删除备份 ${filename} 吗？`)) return;
        try {
            const res = await fetch(`/api/admin/backups/${filename}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                fetchBackups();
            } else {
                alert(`删除失败: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to delete backup:', error);
            alert('删除备份失败');
        }
    };

    const handleUpdateSchedule = async () => {
        try {
            const res = await fetch('/api/admin/backups/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ schedule })
            });
            const data = await res.json();
            if (data.success) {
                alert('定时备份设置已更新');
            } else {
                alert(`设置失败: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to update schedule:', error);
            alert('更新定时设置失败');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900">数据库备份管理</h2>
                    <p className="text-zinc-500 mt-1">手动保存快照，或配置自动化备份防止数据丢失。</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-2">
                                {/* fallback to UploadCloud if DatabaseBackup not exported implicitly in pure lucide-react? let's stick to safe icons */}
                                <UploadCloud className="w-4 h-4 text-indigo-600" />
                                手动完整备份
                            </h3>
                            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                                创建一份包含最新所有结构与记录的完整数据库文件副本 (`standards.db`)。
                            </p>
                        </div>
                        <button
                            onClick={handleCreateBackup}
                            disabled={backupLoading}
                            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {backupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                            {backupLoading ? '正在打包备份...' : '立即创建备份快照'}
                        </button>
                    </div>

                    <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-indigo-600" />
                                自动定时任务
                            </h3>
                            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                                通过填写标准的 Linux Cron 表达式指令，使后端每天自动存储备份。(默认: <code>0 3 * * *</code>)
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={schedule}
                                onChange={(e) => setSchedule(e.target.value)}
                                placeholder="0 3 * * *"
                                className="flex-1 px-3 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono shadow-sm"
                            />
                            <button
                                onClick={handleUpdateSchedule}
                                className="px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors whitespace-nowrap shadow-sm"
                            >
                                保存设置
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-zinc-900 mb-4 mt-8 flex items-center gap-2">
                        <DatabaseBackup className="w-4 h-4 text-zinc-500" />
                        历史备份记录档案
                    </h3>

                    {backups.length === 0 ? (
                        <div className="text-sm text-zinc-500 italic bg-zinc-50 p-6 rounded-xl border border-zinc-100 flex items-center justify-center">
                            服务器磁盘中暂未找到任何备份文件。
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-zinc-200">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                                    <tr>
                                        <th className="px-5 py-3.5 font-semibold">文件名</th>
                                        <th className="px-5 py-3.5 font-semibold">档案大小</th>
                                        <th className="px-5 py-3.5 font-semibold">快照时间</th>
                                        <th className="px-5 py-3.5 font-semibold text-right">管理操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 bg-white">
                                    {backups.map((bk) => (
                                        <tr key={bk.filename} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-5 py-3 font-mono font-medium text-zinc-700">{bk.filename}</td>
                                            <td className="px-5 py-3 text-zinc-500">{(bk.size / 1024 / 1024).toFixed(2)} MB</td>
                                            <td className="px-5 py-3 text-zinc-500 tabular-nums">{new Date(bk.createdAt).toLocaleString()}</td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => handleRestoreBackup(bk.filename)}
                                                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-xs font-semibold mr-2 transition-colors"
                                                >
                                                    还原覆盖数据
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBackup(bk.filename)}
                                                    className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-xs font-semibold transition-colors flex items-center gap-1.5 inline-flex"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    删除
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
