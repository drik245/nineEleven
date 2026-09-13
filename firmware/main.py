"""
main.py — Candy Vending Machine with Firebase + Web Orders + Restock
Board  : Vicharak Shrike Fi (ESP32-S3, MicroPython)

Features:
  - Coin-operated dispensing via IR sensor
  - Web order dispensing via Firebase polling
  - Secret restock combo: UP→DOWN→LEFT→RIGHT→SELECT (no hint on screen)
  - Firebase stock sync + heartbeat

State machine:
  IDLE → SELECTED → COIN_WAIT → DISPENSING → DONE → IDLE
  IDLE → RESTOCK (via secret combo) → IDLE
"""

import time
from machine import Pin, SPI

import config
import ssd1306
import oled_ui
import wifi
import firebase
from servo import make_servos
from coin  import CoinCounter

# ── State constants ───────────────────────────────────────────────────────
STATE_IDLE       = 0
STATE_SELECTED   = 1
STATE_COIN_WAIT  = 2
STATE_DISPENSING = 3
STATE_DONE       = 4
STATE_RESTOCK    = 5

# ── Hardware init ─────────────────────────────────────────────────────────

spi  = SPI(1, baudrate=10_000_000,
           sck=Pin(config.OLED_SCK),
           mosi=Pin(config.OLED_MOSI),
           miso=Pin(config.OLED_MISO))

oled = ssd1306.SSD1306_SPI(
    128, 64, spi,
    Pin(config.OLED_DC),
    Pin(config.OLED_RES),
    Pin(config.OLED_CS),
)

servos = make_servos()
coins = CoinCounter()

# Button indices
BTN_UP     = 0
BTN_DOWN   = 1
BTN_LEFT   = 2
BTN_RIGHT  = 3
BTN_SELECT = 4

_btn_pins = [
    Pin(config.BTN_UP,     Pin.IN, Pin.PULL_UP),
    Pin(config.BTN_DOWN,   Pin.IN, Pin.PULL_UP),
    Pin(config.BTN_LEFT,   Pin.IN, Pin.PULL_UP),
    Pin(config.BTN_RIGHT,  Pin.IN, Pin.PULL_UP),
    Pin(config.BTN_SELECT, Pin.IN, Pin.PULL_UP),
]

_btn_last = [1] * 5
_btn_tick = [0] * 5


def btn_pressed(idx):
    """Falling-edge detection with debounce."""
    val = _btn_pins[idx].value()
    now = time.ticks_ms()
    if _btn_last[idx] == 1 and val == 0:
        if time.ticks_diff(now, _btn_tick[idx]) > config.BTN_DEBOUNCE_MS:
            _btn_tick[idx] = now
            _btn_last[idx] = val
            return True
    _btn_last[idx] = val
    return False


def any_btn_pressed():
    """Check all buttons, return index of pressed one or -1."""
    for i in range(5):
        if btn_pressed(i):
            return i
    return -1


# ── Stock tracking ────────────────────────────────────────────────────────
stock         = list(config.INITIAL_STOCK)
total_revenue = 0

# ── State machine variables ───────────────────────────────────────────────
state          = STATE_IDLE
selected       = None
cursor         = 0
_last_coin_ct  = -1
_last_hb_tick  = 0
_last_order_tick = 0
ORDER_POLL_MS  = 5000   # check for web orders every 5s

# ── Secret combo tracker ─────────────────────────────────────────────────
# Sequence: UP, DOWN, LEFT, RIGHT, SELECT
_COMBO_SEQ  = [BTN_UP, BTN_DOWN, BTN_LEFT, BTN_RIGHT, BTN_SELECT]
_combo_idx  = 0        # how far through the sequence we are

# Restock sub-menu cursor
_restock_cursor = 0


# ── State transitions ────────────────────────────────────────────────────

def go_idle():
    global state, selected, _last_coin_ct, _combo_idx
    coins.disable()
    coins.reset()
    selected      = None
    _last_coin_ct = -1
    _combo_idx    = 0
    state         = STATE_IDLE
    oled_ui.show_idle(oled, cursor, stock)


def select_candy():
    global state, selected
    candy = config.CANDIES[cursor]
    if stock[cursor] <= 0:
        oled_ui.show_sold_out(oled, candy)
        time.sleep_ms(1200)
        oled_ui.show_idle(oled, cursor, stock)
        return
    selected = candy
    state    = STATE_SELECTED
    oled_ui.show_selected(oled, selected, stock[cursor])


def start_coin_wait():
    global state, _last_coin_ct
    coins.reset()
    coins.enable()
    _last_coin_ct = -1
    state         = STATE_COIN_WAIT
    oled_ui.show_coin_wait(oled, selected, 0)


def dispense_candy(candy_index):
    """Dispense candy by slot index. Used by both coin and web orders."""
    global total_revenue
    candy = config.CANDIES[candy_index]

    oled_ui.show_dispensing(oled, candy)
    servos[candy["slot"]].dispense()

    stock[candy_index] = max(0, stock[candy_index] - 1)
    total_revenue += candy["price"]

    firebase.update_stock(candy_index, stock[candy_index])
    firebase.log_sale(candy["name"], candy["price"])
    firebase.heartbeat(total_revenue)

    oled_ui.show_done(oled, candy)
    time.sleep_ms(2000)


def dispense():
    """Dispense the currently selected candy (coin payment path)."""
    global state
    coins.disable()
    state = STATE_DISPENSING
    dispense_candy(selected["slot"])
    state = STATE_DONE
    go_idle()


def enter_restock():
    global state, _restock_cursor
    _restock_cursor = 0
    state = STATE_RESTOCK
    oled_ui.show_restock(oled, _restock_cursor, stock, config.INITIAL_STOCK)


def do_restock(idx):
    """Restock a single slot or all slots."""
    if idx < len(config.CANDIES):
        stock[idx] = config.INITIAL_STOCK[idx]
        firebase.update_stock(idx, stock[idx])
        oled_ui.show_restocked(oled, config.CANDIES[idx]["name"])
    else:
        # Restock All
        for i in range(len(config.CANDIES)):
            stock[i] = config.INITIAL_STOCK[i]
            firebase.update_stock(i, stock[i])
        oled_ui.show_restocked(oled, "ALL SLOTS")
    time.sleep_ms(1000)
    oled_ui.show_restock(oled, _restock_cursor, stock, config.INITIAL_STOCK)


# ── Web order processing ─────────────────────────────────────────────────

def process_web_orders():
    """Check Firebase for pending web orders and dispense."""
    global state
    orders = firebase.check_pending_orders()
    for order_id, order in orders:
        idx = order.get("candy_index", -1)
        if idx < 0 or idx >= len(config.CANDIES):
            firebase.fail_order(order_id, "invalid_candy")
            continue
        if stock[idx] <= 0:
            firebase.fail_order(order_id, "out_of_stock")
            continue
        # Dispense!
        state = STATE_DISPENSING
        dispense_candy(idx)
        firebase.complete_order(order_id)
        state = STATE_IDLE
    if orders:
        go_idle()


# ── Boot sequence ─────────────────────────────────────────────────────────
print("=== nineEleven — Shrike Fi ===")

wifi_ok = wifi.connect(oled)

if wifi_ok:
    remote_stock = firebase.get_stock()
    if remote_stock is not None:
        stock = remote_stock
        print("Stock synced from Firebase:", stock)
    else:
        firebase.init_stock(config.INITIAL_STOCK)
        stock = list(config.INITIAL_STOCK)
        print("Initial stock pushed to Firebase")
    firebase.heartbeat(total_revenue)
    _last_hb_tick = time.ticks_ms()
    _last_order_tick = time.ticks_ms()

go_idle()

num_candies = len(config.CANDIES)
num_restock_items = num_candies + 1  # candies + "Restock All"

# ── Main loop ─────────────────────────────────────────────────────────────
while True:
    now = time.ticks_ms()

    # ── Periodic heartbeat ────────────────────────────────────────────────
    if time.ticks_diff(now, _last_hb_tick) > config.HEARTBEAT_INTERVAL_S * 1000:
        _last_hb_tick = now
        firebase.heartbeat(total_revenue)

    # ── Poll for web orders (only in IDLE state) ─────────────────────────
    if state == STATE_IDLE:
        if time.ticks_diff(now, _last_order_tick) > ORDER_POLL_MS:
            _last_order_tick = now
            process_web_orders()

    # ── IDLE ──────────────────────────────────────────────────────────────
    if state == STATE_IDLE:
        btn = any_btn_pressed()
        if btn >= 0:
            # ── Secret combo check ────────────────────────────────────
            if btn == _COMBO_SEQ[_combo_idx]:
                _combo_idx += 1
                if _combo_idx >= len(_COMBO_SEQ):
                    _combo_idx = 0
                    enter_restock()
                    continue
            else:
                _combo_idx = 0
                # Check if this wrong press is actually the start of a new combo
                if btn == _COMBO_SEQ[0]:
                    _combo_idx = 1

            # ── Normal navigation (only if combo didn't trigger) ──────
            if state == STATE_IDLE:
                if btn == BTN_UP:
                    cursor = (cursor - 1) % num_candies
                    oled_ui.show_idle(oled, cursor, stock)
                elif btn == BTN_DOWN:
                    cursor = (cursor + 1) % num_candies
                    oled_ui.show_idle(oled, cursor, stock)
                elif btn == BTN_SELECT:
                    select_candy()

    # ── SELECTED ──────────────────────────────────────────────────────────
    elif state == STATE_SELECTED:
        if btn_pressed(BTN_SELECT):
            start_coin_wait()
        elif btn_pressed(BTN_LEFT):
            oled_ui.show_cancelled(oled)
            time.sleep_ms(800)
            go_idle()

    # ── COIN_WAIT ─────────────────────────────────────────────────────────
    elif state == STATE_COIN_WAIT:
        if btn_pressed(BTN_LEFT):
            oled_ui.show_cancelled(oled)
            time.sleep_ms(800)
            go_idle()
        else:
            required_coins = selected["price"] // config.COIN_VALUE
            current_coins  = coins.count()
            if current_coins != _last_coin_ct:
                _last_coin_ct = current_coins
                oled_ui.show_coin_wait(oled, selected, current_coins)
            if current_coins >= required_coins:
                dispense()

    # ── RESTOCK (secret menu) ─────────────────────────────────────────────
    elif state == STATE_RESTOCK:
        if btn_pressed(BTN_UP):
            _restock_cursor = (_restock_cursor - 1) % num_restock_items
            oled_ui.show_restock(oled, _restock_cursor, stock, config.INITIAL_STOCK)
        elif btn_pressed(BTN_DOWN):
            _restock_cursor = (_restock_cursor + 1) % num_restock_items
            oled_ui.show_restock(oled, _restock_cursor, stock, config.INITIAL_STOCK)
        elif btn_pressed(BTN_SELECT):
            do_restock(_restock_cursor)
        elif btn_pressed(BTN_LEFT):
            go_idle()

    time.sleep_ms(10)
