import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const Dashboard = () => {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/health')
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Music Visualizer</h1>
      <p style={styles.subtitle}>Dashboard — Section 1 Scaffold</p>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Backend Health</h2>
        {error && <p style={styles.error}>Error: {error}</p>}
        {!health && !error && <p style={styles.muted}>Checking backend...</p>}
        {health && (
          <pre style={styles.pre}>{JSON.stringify(health, null, 2)}</pre>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0f0f0f',
    color: '#f0f0f0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    padding: '2rem',
  },
  title: {
    fontSize: '2.5rem',
    margin: 0,
    letterSpacing: '0.1em',
  },
  subtitle: {
    color: '#888',
    marginTop: '0.5rem',
    marginBottom: '2rem',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1.5rem 2rem',
    minWidth: '320px',
  },
  cardTitle: {
    marginTop: 0,
    fontSize: '1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#1db954',
  },
  pre: {
    margin: 0,
    color: '#ccc',
    fontSize: '0.9rem',
  },
  muted: {
    color: '#666',
    margin: 0,
  },
  error: {
    color: '#e74c3c',
    margin: 0,
  },
};

export default Dashboard;
