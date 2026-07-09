import { useState, useEffect } from 'react';
import { Mail, Send, Loader2, CheckCircle, FileText, Database, X } from 'lucide-react';
import toast from 'react-hot-toast';

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

export const SubmissionsView = ({ apiKey }) => {
  const [email, setEmail] = useState('');
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/import/jobs?email=${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data || []);
      setHasSearched(true);
    } catch (err) {
      toast.error('ไม่สามารถดึงข้อมูลได้: ' + err.message);
    } finally {
      setIsLoading(false);
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
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <input
            type="email"
            required
            placeholder="ใส่อีเมลของคุณ..."
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-[250px]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'ค้นหา'}
          </button>
        </form>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map(job => (
              <div key={job.id} className="border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-mono text-xs text-slate-500">{job.id.substring(0,8)}...</div>
                  {getStatusBadge(job.status)}
                </div>
                <div className="text-sm font-bold text-slate-700 mb-1">
                  จำนวนข้อมูล: <span className="text-blue-600">{job.total_items}</span> หน่วยงาน
                </div>
                <div className="text-xs text-slate-500 mb-4">
                  อัปเดตล่าสุด: {new Date(job.updated_at).toLocaleString('th-TH')}
                </div>
                
                {job.status === 'rejected' && job.admin_comment && (
                  <div className="mt-auto bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                    <span className="font-bold text-red-800">เหตุผลที่ปฏิเสธ:</span>
                    <p className="text-red-700 mt-1">{job.admin_comment}</p>
                    {/* TODO: Add Edit button here in the future to load payload and fix it */}
                  </div>
                )}
                
                {job.status === 'processing' && (
                  <div className="mt-auto">
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(job.processed_items / job.total_items) * 100}%` }}></div>
                    </div>
                    <div className="text-[10px] text-right mt-1 text-slate-500">{job.processed_items} / {job.total_items}</div>
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
