export interface ActivityLogDemo {
  id: number;
  appName: string;
  windowTitle: string;
  startTime: string;
  duration: number; // in seconds
  source: 'OS' | 'Browser';
  url?: string;
  iconUrl?: string;
  domainTag?: string;
  notes?: string;
  isDistraction?: boolean;
  subSessions?: {
    id: number;
    title: string;
    url: string;
    iconUrl: string;
    duration: number;
  }[];
}

export const MOCK_TIMELINE_DATA: ActivityLogDemo[] = [
  {
    id: 1,
    appName: 'Code',
    windowTitle: 'SCurveTimeline.tsx — lifemirror-desktop — Visual Studio Code',
    startTime: '09:15 AM',
    duration: 5400, // 1h 30m
    source: 'OS',
    notes: 'Refactored Bézier curve parametric midpoint node positioning ($t=0.5$).',
  },
  {
    id: 2,
    appName: 'Google Chrome',
    windowTitle: 'Google Chrome — 4 tabs active',
    startTime: '10:45 AM',
    duration: 2700, // 45m
    source: 'Browser',
    url: 'https://github.com/tauri-apps/tauri',
    iconUrl: 'https://github.githubassets.com/favicons/favicon.png',
    domainTag: 'github.com',
    subSessions: [
      {
        id: 201,
        title: 'tauri-apps/tauri: Build smaller, faster, and more secure desktop applications',
        url: 'https://github.com/tauri-apps/tauri',
        iconUrl: 'https://github.githubassets.com/favicons/favicon.png',
        duration: 1200,
      },
      {
        id: 202,
        title: 'rusqlite - Rust crate for SQLite with SQLCipher support',
        url: 'https://docs.rs/rusqlite/latest/rusqlite/',
        iconUrl: 'https://docs.rs/favicon.ico',
        duration: 900,
      },
      {
        id: 203,
        title: 'Chrome Native Messaging API Specification - Chrome Developers',
        url: 'https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging',
        iconUrl: 'https://www.gstatic.com/devrel-devsite/prod/v2a2c/chrome/images/favicon.png',
        duration: 600,
      },
    ],
  },
  {
    id: 3,
    appName: 'Distraction Intercepted',
    windowTitle: 'Reddit: The front page of the internet (Interdicted by Shield)',
    startTime: '11:32 AM',
    duration: 0,
    source: 'OS',
    isDistraction: true,
    notes: 'Active Interdiction Shield triggered: Matched regex rule `reddit.com` while Intention Lock was set to "Writing Rust Core".',
  },
  {
    id: 4,
    appName: 'Spotify',
    windowTitle: 'Spotify Free - Deep Work Beats Playlist',
    startTime: '11:35 AM',
    duration: 3600, // 1h
    source: 'OS',
  },
  {
    id: 5,
    appName: 'Terminal',
    windowTitle: 'raviousprime@desktop: ~/lifemirror-desktop (cargo test)',
    startTime: '12:35 PM',
    duration: 1800, // 30m
    source: 'OS',
    notes: 'Passed zero-telemetry & SQLCipher decryption test suites cleanly.',
  },
];

export const MOCK_AI_REFLECTIONS = {
  dailySummary: "You spent 4.5 hours in total focus today, heavily weighted toward Rust Tauri engineering and documentation. Your active focus was protected by 1 repelled distraction shield event during high-priority deep work.",
  chatResponses: [
    {
      query: "Where did I spend the most time today?",
      response: "Your top focus application today was Visual Studio Code (1 hour 30 minutes, 33% of daily activity), closely followed by terminal cargo testing (30 minutes) and Tauri documentation reading on Chrome (45 minutes)."
    },
    {
      query: "Did I get distracted today?",
      response: "At 11:32 AM, Active Interdiction blocked a visit to Reddit (reddit.com) because your Active Intention was set to 'Writing Rust Core'. The shield overlay successfully prevented context fragmentation."
    },
    {
      query: "Is any of this data leaving my machine?",
      response: "Zero bytes leave your host machine. Your activity logs are encrypted inside a local SQLCipher database using page-level OpenSSL encryption. Local AI responses are generated via Ollama running directly on localhost:11434."
    }
  ]
};
