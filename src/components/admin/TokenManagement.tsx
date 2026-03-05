import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy } from 'lucide-react';

export function TokenManagement() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [newToken, setNewToken] = useState<string | null>(null);

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/admin/tokens', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setTokens(data);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setUsers(data);
      if (data.length > 0) setUserId(data[0].id.toString());
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  useEffect(() => {
    fetchTokens();
    fetchUsers();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ user_id: userId, expires_in_days: expiresInDays })
      });
      const data = await res.json();
      setNewToken(data.token);
      fetchTokens();
    } catch (error) {
      console.error('Failed to generate token:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要撤销此令牌吗？')) return;
    try {
      await fetch(`/api/admin/tokens/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      fetchTokens();
    } catch (error) {
      console.error('Failed to delete token:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('令牌已复制到剪贴板！');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">API 令牌管理</h2>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <h3 className="text-lg font-semibold mb-4">生成新令牌</h3>
        <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="w-full sm:flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">选择用户</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.role === 'admin' ? '管理员' : '普通用户'})</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-zinc-700 mb-1">有效期 (天)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              min="1"
              className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            生成
          </button>
        </form>

        {newToken && (
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800 mb-1">新令牌生成成功！</p>
              <p className="font-mono text-emerald-900 break-all">{newToken}</p>
            </div>
            <button
              onClick={() => copyToClipboard(newToken)}
              className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors ml-4"
              title="复制到剪贴板"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 font-medium text-zinc-500">ID</th>
              <th className="px-6 py-4 font-medium text-zinc-500">用户</th>
              <th className="px-6 py-4 font-medium text-zinc-500">令牌 (部分)</th>
              <th className="px-6 py-4 font-medium text-zinc-500">创建时间</th>
              <th className="px-6 py-4 font-medium text-zinc-500">过期时间</th>
              <th className="px-6 py-4 font-medium text-zinc-500">状态</th>
              <th className="px-6 py-4 font-medium text-zinc-500 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {tokens.map((token) => {
              const isExpired = new Date(token.expires_at) < new Date();
              return (
                <tr key={token.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 text-zinc-900">{token.id}</td>
                  <td className="px-6 py-4 font-medium text-zinc-900">{token.username}</td>
                  <td className="px-6 py-4 font-mono text-zinc-500">
                    {token.token.substring(0, 8)}...{token.token.substring(token.token.length - 8)}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">{new Date(token.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-zinc-500">{new Date(token.expires_at).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isExpired ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isExpired ? '已过期' : '活跃'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(token.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="撤销令牌"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
