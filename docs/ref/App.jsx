import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  Check,
  X,
  ChevronRight,
  Search,
  Plus,
  Sparkles,
  BookOpen,
  Trash2,
  Copy,
  Edit2,
  MoreVertical,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  Layers,
  Database,
  Cpu,
  Compass,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Eye,
  ExternalLink,
  ShieldCheck,
  Zap,
  User,
  GraduationCap,
  Info,
  ChevronDown,
  Filter,
  CheckSquare,
  Square,
  Lock,
  ArrowRight,
  Settings,
  Share2,
  SlidersHorizontal,
  LayoutGrid
} from 'lucide-react';

// --- MOCK COURSE CATALOG (Realistic University CISC & MATH Courses) ---
const COURSE_CATALOG = [
  {
    id: 'CISC3014',
    code: 'CISC3014',
    title: 'Information Retrieval & Web Search',
    credits: 3,
    dept: 'CISC',
    color: 'indigo',
    description: 'Vector space model, inverted indexes, BM25 ranking, dense semantic search, neural re-ranking, and retrieval evaluation metrics.',
    prereqs: ['CISC2002 Data Structures'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 0, dayName: 'Mon', startTime: '10:00', endTime: '11:30', room: 'E11-201', instructor: 'Prof. K. Wong' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 2, dayName: 'Wed', startTime: '10:00', endTime: '11:30', room: 'E11-201', instructor: 'Prof. K. Wong' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 1, dayName: 'Tue', startTime: '14:00', endTime: '15:30', room: 'E11-201', instructor: 'Dr. M. Chen' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 3, dayName: 'Thu', startTime: '14:00', endTime: '15:30', room: 'E11-201', instructor: 'Dr. M. Chen' }
    ]
  },
  {
    id: 'CISC3025',
    code: 'CISC3025',
    title: 'Artificial Intelligence Principles',
    credits: 3,
    dept: 'CISC',
    color: 'purple',
    description: 'Knowledge representation, search algorithms (A*, minimax), constraint satisfaction, probabilistic reasoning, and intro to reinforcement learning.',
    prereqs: ['CISC2002 Data Structures', 'MATH2001 Linear Algebra'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 1, dayName: 'Tue', startTime: '10:00', endTime: '11:30', room: 'E11-304', instructor: 'Prof. L. Zhang' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 3, dayName: 'Thu', startTime: '10:00', endTime: '11:30', room: 'E11-304', instructor: 'Prof. L. Zhang' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 0, dayName: 'Mon', startTime: '14:00', endTime: '15:30', room: 'E11-304', instructor: 'Dr. S. Roy' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 2, dayName: 'Wed', startTime: '14:00', endTime: '15:30', room: 'E11-304', instructor: 'Dr. S. Roy' }
    ]
  },
  {
    id: 'CISC3020',
    code: 'CISC3020',
    title: 'Cybersecurity & Cryptography',
    credits: 3,
    dept: 'CISC',
    color: 'emerald',
    description: 'Symmetric/asymmetric encryption, cryptographic hashes, network vulnerabilities, authentication protocols, and web security architectures.',
    prereqs: ['CISC3011 Computer Networks'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 1, dayName: 'Tue', startTime: '11:30', endTime: '13:00', room: 'E11-102', instructor: 'Prof. R. Silva' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 3, dayName: 'Thu', startTime: '11:30', endTime: '13:00', room: 'E11-102', instructor: 'Prof. R. Silva' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 0, dayName: 'Mon', startTime: '16:00', endTime: '17:30', room: 'E11-102', instructor: 'Dr. E. Gomez' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 2, dayName: 'Wed', startTime: '16:00', endTime: '17:30', room: 'E11-102', instructor: 'Dr. E. Gomez' }
    ]
  },
  {
    id: 'CISC3003',
    code: 'CISC3003',
    title: 'Operating Systems & Architecture',
    credits: 3,
    dept: 'CISC',
    color: 'amber',
    description: 'Process synchronization, thread scheduling, virtual memory management, file systems, IPC, and kernel concurrency primitives.',
    prereqs: ['CISC2002 Data Structures'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 0, dayName: 'Mon', startTime: '08:30', endTime: '10:00', room: 'E11-103', instructor: 'Prof. D. Thorne' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 2, dayName: 'Wed', startTime: '08:30', endTime: '10:00', room: 'E11-103', instructor: 'Prof. D. Thorne' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 1, dayName: 'Tue', startTime: '16:00', endTime: '17:30', room: 'E11-103', instructor: 'Dr. T. Baker' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 3, dayName: 'Thu', startTime: '16:00', endTime: '17:30', room: 'E11-103', instructor: 'Dr. T. Baker' }
    ]
  },
  {
    id: 'CISC3011',
    code: 'CISC3011',
    title: 'Computer Networks & Protocols',
    credits: 3,
    dept: 'CISC',
    color: 'teal',
    description: 'OSI & TCP/IP stack, routing protocols (BGP, OSPF), reliable transport (TCP congestion control), DNS, HTTP/3, and socket programming.',
    prereqs: ['CISC2002 Data Structures'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 1, dayName: 'Tue', startTime: '08:30', endTime: '10:00', room: 'E11-205', instructor: 'Prof. H. Tan' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 3, dayName: 'Thu', startTime: '08:30', endTime: '10:00', room: 'E11-205', instructor: 'Prof. H. Tan' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 0, dayName: 'Mon', startTime: '11:30', endTime: '13:00', room: 'E11-205', instructor: 'Dr. A. Vance' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 2, dayName: 'Wed', startTime: '11:30', endTime: '13:00', room: 'E11-205', instructor: 'Dr. A. Vance' }
    ]
  },
  {
    id: 'MATH2001',
    code: 'MATH2001',
    title: 'Linear Algebra & Matrix Analysis',
    credits: 3,
    dept: 'MATH',
    color: 'rose',
    description: 'Vector spaces, matrix decompositions (LU, QR, SVD), eigenvalues, linear transformations, and applications in data representations.',
    prereqs: ['MATH1001 Calculus I'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 0, dayName: 'Mon', startTime: '14:00', endTime: '15:30', room: 'W21-101', instructor: 'Prof. J. Euler' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 2, dayName: 'Wed', startTime: '14:00', endTime: '15:30', room: 'W21-101', instructor: 'Prof. J. Euler' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 1, dayName: 'Tue', startTime: '14:00', endTime: '15:30', room: 'W21-101', instructor: 'Dr. C. Gauss' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 3, dayName: 'Thu', startTime: '14:00', endTime: '15:30', room: 'W21-101', instructor: 'Dr. C. Gauss' }
    ]
  },
  {
    id: 'CISC4010',
    code: 'CISC4010',
    title: 'Deep Learning & Neural Systems',
    credits: 3,
    dept: 'CISC',
    color: 'cyan',
    description: 'Backpropagation, Convolutional Networks, Transformers, Attention Mechanisms, Generative models (VAEs, Diffusion), and PyTorch frameworks.',
    prereqs: ['CISC3025 Artificial Intelligence'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 1, dayName: 'Tue', startTime: '16:00', endTime: '17:30', room: 'E11-304', instructor: 'Prof. Y. LeCun' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 3, dayName: 'Thu', startTime: '16:00', endTime: '17:30', room: 'E11-304', instructor: 'Prof. Y. LeCun' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 4, dayName: 'Fri', startTime: '09:30', endTime: '12:30', room: 'E11-304', instructor: 'Dr. G. Hinton' }
    ]
  },
  {
    id: 'CISC2004',
    code: 'CISC2004',
    title: 'Object-Oriented Software Design',
    credits: 3,
    dept: 'CISC',
    color: 'sky',
    description: 'Design patterns (GoF), clean architecture, unit testing, CI/CD, Git collaboration, and agile software development workflows.',
    prereqs: ['CISC1001 Programming Principles'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 0, dayName: 'Mon', startTime: '13:00', endTime: '14:30', room: 'E11-203', instructor: 'Prof. B. Meyer' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 2, dayName: 'Wed', startTime: '13:00', endTime: '14:30', room: 'E11-203', instructor: 'Prof. B. Meyer' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 1, dayName: 'Tue', startTime: '13:00', endTime: '14:30', room: 'E11-203', instructor: 'Dr. M. Fowler' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 3, dayName: 'Thu', startTime: '13:00', endTime: '14:30', room: 'E11-203', instructor: 'Dr. M. Fowler' }
    ]
  },
  {
    id: 'CISC3030',
    code: 'CISC3030',
    title: 'Cloud Computing & Distributed Systems',
    credits: 3,
    dept: 'CISC',
    color: 'orange',
    description: 'Microservices, consensus algorithms (Raft/Paxos), Docker container orchestration, Kubernetes, serverless paradigms, and distributed data stores.',
    prereqs: ['CISC3003 Operating Systems'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 1, dayName: 'Tue', startTime: '14:30', endTime: '16:00', room: 'E11-105', instructor: 'Dr. V. Cerf' },
      { id: 'SEC01-B', name: 'L01 (Lecture)', day: 3, dayName: 'Thu', startTime: '14:30', endTime: '16:00', room: 'E11-105', instructor: 'Dr. V. Cerf' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 4, dayName: 'Fri', startTime: '14:00', endTime: '17:00', room: 'E11-105', instructor: 'Prof. W. Vogels' }
    ]
  },
  {
    id: 'CISC3040',
    code: 'CISC3040',
    title: 'Human-Computer Interaction & UX',
    credits: 3,
    dept: 'CISC',
    color: 'pink',
    description: 'User-centered design principles, heuristic evaluations, usability testing, micro-interactions, responsive UI architectures, and accessibility standards.',
    prereqs: ['CISC1001 Programming Principles'],
    sections: [
      { id: 'SEC01', name: 'L01 (Lecture)', day: 4, dayName: 'Fri', startTime: '13:00', endTime: '16:00', room: 'E11-206', instructor: 'Prof. D. Norman' },
      { id: 'SEC02', name: 'L02 (Lecture)', day: 0, dayName: 'Mon', startTime: '16:00', endTime: '17:30', room: 'E11-206', instructor: 'Dr. J. Nielsen' },
      { id: 'SEC02-B', name: 'L02 (Lecture)', day: 2, dayName: 'Wed', startTime: '16:00', endTime: '17:30', room: 'E11-206', instructor: 'Dr. J. Nielsen' }
    ]
  }
];

// Color definitions for calendar blocks
const COLOR_MAP = {
  indigo: { bg: 'bg-indigo-50 border-indigo-200 text-indigo-900', pill: 'bg-indigo-500', bar: 'border-l-indigo-500', light: 'bg-indigo-100 text-indigo-700' },
  purple: { bg: 'bg-purple-50 border-purple-200 text-purple-900', pill: 'bg-purple-500', bar: 'border-l-purple-500', light: 'bg-purple-100 text-purple-700' },
  emerald: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-900', pill: 'bg-emerald-500', bar: 'border-l-emerald-500', light: 'bg-emerald-100 text-emerald-700' },
  amber: { bg: 'bg-amber-50 border-amber-200 text-amber-900', pill: 'bg-amber-500', bar: 'border-l-amber-500', light: 'bg-amber-100 text-amber-700' },
  teal: { bg: 'bg-teal-50 border-teal-200 text-teal-900', pill: 'bg-teal-500', bar: 'border-l-teal-500', light: 'bg-teal-100 text-teal-700' },
  rose: { bg: 'bg-rose-50 border-rose-200 text-rose-900', pill: 'bg-rose-500', bar: 'border-l-rose-500', light: 'bg-rose-100 text-rose-700' },
  cyan: { bg: 'bg-cyan-50 border-cyan-200 text-cyan-900', pill: 'bg-cyan-500', bar: 'border-l-cyan-500', light: 'bg-cyan-100 text-cyan-700' },
  sky: { bg: 'bg-sky-50 border-sky-200 text-sky-900', pill: 'bg-sky-500', bar: 'border-l-sky-500', light: 'bg-sky-100 text-sky-700' },
  orange: { bg: 'bg-orange-50 border-orange-200 text-orange-900', pill: 'bg-orange-500', bar: 'border-l-orange-500', light: 'bg-orange-100 text-orange-700' },
  pink: { bg: 'bg-pink-50 border-pink-200 text-pink-900', pill: 'bg-pink-500', bar: 'border-l-pink-500', light: 'bg-pink-100 text-pink-700' }
};

// Initial Timetable Projects
const INITIAL_TIMETABLES = [
  {
    id: 'tp-1',
    title: 'Fall 2026 — Main Plan',
    semester: 'Fall 2026',
    updatedAt: 'Just now',
    enrolledCourses: [
      { courseId: 'CISC3014', sectionGroup: 'SEC01' },
      { courseId: 'CISC3020', sectionGroup: 'SEC01' },
      { courseId: 'CISC3003', sectionGroup: 'SEC01' },
      { courseId: 'CISC3025', sectionGroup: 'SEC01' },
      { courseId: 'MATH2001', sectionGroup: 'SEC01' }
    ]
  },
  {
    id: 'tp-2',
    title: 'Fall 2026 — Alternative',
    semester: 'Fall 2026',
    updatedAt: '2 days ago',
    enrolledCourses: [
      { courseId: 'CISC3014', sectionGroup: 'SEC02' },
      { courseId: 'CISC3011', sectionGroup: 'SEC01' },
      { courseId: 'CISC2004', sectionGroup: 'SEC02' },
      { courseId: 'MATH2001', sectionGroup: 'SEC02' }
    ]
  },
  {
    id: 'tp-3',
    title: 'Spring 2027 Preview',
    semester: 'Spring 2027',
    updatedAt: '1 week ago',
    enrolledCourses: [
      { courseId: 'CISC4010', sectionGroup: 'SEC01' },
      { courseId: 'CISC3030', sectionGroup: 'SEC01' },
      { courseId: 'CISC3040', sectionGroup: 'SEC02' }
    ]
  },
  {
    id: 'tp-4',
    title: 'Cybersecurity Track',
    semester: 'Fall 2026',
    updatedAt: '3 days ago',
    enrolledCourses: [
      { courseId: 'CISC3020', sectionGroup: 'SEC01' },
      { courseId: 'CISC3011', sectionGroup: 'SEC01' },
      { courseId: 'CISC3003', sectionGroup: 'SEC02' },
      { courseId: 'CISC3014', sectionGroup: 'SEC02' },
      { courseId: 'CISC3030', sectionGroup: 'SEC01' }
    ]
  },
  {
    id: 'tp-5',
    title: 'Balanced Schedule',
    semester: 'Fall 2026',
    updatedAt: 'Oct 28',
    enrolledCourses: [
      { courseId: 'CISC3025', sectionGroup: 'SEC02' },
      { courseId: 'CISC3011', sectionGroup: 'SEC02' },
      { courseId: 'CISC2004', sectionGroup: 'SEC01' },
      { courseId: 'MATH2001', sectionGroup: 'SEC01' }
    ]
  },
  {
    id: 'tp-6',
    title: 'Weekend-Free Plan',
    semester: 'Fall 2026',
    updatedAt: 'Oct 20',
    enrolledCourses: [
      { courseId: 'CISC3014', sectionGroup: 'SEC01' },
      { courseId: 'CISC3020', sectionGroup: 'SEC01' },
      { courseId: 'CISC3025', sectionGroup: 'SEC01' },
      { courseId: 'CISC3011', sectionGroup: 'SEC01' },
      { courseId: 'MATH2001', sectionGroup: 'SEC02' }
    ]
  }
];

const INITIAL_PROFILE = {
  name: 'Alex Rivera',
  studentId: 'B4-2023-8821',
  major: 'B.Sc. Computer Science',
  year: 'Year 2 (Sophomore)',
  targetCredits: 15,
  completedCourses: ['CISC1001', 'CISC2002', 'MATH1001'],
  interests: ['Information Retrieval', 'Cybersecurity', 'Artificial Intelligence'],
  freeDayPreference: 'Friday',
  earliestTime: '08:30',
  latestTime: '17:30'
};

// Global pure helpers to ensure no hoisting or ReferenceError issues
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const getRenderableMeetings = (enrolledCourses) => {
  if (!enrolledCourses || !Array.isArray(enrolledCourses)) return [];
  const meetings = [];
  enrolledCourses.forEach((item) => {
    const course = COURSE_CATALOG.find((c) => c.id === item.courseId);
    if (!course) return;
    const activeSections = course.sections.filter((s) => s.id.startsWith(item.sectionGroup));
    activeSections.forEach((sec) => {
      meetings.push({
        courseId: course.id,
        code: course.code,
        title: course.title,
        credits: course.credits,
        color: course.color,
        sectionGroup: item.sectionGroup,
        sectionName: sec.name,
        sectionId: sec.id,
        day: sec.day,
        dayName: sec.dayName,
        startTime: sec.startTime,
        endTime: sec.endTime,
        room: sec.room,
        instructor: sec.instructor
      });
    });
  });
  return meetings;
};

const detectConflicts = (meetings) => {
  const conflicts = new Set();
  if (!meetings || !Array.isArray(meetings)) return conflicts;
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i];
      const b = meetings[j];
      if (a.day === b.day) {
        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);

        if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
          conflicts.add(a.courseId);
          conflicts.add(b.courseId);
        }
      }
    }
  }
  return conflicts;
};

export default function App() {
  // Navigation: 'gallery' | 'editor' | 'research'
  const [currentView, setCurrentView] = useState('gallery');
  const [timetables, setTimetables] = useState(() => {
    try {
      const saved = localStorage.getItem('termpilot_timetables_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_TIMETABLES;
    } catch {
      return INITIAL_TIMETABLES;
    }
  });

  const [activeTimetableId, setActiveTimetableId] = useState('tp-1');
  const [academicProfile, setAcademicProfile] = useState(INITIAL_PROFILE);
  const [gallerySearch, setGallerySearch] = useState('');

  // Modals & Panels
  const [isNewTimetableModalOpen, setIsNewTimetableModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCatalogDrawerOpen, setIsCatalogDrawerOpen] = useState(false);
  const [selectedBlockDetails, setSelectedBlockDetails] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeProposalModal, setActiveProposalModal] = useState(null);

  // Popover menus for top bar
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const settingsMenuRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setIsSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Safe persistence
  useEffect(() => {
    try {
      localStorage.setItem('termpilot_timetables_v2', JSON.stringify(timetables));
    } catch (e) {
      console.error(e);
    }
  }, [timetables]);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  const activeTimetable = useMemo(() => {
    return timetables.find((t) => t.id === activeTimetableId) || timetables[0] || INITIAL_TIMETABLES[0];
  }, [timetables, activeTimetableId]);

  const activeMeetings = useMemo(() => {
    return getRenderableMeetings(activeTimetable?.enrolledCourses || []);
  }, [activeTimetable]);

  const activeCredits = useMemo(() => {
    const unique = [];
    activeMeetings.forEach((m) => {
      if (!unique.find((u) => u.courseId === m.courseId)) unique.push(m);
    });
    return unique.reduce((acc, curr) => acc + (curr.credits || 0), 0);
  }, [activeMeetings]);

  const activeConflicts = useMemo(() => {
    return detectConflicts(activeMeetings);
  }, [activeMeetings]);

  const handleCreateTimetable = (title, semester, duplicateFromId = null) => {
    let enrolled = [];
    if (duplicateFromId) {
      const source = timetables.find((t) => t.id === duplicateFromId);
      if (source) enrolled = [...source.enrolledCourses];
    }
    const newProject = {
      id: `tp-${Date.now()}`,
      title: title || 'Untitled Timetable',
      semester: semester || 'Fall 2026',
      updatedAt: 'Just now',
      enrolledCourses: enrolled
    };
    setTimetables([newProject, ...timetables]);
    setActiveTimetableId(newProject.id);
    setIsNewTimetableModalOpen(false);
    setCurrentView('editor');
    showToast(`Created new timetable: "${newProject.title}"`);
  };

  const handleDuplicate = (id) => {
    const item = timetables.find((t) => t.id === id);
    if (!item) return;
    const dup = {
      ...item,
      id: `tp-${Date.now()}`,
      title: `${item.title} (Copy)`,
      updatedAt: 'Just now'
    };
    setTimetables([dup, ...timetables]);
    showToast(`Duplicated "${item.title}"`);
  };

  const handleDelete = (id) => {
    setTimetables(timetables.filter((t) => t.id !== id));
    setConfirmDeleteId(null);
    showToast('Timetable deleted');
    if (activeTimetableId === id && timetables.length > 1) {
      setActiveTimetableId(timetables.find((t) => t.id !== id).id);
    }
  };

  const handleResetData = () => {
    setTimetables(INITIAL_TIMETABLES);
    setAcademicProfile(INITIAL_PROFILE);
    setActiveTimetableId('tp-1');
    showToast('Reset to demo baseline successfully.');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* NotebookLM-Style Clean Top Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 md:px-6 py-2.5 flex items-center justify-between">
        {/* Left Section: Contextual controls */}
        <div className="flex items-center gap-3">
          {currentView === 'gallery' ? (
            <div
              onClick={() => setCurrentView('gallery')}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Compass className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-slate-900">TermPilot AI</span>
            </div>
          ) : currentView === 'editor' && activeTimetable ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('gallery')}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                title="Back to Timetables"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <select
                  value={activeTimetable.id}
                  onChange={(e) => setActiveTimetableId(e.target.value)}
                  className="font-semibold text-sm text-slate-900 bg-transparent hover:bg-slate-100 rounded-lg px-2 py-1 cursor-pointer focus:outline-none transition-colors border-0"
                >
                  {timetables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full hidden sm:inline-block">
                  {activeTimetable.semester}
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {activeCredits} cr
                </span>
                {activeConflicts.size > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                    <span>{activeConflicts.size} conflict{activeConflicts.size > 1 ? 's' : ''}</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('editor')}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                title="Back to Editor"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-sm text-slate-900">CISC3014 Research Inspector</span>
            </div>
          )}
        </div>

        {/* Right Section: Action buttons & user profile bubble */}
        <div className="flex items-center gap-2">
          {currentView === 'gallery' ? (
            <button
              onClick={() => setIsNewTimetableModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Timetable</span>
            </button>
          ) : currentView === 'editor' ? (
            <button
              onClick={() => setIsCatalogDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-full border border-indigo-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Course</span>
            </button>
          ) : null}

          {/* Share button only shown when editing a specific timetable */}
          {currentView === 'editor' && activeTimetable && (
            <button
              onClick={() => showToast(`Share link for "${activeTimetable.title}" copied to clipboard!`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"
              title={`Share ${activeTimetable.title}`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Share</span>
            </button>
          )}

          {/* Settings Menu */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
              className={`p-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition ${
                isSettingsMenuOpen ? 'bg-slate-100 text-slate-900' : ''
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isSettingsMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    setCurrentView(currentView === 'research' ? 'editor' : 'research');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 transition"
                >
                  <Cpu className="w-3.5 h-3.5 text-violet-600" />
                  <span>CISC3014 Inspector</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    handleResetData();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo Data</span>
                </button>
              </div>
            )}
          </div>

          {/* Google-style User Profile Avatar Bubble */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="relative rounded-full focus:outline-none p-0.5 hover:ring-2 hover:ring-indigo-300 transition"
              title="User Account"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-semibold text-xs flex items-center justify-center shadow-sm">
                {academicProfile.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-50 text-xs">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {academicProfile.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-semibold text-slate-900 truncate">{academicProfile.name}</h4>
                    <p className="text-[11px] text-slate-500 truncate">{academicProfile.major}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-2 hover:bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center justify-between transition"
                  >
                    <span className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                      Academic Profile
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main View Router */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'gallery' && (
          <TimetableGallery
            timetables={timetables}
            searchQuery={gallerySearch}
            setSearchQuery={setGallerySearch}
            onOpenTimetable={(id) => {
              setActiveTimetableId(id);
              setCurrentView('editor');
            }}
            onNewTimetable={() => setIsNewTimetableModalOpen(true)}
            onDuplicate={handleDuplicate}
            onDelete={(id) => setConfirmDeleteId(id)}
            onShare={(item) => showToast(`Share link for "${item.title}" copied to clipboard!`)}
            getRenderableMeetings={getRenderableMeetings}
          />
        )}

        {currentView === 'editor' && activeTimetable && (
          <TimetableEditor
            timetable={activeTimetable}
            allTimetables={timetables}
            onSelectTimetable={setActiveTimetableId}
            onBackToGallery={() => setCurrentView('gallery')}
            getRenderableMeetings={getRenderableMeetings}
            detectConflicts={detectConflicts}
            onOpenCatalog={() => setIsCatalogDrawerOpen(true)}
            onSelectBlock={(block) => setSelectedBlockDetails(block)}
            academicProfile={academicProfile}
            onUpdateTimetable={(updated) => {
              setTimetables(timetables.map((t) => (t.id === updated.id ? updated : t)));
            }}
            onOpenProposalPreview={(proposal) => {
              setActiveProposalModal({
                proposal,
                currentTimetable: activeTimetable
              });
            }}
            showToast={showToast}
          />
        )}

        {currentView === 'research' && (
          <ResearchInspector onBack={() => setCurrentView('editor')} />
        )}
      </main>

      {/* MODALS & DRAWERS */}
      {isNewTimetableModalOpen && (
        <NewTimetableModal
          timetables={timetables}
          onClose={() => setIsNewTimetableModalOpen(false)}
          onCreate={handleCreateTimetable}
        />
      )}

      {isProfileModalOpen && (
        <AcademicProfileModal
          profile={academicProfile}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={(newProfile) => {
            setAcademicProfile(newProfile);
            setIsProfileModalOpen(false);
            showToast('Academic profile updated.');
          }}
        />
      )}

      {isCatalogDrawerOpen && activeTimetable && (
        <CourseCatalogDrawer
          currentEnrolled={activeTimetable.enrolledCourses}
          allCourses={COURSE_CATALOG}
          onClose={() => setIsCatalogDrawerOpen(false)}
          onAddCourse={(courseId, sectionGroup) => {
            const exists = activeTimetable.enrolledCourses.find((c) => c.courseId === courseId);
            let updatedList = [];
            if (exists) {
              updatedList = activeTimetable.enrolledCourses.map((c) =>
                c.courseId === courseId ? { ...c, sectionGroup } : c
              );
            } else {
              updatedList = [...activeTimetable.enrolledCourses, { courseId, sectionGroup }];
            }
            const updated = {
              ...activeTimetable,
              enrolledCourses: updatedList,
              updatedAt: 'Just now'
            };
            setTimetables(timetables.map((t) => (t.id === updated.id ? updated : t)));
            showToast(`Added ${courseId} (${sectionGroup}) to timetable`);
          }}
          existingMeetings={getRenderableMeetings(activeTimetable.enrolledCourses)}
        />
      )}

      {selectedBlockDetails && activeTimetable && (
        <CourseBlockDetailsModal
          block={selectedBlockDetails}
          course={COURSE_CATALOG.find((c) => c.id === selectedBlockDetails.courseId)}
          onClose={() => setSelectedBlockDetails(null)}
          onSwitchSection={(newSectionGroup) => {
            const updatedList = activeTimetable.enrolledCourses.map((item) =>
              item.courseId === selectedBlockDetails.courseId
                ? { ...item, sectionGroup: newSectionGroup }
                : item
            );
            const updated = {
              ...activeTimetable,
              enrolledCourses: updatedList,
              updatedAt: 'Just now'
            };
            setTimetables(timetables.map((t) => (t.id === updated.id ? updated : t)));
            setSelectedBlockDetails(null);
            showToast(`Switched ${selectedBlockDetails.code} to ${newSectionGroup}`);
          }}
          onRemoveCourse={() => {
            const updatedList = activeTimetable.enrolledCourses.filter(
              (item) => item.courseId !== selectedBlockDetails.courseId
            );
            const updated = {
              ...activeTimetable,
              enrolledCourses: updatedList,
              updatedAt: 'Just now'
            };
            setTimetables(timetables.map((t) => (t.id === updated.id ? updated : t)));
            setSelectedBlockDetails(null);
            showToast(`Removed ${selectedBlockDetails.code} from timetable`);
          }}
        />
      )}

      {activeProposalModal && (
        <ProposalPreviewModal
          proposal={activeProposalModal.proposal}
          currentTimetable={activeProposalModal.currentTimetable}
          onClose={() => setActiveProposalModal(null)}
          onApplyToCurrent={() => {
            const updated = {
              ...activeProposalModal.currentTimetable,
              enrolledCourses: activeProposalModal.proposal.enrolledCourses,
              updatedAt: 'Updated via TermPilot AI'
            };
            setTimetables(timetables.map((t) => (t.id === updated.id ? updated : t)));
            setActiveProposalModal(null);
            showToast(`Applied "${activeProposalModal.proposal.title}" to ${updated.title}`);
          }}
          onSaveAsNew={(title) => {
            const newTimetable = {
              id: `tp-${Date.now()}`,
              title: title || `${activeProposalModal.proposal.title} (From AI)`,
              semester: activeProposalModal.currentTimetable.semester,
              updatedAt: 'Just now',
              enrolledCourses: activeProposalModal.proposal.enrolledCourses
            };
            setTimetables([newTimetable, ...timetables]);
            setActiveTimetableId(newTimetable.id);
            setActiveProposalModal(null);
            showToast(`Saved proposal as new timetable: "${newTimetable.title}"`);
          }}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-slate-900">Delete Timetable Project?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This will permanently delete this saved timetable schedule. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-sm"
              >
                Delete Timetable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SCREEN 1: My Timetables (Notebook Gallery)
// =========================================================================
function TimetableGallery({
  timetables,
  searchQuery,
  setSearchQuery,
  onOpenTimetable,
  onNewTimetable,
  onDuplicate,
  onDelete,
  onShare,
  getRenderableMeetings
}) {
  const filtered = useMemo(() => {
    return timetables.filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.semester.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [timetables, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Timetables</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
            {timetables.length}
          </span>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search timetables or semester..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <TimetableCard
            key={item.id}
            timetable={item}
            onOpen={() => onOpenTimetable(item.id)}
            onDuplicate={() => onDuplicate(item.id)}
            onDelete={() => onDelete(item.id)}
            onShare={() => onShare(item)}
            meetings={getRenderableMeetings(item.enrolledCourses)}
          />
        ))}

        <div
          onClick={onNewTimetable}
          className="group border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[240px] text-center cursor-pointer transition-all bg-white/40 hover:bg-indigo-50/20"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
            Create New Timetable
          </span>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No matching timetables found</p>
          <p className="text-xs text-slate-400 mt-0.5">Try a different search term.</p>
        </div>
      )}
    </div>
  );
}

function TimetableCard({ timetable, onOpen, onDuplicate, onDelete, onShare, meetings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalCredits = useMemo(() => {
    return meetings
      .reduce((acc, m) => {
        if (!acc.find((item) => item.courseId === m.courseId)) {
          acc.push(m);
        }
        return acc;
      }, [])
      .reduce((sum, item) => sum + item.credits, 0);
  }, [meetings]);

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden relative">
      <div onClick={onOpen} className="p-4 cursor-pointer flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
            {timetable.semester}
          </span>
          <span className="text-[11px] text-slate-600 font-medium">
            {totalCredits} Credits • {timetable.enrolledCourses.length} Courses
          </span>
        </div>

        <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-3">
          {timetable.title}
        </h3>

        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 h-32 flex flex-col justify-between">
          <div className="grid grid-cols-5 text-[9px] text-center font-medium text-slate-500 pb-1 border-b border-slate-200">
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
          </div>

          <div className="grid grid-cols-5 gap-1 flex-1 pt-1 relative h-full">
            {[0, 1, 2, 3, 4].map((dayIndex) => {
              const dayMeetings = meetings.filter((m) => m.day === dayIndex);
              return (
                <div key={dayIndex} className="bg-white rounded h-full relative overflow-hidden flex flex-col gap-0.5 p-0.5">
                  {dayMeetings.map((m, idx) => {
                    const color = COLOR_MAP[m.color] || COLOR_MAP.indigo;
                    return (
                      <div
                        key={idx}
                        className={`w-full rounded text-[8px] px-1 py-0.5 font-semibold truncate ${color.bg} border-l-2 ${color.bar}`}
                        title={`${m.code}: ${m.startTime}-${m.endTime}`}
                      >
                        {m.code.replace('CISC', '').replace('MATH', '')}
                      </div>
                    );
                  })}
                  {dayMeetings.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center opacity-30">
                      <span className="text-[8px] text-slate-300">-</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-500">Updated {timetable.updatedAt}</span>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-1 w-36 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20 text-xs">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onOpen();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-slate-700 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Open Editor</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onShare();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-slate-700 flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Share Link</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDuplicate();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-slate-700 flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Duplicate</span>
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SCREEN 2: Timetable Editor
// =========================================================================
function TimetableEditor({
  timetable,
  allTimetables,
  onSelectTimetable,
  onBackToGallery,
  getRenderableMeetings,
  detectConflicts,
  onOpenCatalog,
  onSelectBlock,
  academicProfile,
  onUpdateTimetable,
  onOpenProposalPreview,
  showToast
}) {
  const [isCopilotCollapsed, setIsCopilotCollapsed] = useState(false);

  const meetings = useMemo(() => {
    return getRenderableMeetings(timetable.enrolledCourses);
  }, [timetable, getRenderableMeetings]);

  const conflicts = useMemo(() => {
    return detectConflicts(meetings);
  }, [meetings, detectConflicts]);

  const [historyStack, setHistoryStack] = useState([timetable.enrolledCourses]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const handleApplyState = (newCourses) => {
    const updated = {
      ...timetable,
      enrolledCourses: newCourses,
      updatedAt: 'Just now'
    };
    onUpdateTimetable(updated);
    const newHistory = historyStack.slice(0, historyIndex + 1);
    setHistoryStack([...newHistory, newCourses]);
    setHistoryIndex(newHistory.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetCourses = historyStack[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onUpdateTimetable({
        ...timetable,
        enrolledCourses: targetCourses,
        updatedAt: 'Undo action'
      });
      showToast('Undid change');
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50">
      <div
        className={`${
          isCopilotCollapsed ? 'w-12' : 'w-[320px] md:w-[360px] lg:w-[390px]'
        } border-r border-slate-200 bg-white flex flex-col shrink-0 transition-all duration-300 relative z-10`}
      >
        <CopilotPanel
          isCollapsed={isCopilotCollapsed}
          onToggleCollapse={() => setIsCopilotCollapsed(!isCopilotCollapsed)}
          timetable={timetable}
          academicProfile={academicProfile}
          onOpenProposalPreview={onOpenProposalPreview}
          onApplyDirectChanges={(newCourses) => handleApplyState(newCourses)}
          showToast={showToast}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-4 lg:p-6">
        <WeeklyCalendar
          meetings={meetings}
          conflicts={conflicts}
          onSelectBlock={onSelectBlock}
          onOpenCatalog={onOpenCatalog}
          onUndo={handleUndo}
          canUndo={historyIndex > 0}
        />
      </div>
    </div>
  );
}

// =========================================================================
// COPILOT PANEL
// =========================================================================
function CopilotPanel({
  isCollapsed,
  onToggleCollapse,
  timetable,
  academicProfile,
  onOpenProposalPreview,
  showToast
}) {
  const [messages, setMessages] = useState([
    {
      id: 'm-init',
      sender: 'agent',
      text: `Hello ${academicProfile.name}! I am synced with **${timetable.title}**. Ask me to optimize your semester, check conflicts, or find electives.`,
      timestamp: '10:00 AM'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const chatScrollRef = useRef(null);

  const AGENT_STEPS = [
    'Parsing student academic & scheduling constraints...',
    'Querying university catalog with BM25 & Dense retrieval...',
    'Verifying prerequisite completion (CISC2002, MATH1001)...',
    'Filtering compatible lecture & lab sections...',
    'Performing multi-objective constraint satisfaction...',
    'Eliminating time conflicts across M-F...',
    'Finalizing 3 optimal semester proposals...'
  ];

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, currentStepIndex]);

  const handleSendMessage = (textToSend) => {
    const query = (textToSend || inputVal).trim();
    if (!query) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsProcessing(true);
    setCurrentStepIndex(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < AGENT_STEPS.length) {
        setCurrentStepIndex(step);
      } else {
        clearInterval(interval);
        finalizeAgentResponse(query);
      }
    }, 400);
  };

  const finalizeAgentResponse = (query) => {
    setIsProcessing(false);
    const qLower = query.toLowerCase();

    if (qLower.includes('wednesday') && (qLower.includes('free') || qLower.includes('cybersecurity'))) {
      const refinementProposal = {
        id: 'prop-refine-wed',
        title: 'Wednesday-Free Schedule',
        strategy: 'Refined Revision',
        summary: 'Protected CISC3020 (Cybersecurity) in L01. Switched CISC3014, CISC3003, and CISC3025 to Tuesday/Thursday sections, clearing Wednesday entirely.',
        credits: 15,
        campusDays: 'Mon, Tue, Thu (Wed & Fri Free)',
        enrolledCourses: [
          { courseId: 'CISC3020', sectionGroup: 'SEC01' },
          { courseId: 'CISC3014', sectionGroup: 'SEC02' },
          { courseId: 'CISC3003', sectionGroup: 'SEC02' },
          { courseId: 'CISC3025', sectionGroup: 'SEC01' },
          { courseId: 'CISC2004', sectionGroup: 'SEC01' }
        ],
        diff: {
          added: ['CISC2004 (L01)'],
          modified: ['CISC3014 (SEC01 -> SEC02)', 'CISC3003 (SEC01 -> SEC02)'],
          protected: ['CISC3020 (L01: Tue/Thu 11:30)']
        }
      };

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'agent',
          text: `I have analyzed your schedule. **CISC3020 (Cybersecurity)** was preserved in its existing section (Tue/Thu 11:30). By shifting CISC3014 and CISC3003 to their alternate afternoon sections, **Wednesday is now completely free** without credit loss!`,
          proposal: refinementProposal,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      return;
    }

    const proposalA = {
      id: 'prop-balanced',
      title: 'Balanced Academic Plan',
      strategy: 'Balanced Distribution',
      summary: 'Distributes 15 credits across Mon-Thu with zero classes on Friday. Even cognitive load between theory and coding.',
      credits: 15,
      campusDays: 'Mon, Tue, Wed, Thu',
      enrolledCourses: [
        { courseId: 'CISC3014', sectionGroup: 'SEC01' },
        { courseId: 'CISC3025', sectionGroup: 'SEC01' },
        { courseId: 'CISC3020', sectionGroup: 'SEC01' },
        { courseId: 'CISC3003', sectionGroup: 'SEC01' },
        { courseId: 'MATH2001', sectionGroup: 'SEC01' }
      ]
    };

    const proposalB = {
      id: 'prop-compact',
      title: '3-Day Compact Plan',
      strategy: 'Maximum Free Days',
      summary: 'Condenses all courses into Tuesday, Thursday, and Monday. Grants 4-day extended weekends (Wed & Fri free).',
      credits: 15,
      campusDays: 'Mon, Tue, Thu (Wed & Fri Free)',
      enrolledCourses: [
        { courseId: 'CISC3014', sectionGroup: 'SEC02' },
        { courseId: 'CISC3020', sectionGroup: 'SEC01' },
        { courseId: 'CISC3025', sectionGroup: 'SEC01' },
        { courseId: 'CISC3003', sectionGroup: 'SEC02' },
        { courseId: 'CISC3011', sectionGroup: 'SEC01' }
      ]
    };

    const proposalC = {
      id: 'prop-interest',
      title: 'AI & Systems Focus',
      strategy: 'Deep Specialization',
      summary: 'Prioritizes advanced AI and network defense electives. Prepares directly for CISC honors research.',
      credits: 15,
      campusDays: 'Mon, Tue, Wed, Thu',
      enrolledCourses: [
        { courseId: 'CISC3014', sectionGroup: 'SEC01' },
        { courseId: 'CISC3025', sectionGroup: 'SEC02' },
        { courseId: 'CISC3020', sectionGroup: 'SEC01' },
        { courseId: 'CISC4010', sectionGroup: 'SEC01' },
        { courseId: 'CISC3011', sectionGroup: 'SEC01' }
      ]
    };

    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        sender: 'agent',
        text: `Based on your Year 2 CS requirements and interest in **AI and Cybersecurity**, I formulated **3 conflict-free timetable proposals** (15 credits each, zero Friday classes). Review and compare them below:`,
        proposals: [proposalA, proposalB, proposalC],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const SUGGESTED_PROMPTS = [
    'I want around 15 credits, no Friday classes, and interested in AI & cybersecurity',
    'Make Wednesday free without changing my cybersecurity course',
    'Find cybersecurity electives',
    'Check my timetable for conflicts'
  ];

  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 bg-slate-50">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl"
          title="Expand Copilot"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-slate-800">Copilot</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl p-3 leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                  : 'bg-slate-100 text-slate-800 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-line">{m.text}</p>

              {m.proposal && (
                <div className="mt-3">
                  <ProposalSummaryCard
                    proposal={m.proposal}
                    onPreview={() => onOpenProposalPreview(m.proposal)}
                  />
                </div>
              )}

              {m.proposals && (
                <div className="mt-3 space-y-2">
                  {m.proposals.map((prop) => (
                    <ProposalSummaryCard
                      key={prop.id}
                      proposal={prop}
                      onPreview={() => onOpenProposalPreview(prop)}
                    />
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}

        {isProcessing && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 space-y-2 text-indigo-900 animate-pulse">
            <div className="flex items-center gap-2 font-bold text-indigo-700 text-xs">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Planning...</span>
            </div>
            <p className="text-[11px] font-medium text-indigo-800 pl-4">
              {AGENT_STEPS[currentStepIndex]}
            </p>
            <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / AGENT_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center gap-1.5 overflow-x-auto">
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            className="shrink-0 text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium px-2.5 py-1 rounded-full border border-slate-200 shadow-sm transition"
          >
            "{prompt.length > 26 ? prompt.substring(0, 26) + '...' : prompt}"
          </button>
        ))}
      </div>

      <div className="p-3 bg-white border-t border-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            placeholder="Ask a question or adjust schedule..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isProcessing}
            className="w-full text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isProcessing}
            className="absolute right-1.5 p-1.5 bg-slate-900 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-full transition hover:bg-indigo-600"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ProposalSummaryCard({ proposal, onPreview }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-slate-200 hover:border-indigo-300 shadow-sm transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide bg-indigo-50 px-2 py-0.5 rounded">
          {proposal.strategy}
        </span>
        <span className="text-[10px] font-semibold text-slate-500">
          {proposal.credits} Credits • {proposal.campusDays}
        </span>
      </div>

      <h4 className="text-xs font-bold text-slate-900 mt-1">{proposal.title}</h4>
      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
        {proposal.summary}
      </p>

      <div className="mt-2.5 flex items-center justify-end">
        <button
          onClick={onPreview}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-semibold transition"
        >
          <Eye className="w-3 h-3" />
          <span>Review & Compare Plan</span>
        </button>
      </div>
    </div>
  );
}

// =========================================================================
// WEEKLY CALENDAR
// =========================================================================
function WeeklyCalendar({ meetings, conflicts, onSelectBlock, onOpenCatalog, onUndo, canUndo }) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  const calculatePosition = (startTime, endTime) => {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    const totalDayMins = 12 * 60; // 08:00 to 20:00 = 720 mins
    const baseMins = 8 * 60;

    const top = ((startMins - baseMins) / totalDayMins) * 100;
    const height = ((endMins - startMins) / totalDayMins) * 100;

    return { top: `${top}%`, height: `${height}%` };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[640px] overflow-hidden">
      <div className="grid grid-cols-6 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 items-center">
        <div className="p-2.5 text-center border-r border-slate-200 flex items-center justify-center">
          {canUndo ? (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded hover:bg-slate-200 transition"
              title="Undo last change"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          ) : (
            <span className="text-slate-400 font-medium text-[11px]">Time</span>
          )}
        </div>
        {DAYS.map((day, idx) => (
          <div key={idx} className="p-2.5 text-center border-r last:border-r-0 border-slate-200">
            <span>{day}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-6 relative overflow-y-auto">
        <div className="border-r border-slate-200 bg-slate-50/50 divide-y divide-slate-100 text-[11px] text-slate-500 select-none">
          {HOURS.map((hour) => (
            <div key={hour} className="h-14 p-1.5 text-right pr-2.5 font-medium">
              {hour < 10 ? `0${hour}:00` : `${hour}:00`}
            </div>
          ))}
        </div>

        {[0, 1, 2, 3, 4].map((dayIndex) => {
          const dayMeetings = meetings.filter((m) => m.day === dayIndex);

          return (
            <div
              key={dayIndex}
              className="border-r last:border-r-0 border-slate-200 relative h-[672px] bg-white group hover:bg-slate-50/30 transition-colors"
            >
              {HOURS.map((hour) => (
                <div key={hour} className="h-14 border-b border-slate-100 pointer-events-none" />
              ))}

              {dayMeetings.map((meeting, idx) => {
                const pos = calculatePosition(meeting.startTime, meeting.endTime);
                const hasConflict = conflicts.has(meeting.courseId);
                const color = COLOR_MAP[meeting.color] || COLOR_MAP.indigo;

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectBlock(meeting)}
                    style={{ top: pos.top, height: pos.height }}
                    className={`absolute inset-x-1.5 rounded-xl p-2 cursor-pointer transition-all duration-150 shadow-sm hover:shadow-md hover:scale-[1.01] overflow-hidden flex flex-col justify-between border-l-4 ${
                      hasConflict
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-400/40 animate-pulse'
                        : `${color.bg} ${color.bar}`
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] tracking-tight">{meeting.code}</span>
                        {hasConflict ? (
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                        ) : (
                          <span className="text-[9px] font-semibold opacity-75">{meeting.sectionName}</span>
                        )}
                      </div>
                      <p className="text-[10px] font-medium leading-tight truncate mt-0.5">
                        {meeting.title}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-medium opacity-80 pt-1 border-t border-black/5">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {meeting.startTime} - {meeting.endTime}
                      </span>
                      <span>{meeting.room}</span>
                    </div>
                  </div>
                );
              })}

              {dayMeetings.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <span className="text-xs font-semibold text-slate-300">Free Day</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// SCREEN 3: PROPOSAL PREVIEW MODAL
// =========================================================================
function ProposalPreviewModal({ proposal, currentTimetable, onClose, onApplyToCurrent, onSaveAsNew }) {
  const [saveTitle, setSaveTitle] = useState(`${proposal.title} (${currentTimetable.semester})`);

  const proposalCourses = useMemo(() => {
    return proposal.enrolledCourses.map((item) => {
      const c = COURSE_CATALOG.find((cat) => cat.id === item.courseId);
      return { ...item, course: c };
    });
  }, [proposal]);

  const currentCourseIds = currentTimetable.enrolledCourses.map((c) => c.courseId);
  const proposalCourseIds = proposal.enrolledCourses.map((c) => c.courseId);

  const addedCourses = proposalCourses.filter((p) => !currentCourseIds.includes(p.courseId));
  const removedCourses = currentTimetable.enrolledCourses
    .filter((c) => !proposalCourseIds.includes(c.courseId))
    .map((c) => ({
      ...c,
      course: COURSE_CATALOG.find((cat) => cat.id === c.courseId)
    }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{proposal.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{proposal.summary}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 text-slate-500 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-white py-3 px-6 text-center text-xs">
          <div>
            <span className="text-slate-500">Total Credits</span>
            <p className="text-base font-bold text-indigo-600">{proposal.credits} Credits</p>
          </div>
          <div>
            <span className="text-slate-500">Active Campus Days</span>
            <p className="text-base font-bold text-slate-800">{proposal.campusDays}</p>
          </div>
          <div>
            <span className="text-slate-500">Scheduling Conflicts</span>
            <p className="text-base font-bold text-emerald-600 flex items-center justify-center gap-1">
              <Check className="w-4 h-4" /> 0 Conflicts
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">Safe Confirmation Protection</p>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                TermPilot AI never alters your saved timetable without approval. Applying this will update{' '}
                <strong>"{currentTimetable.title}"</strong>. Alternatively, you can save it as an independent timetable project.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <h4 className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-2.5">
                <Plus className="w-4 h-4" />
                <span>Proposed Additions ({addedCourses.length})</span>
              </h4>
              <div className="space-y-2">
                {addedCourses.map((item, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-sm">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{item.course?.code}</span>
                      <span className="text-indigo-600">{item.course?.credits} cr</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{item.course?.title}</p>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                      Section {item.sectionGroup}
                    </span>
                  </div>
                ))}
                {addedCourses.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No new courses added (section timing rebalanced).</p>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <h4 className="text-xs font-bold text-rose-700 flex items-center gap-1.5 mb-2.5">
                <Trash2 className="w-4 h-4" />
                <span>To Be Replaced / Removed ({removedCourses.length})</span>
              </h4>
              <div className="space-y-2">
                {removedCourses.map((item, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-sm">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{item.course?.code}</span>
                      <span className="text-slate-400 line-through">{item.course?.credits} cr</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{item.course?.title}</p>
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                      Section {item.sectionGroup}
                    </span>
                  </div>
                ))}
                {removedCourses.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No courses removed.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2">Complete Proposed 15-Credit Schedule</h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
              {proposalCourses.map((item, idx) => (
                <div key={idx} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full bg-indigo-500" />
                    <div>
                      <div className="font-bold text-slate-900">{item.course?.code} — {item.course?.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.course?.sections
                          .filter((s) => s.id.startsWith(item.sectionGroup))
                          .map((s) => `${s.dayName} ${s.startTime}-${s.endTime} (${s.room})`)
                          .join(', ')}
                      </div>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-700">{item.course?.credits} Credits</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            Discard Proposal
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => onSaveAsNew(saveTitle)}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition shadow-sm"
            >
              Save as New Timetable
            </button>

            <button
              onClick={onApplyToCurrent}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-100"
            >
              <Check className="w-4 h-4" />
              <span>Apply to Current Timetable</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SCREEN 4: RESEARCH INSPECTOR
// =========================================================================
function ResearchInspector({ onBack }) {
  const [activeTab, setActiveTab] = useState('retrieval');
  const [searchQuery, setSearchQuery] = useState('cybersecurity and network protocol defense');

  const RETRIEVAL_RESULTS = [
    {
      code: 'CISC3020',
      title: 'Cybersecurity & Cryptography',
      bm25Rank: 1,
      bm25Score: 14.82,
      denseRank: 1,
      denseScore: 0.912,
      rrfRank: 1,
      rrfScore: 0.0328,
      relevant: true
    },
    {
      code: 'CISC3011',
      title: 'Computer Networks & Protocols',
      bm25Rank: 2,
      bm25Score: 12.45,
      denseRank: 2,
      denseScore: 0.884,
      rrfRank: 2,
      rrfScore: 0.0315,
      relevant: true
    },
    {
      code: 'CISC3014',
      title: 'Information Retrieval & Web Search',
      bm25Rank: 4,
      bm25Score: 8.12,
      denseRank: 3,
      denseScore: 0.841,
      rrfRank: 3,
      rrfScore: 0.0289,
      relevant: true
    },
    {
      code: 'CISC3030',
      title: 'Cloud Computing & Distributed Systems',
      bm25Rank: 3,
      bm25Score: 9.34,
      denseRank: 5,
      denseScore: 0.765,
      rrfRank: 4,
      rrfScore: 0.0274,
      relevant: false
    },
    {
      code: 'CISC3003',
      title: 'Operating Systems & Architecture',
      bm25Rank: 5,
      bm25Score: 6.78,
      denseRank: 4,
      denseScore: 0.792,
      rrfRank: 5,
      rrfScore: 0.0261,
      relevant: false
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-lg font-bold text-white">
              CISC3014 Research Inspector
            </h1>
          </div>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition border border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Editor</span>
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('retrieval')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'retrieval'
                ? 'bg-violet-600 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            1. Hybrid Retrieval Matrix
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'metrics'
                ? 'bg-violet-600 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            2. IR Evaluation Benchmarks
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'pipeline'
                ? 'bg-violet-600 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            3. Multi-Stage Agent Trace
          </button>
        </div>

        {activeTab === 'retrieval' && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
              <label className="text-xs font-mono text-slate-400 block mb-1.5">
                Evaluation Query Input:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={() => setSearchQuery('artificial intelligence machine learning neural systems')}
                  className="text-[11px] font-mono text-violet-400 hover:underline"
                >
                  Load Preset Query B
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-violet-300">Retrieved Candidate Ranking</span>
                <span className="text-slate-400">Formula: RRF(d) = ∑ (1 / (60 + r(d)))</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="p-3">Course Code & Title</th>
                      <th className="p-3">BM25 (Rank / Score)</th>
                      <th className="p-3">Dense Embedding (Cosine)</th>
                      <th className="p-3 text-violet-400">Hybrid RRF Rank</th>
                      <th className="p-3">Ground Truth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {RETRIEVAL_RESULTS.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800 transition">
                        <td className="p-3">
                          <span className="font-bold text-white">{row.code}</span>
                          <span className="text-slate-400 block text-[11px]">{row.title}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-amber-400 font-bold">#{row.bm25Rank}</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">({row.bm25Score})</span>
                        </td>
                        <td className="p-3">
                          <span className="text-sky-400 font-bold">#{row.denseRank}</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">({row.denseScore})</span>
                        </td>
                        <td className="p-3 bg-violet-950/20">
                          <span className="text-violet-300 font-bold">#{row.rrfRank}</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">({row.rrfScore.toFixed(4)})</span>
                        </td>
                        <td className="p-3">
                          {row.relevant ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              RELEVANT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-500">
                              NON-REL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <span className="text-slate-400 text-xs font-mono">Mean Reciprocal Rank (MRR)</span>
                <p className="text-3xl font-mono font-bold text-violet-400 mt-2">0.867</p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">Baseline BM25: 0.654 (+32.5%)</p>
              </div>
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <span className="text-slate-400 text-xs font-mono">Recall @ 5</span>
                <p className="text-3xl font-mono font-bold text-emerald-400 mt-2">0.933</p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">Top-k candidate catalog pool</p>
              </div>
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <span className="text-slate-400 text-xs font-mono">nDCG @ 5</span>
                <p className="text-3xl font-mono font-bold text-sky-400 mt-2">0.884</p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">Normalized Discounted Cumulative Gain</p>
              </div>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-xs font-mono space-y-3">
              <h4 className="text-sm font-bold text-white">Academic Reflection for CISC3014 Presentation</h4>
              <p className="text-slate-300 leading-relaxed">
                Standard lexical keyword matching (BM25) frequently fails for course discovery because university students use colloquial queries that do not appear verbatim in formal course titles.
              </p>
              <p className="text-slate-300 leading-relaxed">
                By pairing 768-dimensional text embeddings with BM25 using Reciprocal Rank Fusion (k=60), TermPilot achieves both keyword precision and conceptual recall.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4 font-mono text-xs">
            <h4 className="text-sm font-bold text-white mb-2">Simulated Copilot Execution Trace</h4>

            <div className="space-y-3">
              {[
                { step: '1. User Intent Extraction', latency: '42ms', desc: 'Identified targetCredits=15, freeDay="Friday", interests=["AI", "Cybersecurity"]' },
                { step: '2. Hybrid IR Retrieval', latency: '128ms', desc: 'Fetched 8 top candidate courses via BM25 + dense neural embedding' },
                { step: '3. Prerequisite Verification', latency: '18ms', desc: 'Verified completed [CISC1001, CISC2002, MATH1001]. All candidates passed.' },
                { step: '4. Section Combinatorics & CSP', latency: '215ms', desc: 'Evaluated 64 section permutations across Mon-Thu calendar blocks' },
                { step: '5. Conflict Resolution', latency: '35ms', desc: 'Filtered out overlapping permutations. 3 viable schedules synthesized.' },
                { step: '6. Human-in-the-Loop Gate', latency: 'Awaiting User', desc: 'Proposals rendered as temporary review drafts. Timetable write locked until confirmed.' }
              ].map((trace, idx) => (
                <div key={idx} className="bg-slate-900 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-violet-300">{trace.step}</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">{trace.desc}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    {trace.latency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// COURSE CATALOG DRAWER
// =========================================================================
function CourseCatalogDrawer({ currentEnrolled, allCourses, onClose, onAddCourse, existingMeetings }) {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const filtered = useMemo(() => {
    return allCourses.filter((c) => {
      const matchSearch =
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase());
      const matchDept = selectedDept === 'ALL' || c.dept === selectedDept;
      return matchSearch && matchDept;
    });
  }, [allCourses, search, selectedDept]);

  const checkSectionClash = (sec) => {
    const sStart = timeToMinutes(sec.startTime);
    const sEnd = timeToMinutes(sec.endTime);
    return existingMeetings.some((m) => {
      if (m.day === sec.day) {
        const mStart = timeToMinutes(m.startTime);
        const mEnd = timeToMinutes(m.endTime);
        return Math.max(sStart, mStart) < Math.min(sEnd, mEnd);
      }
      return false;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-sm text-slate-900">Course Catalog</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, title, topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {['ALL', 'CISC', 'MATH'].map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  selectedDept === dept
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {filtered.map((course) => {
            const isEnrolled = currentEnrolled.find((c) => c.courseId === course.id);

            return (
              <div
                key={course.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-indigo-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm tracking-tight">
                      {course.code}
                    </span>
                    <h4 className="font-semibold text-slate-700 text-xs mt-0.5">{course.title}</h4>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                    {course.credits} Credits
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">{course.description}</p>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Offered Lecture Sections
                  </span>

                  {['SEC01', 'SEC02'].map((secGroup) => {
                    const groupSections = course.sections.filter((s) => s.id.startsWith(secGroup));
                    if (groupSections.length === 0) return null;

                    const causesClash = groupSections.some((s) => checkSectionClash(s));
                    const isSelected = isEnrolled && isEnrolled.sectionGroup === secGroup;

                    return (
                      <div
                        key={secGroup}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300'
                            : causesClash
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                            <span>Section {secGroup}</span>
                            {causesClash && !isSelected && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 rounded flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Time Clash
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {groupSections
                              .map((s) => `${s.dayName} ${s.startTime}-${s.endTime}`)
                              .join(' & ')}
                          </div>
                        </div>

                        <button
                          onClick={() => onAddCourse(course.id, secGroup)}
                          disabled={isSelected}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white cursor-default'
                              : 'bg-slate-900 hover:bg-indigo-600 text-white shadow-sm'
                          }`}
                        >
                          {isSelected ? 'Enrolled' : 'Select'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// COURSE BLOCK DETAILS MODAL
// =========================================================================
function CourseBlockDetailsModal({ block, course, onClose, onSwitchSection, onRemoveCourse }) {
  if (!course) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              {course.dept} • {course.credits} Credits
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{block.code}</h3>
            <p className="text-xs text-slate-600 font-medium">{course.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4">{course.description}</p>

        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-5">
          <label className="text-[11px] font-semibold text-slate-700 block mb-2">
            Switch to Another Section:
          </label>
          <div className="space-y-2">
            {['SEC01', 'SEC02'].map((sec) => {
              const secMatches = course.sections.filter((s) => s.id.startsWith(sec));
              if (secMatches.length === 0) return null;
              const isCurrent = block.sectionGroup === sec;

              return (
                <div
                  key={sec}
                  onClick={() => !isCurrent && onSwitchSection(sec)}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                    isCurrent
                      ? 'bg-indigo-50 border-indigo-300 font-bold text-indigo-900'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span>Section {sec}</span>
                    <span className="text-[10px] text-slate-500 block font-normal">
                      {secMatches.map((s) => `${s.dayName} ${s.startTime}-${s.endTime}`).join(' & ')}
                    </span>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded">Active</span>
                  ) : (
                    <span className="text-[10px] text-slate-500 hover:text-indigo-600 font-semibold">Switch</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={onRemoveCourse}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove from Timetable</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// NEW TIMETABLE MODAL
// =========================================================================
function NewTimetableModal({ timetables, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [semester, setSemester] = useState('Fall 2026');
  const [duplicateId, setDuplicateId] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
        <h3 className="font-bold text-base text-slate-900">Create New Timetable</h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(title, semester, duplicateId || null);
          }}
          className="mt-5 space-y-4 text-xs"
        >
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Timetable Name</label>
            <input
              type="text"
              placeholder="e.g., Fall 2026 — Honours Track"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Academic Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Fall 2026">Fall 2026</option>
              <option value="Spring 2027">Spring 2027</option>
              <option value="Summer 2027">Summer 2027</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Starting Point</label>
            <select
              value={duplicateId}
              onChange={(e) => setDuplicateId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Start from blank schedule</option>
              {timetables.map((t) => (
                <option key={t.id} value={t.id}>
                  Copy from: {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-100"
            >
              Create Timetable
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// ACADEMIC PROFILE MODAL
// =========================================================================
function AcademicProfileModal({ profile, onClose, onSave }) {
  const [formData, setFormData] = useState({ ...profile });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Academic Profile</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="mt-5 space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Student Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Student ID</label>
              <input
                type="text"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Degree Program</label>
              <input
                type="text"
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Year of Study</label>
              <input
                type="text"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Target Credits / Term</label>
              <input
                type="number"
                value={formData.targetCredits}
                onChange={(e) => setFormData({ ...formData, targetCredits: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Preferred Free Day</label>
              <select
                value={formData.freeDayPreference}
                onChange={(e) => setFormData({ ...formData, freeDayPreference: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Friday">Friday (No classes)</option>
                <option value="Wednesday">Wednesday (Mid-week break)</option>
                <option value="Monday">Monday (Long weekend)</option>
                <option value="None">No preference</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Verified Prerequisites Passed</label>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              {formData.completedCourses.map((c, i) => (
                <span key={i} className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  ✓ {c}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-100"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
