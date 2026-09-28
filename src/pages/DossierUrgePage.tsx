import React, { useState, useEffect } from 'react';
import {
  FileText,
  BarChart3,
  ListFilter,
  PlusCircle,
  PhoneCall,
  UserCheck,
  Flame,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { UrgeEntryForm } from '../components/dossierUrge/UrgeEntryForm';
import { UrgeTable } from '../components/dossierUrge/UrgeTable';
import { UrgeAnalytics } from '../components/dossierUrge/UrgeAnalytics';
import { UrgeDetailModal } from '../components/dossierUrge/UrgeDetailModal';
import { UrgePrintModal } from '../components/dossierUrge/UrgePrintModal';
import { dossierUrgeStore } from '../services/dossierUrgeStore';
import { DossierUrgeRecord, UrgeFilterCriteria } from '../types/dossierUrge';

export const DossierUrgePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entry' | 'list' | 'analytics'>('entry');
  const [urges, setUrges] = useState<DossierUrgeRecord[]>([]);

  // Modal states
  const [detailRecord, setDetailRecord] = useState<DossierUrgeRecord | null>(null);
  const [printRecord, setPrintRecord] = useState<DossierUrgeRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<DossierUrgeRecord | null>(null);

  const handleEditRecord = (record: DossierUrgeRecord) => {
    setEditingRecord(record);
    setActiveTab('entry');
  };

  // Criteria filter state
  const [criteria, setCriteria] = useState<Partial<UrgeFilterCriteria>>({
    searchQuery: '',
    timeRange: 'all',
    channel: 'all',
    assignedUnit: 'all',
    processorName: 'all',
    urgeFrequency: 'all',
    status: 'all',
  });

  const reloadData = () => {
    setUrges(dossierUrgeStore.getUrges(criteria));
  };

  useEffect(() => {
    reloadData();
    return dossierUrgeStore.subscribe(reloadData);
  }, [criteria]);

  // KPI count
  const allUrges = dossierUrgeStore.getUrges();
  const kpi = dossierUrgeStore.getKPIStats(allUrges);

  const handleEntrySuccess = (dossierCode: string) => {
    // Chuyển sang tab Danh sách và lọc mã hồ sơ vừa tạo
    setCriteria((prev) => ({
      ...prev,
      searchQuery: dossierCode,
    }));
    setActiveTab('list');
  };

  const handleSelectDossierFromAnalytics = (dossierCode: string) => {
    setCriteria((prev) => ({
      ...prev,
      searchQuery: dossierCode,
    }));
    setActiveTab('list');
  };

  const handlePrintDossier = (record: DossierUrgeRecord) => {
    setPrintRecord(record);
  };

  const handleResetDemo = () => {
    if (confirm('Khôi phục dữ liệu mẫu thực tế về tình hình đôn đốc hồ sơ?')) {
      dossierUrgeStore.resetSampleData();
      reloadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Quản lý & Đôn đốc hồ sơ TTHC
            </h1>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setActiveTab('entry');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'entry'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Soạn đôn đốc
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setActiveTab('list');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Sổ theo dõi ({allUrges.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setActiveTab('analytics');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Tổng hợp số liệu
              {kpi.multipleUrgeDossiers > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'entry' && (
        <UrgeEntryForm
          onSuccess={handleEntrySuccess}
          initialRecord={editingRecord}
          onCancelEdit={() => setEditingRecord(null)}
        />
      )}

      {activeTab === 'list' && (
        <UrgeTable
          urges={urges}
          onViewDetail={(r) => setDetailRecord(r)}
          onPrint={(r) => setPrintRecord(r)}
          onDelete={(id) => dossierUrgeStore.deleteUrge(id)}
          onEdit={handleEditRecord}
          criteria={criteria}
          onCriteriaChange={(next) => setCriteria((prev) => ({ ...prev, ...next }))}
        />
      )}

      {activeTab === 'analytics' && (
        <UrgeAnalytics
          filteredUrges={urges}
          onSelectDossier={handleSelectDossierFromAnalytics}
          onPrintDossier={handlePrintDossier}
        />
      )}

      {/* Modal Xem chi tiết & Lịch sử & Cập nhật phản hồi */}
      {detailRecord && (
        <UrgeDetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onPrint={(r) => {
            setDetailRecord(null);
            setPrintRecord(r);
          }}
          onRecordUpdated={() => {
            reloadData();
            // Cập nhật lại detailRecord từ store nếu vẫn mở
            const fresh = dossierUrgeStore.getUrgeById(detailRecord.id);
            if (fresh) setDetailRecord(fresh);
          }}
        />
      )}

      {/* Modal In & Xuất PDF Phiếu đôn đốc chuẩn hành chính */}
      {printRecord && (
        <UrgePrintModal
          record={printRecord}
          history={dossierUrgeStore.getDossierUrgeHistory(printRecord.dossier_code)}
          onClose={() => setPrintRecord(null)}
        />
      )}
    </div>
  );
};
