import express from 'express';
import http from 'http';
import https from 'https';
import dns from 'dns/promises';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

const movieBaseUrl = "https://api.themoviedb.org/3";
const api_key = '2ec0d66f5bdf1dd12eefa0723f1479cf';

const movieByGenreBaseURL = `${movieBaseUrl}/discover/movie?api_key=${api_key}`;

dns.setServers([
  "1.1.1.1",
  "[2606:4700:4700::1111]",
]);

const staticLookup = () => async (hostname, _, cb) => {
  const ips = await dns.resolve(hostname);
  if (ips.length === 0) {
    throw new Error(`Unable to resolve ${hostname}`);
  }
  const ip = ips[0];
  cb(null, [{ address: ip, family: 4 }]); // Assuming IPv4
};

const staticDnsAgent = (scheme) => {
  const httpModule = scheme === "http" ? http : https;
  return new httpModule.Agent({ lookup: staticLookup() });
};

app.get('/trending', async (req, res) => {
  try {
    const response = await fetch(`${movieBaseUrl}/trending/all/day?api_key=${api_key}`, {
      agent: staticDnsAgent("https"),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/genre/:id', async (req, res) => {
  const genreId = req.params.id;
  try {
    const response = await fetch(`${movieByGenreBaseURL}&with_genres=${genreId}`, {
      agent: staticDnsAgent("https"),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
