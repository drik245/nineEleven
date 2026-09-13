# 🍬 nineEleven

A coin-operated + web-enabled candy vending machine built on the **Vicharak Shrike Fi (ESP32-S3)** running MicroPython. Features a 3D consumer web dashboard, Firebase realtime sync, dummy UPI payment, and a physical OLED + button interface.

---

## 📁 Project Structure

```
Vending/
├── Readme.md
├── firmware/                    # MicroPython — flash to Shrike Fi
│   ├── main.py                  # State machine, boot, combo, order polling
│   ├── config.py                # ⚙ ALL configuration (pins, WiFi, Firebase, candy)
│   ├── firebase.py              # Firebase RTDB REST client (urequests)
│   ├── wifi.py                  # WiFi connection with OLED status
│   ├── oled_ui.py               # 9 OLED screen layouts
│   ├── servo.py                 # PWM servo helper (duty_ns)
│   ├── coin.py                  # IR coin counter (interrupt-driven)
│   └── ssd1306.py               # SPI SSD1306 OLED driver
└── dashboard/                   # Web frontend — open in browser
    ├── images/
    │   ├── candy.png             # Original candy image
    │   ├── candy_a.png           # Candy A image (copy of candy.png)
    │   ├── candy_b.png           # Candy B image
    │   └── candy_c.png           # Candy C image
    └── src/
        ├── index.html            # Consumer-facing page
        ├── style.css             # Light jolly theme (pastels, Fredoka font)
        └── app.js                # Three.js 3D vending machine + Firebase + payments
```

---

## 🔧 Hardware

| Component          | Detail                                     |
|--------------------|--------------------------------------------|
| **Board**          | Vicharak Shrike Fi (ESP32-S3, MicroPython) |
| **Display**        | SSD1306 128×64 OLED (SPI)                  |
| **Coin Sensor**    | IR module, D0 digital (active LOW)         |
| **Servos**         | 3× standard hobby servo (50 Hz PWM)       |
| **Buttons**        | 5-way nav pad (UP/DOWN/LEFT/RIGHT/SELECT)  |

---

## 🔌 Wiring Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHRIKE FI (ESP32-S3)                        │
│                                                                 │
│  SPI OLED (SSD1306 128×64):                                     │
│    SCK   → IO5     MOSI  → IO6     MISO (dummy) → IO1          │
│    CS    → IO7     DC    → IO4     RES  → IO3                   │
│                                                                 │
│  Servos (50 Hz PWM, 5V power):                                  │
│    Candy A → IO8     Candy B → IO9     Candy C → IO10           │
│                                                                 │
│  IR Coin Sensor:                                                │
│    D0 → IO2 (active LOW, adjust threshold with onboard knob)    │
│                                                                 │
│  5-Way Nav Buttons (pulled-up, press = LOW):                    │
│    UP → IO14    DOWN → IO15    LEFT → IO16                      │
│    RIGHT → IO17 (reserved)     SELECT → IO18                    │
│                                                                 │
│  Power:                                                         │
│    Servo VCC → 5V     OLED VCC → 3.3V     All GNDs → GND       │
└─────────────────────────────────────────────────────────────────┘
```

> **Note:** OLED SPI pins (IO1, IO3–IO7) are fixed to match the hardware SPI1 bus used across all Shrike Fi projects. Do NOT change these unless you physically re-wire the OLED. A dummy MISO on IO1 prevents the SPI peripheral from stealing other GPIO pins.

---

## 🍭 Candy Configuration

Defined in `firmware/config.py`:

| Slot | Name     | Price | Coins Needed | Servo Pin |
|------|----------|-------|--------------|-----------|
| 0    | Candy A  | ₹5    | 1 coin       | IO8       |
| 1    | Candy B  | ₹10   | 2 coins      | IO9       |
| 2    | Candy C  | ₹15   | 3 coins      | IO10      |

- **Coin denomination**: ₹5 per coin (1 IR pulse = 1 coin)
- **Initial stock**: 10 units per candy (configurable in `INITIAL_STOCK`)
- Prices must be multiples of 5

To change candy names/prices, edit the `CANDIES` list in `config.py`:

```python
CANDIES = [
    {"name": "Candy A", "price": 5,  "slot": 0},
    {"name": "Candy B", "price": 10, "slot": 1},
    {"name": "Candy C", "price": 15, "slot": 2},
]
```

---

## 🔄 State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
   ┌──────┐  SELECT  ┌──────────┐  SELECT  ┌───────────┐        │
   │ IDLE │────────►│ SELECTED  │────────►│ COIN_WAIT │        │
   │      │         │           │         │           │        │
   └──┬───┘         └─────┬─────┘         └─────┬─────┘        │
      │                   │                     │              │
      │ secret combo      │ LEFT                │ LEFT         │
      │                   │ (cancel)            │ (cancel)     │
      ▼                   ▼                     │              │
  ┌─────────┐        back to IDLE          coins >= price      │
  │ RESTOCK │                                   │              │
  │ (hidden)│                                   ▼              │
  └────┬────┘                            ┌────────────┐        │
       │                                 │ DISPENSING  │        │
       │ LEFT (exit)                     │  (servo)    │        │
       │                                 └──────┬─────┘        │
       ▼                                        │              │
   back to IDLE                                 ▼              │
                                          ┌──────────┐         │
                                          │   DONE   │─────────┘
                                          │ "Enjoy!" │
                                          └──────────┘
```

### IDLE
- OLED shows candy menu with cursor highlight, stock qty, and prices
- **UP/DOWN**: scroll cursor
- **SELECT**: pick highlighted candy → SELECTED
- **Secret combo** (see below): → RESTOCK

### SELECTED
- Shows candy name, price, stock count
- **SELECT**: start accepting coins → COIN_WAIT
- **LEFT**: cancel → back to IDLE

### COIN_WAIT
- Shows progress bar, paid/needed amounts
- Each coin inserted (IR pulse) increments counter
- When enough coins inserted → auto-triggers DISPENSING
- **LEFT**: cancel → back to IDLE

### DISPENSING → DONE → IDLE
- Servo sweeps to dispense angle, holds 600ms, returns
- OLED shows dispensing animation, then "Enjoy!" for 2s
- Stock decremented, sale logged to Firebase

---

## 🔐 Secret Restock Combo

Press buttons in this exact order while on the IDLE screen:

```
UP → DOWN → LEFT → RIGHT → SELECT
```

- **No hint is shown on the OLED** — this is a discrete/hidden feature
- Any wrong button press silently resets the tracker
- Once unlocked, the OLED shows a restock menu:
  - **UP/DOWN**: scroll through candy slots + "Restock All"
  - **SELECT**: reset selected slot to `INITIAL_STOCK` quantity
  - **LEFT**: exit back to IDLE
- Stock is pushed to Firebase after each restock

---

## 🌐 Firebase Integration

### Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Realtime Database** (NOT Firestore)
4. Set database rules to open for development:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
5. Copy the database URL (e.g. `https://my-project-default-rtdb.firebaseio.com`)
6. Paste into `firmware/config.py` as `FIREBASE_URL`

> ⚠️ **Open rules are for prototyping only.** Add authentication rules before deploying publicly.

### Data Structure in Firebase

```json
{
  "vending_machine": {
    "stock": {
      "candy_a": { "name": "Candy A", "price": 5, "qty": 8 },
      "candy_b": { "name": "Candy B", "price": 10, "qty": 5 },
      "candy_c": { "name": "Candy C", "price": 15, "qty": 10 }
    },
    "sales": {
      "-NxABC123": {
        "candy": "Candy A",
        "price": 5,
        "timestamp": 1694534400
      }
    },
    "orders": {
      "-NxDEF456": {
        "candy_index": 0,
        "candy_name": "Candy A",
        "price": 5,
        "status": "pending | completed | failed",
        "timestamp": 1694534400,
        "completed_at": 1694534410
      }
    },
    "status": {
      "online": true,
      "last_seen": 1694534400,
      "total_revenue": 75
    }
  }
}
```

### What the firmware sends to Firebase

| Event                | Firebase Path                   | Method | Data                                      |
|----------------------|---------------------------------|--------|-------------------------------------------|
| Boot (first time)    | `/vending_machine/stock`        | PUT    | All candy stock levels                    |
| Boot (subsequent)    | `/vending_machine/stock`        | GET    | Syncs local stock from cloud              |
| After each dispense  | `/vending_machine/stock/{key}`  | PATCH  | `{ "qty": new_count }`                    |
| After each dispense  | `/vending_machine/sales`        | POST   | `{ candy, price, timestamp }`             |
| Every 60s            | `/vending_machine/status`       | PATCH  | `{ online, last_seen, total_revenue }`    |
| Web order fulfilled  | `/vending_machine/orders/{id}`  | PATCH  | `{ status: "completed" }`                 |
| Restock              | `/vending_machine/stock/{key}`  | PATCH  | `{ "qty": initial_stock }`                |

### Offline mode

All Firebase calls are wrapped in `try/except`. If WiFi is down or Firebase is unreachable, the machine continues working normally with local-only stock tracking. It will NOT crash.

---

## 📱 Web Dashboard (Consumer Frontend)

### What it is

A **consumer-facing** web page where users can:
1. See a 3D vending machine rendered with **Three.js**
2. Browse available candies with images, prices, and stock status
3. Buy candy via dummy UPI payment (QR code or "Pay with UPI" button)
4. See real-time stock updates from Firebase

### How to run

1. Open `dashboard/src/index.html` in any browser (no server needed)
2. Enter your Firebase Realtime Database URL when prompted
3. The URL is saved in `localStorage` so you only enter it once

### Tech stack

| Library              | CDN                                                | Purpose                     |
|----------------------|----------------------------------------------------|-----------------------------|
| Three.js r128        | `cdnjs.cloudflare.com/ajax/libs/three.js/r128`     | 3D vending machine render   |
| Firebase JS SDK 10   | `gstatic.com/firebasejs/10.12.2`                    | Realtime DB listener        |
| qrcode-generator     | `cdn.jsdelivr.net/npm/qrcode-generator@1.4.4`       | Dummy UPI QR code           |

### Design

- Light pastel theme (cream background, pink/purple/mint accents)
- Fonts: **Fredoka** (headings), **Nunito** (body)
- Candy cards with bounce animation, stock badges (green/yellow/red)
- Three.js 3D vending machine with glass front, pink frame, animated candy spheres
- Fully responsive (works on mobile)

---

## 💳 UPI Payment Flow (Dummy)

This is a **simulated** payment flow — no real payment gateway is involved.

### Flow

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌───────────┐
│  Website │     │  QR / UPI │     │   Firebase   │     │  Machine  │
│  "Buy"   │────►│  Confirm  │────►│  pending     │────►│  Dispense │
│          │     │   Modal   │     │  order       │     │           │
└──────────┘     └───────────┘     └──────┬───────┘     └─────┬─────┘
                                          │                   │
                                          │   status:         │
                                          │   "completed"     │
                                          ◄───────────────────┘
                                          │
                                  ┌───────▼──────┐
                                  │   Website    │
                                  │   "Enjoy!"   │
                                  └──────────────┘
```

1. User clicks **"Buy Now"** on a candy card
2. Modal shows a **QR code** (encoded UPI string) + **"Pay with UPI"** button
3. Clicking either opens a **confirmation screen** with candy name + price
4. User clicks **"Confirm & Pay"** → order written to Firebase as `status: "pending"`
5. Website shows **"Dispensing..."** and listens for status change
6. Machine polls `/orders/` every **5 seconds** → finds pending order → dispenses
7. Machine updates order to `status: "completed"`
8. Website detects the change → shows **"✅ Your candy has been dispensed!"**

### If something goes wrong

- **Candy out of stock**: Machine marks order as `status: "failed"`, website shows error
- **Invalid candy**: Machine marks order as `status: "failed", reason: "invalid_candy"`
- **Machine offline**: Order stays `pending` until machine comes back online and picks it up

---

## 🚀 Setup Guide (Step by Step)

### 1. Firebase Setup

```
1. https://console.firebase.google.com → Create project
2. Build → Realtime Database → Create Database
3. Start in test mode (open rules)
4. Copy the database URL
```

### 2. Configure Firmware

Edit `firmware/config.py`:

```python
# Your WiFi credentials
WIFI_SSID     = "YourWiFiName"
WIFI_PASSWORD  = "YourWiFiPassword"

# Your Firebase URL
FIREBASE_URL = "https://your-project-default-rtdb.firebaseio.com"
```

### 3. Flash to Shrike Fi

Using **Thonny** or **mpremote**:

```bash
# Using mpremote (upload all firmware files to board root)
mpremote connect COMx fs cp firmware/main.py :main.py
mpremote connect COMx fs cp firmware/config.py :config.py
mpremote connect COMx fs cp firmware/firebase.py :firebase.py
mpremote connect COMx fs cp firmware/wifi.py :wifi.py
mpremote connect COMx fs cp firmware/oled_ui.py :oled_ui.py
mpremote connect COMx fs cp firmware/servo.py :servo.py
mpremote connect COMx fs cp firmware/coin.py :coin.py
mpremote connect COMx fs cp firmware/ssd1306.py :ssd1306.py
```

Or in **Thonny**: Open each file → Save as → MicroPython device (root `/`).

> **Important:** Files must be at the **root** of the device filesystem (not in a `firmware/` subfolder). The `firmware/` folder is only for organizing the repo on your computer.

### 4. Open Dashboard

```
1. Open dashboard/src/index.html in Chrome/Firefox/Edge
2. Paste the same Firebase URL when prompted
3. You should see the 3D vending machine + candy cards
```

### 5. Test

- **Physical coin path**: Press SELECT on a candy → insert coins → servo should spin
- **Web order path**: Click "Buy Now" on dashboard → confirm → machine should dispense
- **Restock**: Press UP→DOWN→LEFT→RIGHT→SELECT on the machine

---

## 📋 File-by-File Reference

### `firmware/config.py`
**The only file you need to edit for setup.** Contains all pin assignments, candy definitions, WiFi credentials, Firebase URL, stock levels, and timing constants.

### `firmware/main.py`
Entry point. Runs the boot sequence (WiFi → Firebase sync → IDLE) and the main loop. Contains the state machine, button debouncing, secret combo tracker, web order polling, and all state transition functions.

### `firmware/firebase.py`
Lightweight Firebase Realtime Database REST client. Uses `urequests` to send HTTP PUT/PATCH/POST/GET requests to Firebase. Includes:
- `init_stock()` / `update_stock()` / `get_stock()` — stock management
- `log_sale()` — record each dispense
- `heartbeat()` — machine online status
- `check_pending_orders()` / `complete_order()` / `fail_order()` — web order handling

### `firmware/wifi.py`
Connects to WiFi with retry logic. Shows connection progress on OLED ("WiFi...", "WiFi OK!", "WiFi FAILED"). Returns `True`/`False`. Machine works without WiFi (offline mode).

### `firmware/oled_ui.py`
All 9 OLED screen layouts:
1. `show_idle()` — candy menu with cursor + stock quantities
2. `show_selected()` — candy confirmation screen
3. `show_coin_wait()` — live coin counter with progress bar
4. `show_dispensing()` — dispensing animation
5. `show_done()` — "Enjoy!" screen
6. `show_cancelled()` — cancellation screen
7. `show_sold_out()` — sold out message
8. `show_restock()` — hidden restock menu
9. `show_restocked()` — restock confirmation flash

### `firmware/servo.py`
Servo PWM wrapper using `duty_ns()` (same pattern as Vicharak project 44). Creates Servo objects per pin with `lock()` and `dispense()` methods. `dispense()` sweeps to 90°, holds for `DISPENSE_HOLD_MS`, and returns to 0°.

### `firmware/coin.py`
IRQ-driven coin counter. The IR sensor's D0 pin triggers an interrupt on each coin drop. Includes 300ms debounce window to prevent double-counting. Can be enabled/disabled (disabled during dispensing).

### `firmware/ssd1306.py`
Standard MicroPython SSD1306 OLED driver supporting both SPI and I2C. Copied from Vicharak project 38. Extends `framebuf.FrameBuffer` for drawing primitives.

### `dashboard/src/index.html`
Consumer-facing HTML page. Contains the page structure with 3 modal overlays (payment, confirmation, success), Firebase config banner, and CDN script includes.

### `dashboard/src/style.css`
Light, jolly CSS theme. Pastel color palette, Fredoka/Nunito fonts, candy bounce animations, glassmorphism-style modals, responsive grid layout.

### `dashboard/src/app.js`
All JavaScript logic:
- **Three.js**: Builds a 3D vending machine (white body, pink frame, glass front, 3 shelves, animated candy spheres, dispense slot)
- **Firebase listeners**: Realtime stock, status, and order tracking
- **Payment flow**: QR generation, confirmation modal, order writing, completion listening

---

## ⚡ Key Technical Details

### Servo Timing
```
0°  (rest/locked)  = 500,000 ns  duty_ns
90° (dispense)     = 1,500,000 ns duty_ns
Frequency          = 50 Hz
Hold time          = 600ms
```

### IR Sensor
- Uses D0 digital output (NOT analog)
- Tune the threshold using the **built-in potentiometer knob** on the IR module
- Active LOW by default (D0 goes LOW when a coin breaks the beam)
- Set `IR_ACTIVE_LOW = False` in config.py if your module is active HIGH

### Button Debounce
- All buttons use internal `PULL_UP` resistors
- Falling-edge detection with 50ms software debounce
- Press = GPIO goes LOW (active LOW)

### Firebase Polling
- Machine checks for web orders every **5 seconds** (`ORDER_POLL_MS = 5000`)
- Heartbeat sent every **60 seconds** (`HEARTBEAT_INTERVAL_S = 60`)
- Dashboard considers machine "offline" if `last_seen` is older than **120 seconds**

### Stock Sync
- On boot: pulls stock from Firebase (or pushes initial stock if DB is empty)
- After dispense: decrements locally + pushes to Firebase
- After restock: resets to `INITIAL_STOCK` + pushes to Firebase
- Dashboard reads stock in realtime via Firebase listener

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| OLED blank | Check SPI wiring. Verify IO5 (SCK), IO6 (MOSI), IO7 (CS), IO4 (DC), IO3 (RES) |
| Servo doesn't move | Check 5V power to servo. Test with `servo.py` directly in REPL |
| Coins not counting | Adjust IR module's threshold knob. Check `IR_ACTIVE_LOW` polarity in config |
| WiFi won't connect | Verify SSID/password in config.py. ESP32-S3 only supports 2.4 GHz |
| Firebase errors | Check URL format. Must be `https://...firebaseio.com`. Verify DB rules are open |
| Dashboard empty | Enter Firebase URL in the config banner. Check browser console for errors |
| Web order not dispensing | Machine must be online and in IDLE state. Orders are polled every 5s |
| Restock combo not working | Must be in IDLE state. Press exactly: UP → DOWN → LEFT → RIGHT → SELECT |

---

## 📄 License

Internal project — Vicharak 2026
