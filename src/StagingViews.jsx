import { useState, useEffect } from 'react';
import { Mail, Send, Loader2, CheckCircle, FileText, Database, X, Download, Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export const EmailPromptModal = ({ isOpen, onClose, onSubmit, isExporting }) => {
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
        <div className="flex justify-center mb-4 text-blue-600 bg-blue-50 w-12 h-12 rounded-full items-center mx-auto">
          <Mail size={24} />
        </div>
        <h2 className="text-xl font-bold text-center text-slate-800 mb-2">ระบุอีเมลผู้ขอนำเข้าข้อมูล</h2>
        <p className="text-sm text-center text-slate-600 mb-6">
          โปรดระบุอีเมลของคุณเพื่อใช้ในการติดตามผลการนำเข้าข้อมูลผ่านเมนู "สถานะการนำเข้า"
        </p>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(email); }}>
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">อีเมล (Email)</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="example@nstda.or.th"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[11px] text-amber-600 font-semibold mt-2">
              * กรุณาตรวจสอบอีเมลให้ถูกต้อง หากพิมพ์ผิดจะไม่สามารถเข้าดูประวัติการนำเข้าได้
            </p>
          </div>
          <button
            type="submit"
            disabled={isExporting || !email}
            className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {isExporting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลเพื่อรออนุมัติ'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const SubmissionsView = ({ apiKey, initialEmail = '' }) => {
  const [email, setEmail] = useState(initialEmail);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const searchEmail = email || initialEmail;
    if (!searchEmail) return;
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/jobs?email=${encodeURIComponent(searchEmail)}`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data || []);
      setHasSearched(true);
    } catch (err) {
      toast.error('ไม่สามารถดึงข้อมูลสถานะได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialEmail && !hasSearched) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail]);

  // Auto refresh if any job is processing
  useEffect(() => {
    let intervalId;
    if (hasSearched && jobs.some(j => j.status === 'processing')) {
      intervalId = setInterval(() => {
        handleSearch();
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, hasSearched]);

  const handleDownloadResults = async (jobId) => {
    const loadingToast = toast.loading('กำลังดาวน์โหลดข้อมูล...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/payload/${jobId}`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to download results');
      const data = await res.json();
      
      if (!data.nodes || data.nodes.length === 0) {
        throw new Error('ไม่พบข้อมูลหน่วยงานใน Job นี้');
      }

      const exportData = data.nodes.map(n => ({
        'ชื่อหน่วยงาน': n.name,
        'ID ฐานข้อมูล': n.generated_db_id || 'N/A',
        'Staff Entry Code': n.staff_entry_code || 'N/A'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Result");
      XLSX.writeFile(wb, `import_result_${jobId}.xlsx`);
      toast.success('ดาวน์โหลดสำเร็จ', { id: loadingToast });
    } catch (err) {
      toast.error('ดาวน์โหลดล้มเหลว: ' + err.message, { id: loadingToast });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_approval':
        return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">รออนุมัติ</span>;
      case 'processing':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">กำลังประมวลผล</span>;
      case 'completed':
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">สำเร็จ</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">ถูกปฏิเสธ</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-600" /> สถานะการนำเข้าของฉัน
          </h2>
          <p className="text-sm text-slate-500 mt-1">ใส่อีเมลที่คุณใช้ยื่นขอนำเข้าข้อมูลเพื่อตรวจสอบสถานะ</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-initial">
            <input
              type="email"
              required
              placeholder="ใส่อีเมลของคุณ..."
              className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-[200px]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'ค้นหา'}
            </button>
          </form>
          {hasSearched && (
            <button 
              type="button"
              onClick={() => handleSearch()} 
              disabled={isLoading}
              className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center shrink-0"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={20} className={isLoading ? "animate-spin text-blue-600" : ""} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!hasSearched ? (
          <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3">
            <Search size={48} className="text-slate-300" />
            <p>กรุณากรอกอีเมลและกดค้นหา</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3">
            <Database size={48} className="text-slate-300" />
            <p>ไม่พบประวัติการขอนำเข้าด้วยอีเมลนี้</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map(job => (
              <div key={job.id} className="border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-bold text-slate-700 flex items-center gap-2">
                      {job.id}
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(job.id);
                          toast.success('คัดลอก Job ID แล้ว');
                        }}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title="Copy Job ID"
                      >
                        <Copy size={14} />
                      </button>
                    </span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="text-sm text-slate-600 mb-1">
                    <span className="font-semibold text-slate-700">จำนวนข้อมูล:</span> <span className="font-bold text-blue-600">{job.total_items}</span> หน่วยงาน
                  </div>
                  <div className="text-xs text-slate-400">
                    อัปเดตล่าสุด: {new Date(job.updated_at).toLocaleString('th-TH')}
                  </div>
                </div>
                
                <div className="w-full md:w-auto min-w-[200px] flex flex-col gap-2">
                  {job.status === 'rejected' && job.admin_comment && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                      <span className="font-bold text-red-800">เหตุผลที่ปฏิเสธ:</span>
                      <p className="text-red-700 mt-1">{job.admin_comment}</p>
                    </div>
                  )}
                  
                  {job.status === 'completed' && (
                    <button 
                      onClick={() => handleDownloadResults(job.id)}
                      className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg text-sm font-bold transition-colors"
                    >
                      <Download size={16} /> ดาวน์โหลดผลลัพธ์
                    </button>
                  )}

                  {job.status === 'processing' && (
                    <div className="w-full">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500 font-bold">ดำเนินการแล้ว</span>
                        <span className="text-blue-600 font-bold">{job.processed_items} / {job.total_items}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
                          style={{ width: `${Math.max(2, (job.processed_items / job.total_items) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminView = ({ adminKey }) => {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingJobId, setRejectingJobId] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  
  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/jobs`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (res.status === 401) {
        toast.error('Admin Key ไม่ถูกต้อง');
        setJobs([]);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data || []);
    } catch (err) {
      toast.error('ไม่สามารถดึงข้อมูลได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (adminKey) fetchJobs();
  }, [adminKey]);

  const handleApprove = async (jobId) => {
    if (!confirm('ยืนยันการอนุมัติการนำเข้าข้อมูลนี้? ระบบจะเริ่มประมวลผลทันที')) return;
    
    const loadingToast = toast.loading('กำลังอนุมัติ...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/${jobId}/approve`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey }
      });
      if (!res.ok) throw new Error('Approve failed');
      toast.success('อนุมัติสำเร็จ', { id: loadingToast });
      fetchJobs();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message, { id: loadingToast });
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectComment) return;
    
    const loadingToast = toast.loading('กำลังปฏิเสธ...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/${rejectingJobId}/reject`, {
        method: 'POST',
        headers: { 
          'X-Admin-Key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment: rejectComment })
      });
      if (!res.ok) throw new Error('Reject failed');
      toast.success('ปฏิเสธสำเร็จ', { id: loadingToast });
      setRejectingJobId(null);
      setRejectComment('');
      fetchJobs();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message, { id: loadingToast });
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="text-green-600" /> Admin Dashboard (รออนุมัติ)
          </h2>
          <p className="text-sm text-slate-500 mt-1">รายการขอนำเข้าข้อมูลที่รอการตรวจสอบและอนุมัติจากผู้ดูแลระบบ</p>
        </div>
        <button onClick={fetchJobs} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50">
          รีเฟรชข้อมูล
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3">
            <CheckCircle size={48} className="text-slate-300" />
            <p>ไม่มีรายการรออนุมัติ</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map(job => (
              <div key={job.id} className="border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm font-bold text-slate-700">{job.id}</span>
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[10px] font-bold">รออนุมัติ</span>
                  </div>
                  <div className="text-sm text-slate-600 mb-1">
                    <span className="font-semibold text-slate-700">ผู้ขอ:</span> {job.requester_email}
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">จำนวนข้อมูล:</span> {job.total_items} หน่วยงาน
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    เวลาที่ขอ: {new Date(job.created_at).toLocaleString('th-TH')}
                  </div>
                </div>
                
                {rejectingJobId === job.id ? (
                  <form onSubmit={handleReject} className="w-full md:w-auto flex flex-col gap-2 min-w-[300px]">
                    <textarea
                      required
                      placeholder="ระบุเหตุผลที่ปฏิเสธ..."
                      className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-1 focus:ring-red-500 text-sm"
                      rows={2}
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                    ></textarea>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setRejectingJobId(null)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
                      <button type="submit" className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">ยืนยันปฏิเสธ</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => setRejectingJobId(job.id)}
                      className="flex-1 md:flex-none px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg transition-colors text-sm"
                    >
                      ปฏิเสธ
                    </button>
                    <button 
                      onClick={() => handleApprove(job.id)}
                      className="flex-1 md:flex-none px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors text-sm shadow-sm"
                    >
                      อนุมัติ (ดำเนินการ)
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Simple search icon component since it wasn't imported from lucide-react in this file
const Search = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
