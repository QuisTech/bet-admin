/**
 * 1xBet TOTO-14 Historical Draw Ingestion Script
 * Run via: npm run update:1xbet
 */

async function run() {
  console.log('⚡ Starting 1xBet TOTO-14 Historical Draw Sync...');
  const { sync1xBetDraws } = await import('./sync1xBetHelper.js');
  try {
    const result = await sync1xBetDraws();
    console.log('✅ ' + result.message);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to sync 1xBet draws:', err);
    process.exit(1);
  }
}

run();
