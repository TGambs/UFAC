import "./App.css";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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

  /* for formatting audio */
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>("wav");
  const [converting, setConverting] = useState(false);
  const [conversionResults, setConversionResults] = useState<{ file: string; status: string }[]>([]);


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


const pickFiles = async () => {
  const selected = await open({
    multiple: true,
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "flac", "aac", "ogg"] }],
  });
  if (selected) {
    setSelectedFiles(Array.isArray(selected) ? selected : [selected]);
  }
};

const pickFolder = async () => {
  const selected = await open({ directory: true });
  if (selected && typeof selected === "string") {
    // list audio files inside the folder via a Rust command (see note below)
    const files = await invoke<string[]>("list_audio_files", { folderPath: selected });
    setSelectedFiles(files);
  }
};

const convertFiles = async () => {
  if (selectedFiles.length === 0) return;
  setConverting(true);
  setConversionResults([]);

  const results: { file: string; status: string }[] = [];
  for (const file of selectedFiles) {
    try {
      await invoke("convert_audio", { inputPath: file, targetFormat });
      results.push({ file, status: "Converted" });
    } catch (e) {
      results.push({ file, status: `Failed: ${String(e)}` });
    }
  }

  setConversionResults(results);
  setConverting(false);
};

const clearSelectedFiles = () => {
  setSelectedFiles([]);
  setConversionResults([]);
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
          <button id="tbBt4" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg4")}>Soundcloud Download</button>
          <button id="tbBt5" className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("pg5")}>USB Verification</button>
        </div>
      </div>

      {activePage === "pg1" &&(
        <div id="mainPg1">
          <img src="/Images/UFAC_icon.png" className="ufacLogo"></img>
          <div id="pg1Txt">

            {/* <p><b>Within this app you are able to:</b>
              <br></br>- View and format external usb drives plugged in
              <br></br>- Convert audio files to different file types
              <br></br>- More coming soon...
            </p> */}

            <p>The aim of this project is to simplify the process of formatting and managing USB storage for DJs.
               As a new DJ myself, understanding the process of setting up and formatting USBs, to be used on many 
               different decks, is difficult. But having an all-in-one app which allows you to format and manage 
               the drive, makes it much easier for both experienced and new talent to get through the process 
               quickly and reliably.</p>
          </div>

          <div id="pg1Pols">
            <p>This app does not send any data externally, and no data is stored on your device</p>
            <p>This app utilises FFmpeg (ffmpeg.exe), licensed under GPLv3. Source available at ffmpeg.org</p>
            <br></br>
            <p>App created by Tom Gambro</p>

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




      {activePage === "pg3" && (
        <div id="pg3Main">

          <div id="pg3Controls">
            <button className="pg3PickBtn" onClick={pickFiles}>Select Files</button>
            <button className="pg3PickBtn" onClick={pickFolder}>Select Folder</button>

            <select value={targetFormat} onChange={(e) => setTargetFormat(e.target.value)}>
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
              <option value="m4a">M4A</option>
              <option value="flac">FLAC</option>
            </select>

            <button id="pg3ConvBtn" onClick={convertFiles} disabled={selectedFiles.length === 0 || converting}>
              {converting ? "Converting…" : `Convert ${selectedFiles.length} file(s)`}
            </button>

            <button id="pg3ClearBtn" onClick={clearSelectedFiles} disabled={selectedFiles.length === 0}>Clear</button>
          </div>

          {selectedFiles.length > 0 && (
            <ul id="pg3FileList">
              {selectedFiles.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}

          {conversionResults.length > 0 && (
            <div id="pg3Results">
              {conversionResults.map((r) => (
                <p key={r.file}>{r.file} : {r.status}</p>
              ))}
            </div>
          )}
        </div>
      )} {/* end of page 3 */}


      {activePage === "pg4" && (
        <div id="pg4Main">
          <h2>Under Construction</h2>
        </div>
      )} {/* end of page 4 */}

      
      {activePage === "pg5" && (
        <div id="pg5Main">
          <h2>Under Construction</h2>
        </div>
      )} {/* end of page 5 */}
    </main>
  );
}




/* Used to begin the running of the app */
export default App;
