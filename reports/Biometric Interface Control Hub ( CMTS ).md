# Report 3 — Computer Maintenance and Troubleshooting: Desk Companion System Analysis

> [!ABSTRACT]
> Desk Companion is a high-availability kiosk system deployed on a modern Linux-based hardware stack. This report provides a comprehensive analysis of the system's hardware configuration (ASUS TUF Laptop as Server, Samsung Galaxy Tablet as Client), its sophisticated software environment (Fedora 43, Wayland, Hyprland), and a detailed troubleshooting repository documenting the diagnosis and resolution of 15+ critical issues. By integrating preventative maintenance strategies like battery health monitoring and NVMe SMART auditing, the project ensures long-term operational stability in a high-compute edge environment.

---

## Index / Table of Contents
1. [[#Hardware Inventory & Technical Specifications]]
   - [[#Server Node: ASUS TUF Gaming F15]]
   - [[#Client Node: Samsung Galaxy Tab A8]]
2. [[#Software Environment and OS Configuration]]
   - [[#Fedora 43 and the Linux Kernel]]
   - [[#The Wayland Compositor: Hyprland v0.47.2]]
3. [[#System Architecture and Service Interoperability]]
   - [[#The Role of D-Bus in Command Execution]]
   - [[#Systemd Service Management]]
4. [[#Hardware-Software Synergy: The V4L2 Subsystem]]
   - [[#Udev Rules and Device Persistence]]
   - [[#Kernel Module Management (uvcvideo)]]
5. [[#Comprehensive Troubleshooting Log (15+ Case Studies)]]
   - [[#The Diagnosis Methodology]]
   - [[#Expanded Cases 1 through 15]]
6. [[#System Auditing and Log Management]]
   - [[#Journalctl for Real-time Debugging]]
   - [[#MongoDB Journaling and Recovery]]
7. [[#Preventive Maintenance and Performance Auditing]]
   - [[#Battery Health Calibration (90Wh Status)]]
   - [[#NVMe SSD Health Analysis]]
   - [[#Thermal Management for Edge AI]]
8. [[#Performance Benchmarking and Metrics]]
9. [[#Hardware Upgrade and Lifecycle Planning]]
10. [[#Conclusion]]
11. [[#References]]

---

## Hardware Inventory & Technical Specifications

The Desk Companion ecosystem relies on a **distributed server-client model**. The performance of the face recognition engine is directly proportional to the raw compute power available at the edge.

### Server Node: ASUS TUF Gaming F15 (FX506HE)
The server node acts as the "Central Processing Hub" and the "IoT Gateway."

| Component | Specification | Technical Performance Detail |
| :--- | :--- | :--- |
| **CPU** | Intel Core i7-11800H | 8 Cores / 16 Threads; vital for parallelizing face encoding. |
| **GPU** | NVIDIA RTX 3050 Ti Mobile | 4GB GDDR6; supports CUDA-accelerated dlib inference. |
| **RAM** | 16GB DDR4 @ 3200MHz | Sufficient for concurrent MongoDB/FastAPI/React Dev stacks. |
| **Storage** | 1TB NVMe Gen3 SSD | Ultra-fast random I/O for logging images and DB writes. |
| **Battery** | 90Wh Lithium-Ion | Current health at 74.9%; requires active monitoring via upower. |
| **Webcam** | Sonix USB2.0 HD UVC | The primary sensor for the "Perception Layer." |

### Client Node: Samsung Galaxy Tab A8 (SM-X200)
The client node functions as the "HMI" (Human-Machine Interface), providing a thin-client experience over the local network.

- **CPU**: UNISOC Tiger T618 (Octa-core) designed for lower power consumption.
- **Display**: 10.5" TFT LCD (1920×1200) providing a high-density dashboard UI.
- **Connectivity**: Managed via a Realtek 802.11ac dual-band adapter, ensuring the tablet maintains a low-latency connection (typically < 3ms) to the server gateway.
- **OS**: Android 13 equipped with One UI 5.1; access via standard browser (Chrome/Firefox).

---

## Software Environment and OS Configuration

### Fedora 43 and the Linux Kernel
Choosing **Fedora** as the operating system provides a "stable yet current" foundation. Unlike LTS distributions, Fedora 43 provides the latest kernel features necessary for modern hardware.
- **Kernel 6.13.7**: Includes the latest optimizations for Intel 11th Gen Tiger Lake architecture and improved support for Wayland-based compositors. This kernel also features enhanced **MGLRU (Multi-Gen LRU)** which helps the system handle memory pressure gracefully when running multiple AI models.
- **Package Management**: DNF-based system ensures all dependencies (FastAPI, Python libraries) are up-to-date and patched for security vulnerabilities.

### The Wayland Compositor: Hyprland v0.47.2
The system utilizes **Hyprland**, a dynamic tiling Wayland compositor.
- **Reason for Use**: Wayland is more secure than X11, preventing "keylogging" by isolating applications from each other. Hyprland’s configuration is handled via a single `.conf` file, making maintenance straightforward.
- **Quickshell Integration**: Hyprland provides the environment where Quickshell renders the desktop overlay that triggers "Code Mode" and "Capture Inspiration." The integration relies on the `layer-shell` protocol for smooth rendering over other windows.

---

## System Architecture and Service Interoperability

### The Role of D-Bus in Command Execution
D-Bus is a messaging system that allows applications on Linux to talk to each other. Desk Companion relies on the **Session Bus** for notifications and application launching.

> [!IMPORTANT]
> **Environment Variables**: For the FastAPI server (running as a background process) to trigger desktop actions, it must know the `DBUS_SESSION_BUS_ADDRESS`. If this variable is missing, the server will error out with "Could not connect to D-Bus," breaking the Pomodoro notification flow.

### Systemd Service Management
The backend services are managed by **Systemd**, providing a robust recovery mechanism.
- **`mongod.service`**: Ensures the settings database starts before the API.
- **Auto-Restart Policy**: Each service is configured with `Restart=always` and `RestartSec=5`. If the Python interpreter crashes due to a memory error in the `face_recognition` library, Systemd will automatically restore the service within 5 seconds.

---

## Hardware-Software Synergy: The V4L2 Subsystem

### Udev Rules and Device Persistence
The webcam is mapped by the kernel to a device file in `/dev/video*`. To ensure that the software always finds the webcam on the same path, we implement **Udev rules**.
- **Rule Example**: `SUBSYSTEM=="video4linux", ATTRS{idVendor}=="0c45", ATTRS{idProduct}=="6366", SYMLINK+="desk_webcam"`
- **Benefit**: This prevents the software from breaking if a second camera is plugged in and `/dev/video0` shifts to `/dev/video1`.

### Kernel Module Management (uvcvideo)
The **`uvcvideo`** module is the driver for the Sonix camera. During maintenance, we may need to reload this module to reset a hung camera state.
- **Command**: `sudo modprobe -r uvcvideo && sudo modprobe uvcvideo`
- **Tuning**: Parameters like `quirks=0x80` can be passed to resolve bandwidth issues on cheaper USB controllers.

---

## Comprehensive Troubleshooting Log (15+ Case Studies)

The heart of maintenance is resolving the unexpected. Here are 15 real-world scenarios encountered.

| # | Problem | Diagnosis | Fix Applied | Root Cause |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Pomodoro control fail | Checked `swaync` logs via `journalctl`. | Updated to `swaync-client` command. | Daemon migration from Dunst. |
| **2** | Obsidian not in PATH | `which obsidian` returned nothing. | Hardcoded `/home/r/.local/bin/obsidian.AppImage`. | AppImage not in user binary path. |
| **3** | swaync failing to start | Error: "DBus name already owned". | Modified `quickshell` config to release slot. | DBus resource contention. |
| **4** | DBus timeout | FastAPI logs showed connection refused. | Injected `DBUS_SESSION_BUS_ADDRESS` in `_proc_env()`. | Process environment isolation. |
| **5** | GitHub API 404 | Inspected `api_base` variable in `main.py`. | Added `.removesuffix(".git")`. | Improper URL sanitization. |
| **6** | Settings not persisting | Monitored SQLite `.db` file size. | Migrated to MongoDB with upsert logic. | SQLite concurrency lock. |
| **7** | Tablet reachability | Tested with `ping` and `telnet`. | `firewall-cmd --add-port=8000/tcp` (permanent). | Fedora default firewall policy. |
| **8** | Nested React buttons | Inspected DOM tree in DevTools. | Refactored UI to use `<div>` wrapper. | Invalid HTML nesting logic. |
| **9** | **Mongo Lock File** | Mongo failed to start after power loss. | Deleted `/var/lib/mongodb/mongod.lock`. | Improper shutdown corrupting lock. |
| **10** | **Webcam Bandwidth** | "Failed to grab frame" on 4K cams. | Reduced resolution in `getUserMedia` to 720p. | USB 2.0 bus saturation. |
| **11** | **Kitty Font Render** | Kitty failed to start from FastAPI. | Added `LANG=en_US.UTF-8` to `_proc_env()`. | Locale missing in head-less env. |
| **12** | **OOM Kill** | FaceRec crashed during encoding. | Enabled 4GB ZRAM swap on Fedora. | Heavy RAM usage during JIT encoding. |
| **13** | **Zen Browser Hang** | Browser zombie processes detected. | Switched to `start_new_session=True` in Popen. | Process group cleanup failure. |
| **14** | **NVIDIA Driver Mismatch**| Kernel module not loaded. | `sudo akmods --force` followed by reboot. | Kernel update without driver rebuild. |
| **15** | **SQLite Corruption** | Database in "malformed" state. | Ran `.recover` via `sqlite3` CLI. | Interrupted write during power loss. |

---

## System Auditing and Log Management

### Journalctl for Real-time Debugging
The Linux **Systemic Journal** stores all logs from our FastAPI service. 
- **Command**: `journalctl -u desk-companion.service -f`
- **Analysis**: This allows us to see real-time errors, such as a user’s face not matching due to lighting conditions (Euclidean distance > 0.65).

### MongoDB Journaling and Recovery
MongoDB uses a **journaling** system to ensure data integrity.
> [!TIP]
> **Maintenance Tip**: If the laptop loses power, check the `/var/log/mongodb/mongod.log` file. If "Recovery needed" is found, the system will automatically replay the journal. Ensuring the 1TB NVMe has at least 10% free space is vital for these maintenance operations.

---

## Preventive Maintenance and Performance Auditing

### Battery Health Calibration (90Wh Status)
The ASUS battery is at **74.9%** of its original capacity. To prevent sudden shutdowns during AI inference:
- **Optimization**: Set the battery charge limit to 80% via `asus-nb-ctrl` to slow chemical degradation.
- **Monitoring**: Run `upower -i /org/freedesktop/UPower/devices/battery_BAT1` every transition from AC to DC.

### NVMe SSD Health Analysis
Using `smartmontools`, we audit the health of our storage. High write cycles from MongoDB and JPEGs from the webcam can wear out cells.
- **Command**: `sudo smartctl -a /dev/nvme0n1`
- **Action**: Monitor "Percentage Used" and "Data Units Written" parameters. If "Percentage Used" exceeds 50%, start planning for a replacement Gen4 SSD.

### Thermal Management for Edge AI
Face recognition is a CPU-intensive task. During the "Training" or "Encoding" phase, temperatures on the i7-11800H can spike to 90°C.
- **Maintenance**: Ensure the laptop is on a hard, flat surface. Use `thermald` to manage thermal throttling efficiently on Linux. Check for dust in the fans every 6 months to maintain the 4.6GHz boost clock.

---

## Performance Benchmarking and Metrics

- **Face Recognition Latency**: 0.38s - 0.45s (i7-11800H @ 4.6GHz).
- **Network Round Trip**: < 2ms (over 802.11ac Home LAN).
- **Database Query Latency**: < 5ms (MongoDB indexed search).
- **RAM Usage Over 24h**: Stable at ~1.4GB, indicating no significant memory leaks. The system uses a **Python Garbage Collection** policy to periodically free up memory after large facial encoding bursts.

---

## Hardware Upgrade and Lifecycle Planning

To ensure the "Desk Companion" evolves with modern standards, we propose:
1.  **Dedicated AI Accelerator**: Adding a **Google Coral USB TPU** would move the face recognition workload off the CPU, reducing thermal stress.
2.  **OLED Client Node**: Moving the tablet to a Samsung Tab S9 for better contrast in low-light "Idle" states.
3.  **IR Camera Integration**: Essential for "Liveness Detection" to solve the "Photo Spoofing" vulnerability.
4.  **Wi-Fi 6 Upgrade**: Replacing the RTL8822CE with an **Intel AX210** to leverage 6GHz bands for non-congested tablet streaming.

---

## Conclusion
The Computer Maintenance and Troubleshooting of Desk Companion is a balance of **hardware monitoring** and **software environment tuning**. By maintaining a detailed log of 15+ issues—from D-Bus timeouts to NVIDIA driver mismatches—we create a robust knowledge base that minimizes future downtime. Systematic auditing of the battery and NVMe health via Linux-native tools ensures the ecosystem remains as a reliable, long-term companion for the user's high-performance workload.

---

## References
[^1]: GTU Semester 6 — Computer Maintenance and Troubleshooting syllabus.
[^2]: American Megatrends FX506HE Firmware Release Notes (June 2025).
[^3]: Fedora 43 Official System Administration Guide.
[^4]: NVMe Specification v1.4 (Technical Logic).
[^5]: D-Bus Specification (FreeDesktop.org).
[^6]: Video4Linux2 API Documentation.

---
*End of Report*
