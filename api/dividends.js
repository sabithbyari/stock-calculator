export default async function handler(req, res) {

    const { from, to } = req.query;

    if (!from || !to) {
        return res.status(400).json({
            error: 'Missing from/to parameters'
        });
    }

    try {

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.nseindia.com/'
        };

        // Initialize NSE session
        await fetch(
            'https://www.nseindia.com',
            { headers }
        );

        const dividendUrl =
            `https://www.nseindia.com/api/corporates-corporateActions` +
            `?index=equities` +
            `&from_date=${from}` +
            `&to_date=${to}` +
            `&subject=Dividend`;

        const dividendResp = await fetch(
            dividendUrl,
            { headers }
        );

        if (!dividendResp.ok) {

            return res.status(dividendResp.status).json({
                error:
                    `NSE Dividend API returned ${dividendResp.status}`
            });

        }

        const dividendData =
            await dividendResp.json();

        const results = [];

        for (const row of dividendData) {

            const symbol = row.symbol;

            let cmp = 0;

            try {

                const quoteResp = await fetch(
                    `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`,
                    { headers }
                );

                if (quoteResp.ok) {

                    const quote =
                        await quoteResp.json();

                    cmp =
                        quote?.priceInfo?.lastPrice || 0;

                    if (typeof cmp === 'string') {

                        cmp = parseFloat(
                            cmp.replace(/,/g, '')
                        );

                    }

                }

            } catch (e) {

                console.error(
                    `CMP fetch failed for ${symbol}`,
                    e.message
                );

            }

            const subject =
                row.subject || '';

            const match =
                subject.match(
                    /(?:Rs|Re)\s*([\d.]+)/i
                );

            const dividend =
                match
                    ? parseFloat(match[1])
                    : 0;

            const yieldPct =
                dividend > 0 && cmp > 0
                    ? Number(
                        (
                            (dividend / cmp) * 100
                        ).toFixed(2)
                    )
                    : 0;

            results.push({

                symbol,

                company:
                    row.comp || '',

                exDate:
                    row.exDate || '',

                recDate:
                    row.recDate || '',

                subject,

                dividend,

                cmp,

                yieldPct

            });

        }

        return res.status(200).json(results);

    }
    catch (err) {

        console.error(err);

        return res.status(500).json({
            error: err.message
        });

    }
}
