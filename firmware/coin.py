# coin.py — IR coin counter (interrupt-driven)
# ─────────────────────────────────────────────────────────────────────────────
# The IR sensor D0 pin triggers an interrupt on each coin drop.
# A debounce window (config.IR_DEBOUNCE_MS) prevents double-counting noisy pulses.
# ─────────────────────────────────────────────────────────────────────────────
from machine import Pin
import time
import firmware.config


class CoinCounter:
    """
    Counts coins via interrupt on the IR D0 pin.

    Usage:
        cc = CoinCounter()
        cc.reset()
        ...
        total_rupees = cc.total()   # coins_counted * COIN_VALUE
    """

    def __init__(self):
        self._count      = 0
        self._last_tick  = 0
        self._enabled    = False

        trigger_edge = Pin.IRQ_FALLING if config.IR_ACTIVE_LOW else Pin.IRQ_RISING
        self._pin = Pin(config.IR_PIN, Pin.IN, Pin.PULL_UP)
        self._pin.irq(trigger=trigger_edge, handler=self._on_coin)

    # ── Internal ─────────────────────────────────────────────────────────

    def _on_coin(self, pin):
        if not self._enabled:
            return
        now = time.ticks_ms()
        if time.ticks_diff(now, self._last_tick) >= config.IR_DEBOUNCE_MS:
            self._count    += 1
            self._last_tick = now

    # ── Public API ───────────────────────────────────────────────────────

    def enable(self):
        """Start accepting coin interrupts."""
        self._enabled = True

    def disable(self):
        """Stop accepting coin interrupts (safe during dispensing)."""
        self._enabled = False

    def reset(self):
        """Clear the coin counter (call before a new transaction)."""
        self._count     = 0
        self._last_tick = 0

    def count(self):
        """Return raw number of coins inserted."""
        return self._count

    def total(self):
        """Return total rupee value of coins inserted."""
        return self._count * config.COIN_VALUE
