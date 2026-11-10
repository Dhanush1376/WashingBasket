"""Copies the real app captures used by the film into compose/assets/screens as JPEG."""
from PIL import Image
NAMES = ['s01-login', 's02-phone', 's03-otp', 's04-otp-filled', 'h01-home', 'w01-wallet', 'w03-topup-2000', 'w05-topup-done', 'b01-book', 'b02-picker', 'b03-picker-filled', 'b04-items-done', 'b07-days', 'b08-day-picked', 'b09-slots', 'b10-slot-picked', 'b11-review', 'o05-order', 'p01-pay-sheet', 'p03-coupon-applied', 'p05-paying-2', 'p05-paying-3', 'q01-qr-unlocked', 'r-ready-progress']
for n in NAMES:
    Image.open(f'shots/{n}.png').convert('RGB').save(f'compose/assets/screens/{n}.jpg', quality=94)
print(len(NAMES), 'screens')
