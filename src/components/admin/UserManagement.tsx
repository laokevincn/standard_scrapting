import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/admin/users/${editingId}` : '/api/admin/users';
    
    try {
      await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ username, password, role })
      });
      setUsername('');
      setPassword('');
      setRole('user');
      setEditingId(null);
      fetchUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此用户吗？')) return;
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setUsername(user.username);
    setRole(user.role);
    setPassword('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">用户管理</h2>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <h3 className="text-lg font-semibold mb-4">{editingId ? '编辑用户' : '添加新用户'}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="w-full sm:flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!!editingId}
              className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div className="w-full sm:flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              密码 {editingId && '(留空保持不变)'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              required={!editingId}
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-zinc-700 mb-1">角色</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="submit"
              className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? '更新' : '添加'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setUsername('');
                  setPassword('');
                  setRole('user');
                }}
                className="flex-1 sm:flex-none px-6 py-2 bg-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-300 transition-colors font-medium"
              >
                取消
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 font-medium text-zinc-500">ID</th>
              <th className="px-6 py-4 font-medium text-zinc-500">用户名</th>
              <th className="px-6 py-4 font-medium text-zinc-500">角色</th>
              <th className="px-6 py-4 font-medium text-zinc-500">创建时间</th>
              <th className="px-6 py-4 font-medium text-zinc-500 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 text-zinc-900">{user.id}</td>
                <td className="px-6 py-4 font-medium text-zinc-900">{user.username}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-zinc-100 text-zinc-800'
                  }`}>
                    {user.role === 'admin' ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">{new Date(user.created_at).toLocaleString()}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(user)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
