# firebase.py - Lightweight Firebase Realtime Database client
# Uses the REST API via urequests. No SDK needed.
# All calls are wrapped in try/except so the machine works offline.
import ujson
import time
import config

# Prevent HTTP calls from blocking the main loop for too long
try:
    import usocket as socket
    socket.setdefaulttimeout(3)
except Exception:
    pass

try:
    import urequests as requests
except ImportError:
    import requests

_BASE = config.FIREBASE_URL.rstrip("/")

# MicroPython epoch is 2000-01-01, JS/Unix is 1970-01-01
_EPOCH_OFFSET = 946684800

def _unix_time():
    """Return Unix timestamp compatible with JS Date.now()/1000."""
    return time.time() + _EPOCH_OFFSET

# Fixed keys that match the dashboard (candy_a, candy_b, candy_c)
_SLOT_KEYS = ["candy_a", "candy_b", "candy_c"]


def _url(path):
    """Build full Firebase REST URL for a given path."""
    return "{}/{}.json".format(_BASE, path.strip("/"))


def _put(path, data):
    try:
        r = requests.put(_url(path), json=data)
        r.close()
        return True
    except Exception as e:
        print("Firebase PUT error:", e)
        return False


def _patch(path, data):
    try:
        r = requests.patch(_url(path), json=data)
        r.close()
        return True
    except Exception as e:
        print("Firebase PATCH error:", e)
        return False


def _post(path, data):
    try:
        r = requests.post(_url(path), json=data)
        r.close()
        return True
    except Exception as e:
        print("Firebase POST error:", e)
        return False


def _get(path):
    try:
        r = requests.get(_url(path))
        data = r.json()
        r.close()
        return data
    except Exception as e:
        print("Firebase GET error:", e)
        return None


def init_stock(stock_list):
    """Set initial stock levels in Firebase."""
    stock_data = {}
    for i, candy in enumerate(config.CANDIES):
        stock_data[_SLOT_KEYS[i]] = {
            "name": candy["name"],
            "price": candy["price"],
            "qty": stock_list[i],
        }
    return _put("vending_machine/stock", stock_data)


def update_stock(candy_index, new_qty):
    """Update the quantity for a single candy slot."""
    key = _SLOT_KEYS[candy_index]
    return _patch("vending_machine/stock/" + key, {"qty": new_qty})


def get_stock():
    """Fetch current stock from Firebase.
    Returns list of qty ints in CANDIES order, or None on failure."""
    data = _get("vending_machine/stock")
    if data is None:
        return None
    result = []
    for i in range(len(config.CANDIES)):
        entry = data.get(_SLOT_KEYS[i], {})
        result.append(entry.get("qty", 0))
    return result


def log_sale(candy_name, price):
    """Push a sale record with timestamp."""
    return _post("vending_machine/sales", {
        "candy": candy_name,
        "price": price,
        "timestamp": _unix_time(),
    })


def heartbeat(total_revenue=0):
    """Update machine online status and revenue."""
    return _patch("vending_machine/status", {
        "online": True,
        "last_seen": _unix_time(),
        "total_revenue": total_revenue,
    })


def set_offline():
    """Mark machine as offline."""
    return _patch("vending_machine/status", {"online": False})


def check_pending_orders():
    """Check for pending orders from web payments.
    Returns list of (order_id, order_data) tuples, or empty list."""
    data = _get("vending_machine/orders")
    if data is None or not isinstance(data, dict):
        return []
    pending = []
    for order_id, order in data.items():
        if isinstance(order, dict) and order.get("status") == "pending":
            pending.append((order_id, order))
    return pending


def complete_order(order_id):
    """Mark an order as completed after dispensing."""
    return _patch("vending_machine/orders/" + order_id, {
        "status": "completed",
        "completed_at": _unix_time(),
    })


def fail_order(order_id, reason="out_of_stock"):
    """Mark an order as failed."""
    return _patch("vending_machine/orders/" + order_id, {
        "status": "failed",
        "reason": reason,
        "completed_at": _unix_time(),
    })
