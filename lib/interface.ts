export type headingProps = {
    text:string,
    styling?:string
}

export type futureProps = {
    image: string,
    heading: string,
    text:string
}

export interface ExtendedToken {
accessToken?: string,
refreshToken?: string,
accessTokenExpires?: number,
spotifyId?:string,
email?:string,
displayName?: string,
error?: string;

}


export interface ExtendedSesion{
accessToken?: string;
refreshToken?: string;
user?: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  spotifyId?: string | null;
  displayName?: string | null;
  error?: string;
}
}

