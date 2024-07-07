import express from 'express';
import axios from 'axios';
import https from 'https';
import dns from 'dns/promises';
import cors from 'cors';

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

const movieBaseUrl = "https://api.themoviedb.org/3";
const api_key = '2ec0d66f5bdf1dd12eefa0723f1479cf';

const movieByGenreBaseURL = `${movieBaseUrl}/discover/movie?api_key=${api_key}`;

const googleDns = ["8.8.8.8", "8.8.4.4"];
const cloudflareDns = ["1.1.1.1", "1.0.0.1"];

const customDnsLookup = async (hostname) => {
  const tryDns = async (servers) => {
    dns.setServers(servers);
    try {
      const result = await dns.lookup(hostname);
      return result.address;
    } catch (error) {
      console.error(`DNS lookup failed for ${hostname} using ${servers[0]}:`, error);
      return null;
    }
  };

  let ip = await tryDns(googleDns);
  if (!ip) {
    console.log("Falling back to Cloudflare DNS");
    ip = await tryDns(cloudflareDns);
  }

  if (!ip) {
    throw new Error(`Unable to resolve ${hostname} using both Google and Cloudflare DNS`);
  }

  return ip;
};

const httpsAgent = new https.Agent({
  keepAlive: true,
  lookup: customDnsLookup,
});

const axiosInstance = axios.create({
  httpsAgent,
  timeout: 10000,
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options = {}, retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} for ${url}`);
      const response = await axiosInstance.get(url, options);
      console.log(`Success on attempt ${i + 1} for ${url}`);
      return response.data;
    } catch (error) {
      console.error(`Error on attempt ${i + 1} for ${url}:`, error.message);
      if (i === retries - 1) throw error;
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.log(`Waiting ${delay}ms before next attempt`);
      await wait(delay);
    }
  }
};

let isCircuitOpen = false;
let lastFailureTime = 0;
const CIRCUIT_RESET_TIMEOUT = 60000; // 1 minute

const circuitBreaker = async (fn) => {
  if (isCircuitOpen) {
    if (Date.now() - lastFailureTime > CIRCUIT_RESET_TIMEOUT) {
      isCircuitOpen = false;
    } else {
      throw new Error("Circuit is open. Try again later.");
    }
  }
  
  try {
    return await fn();
  } catch (error) {
    isCircuitOpen = true;
    lastFailureTime = Date.now();
    throw error;
  }
};

app.get('/trending', async (req, res) => {
  try {
    const data = await circuitBreaker(() => 
      fetchWithRetry(`${movieBaseUrl}/trending/all/day?api_key=${api_key}`)
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/genre/:id', async (req, res) => {
  const genreId = req.params.id;
  try {
    const data = await circuitBreaker(() => 
      fetchWithRetry(`${movieByGenreBaseURL}&with_genres=${genreId}`)
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;