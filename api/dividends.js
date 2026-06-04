export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from/to parameters' });
  }

  try {
    const nseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Step 1: Warm up NSE session
    await fetch('https://www.nseindia.com', { headers: nseHeaders });

    // Step 2: Fetch dividend announcements from NSE
    const dividendUrl =
      `https://www.nseindia.com/api/corporates-corporateActions` +
      `?index=equities&from_date=${from}&to_date=${to}&subject=Dividend`;

    const dividendResp = await fetch(dividendUrl, { headers: nseHeaders });

    if (!dividendResp.ok) {
      return res.status(dividendResp.status).json({
        error: `NSE Dividend API returned ${dividendResp.status}`
      });
    }

    const dividendData = await dividendResp.json();

    if (!Array.isArray(dividendData) || dividendData.length === 0) {
      return res.status(200).json([]);
    }

    // Step 3: For each stock, fetch CMP from Yahoo Finance (no session needed)
    // Batch all Yahoo fetches in parallel for speed
    const results = await Promise.all(
      dividendData.map(async (row) => {
        const symbol = row.symbol || '';
        const subject = row.subject || '';

        // Parse dividend amount from subject string
        // Handles: "Rs 5 Per Share", "Re 0.20 Per Share", "Rs 24.00 Per Share"
        const match = subject.match(/(?:Rs|Re)\.?\s*([\d,]+\.?\d*)/i);
        const dividend = match ? parseFloat(match[1].replace(/,/g, '')) : 0;

        // Determine dividend type from subject
        let type = 'Final';
        const subLower = subject.toLowerCase();
        if (subLower.includes('interim')) type = 'Interim';
        else if (subLower.includes('special')) type = 'Special';
        else if (subLower.includes('distribution')) type = 'Distribution';

        // Fetch CMP from Yahoo Finance — no cookie/session required
        let cmp = 0;
        try {
          const yahooUrl =
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS` +
            `?interval=1d&range=1d&fields=regularMarketPrice`;

          const yahooResp = await fetch(yahooUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Accept': 'application/json',
            },
          });

          if (yahooResp.ok) {
            const yahooData = await yahooResp.json();
            const meta = yahooData?.chart?.result?.[0]?.meta;
            cmp = meta?.regularMarketPrice
              || meta?.previousClose
              || 0;
            // Ensure it's a number
            if (typeof cmp === 'string') cmp = parseFloat(cmp.replace(/,/g, ''));
          }
        } catch (e) {
          console.error(`Yahoo CMP failed for ${symbol}:`, e.message);
        }

        const yieldPct = dividend > 0 && cmp > 0
          ? Number(((dividend / cmp) * 100).toFixed(2))
          : 0;

        return {
          symbol,
          company: row.comp || row.company || '',
          exDate: row.exDate || '',
          recDate: row.recDate || '',
          subject,
          dividend,
          type,
          cmp: Number(cmp.toFixed(2)),
          yieldPct,
        };
      })
    );

    // Sort by exDate ascending before returning
    results.sort((a, b) => {
      const da = new Date(a.exDate);
      const db = new Date(b.exDate);
      return da - db;
    });

    return res.status(200).json(results);

  } catch (err) {
    console.error('dividends handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
