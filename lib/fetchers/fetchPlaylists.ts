
export async function fetchPlaylists(debouncedmood: string) {
    const res = await fetch(`/api/mood?mood=${debouncedmood}`)
    if (!res.ok){
        console.error("Failed to fetch playlists")
    } else{
        const result = res.json();
        return result
    }
}