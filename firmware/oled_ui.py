# oled_ui.py - All OLED screen layouts for the vending machine
import config


def _center_x(text, char_w=8, screen_w=128):
    """Return x offset to horizontally centre a string."""
    return max(0, (screen_w - len(text) * char_w) // 2)


def _coins_needed(price):
    return price // config.COIN_VALUE


def show_idle(oled, cursor, stock=None):
    """Scrollable candy menu with cursor highlight and stock count.
    Max 16 chars per line (128px / 8px)."""
    oled.fill(0)

    title = "nineEleven"
    oled.text(title, _center_x(title), 0)
    oled.hline(0, 10, 128, 1)

    for i, candy in enumerate(config.CANDIES):
        y = 14 + i * 12
        prefix = ">" if i == cursor else " "

        sold_out = stock is not None and stock[i] <= 0
        name = candy["name"][:6]

        if sold_out:
            # "> Kacch SOLD OUT" = 16 chars
            line = "{}{:<6} SOLD OUT".format(prefix, name)
        else:
            qty_str = ""
            if stock is not None:
                qty_str = "x{}".format(stock[i])
            # "> Kacch Rs5  x10" = 16 chars
            line = "{}{:<6} Rs{:<3}{}".format(
                prefix, name, candy["price"], qty_str
            )
        oled.text(line, 0, y)

        if i == cursor:
            oled.rect(0, y - 1, 128, 11, 1)

    oled.text("Select     Buy", 0, 55)
    oled.show()


def show_selected(oled, candy, qty=None):
    """Confirmation screen after pressing SELECT."""
    oled.fill(0)
    oled.text("SELECTED:", 0, 0)
    oled.text(candy["name"][:16], 0, 14)

    price_str = "Price: Rs.{}".format(candy["price"])
    oled.text(price_str, 0, 28)

    if qty is not None:
        oled.text("Stock: {}".format(qty), 0, 38)
    else:
        oled.hline(0, 38, 128, 1)

    coins = _coins_needed(candy["price"])
    if coins == 1:
        oled.text("Insert 1 coin", 0, 48)
    else:
        oled.text("Insert {} coins".format(coins), 0, 48)

    oled.text("Pay       Back", 0, 55)
    oled.show()


def show_coin_wait(oled, candy, coins_so_far):
    """Live coin counter with progress bar."""
    oled.fill(0)

    header = "{} Rs.{}".format(candy["name"][:10], candy["price"])
    oled.text(header, _center_x(header), 0)
    oled.hline(0, 10, 128, 1)

    paid   = coins_so_far * config.COIN_VALUE
    needed = candy["price"]

    oled.text("Paid: Rs.{}".format(paid),  0, 14)
    oled.text("Need: Rs.{}".format(needed), 0, 26)

    BAR_W = 118
    oled.rect(5, 38, BAR_W, 8, 1)
    filled = int(BAR_W * min(paid, needed) / needed)
    if filled > 0:
        oled.fill_rect(5, 38, filled, 8, 1)

    oled.text("Cancel", _center_x("Cancel"), 52)
    oled.show()


def show_dispensing(oled, candy):
    """Brief animation during servo movement."""
    oled.fill(0)
    oled.text("  DISPENSING  ", 0, 10)
    oled.text(candy["name"][:16], _center_x(candy["name"][:16]), 28)

    dots = ["[.  ]", "[.. ]", "[...]", "[ ..]", "[  .]"]
    for frame in dots:
        oled.fill_rect(30, 48, 68, 10, 0)
        oled.text(frame, _center_x(frame), 48)
        oled.show()
        import time
        time.sleep_ms(100)


def show_done(oled, candy):
    oled.fill(0)
    oled.text("** ENJOY! **", _center_x("** ENJOY! **"), 10)
    oled.hline(0, 22, 128, 1)
    oled.text(candy["name"][:16], _center_x(candy["name"][:16]), 30)
    oled.text("Thank you!", _center_x("Thank you!"), 48)
    oled.show()


def show_cancelled(oled):
    oled.fill(0)
    oled.text("CANCELLED", _center_x("CANCELLED"), 20)
    oled.text("Returning...", _center_x("Returning..."), 40)
    oled.show()


def show_sold_out(oled, candy):
    oled.fill(0)
    oled.text("SOLD OUT!", _center_x("SOLD OUT!"), 10)
    oled.hline(0, 22, 128, 1)
    oled.text(candy["name"][:16], _center_x(candy["name"][:16]), 30)
    oled.text("Try another", _center_x("Try another"), 48)
    oled.show()


def show_restock(oled, cursor, stock, initial):
    """Secret restock menu."""
    oled.fill(0)
    oled.text("== RESTOCK ==", _center_x("== RESTOCK =="), 0)
    oled.hline(0, 10, 128, 1)

    for i, candy in enumerate(config.CANDIES):
        y = 14 + i * 12
        prefix = ">" if i == cursor else " "
        name = candy["name"][:7]
        line = "{}{:<7} {}/{}".format(prefix, name, stock[i], initial[i])
        oled.text(line, 0, y)
        if i == cursor:
            oled.rect(0, y - 1, 128, 11, 1)

    all_y = 14 + len(config.CANDIES) * 12
    prefix = ">" if cursor == len(config.CANDIES) else " "
    oled.text("{}Restock All".format(prefix), 0, all_y)
    if cursor == len(config.CANDIES):
        oled.rect(0, all_y - 1, 128, 11, 1)

    oled.text("Set       Exit", 0, 55)
    oled.show()


def show_restocked(oled, name):
    """Flash confirmation after restocking."""
    oled.fill(0)
    oled.text("RESTOCKED!", _center_x("RESTOCKED!"), 20)
    oled.text(name[:16], _center_x(name[:16]), 38)
    oled.show()
