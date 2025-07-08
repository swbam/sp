const TICKETMASTER_API_KEY = process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY;
const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export interface TicketmasterArtist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    ratio: string;
    width: number;
    height: number;
  }>;
  genres: string[];
  url: string;
}

export async function searchArtists(query: string): Promise<TicketmasterArtist[]> {
  if (!TICKETMASTER_API_KEY) {
    throw new Error('Ticketmaster API key not configured');
  }

  try {
    const response = await fetch(
      `${TICKETMASTER_BASE_URL}/attractions.json?` + 
      `keyword=${encodeURIComponent(query)}` +
      `&classificationName=music` +
      `&size=20` +
      `&apikey=${TICKETMASTER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Ticketmaster API');
    }

    const data = await response.json();
    
    if (!data._embedded?.attractions) {
      return [];
    }

    return data._embedded.attractions.map((attraction: any) => ({
      id: attraction.id,
      name: attraction.name,
      images: attraction.images || [],
      genres: attraction.classifications?.[0]?.genre?.name 
        ? [attraction.classifications[0].genre.name]
        : [],
      url: attraction.url
    }));
  } catch (error) {
    console.error('Error searching Ticketmaster artists:', error);
    return [];
  }
} 