import React, { useState, useEffect } from 'react';
import { Database, Users, Key, Activity } from 'lucide-react';

export function Dashboard() {
  const [stats, setStats] = useState({
    totalStandards: 0,
    totalUsers: 0,
    activeTokens: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, tokensRes, standardsRes] = await Promise.all([
          fetch('/api/admin/users', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }),
          fetch('/api/admin/tokens', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }),
          fetch('/api/standards?limit=1')
        ]);
        
        const users = await usersRes.json();
        const tokens = await tokensRes.json();
        const standards = await standardsRes.json();

        setStats({
          totalUsers: users.length || 0,
          activeTokens: tokens.filter((t: any) => new Date(t.expires_at) > new Date()).length || 0,
          totalStandards: standards.pagination?.total || 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: '标准总数', value: stats.totalStandards, icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: '注册用户', value: stats.totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: '活跃 API 令牌', value: stats.activeTokens, icon: Key, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">控制台概览</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">{stat.title}</p>
                <p className="text-2xl font-bold text-zinc-900">{stat.value.toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          系统状态
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <div>
              <p className="font-medium text-zinc-900">后台抓取程序</p>
              <p className="text-sm text-zinc-500">自动获取新标准的详细信息</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              运行中
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <div>
              <p className="font-medium text-zinc-900">每日同步任务</p>
              <p className="text-sm text-zinc-500">计划每天凌晨 2:00 运行</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              已计划
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
