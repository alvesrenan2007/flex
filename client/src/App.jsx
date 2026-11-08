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

