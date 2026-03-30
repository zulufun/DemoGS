import requests

html = requests.get("http://192.168.1.253/login.html", timeout=20).text
needles = [
    "AUTH_API_LOCATION",
    "XMLHttpRequest",
    "fetch(",
    "username",
    "password",
    "application/json",
    "x-www-form-urlencoded",
    "withCredentials",
    "csrf",
    "j_username",
]

for needle in needles:
    idx = html.find(needle)
    print(f"\nNEEDLE: {needle} | idx={idx}")
    if idx != -1:
        start = max(0, idx - 500)
        end = min(len(html), idx + 1200)
        print(html[start:end])
