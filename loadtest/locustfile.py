"""
Pruebas de carga de Astro Defender con Locust.

Jugadores simulados: piden partida al lobby (HTTP), se conectan por WebSocket
al servidor de juego asignado por Agones, envían controles y miden el RTT.
Espectadores simulados: eligen una partida en curso y reciben snapshots.

Perfiles (variable LOAD_SHAPE):
  ramp        rampa escalonada hasta RAMP_USERS jugadores (por defecto 1000)
  spike       pico súbito de SPIKE_USERS jugadores (por defecto 1000) en 30 s
  spectators  PLAYERS jugadores (200) + SPECTATORS espectadores (500)
  (vacío)     control manual desde la interfaz web de Locust

Ejemplo:
  LOAD_SHAPE=spike locust -f loadtest/locustfile.py --host http://<URL-del-lobby> \
      --headless --processes -1 --csv resultados/pico --html resultados/pico.html
"""
import json
import os
import random
import time

import gevent
import websocket
from locust import HttpUser, LoadTestShape, between, task

SHAPE = os.getenv("LOAD_SHAPE", "").lower()
MATCH_SECONDS = int(os.getenv("MATCH_SECONDS", "120"))
WATCH_SECONDS = int(os.getenv("WATCH_SECONDS", "90"))
INPUT_INTERVAL = float(os.getenv("INPUT_INTERVAL", "0.2"))
START_AFTER = float(os.getenv("START_AFTER", "8"))


def report(env, name, start, exc=None, length=0):
    env.events.request.fire(
        request_type="WS",
        name=name,
        response_time=(time.perf_counter() - start) * 1000,
        response_length=length,
        exception=exc,
        context={},
    )


class WsSession:
    """Conexión WebSocket con lector en segundo plano (greenlet)."""

    def __init__(self, env, host, port, name, role):
        self.env = env
        self.running = True
        self.my_id = None
        self.is_host = False
        self.state = "lobby"
        self.snaps = 0
        self.bytes = 0
        self.last_snap = None
        self.error = None
        self.upgrade = False
        start = time.perf_counter()
        try:
            self.ws = websocket.create_connection(f"ws://{host}:{port}", timeout=10)
        except Exception as e:  # noqa: BLE001
            report(env, f"connect ({role})", start, e)
            raise
        report(env, f"connect ({role})", start)
        self.send({"t": "join", "name": name, "role": role})
        self.reader = gevent.spawn(self._read)

    def send(self, obj):
        try:
            self.ws.send(json.dumps(obj))
        except Exception as e:  # noqa: BLE001
            self.error = e
            self.running = False

    def ping(self):
        self.send({"t": "ping", "c": time.perf_counter() * 1000})

    def _read(self):
        while self.running:
            try:
                msg = self.ws.recv()
            except Exception as e:  # noqa: BLE001
                if self.running:
                    self.error = e
                self.running = False
                break
            if not msg:
                continue
            self.bytes += len(msg)
            # Se evita decodificar cada snapshot (costoso para el generador de carga)
            if msg.startswith('{"t":"snap"'):
                now = time.perf_counter()
                if self.last_snap is not None and self.snaps % 20 == 0:
                    self.env.events.request.fire(
                        request_type="WS", name="intervalo entre snapshots",
                        response_time=(now - self.last_snap) * 1000,
                        response_length=len(msg), exception=None, context={})
                self.last_snap = now
                self.snaps += 1
                self.upgrade = '"ph":"upgrade"' in msg
                if '"st":"gameover"' in msg:
                    self.state = "ended"
                elif '"st":"playing"' in msg:
                    self.state = "playing"
                elif '"st":"lobby"' in msg:
                    self.state = "lobby"
                continue
            data = json.loads(msg)
            t = data.get("t")
            if t == "pong":
                rtt = time.perf_counter() * 1000 - data["c"]
                self.env.events.request.fire(request_type="WS", name="rtt (ping/pong)",
                                             response_time=rtt, response_length=0,
                                             exception=None, context={})
            elif t == "welcome":
                self.my_id = data.get("id")
                self.is_host = bool(data.get("host"))
            elif t == "error":
                self.error = Exception(data.get("code", "error"))
                self.env.events.request.fire(request_type="WS", name="rechazo (sala llena)",
                                             response_time=0, response_length=0,
                                             exception=self.error, context={})

    def close(self):
        self.running = False
        try:
            self.ws.close()
        except Exception:  # noqa: BLE001
            pass


class PlayerUser(HttpUser):
    """Jugador simulado de modo cooperativo."""
    wait_time = between(1, 3)
    weight = 3

    @task
    def play_match(self):
        with self.client.post("/api/match", json={"type": "quick"}, name="/api/match (rápida)",
                              catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"{r.status_code}: {r.text[:120]}")
                return
            match = r.json()
        try:
            s = WsSession(self.environment, match["host"], match["port"],
                          f"bot{random.randint(1, 99999)}", "player")
        except Exception:  # noqa: BLE001
            return

        joined = time.time()
        end = joined + MATCH_SECONDS
        last_ping = 0
        started = False
        while s.running and time.time() < end:
            now = time.time()
            if s.is_host and s.state == "lobby" and not started and now - joined > START_AFTER:
                s.send({"t": "start"})
                started = True
            if s.upgrade:
                s.send({"t": "pick", "i": random.randint(0, 2)})
            if random.random() < 0.01:
                s.send({"t": "bomb"})
            if s.is_host and s.state == "ended":
                s.send({"t": "restart"})
                started = False
            s.send({
                "t": "input",
                "u": random.random() < 0.2, "d": random.random() < 0.2,
                "l": random.random() < 0.4, "r": random.random() < 0.4,
                "f": random.random() < 0.8,
            })
            if now - last_ping > 1:
                s.ping()
                last_ping = now
            gevent.sleep(INPUT_INTERVAL)
        s.close()


class SpectatorUser(HttpUser):
    """Espectador que observa una partida en curso."""
    wait_time = between(1, 3)
    weight = 1

    @task
    def watch(self):
        r = self.client.get("/api/matches", name="/api/matches")
        if r.status_code != 200:
            return
        matches = [m for m in r.json() if not m.get("private")]
        if not matches:
            gevent.sleep(2)
            return
        m = random.choice(matches)
        try:
            s = WsSession(self.environment, m["host"], m["port"], "espectador", "spectator")
        except Exception:  # noqa: BLE001
            return
        end = time.time() + WATCH_SECONDS
        while s.running and time.time() < end:
            s.ping()
            gevent.sleep(2)
        s.close()


# ---------------------------------------------------------------- perfiles de carga
if SHAPE == "ramp":
    class RampShape(LoadTestShape):
        """Sube 100 jugadores por minuto hasta RAMP_USERS, mantiene 5 min y baja."""
        target = int(os.getenv("RAMP_USERS", "1000"))
        step_users = int(os.getenv("RAMP_STEP", "100"))
        step_time = int(os.getenv("RAMP_STEP_SECONDS", "60"))
        hold = int(os.getenv("HOLD_SECONDS", "300"))

        def tick(self):
            t = self.get_run_time()
            steps = self.target // self.step_users
            ramp_end = steps * self.step_time
            if t < ramp_end:
                return (self.step_users * (int(t // self.step_time) + 1), 20, [PlayerUser])
            if t < ramp_end + self.hold:
                return (self.target, 20, [PlayerUser])
            if t < ramp_end + self.hold + 120:
                return (0, 50, [PlayerUser])
            return None

elif SHAPE == "spike":
    class SpikeShape(LoadTestShape):
        """Pico: SPIKE_USERS jugadores en ~30 s, se mantiene y se retira de golpe."""
        users = int(os.getenv("SPIKE_USERS", "1000"))
        warm = 60
        hold = int(os.getenv("HOLD_SECONDS", "300"))

        def tick(self):
            t = self.get_run_time()
            if t < self.warm:
                return (20, 5, [PlayerUser])           # línea base
            if t < self.warm + self.hold:
                return (self.users, self.users / 30, [PlayerUser])
            if t < self.warm + self.hold + 180:
                return (0, 100, [PlayerUser])           # observar la reducción de recursos
            return None

elif SHAPE == "spectators":
    PlayerUser.fixed_count = int(os.getenv("PLAYERS", "200"))

    class SpectatorShape(LoadTestShape):
        """Primero se crean partidas con jugadores y luego llegan los espectadores."""
        spectators = int(os.getenv("SPECTATORS", "500"))
        hold = int(os.getenv("HOLD_SECONDS", "300"))

        def tick(self):
            t = self.get_run_time()
            players = PlayerUser.fixed_count
            if t < 60:
                return (players, 10, [PlayerUser])
            if t < 60 + self.hold:
                return (players + self.spectators, 25, [PlayerUser, SpectatorUser])
            return None
