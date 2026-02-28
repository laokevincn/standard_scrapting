/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StandardTable } from './components/StandardTable';
import { BookOpen } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">标准信息查询系统</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1 flex flex-col w-full">
        <div className="flex-1 flex flex-col min-h-[85vh] sm:min-h-[calc(100vh-8rem)]">
          <StandardTable />
        </div>
      </main>
    </div>
  );
}

