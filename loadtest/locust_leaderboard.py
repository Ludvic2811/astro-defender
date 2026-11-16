"""Prueba de carga de la tabla de líderes serverless (API Gateway + Lambda + DynamoDB).

Cada usuario consulta las puntuaciones (lo más común, como al abrir la pantalla
de líderes) y de vez en cuando registra una partida terminada.

Ejemplo (100 usuarios durante 3 minutos):
  locust -f loadtest/locust_leaderboard.py --host https://<api-id>.execute-api.us-east-1.amazonaws.com \
      --headless -u 100 -r 20 -t 3m --csv loadtest/resultados/lideres/lideres --html loadtest/resultados/lideres/lideres.html
"""
import random

from locust import HttpUser, between, task


class Jugador(HttpUser):
    wait_time = between(0.5, 2)

    @task(4)
    def consultar(self):
        modo = random.choice(["solo", "coop"])
        self.client.get(f"/scores?mode={modo}&limit=10", name="GET /scores")

    @task(1)
    def registrar(self):
        self.client.post("/scores", name="POST /scores", json={
            "name": f"bot{random.randint(1, 9999)}",
            "score": random.randint(100, 250000),
            "wave": random.randint(1, 40),
            "mode": random.choice(["solo", "coop"]),
            "players": random.randint(1, 4),
        })
