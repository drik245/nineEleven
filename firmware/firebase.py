# firebase.py — Lightweight Firebase Realtime Database client
# ─────────────────────────────────────────────────────────────────────────────
# Uses the REST API via urequests. No SDK needed.
# All calls are wrapped in try/except so the machine works offline.
# ─────────────────────────────────────────────────────────────────────────────
import ujson
import time
import config

try:
    import urequests as requests
except ImportError:
    import requests  # CPython fallback for testing

_BASE = config.FIREBASE_URL.rstrip("/")


def _url(path):
    """Build full Firebase REST URL for a given path."""
    return "{}/{}.json".format(_BASE, path.strip("/"))


def _put(path, data):
    """PUT (overwrite) data at path. Returns True on success."""
    try:
        r = requests.put(_url(path), json=data)
        r.close()
        return True
    except Exception as e:
        print("Firebase PUT error:", e)
        return False


def _patch(path, data):
    """PATCH (merge) data at path. Returns True on success."""
    try:
        r = requests.patch(_url(path), json=data)
        r.close()
        return True
    except Exception as e:
        print("Firebase PATCH error:", e)
        return False


def _post(path, data):
    """POST (push with auto-key) data at path. Returns True on success."""
    try:
        r = requests.post(_url(path), json=data)
        r.close()
        return True
    except Exception as e:
        print("Firebase POST error:", e)
        return False


def _get(path):
    """GET data at path. Returns parsed JSON or None on failure."""
    try:
        r = requests.get(_url(path))
        data = r.json()
        r.close()
        return data
    except Exception as e:
        print("Firebase GET error:", e)
        return None


# ── Public API ────────────────────────────────────────────────────────────

def init_stock(stock_list):
    """
    Set initial stock levels in Firebase.
    stock_list: list of ints, one per candy in config.CANDIES order.
    """
    stock_data = {}
    for i, candy in enumerate(config.CANDIES):
        key = candy["name"].lower().replace(" ", "_")
        stock_data[key] = {
            "name": candy["name"],
            "price": candy["price"],
            "qty": stock_list[i],
        }
    return _put("vending_machine/stock", stock_data)


def update_stock(candy_index, new_qty):
    """Update the quantity for a single candy slot."""
    candy = config.CANDIES[candy_index]
    key = candy["name"].lower().replace(" ", "_")
    return _patch("vending_machine/stock/" + key, {"qty": new_qty})


def get_stock():
    """
    Fetch current stock from Firebase.
    Returns list of qty ints in CANDIES order, or None on failure.
    """
    data = _get("vending_machine/stock")
    if data is None:
        return None
    result = []
    for candy in config.CANDIES:
        key = candy["name"].lower().replace(" ", "_")
        entry = data.get(key, {})
        result.append(entry.get("qty", 0))
    return result


def log_sale(candy_name, price):
    """Push a sale record with timestamp."""
    return _post("vending_machine/sales", {
        "candy": candy_name,
        "price": price,
        "timestamp": time.time(),
    })


def heartbeat(total_revenue=0):
    """Update machine online status and revenue."""
    return _patch("vending_machine/status", {
        "online": True,
        "last_seen": time.time(),
        "total_revenue": total_revenue,
    })


def set_offline():
    """Mark machine as offline (call on clean shutdown if possible)."""
    return _patch("vending_machine/status", {"online": False})


# ── Order Polling (for web UPI payments) ──────────────────────────────────

def check_pending_orders():
    """
    Check for pending orders from web payments.
    Returns list of (order_id, order_data) tuples, or empty list.
    """
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
        "completed_at": time.time(),
    })


def fail_order(order_id, reason="out_of_stock"):
    """Mark an order as failed (e.g. sold out)."""
    return _patch("vending_machine/orders/" + order_id, {
        "status": "failed",
        "reason": reason,
        "completed_at": time.time(),
    })

