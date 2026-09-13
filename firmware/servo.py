# servo.py — Servo helper
# Uses duty_ns() exactly as in project 44 (Smart Dustbin) on Shrike Fi
# ─────────────────────────────────────────────────────────────────────────────
from machine import Pin, PWM
import time
import config


class Servo:
    """
    Single servo wrapper.
    pin_num  : GPIO number (ESP_IOxx)
    rest_ns  : duty_ns for resting / locked position  (default 0 deg ~ 500 000 ns)
    open_ns  : duty_ns for dispense position           (default 90 deg ~ 1 500 000 ns)
    """

    def __init__(self, pin_num,
                 rest_ns=config.SERVO_REST_NS,
                 open_ns=config.SERVO_DISPENSE_NS):
        self._pwm    = PWM(Pin(pin_num), freq=config.SERVO_FREQ)
        self._rest   = rest_ns
        self._open   = open_ns
        self.lock()   # start in safe resting position

    # ── Public API ───────────────────────────────────────────────────────

    def lock(self):
        """Move to resting / locked angle."""
        self._pwm.duty_ns(self._rest)

    def dispense(self):
        """Sweep to dispense angle, hold, then return to rest."""
        self._pwm.duty_ns(self._open)
        time.sleep_ms(config.DISPENSE_HOLD_MS)
        self._pwm.duty_ns(self._rest)
        time.sleep_ms(200)   # let servo settle before next command

    def deinit(self):
        self._pwm.deinit()


def make_servos():
    """Return a list of Servo objects for all candy slots (order = config.SERVO_PINS)."""
    return [Servo(pin) for pin in config.SERVO_PINS]
