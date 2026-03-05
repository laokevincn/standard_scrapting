/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, Outlet } from 'react-router-dom';
import { StandardTable } from './components/StandardTable';
import { StandardDetail } from './components/StandardDetail';
import { BookOpen, ShieldAlert } from 'lucide-react';
import { Login } from './components/admin/Login';
import { AdminLayout } from './components/admin/AdminLayout';
import { Dashboard } from './components/admin/Dashboard';
import { UserManagement } from './components/admin/UserManagement';
import { Settings } from './components/admin/Settings';
import { TokenManagement } from './components/admin/TokenManagement';
import { DatabaseManagement } from './components/admin/DatabaseManagement';

function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">标准信息查询系统</h1>
          </Link>
          <Link to="/admin" className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-indigo-600 transition-colors">
            <ShieldAlert className="w-4 h-4" />
            管理后台
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1 flex flex-col w-full">
        <div className="flex-1 flex flex-col min-h-[85vh] sm:min-h-[calc(100vh-8rem)]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<StandardTable />} />
          <Route path="standard/:id" element={<StandardDetail />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="tokens" element={<TokenManagement />} />
          <Route path="database" element={<DatabaseManagement />} />
        </Route>
      </Routes>
    </Router>
  );
}

