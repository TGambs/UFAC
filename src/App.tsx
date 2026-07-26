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
  eject: boolean;
}


/* functions used in HTML */
function App() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [error, setError] = useState<string>("");
  const [activePage, setActivePage] = useState<string>("home"); // used for changing which div to show
  const [ejectMessage, setEjectMessage] = useState(""); // used for safe eject message

  /* for formatting drives */
  const [formatLetter, setFormatLetter] = useState<string>("");
  const [formatFs, setFormatFs] = useState<string>("FAT32");
  const [formatLabel, setFormatLabel] = useState<string>("");
  const [formatting, setFormatting] = useState(false);
  const [formatMessage, setFormatMessage] = useState("");

  const loadDrives = async () => {
    setEjectMessage(""); // removes safe eject message
    try {
      const result = await invoke<Drive[]>("list_drives");
      setDrives(result);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const ejectDrive = async (letter: string) => {
  try {
    await invoke("eject_drive", { letter });

    setEjectMessage(`${letter} is safe to remove now`);
  } catch (e) {
    setEjectMessage(`Failed to eject ${letter}.`);
    console.error(e);
  }
};

const formatDrive = async () => {
  if (!formatLetter) {
    setFormatMessage("Select a drive first.");
    return;
  }

  // If no label was typed, reuse the drive's existing label
  const selectedDrive = drives.find((d) => d.letter === formatLetter);
  const labelToUse = formatLabel.trim() !== "" ? formatLabel : (selectedDrive?.label || "");

  const confirmed = window.confirm(
    `This will permanently erase all data on drive ${formatLetter}: ${labelToUse}. Continue?`);
  if (!confirmed) return;


  setFormatting(true);
  setFormatMessage("");
  try {
    await invoke("format_drive", {
      letter: formatLetter,
      filesystem: formatFs,
      label: labelToUse,
    });
    setFormatMessage(`${formatLetter} was formatted successfully.`);
    loadDrives(); // refresh table to show new label/filesystem
  } catch (e) {
    setFormatMessage(`Failed to format ${formatLetter}: ${String(e)}`);
  } finally {
    setFormatting(false);
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
          <button id="tbBt3" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg3")}>Audio Conversion</button>
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

          <div id="pg1Pols">
            <p>This app does not send any data externally, all data used within the app is either stored locally or not stored at all.</p>
            <p>This app was </p>
          </div>
        </div>
      )} {/* End of page 1 */}

      {activePage === "pg2" && (
        <div id="mainPg2">

          <button id="pg2RefreshBtn" onClick={loadDrives}>Refresh drives</button>
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
                <th>Eject?</th>
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
                  <td>{d.eject && (<button id="pg2EjectBtn" onClick={() => ejectDrive(d.letter)}>Eject</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {ejectMessage && (
            <div id="pg2EjectMssg">
              <p>✓ {ejectMessage} ✓</p>
            </div>
          )}

          <div id="pg2FormatPanel">
            <h3>Format a USB drive</h3>
            <div id="pg2FormatControls">
              <select
                value={formatLetter}
                onChange={(e) => setFormatLetter(e.target.value)}
              >
                <option value="">Select removable drive…</option>
                {drives
                  .filter((d) => d.eject) // only removable drives shown
                  .map((d) => (
                    <option key={d.letter} value={d.letter}>
                      {d.letter} {d.label ? `(${d.label})` : ""}
                    </option>
                  ))}
              </select>

              <select value={formatFs} onChange={(e) => setFormatFs(e.target.value)}>
                <option value="FAT32">FAT32</option>
                <option value="exFAT">exFAT</option>
                <option value="NTFS">NTFS</option>
              </select>

              <input
                type="text"
                placeholder="Volume Name"
                value={formatLabel}
                onChange={(e) => setFormatLabel(e.target.value)}
                maxLength={32}
              />

              <button
                id="pg2FormatBtn"
                onClick={formatDrive}
                disabled={!formatLetter || formatting}
              >
                {formatting ? "Formatting…" : "Format Drive"}
              </button>
            </div>

            {formatMessage && (
              <div id="pg2FormatMssg">
                <p>{formatMessage}</p>
              </div>
            )}
          </div>

        </div>

      )} {/* End of Page 2 */}


      {activePage === "pg3" &&(
        <div id="pg3Main">
          <h2>Audio Conversion</h2>

        </div>
      )} {/* End of page 3 */}

      
    </main>
  );
}




/* Used to begin the running of the app */
export default App;
