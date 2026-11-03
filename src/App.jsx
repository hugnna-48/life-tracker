import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Calendar, CheckSquare, Trash2, Plus, Clock, AlignLeft, Link as LinkIcon, X, Moon, Sun, Settings, PieChart, FileText, CheckCircle2, MapPin } from 'lucide-react';

// --- Firebase Initialization ---
let firebaseConfig = {};
try {
  firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
} catch (e) {
  console.error("Error parsing firebase config", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('habits');
  const [authLoading, setAuthLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // --- Habit State ---
  const [habits, setHabits] = useState([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [isHabitSettingsOpen, setIsHabitSettingsOpen] = useState(false);

  // --- Task State ---
  const [tasks, setTasks] = useState([]);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskIsAllDay, setNewTaskIsAllDay] = useState(false);
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskLocation, setNewTaskLocation] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskLink, setNewTaskLink] = useState('');

  // --- Calendar & Modal State ---
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Colors for UI & Chart
  const habitColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500'];

  // --- Date Calculation Helpers ---
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  const todayDateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const daysInMonth = useMemo(() => new Date(currentYear, currentMonth + 1, 0).getDate(), [currentYear, currentMonth]);
  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // --- Load html2pdf dynamically for PDF Export ---
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // --- Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;
    const habitsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'habits');
    const unsubHabits = onSnapshot(habitsRef, (snapshot) => {
      const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      habitsData.sort((a, b) => b.createdAt - a.createdAt);
      setHabits(habitsData);
    }, (error) => console.error("Error:", error));

    const tasksRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tasks');
    const unsubTasks = onSnapshot(tasksRef, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      tasksData.sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0));
      setTasks(tasksData);
    }, (error) => console.error("Error:", error));

    return () => { unsubHabits(); unsubTasks(); };
  }, [user]);

  // --- Handlers ---
  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim() || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'), {
        name: newHabitName.trim(),
        createdAt: Date.now(),
        completions: {} 
      });
      setNewHabitName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleHabitCompletion = async (habitId, day, currentCompletions) => {
    if (!user) return;
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentStatus = currentCompletions?.[dateKey] || false;
    
    try {
      const habitRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId);
      await updateDoc(habitRef, { [`completions.${dateKey}`]: !currentStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskContent.trim() || !newTaskDeadline || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), {
        content: newTaskContent.trim(),
        deadline: newTaskDeadline,
        isAllDay: newTaskIsAllDay,
        time: newTaskIsAllDay ? '' : newTaskTime,
        location: newTaskLocation,
        description: newTaskDescription,
        link: newTaskLink,
        completed: false,
        createdAt: Date.now()
      });
      setNewTaskContent('');
      setNewTaskDeadline('');
      setNewTaskIsAllDay(false);
      setNewTaskTime('');
      setNewTaskLocation('');
      setNewTaskDescription('');
      setNewTaskLink('');
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTaskCompletion = async (taskId, currentStatus) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), {
        completed: !currentStatus
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPDF = () => {
    if (!window.html2pdf) return;
    setIsGeneratingPDF(true);
    const element = document.getElementById('pdf-export-content');
    element.style.display = 'block';

    const opt = {
      margin:       0.4,
      filename:     `LifeTracker_Report_${currentMonth + 1}_${currentYear}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(element).save().then(() => {
      element.style.display = 'none';
      setIsGeneratingPDF(false);
    });
  };

  const openDayModal = (day) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateKey);
    setIsModalOpen(true);
  };

  const getDaysLeftInfo = (deadlineStr, completed) => {
    if (completed) return { text: 'Completed', status: 'success' };
    if (!deadlineStr) return { text: 'No date', status: 'neutral' };
    
    const deadline = new Date(deadlineStr);
    const currDate = new Date();
    currDate.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((deadline - currDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Overdue', status: 'danger' };
    if (diffDays === 0) return { text: 'Today', status: 'warning' };
    if (diffDays === 1) return { text: 'Tomorrow', status: 'warning' };
    return { text: `${diffDays} days left`, status: 'primary' };
  };

  // --- Dynamic Theme Classes ---
  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-gray-50',
    text: darkMode ? 'text-gray-100' : 'text-gray-900',
    card: darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    cardHover: darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50/50',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
    mutedText: darkMode ? 'text-gray-400' : 'text-gray-500',
    inputBg: darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    headerBg: darkMode ? 'bg-gray-800/80' : 'bg-gray-50/50',
    tableBorder: darkMode ? 'border-gray-700' : 'border-gray-100',
    modalOverlay: darkMode ? 'bg-black/70' : 'bg-gray-900/60',
    calendarCell: darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    emptyCell: darkMode ? 'bg-gray-800/40' : 'bg-gray-50/30'
  };

  if (authLoading) {
    return <div className={`flex h-screen items-center justify-center transition-colors ${theme.bg} ${theme.mutedText}`}>Loading workspace...</div>;
  }

  // Calculate monthly stats for habits
  const habitStats = habits.map(habit => {
    let completedDays = 0;
    daysArray.forEach(d => {
      const k = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (habit.completions?.[k]) completedDays++;
    });
    return { ...habit, completedDays, percent: Math.round((completedDays / daysInMonth) * 100) };
  });

  return (
    <div className={`min-h-screen font-sans p-4 sm:p-6 md:p-8 transition-colors duration-200 ${theme.bg} ${theme.text}`}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header & Navigation */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Life Tracker</h1>
            <p className={`mt-1 ${theme.mutedText}`}>Manage your routines and deadlines</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-full border transition-colors ${theme.card} hover:ring-2 ring-blue-500/50`}>
              {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-500" />}
            </button>
            
            <div className={`flex rounded-lg p-1 shadow-sm border ${theme.card}`}>
              {['habits', 'tasks', 'calendar'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                    activeTab === tab 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : `${theme.mutedText} ${theme.cardHover}`
                  }`}
                >
                  {tab === 'habits' && <CheckSquare size={16} />}
                  {tab === 'tasks' && <AlignLeft size={16} />}
                  {tab === 'calendar' && <Calendar size={16} />}
                  <span className="hidden sm:block">{tab}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* --- HABITS TAB --- */}
        {activeTab === 'habits' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Habits Table - takes 3/4 width */}
            <div className={`lg:w-3/4 rounded-xl shadow-sm border overflow-hidden ${theme.card}`}>
              <div className={`p-4 border-b flex justify-between items-center ${theme.border} ${theme.headerBg}`}>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckSquare size={20} className="text-blue-500" />
                  Monthly Tracker ({today.toLocaleString('default', { month: 'long', year: 'numeric' })})
                </h2>
                <div className="flex gap-2">
                  <button onClick={handleExportPDF} disabled={isGeneratingPDF} className={`flex items-center gap-2 text-sm border px-3 py-1.5 rounded-lg transition-colors ${theme.border} ${theme.cardHover}`}>
                    {isGeneratingPDF ? <span className="animate-pulse">Exporting...</span> : <><FileText size={16} /> <span className="hidden sm:inline">Export PDF</span></>}
                  </button>
                  <button onClick={() => setIsHabitSettingsOpen(true)} className={`flex items-center gap-2 text-sm border px-3 py-1.5 rounded-lg transition-colors ${theme.border} ${theme.cardHover}`}>
                    <Settings size={16} /> <span className="hidden sm:inline">Edit Habits</span>
                  </button>
                </div>
              </div>
              
              {habits.length === 0 ? (
                <div className={`p-8 text-center ${theme.mutedText}`}>
                  No habits tracked yet. Click "Edit Habits" to add some!
                </div>
              ) : (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className={`py-3 px-4 font-medium text-sm sticky left-0 z-10 w-40 sm:w-48 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] border-b ${theme.card} ${theme.mutedText} ${theme.tableBorder}`}>
                          Habit
                        </th>
                        {daysArray.map(day => (
                          <th key={day} className={`py-3 px-0.5 sm:px-1 font-medium text-[10px] sm:text-xs text-center border-b min-w-[28px] sm:min-w-[36px] ${theme.mutedText} ${theme.tableBorder}`}>
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {habits.map(habit => (
                        <tr key={habit.id} className={`group transition-colors border-b last:border-0 ${theme.tableBorder} ${theme.cardHover}`}>
                          <td className={`py-3 px-4 font-medium text-sm sticky left-0 z-10 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.1)] truncate max-w-[150px] sm:max-w-[200px] ${theme.card} group-hover:bg-opacity-80`}>
                            {habit.name}
                          </td>
                          {daysArray.map(day => {
                            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isCompleted = habit.completions?.[dateKey];
                            const isToday = day === today.getDate();
                            
                            return (
                              <td key={day} className={`py-2 px-0.5 sm:px-1 text-center ${isToday ? (darkMode ? 'bg-blue-900/30' : 'bg-blue-50/50') : ''}`}>
                                <button
                                  onClick={() => toggleHabitCompletion(habit.id, day, habit.completions)}
                                  className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto rounded transition-all duration-200 ${
                                    isCompleted 
                                      ? 'bg-green-500 shadow-sm border-transparent' 
                                      : `border ${darkMode ? 'border-gray-600 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-200'}`
                                  }`}
                                  aria-label={`Toggle habit ${habit.name} on day ${day}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Statistics Chart - takes 1/4 width */}
            <div className={`lg:w-1/4 rounded-xl shadow-sm border p-5 ${theme.card}`}>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-6 border-b pb-3" style={{borderColor: darkMode ? '#374151' : '#f3f4f6'}}>
                <PieChart size={20} className="text-blue-500" />
                Completion Stats
              </h2>
              
              {habits.length === 0 ? (
                <p className={`text-sm text-center italic ${theme.mutedText}`}>No data available.</p>
              ) : (
                <div className="space-y-5">
                  {habitStats.map((stat, i) => (
                    <div key={stat.id}>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-medium truncate max-w-[120px]">{stat.name}</span>
                        <span className={`text-xs font-bold ${stat.percent >= 80 ? 'text-green-500' : stat.percent >= 50 ? 'text-blue-500' : theme.mutedText}`}>
                          {stat.percent}%
                        </span>
                      </div>
                      <div className={`w-full h-2.5 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${habitColors[i % habitColors.length]}`}
                          style={{ width: `${stat.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TASKS TAB --- */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className={`p-5 rounded-xl shadow-sm border ${theme.card}`}>
              <h2 className="text-lg font-semibold mb-4">Create Task</h2>
              <form onSubmit={handleAddTask} className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <input type="text" value={newTaskContent} onChange={(e) => setNewTaskContent(e.target.value)} placeholder="Task name/description..." className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${theme.inputBg}`} required />
                  
                  <div className="flex gap-2">
                    <input type="date" value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} className={`w-full md:w-auto px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${theme.inputBg}`} required />
                    
                    {!newTaskIsAllDay && (
                      <input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className={`w-full md:w-auto px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${theme.inputBg}`} />
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer self-start sm:self-center">
                    <input type="checkbox" checked={newTaskIsAllDay} onChange={(e) => setNewTaskIsAllDay(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                    All Day Event
                  </label>

                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1 sm:ml-6">
                    <input type="text" value={newTaskLocation} onChange={(e) => setNewTaskLocation(e.target.value)} placeholder="Location (optional)" className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${theme.inputBg}`} />
                    <input type="url" value={newTaskLink} onChange={(e) => setNewTaskLink(e.target.value)} placeholder="Link URL (optional)" className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${theme.inputBg}`} />
                  </div>
                </div>

                <textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Detailed description (optional)" className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-y min-h-[80px] ${theme.inputBg}`} />

                <div className="flex justify-end">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors sm:w-auto w-full shadow-sm">
                    <Plus size={18} /> Add Task
                  </button>
                </div>
              </form>
            </div>

            <div className={`rounded-xl shadow-sm border overflow-hidden ${theme.card}`}>
              <div className={`p-5 border-b flex justify-between items-center ${theme.border} ${theme.headerBg}`}>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <AlignLeft size={20} className="text-blue-500" /> Task List
                </h2>
              </div>
              
              {tasks.length === 0 ? (
                <div className={`p-8 text-center ${theme.mutedText}`}>No tasks added.</div>
              ) : (
                <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                  {tasks.map(task => {
                    const daysLeft = getDaysLeftInfo(task.deadline, task.completed);
                    const isOverdue = daysLeft.status === 'danger' && !task.completed;
                    
                    return (
                      <div key={task.id} className={`p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-colors ${task.completed ? (darkMode ? 'opacity-60 bg-gray-800' : 'opacity-70 bg-gray-50') : (isOverdue ? (darkMode ? 'bg-red-900/20' : 'bg-red-50/50') : theme.cardHover)}`}>
                        <div className="flex items-start gap-4 flex-1 w-full overflow-hidden">
                          <button 
                            onClick={() => toggleTaskCompletion(task.id, task.completed)}
                            className={`mt-1 shrink-0 transition-colors ${task.completed ? 'text-green-500' : (darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}`}
                          >
                            {task.completed ? <CheckCircle2 size={24} /> : <div className={`w-6 h-6 rounded-full border-2 ${darkMode ? 'border-gray-500' : 'border-gray-300'}`} />}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-lg truncate ${task.completed ? 'line-through' : ''} ${isOverdue ? (darkMode ? 'text-red-400' : 'text-red-700') : ''}`}>
                              {task.content}
                            </p>
                            <div className={`flex flex-wrap items-center gap-3 mt-1.5 text-sm ${theme.mutedText}`}>
                              <span className="flex items-center gap-1 shrink-0"><Calendar size={14} /> {task.deadline}</span>
                              {task.isAllDay ? (
                                <span className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">All Day</span>
                              ) : task.time && (
                                <span className="flex items-center gap-1 shrink-0"><Clock size={14} /> {task.time}</span>
                              )}
                              {task.location && <span className="flex items-center gap-1 shrink-0 truncate max-w-[150px]"><MapPin size={14} /> {task.location}</span>}
                              {task.link && <a href={task.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline shrink-0"><LinkIcon size={14} /> Link</a>}
                            </div>
                            {task.description && (
                              <p className={`mt-2 text-sm flex items-start gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                <AlignLeft size={14} className="mt-0.5 shrink-0" />
                                <span className="whitespace-pre-wrap">{task.description}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:ml-4 pl-10 sm:pl-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap 
                            ${task.completed ? (darkMode ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-100 text-green-700 border-green-200') :
                              daysLeft.status === 'danger' ? (darkMode ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-red-100 text-red-700 border-red-200') :
                              daysLeft.status === 'warning' ? (darkMode ? 'bg-orange-900/30 text-orange-400 border-orange-800' : 'bg-orange-100 text-orange-700 border-orange-200') :
                              (darkMode ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200')
                            }`}>
                            {daysLeft.text}
                          </span>
                          <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-md transition-colors" title="Delete Task">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CALENDAR TAB --- */}
        {activeTab === 'calendar' && (
          <div className={`p-4 sm:p-5 rounded-xl shadow-sm border ${theme.card}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar size={20} className="text-blue-500" /> Calendar View ({today.toLocaleString('default', { month: 'long', year: 'numeric' })})
              </h2>
              <button onClick={handleExportPDF} disabled={isGeneratingPDF} className={`flex items-center gap-2 text-sm border px-3 py-1.5 rounded-lg transition-colors ${theme.border} ${theme.cardHover}`}>
                 {isGeneratingPDF ? <span className="animate-pulse">Exporting...</span> : <><FileText size={16} /> <span className="hidden sm:inline">Export PDF</span></>}
              </button>
            </div>
            
            <div className={`flex flex-wrap gap-x-4 gap-y-2 mb-6 p-3 rounded-lg border ${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-sm font-medium w-full sm:w-auto ${theme.text}`}>Habits Legend:</span>
              {habits.map((habit, index) => (
                <div key={habit.id} className={`flex items-center gap-1.5 text-xs ${theme.mutedText}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${habitColors[index % habitColors.length]}`}></div> {habit.name}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2 lg:gap-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className={`text-center font-semibold text-xs sm:text-sm py-2 ${theme.mutedText}`}>{day}</div>
              ))}
              
              {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className={`p-2 sm:p-4 rounded-lg border border-transparent ${theme.emptyCell}`}></div>
              ))}
              
              {daysArray.map(day => {
                const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = day === today.getDate();
                const daysTasks = tasks.filter(t => t.deadline === dateKey);
                
                return (
                  <div 
                    key={day} onClick={() => openDayModal(day)}
                    className={`min-h-[70px] sm:min-h-[100px] p-1 sm:p-2 border rounded-lg cursor-pointer transition-all hover:border-blue-400 hover:shadow-md flex flex-col ${theme.calendarCell} ${isToday ? (darkMode ? 'border-blue-500 bg-blue-900/20' : 'border-blue-400 bg-blue-50/50') : ''}`}
                  >
                    <span className={`text-xs sm:text-sm font-medium w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full mb-1 sm:mb-2 ${isToday ? 'bg-blue-500 text-white' : theme.text}`}>
                      {day}
                    </span>
                    
                    <div className="flex flex-wrap gap-0.5 sm:gap-1 mb-1 sm:mb-2 px-1">
                      {habits.map((habit, index) => habit.completions?.[dateKey] && (
                        <div key={habit.id} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${habitColors[index % habitColors.length]}`} title={habit.name} />
                      ))}
                    </div>
                    
                    <div className="w-full space-y-1 mt-auto">
                      {daysTasks.slice(0, 2).map(task => (
                        <div key={task.id} className={`text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded truncate w-full border ${task.completed ? (darkMode ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-100 text-green-800 border-green-200 line-through') : (darkMode ? 'bg-orange-900/30 text-orange-300 border-orange-800' : 'bg-orange-100 text-orange-800 border-orange-200')}`} title={task.content}>
                          {!task.isAllDay && <span className="hidden sm:inline font-bold mr-1">{task.time}</span>}
                          {task.content}
                        </div>
                      ))}
                      {daysTasks.length > 2 && <div className={`text-[9px] sm:text-[10px] font-medium text-center sm:text-left w-full ${theme.mutedText}`}>+{daysTasks.length - 2} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* --- HABIT SETTINGS MODAL --- */}
      {isHabitSettingsOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${theme.modalOverlay}`} onClick={() => setIsHabitSettingsOpen(false)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${theme.card}`} onClick={e => e.stopPropagation()}>
            <div className={`flex justify-between items-center p-4 border-b ${theme.border} ${theme.headerBg}`}>
              <h3 className="text-lg font-bold flex items-center gap-2"><Settings size={20} /> Edit Habits</h3>
              <button onClick={() => setIsHabitSettingsOpen(false)} className={`p-1.5 rounded-full border transition-colors ${theme.border} ${theme.cardHover}`}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-6">
              <form onSubmit={handleAddHabit} className="flex gap-2">
                <input type="text" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} placeholder="New habit name..." className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${theme.inputBg}`} required />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"><Plus size={18} /></button>
              </form>
              
              <div>
                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.mutedText}`}>Current Habits</h4>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {habits.map(habit => (
                    <div key={habit.id} className={`flex items-center justify-between p-3 rounded-lg border ${theme.border} ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                      <span className="font-medium text-sm">{habit.name}</span>
                      <button onClick={() => handleDeleteHabit(habit.id)} className="text-red-400 hover:text-red-500 p-1.5"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  {habits.length === 0 && <p className={`text-sm italic ${theme.mutedText}`}>No habits.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DAY DETAILS MODAL --- */}
      {isModalOpen && selectedDate && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${theme.modalOverlay}`} onClick={() => setIsModalOpen(false)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden ${theme.card}`} onClick={e => e.stopPropagation()}>
             <div className={`flex justify-between items-center p-4 border-b ${theme.border} ${theme.headerBg}`}>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Calendar className="text-blue-600" size={20} /> {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`p-1.5 rounded-full border transition-colors ${theme.border} ${theme.cardHover}`}><X size={18} /></button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-6">
              <div>
                <h4 className={`font-semibold border-b pb-2 mb-3 text-sm uppercase tracking-wider ${theme.border} ${theme.mutedText}`}>Tasks Due</h4>
                <div className="space-y-3">
                  {tasks.filter(t => t.deadline === selectedDate).map(task => (
                    <div key={task.id} className={`border rounded-xl p-4 shadow-sm flex items-start gap-3 ${task.completed ? (darkMode ? 'bg-gray-800 border-gray-700 opacity-60' : 'bg-gray-50 border-gray-200 opacity-70') : (darkMode ? 'bg-orange-900/20 border-orange-800/50' : 'bg-orange-50 border-orange-200')}`}>
                      <button onClick={() => toggleTaskCompletion(task.id, task.completed)} className={`mt-0.5 shrink-0 ${task.completed ? 'text-green-500' : (darkMode ? 'text-gray-500' : 'text-gray-400')}`}>
                        {task.completed ? <CheckCircle2 size={20} /> : <div className={`w-5 h-5 rounded-full border-2 ${darkMode ? 'border-gray-500' : 'border-gray-300'}`} />}
                      </button>
                      <div className="flex-1">
                         <p className={`font-semibold text-lg mb-1.5 ${task.completed ? 'line-through text-gray-500' : (darkMode ? 'text-orange-300' : 'text-orange-900')}`}>{task.content}</p>
                         <div className={`space-y-1 text-sm ${darkMode ? 'text-orange-200/70' : 'text-orange-800'}`}>
                           {task.isAllDay ? (
                              <div className="flex items-center gap-2"><Clock size={14} /> <span className="font-medium">All Day</span></div>
                           ) : task.time && (
                              <div className="flex items-center gap-2"><Clock size={14} /> <span className="font-medium">Time:</span> {task.time}</div>
                           )}
                           {task.location && <div className="flex items-center gap-2"><MapPin size={14} /> <span className="font-medium">Location:</span> {task.location}</div>}
                         </div>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.deadline === selectedDate).length === 0 && <p className={`text-sm italic text-center ${theme.mutedText}`}>No tasks due this day.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- HIDDEN PDF EXPORT CONTENT --- */}
      <div id="pdf-export-content" className="hidden bg-white text-black p-8 max-w-4xl mx-auto" style={{ width: '800px' }}>
        <h1 className="text-3xl font-bold text-center mb-2">Life Tracker Monthly Report</h1>
        <p className="text-center text-gray-500 mb-8">{today.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        
        {/* PDF Habit Stats */}
        <div className="mb-10">
          <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4">Habit Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            {habitStats.map(stat => (
              <div key={`pdf-stat-${stat.id}`} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-800">{stat.name}</span>
                  <span className="font-bold text-blue-600">{stat.percent}%</span>
                </div>
                <p className="text-sm text-gray-500">{stat.completedDays} out of {daysInMonth} days completed</p>
              </div>
            ))}
          </div>
        </div>

        {/* PDF Tasks Met/Missed */}
        <div>
          <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4">Task Deadlines</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2"><CheckCircle2 size={16}/> Met (Completed)</h3>
              <ul className="space-y-2 text-sm">
                {tasks.filter(t => t.completed && t.deadline && t.deadline.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`)).map(t => (
                  <li key={`pdf-task-met-${t.id}`} className="border-l-4 border-green-500 pl-3 py-1 bg-green-50">
                    <span className="font-semibold">{t.content}</span> <span className="text-gray-500 text-xs ml-2">({t.deadline})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><Clock size={16}/> Missed / Overdue (Uncompleted)</h3>
              <ul className="space-y-2 text-sm">
                {tasks.filter(t => !t.completed && t.deadline && t.deadline.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`) && new Date(t.deadline) < new Date(new Date().setHours(0,0,0,0))).map(t => (
                  <li key={`pdf-task-missed-${t.id}`} className="border-l-4 border-red-500 pl-3 py-1 bg-red-50">
                    <span className="font-semibold">{t.content}</span> <span className="text-gray-500 text-xs ml-2">({t.deadline})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}