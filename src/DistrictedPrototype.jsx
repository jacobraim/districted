import React, { useRef, useState } from "react";

const dailyLocations = [
  {
    name: "The Lincoln Memorial",
    category: "Monument",
    answer: { lat: 38.889269, lng: -77.050176 }
  },
  {
    name: "Ben's Chili Bowl",
    category: "Restaurant",
    answer: { lat: 38.917025, lng: -77.03145 }
  },
  {
    name: "Nationals Park",
    category: "Sports",
    answer: { lat: 38.872987, lng: -77.007435 }
  },
  {
    name: "The Anthem",
    category: "Music Venue",
    answer: { lat: 38.881954, lng: -77.026972 }
  },
  {
    name: "Dan's Cafe",
    category: "Dive Bar",
    answer: { lat: 38.914139, lng: -77.042258 }
  }
];

const TILE_SIZE = 256;
const MIN_ZOOM = 11;
const MAX_ZOOM = 17;
const MAP_WIDTH = 390;
const MAP_HEIGHT = 420;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lngToTileX(lng, zoom) {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

function tileXToLng(x, zoom) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function latLngToWorld(point, zoom) {
  return {
    x: lngToTileX(point.lng, zoom) * TILE_SIZE,
    y: latToTileY(point.lat, zoom) * TILE_SIZE
  };
}

function worldToLatLng(point, zoom) {
  return {
    lat: tileYToLat(point.y / TILE_SIZE, zoom),
    lng: tileXToLng(point.x / TILE_SIZE, zoom)
  };
}

function distance(a, b) {
  const R = 3958.8;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatMiles(miles) {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(2)} mi`;
}

function scoreClass(d) {
  if (d <= 0.15) return "green-dark";
  if (d <= 0.5) return "green";
  if (d <= 1.5) return "yellow";
  if (d <= 3.5) return "orange";
  return "red";
}

function scoreEmoji(d) {
  if (d <= 0.15) return "🟩";
  if (d <= 0.5) return "🟢";
  if (d <= 1.5) return "🟨";
  if (d <= 3.5) return "🟧";
  return "🟥";
}

function TileMap({ guesses, currentAnswer, revealed, onGuess }) {
  const [center, setCenter] = useState({ lat: 38.9072, lng: -77.0369 });
  const [zoom, setZoom] = useState(13);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  const centerWorld = latLngToWorld(center, zoom);
  const topLeft = {
    x: centerWorld.x - MAP_WIDTH / 2,
    y: centerWorld.y - MAP_HEIGHT / 2
  };

  const startTileX = Math.floor(topLeft.x / TILE_SIZE) - 1;
  const endTileX = Math.floor((topLeft.x + MAP_WIDTH) / TILE_SIZE) + 1;
  const startTileY = Math.floor(topLeft.y / TILE_SIZE) - 1;
  const endTileY = Math.floor((topLeft.y + MAP_HEIGHT) / TILE_SIZE) + 1;

  const tiles = [];
  for (let x = startTileX; x <= endTileX; x++) {
    for (let y = startTileY; y <= endTileY; y++) {
      tiles.push({ x, y });
    }
  }

  function pointToScreen(point) {
    const world = latLngToWorld(point, zoom);
    return {
      x: world.x - topLeft.x,
      y: world.y - topLeft.y
    };
  }

  function screenToPoint(x, y) {
    return worldToLatLng({ x: topLeft.x + x, y: topLeft.y + y }, zoom);
  }

  function handlePointerDown(e) {
    setDragging(false);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      centerAtStart: center
    };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.abs(dx) + Math.abs(dy) > 4) setDragging(true);

    const startWorld = latLngToWorld(dragRef.current.centerAtStart, zoom);
    const nextWorld = {
      x: startWorld.x - dx,
      y: startWorld.y - dy
    };

    const nextCenter = worldToLatLng(nextWorld, zoom);

    setCenter({
      lat: clamp(nextCenter.lat, 38.78, 39.03),
      lng: clamp(nextCenter.lng, -77.18, -76.86)
    });
  }

  function handlePointerUp(e) {
    if (!dragRef.current) return;

    const wasDragging = dragging;
    dragRef.current = null;

    if (!wasDragging && !revealed) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      onGuess(screenToPoint(x, y));
    }

    setTimeout(() => setDragging(false), 0);
  }

  function zoomBy(delta) {
    setZoom((z) => clamp(z + delta, MIN_ZOOM, MAX_ZOOM));
  }

  return (
    <div className="map-wrap" style={{ height: MAP_HEIGHT }}>
      <div
        className={`map-surface ${dragging ? "dragging" : "ready"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {tiles.map((tile) => {
          const max = Math.pow(2, zoom);
          const wrappedX = ((tile.x % max) + max) % max;
          const left = tile.x * TILE_SIZE - topLeft.x;
          const top = tile.y * TILE_SIZE - topLeft.y;

          return (
            <img
              key={`${zoom}-${tile.x}-${tile.y}`}
              alt=""
              draggable="false"
              className="tile"
              src={`https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tile.y}.png`}
              style={{ left, top }}
            />
          );
        })}

        {guesses.map((guess, index) => {
          const p = pointToScreen(guess.guess);
          return (
            <div
              key={index}
              className={`pin ${scoreClass(guess.distance)}`}
              style={{ left: p.x, top: p.y }}
            >
              {index + 1}
            </div>
          );
        })}

        {revealed && currentAnswer && (() => {
          const p = pointToScreen(currentAnswer);
          const latestGuess = guesses[guesses.length - 1];
          const guessPoint = latestGuess ? pointToScreen(latestGuess.guess) : null;

          return (
            <>
              {guessPoint && (
                <svg className="map-line" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}>
                  <line
                    x1={guessPoint.x}
                    y1={guessPoint.y}
                    x2={p.x}
                    y2={p.y}
                    stroke="#020617"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                    opacity="0.75"
                  />
                </svg>
              )}

              <div className="pin answer-pin" style={{ left: p.x, top: p.y }}>
                ★
              </div>
            </>
          );
        })()}
      </div>

      <div className="zoom-controls">
        <button type="button" onClick={() => zoomBy(1)}>+</button>
        <button type="button" onClick={() => zoomBy(-1)}>−</button>
      </div>
    </div>
  );
}

export default function DistrictedPrototype() {
  const [round, setRound] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [revealed, setRevealed] = useState(false);

  const currentLocation = dailyLocations[round];
  const gameOver = round >= dailyLocations.length;

  function handleGuess(guess) {
    if (revealed || gameOver) return;

    const d = distance(guess, currentLocation.answer);

    setGuesses([
      ...guesses,
      {
        guess,
        answer: currentLocation.answer,
        distance: d,
        location: currentLocation
      }
    ]);

    setRevealed(true);
  }

  function nextRound() {
    if (round < dailyLocations.length - 1) {
      setRound(round + 1);
      setRevealed(false);
    } else {
      setRound(dailyLocations.length);
    }
  }

  function restart() {
    setRound(0);
    setGuesses([]);
    setRevealed(false);
  }

  const totalMiles = guesses.reduce((sum, g) => sum + g.distance, 0);
  const shareText = `Districted Demo
${guesses.map((g) => scoreEmoji(g.distance)).join("")}
${totalMiles.toFixed(2)} total miles off`;

  return (
    <main className="app">
      <div className="shell">
        <header className="header">
          <h1>Districted</h1>
          <p>Pin the DC location. One guess only.</p>
        </header>

        {!gameOver && (
          <section className="card">
            <div className="meta">
              <span>Districted Daily</span>
              <span>Round {round + 1} / 5</span>
            </div>

            <div className="location-card">
              <div className="category">{currentLocation.category}</div>
              <h2>{currentLocation.name}</h2>
            </div>

            <TileMap
              guesses={guesses}
              currentAnswer={currentLocation.answer}
              revealed={revealed}
              onGuess={handleGuess}
            />

            <p className="hint">Drag to move the map. Use +/− to zoom. You get ONE guess.</p>
          </section>
        )}

        {revealed && guesses[round] && (
          <section className="card">
            <div className="score-boxes">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`score-box ${guesses[i] ? scoreClass(guesses[i].distance) : ""}`}
                />
              ))}
            </div>

            <div className="result-row">
              <strong>Distance Off</strong>
              <span>{formatMiles(guesses[round].distance)}</span>
            </div>

            <br />

            <button className="primary-button" onClick={nextRound}>
              {round === dailyLocations.length - 1 ? "See Final Score" : "Next Location"}
            </button>
          </section>
        )}

        {gameOver && (
          <section className="card final-score">
            <div className="category">Final Score</div>
            <h2>{totalMiles.toFixed(2)}</h2>
            <p>Total miles off</p>

            <div className="score-boxes">
              {guesses.map((g, i) => (
                <div key={i} className={`score-box ${scoreClass(g.distance)}`} />
              ))}
            </div>

            <pre className="share">{shareText}</pre>

            <button className="primary-button" onClick={restart}>
              Play Again
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
