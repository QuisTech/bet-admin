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
 * Extracts all matches and odds from arbitrary text (copied from OddsPortal, FlashScore, WhatsApp, etc.).
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
    toast.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999999;background:#022c22;border:2px solid #10b981;color:#ecfdf5;padding:18px 22px;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,0.85);font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:380px;line-height:1.4;';
    toast.innerHTML = '<div style="font-weight:900;color:#34d399;font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">⚡ OddsPortal CLV Captured!</div>' +
      '<div style="color:#e2e8f0;margin-bottom:10px;"><strong>' + (title || 'Match') + '</strong><br>' +
      '<span style="font-family:monospace;font-size:12px;">1: <b style="color:#38bdf8;">' + h + '</b> | X: <b style="color:#38bdf8;">' + d + '</b> | 2: <b style="color:#38bdf8;">' + a + '</b></span></div>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">✅ Copied to clipboard! Ready for Bet Admin.</div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button id="bh-open-btn" style="flex:1;background:#10b981;color:#022c22;border:none;padding:10px 14px;border-radius:10px;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.3);">🚀 Open in Bet Admin</button>' +
      '<button id="bh-close-btn" style="background:#1e293b;color:#cbd5e1;border:none;padding:10px 14px;border-radius:10px;font-size:12px;cursor:pointer;">✕</button>' +
      '</div>';

    doc.body.appendChild(toast);

    doc.getElementById('bh-close-btn').onclick = function() { toast.remove(); };
    doc.getElementById('bh-open-btn').onclick = function() {
      var host = '${appUrl}';
      window.open(host + '/#clv=' + encodeURIComponent(jsonStr), '_blank');
      toast.remove();
    };

    setTimeout(function() { if (toast && toast.parentNode) toast.remove(); }, 12000);
  } catch (e) {
    alert('Error: ' + e.message);
  }
})();`;
}

/**
 * Pure, clean JavaScript script to scan ALL games on an OddsPortal tournament/league page at once.
 */
export function getWholePageOddsPortalScript(appUrl: string = 'https://bet-admin-iota.vercel.app'): string {
  return `(function() {
  try {
    var doc = document;
    var matches = [];
    var seen = new Set();

    // Strategy 1: Look for anchor links containing team names
    var links = Array.from(doc.querySelectorAll('a[href*="/football/"]'));
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var text = (a.innerText || '').trim();
      if ((text.includes(' - ') || text.includes(' vs ')) && !text.includes('OddsPortal') && text.length > 5) {
        var row = a.closest('tr') || a.closest('div[class*="eventRow"]') || a.closest('div[class*="border"]') || a.parentElement?.parentElement;
        if (row) {
          var rowText = row.innerText || '';
          var nums = rowText.match(/\\b\\d{1,2}\\.\\d{2,3}\\b/g) || [];
          if (nums.length >= 3) {
            var title = text.replace(/\\[\\d{1,2}:\\d{2}\\s*/g, '').replace(/\\s*-\\s*/g, ' vs ').trim();
            if (!seen.has(title)) {
              seen.add(title);
              matches.push({
                match: title,
                h: parseFloat(nums[0]),
                d: parseFloat(nums[1]),
                a: parseFloat(nums[2])
              });
            }
          }
        }
      }
    }

    // Strategy 2: Fallback scanning full innerText line-by-line
    if (matches.length < 2) {
      var fullText = doc.body.innerText || '';
      var lines = fullText.split(/\\r?\\n/).map(function(l) { return l.trim(); }).filter(Boolean);
      for (var k = 0; k < lines.length; k++) {
        var line = lines[k];
        if ((line.includes(' - ') || line.includes(' vs ')) && !line.includes('OddsPortal') && /[A-Za-z]/.test(line)) {
          var cleanT = line.replace(/\\[\\d{1,2}:\\d{2}\\s*/g, '').replace(/\\s*-\\s*/g, ' vs ').trim();
          var foundOdds = [];
          var m = k + 1;
          while (m < lines.length && foundOdds.length < 3) {
            var nLine = lines[m];
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
            m++;
          }
          if (foundOdds.length === 3 && !seen.has(cleanT)) {
            seen.add(cleanT);
            matches.push({
              match: cleanT,
              h: foundOdds[0],
              d: foundOdds[1],
              a: foundOdds[2]
            });
            k = m - 1;
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
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;background:#022c22;border:2px solid #10b981;color:#ecfdf5;padding:20px;border-radius:20px;box-shadow:0 25px 50px rgba(0,0,0,0.9);font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:420px;line-height:1.4;';
    
    var previewRows = matches.slice(0, 5).map(function(m, idx) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #064e3b;font-size:11px;">' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;color:#f1f5f9;">' + (idx + 1) + '. ' + m.match + '</span>' +
        '<span style="font-family:monospace;color:#38bdf8;font-weight:bold;">' + m.h + ' / ' + m.d + ' / ' + m.a + '</span>' +
        '</div>';
    }).join('');

    if (matches.length > 5) {
      previewRows += '<div style="text-align:center;color:#94a3b8;font-size:11px;padding-top:6px;font-weight:bold;">+ ' + (matches.length - 5) + ' more matches captured...</div>';
    }

    toast.innerHTML = '<div style="font-weight:900;color:#34d399;font-size:16px;margin-bottom:6px;display:flex;align-items:center;gap:6px;">⚡ Scanned ' + matches.length + ' Matches on Page!</div>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">Copied entire slate to clipboard. Ready for Bet Admin Batch Scanner!</div>' +
      '<div style="background:#011e17;border-radius:12px;padding:10px 12px;margin-bottom:14px;">' + previewRows + '</div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button id="bh-batch-open" style="flex:1;background:#10b981;color:#022c22;border:none;padding:12px;border-radius:12px;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.4);">🚀 Import All into Bet Admin</button>' +
      '<button id="bh-batch-close" style="background:#1e293b;color:#cbd5e1;border:none;padding:12px;border-radius:12px;font-size:13px;cursor:pointer;">✕</button>' +
      '</div>';

    doc.body.appendChild(toast);

    doc.getElementById('bh-batch-close').onclick = function() { toast.remove(); };
    doc.getElementById('bh-batch-open').onclick = function() {
      var host = '${appUrl}';
      window.open(host + '/#importSlate=' + encodeURIComponent(jsonStr), '_blank');
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
