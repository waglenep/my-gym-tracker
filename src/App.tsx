import React, { useState, useEffect, useMemo } from "react";
import {
  Dumbbell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  History,
  TrendingUp,
  Save,
  LogOut,
  Activity,
  CheckCircle,
  User,
} from "lucide-react";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  arrayUnion,
} from "firebase/firestore";

// --- Constants & Config ---

const WEIGHT_INCREMENTS = [
  2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40,
  45, 50, 55, 60, 70, 80, 90, 100,
];

const MUSCLE_GROUPS = [
  "Biceps",
  "Triceps",
  "Chest",
  "Shoulder",
  "Back",
  "Leg",
  "Rest",
];

const DEFAULT_EXERCISES: Record<string, string[]> = {
  Biceps: ["Barbell Curl", "Hammer Curl", "Preacher Curl"],
  Triceps: ["Tricep Pushdown", "Skullcrushers", "Dips"],
  Chest: ["Bench Press", "Incline Dumbbell Press", "Cable Flyes"],
  Shoulder: ["Overhead Press", "Lateral Raises", "Face Pulls"],
  Back: ["Pull Ups", "Lat Pulldown", "Barbell Row"],
  Leg: ["Squat", "Leg Press", "Romanian Deadlift"],
  Rest: [],
};

// --- Firebase Initialization ---

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIaXxj5rrmUwO-zUtwAqxajEk_fAMlwZ4",
  authDomain: "my-gym-tracker-813e1.firebaseapp.com",
  projectId: "my-gym-tracker-813e1",
  storageBucket: "my-gym-tracker-813e1.firebasestorage.app",
  messagingSenderId: "101414265360",
  appId: "1:101414265360:web:c74c7d7a01cb036fe9a095"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-gym-tracker";

// --- Helper Functions ---

// FIX: Added ': Date' type annotation
const getFormattedDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// FIX: Added ': Date' type annotation
const getDayName = (date: Date) => {
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

// FIX: Custom UUID generator to avoid TS errors with crypto.randomUUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// --- Components ---

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

// FIX: Added prop types
const AuthScreen = ({ onLogin }: { onLogin: (username: string) => void }) => {
  const [username, setUsername] = useState("");

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (username.trim().length > 0) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Dumbbell className="w-10 h-10 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">IronTracker</h1>
        <p className="text-gray-500 mb-8">
          Enter your username to access your history.
        </p>

        <div className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Username (e.g. Abhishek)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleSubmit(e);
              }}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
              autoFocus
            />
          </div>

          <button
            onClick={(e) => handleSubmit(e)}
            disabled={!username.trim()}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-md transition-all
              ${
                username.trim()
                  ? "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg"
                  : "bg-gray-300 cursor-not-allowed"
              }
            `}
          >
            Start Tracking
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Your data is saved publicly under this username.
        </p>
      </div>
    </div>
  );
};

// --- Main Application ---

export default function App() {
  // FIX: Automatically inject Tailwind CSS for CodeSandbox compatibility
  useEffect(() => {
    const scriptId = 'tailwind-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  const [username, setUsername] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // State for manually selected muscle group
  const [activeMuscleGroup, setActiveMuscleGroup] = useState("Biceps");

  // Data States (using 'any' for complex objects to simplify TS for this snippet)
  const [workouts, setWorkouts] = useState<any>({});
  const [templates, setTemplates] = useState<any>({});
  const [view, setView] = useState("dashboard");

  // --- Auth & Initial Data Loading ---

  useEffect(() => {
    // 1. Check Local Storage
    const storedName = localStorage.getItem("gym_tracker_username");
    if (storedName) {
      setUsername(storedName);
    }

    // 2. Initialize Firebase Auth
    const initAuth = async () => {
      try {
        // Try custom token first (only works if config matches env)
        if (
          typeof (window as any).__initial_auth_token !== "undefined" &&
          (window as any).__initial_auth_token
        ) {
          try {
             await signInWithCustomToken(auth, (window as any).__initial_auth_token);
             return;
          } catch (e) {
             console.warn("Environment token mismatch (expected for custom config). Falling back to anonymous auth.");
          }
        }
        // Fallback to Anonymous Auth
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!localStorage.getItem("gym_tracker_username")) {
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (name: string) => {
    // Sanitize username to be safe for document IDs
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    localStorage.setItem("gym_tracker_username", safeName);
    setUsername(safeName);
  };

  const handleSignOut = () => {
    localStorage.removeItem("gym_tracker_username");
    setUsername(null);
    setWorkouts({});
    setTemplates({});
    setView("dashboard");
  };

  // --- Firestore Listeners ---

  useEffect(() => {
    if (!firebaseUser || !username) return;

    const userDocRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "gym_trackers",
      username
    );

    const unsub = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWorkouts(data.workouts || {});
          setTemplates(data.templates || {});
        } else {
          setWorkouts({});
          setTemplates({});
        }
      },
      (err) => console.error("Data sync error:", err)
    );

    return () => unsub();
  }, [firebaseUser, username]);

  // --- Logic Helpers ---

  const dateKey = useMemo(() => getFormattedDate(currentDate), [currentDate]);
  const currentLog = workouts[dateKey] || { exercises: [] };

  // --- CRUD Operations ---

  const addExercise = async (name: string, weight: any) => {
    if (!name || !weight) return;
    if (!username) {
      alert("Please login first.");
      return;
    }

    // FIX: Replaced crypto.randomUUID() with custom generateUUID()
    const newExercise = {
      id: generateUUID(),
      exerciseName: name,
      weight: parseFloat(weight),
      loggedAt: new Date().toISOString(),
    };

    const userDocRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "gym_trackers",
      username
    );

    try {
      const dayUpdate = {
        date: dateKey,
        dayOfWeek: getDayName(currentDate),
        muscleGroup: activeMuscleGroup,
        exercises: arrayUnion(newExercise),
      };

      const templateUpdate = arrayUnion(name);

      await setDoc(
        userDocRef,
        {
          workouts: {
            [dateKey]: dayUpdate,
          },
          templates: {
            [activeMuscleGroup]: templateUpdate,
          },
        },
        { merge: true }
      );
    } catch (e) {
      console.error("Error saving workout:", e);
      throw e;
    }
  };

  const deleteExercise = async (exerciseId: string) => {
    const userDocRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "gym_trackers",
      username!
    );
    // @ts-ignore
    const updatedExercises = currentLog.exercises.filter(
      (ex: any) => ex.id !== exerciseId
    );

    try {
      await setDoc(
        userDocRef,
        {
          workouts: {
            [dateKey]: {
              exercises: updatedExercises,
            },
          },
        },
        { merge: true }
      );
    } catch (e) {
      console.error("Error deleting exercise:", e);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  // --- Render Sub-Components ---

  if (loading) return <LoadingSpinner />;
  if (!username) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20">
      {/* Top Bar */}
      <div className="bg-white shadow-sm sticky top-0 z-10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-gray-900 leading-none">
              IronTracker
            </span>
            <span className="text-xs font-semibold text-indigo-600 mt-0.5">
              Hi, {username}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-gray-400 hover:text-red-500 bg-gray-50 p-2 rounded-full transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {view === "dashboard" ? (
        <Dashboard
          currentDate={currentDate}
          muscleGroup={activeMuscleGroup}
          setMuscleGroup={setActiveMuscleGroup}
          workouts={workouts}
          onLogClick={() => setView("logger")}
          onDateChange={changeDate}
          totalWorkouts={Object.keys(workouts).length}
        />
      ) : (
        <Logger
          currentDate={currentDate}
          muscleGroup={activeMuscleGroup}
          currentLog={currentLog}
          workouts={workouts}
          onBack={() => setView("dashboard")}
          onAdd={addExercise}
          onDelete={deleteExercise}
          templates={templates[activeMuscleGroup]}
        />
      )}
    </div>
  );
}

// --- Dashboard View ---

const Dashboard = ({
  currentDate,
  muscleGroup,
  setMuscleGroup,
  workouts,
  onLogClick,
  onDateChange,
  totalWorkouts,
}: {
  currentDate: Date;
  muscleGroup: string;
  setMuscleGroup: (group: string) => void;
  workouts: any;
  onLogClick: () => void;
  onDateChange: (days: number) => void;
  totalWorkouts: number;
}) => {
  const isRestDay = muscleGroup === "Rest";
  const isToday = new Date().toDateString() === currentDate.toDateString();

  // Compute History Logs for the displayed Muscle Group
  const historyLogs = useMemo(() => {
    if (!workouts) return [];

    const logs = Object.values(workouts) as any[];

    const filtered = logs.filter(
      (log) =>
        log.muscleGroup === muscleGroup &&
        log.exercises &&
        log.exercises.length > 0
    );

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workouts, muscleGroup]);

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      {/* Date Navigator */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <button
          onClick={() => onDateChange(-1)}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            {isToday ? "Today" : getFormattedDate(currentDate)}
          </h2>
        </div>
        <button
          onClick={() => onDateChange(1)}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Main Focus Card */}
      <div
        className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden ${
          isRestDay
            ? "bg-gradient-to-br from-emerald-400 to-teal-600"
            : "bg-gradient-to-br from-indigo-500 to-purple-700"
        }`}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <Activity className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wide">
              Target Muscle
            </span>
          </div>

          {/* Muscle Group Selector */}
          <div className="relative mb-4 group">
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              className="w-full bg-transparent text-4xl font-extrabold appearance-none outline-none cursor-pointer hover:opacity-90 transition"
            >
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g} className="text-gray-900 text-lg">
                  {g}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-3 w-6 h-6 pointer-events-none opacity-70" />
          </div>

          {!isRestDay ? (
            <button
              onClick={onLogClick}
              className="bg-white text-indigo-600 px-6 py-2.5 rounded-full font-bold text-sm shadow-md hover:bg-gray-50 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Log Workout
            </button>
          ) : (
            <div className="flex items-center gap-2 text-white/90 font-medium bg-white/20 w-fit px-4 py-2 rounded-full backdrop-blur-sm">
              <Calendar className="w-4 h-4" />
              Enjoy your recovery!
            </div>
          )}
        </div>

        {/* Decorative BG Icon */}
        <Dumbbell className="absolute -bottom-6 -right-6 w-40 h-40 text-white opacity-10 transform -rotate-12" />
      </div>

      {/* Past Logs Section */}
      {!isRestDay && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-700 font-bold text-lg">
            <History className="w-5 h-5 text-indigo-500" />
            <span>Past Logs ({muscleGroup})</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {historyLogs.length > 0 ? (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {historyLogs.map((log: any) => (
                  <div
                    key={log.date}
                    className="p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-2 mb-2 text-indigo-600 font-bold text-sm">
                      <Calendar className="w-3 h-3" />
                      {log.date}{" "}
                      <span className="text-gray-500 font-normal ml-1">
                        {log.dayOfWeek}
                      </span>
                    </div>
                    <div className="space-y-3 pl-2 border-l-2 border-indigo-100">
                      {log.exercises.map((ex: any, idx: number) => (
                        <div key={idx} className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm">
                            {ex.exerciseName}
                          </span>
                          <span className="text-xs text-gray-500 font-mono font-medium">
                            {ex.weight} kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <History className="w-12 h-12 mb-2 text-gray-300" />
                <p>No past logs for {muscleGroup}.</p>
                <p className="text-xs mt-1">
                  Start logging to see history here!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">{totalWorkouts}</p>
          <p className="text-xs text-gray-500 uppercase">Total Sessions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">
            {isRestDay ? "0" : "1"}
          </p>
          <p className="text-xs text-gray-500 uppercase">Streak</p>
        </div>
      </div>
    </div>
  );
};

// --- Logger View ---

const Logger = ({
  currentDate,
  muscleGroup,
  currentLog,
  workouts,
  onBack,
  onAdd,
  onDelete,
  templates,
}: {
  currentDate: Date;
  muscleGroup: string;
  currentLog: any;
  workouts: any;
  onBack: () => void;
  onAdd: (name: string, weight: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  templates: any;
}) => {
  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState(10);
  const [mode, setMode] = useState("select");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Combine default exercises with user's custom templates and deduplicate
  const availableExercises = useMemo(() => {
    const defaults = DEFAULT_EXERCISES[muscleGroup] || [];
    const customs = templates || [];
    return Array.from(new Set([...defaults, ...customs]));
  }, [muscleGroup, templates]);

  // Compute Full History for this Muscle Group
  const historyLogs = useMemo(() => {
    if (!workouts) return [];
    const logs = Object.values(workouts) as any[];
    const filtered = logs.filter(
      (log) =>
        log.muscleGroup === muscleGroup &&
        log.exercises &&
        log.exercises.length > 0
    );
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workouts, muscleGroup]);

  // Smart Progressive Overload
  const previousPerformance = useMemo(() => {
    if (!exerciseName || !historyLogs.length) return null;
    for (const log of historyLogs) {
      if (log.date === getFormattedDate(currentDate)) continue;
      const found = log.exercises.find((e: any) => e.exerciseName === exerciseName);
      if (found) return { weight: found.weight, date: log.date };
    }
    return null;
  }, [historyLogs, exerciseName, currentDate]);

  const handleSave = async () => {
    if (!exerciseName) return;
    setIsSaving(true);
    try {
      await onAdd(exerciseName, weight);
      setShowSuccess(true);
      setExerciseName("");
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      // Improved Error Handling: Alert the actual error message
      console.error("Save error details:", err);
      // Fallback for user clarity
      alert(
        `Error: ${
          err.message || "Could not save data."
        }\n\nPlease check your Firebase Console Rules.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5 mr-1" /> Back
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-500 font-bold uppercase">
            {getFormattedDate(currentDate)}
          </p>
          <p className="text-sm font-bold text-indigo-600">{muscleGroup} Day</p>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-lg mx-auto w-full">
        {/* Input Card */}
        <div className="bg-white rounded-xl shadow-lg border border-indigo-50 p-5 space-y-4">
          <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setMode("select")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                mode === "select"
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-gray-500"
              }`}
            >
              Select
            </button>
            <button
              onClick={() => {
                setMode("new");
                setExerciseName("");
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                mode === "new"
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-gray-500"
              }`}
            >
              Custom
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Exercise
              </label>
              {mode === "select" ? (
                <select
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                >
                  <option value="">-- Choose Exercise --</option>
                  {availableExercises.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Concentric Curls"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Weight (kg)
              </label>
              <select
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                value={weight}
                onChange={(e: any) => setWeight(e.target.value)}
              >
                {WEIGHT_INCREMENTS.map((w) => (
                  <option key={w} value={w}>
                    {w} kg
                  </option>
                ))}
              </select>
            </div>

            {/* Smart Progressive Overload Indicator */}
            {previousPerformance && (
              <div className="flex items-center gap-2 text-xs bg-orange-50 text-orange-700 p-2 rounded-lg border border-orange-100">
                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                <div>
                  Last time ({previousPerformance.date}) you lifted{" "}
                  <strong>{previousPerformance.weight} kg</strong>.
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!exerciseName || isSaving}
              className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md flex justify-center items-center gap-2 mt-2
                ${
                  !exerciseName || isSaving
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition"
                }
                ${showSuccess ? "bg-green-500 hover:bg-green-600" : ""}
                `}
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : showSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Log Set
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current Session List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-800 font-bold px-1">
            <Activity className="w-5 h-5 text-indigo-500" />
            Today's Log
          </div>
          {currentLog.exercises.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300 text-sm">
              <p>No exercises logged yet today.</p>
            </div>
          ) : (
            currentLog.exercises
              .slice()
              .reverse()
              .map((ex: any) => (
                <div
                  key={ex.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group"
                >
                  <div>
                    <h3 className="font-bold text-gray-800">
                      {ex.exerciseName}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono mt-0.5">
                      {ex.weight} kg
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(ex.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
