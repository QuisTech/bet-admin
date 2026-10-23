import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-expect-error JS helper lacks type declarations
import { syncJackpotRounds } from './scripts/syncJackpotHelper.js';
// @ts-expect-error JS helper lacks type declarations
import { sync1xBetDraws } from './scripts/sync1xBetHelper.js';

function jackpotSyncPlugin(): Plugin {
  return {
    name: 'jackpot-sync-plugin',
    configureServer(server) {
      server.middlewares.use('/api/sync-jackpot', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
        try {
          const result = await syncJackpotRounds();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Sync failed' }));
        }
      });

      server.middlewares.use('/api/sync-1xbet', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
        try {
          const result = await sync1xBetDraws();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || '1xBet sync failed' }));
        }
      });

      server.middlewares.use('/api/prospective-ledger', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          const platform = url.searchParams.get('platform') || 'sportybet';
          // @ts-expect-error JS helper lacks type declarations
          const { loadProspectiveLedger } = await import('./scripts/prospectiveAuditHelper.js');
          const ledger = loadProspectiveLedger(platform);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(ledger));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Failed to read prospective ledger' }));
        }
      });

      server.middlewares.use('/api/prospective-settle', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const platform = data.platform || 'sportybet';
            const roundId = data.roundId;
            if (!roundId) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Missing roundId' }));
            }
            // @ts-expect-error JS helper lacks type declarations
            const { settleProspectiveRound } = await import('./scripts/prospectiveAuditHelper.js');
            const result = await settleProspectiveRound(platform, roundId);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Failed to settle prospective round' }));
          }
        });
      });

      server.middlewares.use('/api/prospective-register', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            // @ts-expect-error JS helper lacks type declarations
            const { registerProspectiveRound } = await import('./scripts/prospectiveAuditHelper.js');
            const result = registerProspectiveRound(data);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Failed to register prospective round' }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), jackpotSyncPlugin()],
  server: {
    port: 3010,
    strictPort: true,
    host: true,
    proxy: {
      '/api/fpl': {
        target: 'https://fantasy.premierleague.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fpl/, ''),
      },
      '/api/odds': {
        target: 'https://api.the-odds-api.com/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/odds/, ''),
      },
      '/api/sporty': {
        target: 'https://shop.sportybet.com/api/ng',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sporty/, ''),
      },
    },
  },
});
