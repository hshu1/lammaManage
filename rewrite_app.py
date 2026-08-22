import re
import io

with io.open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace("import DashboardTab from './components/DashboardTab.jsx';", "import HomeView from './components/HomeView.jsx';")
content = content.replace("import ModelsTab from './components/ModelsTab.jsx';", "")
content = content.replace("import DownloadTab from './components/DownloadTab.jsx';", "import DownloadModal from './components/DownloadTab.jsx';")
content = content.replace("import SettingsTab from './components/SettingsTab.jsx';", "import SettingsModal from './components/SettingsTab.jsx';")

# 2. State
content = content.replace("const [activeTab, setActiveTab] = useState('dashboard');", """
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
""")

# 3. Header props
header_old = """      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverStatus={serverStatus}
        modelsCount={models.length}
        theme={theme}
        onThemeChange={handleThemeChange}
        onQuickAddClick={() => setIsQuickAddOpen(true)}
        addToast={addToast}
      />"""

header_new = """      <Header
        theme={theme}
        onThemeChange={handleThemeChange}
        onDownloadClick={() => setIsDownloadOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        addToast={addToast}
      />"""
content = content.replace(header_old, header_new)

# 4. Main content replacement
main_old_start = "{/* 主体内容 */}"
main_old_end = "</main>"

start_idx = content.find(main_old_start)
end_idx = content.find(main_old_end) + len(main_old_end)

main_new = """      {/* 主体内容 */}
      <main className="app-container" style={{ flex: 1, padding: '24px' }}>
        {config && (
          <HomeView
            config={config}
            models={models}
            serverStatus={serverStatus}
            logs={logs}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onRestartServer={handleRestartServer}
            onClearLogs={() => setLogs([])}
            addToast={addToast}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        configMeta={configMeta}
        theme={theme}
        onThemeChange={handleThemeChange}
        onSaveConfig={handleSaveConfig}
        onResetConfig={handleResetConfig}
        onOpenFolder={handleOpenFolder}
        addToast={addToast}
      />

      <DownloadModal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        config={config}
        models={models}
        bookmarks={bookmarks}
        downloadJobs={downloadJobs}
        onStartDownload={handleStartDownload}
        onCancelDownload={handleCancelDownload}
        onSaveBookmark={handleSaveBookmark}
        onDeleteBookmark={handleDeleteBookmark}
        onResetBookmarks={handleResetBookmarks}
        onStartModel={handleStartSpecificModel}
        addToast={addToast}
      />"""

if start_idx != -1 and content.find(main_old_end) != -1:
    content = content[:start_idx] + main_new + content[end_idx:]

# Remove setActiveTab references if any remain in handles (like handleStartSpecificModel)
content = content.replace("setActiveTab('dashboard');", "")

with io.open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
