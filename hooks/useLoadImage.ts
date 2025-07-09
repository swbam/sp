export const useLoadImage = (data: any) => {
  if (!data) {
    return '/images/music-placeholder.png';
  }

  // Handle different data structures
  const imageUrl = data.image_url || data.image_path || data.images?.[0]?.url;
  
  if (!imageUrl || imageUrl.includes('undefined') || imageUrl.includes('null')) {
    return '/images/music-placeholder.png';
  }

  return imageUrl;
};
