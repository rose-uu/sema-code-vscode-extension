export const skillHubConfig = {
    searchUrl: (query: string) => `https://lightmake.site/api/v1/search?q=${encodeURIComponent(query)}`,
    downloadUrl: (slug: string) => `https://lightmake.site/api/v1/download?slug=${encodeURIComponent(slug)}`,
};
