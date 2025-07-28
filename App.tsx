

import React, { useState, useEffect, useCallback, useMemo, FC } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ALL_DEPARTMENTS, ADMIN_PASSWORD, DEFAULT_INVITATION_CODE, DEPARTMENT_DETAILS, DEPARTMENT_QR_CODES } from './constants';
import type { Applicant, Interviewer, RecruitmentSettings, InterviewSlot, DepartmentAvailability, InterviewFeedback } from './types';
import { ApplicationStatus, FinalResult } from './types';


declare global {
  interface Window {
    lucide: {
      createIcons: () => void;
    };
    Recharts?: any;
    XLSX?: any;
    docx?: any;
    saveAs?: any;
  }
}

// --- INDEXEDDB HELPERS ---

const DB_NAME = 'WenchuangRecruitmentDB';
const DB_VERSION = 1;
const STORE_NAME = 'resumes';

let dbInstance: IDBDatabase;

const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
        resolve(true);
        return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB:', request.error);
      reject(false);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(true);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const addResumeToDB = (applicantId: string, resumeFile: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      reject('DB not initialized');
      return;
    }
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(resumeFile, applicantId);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error adding resume to IndexedDB:', request.error);
      reject(request.error);
    };
  });
};

const getResumeFromDB = (applicantId: string): Promise<File | null> => {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      reject('DB not initialized');
      return;
    }
    const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(applicantId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => {
      console.error('Error getting resume from IndexedDB:', request.error);
      reject(request.error);
    };
  });
};

// --- UTILITY & HELPER COMPONENTS ---

const Icon: FC<{ name: string; className?: string }> = React.memo(({ name, className }) => {
  useEffect(() => {
    window.lucide?.createIcons();
  }, [name]);
  return <i data-lucide={name} className={className}></i>;
});

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error saving to localStorage (key: ${key}):`, error);
        }
    };

    return [storedValue, setValue];
}

const formatDateTime = (isoString: string) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// --- SUB-COMPONENTS & PAGES ---

const HomePage: FC<{ settings: RecruitmentSettings }> = ({ settings }) => {
    const navigate = useNavigate();
    const [showInterviewerModal, setShowInterviewerModal] = useState(false);
    const [interviewerCode, setInterviewerCode] = useState('');
    const [interviewerCodeError, setInterviewerCodeError] = useState('');

    const handleInterviewerClick = () => {
        setShowInterviewerModal(true);
    };

    const handleInterviewerCodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (interviewerCode === settings.invitationCode) {
            setShowInterviewerModal(false);
            setInterviewerCode('');
            setInterviewerCodeError('');
            navigate('/interviewer');
        } else {
            setInterviewerCodeError('邀请码错误，请重试。');
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in space-y-12">
            <div className="text-center rounded-lg bg-white shadow-lg p-12">
                 <img src="https://cdn.jsdelivr.net/gh/tgx75/wenchuang@main/img/logo.jpg" alt="拾光文创 Logo" className="h-24 w-24 mx-auto rounded-full shadow-lg mb-4" />
                 <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 mt-4">欢迎来到拾光文创</h1>
                 <p className="text-lg text-gray-600 mt-2">在这里，我们一起让UIC的文创变得更好！</p>
                 <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
                    <button onClick={() => navigate('/apply')} className="px-8 py-3 bg-brand-600 text-white text-lg font-semibold rounded-lg shadow-lg hover:bg-brand-700 transition-all duration-300 transform hover:scale-105 active:scale-95">
                       <Icon name="edit-3" className="w-5 h-5 inline-block mr-2" />
                        我想加入！
                    </button>
                    <button onClick={handleInterviewerClick} className="px-8 py-3 bg-gray-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:bg-gray-800 transition-all duration-300 transform hover:scale-105 active:scale-95">
                       <Icon name="user-cog" className="w-5 h-5 inline-block mr-2" />
                       我是面试官！
                    </button>
                     <button onClick={() => navigate('/admin')} className="px-8 py-3 bg-gray-200 text-gray-800 text-lg font-semibold rounded-lg shadow-lg hover:bg-gray-300 transition-all duration-300 transform hover:scale-105 active:scale-95">
                       <Icon name="settings-2" className="w-5 h-5 inline-block mr-2" />
                       我是管理员！
                    </button>
                 </div>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md">
                 <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">关于我们</h2>
                 <p className="text-gray-700 leading-relaxed mb-4">拾光文创是UIC的官方学生组织之一。在UIC的两个官方学生组织一个是隶属于招生办的大使团，另一个是隶属于IC的Memory拾光文创。因此你也可以在录取通知书礼盒中看到我们两个学生组织的身影，拾光文创负责礼盒里纪念品伴手礼的设计（冰箱贴、纪念衫）。拾光文创有着线下门店，拾光文创和拾光书屋都是我们的活动场地，因此我们不需要和其他社团一样租借教室。</p>
                 <p className="text-gray-700 leading-relaxed font-semibold">拾光文创和一般社团的区别：首先，拾光文创的性质在严格意义上并不属于社团，是属于官方学生组织。在UIC，社团一般由学生事务处（SAO）管理，拾光文创由IC管理。其次，我们的资金来源会更充足（无需你转发朋友圈广告拉赞助）。最后，在拾光文创工作的工时都记录于UIC官方的勤工俭学工时，并按照25Y/h的标准发放工资。除此之外，在拾光文创你还可以拿到UIC 官方的工作证明（优秀工作员工），这些都是利好未来简历和个人发展的哦！</p>
            </div>

            <div id="departments-section" className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">部门介绍</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {DEPARTMENT_DETAILS.map(dept => (
                         <div key={dept.name} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-xl hover:border-brand-300 transition-all duration-300 flex flex-col">
                            {dept.image && <img src={dept.image} alt={dept.name} className="w-full h-40 object-cover" />}
                            <div className="p-6 flex-grow flex flex-col">
                                 <h3 className="text-xl font-bold text-brand-700">{dept.name}</h3>
                                 <p className="mt-2 text-sm text-gray-600 flex-grow whitespace-pre-wrap"><strong>工作内容:</strong> {dept.content}</p>
                                 {dept.requirements.length > 0 && (
                                    <div className="mt-3 text-sm text-gray-600">
                                        <strong>能力要求:</strong>
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                             {dept.requirements.map((req, i) => <li key={i}>{req}</li>)}
                                        </ul>
                                    </div>
                                 )}
                                 {dept.submission && <p className="mt-3 text-sm font-semibold text-red-600 bg-red-50 p-2 rounded"><strong>【投递要求】</strong> {dept.submission}</p>}
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="text-center mt-10">
                     <p className="text-lg font-semibold text-gray-800">欢迎你选择拾光文创，我们一起让UIC的文创变得更好！有我有你，一鼓作气！</p>
                     <a href="https://kdocs.cn/l/ckoQdqKBqc35" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-all">下载简历模板</a>
                 </div>
            </div>

            {showInterviewerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 animate-fade-in-fast" onClick={() => setShowInterviewerModal(false)}>
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleInterviewerCodeSubmit}>
                            <h2 className="text-2xl font-bold text-center text-gray-800">面试官验证</h2>
                            <p className="text-center text-gray-500 my-4">请输入面试官邀请码以继续。</p>
                            <div className="mt-4">
                                <label htmlFor="interviewer-code" className="sr-only">邀请码</label>
                                <input
                                    id="interviewer-code"
                                    type="password"
                                    value={interviewerCode}
                                    onChange={(e) => {
                                        setInterviewerCode(e.target.value);
                                        setInterviewerCodeError('');
                                    }}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200"
                                    placeholder="邀请码"
                                    autoFocus
                                />
                            </div>
                            {interviewerCodeError && <p className="text-red-500 text-sm mt-2 text-center animate-fade-in-fast">{interviewerCodeError}</p>}
                            <div className="flex gap-4 mt-6">
                                <button type="button" onClick={() => setShowInterviewerModal(false)} className="w-full py-3 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-sm hover:bg-gray-300 transition-all transform active:scale-95">取消</button>
                                <button type="submit" className="w-full py-3 px-4 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all transform active:scale-95">确认</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
};


// 1. Applicant View
const ApplicantView: FC<{ 
    addApplicant: (applicant: Omit<Applicant, 'id' | 'submissionDate' | 'status'>) => void; 
    settings: RecruitmentSettings;
    departmentAvailability: DepartmentAvailability;
    applicants: Applicant[];
}> = ({ addApplicant, settings, departmentAvailability, applicants }) => {
    const navigate = useNavigate();
    const initialFormState = useMemo(() => {
        const firstChoice = settings.participatingDepartments[0] || '';
        const secondChoice = settings.participatingDepartments.filter(d => d !== firstChoice)[0] || '';
        return {
            studentId: '', name: '', grade: '', major: '', contact: '', email: '',
            firstChoice: firstChoice,
            secondChoice: secondChoice,
            customTime: '',
        };
    }, [settings.participatingDepartments]);
    
    const [applicantData, setApplicantData] = useState(initialFormState);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [selectedTimes1, setSelectedTimes1] = useState<string[]>([]);
    const [selectedTimes2, setSelectedTimes2] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'firstChoice') {
             const newSecondChoice = applicantData.secondChoice === value ? settings.participatingDepartments.filter(d => d !== value)[0] || '' : applicantData.secondChoice;
             setApplicantData(prev => ({ ...prev, firstChoice: value, secondChoice: newSecondChoice }));
             setSelectedTimes1([]); // Reset times on department change
        } else if (name === 'secondChoice') {
             setApplicantData(prev => ({ ...prev, [name]: value }));
             setSelectedTimes2([]); // Reset times on department change
        } else {
            setApplicantData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleTimeSelection = (timeId: string, choice: 1 | 2) => {
        if (choice === 1) {
            setSelectedTimes1(prev => prev.includes(timeId) ? prev.filter(id => id !== timeId) : [...prev, timeId]);
        } else {
            setSelectedTimes2(prev => prev.includes(timeId) ? prev.filter(id => id !== timeId) : [...prev, timeId]);
        }
    };
    
    const resetForm = useCallback(() => {
        setIsSubmitted(false);
        setApplicantData(initialFormState);
        setResumeFile(null);
        setSelectedTimes1([]);
        setSelectedTimes2([]);
    }, [initialFormState]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resumeFile) {
            alert('请上传您的简历 (PDF格式)');
            return;
        }
        if (applicantData.firstChoice === applicantData.secondChoice) {
            alert('第一志愿和第二志愿不能相同');
            return;
        }

        await addApplicant({ ...applicantData, resumeFile, availableTimes1: selectedTimes1, availableTimes2: selectedTimes2 });
        setIsSubmitted(true);
    };
    
    useEffect(() => {
        setApplicantData(initialFormState);
    }, [initialFormState]);
    
     const getSlotInfo = useCallback((slotId: string, department: string) => {
        const capacity = departmentAvailability[department]?.[slotId] || 0;
        if (capacity === 0) return { available: false, text: '(未开放)' };

        const bookings = applicants.filter(app =>
            (app.firstChoice === department && app.availableTimes1.includes(slotId)) ||
            (app.secondChoice === department && app.availableTimes2.includes(slotId))
        ).length;

        if (bookings >= capacity) {
            return { available: false, text: '(已满)' };
        }
        return { available: true, text: `(名额: ${bookings}/${capacity})` };
    }, [departmentAvailability, applicants]);


    if (isSubmitted) {
      return (
            <div className="text-center p-12 bg-white rounded-lg shadow-lg max-w-2xl mx-auto animate-fade-in">
                <Icon name="party-popper" className="w-16 h-16 mx-auto text-brand-600" />
                <h2 className="text-3xl font-bold text-gray-800 mt-4">提交成功！</h2>
                <p className="text-gray-600 mt-2">感谢你的申请，我们会尽快审核你的简历，请留意后续通知。</p>
                <div className="flex justify-center gap-4 mt-6">
                    <button
                        onClick={() => navigate('/#departments-section')}
                        className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-all duration-200 transform active:scale-95"
                    >
                        返回首页
                    </button>
                    <button
                        onClick={resetForm}
                        className="px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all duration-200 transform active:scale-95"
                    >
                        提交另一份申请
                    </button>
                </div>
            </div>
        );
    }
    
    const inputStyle = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200";

    const renderTimeSlots = (department: string, selectedTimes: string[], onSelect: (timeId: string, choice: 1 | 2) => void, choice: 1 | 2) => {
        if (!department) return <p className="text-sm text-gray-500">请先选择志愿部门。</p>;
        
        const availableSlots = settings.interviewSlots.filter(slot => (departmentAvailability[department]?.[slot.id] || 0) > 0);
        
        if (availableSlots.length === 0) return <p className="text-sm text-gray-500">该部门暂无开放的面试时间。</p>;

        return (
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-48 overflow-y-auto p-2 border rounded-lg">
                {settings.interviewSlots.map(slot => {
                    const slotInfo = getSlotInfo(slot.id, department);
                    return (
                    <div key={slot.id} className={`relative flex items-start ${!slotInfo.available ? 'opacity-50' : ''}`}>
                        <div className="flex items-center h-5">
                             <input id={`${choice}-${slot.id}`} type="checkbox" disabled={!slotInfo.available} checked={selectedTimes.includes(slot.id)} onChange={() => onSelect(slot.id, choice)} className="focus:ring-brand-500 h-4 w-4 text-brand-600 border-gray-300 rounded transition-all duration-150 disabled:cursor-not-allowed"/>
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor={`${choice}-${slot.id}`} className={`font-medium text-gray-700 ${slotInfo.available ? 'cursor-pointer' : 'cursor-not-allowed'}`}>{formatDateTime(slot.start)}</label>
                            <p className={`text-xs ${slotInfo.available ? 'text-gray-500' : 'text-red-500 font-semibold'}`}>{slotInfo.text}</p>
                        </div>
                    </div>
                )})}
             </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-xl animate-fade-in">
            <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-2">加入我们，共创未来</h1>
            <p className="text-center text-gray-500 mb-8">填写以下信息，开启你的文创社团之旅</p>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input name="name" placeholder="姓名" value={applicantData.name} onChange={handleInputChange} required className={inputStyle} />
                    <input name="studentId" placeholder="学号" value={applicantData.studentId} onChange={handleInputChange} required className={inputStyle} />
                    <input name="grade" placeholder="年级 (例如: 2023级)" value={applicantData.grade} onChange={handleInputChange} required className={inputStyle} />
                    <input name="major" placeholder="专业" value={applicantData.major} onChange={handleInputChange} required className={inputStyle} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input name="contact" type="tel" placeholder="联系方式" value={applicantData.contact} onChange={handleInputChange} required className={inputStyle} />
                    <input name="email" type="email" placeholder="邮箱" value={applicantData.email} onChange={handleInputChange} required className={inputStyle} />
                 </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">第一志愿部门</label>
                        <select name="firstChoice" value={applicantData.firstChoice} onChange={handleInputChange} className={`${inputStyle} bg-white`}>
                            {settings.participatingDepartments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">第二志愿部门</label>
                        <select name="secondChoice" value={applicantData.secondChoice} onChange={handleInputChange} className={`${inputStyle} bg-white`}>
                             {settings.participatingDepartments.filter(d => d !== applicantData.firstChoice).map(dep => <option key={dep} value={dep}>{dep}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">上传简历 (PDF)</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-brand-500 transition-colors">
                        <div className="space-y-1 text-center">
                            <Icon name="file-up" className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                                <label htmlFor="resumeFile" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-600 hover:text-brand-500 focus-within:outline-none">
                                    <span>{resumeFile ? '文件已选择' : '点击选择文件'}</span>
                                    <input id="resumeFile" name="resumeFile" type="file" accept=".pdf" className="sr-only" onChange={e => setResumeFile(e.target.files ? e.target.files[0] : null)} required />
                                </label>
                                <p className="pl-1">或拖拽到此处</p>
                            </div>
                            <p className="text-xs text-gray-500">{resumeFile ? resumeFile.name : '仅支持 PDF 格式'}</p>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">第一志愿可选面试时间 (可多选)</label>
                         {renderTimeSlots(applicantData.firstChoice, selectedTimes1, handleTimeSelection, 1)}
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">第二志愿可选面试时间 (可多选)</label>
                         {renderTimeSlots(applicantData.secondChoice, selectedTimes2, handleTimeSelection, 2)}
                    </div>
                </div>

                 <div>
                    <label htmlFor="customTime" className="block text-sm font-medium text-gray-700 mb-1">若以上时间均不方便，请备注</label>
                    <textarea id="customTime" name="customTime" value={applicantData.customTime} onChange={handleInputChange} rows={2} className={inputStyle}></textarea>
                </div>

                <div className="text-center pt-4">
                    <button type="submit" className="w-full md:w-1/2 px-8 py-3 bg-brand-600 text-white text-lg font-semibold rounded-lg shadow-lg hover:bg-brand-700 transition-all duration-300 transform hover:scale-105 active:scale-95">
                        <Icon name="send" className="w-5 h-5 inline-block mr-2" />
                        确认提交
                    </button>
                </div>
            </form>
        </div>
    );
};

// New Student Status Checker Page
const StudentStatusCheckerPage: FC<{ applicants: Applicant[] }> = ({ applicants }) => {
    const [searchParams, setSearchParams] = useState({ studentId: '', name: '', contact: '' });
    const [foundApplicant, setFoundApplicant] = useState<Applicant | null | 'not_found'>(null);
    const [showQrModal, setShowQrModal] = useState(false);
    const inputStyle = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200";

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchParams(prev => ({...prev, [e.target.name]: e.target.value}));
    };
    
    const handleAcceptOffer = () => {
        setShowQrModal(true);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const { studentId, name, contact } = searchParams;
        if (!studentId || !name || !contact) {
            alert('请填写所有查询信息');
            return;
        }
        const result = applicants.find(app =>
            app.studentId === studentId.trim() &&
            app.name === name.trim() &&
            app.contact === contact.trim()
        );
        setFoundApplicant(result || 'not_found');
    };

    const resetSearch = () => {
        setSearchParams({ studentId: '', name: '', contact: '' });
        setFoundApplicant(null);
    };

    const getStatusComponent = (label: string, status: ApplicationStatus | FinalResult) => {
        let colorClass = '';
        switch(status) {
            case ApplicationStatus.Passed:
            case FinalResult.Hired:
                colorClass = 'bg-green-100 text-green-800 border-green-500';
                break;
            case ApplicationStatus.Rejected:
            case FinalResult.NotHired:
                colorClass = 'bg-red-100 text-red-800 border-red-500';
                break;
            default: // Pending, ToBeDiscussed
                colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-500';
                break;
        }
        return (
            <div className={`p-4 rounded-lg border-l-4 ${colorClass}`}>
                <p className="text-sm font-medium text-gray-600">{label}</p>
                <p className="text-lg font-bold">{status}</p>
            </div>
        );
    };

    if (foundApplicant && foundApplicant !== 'not_found') {
        const qrCodeUrl = DEPARTMENT_QR_CODES[foundApplicant.firstChoice];

        return (
            <>
                <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-xl animate-fade-in">
                    <Icon name="check-circle" className="w-16 h-16 mx-auto text-green-500"/>
                    <h2 className="text-2xl font-bold text-center mt-4">查询结果</h2>
                    <p className="text-center text-gray-600 mb-6">你好，{foundApplicant.name}！你的申请状态如下：</p>
                    <div className="space-y-4">
                        {getStatusComponent('简历筛选', foundApplicant.status.resume)}
                        {getStatusComponent('第一轮面试', foundApplicant.status.firstInterview)}
                        {getStatusComponent('第二轮面试', foundApplicant.status.secondInterview)}
                        {getStatusComponent('最终结果', foundApplicant.status.finalResult)}
                    </div>
                    
                    {foundApplicant.status.finalResult === FinalResult.Hired && (
                        <div className="text-center mt-8 border-t pt-8">
                            <h3 className="text-xl font-bold text-green-600">恭喜你被录用！</h3>
                            <p className="text-gray-600 mt-2 mb-4">请点击下方按钮接受录用并获取入群二维码。</p>
                            <button onClick={handleAcceptOffer} className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105 active:scale-95">
                                <Icon name="party-popper" className="w-5 h-5 inline-block mr-2" />
                                接受录用！
                            </button>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t text-center">
                        <h3 className="text-lg font-semibold text-gray-700">面试体验反馈</h3>
                        <p className="text-sm text-gray-500 mt-1 mb-4">我们非常重视你的面试体验，欢迎<Link to="/feedback" className="text-brand-600 hover:underline">点击这里</Link>或扫描下方二维码匿名提交反馈。</p>
                        <img src="https://cdn.jsdelivr.net/gh/tgx75/wenchuang@main/img/gongguan.jpg" alt="Feedback QR Code" className="w-40 h-40 mx-auto rounded-lg shadow-md" />
                    </div>
                    <div className="text-center mt-8">
                        <button onClick={resetSearch} className="px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all duration-200 transform active:scale-95">
                            返回查询
                        </button>
                    </div>
                </div>
                
                {showQrModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in-fast" onClick={() => setShowQrModal(false)}>
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm text-center p-8" onClick={e => e.stopPropagation()}>
                            <Icon name="check-circle-2" className="w-16 h-16 mx-auto text-green-500 mb-4"/>
                            <h2 className="text-2xl font-bold text-gray-800">欢迎加入！</h2>
                            <p className="text-gray-600 my-4">欢迎加入 <strong>{foundApplicant.firstChoice}</strong>！请扫描下方二维码加入部门群聊。</p>
                            {qrCodeUrl ? (
                                <img src={qrCodeUrl} alt={`${foundApplicant.firstChoice} QR Code`} className="w-64 h-64 mx-auto rounded-lg shadow-md" />
                            ) : (
                                <p className="bg-yellow-100 text-yellow-800 p-3 rounded-lg">暂无该部门的二维码，请联系管理员获取入群方式。</p>
                            )}
                            <button onClick={() => setShowQrModal(false)} className="mt-6 w-full py-3 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all duration-200 transform active:scale-95">
                                关闭
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-xl animate-fade-in">
            <Icon name="search" className="w-12 h-12 mx-auto text-brand-600"/>
            <h1 className="text-2xl font-bold text-center my-4">查询你的申请状态</h1>
            <p className="text-center text-gray-500 mb-6">请输入报名时填写的个人信息</p>
            <form onSubmit={handleSearch} className="space-y-4">
                <input name="studentId" placeholder="学号" value={searchParams.studentId} onChange={handleSearchChange} required className={inputStyle} />
                <input name="name" placeholder="姓名" value={searchParams.name} onChange={handleSearchChange} required className={inputStyle} />
                <input name="contact" type="tel" placeholder="联系方式" value={searchParams.contact} onChange={handleSearchChange} required className={inputStyle} />
                {foundApplicant === 'not_found' && (
                    <p className="text-red-500 text-sm text-center animate-fade-in-fast">未找到匹配的申请信息，请检查输入是否有误。</p>
                )}
                <button type="submit" className="w-full py-3 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all duration-200 transform active:scale-95">
                    查询
                </button>
            </form>
        </div>
    );
};


// New Feedback Page
const FeedbackPage: FC<{ addFeedback: (feedback: Omit<InterviewFeedback, 'id' | 'submissionDate'>) => void; }> = ({ addFeedback }) => {
    const [feedbackText, setFeedbackText] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (feedbackText.trim() === '') {
            alert('反馈内容不能为空');
            return;
        }
        addFeedback({ feedbackText });
        setIsSubmitted(true);
    };

    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto p-8 bg-white rounded-lg shadow-xl text-center animate-fade-in">
                <Icon name="send" className="w-16 h-16 mx-auto text-green-500"/>
                <h2 className="text-2xl font-bold mt-4">感谢你的反馈！</h2>
                <p className="text-gray-600 mt-2">你的意见对我们非常重要，祝你一切顺利！</p>
                <Link to="/" className="mt-6 inline-block px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700">返回首页</Link>
            </div>
        );
    }
    
    return (
        <div className="max-w-xl mx-auto p-8 bg-white rounded-lg shadow-xl animate-fade-in">
            <Icon name="message-square-quote" className="w-12 h-12 mx-auto text-brand-600"/>
            <h1 className="text-2xl font-bold text-center my-4">面试体验反馈</h1>
            <p className="text-center text-gray-500 mb-6">我们承诺本次反馈完全匿名，请放心填写。你的宝贵意见将帮助我们改进招新流程。</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea 
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    rows={8}
                    placeholder="请在此处输入你的反馈，例如：面试官是否准时？面试氛围如何？你对面试流程有什么建议？"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200"
                />
                <button type="submit" className="w-full py-3 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all duration-200 transform active:scale-95">
                    提交匿名反馈
                </button>
            </form>
        </div>
    );
};


// 2. Interviewer Registration
const InterviewerRegisterPage: FC<{
    settings: RecruitmentSettings;
    addInterviewer: (interviewer: Omit<Interviewer, 'id'>) => void;
}> = ({ settings, addInterviewer }) => {
    const [formData, setFormData] = useState({ name: '', department: settings.participatingDepartments[0] || '', code: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    const inputStyle = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200";

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.code !== settings.invitationCode) {
            setError('邀请码错误');
            return;
        }
        addInterviewer(formData);
        alert('注册成功！');
        navigate('/interviewer');
    };

    return (
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-xl animate-fade-in">
            <h1 className="text-3xl font-bold text-center mb-6">面试官注册</h1>
            <form onSubmit={handleRegister} className="space-y-6">
                <input type="text" placeholder="邀请码" value={formData.code} onChange={e => { setFormData(p => ({...p, code: e.target.value})); setError(''); }} required className={inputStyle}/>
                {error && <p className="text-red-500 text-sm animate-fade-in-fast">{error}</p>}
                <input type="text" placeholder="姓名" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required className={inputStyle}/>
                <select value={formData.department} onChange={e => setFormData(p => ({...p, department: e.target.value}))} className={`${inputStyle} bg-white`}>
                    {settings.participatingDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button type="submit" className="w-full py-3 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all duration-200 transform active:scale-95">注册</button>
            </form>
        </div>
    );
};

// 3. Interviewer Login/Dashboard
const InterviewerPortal: FC<{
    interviewers: Interviewer[];
}> = ({ interviewers }) => {
    const [selectedId, setSelectedId] = useState<string>('');
    const navigate = useNavigate();
    
    if (interviewers.length === 0) {
        return (
            <div className="text-center p-12 animate-fade-in">
                <p className="text-gray-600">目前没有已注册的面试官。</p>
                <Link to="/register" className="text-brand-600 hover:underline">点此注册</Link>
            </div>
        )
    }

    const handleLogin = () => {
        if (selectedId) {
            navigate(`/interviewer/dashboard?id=${selectedId}`);
        }
    };
    
    return (
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-xl text-center animate-fade-in">
             <Icon name="users" className="w-12 h-12 mx-auto text-brand-600"/>
            <h1 className="text-2xl font-bold my-4">面试官入口</h1>
            <p className="text-gray-500 mb-6">请选择你的身份</p>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full p-2 border bg-white rounded-md mb-4 focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200">
                <option value="">-- 请选择 --</option>
                {interviewers.map(i => <option key={i.id} value={i.id}>{i.name} - {i.department}</option>)}
            </select>
            <button onClick={handleLogin} disabled={!selectedId} className="w-full py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:bg-gray-400 transition-all duration-200 transform active:scale-95">进入工作台</button>
             <p className="text-sm text-gray-500 mt-6">
                不是面试官？ <Link to="/register" className="text-brand-600 hover:underline">注册新账号</Link>
            </p>
        </div>
    );
};

const InterviewerDashboard: FC<{
    interviewer: Interviewer;
    applicants: Applicant[];
    updateApplicantStatus: (id: string, stage: keyof Applicant['status'], value: ApplicationStatus | FinalResult) => void;
    settings: RecruitmentSettings;
    departmentAvailability: DepartmentAvailability;
    setDepartmentAvailability: React.Dispatch<React.SetStateAction<DepartmentAvailability>>;
}> = ({ interviewer, applicants, updateApplicantStatus, settings, departmentAvailability, setDepartmentAvailability }) => {
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
    const [activeTab, setActiveTab] = useState('screening');
    const [localCapacities, setLocalCapacities] = useState<Record<string, number>>({});
    const [bulkCapacity, setBulkCapacity] = useState<string>('');
    
    const initialCapacities = useMemo(() => departmentAvailability[interviewer.department] || {}, [departmentAvailability, interviewer.department]);

    useEffect(() => {
        if (activeTab === 'capacity') {
            setLocalCapacities(initialCapacities);
        }
    }, [activeTab, initialCapacities]);

    const handleLocalCapacityChange = (slotId: string, capacity: string) => {
        const num = parseInt(capacity, 10);
        setLocalCapacities(prev => ({
            ...prev,
            [slotId]: isNaN(num) || num < 0 ? 0 : num
        }));
    };

    const handleBulkApply = () => {
        const num = parseInt(bulkCapacity, 10);
        if (isNaN(num) || num < 0) {
            alert("请输入一个有效的非负整数。");
            return;
        }
        const newCapacities: Record<string, number> = {};
        settings.interviewSlots.forEach(slot => {
            newCapacities[slot.id] = num;
        });
        setLocalCapacities(newCapacities);
        setBulkCapacity('');
    };

    const handleSaveChanges = () => {
        setDepartmentAvailability(prev => ({
            ...prev,
            [interviewer.department]: localCapacities
        }));
        alert("容量设置已保存！");
    };

    const handleResetChanges = () => {
        setLocalCapacities(initialCapacities);
    };

    const hasChanges = useMemo(() => {
        return JSON.stringify(localCapacities) !== JSON.stringify(initialCapacities);
    }, [localCapacities, initialCapacities]);

    const slotsByDate = useMemo(() => {
        return settings.interviewSlots.reduce((acc, slot) => {
            const dateKey = new Date(slot.start).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(slot);
            return acc;
        }, {} as Record<string, InterviewSlot[]>);
    }, [settings.interviewSlots]);

    const scheduledApplicants = useMemo(() => {
        return applicants.filter(a => 
            a.scheduledInterview1?.interviewerId === interviewer.id ||
            a.scheduledInterview2?.interviewerId === interviewer.id
        ).sort((a,b) => {
            const timeA = new Date(a.scheduledInterview1?.time || a.scheduledInterview2?.time || 0).getTime();
            const timeB = new Date(b.scheduledInterview1?.time || b.scheduledInterview2?.time || 0).getTime();
            return timeA - timeB;
        });
    }, [applicants, interviewer.id]);
    
    const screeningApplicants = useMemo(() => {
        return applicants
            .filter(app => app.firstChoice === interviewer.department || app.secondChoice === interviewer.department)
            .sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
    }, [applicants, interviewer.department]);

    const getStatusColor = (status: ApplicationStatus) => {
        switch(status) {
            case ApplicationStatus.Passed: return 'text-green-600 bg-green-100';
            case ApplicationStatus.Rejected: return 'text-red-600 bg-red-100';
            default: return 'text-yellow-600 bg-yellow-100';
        }
    }

    return (
         <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">面试官工作台</h1>
            <p className="text-gray-600 mb-6">欢迎你，{interviewer.name} ({interviewer.department})</p>

            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('screening')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'screening' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        简历筛选 ({screeningApplicants.length})
                    </button>
                    <button onClick={() => setActiveTab('schedule')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'schedule' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        我的面试安排 ({scheduledApplicants.length})
                    </button>
                    <button onClick={() => setActiveTab('capacity')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'capacity' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        时段容量管理
                    </button>
                </nav>
            </div>
            
            <div className="animate-fade-in-fast">
                 {activeTab === 'capacity' && (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold mb-2">管理 "{interviewer.department}" 的面试容量</h2>
                        <p className="text-sm text-gray-500 mb-6">为每个时间段设置你可以面试的人数。完成修改后请点击“保存设置”。</p>
                        
                        <div className="p-4 bg-gray-100 rounded-lg mb-6 flex flex-col md:flex-row items-center gap-4">
                           <h3 className="font-semibold text-gray-800">批量设置</h3>
                           <div className="flex items-center gap-2">
                               <label htmlFor="bulk-capacity-input" className="text-sm">将所有时段容量设为:</label>
                               <input
                                   id="bulk-capacity-input"
                                   type="number"
                                   min="0"
                                   className="w-24 px-2 py-1 border rounded-md"
                                   value={bulkCapacity}
                                   onChange={e => setBulkCapacity(e.target.value)}
                                   placeholder="人数"
                               />
                               <button onClick={handleBulkApply} className="px-4 py-1 bg-brand-500 text-white text-sm font-semibold rounded-md hover:bg-brand-600 transition-colors">
                                   应用
                               </button>
                           </div>
                       </div>
                        
                        {settings.interviewSlots.length > 0 ? (
                            <div className="space-y-6">
                                {Object.entries(slotsByDate).map(([date, slots]) => (
                                    <div key={date}>
                                        <h4 className="font-bold text-lg text-gray-700 mb-3 pb-2 border-b">{date}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {slots.map(slot => (
                                                <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <span className="font-medium text-gray-700">{new Date(slot.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-sm">人数:</label>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            className="w-20 px-2 py-1 border rounded-md text-center"
                                                            value={localCapacities[slot.id] || 0}
                                                            onChange={(e) => handleLocalCapacityChange(slot.id, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                 <div className="mt-8 pt-6 border-t flex justify-end gap-4">
                                    <button
                                        onClick={handleResetChanges}
                                        disabled={!hasChanges}
                                        className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        重置
                                    </button>
                                    <button
                                        onClick={handleSaveChanges}
                                        disabled={!hasChanges}
                                        className="px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        保存设置
                                    </button>
                                </div>
                            </div>
                        ) : <p className="text-gray-500">管理员还未创建任何面试时间段。</p>}
                    </div>
                 )}

                {activeTab === 'screening' && (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                         <h2 className="text-xl font-bold mb-4">待筛选简历</h2>
                         {screeningApplicants.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3">姓名</th>
                                            <th className="px-4 py-3">专业</th>
                                            <th className="px-4 py-3">志愿</th>
                                            <th className="px-4 py-3">简历状态</th>
                                            <th className="px-4 py-3">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {screeningApplicants.map(app => (
                                            <tr key={app.id} className="border-b hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-900">{app.name}</td>
                                                <td className="px-4 py-3">{app.major}</td>
                                                <td className="px-4 py-3">{app.firstChoice === interviewer.department ? '第一志愿' : '第二志愿'}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(app.status.resume)}`}>
                                                        {app.status.resume}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button onClick={() => setSelectedApplicant(app)} className="text-brand-600 hover:underline">查看详情</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-gray-500">暂无需要筛选的简历。</p>}
                    </div>
                )}
                
                {activeTab === 'schedule' && (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold mb-4">我的面试安排</h2>
                        {scheduledApplicants.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {scheduledApplicants.map(app => {
                                    const isFirstInterview = app.scheduledInterview1?.interviewerId === interviewer.id;
                                    const interviewInfo = isFirstInterview ? app.scheduledInterview1 : app.scheduledInterview2;
                                    return (
                                        <div key={app.id} onClick={() => setSelectedApplicant(app)} className="bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-brand-500">
                                            <p className="font-bold text-lg">{app.name}</p>
                                            <p className="text-sm text-gray-500">{app.grade} - {app.major}</p>
                                            <div className="mt-3 pt-3 border-t">
                                                <p className="font-semibold text-brand-700">{isFirstInterview ? "第一轮面试" : "第二轮面试"}</p>
                                                <p className="text-sm"><Icon name="calendar" className="w-4 h-4 inline-block mr-1"/>{formatDateTime(interviewInfo!.time)}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-gray-500">暂无已安排的面试。</p>
                        )}
                    </div>
                )}
            </div>
            
            <ApplicantDetailModal
                applicant={selectedApplicant}
                onClose={() => setSelectedApplicant(null)}
                updateStatus={updateApplicantStatus}
            />
        </div>
    );
};

// 4. Admin Pages
const AdminLoginPage: FC<{ onLogin: () => void; settings: RecruitmentSettings; }> = ({ onLogin, settings }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === (settings.adminPassword || ADMIN_PASSWORD)) {
            onLogin();
            navigate('/admin/dashboard');
        } else {
            setError('密码错误，请重试');
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <div className="text-center">
                    <Icon name="shield-check" className="w-12 h-12 mx-auto text-brand-600" />
                    <h1 className="text-3xl font-bold text-gray-900 mt-2">管理员登录</h1>
                    <p className="text-gray-500">请输入密码访问后台管理系统</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="请输入管理员密码" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200"/>
                         {error && <p className="text-red-500 text-sm mt-2 animate-fade-in-fast">{error}</p>}
                    </div>
                    <div>
                        <button type="submit" className="w-full py-3 px-4 bg-brand-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-700 transition-all duration-200 transform active:scale-95">登录</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminDashboardPage: FC<{ applicants: Applicant[], settings: RecruitmentSettings }> = ({ applicants, settings }) => {
    const [rechartsReady, setRechartsReady] = useState(!!window.Recharts);

    useEffect(() => {
        if (rechartsReady) return;
        const timer = setInterval(() => {
            if (window.Recharts) {
                setRechartsReady(true);
                clearInterval(timer);
            }
        }, 100);

        return () => clearInterval(timer);
    }, [rechartsReady]);

    const stats = useMemo(() => {
        const total = applicants.length;
        const deptChoices = (settings.participatingDepartments || []).reduce((acc, dept) => {
            acc[dept] = { first: 0, second: 0 };
            return acc;
        }, {} as Record<string, { first: number, second: number }>);

        applicants.forEach(app => {
            if (deptChoices[app.firstChoice]) deptChoices[app.firstChoice].first++;
            if (deptChoices[app.secondChoice]) deptChoices[app.secondChoice].second++;
        });
        
        const chartData = Object.entries(deptChoices).map(([name, counts]) => ({ name, '第一志愿': counts.first, '第二志愿': counts.second }));
        
        const resumeStatusData = Object.entries(applicants.reduce((acc, app) => {
            acc[app.status.resume] = (acc[app.status.resume] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));
        
        const finalResultData = Object.entries(applicants.reduce((acc, app) => {
            acc[app.status.finalResult] = (acc[app.status.finalResult] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));

        const hiredApplicants = applicants.filter(app => app.status.finalResult === FinalResult.Hired);

        return { total, chartData, hiredApplicants, resumeStatusData, finalResultData };
    }, [applicants, settings.participatingDepartments]);

    const exportHiredToExcel = () => {
        if (!window.XLSX || !window.saveAs) {
            alert("导出库加载失败，请刷新页面重试。");
            return;
        }
        const dataToExport = stats.hiredApplicants.map(app => ({
            '姓名': app.name,
            '学号': app.studentId,
            '专业': app.major,
            '联系方式': app.contact,
            '邮箱': app.email,
            '录用部门': app.firstChoice,
        }));
        const worksheet = window.XLSX.utils.json_to_sheet(dataToExport);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, '录用名单');
        window.XLSX.writeFile(workbook, '拾光文创录用名单.xlsx');
    };

    const ChartComponent = () => {
        if (!rechartsReady) {
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">图表加载中...</p>
                </div>
            );
        }
        const { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = window.Recharts;
        
        const COLORS = {
            [ApplicationStatus.Passed]: '#22c55e',
            [ApplicationStatus.Pending]: '#f59e0b',
            [ApplicationStatus.Rejected]: '#ef4444',
            [FinalResult.Hired]: '#10b981',
            [FinalResult.ToBeDiscussed]: '#eab308',
            [FinalResult.NotHired]: '#f43f5e',
        };

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-white p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-gray-700 mb-4">各部门志愿人数分布</h2>
                    <div style={{width: '100%', height: 300}}>
                        <ResponsiveContainer>
                           <BarChart data={stats.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} interval={0} tick={{fontSize: 10}}/>
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="第一志愿" fill="#0284c7" />
                                <Bar dataKey="第二志愿" fill="#7dd3fc" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-gray-700 mb-4">简历筛选进度</h2>
                        <div style={{width: '100%', height: 300}}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={stats.resumeStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} label>
                                         {stats.resumeStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#8884d8'} />)}
                                    </Pie>
                                    <Tooltip/>
                                    <Legend/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-gray-700 mb-4">最终录用结果</h2>
                        <div style={{width: '100%', height: 300}}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={stats.finalResultData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#82ca9d" paddingAngle={5} label>
                                        {stats.finalResultData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#82ca9d'} />)}
                                    </Pie>
                                     <Tooltip/>
                                     <Legend/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800">管理员数据中心</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4 transition-shadow hover:shadow-lg">
                    <div className="p-3 rounded-full bg-blue-500"><Icon name="users" className="w-7 h-7 text-white"/></div>
                    <div><p className="text-sm text-gray-500">总申请人数</p><p className="text-3xl font-bold text-gray-800">{stats.total}</p></div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4 transition-shadow hover:shadow-lg">
                    <div className="p-3 rounded-full bg-green-500"><Icon name="user-check" className="w-7 h-7 text-white"/></div>
                    <div><p className="text-sm text-gray-500">已录用人数</p><p className="text-3xl font-bold text-gray-800">{stats.hiredApplicants.length}</p></div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4 transition-shadow hover:shadow-lg">
                    <div className="p-3 rounded-full bg-yellow-500"><Icon name="building-2" className="w-7 h-7 text-white"/></div>
                    <div><p className="text-sm text-gray-500">参与部门数</p><p className="text-3xl font-bold text-gray-800">{settings.participatingDepartments.length}</p></div>
                </div>
            </div>
            
            <ChartComponent />
            
             <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-700">最终录用名单 ({stats.hiredApplicants.length}人)</h2>
                    <button onClick={exportHiredToExcel} className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-green-700 transition-all transform active:scale-95 flex items-center gap-2" disabled={stats.hiredApplicants.length === 0}>
                        <Icon name="download" className="w-4 h-4"/>
                        下载录用名单 (Excel)
                    </button>
                </div>
                 {stats.hiredApplicants.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3">姓名</th>
                                    <th scope="col" className="px-6 py-3">学号</th>
                                    <th scope="col" className="px-6 py-3">专业</th>
                                    <th scope="col" className="px-6 py-3">联系方式</th>
                                    <th scope="col" className="px-6 py-3">邮箱</th>
                                    <th scope="col" className="px-6 py-3">录用部门</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.hiredApplicants.map(app => (
                                    <tr key={app.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{app.name}</th>
                                        <td className="px-6 py-4">{app.studentId}</td>
                                        <td className="px-6 py-4">{app.major}</td>
                                        <td className="px-6 py-4">{app.contact}</td>
                                        <td className="px-6 py-4">{app.email}</td>
                                        <td className="px-6 py-4">{app.firstChoice}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="text-gray-500">暂无录用人员。</p>}
            </div>
        </div>
    );
};

const AdminSettingsPage: FC<{
    settings: RecruitmentSettings;
    updateSettings: React.Dispatch<React.SetStateAction<RecruitmentSettings>>;
    clearInterviewers: () => void;
}> = ({ settings, updateSettings, clearInterviewers }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [slotGenerator, setSlotGenerator] = useState({
        startDate: '',
        endDate: '',
        startTime: '18:00',
        endTime: '20:00',
        duration: 20
    });
    const [showConfirm, setShowConfirm] = useState(false);
    const [newCode, setNewCode] = useState(settings.invitationCode);
    const [passwordFields, setPasswordFields] = useState({ current: '', newPass: '', confirmPass: '' });
    
    const inputStyle = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-all duration-200";

    useEffect(() => {
        setLocalSettings(settings);
        setNewCode(settings.invitationCode);
    }, [settings]);

    const handleDeptToggle = (dept: string) => {
        const depts = localSettings.participatingDepartments;
        const newDepts = depts.includes(dept) ? depts.filter(d => d !== dept) : [...depts, dept];
        setLocalSettings(s => ({ ...s, participatingDepartments: newDepts }));
    };

    const handleGenerateSlots = () => {
        const { startDate, endDate, startTime, endTime, duration } = slotGenerator;
        if (!startDate || !startTime || !endTime || !duration || duration <= 0) {
            alert("请填写完整的时段生成器信息（开始日期、起止时间、时长）");
            return;
        }

        const actualEndDate = endDate || startDate;
        const sDate = new Date(startDate);
        const eDate = new Date(actualEndDate);

        if (sDate > eDate) {
            alert("结束日期不能早于开始日期");
            return;
        }

        const newSlots: InterviewSlot[] = [];
        for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            let current = new Date(`${dateString}T${startTime}:00`);
            const endOfDay = new Date(`${dateString}T${endTime}:00`);

            if (current >= endOfDay) continue;

            while (current < endOfDay) {
                const slotEnd = new Date(current.getTime() + duration * 60000);
                if (slotEnd > endOfDay) break;

                newSlots.push({
                    id: `slot_${current.getTime()}_${Math.random()}`,
                    start: current.toISOString(),
                    end: slotEnd.toISOString(),
                });
                current = slotEnd;
            }
        }

        if (newSlots.length === 0) {
            alert("未生成任何时段，请检查输入的时间范围和时长。");
            return;
        }

        setLocalSettings(s => ({
            ...s,
            interviewSlots: [...s.interviewSlots, ...newSlots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        }));
    };
    
    const handleCodeChange = () => {
        if(newCode !== settings.invitationCode && newCode.trim() !== "") {
            setShowConfirm(true);
        } else if (newCode.trim() === "") {
             alert("邀请码不能为空");
        }
    };
    
    const confirmCodeChange = () => {
        clearInterviewers();
        updateSettings(s => ({ ...s, invitationCode: newCode }));
        setShowConfirm(false);
        alert("邀请码已更新，所有面试官信息已清空。");
    };

    const handleSave = () => {
        updateSettings(localSettings);
        alert('设置已保存！');
    };

    const handlePasswordUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordFields.current !== (settings.adminPassword || ADMIN_PASSWORD)) {
            alert('当前密码错误！');
            return;
        }
        if (!passwordFields.newPass) {
            alert('新密码不能为空！');
            return;
        }
        if (passwordFields.newPass !== passwordFields.confirmPass) {
            alert('两次输入的新密码不一致！');
            return;
        }
        updateSettings(s => ({ ...s, adminPassword: passwordFields.newPass }));
        alert('密码修改成功！');
        setPasswordFields({ current: '', newPass: '', confirmPass: '' });
    };

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-xl space-y-8 divide-y divide-gray-200 animate-fade-in">
            {showConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl animate-fade-in-fast">
                        <h2 className="text-lg font-bold">确认修改邀请码？</h2>
                        <p className="my-4">这将清空所有已注册的面试官信息，此操作不可撤销。</p>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-gray-200 rounded-md transition-colors transform active:scale-95">取消</button>
                            <button onClick={confirmCodeChange} className="px-4 py-2 bg-red-600 text-white rounded-md transition-colors transform active:scale-95">确认</button>
                        </div>
                    </div>
                </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900 !pt-0">招新设置</h1>
            
            <div className="pt-8">
                <div>
                    <h2 className="text-xl font-semibold mb-2">参与招新的部门</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {ALL_DEPARTMENTS.map(dept => (
                            <div key={dept} className="flex items-center">
                                <input type="checkbox" id={dept} checked={localSettings.participatingDepartments.includes(dept)} onChange={() => handleDeptToggle(dept)} className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 transition"/>
                                <label htmlFor={dept} className="ml-2 text-sm cursor-pointer">{dept}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-2">面试时间段管理</h2>
                     <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                        <h3 className="font-medium">时段生成器</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                             <div>
                                <label className="text-xs text-gray-500 block mb-1">开始日期</label>
                                <input type="date" value={slotGenerator.startDate} onChange={e => setSlotGenerator(p => ({...p, startDate: e.target.value}))} className="w-full px-2 py-1 border rounded-md transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">结束日期 (可选)</label>
                                <input type="date" value={slotGenerator.endDate} onChange={e => setSlotGenerator(p => ({...p, endDate: e.target.value}))} className="w-full px-2 py-1 border rounded-md transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">开始时间</label>
                                <input type="time" value={slotGenerator.startTime} onChange={e => setSlotGenerator(p => ({...p, startTime: e.target.value}))} className="w-full px-2 py-1 border rounded-md transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">结束时间</label>
                                <input type="time" value={slotGenerator.endTime} onChange={e => setSlotGenerator(p => ({...p, endTime: e.target.value}))} className="w-full px-2 py-1 border rounded-md transition-colors"/>
                            </div>
                            <div className="col-span-2 md:col-span-3 lg:col-span-1">
                                <label className="text-xs text-gray-500 block mb-1">时长(分)</label>
                                <input type="number" value={slotGenerator.duration} onChange={e => setSlotGenerator(p => ({...p, duration: parseInt(e.target.value, 10) || 0}))} className="w-full px-2 py-1 border rounded-md transition-colors"/>
                            </div>
                        </div>
                        <button onClick={handleGenerateSlots} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors transform active:scale-95">生成时段</button>
                    </div>
                    <div className="mt-4 max-h-60 overflow-y-auto space-y-2 border p-2 rounded-md">
                        {localSettings.interviewSlots.length > 0 ? localSettings.interviewSlots.map(slot => (
                            <div key={slot.id} className="flex justify-between items-center bg-gray-100 p-2 rounded transition-all duration-300">
                                <span className="text-sm">{formatDateTime(slot.start)} - {new Date(slot.end).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})}</span>
                                <button onClick={() => setLocalSettings(s => ({...s, interviewSlots: s.interviewSlots.filter(i => i.id !== slot.id)}))} className="text-red-500 hover:text-red-700 transition-colors">
                                    <Icon name="trash-2" className="w-4 h-4"/>
                                </button>
                            </div>
                        )) : <p className="text-sm text-center text-gray-500 py-4">暂无面试时段</p>}
                    </div>
                </div>

                <div className="text-right pt-8">
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors transform active:scale-95">保存部门和时间设置</button>
                </div>
            </div>

            <div className="pt-8 space-y-8">
                <div>
                    <h2 className="text-xl font-semibold mb-2">面试官邀请码</h2>
                    <div className="flex gap-2">
                        <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} className="flex-grow px-3 py-2 border rounded-md transition-colors focus:ring-2 focus:ring-brand-300" />
                        <button onClick={handleCodeChange} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors transform active:scale-95">更新邀请码</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">注意：更新邀请码将清空所有面试官数据，此操作会立即生效。</p>
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-2">修改管理员密码</h2>
                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <input type="password" placeholder="当前密码" value={passwordFields.current} onChange={e => setPasswordFields(p => ({...p, current: e.target.value}))} required className={inputStyle}/>
                        <input type="password" placeholder="新密码" value={passwordFields.newPass} onChange={e => setPasswordFields(p => ({...p, newPass: e.target.value}))} required className={inputStyle}/>
                        <input type="password" placeholder="确认新密码" value={passwordFields.confirmPass} onChange={e => setPasswordFields(p => ({...p, confirmPass: e.target.value}))} required className={inputStyle}/>
                        <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors transform active:scale-95">修改密码</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const AdminAllApplicantsView: FC<{ 
    applicants: Applicant[],
    interviewers: Interviewer[],
}> = ({ applicants, interviewers }) => {
    const getInterviewerName = (id?: string) => interviewers.find(i => i.id === id)?.name || 'N/A';
    
    const exportAllToExcel = () => {
        if (!window.XLSX || !window.saveAs) {
            alert("导出库加载失败，请刷新页面重试。");
            return;
        }
        const dataToExport = applicants.map(app => ({
            '姓名': app.name,
            '学号': app.studentId,
            '年级': app.grade,
            '专业': app.major,
            '联系方式': app.contact,
            '邮箱': app.email,
            '第一志愿': app.firstChoice,
            '第二志愿': app.secondChoice,
            '提交日期': formatDateTime(app.submissionDate),
            '简历状态': app.status.resume,
            '一面状态': app.status.firstInterview,
            '二面状态': app.status.secondInterview,
            '最终结果': app.status.finalResult,
            '一面时间': formatDateTime(app.scheduledInterview1?.time || ''),
            '一面面试官': getInterviewerName(app.scheduledInterview1?.interviewerId),
            '二面时间': formatDateTime(app.scheduledInterview2?.time || ''),
            '二面面试官': getInterviewerName(app.scheduledInterview2?.interviewerId),
        }));
        const worksheet = window.XLSX.utils.json_to_sheet(dataToExport);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, '所有申请者');
        window.XLSX.writeFile(workbook, '拾光文创所有申请者信息.xlsx');
    };

    return (
        <div className="max-w-full mx-auto p-4 md:p-8 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">所有申请者信息</h1>
                <button onClick={exportAllToExcel} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all transform active:scale-95 flex items-center gap-2" disabled={applicants.length === 0}>
                    <Icon name="download" className="w-4 h-4"/>
                    下载所有申请者信息 (Excel)
                </button>
             </div>
            <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            <th className="px-4 py-3">姓名</th>
                            <th className="px-4 py-3">学号</th>
                            <th className="px-4 py-3">专业</th>
                            <th className="px-4 py-3">第一志愿</th>
                            <th className="px-4 py-3">简历状态</th>
                            <th className="px-4 py-3">一面时间</th>
                            <th className="px-4 py-3">一面面试官</th>
                            <th className="px-4 py-3">二面时间</th>
                            <th className="px-4 py-3">最终结果</th>
                        </tr>
                    </thead>
                    <tbody>
                        {applicants.map(app => (
                            <tr key={app.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-2 font-medium text-gray-900">{app.name}</td>
                                <td className="px-4 py-2">{app.studentId}</td>
                                <td className="px-4 py-2">{app.major}</td>
                                <td className="px-4 py-2">{app.firstChoice}</td>
                                <td className="px-4 py-2">{app.status.resume}</td>
                                <td className="px-4 py-2">{formatDateTime(app.scheduledInterview1?.time || '')}</td>
                                <td className="px-4 py-2">{getInterviewerName(app.scheduledInterview1?.interviewerId)}</td>
                                <td className="px-4 py-2">{formatDateTime(app.scheduledInterview2?.time || '')}</td>
                                <td className="px-4 py-2 font-semibold">{app.status.finalResult}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AdminFeedbackView: FC<{
    feedback: InterviewFeedback[],
}> = ({ feedback }) => {

    const exportFeedbackToWord = async () => {
        if (!window.docx || !window.saveAs) {
            alert("导出库加载失败，请刷新页面重试。");
            return;
        }

        const { Document, Packer, Paragraph, TextRun } = window.docx;

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: "拾光文创面试体验反馈汇总", bold: true, size: 32 })],
                        spacing: { after: 400 },
                    }),
                    ...feedback.flatMap((item, index) => [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `反馈 #${index + 1}`, bold: true, size: 24 }),
                                new TextRun({ text: ` (提交于: ${formatDateTime(item.submissionDate)})`, size: 18, color: "888888", italics: true }),
                            ]
                        }),
                        new Paragraph({
                            children: [new TextRun(item.feedbackText)],
                            spacing: { after: 300 },
                        }),
                        new Paragraph({ text: "---" }),
                    ])
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        window.saveAs(blob, "面试体验反馈.docx");
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">面试体验反馈</h1>
                <button onClick={exportFeedbackToWord} className="px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-all transform active:scale-95 flex items-center gap-2" disabled={feedback.length === 0}>
                    <Icon name="download" className="w-4 h-4"/>
                    下载反馈 (Word)
                </button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
                {feedback.length > 0 ? (
                    feedback.map(item => (
                        <div key={item.id} className="border-b pb-4 last:border-b-0">
                            <p className="text-sm text-gray-500 mb-2">提交于: {formatDateTime(item.submissionDate)}</p>
                            <p className="text-gray-800 whitespace-pre-wrap">{item.feedbackText}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 py-8">暂无反馈</p>
                )}
            </div>
        </div>
    );
};


const ApplicantDetailModal: FC<{
    applicant: Applicant | null;
    onClose: () => void;
    updateStatus: (id: string, stage: keyof Applicant['status'], value: ApplicationStatus | FinalResult) => void;
}> = React.memo(({ applicant, onClose, updateStatus }) => {
    const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
    const [isLoadingResume, setIsLoadingResume] = useState(false);

    useEffect(() => {
        let objectUrl: string | undefined;

        if (applicant) {
            setIsLoadingResume(true);
            setResumePreviewUrl(null);
            getResumeFromDB(applicant.id)
                .then(file => {
                    if (file) {
                        objectUrl = URL.createObjectURL(file);
                        setResumePreviewUrl(objectUrl);
                    }
                })
                .catch(err => console.error("Failed to load resume from DB", err))
                .finally(() => setIsLoadingResume(false));
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [applicant]);

    if (!applicant) return null;

    const handleStatusChange = (stage: keyof Applicant['status'], value: ApplicationStatus | FinalResult) => {
        updateStatus(applicant.id, stage, value);
    };

    const renderStatusDropdown = (stage: keyof Applicant['status'], options: any, currentValue: any) => (
        <select value={currentValue} onChange={(e) => handleStatusChange(stage, e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white transition-colors">
            {Object.values(options).map((opt) => <option key={opt as string} value={opt as string}>{opt as string}</option>)}
        </select>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in-fast" onClick={onClose}>
            <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-800">{applicant.name} - 详细信息</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors"><Icon name="x" className="w-6 h-6" /></button>
                </div>
                <div className="flex-grow p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-4 rounded-lg shadow">
                            <h3 className="font-bold text-lg mb-3 border-b pb-2">基本信息</h3>
                            <p><strong>学号:</strong> {applicant.studentId}</p>
                            <p><strong>年级:</strong> {applicant.grade}</p>
                            <p><strong>专业:</strong> {applicant.major}</p>
                            <p><strong>联系方式:</strong> {applicant.contact}</p>
                            <p><strong>邮箱:</strong> {applicant.email}</p>
                        </div>
                         <div className="bg-white p-4 rounded-lg shadow">
                            <h3 className="font-bold text-lg mb-3 border-b pb-2">面试流程管理</h3>
                            <div className="space-y-4">
                               <div>
                                   <label className="text-sm font-medium">简历筛选</label>
                                   {renderStatusDropdown('resume', ApplicationStatus, applicant.status.resume)}
                               </div>
                               <div>
                                   <label className="text-sm font-medium">第一轮面试</label>
                                   {renderStatusDropdown('firstInterview', ApplicationStatus, applicant.status.firstInterview)}
                               </div>
                               <div>
                                   <label className="text-sm font-medium">第二轮面试</label>
                                   {renderStatusDropdown('secondInterview', ApplicationStatus, applicant.status.secondInterview)}
                               </div>
                               <div>
                                   <label className="text-sm font-medium">最终结果</label>
                                   {renderStatusDropdown('finalResult', FinalResult, applicant.status.finalResult)}
                               </div>
                           </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow flex flex-col">
                        <h3 className="font-bold text-lg mb-3 border-b pb-2">简历预览</h3>
                        {isLoadingResume ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Icon name="loader-2" className="w-16 h-16 mb-4 animate-spin"/>
                                <p>正在加载简历...</p>
                            </div>
                        ) : resumePreviewUrl ? (
                            <iframe src={resumePreviewUrl} className="w-full flex-grow border rounded-md" title={`${applicant.name}'s Resume`}></iframe>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Icon name="file-question" className="w-16 h-16 mb-4"/>
                                <p>无法加载简历预览或未上传简历。</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});


// --- MAIN APP COMPONENT ---
function App() {
    const [applicants, setApplicants] = useLocalStorage<Applicant[]>('applicants_v5', []);
    const [interviewers, setInterviewers] = useLocalStorage<Interviewer[]>('interviewers_v3', []);
    const [settings, setSettings] = useLocalStorage<RecruitmentSettings>('settings_v3', {
        participatingDepartments: ALL_DEPARTMENTS,
        interviewSlots: [],
        invitationCode: DEFAULT_INVITATION_CODE,
        adminPassword: ADMIN_PASSWORD,
    });
    const [departmentAvailability, setDepartmentAvailability] = useLocalStorage<DepartmentAvailability>('department_availability_v1', {});
    const [feedback, setFeedback] = useLocalStorage<InterviewFeedback[]>('feedback_v1', []);
    const [isAdmin, setIsAdmin] = useState(false);
    const [dbReady, setDbReady] = useState(false);
    
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        initDB().then(success => {
          if (success) {
            setDbReady(true);
            console.log('Database initialized successfully.');
          } else {
            console.error('Database initialization failed.');
            alert('应用数据库初始化失败，部分功能可能无法使用。');
          }
        });
    }, []);

    // Scheduling Logic
    useEffect(() => {
        const scheduleInterviews = (stage: 1 | 2) => {
            let changed = false;
            
            const applicantsToSchedule = applicants.filter(app => {
                if (stage === 1) return app.status.resume === ApplicationStatus.Passed && !app.scheduledInterview1;
                if (stage === 2) return app.status.firstInterview === ApplicationStatus.Passed && !app.scheduledInterview2;
                return false;
            });
            
            if (applicantsToSchedule.length === 0) return;

            const updatedApplicants = [...applicants];

            for(const app of applicantsToSchedule) {
                const dept = app.firstChoice; // Scheduling primarily based on first choice
                const deptInterviewers = interviewers.filter(i => i.department === dept);
                if (deptInterviewers.length === 0) continue;

                // For stage 1, use availableTimes1. For stage 2, fallback to availableTimes1 if not specified.
                const relevantTimes = stage === 1 ? app.availableTimes1 : (app.availableTimes2.length > 0 ? app.availableTimes2 : app.availableTimes1);

                const possibleSlots = relevantTimes.filter(slotId => {
                     const capacity = departmentAvailability[dept]?.[slotId] || 0;
                     if (capacity === 0) return false;
                     const currentBookings = updatedApplicants.filter(a => (stage === 1 ? a.scheduledInterview1 : a.scheduledInterview2)?.slotId === slotId).length;
                     return currentBookings < capacity;
                });
                
                if (possibleSlots.length === 0) continue;
                
                const slotIdToSchedule = possibleSlots[0]; // Simple first-available logic
                const slotDetails = settings.interviewSlots.find(s => s.id === slotIdToSchedule);
                if (!slotDetails) continue;

                // Load balancing: find interviewer with fewest interviews
                const interviewerLoads = deptInterviewers.map(interviewer => ({
                    id: interviewer.id,
                    count: updatedApplicants.filter(a => (stage === 1 ? a.scheduledInterview1 : a.scheduledInterview2)?.interviewerId === interviewer.id).length
                }));
                interviewerLoads.sort((a, b) => a.count - b.count);
                const assignedInterviewerId = interviewerLoads[0].id;
                
                const appIndex = updatedApplicants.findIndex(a => a.id === app.id);
                if(appIndex !== -1) {
                    const scheduledInfo = {
                        interviewerId: assignedInterviewerId,
                        slotId: slotIdToSchedule,
                        time: slotDetails.start,
                    };
                    if (stage === 1) updatedApplicants[appIndex].scheduledInterview1 = scheduledInfo;
                    if (stage === 2) updatedApplicants[appIndex].scheduledInterview2 = scheduledInfo;
                    changed = true;
                }
            }

            if (changed) {
                setApplicants(updatedApplicants);
            }
        };

        scheduleInterviews(1);
        scheduleInterviews(2);
    }, [applicants, interviewers, settings.interviewSlots, setApplicants, departmentAvailability]);


    const addApplicant = useCallback(async (applicantData: Omit<Applicant, 'id' | 'submissionDate' | 'status'>) => {
        if (!dbReady) {
            alert("数据库尚未准备好，请刷新页面稍后再试。");
            return;
        }
        if (!applicantData.resumeFile) {
            alert("简历文件丢失，请重新上传。");
            return;
        }

        const newApplicantId = Date.now().toString();

        try {
            await addResumeToDB(newApplicantId, applicantData.resumeFile);
        } catch (error) {
            console.error("Error saving resume to IndexedDB:", error);
            alert("简历文件存储失败，请重试。");
            return;
        }

        const { resumeFile, ...restOfApplicantData } = applicantData;

        const newApplicant: Applicant = {
            id: newApplicantId,
            ...restOfApplicantData,
            submissionDate: new Date().toISOString(),
            status: {
                resume: ApplicationStatus.Pending,
                firstInterview: ApplicationStatus.Pending,
                secondInterview: ApplicationStatus.Pending,
                finalResult: FinalResult.ToBeDiscussed,
            },
            resumeFile: null, // Ensure file object is not held in state
        };
        setApplicants(prev => [...prev, newApplicant]);
    }, [setApplicants, dbReady]);

    const addFeedback = useCallback((feedbackData: Omit<InterviewFeedback, 'id' | 'submissionDate'>) => {
        const newFeedback: InterviewFeedback = {
            id: Date.now().toString(),
            ...feedbackData,
            submissionDate: new Date().toISOString(),
        };
        setFeedback(prev => [...prev, newFeedback]);
    }, [setFeedback]);

    const updateApplicantStatus = useCallback((id: string, stage: keyof Applicant['status'], value: ApplicationStatus | FinalResult) => {
        setApplicants(prev => prev.map(app => app.id === id ? { ...app, status: { ...app.status, [stage]: value } } : app));
    }, [setApplicants]);

    const addInterviewer = useCallback((interviewerData: Omit<Interviewer, 'id'>) => {
        const newInterviewer: Interviewer = { id: Date.now().toString(), ...interviewerData };
        setInterviewers(prev => [...prev, newInterviewer]);
    }, [setInterviewers]);
    
    const clearInterviewers = useCallback(() => {
        setInterviewers([]);
    }, [setInterviewers]);
    
    const handleAdminLogin = useCallback(() => setIsAdmin(true), []);
    const handleAdminLogout = useCallback(() => {
        setIsAdmin(false);
        navigate('/');
    }, [navigate]);
    
    const handleInterviewerLogout = useCallback(() => {
        navigate('/interviewer');
    }, [navigate]);

    const InterviewerDashboardWrapper = () => {
        const searchParams = new URLSearchParams(useLocation().search);
        const interviewerId = searchParams.get('id');
        const currentInterviewer = useMemo(() => interviewers.find(i => i.id === interviewerId), [interviewers, interviewerId]);

        if (!currentInterviewer) {
            return <Navigate to="/interviewer" />;
        }
        return <InterviewerDashboard 
            interviewer={currentInterviewer} 
            applicants={applicants} 
            updateApplicantStatus={updateApplicantStatus} 
            settings={settings}
            departmentAvailability={departmentAvailability}
            setDepartmentAvailability={setDepartmentAvailability}
            />;
    };

    const Header = () => {
        const searchParams = new URLSearchParams(useLocation().search);
        const interviewerId = searchParams.get('id');
        const isInterviewerLoggedIn = !!interviewerId;

        const navLinkClass = (path: string, startsWith = false) => {
            const currentPath = location.pathname;
            const isActive = startsWith ? currentPath.startsWith(path) : currentPath === path;
            return `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`;
        };

        return (
            <header className="bg-white shadow-md sticky top-0 z-40">
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link to="/" className="flex items-center">
                            <img src="https://cdn.jsdelivr.net/gh/tgx75/wenchuang@main/img/logo.jpg" alt="Logo" className="h-8 w-8 rounded-full" />
                            <span className="font-bold text-xl ml-2 text-gray-800">拾光文创招新</span>
                        </Link>
                        <div className="flex items-center space-x-1 md:space-x-2">
                            <Link to="/apply" className={navLinkClass('/apply')}>新生报名</Link>
                            <Link to="/status" className={navLinkClass('/status')}>录取查询</Link>
                             <Link to={isAdmin ? "/admin/dashboard" : "/admin"} className={navLinkClass('/admin', true)}>管理员</Link>
                             {isAdmin && <button onClick={handleAdminLogout} className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-100"><Icon name="log-out" className="w-4 h-4 inline-block"/></button>}
                             {isInterviewerLoggedIn && <button onClick={handleInterviewerLogout} className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-100"><Icon name="log-out" className="w-4 h-4 inline-block"/></button>}
                        </div>
                    </div>
                     {isAdmin && (
                        <div className="bg-gray-100">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center space-x-6 text-sm font-medium">
                                <Link to="/admin/dashboard" className={`py-2 border-b-2 transition-colors ${location.pathname === '/admin/dashboard' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-600 hover:border-gray-300'}`}>数据中心</Link>
                                <Link to="/admin/applicants" className={`py-2 border-b-2 transition-colors ${location.pathname === '/admin/applicants' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-600 hover:border-gray-300'}`}>所有申请</Link>
                                <Link to="/admin/feedback" className={`py-2 border-b-2 transition-colors ${location.pathname === '/admin/feedback' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-600 hover:border-gray-300'}`}>反馈查看</Link>
                                <Link to="/admin/settings" className={`py-2 border-b-2 transition-colors ${location.pathname === '/admin/settings' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-600 hover:border-gray-300'}`}>招新设置</Link>
                            </div>
                        </div>
                    )}
                </nav>
            </header>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <Header />
            <main className="py-10">
                <Routes>
                    <Route path="/" element={<HomePage settings={settings} />} />
                    <Route path="/apply" element={<ApplicantView addApplicant={addApplicant} settings={settings} departmentAvailability={departmentAvailability} applicants={applicants} />} />
                    <Route path="/status" element={<StudentStatusCheckerPage applicants={applicants} />} />
                    <Route path="/feedback" element={<FeedbackPage addFeedback={addFeedback} />} />
                    <Route path="/register" element={<InterviewerRegisterPage settings={settings} addInterviewer={addInterviewer} />} />
                    
                    {/* Interviewer Routes */}
                    <Route path="/interviewer" element={<InterviewerPortal interviewers={interviewers} />} />
                    <Route path="/interviewer/dashboard" element={<InterviewerDashboardWrapper />} />

                    {/* Admin Routes */}
                    <Route path="/admin" element={!isAdmin ? <AdminLoginPage onLogin={handleAdminLogin} settings={settings} /> : <Navigate to="/admin/dashboard" />} />
                    <Route path="/admin/dashboard" element={isAdmin ? <AdminDashboardPage applicants={applicants} settings={settings} /> : <Navigate to="/admin" />} />
                    <Route path="/admin/settings" element={isAdmin ? <AdminSettingsPage settings={settings} updateSettings={setSettings} clearInterviewers={clearInterviewers} /> : <Navigate to="/admin" />} />
                    <Route path="/admin/applicants" element={isAdmin ? <AdminAllApplicantsView applicants={applicants} interviewers={interviewers} /> : <Navigate to="/admin" />} />
                    <Route path="/admin/feedback" element={isAdmin ? <AdminFeedbackView feedback={feedback} /> : <Navigate to="/admin" />} />

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;