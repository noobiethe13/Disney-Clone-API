import express from 'express';
import https from 'https';
import cors from 'cors';

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

const movieBaseUrl = "https://api.themoviedb.org/3";
const api_key = 'your-api-key';

const movieByGenreBaseURL = `${movieBaseUrl}/discover/movie?api_key=${api_key}`;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = (url, retries = 5) => {
  return new Promise((resolve, reject) => {
    const makeRequest = (attempt) => {
      console.log(`Attempt ${attempt} for ${url}`);
      
      const req = https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log(`Success on attempt ${attempt} for ${url}`);
          resolve(JSON.parse(data));
        });
      });

      req.on('error', (error) => {
        console.error(`Error on attempt ${attempt} for ${url}:`, error.message);
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`Waiting ${delay}ms before next attempt`);
          setTimeout(() => makeRequest(attempt + 1), delay);
        } else {
          reject(error);
        }
      });

      req.on('timeout', () => {
        console.error(`Timeout on attempt ${attempt} for ${url}`);
        req.abort();
      });

      req.setTimeout(30000);  // 30 seconds timeout
    };

    makeRequest(1);
  });
};

app.get('/trending', async (req, res) => {
  try {
    const data = await fetchWithRetry(`${movieBaseUrl}/trending/all/day?api_key=${api_key}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/genre/:id', async (req, res) => {
  const genreId = req.params.id;
  try {
    const data = await fetchWithRetry(`${movieByGenreBaseURL}&with_genres=${genreId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;