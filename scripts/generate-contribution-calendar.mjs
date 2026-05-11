import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const username = 'Muhammed-Sahal717';
const outputPath = resolve('assets/contribution-calendar.svg');
const url = `https://github.com/users/${username}/contributions`;

const zeroColor = '#EBEBEB';
const levelColors = ['#A7F1EA', '#65EBD9', '#21D7D0', '#18A9C8'];

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
}

function parseCells(html) {
  const rows = [...html.matchAll(/<tr style="height: 10px">([\s\S]*?)<\/tr>/g)];
  const cells = [];

  for (const [rowIndex, match] of rows.entries()) {
    const rowHtml = match[1];
    const dayCells = [...rowHtml.matchAll(
      /<td tabindex="0" data-ix="(\d+)"[^>]*data-date="([^"]+)"[^>]*data-level="(\d+)"[^>]*class="ContributionCalendar-day"><\/td>\s*<tool-tip[^>]*>([\s\S]*?)<\/tool-tip>/g
    )];

    for (const day of dayCells) {
      const [, ix, date, level, tooltip] = day;
      const countMatch = tooltip.match(/(\d+)\s+contribution/);
      cells.push({
        rowIndex,
        weekIndex: Number(ix),
        date: new Date(`${date}T00:00:00Z`),
        level: Number(level),
        count: countMatch ? Number(countMatch[1]) : 0,
      });
    }
  }

  return cells;
}

function renderCalendar(cells) {
  const cellSize = 10;
  const gap = 2;
  const left = 34;
  const top = 28;
  const gridWidth = (Math.max(...cells.map((cell) => cell.weekIndex)) + 1) * (cellSize + gap) - gap;
  const gridHeight = 7 * (cellSize + gap) - gap;
  const width = left + gridWidth + 40;
  const height = top + gridHeight + 34;

  const monthLabels = [];
  const seenMonths = new Set();
  [...cells]
    .sort((a, b) => a.date - b.date)
    .forEach((cell) => {
      const key = `${cell.date.getUTCFullYear()}-${cell.date.getUTCMonth()}`;
      if (seenMonths.has(key)) return;
      seenMonths.add(key);
      monthLabels.push({
        x: left + cell.weekIndex * (cellSize + gap),
        label: monthLabel(cell.date),
      });
    });

  const cellsSvg = cells
    .map((cell) => {
      const x = left + cell.weekIndex * (cellSize + gap);
      const y = top + cell.rowIndex * (cellSize + gap);
      const fill = cell.level === 0 ? zeroColor : levelColors[Math.min(cell.level - 1, levelColors.length - 1)];
      return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${fill}"/>`;
    })
    .join('\n');

  const monthsSvg = monthLabels
    .map((month) => `<text x="${month.x}" y="18" fill="#8B949E" font-family="Arial, sans-serif" font-size="11">${esc(month.label)}</text>`)
    .join('\n');

  const yLabels = [
    { y: top + 10, label: 'Mon' },
    { y: top + 34, label: 'Wed' },
    { y: top + 58, label: 'Fri' },
  ]
    .map((item) => `<text x="2" y="${item.y}" fill="#8B949E" font-family="Arial, sans-serif" font-size="10">${item.label}</text>`)
    .join('\n');

  const legendX = width - 150;
  const legendSvg = `
    <text x="${legendX}" y="${height - 10}" fill="#8B949E" font-family="Arial, sans-serif" font-size="11">Less</text>
    <rect x="${legendX + 30}" y="${height - 20}" width="9" height="9" rx="2" fill="${zeroColor}"/>
    <rect x="${legendX + 43}" y="${height - 20}" width="9" height="9" rx="2" fill="${levelColors[0]}"/>
    <rect x="${legendX + 56}" y="${height - 20}" width="9" height="9" rx="2" fill="${levelColors[1]}"/>
    <rect x="${legendX + 69}" y="${height - 20}" width="9" height="9" rx="2" fill="${levelColors[2]}"/>
    <rect x="${legendX + 82}" y="${height - 20}" width="9" height="9" rx="2" fill="${levelColors[3]}"/>
    <text x="${legendX + 98}" y="${height - 10}" fill="#8B949E" font-family="Arial, sans-serif" font-size="11">More</text>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-label="GitHub-style contribution calendar">
  <rect width="${width}" height="${height}" rx="16" fill="#111111"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="15.5" stroke="#1F2937"/>
  ${monthsSvg}
  ${yLabels}
  <rect x="${left}" y="${top}" width="${gridWidth}" height="${gridHeight}" fill="#111111"/>
  ${cellsSvg}
  ${legendSvg}
</svg>`;
}

async function main() {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
      'accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contributions page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const cells = parseCells(html);

  if (!cells.length) {
    throw new Error('Could not find contribution cells on the GitHub page.');
  }

  const svg = renderCalendar(cells);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg, 'utf8');
  console.log(`Wrote ${outputPath} from ${cells.length} contribution cells.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
