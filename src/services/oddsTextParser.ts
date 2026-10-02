/**
 * Smart Parser for raw OddsPortal, FlashScore, and Bookmaker odds text/tables.
 */

export interface ParsedOddsMatch {
  matchName: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  league?: string;
  bookmaker?: string;
  retailOdds?: number;
}

/**
 * Clean match title from raw strings, stripping timestamps, URLs, brackets, etc.
 */
function cleanMatchName(raw: string): string {
  return raw
    .replace(/\[\d{1,2}:\d{2}\s*/g, '') // strip markdown timestamp "[20:45"
    .replace(/\(.*?\)/g, '')            // strip markdown url link "(https://...)"
    .replace(/[\[\]]/g, '')             // strip brackets
    .replace(/\s*-\s*/g, ' vs ')        // convert "TeamA-TeamB" to "TeamA vs TeamB"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts all matches and odds from arbitrary text (copied from OddsPortal, FlashScore, WhatsApp, etc.).
 */
export function parseOddsPortalText(raw: string): ParsedOddsMatch[] {
  if (!raw || raw.trim().length === 0) return [];

  const matches: ParsedOddsMatch[] = [];

  // Check if it's already a JSON string (e.g. from bookmarklet)
  if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
    try {
      const obj = JSON.parse(raw.trim());
      if (obj.h && obj.d && obj.a) {
        return [{
          matchName: obj.match || 'Match from Bookmarklet',
          homeOdds: parseFloat(obj.h) || 2.0,
          drawOdds: parseFloat(obj.d) || 3.0,
          awayOdds: parseFloat(obj.a) || 3.0,
          retailOdds: obj.retail ? parseFloat(obj.retail) : undefined,
          bookmaker: obj.bookmaker,
          league: obj.league,
        }];
      }
    } catch {}
  }

  // Regex pattern 1: Markdown style from OddsPortal:
  // [20:45Bosnia & Herzegovina-Sweden](url) followed by 3 numbers
  const mdPattern = /\[(?:\d{1,2}:\d{2})?\s*([A-Za-z0-9\s&.'-]+?-[A-Za-z0-9\s&.'-]+?)\](?:\([^)]*\))?[\s\S]*?(\d+\.\d{2,3})\s+(\d+\.\d{2,3})\s+(\d+\.\d{2,3})/g;
  let mdMatch;
  while ((mdMatch = mdPattern.exec(raw)) !== null) {
    const rawTitle = mdMatch[1];
    const h = parseFloat(mdMatch[2]);
    const d = parseFloat(mdMatch[3]);
    const a = parseFloat(mdMatch[4]);
    if (h > 1.0 && d > 1.0 && a > 1.0) {
      matches.push({
        matchName: cleanMatchName(rawTitle),
        homeOdds: h,
        drawOdds: d,
        awayOdds: a,
      });
    }
  }

  if (matches.length > 0) {
    return matches;
  }

  // Pattern 2: Line by line scanning
  // Common format when copying from OddsPortal / Excel:
  // Line 1: Team A vs Team B (or [20:45 Team A - Team B])
  // Line 2: 2.74
  // Line 3: 3.59
  // Line 4: 2.45
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let currentTitle = '';
  const decimalRegex = /^\d{1,2}\.\d{2,3}$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If line looks like a match title (has letters and "vs" or "-")
    const isTitleCandidate =
      (/[A-Za-z]/.test(line) && (line.includes(' vs ') || line.includes(' - ') || line.includes('-'))) &&
      !line.toLowerCase().startsWith('http') &&
      !line.includes('OddsPortal') &&
      !['1', 'x', '2', 'home', 'draw', 'away'].includes(line.toLowerCase());

    if (isTitleCandidate) {
      currentTitle = cleanMatchName(line);

      // Check next consecutive lines for 3 odds
      const nextOdds: number[] = [];
      let j = i + 1;
      while (j < lines.length && nextOdds.length < 3) {
        const nextLine = lines[j];
        if (decimalRegex.test(nextLine)) {
          nextOdds.push(parseFloat(nextLine));
        } else {
          // Check if space separated odds on same line (e.g. "2.74 3.59 2.45")
          const parts = nextLine.split(/\s+/).filter(p => decimalRegex.test(p));
          if (parts.length >= 3) {
            nextOdds.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
            break;
          }
          if (/[A-Za-z]/.test(nextLine)) {
            // Reached another text line, break
            break;
          }
        }
        j++;
      }

      if (nextOdds.length === 3) {
        matches.push({
          matchName: currentTitle,
          homeOdds: nextOdds[0],
          drawOdds: nextOdds[1],
          awayOdds: nextOdds[2],
        });
        i = j - 1;
        continue;
      }
    }

    // Pattern 3: Compact single-line: "Team A vs Team B 2.74 3.59 2.45"
    const singleLineMatch = line.match(/^([A-Za-z0-9\s&.'-]+?(?:vs|-)[A-Za-z0-9\s&.'-]+?)\s+(\d+\.\d{2,3})\s+(\d+\.\d{2,3})\s+(\d+\.\d{2,3})$/);
    if (singleLineMatch) {
      matches.push({
        matchName: cleanMatchName(singleLineMatch[1]),
        homeOdds: parseFloat(singleLineMatch[2]),
        drawOdds: parseFloat(singleLineMatch[3]),
        awayOdds: parseFloat(singleLineMatch[4]),
      });
      continue;
    }
  }

  if (matches.length > 0) {
    return matches;
  }

  // Fallback Pattern 4: Just extract 3 consecutive decimal numbers anywhere in text
  // e.g. "2.74 3.59 2.45"
  const allNumbers = raw.match(/\b\d{1,2}\.\d{2,3}\b/g);
  if (allNumbers && allNumbers.length >= 3) {
    matches.push({
      matchName: 'Pasted Odds Match',
      homeOdds: parseFloat(allNumbers[0]),
      drawOdds: parseFloat(allNumbers[1]),
      awayOdds: parseFloat(allNumbers[2]),
    });
  }

  return matches;
}

/**
 * Generate 1-Click OddsPortal Bookmarklet
 * Extracts current match, Pinnacle lines (or consensus 1X2), and sends to Bet Admin.
 */
export function generateOddsPortalBookmarklet(appUrl: string = 'https://bet-admin-iota.vercel.app'): string {
  const code = `(function() {
    try {
      var doc = document;
      var title = '';
      var h = 0, d = 0, a = 0;

      // 1. Detect match title on Oddsportal
      var h1 = doc.querySelector('h1') || doc.querySelector('[data-testid="game-details"]');
      if (h1) {
        title = h1.innerText.replace(/\\n/g, ' - ').trim();
      } else {
        title = doc.title.split('|')[0].split('-')[0].trim();
      }

      // 2. Scan for Pinnacle row or consensus 1X2 odds
      var rows = Array.from(doc.querySelectorAll('tr, div[class*="flex"], div[class*="row"]'));
      var pinnacleRow = rows.find(function(r) {
        return r.innerText && r.innerText.toLowerCase().includes('pinnacle');
      });

      var targetRow = pinnacleRow || doc.body;
      var numbers = (targetRow.innerText || '').match(/\\b\\d{1,2}\\.\\d{2,3}\\b/g) || [];

      // If on target row we found at least 3 odds
      if (numbers.length >= 3) {
        h = parseFloat(numbers[0]);
        d = parseFloat(numbers[1]);
        a = parseFloat(numbers[2]);
      } else {
        // Fallback: search anywhere in viewport/selection
        var sel = window.getSelection ? window.getSelection().toString() : '';
        var selNums = sel.match(/\\b\\d{1,2}\\.\\d{2,3}\\b/g) || [];
        if (selNums.length >= 3) {
          h = parseFloat(selNums[0]);
          d = parseFloat(selNums[1]);
          a = parseFloat(selNums[2]);
        }
      }

      if (h <= 1.0 || d <= 1.0 || a <= 1.0) {
        alert('⚠️ Could not automatically detect 3-way odds. Please select/highlight the odds numbers on OddsPortal first, then click this bookmark!');
        return;
      }

      var payload = {
        match: title || 'OddsPortal Match',
        h: h,
        d: d,
        a: a
      };

      var jsonStr = JSON.stringify(payload);
      var textToCopy = (title ? title + '\\n' : '') + h + ' ' + d + ' ' + a;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy);
      }

      // Show toast on page
      var toast = doc.createElement('div');
      toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:#022c22;border:2px solid #10b981;color:#ecfdf5;padding:16px 20px;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.8);font-family:system-ui,sans-serif;font-size:13px;max-width:360px;';
      toast.innerHTML = '<div style="font-weight:900;color:#34d399;font-size:15px;margin-bottom:6px;">⚡ OddsPortal CLV Grabbed!</div>' +
        '<div style="color:#e2e8f0;margin-bottom:8px;"><strong>' + (title || 'Match') + '</strong><br>1: <b style=\"color:#38bdf8;\">' + h + '</b> | X: <b style=\"color:#38bdf8;\">' + d + '</b> | 2: <b style=\"color:#38bdf8;\">' + a + '</b></div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">✅ Copied to clipboard! Ready to paste into Bet Admin.</div>' +
        '<div style="display:flex;gap:8px;">' +
        '<button id="bh-open-btn" style="flex:1;background:#10b981;color:#022c22;border:none;padding:8px 12px;border-radius:10px;font-weight:900;font-size:12px;cursor:pointer;">🚀 Open Inspector</button>' +
        '<button id="bh-close-btn" style="background:#1e293b;color:#cbd5e1;border:none;padding:8px 12px;border-radius:10px;font-size:12px;cursor:pointer;">✕</button>' +
        '</div>';

      doc.body.appendChild(toast);

      doc.getElementById('bh-close-btn').onclick = function() { toast.remove(); };
      doc.getElementById('bh-open-btn').onclick = function() {
        var host = '${appUrl}';
        window.open(host + '/#clv=' + encodeURIComponent(jsonStr), '_blank');
        toast.remove();
      };

      setTimeout(function() { if (toast && toast.parentNode) toast.remove(); }, 8000);
    } catch (e) {
      alert('Error parsing OddsPortal: ' + e.message);
    }
  })();`;

  const compact = code.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURI(compact)}`;
}
