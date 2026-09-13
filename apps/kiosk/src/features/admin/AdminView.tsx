import { useEffect, useState } from "react";
import { applyTheme, isDarkModeEnabled, isTranscriptionVisible, setTranscriptionVisible } from "../../config/theme";
import "./AdminView.css";

const BACKEND_HTTP_URL = import.meta.env.VITE_BACKEND_HTTP_URL ?? "http://localhost:8787";

const DEFAULT_WELCOME_GREETING = "Welcome to ABC Hospital. Thangalk enth sahayam aanu vende?";

export function AdminView({ onClose }: { onClose: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => isDarkModeEnabled());
  const [showTranscription, setShowTranscription] = useState<boolean>(() => isTranscriptionVisible());
  const [blobType, setBlobType] = useState<string>(() => {
    const saved = localStorage.getItem("arteq_blob_type");
    if (saved) return saved;
    return isDarkModeEnabled() ? "blob-1" : "blob-4";
  });

  const [greetingText, setGreetingText] = useState<string>(() => {
    return localStorage.getItem("arteq_welcome_greeting") || DEFAULT_WELCOME_GREETING;
  });
  const [isSavingGreeting, setIsSavingGreeting] = useState(false);
  const [greetingSavedStatus, setGreetingSavedStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [memoryText, setMemoryText] = useState<string>(() => {
    return localStorage.getItem("arteq_hospital_memory") || "";
  });
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memorySavedStatus, setMemorySavedStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchMemory() {
      try {
        const res = await fetch(`${BACKEND_HTTP_URL}/api/admin/memory`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.memory === "string") {
            setMemoryText(data.memory);
            localStorage.setItem("arteq_hospital_memory", data.memory);
          }
        }
      } catch (err) {
        console.warn("[AdminView] Could not fetch hospital memory from server, using local copy:", err);
      }
    }
    async function fetchGreeting() {
      try {
        const res = await fetch(`${BACKEND_HTTP_URL}/api/admin/greeting`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.greeting === "string" && data.greeting.trim()) {
            setGreetingText(data.greeting);
            localStorage.setItem("arteq_welcome_greeting", data.greeting);
          }
        }
      } catch (err) {
        console.warn("[AdminView] Could not fetch welcome greeting from server, using local copy:", err);
      }
    }
    fetchMemory();
    fetchGreeting();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveGreeting = async () => {
    setIsSavingGreeting(true);
    setGreetingSavedStatus(null);
    localStorage.setItem("arteq_welcome_greeting", greetingText);

    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/api/admin/greeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greeting: greetingText }),
      });
      if (res.ok) {
        setGreetingSavedStatus({ type: "success", message: "Greeting saved successfully!" });
      } else {
        setGreetingSavedStatus({ type: "error", message: "Failed to save to server" });
      }
    } catch (err) {
      console.error("[AdminView] Error saving greeting:", err);
      setGreetingSavedStatus({ type: "success", message: "Saved locally (offline)" });
    } finally {
      setIsSavingGreeting(false);
      setTimeout(() => {
        setGreetingSavedStatus(null);
      }, 4000);
    }
  };

  const handleSaveMemory = async () => {
    setIsSavingMemory(true);
    setMemorySavedStatus(null);
    localStorage.setItem("arteq_hospital_memory", memoryText);

    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/api/admin/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory: memoryText }),
      });
      if (res.ok) {
        setMemorySavedStatus({ type: "success", message: "Memory saved successfully!" });
      } else {
        setMemorySavedStatus({ type: "error", message: "Failed to save to server" });
      }
    } catch (err) {
      console.error("[AdminView] Error saving memory:", err);
      setMemorySavedStatus({ type: "success", message: "Saved locally (offline)" });
    } finally {
      setIsSavingMemory(false);
      setTimeout(() => {
        setMemorySavedStatus(null);
      }, 4000);
    }
  };

  const handleSelectBlob = (type: string) => {
    localStorage.setItem("arteq_blob_type", type);
    setBlobType(type);
    window.dispatchEvent(new Event("arteq_blob_type_changed"));
  };

  const handleSetDarkMode = (enabled: boolean) => {
    setIsDarkMode(enabled);
    localStorage.setItem("arteq_dark_mode", enabled ? "true" : "false");
    applyTheme(enabled);

    const newBlob = enabled ? "blob-1" : "blob-4";
    localStorage.setItem("arteq_blob_type", newBlob);
    setBlobType(newBlob);
    window.dispatchEvent(new Event("arteq_blob_type_changed"));
  };

  const handleSetShowTranscription = (enabled: boolean) => {
    setShowTranscription(enabled);
    setTranscriptionVisible(enabled);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin123") {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Invalid credentials");
    }
  };

  const renderDarkModeToggle = () => (
    <div className="admin-card dark-mode-settings-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Dark Mode</h3>
        <div className="dark-mode-options" style={{ marginTop: 0 }}>
          <label className="blob-option-label">
            <input
              type="radio"
              name="darkMode"
              value="off"
              checked={!isDarkMode}
              onChange={() => handleSetDarkMode(false)}
            />
            <span>Off</span>
          </label>
          <label className="blob-option-label">
            <input
              type="radio"
              name="darkMode"
              value="on"
              checked={isDarkMode}
              onChange={() => handleSetDarkMode(true)}
            />
            <span>On</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderTranscriptionToggle = () => (
    <div className="admin-card dark-mode-settings-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Show Gemini Live Transcription</h3>
          <p className="hint" style={{ fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
            Controls visibility of the Gemini Live transcription debug overlay
          </p>
        </div>
        <div className="dark-mode-options" style={{ marginTop: 0 }}>
          <label className="blob-option-label">
            <input
              type="radio"
              name="showTranscription"
              value="off"
              checked={!showTranscription}
              onChange={() => handleSetShowTranscription(false)}
            />
            <span>Off</span>
          </label>
          <label className="blob-option-label">
            <input
              type="radio"
              name="showTranscription"
              value="on"
              checked={showTranscription}
              onChange={() => handleSetShowTranscription(true)}
            />
            <span>On</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderBlobSelector = () => (
    <div className="admin-card blob-settings-card">
      <h3>Blob Type</h3>
      <p className="hint" style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
        Select the voice assistant orb visual style:
      </p>
      <div className="blob-options">
        {[
          { id: "blob-1", label: "Blob 1" },
          { id: "blob-2", label: "Blob 2" },
          { id: "blob-3", label: "Blob 3" },
          { id: "blob-4", label: "Blob 4" },
        ].map((item) => (
          <label key={item.id} className="blob-option-label">
            <input
              type="radio"
              name="blobType"
              value={item.id}
              checked={blobType === item.id}
              onChange={() => handleSelectBlob(item.id)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderGreetingCard = () => (
    <div className="admin-card memory-settings-card">
      <div className="memory-card-header">
        <div>
          <h3>Welcome Greeting</h3>
          <p className="hint" style={{ fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            The kiosk welcome greeting spoken when a patient approaches:
          </p>
        </div>
        {greetingSavedStatus && (
          <span className="memory-status-badge" data-type={greetingSavedStatus.type}>
            {greetingSavedStatus.message}
          </span>
        )}
      </div>
      <input
        type="text"
        className="admin-input"
        style={{ width: "100%", boxSizing: "border-box" }}
        placeholder="Welcome to ABC Hospital. Thangalk enth sahayam aanu vende?"
        value={greetingText}
        onChange={(e) => setGreetingText(e.target.value)}
        disabled={isSavingGreeting}
      />
      <div className="memory-card-footer">
        <span className="memory-char-count">
          {greetingText.length} characters
        </span>
        <button
          type="button"
          className="primary-action memory-save-btn"
          onClick={handleSaveGreeting}
          disabled={isSavingGreeting}
        >
          {isSavingGreeting ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );

  const renderMemoryCard = () => (
    <div className="admin-card memory-settings-card">
      <div className="memory-card-header">
        <div>
          <h3>Memory</h3>
          <p className="hint" style={{ fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            Add extra hospital information (visiting hours, pharmacy location, amenities, parking, rules) for Gemini Live:
          </p>
        </div>
        {memorySavedStatus && (
          <span className="memory-status-badge" data-type={memorySavedStatus.type}>
            {memorySavedStatus.message}
          </span>
        )}
      </div>
      <textarea
        className="admin-textarea"
        placeholder="e.g. Visiting hours: 4 PM - 7 PM&#10;Pharmacy: Ground Floor next to Reception Counter 2 (open 24/7)&#10;Cafeteria: 2nd Floor (7 AM - 9 PM)&#10;Wheelchairs available at entrance security desk..."
        value={memoryText}
        onChange={(e) => setMemoryText(e.target.value)}
        rows={6}
        disabled={isSavingMemory}
      />
      <div className="memory-card-footer">
        <span className="memory-char-count">
          {memoryText.length} characters
        </span>
        <button
          type="button"
          className="primary-action memory-save-btn"
          onClick={handleSaveMemory}
          disabled={isSavingMemory}
        >
          {isSavingMemory ? "Saving..." : "Save Memory"}
        </button>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="screen screen-admin">
        <div className="admin-modal">
          <h2>Settings & Administration</h2>
          {renderDarkModeToggle()}
          {renderBlobSelector()}
          {renderTranscriptionToggle()}
          <h3 style={{ marginTop: "1.5rem", fontSize: "1.2rem" }}>Admin Login</h3>
          <form onSubmit={handleLogin} className="admin-form">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="admin-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
            />
            {error && <p className="admin-error">{error}</p>}
            <div className="admin-actions">
              <button type="button" onClick={onClose} className="secondary-action">
                Close
              </button>
              <button type="submit" className="primary-action">
                Login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen-admin">
      <div className="admin-dashboard">
        <header className="admin-header">
          <h2>Hospital Administration</h2>
          <button onClick={onClose} className="secondary-action">Logout</button>
        </header>
        <div className="admin-content">
          {renderGreetingCard()}
          {renderMemoryCard()}
          {renderDarkModeToggle()}
          {renderBlobSelector()}
          {renderTranscriptionToggle()}
          <div className="admin-card">
            <h3>Departments & Doctors</h3>
            <p>Manage hospital departments and doctor availability.</p>
            <button className="primary-action" disabled>Manage (Demo)</button>
          </div>
          <div className="admin-card">
            <h3>Patient Registry</h3>
            <p>View and manage registered patients.</p>
            <button className="primary-action" disabled>View Registry (Demo)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

