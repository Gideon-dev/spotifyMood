declare module "spotify-web-api-node" {
    interface SpotifyApiConfig {
      clientId?: string
      clientSecret?: string
      accessToken?: string
      refreshToken?: string
      redirectUri?: string
    }
  
    class SpotifyWebApi {
      constructor(config?: SpotifyApiConfig)
      setAccessToken(token: string): void
      setRefreshToken(token: string): void
      setClientId(id: string): void
      setClientSecret(secret: string): void
      setRedirectURI(uri: string): void
      getMe(): Promise<any>
      refreshAccessToken(): Promise<{ body: any }>
      [key: string]: any // fallback for other methods
    }
  
    export = SpotifyWebApi
  }
  