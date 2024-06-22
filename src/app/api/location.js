// In-memory store for the latest location
let latestLocation = { latitude: null, longitude: null };

export default async function handler(req, res) {
  // Handle POST requests from Telegram
  if (req.method === 'POST') {
    const { message } = req.body;

    if (message && message.location) {
      const { latitude, longitude } = message.location;
      // Update the in-memory store with the new location
      latestLocation = { latitude, longitude };
      console.log(`New location: ${latitude}, ${longitude}`);
      res.status(200).send('OK');
    } else {
      res.status(400).send('Bad Request');
    }
  }
  // Handle GET requests to serve the latest location
  else if (req.method === 'GET') {
    if (latestLocation.latitude && latestLocation.longitude) {
      res.status(200).json(latestLocation);
    } else {
      res.status(404).send('Location not found');
    }
  } else {
    // Not a POST or GET request
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end('Method Not Allowed');
  }
}