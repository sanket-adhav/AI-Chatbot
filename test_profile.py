import requests

login_res = requests.post("http://localhost:8000/auth/login", data={"username": "jetski_user_99", "password": "password"})
# wait, I don't know the password...
