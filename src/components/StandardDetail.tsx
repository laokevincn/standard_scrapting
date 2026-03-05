import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, FileText, Info, Building2, Calendar, Tag } from 'lucide-react';

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
  updated_at?: string;
}

export function StandardDetail() {
  const { id } = useParams<{ id: string }>();
  const [standard, setStandard] = useState<Standard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStandard = async () => {
      try {
        const res = await fetch(`/api/standards/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('未找到该标准');
          }
          throw new Error('获取标准详情失败');
        }
        const data = await res.json();
        setStandard(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStandard();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p>正在加载标准详情...</p>
      </div>
    );
  }

  if (error || !standard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 gap-4">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <Info className="w-8 h-8" />
        </div>
        <p className="text-lg font-medium text-zinc-900">{error || '未找到该标准'}</p>
        <Link 
          to="/"
          className="px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors font-medium flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回搜索页
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <Link 
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回搜索结果
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                  standard.status?.includes('现行') || standard.status?.includes('Active') 
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20' 
                    : standard.status?.includes('作废')
                    ? 'bg-red-100 text-red-800 ring-1 ring-red-600/20'
                    : 'bg-zinc-200 text-zinc-800 ring-1 ring-zinc-500/20'
                }`}>
                  {standard.status || '未知状态'}
                </span>
                <span className="text-sm font-mono text-zinc-500 bg-white px-2 py-1 rounded border border-zinc-200">
                  {standard.std_num}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 leading-tight">
                {standard.title}
              </h1>
            </div>
            
            <div className="flex flex-wrap gap-2 shrink-0">
              {standard.url_csres && (
                <a 
                  href={standard.url_csres} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  工标网
                </a>
              )}
              {standard.url_samr && (
                <a 
                  href={standard.url_samr} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors border border-red-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  国家公开网
                </a>
              )}
              {!standard.url_csres && !standard.url_samr && standard.url && (
                <a 
                  href={standard.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors border border-zinc-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  查看原文
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Basic Info */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                基本信息
              </h3>
              <dl className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">标准号</dt>
                  <dd className="col-span-2 text-zinc-900 font-mono">{standard.std_num}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">标准名称</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.title}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">标准状态</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.status || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">标准类别</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.standard_category || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">全部代替标准</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.replace_standard || '-'}</dd>
                </div>
              </dl>
            </div>

            {/* Dates & Classification */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                日期与分类
              </h3>
              <dl className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">发布日期</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.publish_date || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">实施日期</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.implement_date || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">中国标准分类号</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.ccs_code || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-zinc-500 font-medium">国际标准分类号</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.ics_code || '-'}</dd>
                </div>
              </dl>
            </div>

            {/* Organization Info */}
            <div className="space-y-6 md:col-span-2">
              <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                组织单位
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div className="grid grid-cols-3 gap-4 sm:col-span-2">
                  <dt className="text-zinc-500 font-medium">发布部门</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.department || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4 sm:col-span-2">
                  <dt className="text-zinc-500 font-medium">主管部门</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.competent_department || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4 sm:col-span-2">
                  <dt className="text-zinc-500 font-medium">归口单位</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.competent_department || '-'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4 sm:col-span-2">
                  <dt className="text-zinc-500 font-medium">执行单位</dt>
                  <dd className="col-span-2 text-zinc-900">{standard.execution_unit || '-'}</dd>
                </div>
              </dl>
            </div>

          </div>
        </div>
        
        {standard.updated_at && (
          <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 text-xs text-zinc-400 text-right">
            最后更新于: {new Date(standard.updated_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
