import { useEffect } from "react";

function App() {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onopen = () => {
      ws.send("Hi there!"); // Sends to backend when connection opens
    };

    ws.onmessage = (event) => {
      console.log("Backend responded:", event.data);
    };

    return () => ws.close();
  }, []);

  return <div>Check Bun terminal for output!</div>;
}

export default App;
