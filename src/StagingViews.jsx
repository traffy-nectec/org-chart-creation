import { useState, useEffect } from 'react';
import { Mail, Send, Loader2, CheckCircle, FileText, Database, X, Download, Copy, RefreshCw, ChevronDown, ChevronRight, Info, AlertTriangle, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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

const downloadResultsFile = async (jobId, key, isAllCodes, isApiKey) => {
  const loadingToast = toast.loading('กำลังดาวน์โหลดข้อมูล...');
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const headers = isApiKey ? { 'X-API-Key': key } : { 'X-Admin-Key': key };
    const res = await fetch(`${apiUrl}/api/import/payload/${jobId}`, { headers });
    if (!res.ok) throw new Error('Failed to download results');
    const data = await res.json();
    
    if (!data.nodes || data.nodes.length === 0) {
      throw new Error('ไม่พบข้อมูลหน่วยงานใน Job นี้');
    }

    let exportData;
    if (isAllCodes) {
      exportData = data.nodes.map(n => ({
        'ชื่อหน่วยงาน': n.name,
        'ID ฐานข้อมูล': n.generated_db_id || 'N/A',
        'Staff Entry Code': n.staff_entry_code || 'N/A',
        'Admin Entry Code': n.admin_entry_code || 'N/A'
      }));
    } else {
      exportData = data.nodes.map(n => ({
        'ชื่อหน่วยงาน': n.name,
        'ID ฐานข้อมูล': n.generated_db_id || 'N/A',
        'Staff Entry Code': n.staff_entry_code || 'N/A'
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isAllCodes ? "Codes" : "Result");
    XLSX.writeFile(wb, isAllCodes ? `import_codes_${jobId}.xlsx` : `import_result_${jobId}.xlsx`);
    toast.success('ดาวน์โหลดสำเร็จ', { id: loadingToast });
  } catch (err) {
    toast.error('ดาวน์โหลดล้มเหลว: ' + err.message, { id: loadingToast });
  }
};

export const RequesterDetailsModal = ({ isOpen, onClose, onSubmit, isExporting, initialEmail = '' }) => {
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('requester_email') || initialEmail;
  });
  const [name, setName] = useState(() => {
    return localStorage.getItem('requester_name') || '';
  });
  const [tel, setTel] = useState(() => {
    return localStorage.getItem('requester_tel') || '';
  });
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative overflow-hidden">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
        <div className="flex justify-center mb-4 text-blue-600 bg-blue-50 w-12 h-12 rounded-full items-center mx-auto">
          <Mail size={24} />
        </div>
        <h2 className="text-xl font-bold text-center text-slate-800 mb-2">ระบุข้อมูลผู้ขอนำเข้าข้อมูล</h2>
        <p className="text-xs text-center text-slate-500 mb-6">
          โปรดระบุรายละเอียดผู้ติดต่อและรายละเอียด เพื่อประกอบการอนุมัติการนำเข้าข้อมูล
        </p>
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          localStorage.setItem('requester_email', email);
          localStorage.setItem('requester_name', name);
          localStorage.setItem('requester_tel', tel);
          onSubmit({ email, name, tel, note }); 
        }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">อีเมลผู้ขอนำเข้า (Email) *</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="example@nstda.or.th"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[10px] text-amber-600 font-semibold mt-1">
              * กรุณาตรวจสอบอีเมลให้ถูกต้อง หากพิมพ์ผิดจะไม่สามารถเข้าดูประวัติการนำเข้าได้
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อ-นามสกุล *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="สมชาย รักดี"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อกลับ *</label>
              <input
                type="tel"
                required
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="081-234-5678"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุ / คำอธิบายการนำเข้า</label>
            <textarea
              className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ระบุวัตถุประสงค์ของการนำเข้า หรือหน่วยงานต้นสังกัด..."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isExporting || !email || !name || !tel}
            className="w-full mt-2 bg-blue-600 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
          >
            {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {isExporting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลเพื่อรออนุมัติ'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const SubmissionsView = ({ apiKey, initialEmail = '', onRestoreJob }) => {
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

  const handleDownloadResults = (jobId) => downloadResultsFile(jobId, apiKey, false, true);
  const handleDownloadAllCodes = (jobId) => downloadResultsFile(jobId, apiKey, true, true);

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
                  {job.status === 'rejected' && (
                    <div className="flex flex-col gap-2">
                      {job.admin_comment && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                          <span className="font-bold text-red-800">เหตุผลที่ปฏิเสธ:</span>
                          <p className="text-red-700 mt-1">{job.admin_comment}</p>
                        </div>
                      )}
                      {onRestoreJob && (
                        <button
                          type="button"
                          onClick={() => onRestoreJob(job.id)}
                          className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors shadow-sm"
                        >
                          <Edit size={16} /> ดึงข้อมูลกลับมาแก้ไข
                        </button>
                      )}
                    </div>
                  )}
                  
                  {job.status === 'completed' && (
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleDownloadResults(job.id)}
                        className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg text-sm font-bold transition-colors"
                      >
                        <Download size={16} /> ดาวน์โหลดผลลัพธ์
                      </button>
                      <button 
                        onClick={() => handleDownloadAllCodes(job.id)}
                        className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors"
                      >
                        <Download size={16} /> ดาวน์โหลดรหัส Staff & Admin (Entry Codes)
                      </button>
                    </div>
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

                  {job.status === 'error' && (
                    <div className="flex flex-col gap-2">
                      {job.error_message && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                          <span className="font-bold text-red-800">เกิดข้อผิดพลาด:</span>
                          <p className="text-red-700 mt-1 text-xs font-mono">{job.error_message}</p>
                        </div>
                      )}
                      {onRestoreJob && (
                        <button
                          type="button"
                          onClick={() => onRestoreJob(job.id)}
                          className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors shadow-sm"
                        >
                          <Edit size={16} /> ดึงข้อมูลกลับมาแก้ไข
                        </button>
                      )}
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

  const [activeJobPayload, setActiveJobPayload] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const handleViewDetails = async (jobId) => {
    setDetailsLoading(true);
    const loadingToast = toast.loading('กำลังโหลดโครงสร้างข้อมูล...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/payload/${jobId}`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (!res.ok) throw new Error('Failed to fetch job payload');
      const data = await res.json();
      setActiveJobPayload(data);
      setIsDetailsModalOpen(true);
      toast.success('โหลดข้อมูลสำเร็จ', { id: loadingToast });
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูลรายละเอียดได้: ' + err.message, { id: loadingToast });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDownloadResults = (jobId) => downloadResultsFile(jobId, adminKey, false, false);
  const handleDownloadAllCodes = (jobId) => downloadResultsFile(jobId, adminKey, true, false);
  
  const fetchJobs = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/jobs`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (res.status === 401) {
        if (!silent) toast.error('Admin Key ไม่ถูกต้อง');
        setJobs([]);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data || []);
    } catch (err) {
      if (!silent) toast.error('ไม่สามารถดึงข้อมูลได้: ' + err.message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) {
      // Defer execution to avoid calling state updates synchronously in effect
      const timeout = setTimeout(() => {
        fetchJobs(false);
      }, 0);
      
      // Auto refresh the admin board silently every 15 seconds
      const timer = setInterval(() => {
        fetchJobs(true);
      }, 15000);
      
      return () => {
        clearTimeout(timeout);
        clearInterval(timer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const handleApprove = async (jobId) => {
    if (!confirm('ยืนยันการอนุมัติการนำเข้าข้อมูลนี้? ระบบจะเริ่มประมวลผลทันที')) return;
    
    const tag = prompt('กรอก Tag สำหรับบันทึกลงในโครงสร้างสายงาน (เช่น ชื่องาน หรือหน่วยงานระดับบน) หรือเว้นว่างไว้:');
    if (tag === null) return; // User cancelled the prompt
    
    const loadingToast = toast.loading('กำลังอนุมัติ...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/${jobId}/approve`, {
        method: 'POST',
        headers: { 
          'X-Admin-Key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tag: tag.trim() })
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
            <CheckCircle className="text-green-600" /> Admin Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">ประวัติการตรวจสอบ อนุมัติ และสถานะการนำเข้าข้อมูลทั้งหมดในระบบ</p>
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
            <p>ไม่มีประวัติรายการขอนำเข้าในระบบ</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map(job => (
              <div key={job.id} className="border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-start justify-between shadow-sm hover:shadow-md transition-shadow">
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-700 flex items-center gap-2">
                      {job.id}
                      <button 
                        type="button"
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
                  
                  <div className="text-sm text-slate-600 flex flex-col gap-1">
                    <div>
                      <span className="font-semibold text-slate-700">ผู้ขอนำเข้า:</span>{' '}
                      {job.requester_name ? (
                        <span className="text-slate-800 font-bold">
                          {job.requester_name} ({job.requester_email})
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold">{job.requester_email}</span>
                      )}
                      {job.requester_tel && (
                        <span className="text-xs text-slate-500 ml-2">
                          | 📞 เบอร์ติดต่อ: <span className="font-semibold text-slate-700">{job.requester_tel}</span>
                        </span>
                      )}
                    </div>
                    {job.requester_note && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic mt-1 max-w-2xl">
                        <span className="font-bold text-slate-600 not-italic">รายละเอียด/หมายเหตุ:</span> "{job.requester_note}"
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">จำนวนข้อมูล:</span>{' '}
                    <span className="font-bold text-blue-600">{job.total_items}</span> หน่วยงาน
                    {job.level_distribution && Object.keys(job.level_distribution).length > 0 && (
                      <span className="text-xs text-slate-500 ml-2">
                        (แยกตามระดับชั้น &rarr;{' '}
                        {Object.entries(job.level_distribution)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([lvl, count]) => `ระดับ ${lvl}: ${count} แห่ง`)
                          .join(', ')}
                        )
                      </span>
                    )}
                  </div>

                  {/* Pre-validation warnings and errors */}
                  {(job.warnings_count > 0 || job.errors_count > 0) && (
                    <div className="flex gap-3 text-xs items-center flex-wrap">
                      <span className="font-semibold text-slate-700">ผลการตรวจจับฝั่ง Client:</span>
                      {job.errors_count > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-bold">
                          <AlertTriangle size={12} /> พบข้อผิดพลาด {job.errors_count} จุด
                        </span>
                      )}
                      {job.warnings_count > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold">
                          <Info size={12} /> พบข้อสังเกต {job.warnings_count} จุด
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-slate-400">
                    เวลาที่ขอ: {new Date(job.created_at).toLocaleString('th-TH')}
                  </div>
                </div>

                <div className="w-full md:w-auto min-w-[240px] flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewDetails(job.id)}
                    disabled={detailsLoading}
                    className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-700 transition-colors shadow-sm"
                  >
                    <FileText size={16} /> ดูข้อมูล / ผังสายงาน
                  </button>

                  {job.status === 'rejected' && job.admin_comment && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                      <span className="font-bold text-red-800">เหตุผลที่ปฏิเสธ:</span>
                      <p className="text-red-700 mt-1">{job.admin_comment}</p>
                    </div>
                  )}

                  {job.status === 'pending_approval' && (
                    rejectingJobId === job.id ? (
                      <form onSubmit={handleReject} className="w-full flex flex-col gap-2">
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
                      <div className="flex gap-2 w-full justify-end">
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
                    )
                  )}

                  {job.status === 'completed' && (
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleDownloadResults(job.id)}
                        className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg text-sm font-bold transition-colors"
                      >
                        <Download size={16} /> ดาวน์โหลดผลลัพธ์
                      </button>
                      <button 
                        onClick={() => handleDownloadAllCodes(job.id)}
                        className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors"
                      >
                        <Download size={16} /> ดาวน์โหลดรหัส Staff & Admin (Entry Codes)
                      </button>
                    </div>
                  )}

                  {job.status === 'processing' && (
                    <div className="w-full">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500 font-bold">ดำเนินการแล้ว</span>
                        <span className="text-blue-600 font-bold">{job.processed_items} / {job.total_items}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.round((job.processed_items / job.total_items) * 100))}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 text-right animate-pulse">
                        กำลังเขียนฐานข้อมูลขนานทีละ Level...
                      </div>
                    </div>
                  )}

                  {job.status === 'error' && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                      <span className="font-bold text-red-800">เกิดข้อผิดพลาด:</span>
                      <p className="text-red-700 mt-1 text-xs font-mono">{job.error_message}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <JobDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        payload={activeJobPayload}
      />
    </div>
  );
};

const TreeNode = ({ node, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="pl-4 border-l border-slate-200 my-1">
      <div className="flex items-center gap-2 py-1 px-2 hover:bg-slate-50 rounded-lg group transition-colors flex-wrap">
        {hasChildren ? (
          <button 
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5 h-3.5 inline-block" />
        )}
        
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
          node.level === 0 ? 'bg-purple-100 text-purple-700' :
          node.level === 1 ? 'bg-blue-100 text-blue-700' :
          node.level === 2 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700'
        }`}>L{node.level}</span>

        <span className="text-sm font-semibold text-slate-800">{node.name}</span>

        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
          node.action === 'CREATE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {node.action === 'CREATE' ? 'สร้างใหม่' : `เชื่อมต่อ ID: ${node.existing_db_id}`}
        </span>

        {node.details?.tel && (
          <span className="text-xs text-slate-400 hidden group-hover:inline">📞 {node.details.tel}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-2">
          {node.children.map(child => (
            <TreeNode key={child.temp_id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const JobDetailsModal = ({ isOpen, onClose, payload }) => {
  const [activeTab, setActiveTab] = useState('table');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  if (!isOpen || !payload) return null;

  const nodes = payload.nodes || [];
  
  // Calculate levels
  const levelMap = new Map();
  nodes.forEach(n => {
    if (!n.parent_temp_id) {
      levelMap.set(n.temp_id, 0);
    } else {
      const parentLvl = levelMap.get(n.parent_temp_id);
      levelMap.set(n.temp_id, (parentLvl !== undefined ? parentLvl : 0) + 1);
    }
  });

  const nodesWithLevels = nodes.map(n => ({
    ...n,
    level: levelMap.get(n.temp_id) || 0
  }));

  // Build tree
  const buildTree = () => {
    const idMap = new Map();
    const roots = [];

    nodesWithLevels.forEach(n => {
      idMap.set(n.temp_id, { ...n, children: [] });
    });

    nodesWithLevels.forEach(n => {
      const mapped = idMap.get(n.temp_id);
      if (!n.parent_temp_id || !idMap.has(n.parent_temp_id)) {
        roots.push(mapped);
      } else {
        idMap.get(n.parent_temp_id).children.push(mapped);
      }
    });

    return roots;
  };

  const treeData = buildTree();

  // Filter for table
  const filteredNodes = nodesWithLevels.filter(n => 
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    (n.temp_id && n.temp_id.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredNodes.length / itemsPerPage);
  const paginatedNodes = filteredNodes.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getNodeNameById = (id) => {
    const found = nodes.find(n => n.temp_id === id);
    return found ? found.name : id;
  };

  const handleDownloadDraft = () => {
    try {
      const exportData = nodesWithLevels.map(n => ({
        'ชื่อหน่วยงาน': n.name,
        'Temp ID': n.temp_id,
        'ระดับชั้น': `ระดับ ${n.level}`,
        'ประเภทการทำงาน': n.action === 'CREATE' ? 'สร้างใหม่' : 'เชื่อมต่อหน่วยงานเดิม',
        'ID หน่วยงานเดิมที่เชื่อมต่อ': n.existing_db_id || 'N/A',
        'Temp ID หน่วยงานต้นสังกัด': n.parent_temp_id || 'ไม่มี (โหนดราก)',
        'ชื่อหน่วยงานต้นสังกัด': n.parent_temp_id ? getNodeNameById(n.parent_temp_id) : 'ไม่มี (โหนดราก)',
        'รหัสพื้นที่ (DOPA)': n.subdistrict_code || n.area_code || 'N/A'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Draft Nodes");
      const filename = `import_draft_${payload.job_id || payload.id || 'payload'}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('ดาวน์โหลดไฟล์แบบร่าง (.xlsx) สำเร็จ');
    } catch (err) {
      toast.error('ดาวน์โหลดล้มเหลว: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">รายละเอียดโครงสร้างข้อมูลนำเข้า</h2>
            <p className="text-xs text-slate-500 mt-1">
              จำนวนทั้งหมด: <span className="font-bold text-blue-600">{nodes.length}</span> หน่วยงาน | สรุปประมวลผลก่อนนำเข้าจริง
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadDraft}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors font-bold text-xs cursor-pointer"
            >
              <Download size={14} /> ดาวน์โหลดแบบร่างผัง (.xlsx)
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="px-6 border-b border-slate-100 flex gap-4 shrink-0 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('table')}
            className={`py-3 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'table' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ตารางข้อมูลหน่วยงาน ({filteredNodes.length})
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className={`py-3 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'tree' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ผังโครงสร้างสายงาน
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 min-h-0 bg-white">
          {activeTab === 'table' ? (
            <div className="flex flex-col h-full gap-4">
              
              {/* Search bar */}
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหน่วยงาน หรือ Temp ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-xs uppercase">
                      <th className="px-4 py-3">ชื่อหน่วยงาน</th>
                      <th className="px-4 py-3">ระดับชั้น</th>
                      <th className="px-4 py-3">ประเภทการกระทำ</th>
                      <th className="px-4 py-3">หน่วยงานต้นสังกัด</th>
                      <th className="px-4 py-3">พื้นที่บริการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedNodes.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                          ไม่พบข้อมูลที่ตรงกับการค้นหา
                        </td>
                      </tr>
                    ) : (
                      paginatedNodes.map(node => (
                        <tr key={node.temp_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800">{node.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">Temp ID: {node.temp_id}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              node.level === 0 ? 'bg-purple-100 text-purple-700' :
                              node.level === 1 ? 'bg-blue-100 text-blue-700' :
                              node.level === 2 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700'
                            }`}>ระดับ {node.level}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              node.action === 'CREATE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {node.action === 'CREATE' ? 'สร้างใหม่' : `เชื่อมต่อ (DB ID: ${node.existing_db_id})`}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600">
                            {node.parent_temp_id ? (
                              <div>
                                <span className="font-bold text-slate-700">{getNodeNameById(node.parent_temp_id)}</span>
                                <div className="text-[9px] text-slate-400 font-mono">Temp ID: {node.parent_temp_id}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">ไม่มี (เป็น Root)</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[200px] truncate" title={node.locations?.map(l => `${l.subdistrict} (${l.code})`).join(', ')}>
                            {node.locations && node.locations.length > 0 ? (
                              node.locations.map((loc, idx) => (
                                <div key={idx} className="truncate">
                                  📍 {loc.subdistrict} / {loc.district}
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-400">ไม่ได้กำหนด</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-2 shrink-0">
                  <div className="text-xs text-slate-500">
                    หน้า {page} จาก {totalPages} (ทั้งหมด {filteredNodes.length} รายการ)
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 h-full overflow-auto">
              {treeData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400">ไม่พบโครงสร้างข้อมูล</div>
              ) : (
                treeData.map(root => (
                  <TreeNode key={root.temp_id} node={root} />
                ))
              )}
            </div>
          )}
        </div>

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
