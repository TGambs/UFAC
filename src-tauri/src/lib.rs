// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, list_drives])
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
    drive_type: String
}

#[tauri::command]
fn list_drives() -> Result<Vec<Drive>, String> {
    let output = Command::new("powershell")
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

            Some(Drive {
                letter: item.get("DeviceID")?.as_str().unwrap_or("?").to_string(),
                label: item.get("VolumeName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                filesystem: item.get("FileSystem").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                size_gb: (size / 1_073_741_824.0 * 100.0).round() / 100.0,
                free_gb: (free / 1_073_741_824.0 * 100.0).round() / 100.0,
                drive_type: drive_type.to_string(),
            })
        }).collect();

        Ok(drives)
}

// ----------------------------------------------------- ^ - Storage Reading - ^ -------------------------------------------------------------