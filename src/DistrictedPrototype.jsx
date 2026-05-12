import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE || "mapbox://styles/mapbox/streets-v12";

const dailyLocations = [
  { name: "The Lincoln Memorial", category: "Monument", answer: { lat: 38.889269, lng: -77.050176 } },
  { name: "Ben's Chili Bowl", category: "Restaurant", answer: { lat: 38.917025, lng: -77.03145 } },
  { name: "Nationals Park", category: "Sports", answer: { lat: 38.872987, lng: -77.007435 } },
  { name: "The Anthem", category: "Music Venue", answer: { lat: 38.881954, lng: -77.026972 } },
  { name: "Dan's Cafe", category: "Dive Bar", answer: { lat: 38.914139, lng: -77.042258 } }
];

function distance(a,b){const R=3958.8;const toRad=(d)=>(d*Math.PI)/180;const dLat=toRad(b.lat-a.lat);const dLng=toRad(b.lng-a.lng);const lat1=toRad(a.lat);const lat2=toRad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function formatMiles(miles){return miles<0.1?`${Math.round(miles*5280)} ft`:`${miles.toFixed(2)} mi`;}
function scoreClass(d){if(d<=0.15)return"green-dark";if(d<=0.5)return"green";if(d<=1.5)return"yellow";if(d<=3.5)return"orange";return"red";}
function scoreEmoji(d){if(d<=0.15)return"🟩";if(d<=0.5)return"🟢";if(d<=1.5)return"🟨";if(d<=3.5)return"🟧";return"🟥";}
function makeMarkerElement(className,label){const el=document.createElement("div");el.className=className;el.textContent=label;return el;}
function emptyLineData(){return{type:"Feature",geometry:{type:"LineString",coordinates:[]}};}
function fullLineData(guess, answer){return{type:"Feature",geometry:{type:"LineString",coordinates:[[guess.lng,guess.lat],[answer.lng,answer.lat]]}};}

function TileMap({ activeGuess, currentAnswer, revealed, roundNumber, onGuess }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const guessMarkerRef = useRef(null);
  const answerMarkerRef = useRef(null);
  const revealedRef = useRef(revealed);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !mapNodeRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapNodeRef.current,
      style: MAPBOX_STYLE,
      center: [-77.0369, 38.9072],
      zoom: 12.25,
      minZoom: 10.5,
      maxZoom: 17,
      attributionControl: false
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      if (!map.getSource("reveal-line")) {
        map.addSource("reveal-line", { type: "geojson", data: emptyLineData() });
      }

      if (!map.getLayer("reveal-line")) {
        map.addLayer({
          id: "reveal-line",
          type: "line",
          source: "reveal-line",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#020617",
            "line-width": 4,
            "line-opacity": 0.85,
            "line-dasharray": [1.5, 1.2]
          }
        });
      }

      setMapReady(true);
    });

    map.on("click", (event) => {
      if (revealedRef.current) return;
      onGuess({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onGuess]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (guessMarkerRef.current) {
      guessMarkerRef.current.remove();
      guessMarkerRef.current = null;
    }

    if (answerMarkerRef.current) {
      answerMarkerRef.current.remove();
      answerMarkerRef.current = null;
    }

    const source = map.getSource("reveal-line");
    if (source) source.setData(emptyLineData());

    if (!activeGuess) return;

    guessMarkerRef.current = new mapboxgl.Marker({
      element: makeMarkerElement(`map-marker ${scoreClass(activeGuess.distance)}`, String(roundNumber))
    })
      .setLngLat([activeGuess.guess.lng, activeGuess.guess.lat])
      .addTo(map);
  }, [activeGuess, roundNumber, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource("reveal-line");

    if (!revealed || !activeGuess || !currentAnswer || !source) {
      if (source) source.setData(emptyLineData());
      if (answerMarkerRef.current) {
        answerMarkerRef.current.remove();
        answerMarkerRef.current = null;
      }
      return;
    }

    if (answerMarkerRef.current) {
      answerMarkerRef.current.remove();
      answerMarkerRef.current = null;
    }

    answerMarkerRef.current = new mapboxgl.Marker({
      element: makeMarkerElement("answer-marker", "★")
    })
      .setLngLat([currentAnswer.lng, currentAnswer.lat])
      .addTo(map);

    source.setData(fullLineData(activeGuess.guess, currentAnswer));

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([activeGuess.guess.lng, activeGuess.guess.lat]);
    bounds.extend([currentAnswer.lng, currentAnswer.lat]);

    map.fitBounds(bounds, {
      padding: 95,
      maxZoom: 14.5,
      duration: 650
    });
  }, [revealed, activeGuess, currentAnswer, mapReady]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-wrap">
        <div className="map-message">
          <div><strong>Mapbox token needed.</strong><br />Add VITE_MAPBOX_TOKEN in Vercel, then redeploy.</div>
        </div>
      </div>
    );
  }

  return <div className="map-wrap"><div ref={mapNodeRef} className="mapbox-map" /></div>;
}

export default function DistrictedPrototype() {
  const [round, setRound] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  const currentLocation = dailyLocations[round];
  const gameOver = round >= dailyLocations.length;
  const activeGuess = guesses[round];
  const totalMiles = guesses.reduce((sum,g)=>sum+g.distance,0);
  const scoreLine = guesses.map((g)=>scoreEmoji(g.distance)).join("");
  const shareText = `Districted\n${scoreLine}\n${totalMiles.toFixed(2)} total miles off\nhttps://districted.vercel.app/`;

  function handleGuess(guess) {
    if (revealed || gameOver) return;

    const d = distance(guess, currentLocation.answer);

    setGuesses([
      ...guesses,
      { guess, answer: currentLocation.answer, distance: d, location: currentLocation }
    ]);

    setRevealed(true);
    setShareStatus("");
  }

  function nextRound() {
    if (round < dailyLocations.length - 1) {
      setRound(round + 1);
      setRevealed(false);
      setShareStatus("");
    } else {
      setRound(dailyLocations.length);
    }
  }

  function restart() {
    setRound(0);
    setGuesses([]);
    setRevealed(false);
    setShareStatus("");
  }

  async function shareGame() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Districted", text: shareText, url: "https://districted.vercel.app/" });
        setShareStatus("Shared");
      } else {
        await navigator.clipboard?.writeText(shareText);
        setShareStatus("Copied to clipboard");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setShareStatus("Share failed — copy manually");
    }
  }

  return (
    <main className="app">
      <div className="shell">
        <header className="header"><h1>Districted</h1><p>Pin the DC location.</p></header>

        {!gameOver && (
          <section className="card">
            <div className="meta"><span>Districted Daily</span><span>Round {round + 1} / 5</span></div>
            <div className="location-card"><div className="category">{currentLocation.category}</div><h2>{currentLocation.name}</h2></div>
            <TileMap activeGuess={activeGuess} currentAnswer={currentLocation.answer} revealed={revealed} roundNumber={round + 1} onGuess={handleGuess} />
            <p className="hint">Drag, pinch, scroll, or use the map controls to find your spot.</p>
          </section>
        )}

        {revealed && guesses[round] && (
          <section className="card">
            <div className="score-boxes">
              {[0,1,2,3,4].map((i)=><div key={i} className={`score-box ${guesses[i] ? scoreClass(guesses[i].distance) : ""}`} />)}
            </div>
            <div className="result-row"><strong>Distance Off</strong><span>{formatMiles(guesses[round].distance)}</span></div>
            <br />
            <button className="primary-button" onClick={nextRound}>{round === dailyLocations.length - 1 ? "See Final Score" : "Next Location"}</button>
          </section>
        )}

        {gameOver && (
          <section className="card final-score">
            <div className="category">Final Score</div><h2>{totalMiles.toFixed(2)}</h2><p>Total miles off</p>
            <div className="score-boxes">{guesses.map((g,i)=><div key={i} className={`score-box ${scoreClass(g.distance)}`} />)}</div>
            <pre className="share">{shareText}</pre>
            <div className="button-stack"><button className="primary-button" onClick={shareGame}>Share Result</button><button className="secondary-button" onClick={restart}>Play Again</button></div>
            {shareStatus && <p className="share-status">{shareStatus}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
