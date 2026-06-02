export default async function handler(req, res) {

    const { from, to } = req.query;

    if (!from || !to) {
        return res.status(400).json({
            error: 'Missing from/to parameters'
        });
    }

    try {

        const nseUrl =
            `https://www.nseindia.com/api/corporates-corporateActions` +
            `?index=equities` +
            `&from_date=${from}` +
            `&to_date=${to}` +
            `&subject=Dividend`;

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.nseindia.com/'
        };

        // Create NSE session
        await fetch('https://www.nseindia.com', {
            headers
        });

        // Fetch dividend data
        const response = await fetch(nseUrl, {
            headers
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `NSE returned ${response.status}`
            });
        }

        const data = await response.json();

        return res.status(200).json(data);

    } catch (err) {

        return res.status(500).json({
            error: err.message
        });

    }
}
