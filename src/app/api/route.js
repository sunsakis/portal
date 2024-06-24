let location = { latitude: 51.505, longitude: -0.09 }; // Default location

export async function POST(req) {
  const body = await req.json();
  console.log(body);

  location = body; // Update the module-scoped variable

  return new Response('Location updated');
}

export async function GET() {
    console.log('location found')
    return new Response(
      JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
      }),
      {
        headers: {
          'content-type': 'application/json',
        },
      }
    );
}
