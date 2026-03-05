import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

export function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      const settingsObj = data.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      setSettings(settingsObj);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`
          },
          body: JSON.stringify({ key, value })
        });
      }
      alert('设置保存成功！');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-zinc-900">系统设置</h2>
      
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 space-y-6">
        
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-4 border-b border-zinc-100 pb-2">抓取设置</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">最大并发请求数</label>
              <input
                type="number"
                value={settings.max_concurrent_requests || '1'}
                onChange={(e) => handleChange('max_concurrent_requests', e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-zinc-500 mt-1">建议：设置为 1 以避免 IP 被封禁。</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">请求延迟 (毫秒)</label>
              <input
                type="number"
                value={settings.request_delay_ms || '5000'}
                onChange={(e) => handleChange('request_delay_ms', e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-zinc-500 mt-1">请求之间的延迟时间，以防止触发频率限制。</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-4 border-b border-zinc-100 pb-2">浏览设置</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">默认每页显示条数</label>
              <select
                value={settings.items_per_page || '20'}
                onChange={(e) => handleChange('items_per_page', e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </div>
  );
}
