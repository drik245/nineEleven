# wifi.py — WiFi connection helper for Shrike Fi (ESP32-S3)
# ─────────────────────────────────────────────────────────────────────────────
# Connects to the network defined in config.py.
# Shows connection status on the OLED if provided.
# ─────────────────────────────────────────────────────────────────────────────
import network
import time
import config


_wlan = network.WLAN(network.STA_IF)


def connect(oled=None):
    """
    Connect to WiFi. Shows progress on OLED if passed.
    Returns True on success, False on timeout.
    """
    _wlan.active(True)

    if _wlan.isconnected():
        return True

    if oled:
        oled.fill(0)
        oled.text("WiFi...", 0, 0)
        oled.text(config.WIFI_SSID[:16], 0, 14)
        oled.show()

    _wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)

    # Wait up to 15 seconds
    for i in range(30):
        if _wlan.isconnected():
            ip = _wlan.ifconfig()[0]
            print("WiFi connected:", ip)
            if oled:
                oled.fill(0)
                oled.text("WiFi OK!", 0, 0)
                oled.text(ip, 0, 14)
                oled.show()
                time.sleep_ms(1200)
            return True
        if oled and i % 4 == 0:
            dots = "." * ((i // 4) % 4)
            oled.fill_rect(56, 0, 72, 10, 0)
            oled.text("WiFi" + dots, 0, 0)
            oled.show()
        time.sleep_ms(500)

    # Timeout
    print("WiFi connection failed")
    if oled:
        oled.fill(0)
        oled.text("WiFi FAILED", 0, 0)
        oled.text("Running offline", 0, 14)
        oled.show()
        time.sleep_ms(1500)
    return False


def is_connected():
    """Check if WiFi is still connected."""
    return _wlan.isconnected()


def ip():
    """Return current IP address string, or None."""
    if _wlan.isconnected():
        return _wlan.ifconfig()[0]
    return None
