
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![list_drives, eject_drive, format_drive, convert_audio, list_audio_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


// ------------------------------------------------------- Storage Reading ------------------------------------------------------------------

// For reading drives and usb connections
use serde::Serialize;
use std::process::Command;

//Create structure for holding drive information
#[derive(Serialize,Debug)]
struct Drive {
    letter: String,
    label: String,
    filesystem: String,
    size_gb: f64,
    free_gb: f64,
    drive_type: String,
    eject: bool
}

#[tauri::command]
fn list_drives() -> Result<Vec<Drive>, String> {
    let output = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace,DriveType | ConvertTo-Json"
        ])
        .output()
        .map_err(|e| format!("Failed to run the powershell command: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        // PowerShell returns a single object (not array) if there's only one disk
        let json: serde_json::Value = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        let items: Vec<serde_json::Value> = if json.is_array() {
            json.as_array().unwrap().clone()
        } else {
            vec![json]
        };

        let drives = items.into_iter().filter_map(|item| {
            let size = item.get("Size")?.as_f64().unwrap_or(0.0);
            let free = item.get("FreeSpace")?.as_f64().unwrap_or(0.0);
            let drive_type_num = item.get("DriveType")?.as_i64().unwrap_or(0);

            // Win32_LogicalDisk DriveType: 2=Removable, 3=Fixed(internal), 4=Network, 5=CD-ROM
            let drive_type = match drive_type_num {
                2 => "Removable",
                3 => "Fixed",
                4 => "Network",
                5 => "CD-ROM",
                _ => "Unknown",
            };

            // To see if it is ejectable
            // if drive_type is removable, add a button here to allow the user to eject the device from the host machine
            let eject = drive_type_num == 2;

            Some(Drive {
                letter: item.get("DeviceID")?.as_str().unwrap_or("?").to_string(),
                label: item.get("VolumeName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                filesystem: item.get("FileSystem").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                size_gb: (size / 1_073_741_824.0 * 100.0).round() / 100.0,
                free_gb: (free / 1_073_741_824.0 * 100.0).round() / 100.0,
                drive_type: drive_type.to_string(),
                eject,
            })
        }).collect();

        Ok(drives)
}

// ----------------------------------------------------- ^ - Storage Reading - ^ -------------------------------------------------------------

// -------------- Command for ejecting ------------------
#[tauri::command]
fn eject_drive(letter: String) -> Result<(), String> {
    let script = format!(
        r#"
$drive = "{}"
(New-Object -comObject Shell.Application).Namespace(17).ParseName($drive).InvokeVerb("Eject")
"#,
        letter
    );

    let output = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            &script,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}


// --------------------------- Command for formatting drives ------------------------------------------
#[tauri::command]
fn format_drive(letter: String, filesystem: String, label: String) -> Result<(), String> {
    // Strip trailing colon if present (DeviceID comes through as "D:")
    let drive_letter = letter.trim_end_matches(':').to_string();

    // Safety check: re-verify this is actually removable before formatting,
    // never trust the frontend alone for something destructive
    let check = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "(Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='{}:'\").DriveType",
                drive_letter
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to verify drive type: {}", e))?;

    let drive_type_str = String::from_utf8_lossy(&check.stdout).trim().to_string();
    if drive_type_str != "2" {
        return Err("Refusing to format: drive is not removable.".to_string());
    }

    // Basic validation on filesystem + label to avoid injecting garbage into the script
    let allowed_fs = ["FAT32", "exFAT", "NTFS"];
    if !allowed_fs.contains(&filesystem.as_str()) {
        return Err("Unsupported filesystem type.".to_string());
    }
    let safe_label: String = label.chars().filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '_' || *c == '-').take(32).collect();

    let script = format!(
        r#"Format-Volume -DriveLetter {} -FileSystem {} -NewFileSystemLabel "{}" -Force -Confirm:$false"#,
        drive_letter, filesystem, safe_label
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}



// ---------------------------------- Commands for audio conversion ------------------------------------------------------------

use std::path::Path;

#[tauri::command]
fn convert_audio(input_path: String, target_format: String) -> Result<String, String> {
    let input = Path::new(&input_path);
    let stem = input.file_stem().and_then(|s| s.to_str()).ok_or("Invalid filename")?;
    let parent = input.parent().ok_or("Invalid path")?;
    let output_path = parent.join(format!("{}.{}", stem, target_format));
    let temp_path = parent.join(format!("{}_tmp.{}", stem, target_format));

    // adjust this path to wherever you bundle ffmpeg.exe
    let ffmpeg = "ffmpeg.exe";

    let output = Command::new(ffmpeg)
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-y",
            "-i", input.to_str().ok_or("Invalid input path")?,
            temp_path.to_str().ok_or("Invalid temp path")?,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    // only replace/rename once we know ffmpeg succeeded
    std::fs::rename(&temp_path, &output_path)
        .map_err(|e| format!("Failed to finalize output file: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_audio_files(folder_path: String) -> Result<Vec<String>, String> {
    let exts = ["mp3", "wav", "m4a", "flac", "aac", "ogg"];
    let entries = std::fs::read_dir(&folder_path).map_err(|e| e.to_string())?;

    let files: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|e| e.to_str())
                .map(|e| exts.contains(&e.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .map(|path| path.to_string_lossy().to_string())
        .collect();

    Ok(files)
}
