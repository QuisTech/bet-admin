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
export function cleanMatchName(raw: string): string {
  return raw
    .replace(/\[\d{1,2}:\d{2}\s*/g, '') // strip markdown timestamp "[20:45"
    .replace(/\(.*?\)/g, '')            // strip markdown url link "(https://...)"
    .replace(/[\[\]]/g, '')             // strip brackets
    .replace(/\s*-\s*/g, ' vs ')        // convert "TeamA-TeamB" to "TeamA vs TeamB"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract matches from a DOM document or element (OddsPortal modern Next.js DOM).
 */
export function extractMatchesFromDomNode(doc: Document | Element): ParsedOddsMatch[] {
  const matches: ParsedOddsMatch[] = [];
  const seen = new Set<string>();

  // Primary Selector: Modern OddsPortal H2H Match Links
  const links = Array.from(doc.querySelectorAll('a[href*="/h2h/"], a[href*="/football/h2h/"], a[href*="/basketball/h2h/"], a[href*="/tennis/h2h/"]'));
  for (let i = 0; i < links.length; i++) {
    const a = links[i] as HTMLAnchorElement;

    // Skip anti-bot honeypot elements or hidden containers
    if (a.closest && a.closest('[data-ab-trap], [aria-hidden="true"], [style*="-9999px"]')) {
      continue;
    }

    let team1 = '';
    let team2 = '';

    // 1. Check for group-hover or truncate team name paragraphs inside the anchor
    const teamPs = Array.from(a.querySelectorAll('p[class*="group-hover"], p[class*="truncate"], p.font-primary'))
      .map(el => (el as HTMLElement).innerText?.trim() || '')
      .filter(txt => txt.length > 0 && !/^\d{1,2}:\d{2}$/.test(txt) && txt !== '-' && !txt.includes(':'));

    if (teamPs.length >= 2) {
      team1 = teamPs[0];
      team2 = teamPs[1];
    }

    // 2. Fallback: check img alt attributes
    if (!team1 || !team2) {
      const imgs = Array.from(a.querySelectorAll('img[alt]'))
        .map(img => ((img as HTMLImageElement).alt || '').trim())
        .filter(alt => alt.length > 1 && !alt.toLowerCase().includes('logo') && !alt.toLowerCase().includes('icon') && !alt.toLowerCase().includes('sport'));
      if (imgs.length >= 2) {
        team1 = imgs[0];
        team2 = imgs[1];
      }
    }

    // 3. Fallback: parse from href: e.g. /football/h2h/kano-pillars-8fXi1zgC/sporting-lagos-8Unjxadi/
    if (!team1 || !team2) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/h2h\/([^/#?]+)\/([^/#?]+)/);
      if (m) {
        const cleanSlug = (s: string) => {
          return s.replace(/-[A-Za-z0-9]{6,}$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        };
        team1 = cleanSlug(m[1]);
        team2 = cleanSlug(m[2]);
      }
    }

    if (!team1 || !team2) continue;

    const matchTitle = `${team1} vs ${team2}`;

    // Find the row container
    const row = a.closest ? (a.closest('div[class*="items-stretch"]') || a.closest('div.flex.w-full') || a.parentElement) : a.parentElement;
    if (!row) continue;

    let nums: number[] = [];
    const lis = Array.from(row.querySelectorAll('ul > li'));
    if (lis.length >= 3) {
      for (let j = 0; j < lis.length; j++) {
        const val = ((lis[j] as HTMLElement).innerText || '').trim();
        const mVal = val.match(/\b\d{1,2}\.\d{2,3}\b/);
        if (mVal) {
          nums.push(parseFloat(mVal[0]));
        }
      }
    }

    if (nums.length < 3) {
      const rowText = (row as HTMLElement).innerText || '';
      const allNums = rowText.match(/\b\d{1,2}\.\d{2,3}\b/g) || [];
      nums = allNums.map(Number).filter(n => n > 1.01);
    }

    if (nums.length >= 3 && !seen.has(matchTitle)) {
      seen.add(matchTitle);
      matches.push({
        matchName: matchTitle,
        homeOdds: nums[0],
        drawOdds: nums[1],
        awayOdds: nums[2],
      });
    }
  }

  return matches;
}

/**
 * Extracts all matches and odds from arbitrary text (copied from OddsPortal, FlashScore, WhatsApp, HTML, etc.).
 */
export function parseOddsPortalText(raw: string): ParsedOddsMatch[] {
  if (!raw || raw.trim().length === 0) return [];

  const matches: ParsedOddsMatch[] = [];

  // Check if it's already a JSON array (e.g. from whole-page bookmarklet/script)
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0 && arr[0].h && arr[0].d && arr[0].a) {
        return arr.map((item: any) => ({
          matchName: item.match || 'Imported Match',
          homeOdds: parseFloat(item.h) || 2.0,
          drawOdds: parseFloat(item.d) || 3.0,
          awayOdds: parseFloat(item.a) || 3.0,
          retailOdds: item.retail ? parseFloat(item.retail) : undefined,
          bookmaker: item.bookmaker,
          league: item.league,
        }));
      }
    } catch {}
  }

  // Check if it's a single JSON object
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
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

  // Check if it's HTML (pasted elements from DevTools or view-source)
  if (typeof DOMParser !== 'undefined' && (raw.includes('<div') || raw.includes('<main') || raw.includes('<a') || raw.includes('href='))) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, 'text/html');
      const fromDom = extractMatchesFromDomNode(doc);
      if (fromDom.length > 0) {
        return fromDom;
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
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const decimalRegex = /^\d{1,2}\.\d{2,3}$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Case 2A: Line is a single match title (has letters and "vs" or "-")
    const isTitleCandidate =
      (/[A-Za-z]/.test(line) && (line.includes(' vs ') || line.includes(' - ') || line.includes('-'))) &&
      !line.toLowerCase().startsWith('http') &&
      !line.includes('OddsPortal') &&
      !['1', 'x', '2', 'home', 'draw', 'away'].includes(line.toLowerCase());

    if (isTitleCandidate) {
      const currentTitle = cleanMatchName(line);

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

    // Case 2B: Two consecutive team lines followed by 3 numbers
    // e.g.
    // Line i: Kano Pillars
    // Line i+1: Sporting Lagos
    // Line i+2: 1.64
    // Line i+3: 3.48
    // Line i+4: 4.84
    if (i + 4 < lines.length) {
      const possibleTeam1 = line;
      const possibleTeam2 = lines[i + 1];

      const isTeamName = (s: string) =>
        /[A-Za-z]/.test(s) &&
        !decimalRegex.test(s) &&
        !/^\d{1,2}:\d{2}$/.test(s) &&
        !s.toLowerCase().startsWith('http') &&
        !['1', 'x', '2', 'today', 'tomorrow', 'yesterday', 'npfl', 'premier league'].includes(s.toLowerCase());

      if (isTeamName(possibleTeam1) && isTeamName(possibleTeam2)) {
        const oddsSlice: number[] = [];
        let k = i + 2;
        while (k < lines.length && oddsSlice.length < 3) {
          const checkLine = lines[k];
          if (decimalRegex.test(checkLine)) {
            oddsSlice.push(parseFloat(checkLine));
          } else {
            const parts = checkLine.split(/\s+/).filter(p => decimalRegex.test(p));
            if (parts.length >= 3) {
              oddsSlice.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
              break;
            }
            if (/[A-Za-z]/.test(checkLine)) break;
          }
          k++;
        }

        if (oddsSlice.length === 3 && oddsSlice.every(n => n > 1.01)) {
          matches.push({
            matchName: `${possibleTeam1} vs ${possibleTeam2}`,
            homeOdds: oddsSlice[0],
            drawOdds: oddsSlice[1],
            awayOdds: oddsSlice[2],
          });
          i = k - 1;
          continue;
        }
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
 * Pure, clean JavaScript script to run in the OddsPortal DevTools Console (F12) for a SINGLE match.
 * Contains no %20 or URI-encoded artifacts.
 */
export function getOddsPortalCleanScript(appUrl: string = 'https://bet-admin-iota.vercel.app'): string {
  return `(function() {
  try {
    var doc = document;
    var title = '';
    var h = 0, d = 0, a = 0;

    var h1 = doc.querySelector('h1') || doc.querySelector('[data-testid="game-details"]');
    if (h1) {
      title = h1.innerText.replace(/\\n/g, ' - ').trim();
    } else {
      title = doc.title.split('|')[0].split('-')[0].trim();
    }

    var rows = Array.from(doc.querySelectorAll('tr, div[class*="flex"], div[class*="row"]'));
    var pinnacleRow = rows.find(function(r) {
      return r.innerText && r.innerText.toLowerCase().includes('pinnacle');
    });

    var targetRow = pinnacleRow || doc.body;
    var numbers = (targetRow.innerText || '').match(/\\b\\d{1,2}\\.\\d{2,3}\\b/g) || [];

    if (numbers.length >= 3) {
      h = parseFloat(numbers[0]);
      d = parseFloat(numbers[1]);
      a = parseFloat(numbers[2]);
    } else {
      var sel = window.getSelection ? window.getSelection().toString() : '';
      var selNums = sel.match(/\\b\\d{1,2}\\.\\d{2,3}\\b/g) || [];
      if (selNums.length >= 3) {
        h = parseFloat(selNums[0]);
        d = parseFloat(selNums[1]);
        a = parseFloat(selNums[2]);
      }
    }

    if (h <= 1.0 || d <= 1.0 || a <= 1.0) {
      alert('⚠️ Could not automatically detect 3-way odds. Highlight the 3 odds numbers with your mouse, then press Enter again!');
      return;
    }

    var payload = { match: title || 'OddsPortal Match', h: h, d: d, a: a };
    var jsonStr = JSON.stringify(payload);
    var textToCopy = (title ? title + '\\n' : '') + h + ' ' + d + ' ' + a;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
    }

    var oldToast = doc.getElementById('bh-odds-toast');
    if (oldToast) oldToast.remove();

    var toast = doc.createElement('div');
    toast.id = 'bh-odds-toast';
    toast.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999999;background:#022c22;border:2px solid #10b981;color:#ecfdf5;padding:18px 22px;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,0.85);font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:400px;line-height:1.4;';
    
    var targetAppUrl = '${appUrl}';
    var vercelUrl = (targetAppUrl.includes('localhost') ? targetAppUrl : 'https://bet-admin-iota.vercel.app') + '/#clv=' + encodeURIComponent(jsonStr);
    var localUrl = 'http://localhost:3010/#clv=' + encodeURIComponent(jsonStr);

    toast.innerHTML = '<div style="font-weight:900;color:#34d399;font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">⚡ OddsPortal CLV Captured!</div>' +
      '<div style="color:#e2e8f0;margin-bottom:10px;"><strong>' + (title || 'Match') + '</strong><br>' +
      '<span style="font-family:monospace;font-size:12px;">1: <b style="color:#38bdf8;">' + h + '</b> | X: <b style="color:#38bdf8;">' + d + '</b> | 2: <b style="color:#38bdf8;">' + a + '</b></span></div>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">✅ Copied to clipboard! Ready for Bet Admin.</div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button id="bh-open-vercel" style="flex:1;background:#10b981;color:#022c22;border:none;padding:10px 12px;border-radius:10px;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.3);">🚀 Open Bet Admin</button>' +
      '<button id="bh-open-local" style="flex:1;background:#0ea5e9;color:#082f49;border:none;padding:10px 12px;border-radius:10px;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 4px 12px rgba(14,165,233,0.3);">💻 Open Localhost</button>' +
      '<button id="bh-close-btn" style="background:#1e293b;color:#cbd5e1;border:none;padding:10px 14px;border-radius:10px;font-size:12px;cursor:pointer;">✕</button>' +
      '</div>';

    doc.body.appendChild(toast);

    doc.getElementById('bh-close-btn').onclick = function() { toast.remove(); };
    doc.getElementById('bh-open-vercel').onclick = function() {
      window.open(vercelUrl, '_blank');
      toast.remove();
    };
    doc.getElementById('bh-open-local').onclick = function() {
      window.open(localUrl, '_blank');
      toast.remove();
    };

    setTimeout(function() { if (toast && toast.parentNode) toast.remove(); }, 16000);
  } catch (e) {
    alert('Error: ' + e.message);
  }
})();`;
}

/**
 * Pure, clean JavaScript script to scan ALL games on an OddsPortal tournament/league page at once.
 * Fully compatible with OddsPortal Next.js responsive DOM and classic table views.
 */
export function getWholePageOddsPortalScript(appUrl: string = 'https://bet-admin-iota.vercel.app'): string {
  return `(function() {
  try {
    var doc = document;
    var matches = [];
    var seen = new Set();

    // Strategy 1: Modern OddsPortal Next.js H2H Match Links
    var links = Array.from(doc.querySelectorAll('a[href*="/h2h/"], a[href*="/football/h2h/"], a[href*="/basketball/h2h/"], a[href*="/tennis/h2h/"]'));
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      
      // Skip anti-bot honeypot elements or hidden containers
      if (a.closest && a.closest('[data-ab-trap], [aria-hidden="true"], [style*="-9999px"]')) {
        continue;
      }

      var team1 = '', team2 = '';

      // Check group-hover team name paragraphs inside the anchor
      var teamPs = Array.from(a.querySelectorAll('p[class*="group-hover"], p[class*="truncate"], p.font-primary'))
        .filter(function(p) {
          var txt = (p.innerText || '').trim();
          return txt.length > 0 && !/^\\d{1,2}:\\d{2}$/.test(txt) && txt !== '-' && !txt.includes(':');
        });

      if (teamPs.length >= 2) {
        team1 = teamPs[0].innerText.trim();
        team2 = teamPs[1].innerText.trim();
      }

      // Fallback: check img alt attributes
      if (!team1 || !team2) {
        var imgs = Array.from(a.querySelectorAll('img[alt]')).filter(function(img) {
          var alt = (img.alt || '').trim();
          return alt.length > 1 && !alt.toLowerCase().includes('logo') && !alt.toLowerCase().includes('icon') && !alt.toLowerCase().includes('sport');
        });
        if (imgs.length >= 2) {
          team1 = imgs[0].alt.trim();
          team2 = imgs[1].alt.trim();
        }
      }

      // Fallback: parse from href: e.g. /football/h2h/kano-pillars-8fXi1zgC/sporting-lagos-8Unjxadi/
      if (!team1 || !team2) {
        var href = a.getAttribute('href') || '';
        var m = href.match(/\\/h2h\\/([^\\/#?]+)\\/([^\\/#?]+)/);
        if (m) {
          var cleanSlug = function(s) {
            return s.replace(/-[A-Za-z0-9]{6,}$/, '').replace(/-/g, ' ').replace(/\\b\\w/g, function(l) { return l.toUpperCase(); });
          };
          team1 = cleanSlug(m[1]);
          team2 = cleanSlug(m[2]);
        }
      }

      if (!team1 || !team2) continue;

      var matchTitle = team1 + ' vs ' + team2;

      // Find the row container
      var row = a.closest ? (a.closest('div[class*="items-stretch"]') || a.closest('div.flex.w-full') || a.parentElement) : a.parentElement;
      if (!row) continue;

      var nums = [];
      var lis = Array.from(row.querySelectorAll('ul > li'));
      if (lis.length >= 3) {
        for (var j = 0; j < lis.length; j++) {
          var val = (lis[j].innerText || '').trim();
          var mVal = val.match(/\\b\\d{1,2}\\.\\d{2,3}\\b/);
          if (mVal) {
            nums.push(parseFloat(mVal[0]));
          }
        }
      }

      if (nums.length < 3) {
        var rowText = row.innerText || '';
        var allNums = rowText.match(/\\b\\d{1,2}\\.\\d{2,3}\\b/g) || [];
        nums = allNums.map(Number).filter(function(n) { return n > 1.01; });
      }

      if (nums.length >= 3 && !seen.has(matchTitle)) {
        seen.add(matchTitle);
        matches.push({
          match: matchTitle,
          h: nums[0],
          d: nums[1],
          a: nums[2]
        });
      }
    }

    // Strategy 2: Fallback for generic event rows (classic OddsPortal / other layouts)
    if (matches.length === 0) {
      var generalLinks = Array.from(doc.querySelectorAll('a[href*="/football/"], a[href*="/tennis/"], a[href*="/basketball/"]'));
      for (var k = 0; k < generalLinks.length; k++) {
        var gA = generalLinks[k];
        var gText = (gA.innerText || '').trim();
        if ((gText.includes(' - ') || gText.includes(' vs ')) && !gText.includes('OddsPortal') && gText.length > 5) {
          var gRow = gA.closest ? (gA.closest('tr') || gA.closest('div[class*="eventRow"]') || gA.closest('div[class*="border"]') || gA.parentElement) : gA.parentElement;
          if (gRow) {
            var gNums = (gRow.innerText || '').match(/\\b\\d{1,2}\\.\\d{2,3}\\b/g) || [];
            if (gNums.length >= 3) {
              var gTitle = gText.replace(/\\[\\d{1,2}:\\d{2}\\s*/g, '').replace(/\\s*-\\s*/g, ' vs ').trim();
              if (!seen.has(gTitle)) {
                seen.add(gTitle);
                matches.push({
                  match: gTitle,
                  h: parseFloat(gNums[0]),
                  d: parseFloat(gNums[1]),
                  a: parseFloat(gNums[2])
                });
              }
            }
          }
        }
      }
    }

    // Strategy 3: Line by line scanning of doc.body.innerText
    if (matches.length === 0) {
      var fullText = doc.body ? doc.body.innerText : '';
      if (fullText) {
        var lines = fullText.split(/\\r?\\n/).map(function(l) { return l.trim(); }).filter(Boolean);
        for (var lIdx = 0; lIdx < lines.length; lIdx++) {
          var line = lines[lIdx];
          if ((line.includes(' - ') || line.includes(' vs ')) && !line.includes('OddsPortal') && /[A-Za-z]/.test(line)) {
            var cleanT = line.replace(/\\[\\d{1,2}:\\d{2}\\s*/g, '').replace(/\\s*-\\s*/g, ' vs ').trim();
            var foundOdds = [];
            var mIdx = lIdx + 1;
            while (mIdx < lines.length && foundOdds.length < 3) {
              var nLine = lines[mIdx];
              if (/^\\d{1,2}\\.\\d{2,3}$/.test(nLine)) {
                foundOdds.push(parseFloat(nLine));
              } else {
                var parts = nLine.split(/\\s+/).filter(function(p) { return /^\\d{1,2}\\.\\d{2,3}$/.test(p); });
                if (parts.length >= 3) {
                  foundOdds.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
                  break;
                }
                if (/[A-Za-z]/.test(nLine)) break;
              }
              mIdx++;
            }
            if (foundOdds.length === 3 && !seen.has(cleanT)) {
              seen.add(cleanT);
              matches.push({
                match: cleanT,
                h: foundOdds[0],
                d: foundOdds[1],
                a: foundOdds[2]
              });
              lIdx = mIdx - 1;
            }
          }
        }
      }
    }

    if (matches.length === 0) {
      alert('⚠️ No match rows found. Make sure you are on an OddsPortal schedule, tournament, or daily match list page!');
      return;
    }

    var jsonStr = JSON.stringify(matches);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr);
    }

    var oldToast = doc.getElementById('bh-batch-toast');
    if (oldToast) oldToast.remove();

    var toast = doc.createElement('div');
    toast.id = 'bh-batch-toast';
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;background:#022c22;border:2px solid #10b981;color:#ecfdf5;padding:20px;border-radius:20px;box-shadow:0 25px 50px rgba(0,0,0,0.9);font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:440px;line-height:1.4;';
    
    var previewRows = matches.slice(0, 5).map(function(m, idx) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #064e3b;font-size:11px;">' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:250px;color:#f1f5f9;">' + (idx + 1) + '. ' + m.match + '</span>' +
        '<span style="font-family:monospace;color:#38bdf8;font-weight:bold;">' + m.h + ' / ' + m.d + ' / ' + m.a + '</span>' +
        '</div>';
    }).join('');

    if (matches.length > 5) {
      previewRows += '<div style="text-align:center;color:#94a3b8;font-size:11px;padding-top:6px;font-weight:bold;">+ ' + (matches.length - 5) + ' more matches captured...</div>';
    }

    var targetAppUrl = '${appUrl}';
    var vercelUrl = (targetAppUrl.includes('localhost') ? targetAppUrl : 'https://bet-admin-iota.vercel.app') + '/#importSlate=' + encodeURIComponent(jsonStr);
    var localUrl = 'http://localhost:3010/#importSlate=' + encodeURIComponent(jsonStr);

    toast.innerHTML = '<div style="font-weight:900;color:#34d399;font-size:16px;margin-bottom:6px;display:flex;align-items:center;gap:6px;">⚡ Scanned ' + matches.length + ' Matches on Page!</div>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">✅ Copied entire slate to clipboard! You can also paste directly into Bet Admin.</div>' +
      '<div style="background:#011e17;border-radius:12px;padding:10px 12px;margin-bottom:14px;">' + previewRows + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<div style="display:flex;gap:8px;">' +
      '<button id="bh-batch-open-vercel" style="flex:1;background:#10b981;color:#022c22;border:none;padding:10px 12px;border-radius:10px;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.3);">🚀 Open Bet Admin (Live)</button>' +
      '<button id="bh-batch-open-local" style="flex:1;background:#0ea5e9;color:#082f49;border:none;padding:10px 12px;border-radius:10px;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 4px 15px rgba(14,165,233,0.3);">💻 Open Localhost (3010)</button>' +
      '<button id="bh-batch-close" style="background:#1e293b;color:#cbd5e1;border:none;padding:10px 14px;border-radius:10px;font-size:13px;cursor:pointer;">✕</button>' +
      '</div>' +
      '</div>';

    doc.body.appendChild(toast);

    doc.getElementById('bh-batch-close').onclick = function() { toast.remove(); };
    doc.getElementById('bh-batch-open-vercel').onclick = function() {
      window.open(vercelUrl, '_blank');
      toast.remove();
    };
    doc.getElementById('bh-batch-open-local').onclick = function() {
      window.open(localUrl, '_blank');
      toast.remove();
    };

    setTimeout(function() { if (toast && toast.parentNode) toast.remove(); }, 30000);
  } catch (e) {
    alert('Error scanning OddsPortal page: ' + e.message);
  }
})();`;
}

/**
 * Generate 1-Click Single-Match Bookmarklet
 */
export function generateOddsPortalBookmarklet(appUrl: string = 'https://bet-admin-iota.vercel.app'): string {
  const scriptBody = getOddsPortalCleanScript(appUrl);
  const compact = scriptBody.replace(/\s+/g, ' ').trim();
  return `javascript:${compact}`;
}

/**
 * Generate 1-Click Whole-Page Bookmarklet
 */
export function generateWholePageBookmarklet(appUrl: string = 'https://bet-admin-iota.vercel.app'): string {
  const scriptBody = getWholePageOddsPortalScript(appUrl);
  const compact = scriptBody.replace(/\s+/g, ' ').trim();
  return `javascript:${compact}`;
}
