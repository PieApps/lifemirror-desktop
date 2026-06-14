import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  ShieldAlert, Sparkles, BookOpen, Brain, 
  Settings as SettingsIcon, RefreshCw 
} from "lucide-react";
import { SCurveTimeline, ActivityNode } from "./components/SCurveTimeline";
import { JournalModal } from "./components/JournalModal";
import { SettingsPanel } from "./components/SettingsPanel";

function App() {
  const [activities, setActivities] = useState<ActivityNode[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [isIncognito, setIsIncognito] = useState(false);
  const [trackingActive, setTrackingActive] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityNode | null>(null);
  
  // Ollama configuration
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [aiReflection, setAiReflection] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Load configuration settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const url = await invoke<string>("get_db_setting", { key: "ollama_url" });
        if (url) setOllamaUrl(url);

        const model = await invoke<string>("get_db_setting", { key: "ollama_model" });
        if (model) setOllamaModel(model);

        const reflection = await invoke<string>("get_db_setting", { key: "last_ai_reflection" });
        if (reflection && reflection !== "false") setAiReflection(reflection);
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    };
    loadSettings();
  }, []);

  const updateOllamaUrl = async (url: string) => {
    setOllamaUrl(url);
    try {
      await invoke("set_db_setting", { key: "ollama_url", value: url });
    } catch (e) {
      console.error(e);
    }
  };

  const updateOllamaModel = async (model: string) => {
    setOllamaModel(model);
    try {
      await invoke("set_db_setting", { key: "ollama_model", value: model });
    } catch (e) {
      console.error(e);
    }
  };

  // Poll database records
  const loadData = async () => {
    try {
      const dbActivities = await invoke<ActivityNode[]>("get_activities", { limit: 30 });
      setActivities(dbActivities);
      
      const dbJournals = await invoke<any[]>("get_journals", { limit: 10 });
      setJournals(dbJournals);

      const incognitoState = await invoke<boolean>("is_incognito");
      setIsIncognito(incognitoState);
    } catch (e) {
      console.error("Failed to load Tauri DB data:", e);
    }
  };

  useEffect(() => {
    loadData();
    // Poll updates every 3 seconds
    const interval = setInterval(() => {
      if (trackingActive && !isIncognito) {
        loadData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [trackingActive, isIncognito]);

  const handleToggleIncognito = async () => {
    try {
      const newState = await invoke<boolean>("toggle_incognito");
      setIsIncognito(newState);
    } catch (e) {
      console.error("Failed to toggle incognito:", e);
    }
  };

  const handleSaveJournal = async (notes: string) => {
    try {
      await invoke("add_journal", { notes });
      await loadData();
    } catch (e) {
      console.error("Failed to save journal entry:", e);
    }
  };

  const generateAIReflection = async () => {
    if (activities.length === 0) {
      setAiReflection("No activity nodes recorded to reflect on.");
      return;
    }

    setAiLoading(true);
    setAiReflection("");
    
    try {
      // Aggregate top activities
      const summaryText = activities.slice(0, 10).map(node => 
        `- App: ${node.app_name}, Session Title: ${node.window_title}, Spent: ${Math.round(node.duration)} seconds`
      ).join("\n");

      const prompt = `You are a personal productivity reflection companion. Below is a log of my recent desktop focus events. Analyze them and provide a concise, beautiful 2-sentence summary detailing what my focus was on, and highlight if I was productive or distracted.
      
      Logs:
      ${summaryText}
      
      Reflection (Strictly limit to 2 sentences):`;

      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to contact local Ollama: status ${response.status}`);
      }

      const data = await response.json();
      setAiReflection(data.response || "No response received.");
    } catch (err: any) {
      console.error(err);
      setAiReflection(`Mindfulness engine failed. Check that Ollama is running locally (${ollamaUrl}) and that you ran 'ollama pull ${ollamaModel}' first.`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d11] text-gray-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 glass border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Brain className="w-5 h-5 text-gray-100" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">LifeMirror</h1>
            <span className="text-[10px] text-gray-400 font-medium tracking-wide">PRIVACY-FIRST REFLECTION</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isIncognito && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-400 text-xs font-semibold animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>INCOGNITO ACTIVE</span>
            </div>
          )}

          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl hover:bg-zinc-800/50 text-gray-400 hover:text-gray-200 transition-colors border border-transparent hover:border-zinc-800/30 cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl transition-colors border cursor-pointer ${
              showSettings 
                ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20" 
                : "hover:bg-zinc-800/50 border-transparent hover:border-zinc-800/30 text-gray-400 hover:text-gray-200"
            }`}
            title="Configuration"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* S-Curve Timeline column */}
        <div className="lg:col-span-2 relative min-h-[500px] bg-zinc-950/20 rounded-3xl border border-zinc-800/40 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-800/30 flex justify-between items-center">
            <h2 className="text-sm font-semibold tracking-wider text-gray-400 uppercase">Continuous Infographic</h2>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          
          <div className="flex-1 overflow-y-auto relative">
            {/* Visual Lock overlay for Incognito Mode */}
            {isIncognito && (
              <div className="absolute inset-0 bg-[#0d0d11]/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                <ShieldAlert className="w-16 h-16 text-amber-500/90 mb-4 animate-bounce" />
                <h3 className="text-xl font-bold text-gray-200">Timeline Is Encrypted & Locked</h3>
                <p className="text-sm text-gray-400 mt-2 max-w-sm">
                  Active logs are disabled. Turn off Incognito Mode in configurations to resume database insertions.
                </p>
                <button
                  onClick={handleToggleIncognito}
                  className="mt-6 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Disable Incognito Mode
                </button>
              </div>
            )}
            
            <SCurveTimeline 
              activities={activities} 
              onAddJournal={(node) => setSelectedActivity(node)} 
            />
          </div>
        </div>

        {/* Sidebar Reflections & Settings Column */}
        <div className="space-y-6 flex flex-col">
          {showSettings ? (
            <SettingsPanel
              isIncognito={isIncognito}
              onToggleIncognito={handleToggleIncognito}
              ollamaUrl={ollamaUrl}
              setOllamaUrl={updateOllamaUrl}
              ollamaModel={ollamaModel}
              setOllamaModel={updateOllamaModel}
              trackingActive={trackingActive}
              setTrackingActive={setTrackingActive}
            />
          ) : (
            /* AI Reflection Module */
            <div className="glass rounded-2xl p-6 border border-zinc-800/80 flex flex-col gap-4 text-left">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <h3 className="text-sm font-bold tracking-wider text-gray-400 uppercase">Ollama Daily Reflection</h3>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 text-sm leading-relaxed text-gray-300 min-h-[100px] flex items-center justify-center">
                {aiLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-gray-500">Querying local Ollama...</span>
                  </div>
                ) : aiReflection ? (
                  <p className="italic font-medium">"{aiReflection}"</p>
                ) : (
                  <p className="text-gray-500 text-center">
                    Click reflect to compile your active log focus nodes into a local AI reflection.
                  </p>
                )}
              </div>

              <button
                onClick={generateAIReflection}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-gray-100 font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-violet-500/10"
              >
                <Sparkles className="w-4 h-4" />
                <span>Reflect with Ollama</span>
              </button>
            </div>
          )}

          {/* Historical Journals Feed */}
          <div className="glass rounded-2xl p-6 border border-zinc-800/80 flex-1 flex flex-col gap-4 text-left overflow-hidden">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold tracking-wider text-gray-400 uppercase">Mindfulness Logs</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {journals.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs">
                  No historical mindfulness journal entries found.
                </div>
              ) : (
                journals.map((entry) => (
                  <div key={entry.id} className="p-3.5 rounded-xl bg-zinc-950/20 border border-zinc-900 flex flex-col gap-2">
                    <p className="text-sm text-gray-300 leading-normal">{entry.notes}</p>
                    <span className="text-[10px] text-zinc-500 font-mono self-start">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Reflection Journal Overlay */}
      {selectedActivity && (
        <JournalModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onSave={handleSaveJournal}
        />
      )}
    </div>
  );
}

export default App;
