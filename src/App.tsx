import "./App.css";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/* interface families */
interface Drive {
  letter: string;
  label: string;
  filesystem: string;
  size_gb: number;
  free_gb: number;
  drive_type: string;
}

/* functions used in HTML */
function App() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [error, setError] = useState<string>("");
  const [activePage, setActivePage] = useState<string>("home"); // used for changing which div to show

  const loadDrives = async () => {
    try {
      const result = await invoke<Drive[]>("list_drives");
      setDrives(result);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    loadDrives();
  }, []);

  /* --------------------------------------- Main HTML for UI ------------------------------------------------------------- */
  return (
    <main className="container">

      <div id="taskBar">
        <div id="tbTitle">
          <h1>UFAC</h1>
          <p>The all-in-one usb formatter and audio converter</p>
        </div>
        <div id="tbButtons">
          <button id="tbBt1" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg1")}>About</button>
          <button id="tbBt2" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg2")}>Drives</button>
          <button id="tbBt3" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg3")}>Page 3</button>
          <button id="tbBt4" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg4")}>Page 4</button>
          <button id="tbBt5" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg5")}>Page 5</button>
        </div>
      </div>

      {activePage === "pg1" &&(
        <div id="mainPg1">
          <img src="/Images/UFAC_icon.png" className="ufacLogo"></img>
          <div id="pg1Txt">
            <p><b>Within this app you are able to:</b>
              <br></br>- View and format external usb drives plugged in
              <br></br>- Convert audio files to different file types
              
            </p>
            <p>The aim of this project is to simplify the process of formatting and managing USB storage for DJs.
               As a new DJ myself, understanding the process of setting up and formatting USBs, to be used on many 
               different decks, is difficult. But having an all-in-one app which allows you to format and manage 
               the drive, makes it much easier for both experienced and new talent to get through the process 
               quickly and reliably.</p>
          </div>
        </div>
      )} {/* End of page 1 */}

      {activePage === "pg2" && (
        <div id="mainPg2">
          <p>This is page 2</p>

          <button onClick={loadDrives}>Refresh drives</button>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <table>
            <thead>
              <tr>
                <th>Drive</th>
                <th>Label</th>
                <th>Type</th>
                <th>Filesystem</th>
                <th>Size (GB)</th>
                <th>Free (GB)</th>
              </tr>
            </thead>
            <tbody>
              {drives.map((d) => (
                <tr key={d.letter}>
                  <td>{d.letter}</td>
                  <td>{d.label || "—"}</td>
                  <td>{d.drive_type}</td>
                  <td>{d.filesystem}</td>
                  <td>{d.size_gb}</td>
                  <td>{d.free_gb}</td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>

      )} {/* End of Page 2 */}

      
    </main>
  );
}




/* Used to begin the running of the app */
export default App;
