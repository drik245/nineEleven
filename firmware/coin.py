# coin.py - IR coin counter (interrupt-driven)
from machine import Pin
import time
import config


class CoinCounter:
    """Counts coins via interrupt on the IR D0 pin."""

    def __init__(self):
        self._count      = 0
        self._last_tick  = 0
        self._enabled    = False

        trigger_edge = Pin.IRQ_FALLING if config.IR_ACTIVE_LOW else Pin.IRQ_RISING
        self._pin = Pin(config.IR_PIN, Pin.IN, Pin.PULL_UP)
        self._pin.irq(trigger=trigger_edge, handler=self._on_coin)

    def _on_coin(self, pin):
        if not self._enabled:
            return
        now = time.ticks_ms()
        if time.ticks_diff(now, self._last_tick) >= config.IR_DEBOUNCE_MS:
            self._count    += 1
            self._last_tick = now

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
