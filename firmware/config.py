# config.py — Vending Machine Configuration
# Board: Vicharak Shrike Fi (ESP32-S3 MicroPython)
# ─────────────────────────────────────────────────────────────────────────────
# OLED SPI pins are FIXED to the hardware SPI1 bus used in all Shrike Fi projects.
# Adjust servo, button and IR pins below to match your wiring.
# ─────────────────────────────────────────────────────────────────────────────

# ── SPI OLED (SSD1306 128×64) ─────────────────────────────────────────────
# Matches wiring from project 28/38 – do NOT change unless you re-wire the OLED.
OLED_SCK  = 5   # ESP_IO5
OLED_MOSI = 6   # ESP_IO6
OLED_MISO = 1   # ESP_IO1  (dummy – keeps SPI from stealing other pins)
OLED_CS   = 7   # ESP_IO7
OLED_DC   = 4   # ESP_IO4
OLED_RES  = 3   # ESP_IO3

# ── Servo Pins ────────────────────────────────────────────────────────────
SERVO_PINS = [8, 9, 10]   # IO8 → Candy A, IO9 → Candy B, IO10 → Candy C

# Servo PWM timing in nanoseconds (standard 50 Hz hobby servo)
SERVO_REST_NS     = 500_000   # 0°  – resting / locked position
SERVO_DISPENSE_NS = 1_500_000 # 90° – dispense position
SERVO_FREQ        = 50        # Hz

# How long the servo holds at dispense angle before returning
DISPENSE_HOLD_MS  = 600

# ── IR Coin Sensor ────────────────────────────────────────────────────────
# D0 goes LOW when a coin breaks the beam (most common active-LOW modules)
IR_PIN         = 2    # ESP_IO2
IR_ACTIVE_LOW  = True # set False if your module pulses HIGH on coin

# Debounce window: ignore pulses within this many ms of the last one
IR_DEBOUNCE_MS = 300

# ── Buttons (active LOW – pulled-up internally) ───────────────────────────
# 5-way nav pad: UP/DOWN scroll the menu, SELECT confirms, LEFT cancels
BTN_UP      = 14  # ESP_IO14 — Scroll up
BTN_DOWN    = 15  # ESP_IO15 — Scroll down
BTN_LEFT    = 16  # ESP_IO16 — Cancel / back
BTN_RIGHT   = 17  # ESP_IO17 — (reserved)
BTN_SELECT  = 18  # ESP_IO18 — Confirm selection
BTN_DEBOUNCE_MS = 50

# ── Candy Definitions ─────────────────────────────────────────────────────
# name       : shown on OLED (max ~10 chars for clean display)
# price      : in rupees (must be a multiple of 5)
# slot_index : index into SERVO_PINS list
CANDIES = [
    {"name": "Candy A", "price": 5,  "slot": 0},
    {"name": "Candy B", "price": 10, "slot": 1},
    {"name": "Candy C", "price": 15, "slot": 2},
]

# Coin denomination – every IR pulse = one coin of this value
COIN_VALUE = 5  # Rs.5 per coin

# ── WiFi ──────────────────────────────────────────────────────────────────
WIFI_SSID     = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

# ── Firebase Realtime Database ────────────────────────────────────────────
# Paste your project's RTDB URL here (from Firebase Console → Realtime Database)
# Example: "https://my-vending-default-rtdb.firebaseio.com"
FIREBASE_URL = "https://YOUR-PROJECT-default-rtdb.firebaseio.com"

# ── Stock ─────────────────────────────────────────────────────────────────
# Starting quantity for each candy slot (reset from dashboard or on boot)
INITIAL_STOCK = [10, 10, 10]   # Candy A, B, C

# Heartbeat interval (seconds) — how often the machine pings Firebase
HEARTBEAT_INTERVAL_S = 60
