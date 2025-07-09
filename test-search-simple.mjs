// Simple test of the Ticketmaster API directly
const TICKETMASTER_API_KEY = 'k8GrSAkbFaN0w7qDxGl7ohr8LwdAQm9b';
const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

async function testTicketmaster() {
  try {
    console.log('Testing Ticketmaster API...');
    
    const response = await fetch(
      `${TICKETMASTER_BASE_URL}/attractions.json?` + 
      `keyword=${encodeURIComponent('Taylor Swift')}` +
      `&classificationName=music` +
      `&size=5` +
      `&apikey=${TICKETMASTER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response structure:', {
      hasEmbedded: !!data._embedded,
      hasAttractions: !!data._embedded?.attractions,
      attractionsCount: data._embedded?.attractions?.length || 0
    });
    
    if (data._embedded?.attractions) {
      console.log('First attraction:', JSON.stringify(data._embedded.attractions[0], null, 2));
    }
  } catch (error) {
    console.error('Ticketmaster API test failed:', error.message);
  }
}

testTicketmaster();