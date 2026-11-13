import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

function App() {
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [status, setStatus] = useState('Status: Awaiting input...');

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!nickname || !roomId) {
      setStatus('Status: Please fill in both fields.');
      return;
    }
    
    setStatus('Status: Saving details...');
    try {
      const res = await invoke('set_connection_details', { nickname, roomId });
      setStatus(`Status: ${res}`);
    } catch (err) {
      setStatus(`Status: Error - ${err}`);
    }
  };

  const handleToggleProxy = async (e) => {
    const active = e.target.checked;
    setProxyEnabled(active);
    setStatus(`Status: Turning proxy ${active ? 'ON' : 'OFF'}...`);
    
    try {
      const res = await invoke('toggle_proxy', { active });
      setStatus(`Status: ${res}`);
    } catch (err) {
      setStatus(`Status: Error - ${err}`);
      setProxyEnabled(!active); // Revert the checkbox if the Rust command fails
    }
  };

  return (
    <div className="flex-container">
      <div className="flex-card">
        {/* Placeholder for the SVG Logo */}
        <div className="flex-logo-container">
          <img src="/flex-logo.svg" alt="FLEX Logo" className="flex-logo" />
        </div>

        <h1 className="flex-title">Entrar na sala</h1>

        <form className="flex-form" onSubmit={handleConnect}>
          <div className="flex-input-group">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div className="flex-input-group">
            <label htmlFor="roomId">Classroom</label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>

          <button type="submit" className="flex-button">Connect</button>
        </form>

        <hr className="flex-divider" />

        <div className="flex-proxy-section">
          <label className="flex-checkbox-label">
            <input
              type="checkbox"
              checked={proxyEnabled}
              onChange={handleToggleProxy}
              className="flex-checkbox"
            />
            Enable Proxy
          </label>
          <p className="flex-proxy-desc">Bloqueia domínios fora da whitelist da sala.</p>
          <p className="flex-status">{status}</p>
        </div>
      </div>
    </div>
  );
}

export default App;


/*
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function App() {
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isProxyActive, setIsProxyActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Awaiting input...");

  async function handleConnect(e) {
    e.preventDefault();
    try {
      // Calls the set_connection_details Rust function
      const response = await invoke("set_connection_details", { 
        nickname: nickname, 
        roomId: roomId 
      });
      setStatusMsg(response);
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }

  async function handleToggle(e) {
    const newState = e.target.checked;
    setIsProxyActive(newState);
    try {
      // Calls the toggle_proxy Rust function
      const response = await invoke("toggle_proxy", { active: newState });
      setStatusMsg(response);
    } catch (error) {
      console.error("Failed to toggle proxy:", error);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "400px", margin: "0 auto" }}>
      <h2>FLEX Endpoint Agent</h2>
      
      <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label>Nickname: </label>
          <input 
            type="text" 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)} 
            required 
          />
        </div>
        
        <div>
          <label>Classroom ID: </label>
          <input 
            type="text" 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)} 
            required 
          />
        </div>
        
        <button type="submit">Set Details</button>
      </form>

      <hr style={{ margin: "2rem 0" }} />

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <label>Enable Local Proxy: </label>
        <input 
          type="checkbox" 
          checked={isProxyActive} 
          onChange={handleToggle} 
        />
      </div>

      <p style={{ marginTop: "1.5rem", color: "blue" }}>Status: {statusMsg}</p>
    </div>
  );
}
*/
