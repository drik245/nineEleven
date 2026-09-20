# servo.py - Servo helper
import time
from machine import Pin, PWM
import config


class Servo:
    """Single servo wrapper."""

    def __init__(self, pin_num,
                 rest_ns=config.SERVO_REST_NS,
                 open_ns=config.SERVO_DISPENSE_NS):
        self._pwm    = PWM(Pin(pin_num), freq=config.SERVO_FREQ)
        self._rest   = rest_ns
        self._open   = open_ns
        self.lock()

    def lock(self):
        """Move to resting / locked angle."""
        self._pwm.duty_ns(self._rest)

    def dispense(self):
        """Sweep to dispense angle, hold, then return to rest."""
        self._pwm.duty_ns(self._open)
        time.sleep_ms(config.DISPENSE_HOLD_MS)
        self._pwm.duty_ns(self._rest)
        time.sleep_ms(200)

    def deinit(self):
        self._pwm.deinit()


def make_servos():
    """Return a list of Servo objects for all candy slots."""
    return [Servo(pin) for pin in config.SERVO_PINS]
