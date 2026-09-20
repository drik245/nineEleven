# config.py - Vending Machine Configuration
# Board: Vicharak Shrike Fi (ESP32-S3 MicroPython)

# SPI OLED (SSD1306 128x64)
OLED_SCK  = 5   # ESP_IO5 -d0
OLED_MOSI = 6   # ESP_IO6 -d1
OLED_MISO = 1   # ESP_IO1
OLED_CS   = 7   # ESP_IO7
OLED_DC   = 4   # ESP_IO4
OLED_RES  = 3   # ESP_IO3

# Servo Pins
SERVO_PINS = [38, 37, 36]   # IO38=Candy A, IO37=Candy B, IO36=Candy C

# Servo PWM timing in nanoseconds (standard 50 Hz hobby servo)
SERVO_REST_NS     = 500_000   # 0 deg - resting / locked position
SERVO_DISPENSE_NS = 1_500_000 # 90 deg - dispense position
SERVO_FREQ        = 50        # Hz

# How long the servo holds at dispense angle before returning
DISPENSE_HOLD_MS  = 600

# Vibration Motor
VIBE_MOTOR_PIN    = 35  # ESP_IO35

# IR Coin Sensor
# D0 goes LOW when a coin breaks the beam (most common active-LOW modules)
IR_PIN         = 2    # ESP_IO2
IR_ACTIVE_LOW  = True # set False if your module pulses HIGH on coin

# Debounce window: ignore pulses within this many ms of the last one
IR_DEBOUNCE_MS = 300

# Buttons (active LOW - pulled-up internally)
# 5-way nav pad: UP/DOWN scroll the menu, SELECT confirms, LEFT cancels
BTN_UP      = 14  # ESP_IO14
BTN_DOWN    = 15  # ESP_IO15
BTN_LEFT    = 16  # ESP_IO16
BTN_RIGHT   = 17  # ESP_IO17
BTN_SELECT  = 18  # ESP_IO18
BTN_DEBOUNCE_MS = 50

# Candy Definitions
CANDIES = [
    {"name": "Kaccha Mango", "price": 5,  "slot": 0},
    {"name": "Melody",       "price": 10, "slot": 1},
    {"name": "Center Fresh", "price": 15, "slot": 2},
]

# Coin denomination - every IR pulse = one coin of this value
COIN_VALUE = 5  # Rs.5 per coin

# WiFi
WIFI_SSID     = "abcd"
WIFI_PASSWORD = "abcd1234"

# Firebase Realtime Database
FIREBASE_URL = "https://vending-6bced-default-rtdb.firebaseio.com"

# Stock
INITIAL_STOCK = [10, 10, 10]   # Candy A, B, C

# Heartbeat interval (seconds) - less frequent = less UI lag
HEARTBEAT_INTERVAL_S = 300
